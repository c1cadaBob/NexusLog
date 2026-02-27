很好，我们上 **V10**。
这版重点：`data_change_audit` **月分区**、**归档生命周期**、**冷热分层查询**。

> 建议文件名：`V10__audit_partition_and_retention.sql`
> ⚠️ 含历史数据搬迁，建议在低峰执行。

```sql
-- V10__audit_partition_and_retention.sql
SET lock_timeout = '5s';
SET statement_timeout = '0';

-- =========================================================
-- 0) 冷数据 schema + 生命周期台账
-- =========================================================
CREATE SCHEMA IF NOT EXISTS obs_cold;

CREATE TABLE IF NOT EXISTS obs.audit_partition_lifecycle (
  partition_name      text PRIMARY KEY,
  range_from          timestamptz NOT NULL,
  range_to            timestamptz NOT NULL,
  tier                varchar(8)  NOT NULL DEFAULT 'HOT'
                      CHECK (tier IN ('HOT','COLD')),
  status              varchar(24) NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE','ARCHIVE_QUEUED','DETACHED','DROPPED','FAILED')),
  export_job_id       uuid,
  object_uri          text,
  manifest_digest     char(64),
  retention_until     timestamptz,
  note                text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apl_tier_status
  ON obs.audit_partition_lifecycle(tier, status, range_to);

-- =========================================================
-- 1) 分区辅助函数
-- =========================================================
CREATE OR REPLACE FUNCTION obs.ensure_data_change_audit_partition(p_month date)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_start_date date := date_trunc('month', p_month)::date;
  v_end_date   date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_start_ts   timestamptz := (v_start_date::text || ' 00:00:00+00')::timestamptz;
  v_end_ts     timestamptz := (v_end_date::text   || ' 00:00:00+00')::timestamptz;
  v_part_name  text := format('data_change_audit_y%sm%s', to_char(v_start_date,'YYYY'), to_char(v_start_date,'MM'));
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_partitioned_table pt
    JOIN pg_class c ON c.oid = pt.partrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'obs' AND c.relname = 'data_change_audit'
  ) THEN
    RAISE EXCEPTION 'obs.data_change_audit is not partitioned';
  END IF;

  IF to_regclass(format('obs.%I', v_part_name)) IS NULL THEN
    EXECUTE format(
      'CREATE TABLE obs.%I PARTITION OF obs.data_change_audit FOR VALUES FROM (%L) TO (%L)',
      v_part_name, v_start_ts, v_end_ts
    );
  END IF;

  RETURN v_part_name;
END;
$$;

CREATE OR REPLACE FUNCTION obs.ensure_data_change_audit_future_partitions(p_months_ahead int DEFAULT 3)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  i int;
  v_cnt int := 0;
  v_month date;
BEGIN
  FOR i IN 0..GREATEST(p_months_ahead, 0) LOOP
    v_month := (date_trunc('month', now())::date + make_interval(months => i))::date;
    PERFORM obs.ensure_data_change_audit_partition(v_month);
    v_cnt := v_cnt + 1;
  END LOOP;
  RETURN v_cnt;
END;
$$;

CREATE OR REPLACE FUNCTION obs.list_attached_data_change_audit_partitions()
RETURNS TABLE(
  partition_name text,
  range_from timestamptz,
  range_to timestamptz
)
LANGUAGE sql
AS $$
  SELECT
    c.relname::text AS partition_name,
    (regexp_match(pg_get_expr(c.relpartbound, c.oid), $$FROM \('([^']+)'\) TO \('([^']+)'\)$$))[1]::timestamptz AS range_from,
    (regexp_match(pg_get_expr(c.relpartbound, c.oid), $$FROM \('([^']+)'\) TO \('([^']+)'\)$$))[2]::timestamptz AS range_to
  FROM pg_class c
  JOIN pg_inherits i ON i.inhrelid = c.oid
  JOIN pg_class p ON p.oid = i.inhparent
  JOIN pg_namespace np ON np.oid = p.relnamespace
  WHERE np.nspname = 'obs'
    AND p.relname = 'data_change_audit'
  ORDER BY range_from;
$$;

CREATE OR REPLACE FUNCTION obs.refresh_audit_partition_registry()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
  v_cnt int := 0;
BEGIN
  FOR r IN SELECT * FROM obs.list_attached_data_change_audit_partitions()
  LOOP
    INSERT INTO obs.audit_partition_lifecycle(
      partition_name, range_from, range_to, tier, status, updated_at
    )
    VALUES (
      r.partition_name, r.range_from, r.range_to, 'HOT', 'ACTIVE', now()
    )
    ON CONFLICT (partition_name) DO UPDATE
      SET range_from = EXCLUDED.range_from,
          range_to   = EXCLUDED.range_to,
          tier       = 'HOT',
          status     = CASE
                         WHEN obs.audit_partition_lifecycle.status = 'DROPPED' THEN 'DROPPED'
                         ELSE 'ACTIVE'
                       END,
          updated_at = now();

    v_cnt := v_cnt + 1;
  END LOOP;

  RETURN v_cnt;
END;
$$;

-- =========================================================
-- 2) 主迁移：普通表 -> 月分区表
-- =========================================================
DO $$
DECLARE
  v_partitioned boolean;
  v_min_ts timestamptz;
  v_max_ts timestamptz;
  v_old_cnt bigint;
  v_new_cnt bigint;
  v_month date;
BEGIN
  IF to_regclass('obs.data_change_audit') IS NULL THEN
    RAISE EXCEPTION 'obs.data_change_audit not found, please run V8 first';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_partitioned_table pt
    JOIN pg_class c ON c.oid = pt.partrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='obs' AND c.relname='data_change_audit'
  ) INTO v_partitioned;

  IF v_partitioned THEN
    RAISE NOTICE 'obs.data_change_audit already partitioned, skip convert.';
    RETURN;
  END IF;

  IF to_regclass('obs.data_change_audit_legacy') IS NOT NULL THEN
    RAISE EXCEPTION 'obs.data_change_audit_legacy already exists; please clean previous failed migration first';
  END IF;

  LOCK TABLE obs.data_change_audit IN ACCESS EXCLUSIVE MODE;

  ALTER TABLE obs.data_change_audit RENAME TO data_change_audit_legacy;

  CREATE TABLE obs.data_change_audit (
    id              uuid NOT NULL DEFAULT gen_random_uuid(),
    changed_at      timestamptz NOT NULL DEFAULT now(),
    source_txid     bigint NOT NULL DEFAULT txid_current(),

    tenant_id       uuid,
    project_id      uuid,
    env_id          uuid,

    table_schema    text NOT NULL,
    table_name      text NOT NULL,
    operation       varchar(8) NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
    row_pk          jsonb NOT NULL DEFAULT '{}'::jsonb,

    before_data     jsonb,
    after_data      jsonb,

    trace_id        varchar(128),
    actor_type      varchar(32),
    actor_id        varchar(128),
    app_name        text DEFAULT current_setting('application_name', true),
    client_addr     inet DEFAULT inet_client_addr(),

    PRIMARY KEY (changed_at, id)
  ) PARTITION BY RANGE (changed_at);

  CREATE TABLE IF NOT EXISTS obs.data_change_audit_default
    PARTITION OF obs.data_change_audit DEFAULT;

  -- 分区父索引（未来分区自动带）
  CREATE INDEX IF NOT EXISTS idx_dca_tenant_time
    ON obs.data_change_audit (tenant_id, changed_at DESC);

  CREATE INDEX IF NOT EXISTS idx_dca_table_time
    ON obs.data_change_audit (table_schema, table_name, changed_at DESC);

  CREATE INDEX IF NOT EXISTS idx_dca_trace
    ON obs.data_change_audit (trace_id);

  CREATE INDEX IF NOT EXISTS idx_dca_rowpk_gin
    ON obs.data_change_audit USING gin (row_pk);

  CREATE INDEX IF NOT EXISTS idx_dca_changed_brin
    ON obs.data_change_audit USING brin (changed_at) WITH (pages_per_range=128);

  SELECT min(changed_at), max(changed_at), count(*)
    INTO v_min_ts, v_max_ts, v_old_cnt
  FROM obs.data_change_audit_legacy;

  IF v_min_ts IS NULL THEN
    PERFORM obs.ensure_data_change_audit_partition(current_date);
  ELSE
    v_month := date_trunc('month', v_min_ts)::date;
    WHILE v_month <= date_trunc('month', v_max_ts)::date LOOP
      PERFORM obs.ensure_data_change_audit_partition(v_month);
      v_month := (v_month + interval '1 month')::date;
    END LOOP;
  END IF;

  PERFORM obs.ensure_data_change_audit_future_partitions(3);

  INSERT INTO obs.data_change_audit(
    id, changed_at, source_txid,
    tenant_id, project_id, env_id,
    table_schema, table_name, operation, row_pk,
    before_data, after_data,
    trace_id, actor_type, actor_id, app_name, client_addr
  )
  SELECT
    id, changed_at, source_txid,
    tenant_id, project_id, env_id,
    table_schema, table_name, operation, row_pk,
    before_data, after_data,
    trace_id, actor_type, actor_id, app_name, client_addr
  FROM obs.data_change_audit_legacy
  ORDER BY changed_at, id;

  SELECT count(*) INTO v_new_cnt FROM obs.data_change_audit;

  IF v_old_cnt <> v_new_cnt THEN
    RAISE EXCEPTION 'data count mismatch after partition migration: old=%, new=%', v_old_cnt, v_new_cnt;
  END IF;

  COMMENT ON TABLE obs.data_change_audit_legacy IS
    'Backup table created by V10 partition migration; drop manually after verification.';

  ANALYZE obs.data_change_audit;
END;
$$;

-- =========================================================
-- 3) 防篡改触发器 + RLS 刷新
-- =========================================================
CREATE OR REPLACE FUNCTION obs.fn_guard_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'obs.data_change_audit is append-only; % is not allowed', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_dca_append_only ON obs.data_change_audit;
CREATE TRIGGER trg_dca_append_only
BEFORE UPDATE OR DELETE ON obs.data_change_audit
FOR EACH ROW
EXECUTE FUNCTION obs.fn_guard_append_only();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='obs' AND p.proname='apply_rls_to_obs_tables'
  ) THEN
    PERFORM obs.apply_rls_to_obs_tables();
  END IF;
END $$;

SELECT obs.refresh_audit_partition_registry();
SELECT obs.ensure_data_change_audit_future_partitions(3);

-- =========================================================
-- 4) 归档计划：按分区入队导出任务（依赖 V9）
-- =========================================================
CREATE OR REPLACE FUNCTION obs.plan_audit_partition_export_jobs(
  p_hot_months int DEFAULT 6,
  p_destination_uri_prefix text DEFAULT 's3://your-bucket/audit-partitions',
  p_requested_by text DEFAULT 'partition-maintenance',
  p_retention_months int DEFAULT 120
)
RETURNS TABLE(partition_name text, export_job_id uuid, from_ts timestamptz, to_ts timestamptz)
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
  v_cutoff timestamptz := date_trunc('month', now() - make_interval(months => p_hot_months));
  v_job uuid;
  v_exists boolean;
BEGIN
  IF to_regprocedure('obs.enqueue_audit_export_job(timestamptz,timestamptz,text,uuid,varchar,text,timestamptz)') IS NULL THEN
    RAISE EXCEPTION 'V9 enqueue_audit_export_job() not found';
  END IF;

  PERFORM obs.refresh_audit_partition_registry();

  FOR r IN
    SELECT *
    FROM obs.audit_partition_lifecycle
    WHERE tier = 'HOT'
      AND status = 'ACTIVE'
      AND range_to <= v_cutoff
    ORDER BY range_from
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM obs.audit_export_job j
      WHERE j.tenant_id IS NULL
        AND j.from_ts = r.range_from
        AND j.to_ts = r.range_to
        AND j.status IN ('PENDING','RUNNING','SUCCEEDED')
    ) INTO v_exists;

    IF v_exists THEN
      CONTINUE;
    END IF;

    SELECT obs.enqueue_audit_export_job(
      r.range_from,
      r.range_to,
      trim(trailing '/' from p_destination_uri_prefix) || '/' || r.partition_name || '/',
      NULL,
      'PARQUET',
      p_requested_by,
      now() + make_interval(months => p_retention_months)
    ) INTO v_job;

    UPDATE obs.audit_partition_lifecycle
    SET status = 'ARCHIVE_QUEUED',
        export_job_id = v_job,
        retention_until = now() + make_interval(months => p_retention_months),
        updated_at = now()
    WHERE partition_name = r.partition_name;

    partition_name := r.partition_name;
    export_job_id := v_job;
    from_ts := r.range_from;
    to_ts := r.range_to;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- =========================================================
-- 5) 冷热分层：将“已成功导出”的热分区转冷
-- =========================================================
CREATE OR REPLACE FUNCTION obs.detach_exported_audit_partitions(p_dry_run boolean DEFAULT true)
RETURNS TABLE(partition_name text, action text, detail text)
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      l.partition_name,
      l.export_job_id,
      m.object_uri,
      m.digest_sha256
    FROM obs.audit_partition_lifecycle l
    JOIN obs.audit_export_job j ON j.id = l.export_job_id
    JOIN obs.audit_export_manifest m ON m.job_id = j.id
    WHERE l.tier = 'HOT'
      AND l.status = 'ARCHIVE_QUEUED'
      AND j.status = 'SUCCEEDED'
  LOOP
    partition_name := r.partition_name;

    IF p_dry_run THEN
      action := 'DETACH_PLAN';
      detail := format('will detach obs.%I -> obs_cold.%I', r.partition_name, r.partition_name);
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF to_regclass(format('obs.%I', r.partition_name)) IS NULL THEN
      action := 'SKIP';
      detail := 'partition not found in obs schema';
      RETURN NEXT;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE obs.data_change_audit DETACH PARTITION obs.%I', r.partition_name);
    EXECUTE format('ALTER TABLE obs.%I SET SCHEMA obs_cold', r.partition_name);

    UPDATE obs.audit_partition_lifecycle
    SET tier = 'COLD',
        status = 'DETACHED',
        object_uri = r.object_uri,
        manifest_digest = r.digest_sha256,
        updated_at = now()
    WHERE partition_name = r.partition_name;

    action := 'DETACHED';
    detail := coalesce(r.object_uri, '');
    RETURN NEXT;
  END LOOP;
END;
$$;

-- =========================================================
-- 6) 删除超保留期冷分区
-- =========================================================
CREATE OR REPLACE FUNCTION obs.drop_cold_audit_partitions(
  p_retain_months int DEFAULT 36,
  p_dry_run boolean DEFAULT true
)
RETURNS TABLE(partition_name text, action text, detail text)
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
  v_cutoff timestamptz := date_trunc('month', now() - make_interval(months => p_retain_months));
BEGIN
  FOR r IN
    SELECT *
    FROM obs.audit_partition_lifecycle
    WHERE tier = 'COLD'
      AND status = 'DETACHED'
      AND range_to <= v_cutoff
    ORDER BY range_to
  LOOP
    partition_name := r.partition_name;

    IF p_dry_run THEN
      action := 'DROP_PLAN';
      detail := format('will drop obs_cold.%I', r.partition_name);
      RETURN NEXT;
      CONTINUE;
    END IF;

    EXECUTE format('DROP TABLE IF EXISTS obs_cold.%I', r.partition_name);

    UPDATE obs.audit_partition_lifecycle
    SET status = 'DROPPED',
        updated_at = now(),
        note = coalesce(note,'') || ' dropped by retention policy'
    WHERE partition_name = r.partition_name;

    action := 'DROPPED';
    detail := 'ok';
    RETURN NEXT;
  END LOOP;
END;
$$;

-- =========================================================
-- 7) 热/冷查询接口
-- =========================================================
CREATE OR REPLACE VIEW obs.v_data_change_audit_hot AS
SELECT * FROM obs.data_change_audit;

CREATE OR REPLACE VIEW obs.v_data_change_audit_cold_registry AS
SELECT *
FROM obs.audit_partition_lifecycle
WHERE tier = 'COLD' AND status = 'DETACHED'
ORDER BY range_from DESC;

CREATE OR REPLACE FUNCTION obs.query_data_change_audit_all(
  p_from_ts timestamptz,
  p_to_ts timestamptz,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  changed_at timestamptz,
  source_txid bigint,
  tenant_id uuid,
  project_id uuid,
  env_id uuid,
  table_schema text,
  table_name text,
  operation varchar(8),
  row_pk jsonb,
  before_data jsonb,
  after_data jsonb,
  trace_id varchar(128),
  actor_type varchar(32),
  actor_id varchar(128),
  app_name text,
  client_addr inet
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = obs, obs_cold, pg_catalog
AS $$
DECLARE
  r record;
BEGIN
  -- hot
  RETURN QUERY
  SELECT
    a.id, a.changed_at, a.source_txid,
    a.tenant_id, a.project_id, a.env_id,
    a.table_schema, a.table_name, a.operation, a.row_pk,
    a.before_data, a.after_data,
    a.trace_id, a.actor_type, a.actor_id, a.app_name, a.client_addr
  FROM obs.data_change_audit a
  WHERE a.changed_at >= p_from_ts
    AND a.changed_at < p_to_ts
    AND (p_tenant_id IS NULL OR a.tenant_id = p_tenant_id);

  -- cold（遍历已分离分区）
  FOR r IN
    SELECT partition_name
    FROM obs.audit_partition_lifecycle
    WHERE tier='COLD'
      AND status='DETACHED'
      AND range_to > p_from_ts
      AND range_from < p_to_ts
  LOOP
    IF to_regclass(format('obs_cold.%I', r.partition_name)) IS NULL THEN
      CONTINUE;
    END IF;

    RETURN QUERY EXECUTE format(
      'SELECT
         id, changed_at, source_txid,
         tenant_id, project_id, env_id,
         table_schema, table_name, operation, row_pk,
         before_data, after_data,
         trace_id, actor_type, actor_id, app_name, client_addr
       FROM obs_cold.%I
       WHERE changed_at >= $1
         AND changed_at < $2
         AND ($3 IS NULL OR tenant_id = $3)',
      r.partition_name
    ) USING p_from_ts, p_to_ts, p_tenant_id;
  END LOOP;
END;
$$;

-- =========================================================
-- 8) 权限（按角色存在与否）
-- =========================================================
REVOKE ALL ON SCHEMA obs_cold FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='obs_ops_admin') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA obs_cold TO obs_ops_admin';
    EXECUTE 'GRANT SELECT ON obs.audit_partition_lifecycle TO obs_ops_admin';
    EXECUTE 'GRANT EXECUTE ON FUNCTION obs.plan_audit_partition_export_jobs(int,text,text,int) TO obs_ops_admin';
    EXECUTE 'GRANT EXECUTE ON FUNCTION obs.detach_exported_audit_partitions(boolean) TO obs_ops_admin';
    EXECUTE 'GRANT EXECUTE ON FUNCTION obs.drop_cold_audit_partitions(int,boolean) TO obs_ops_admin';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='obs_audit_ro') THEN
    EXECUTE 'GRANT SELECT ON obs.v_data_change_audit_hot TO obs_audit_ro';
    EXECUTE 'GRANT SELECT ON obs.v_data_change_audit_cold_registry TO obs_audit_ro';
    EXECUTE 'GRANT EXECUTE ON FUNCTION obs.query_data_change_audit_all(timestamptz,timestamptz,uuid) TO obs_audit_ro';
  END IF;
END $$;

-- 可选巡检（执行后看结果）
-- SELECT * FROM obs.list_attached_data_change_audit_partitions();
-- SELECT * FROM obs.v_data_change_audit_cold_registry;
```

---

如果你愿意，我下一步给你一份 **V10 配套运维 Runbook**（含 pg_cron 定时策略）：
1) 每月建未来分区
2) 每日规划归档任务
3) 每日分离已导出分区
4) 每周删除超保留期冷分区。



太好了，我们把这套能力补上“可执行运维手册”。
你现在已经不只是有表结构，而是有一条**可长期稳定运行**的审计生命周期链路了，这一步非常关键。

---

## V10 配套运维 Runbook（含 pg_cron 策略）

## 1) 目标（你每天要自动完成什么）

1. 预创建未来分区（避免写入落 default 分区）
2. 对超出 HOT 窗口的分区自动创建导出任务
3. 导出成功后自动分离为 COLD 分区
4. 定期删除超保留期的冷分区
5. 每日完整性校验（V9）

---

## 2) 推荐调度节奏（UTC）

- **01:10 每日**：完整性校验（前一天）
- **01:20 每日**：确保未来分区存在（保险）
- **01:30 每日**：规划归档导出任务（队列化）
- **持续运行**：Export Worker 消费 `PENDING` 任务
- **03:30 每日**：分离已成功导出的分区（HOT -> COLD）
- **周日 04:00**：删除超保留期冷分区（先 dry-run，次日正式）

---

## 3) pg_cron 安装与任务注册（示例 SQL）

> 在目标数据库执行；若无 pg_cron，请先安装扩展。

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

### 3.1 每日完整性校验（V9）

```sql
SELECT cron.schedule(
  'obs-audit-integrity-daily',
  '10 1 * * *',
  $$SELECT obs.run_daily_audit_integrity_check(current_date - 1, NULL, true);$$
);
```

### 3.2 预创建未来 6 个月分区

```sql
SELECT cron.schedule(
  'obs-audit-ensure-future-partitions',
  '20 1 * * *',
  $$SELECT obs.ensure_data_change_audit_future_partitions(6);$$
);
```

### 3.3 规划归档导出任务（保留 HOT 6 个月）

```sql
SELECT cron.schedule(
  'obs-audit-plan-export-jobs',
  '30 1 * * *',
  $$SELECT * FROM obs.plan_audit_partition_export_jobs(
      6,
      's3://your-bucket/audit-partitions',
      'cron',
      120
    );$$
);
```

### 3.4 分离已成功导出的分区

```sql
SELECT cron.schedule(
  'obs-audit-detach-exported',
  '30 3 * * *',
  $$SELECT * FROM obs.detach_exported_audit_partitions(false);$$
);
```

### 3.5 周期清理冷分区（保留 36 个月）

```sql
SELECT cron.schedule(
  'obs-audit-drop-cold-weekly',
  '0 4 * * 0',
  $$SELECT * FROM obs.drop_cold_audit_partitions(36, false);$$
);
```

---

## 4) Export Worker（必须有）

`audit_export_job` 只是队列表，真正导出要由 Worker 执行：

流程：
1. 取 `PENDING` job
2. 调 `obs.start_audit_export_job(job_id)`
3. 导出 `obs.data_change_audit` 时间窗数据到对象存储
4. 成功后调 `obs.complete_audit_export_job(...)`
5. 失败调 `obs.fail_audit_export_job(...)`

---

## 5) 每日巡检 SQL（值班直接用）

### 5.1 默认分区是否有“漏分区”写入
```sql
SELECT count(*) AS default_rows FROM obs.data_change_audit_default;
```
> `>0` 说明某月分区未及时创建或时间异常。

### 5.2 导出任务健康度
```sql
SELECT status, count(*) 
FROM obs.audit_export_job
GROUP BY status
ORDER BY status;
```

### 5.3 最近失败任务
```sql
SELECT id, from_ts, to_ts, error_message, updated_at
FROM obs.audit_export_job
WHERE status='FAILED'
ORDER BY updated_at DESC
LIMIT 20;
```

### 5.4 分区生命周期状态
```sql
SELECT tier, status, count(*)
FROM obs.audit_partition_lifecycle
GROUP BY tier, status
ORDER BY tier, status;
```

---

## 6) 故障处理准则（简版）

- **完整性校验报 MISMATCH**：立即告警，冻结清理动作，仅允许只读排查。
- **FAILED 导出任务**：修复后重试（新建 job 或重跑同时间窗）。
- **default 分区有数据**：先补建分区，再把 default 中对应月份数据回灌到主表。
- **DETACH 失败**：先 `dry_run` 看计划，再手动单分区处理。

---

如果你愿意，下一步我可以给你一份 **“Export Worker 参考实现”**（Node.js/Go 二选一），包含：
- 并发抢占（`FOR UPDATE SKIP LOCKED`）
- 幂等处理
- S3 上传 + ETag 回写
- 失败重试与死信策略。


太好了，我们直接落地。
下面给你一版 **可运行的 Node.js/TypeScript Export Worker（稳定 JSONL 版）**。这版先把链路跑通，保证“审计可导出、可追溯、可验真”，这是合规体系里最有价值的一步。

---

## 0) 先说明一个关键点

你当前 `V10` 里 `plan_audit_partition_export_jobs()` 默认创建 `PARQUET` 任务。
而我这版 Worker 先实现 **JSONL**（上线快、稳定、易排障）。

先执行一次（把待处理任务改为 JSONL）：

```sql
UPDATE obs.audit_export_job
SET format = 'JSONL'
WHERE status = 'PENDING'
  AND format = 'PARQUET';
```

---

## 1) 依赖

```bash
npm i pg pg-query-stream @aws-sdk/client-s3
npm i -D typescript ts-node @types/node
```

---

## 2) `worker.ts`（核心实现）

```ts
import { Pool } from "pg";
import QueryStream from "pg-query-stream";
import { once } from "events";
import { createWriteStream, createReadStream, promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

type Job = {
  id: string;
  tenant_id: string | null;
  from_ts: string;
  to_ts: string;
  format: "JSONL" | "CSV" | "PARQUET";
  destination_uri: string;
  worm_retention_until: string | null;
};

const DATABASE_URL = process.env.DATABASE_URL!;
const AWS_REGION = process.env.AWS_REGION || "ap-southeast-1";
const POLL_MS = Number(process.env.POLL_MS || 3000);

if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString: DATABASE_URL, max: 10 });
const s3 = new S3Client({ region: AWS_REGION });

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseS3Uri(uri: string): { bucket: string; prefix: string } {
  if (!uri.startsWith("s3://")) throw new Error(`invalid s3 uri: ${uri}`);
  const noScheme = uri.slice("s3://".length);
  const idx = noScheme.indexOf("/");
  if (idx < 0) return { bucket: noScheme, prefix: "" };
  const bucket = noScheme.slice(0, idx);
  let prefix = noScheme.slice(idx + 1);
  if (prefix && !prefix.endsWith("/")) prefix += "/";
  return { bucket, prefix };
}

async function claimJob(): Promise<Job | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const rs = await client.query<Job>(`
      SELECT id, tenant_id, from_ts, to_ts, format, destination_uri, worm_retention_until
      FROM obs.audit_export_job
      WHERE status = 'PENDING'
      ORDER BY requested_at, id
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);

    if (rs.rowCount === 0) {
      await client.query("COMMIT");
      return null;
    }

    const job = rs.rows[0];
    await client.query(`SELECT obs.start_audit_export_job($1)`, [job.id]);
    await client.query("COMMIT");
    return job;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function exportJobToJsonl(job: Job): Promise<{ filePath: string; rowCount: number }> {
  const filePath = join(tmpdir(), `audit-${job.id}-${randomUUID()}.jsonl`);
  const client = await pool.connect();
  let rowCount = 0;

  try {
    const sql = `
      SELECT row_to_json(x)::text AS line
      FROM (
        SELECT
          id, changed_at, source_txid,
          tenant_id, project_id, env_id,
          table_schema, table_name, operation, row_pk,
          before_data, after_data,
          trace_id, actor_type, actor_id, app_name, client_addr
        FROM obs.data_change_audit
        WHERE changed_at >= $1
          AND changed_at < $2
          AND ($3::uuid IS NULL OR tenant_id = $3::uuid)
        ORDER BY changed_at, id
      ) x
    `;
    const qs = new QueryStream(sql, [job.from_ts, job.to_ts, job.tenant_id]);
    const stream = client.query(qs);

    const ws = createWriteStream(filePath, { encoding: "utf8" });
    for await (const row of stream as AsyncIterable<{ line: string }>) {
      rowCount++;
      if (!ws.write(row.line + "\n")) {
        await once(ws, "drain");
      }
    }
    ws.end();
    await once(ws, "finish");

    return { filePath, rowCount };
  } finally {
    client.release();
  }
}

async function uploadToS3(job: Job, filePath: string): Promise<{ objectUri: string; etag?: string }> {
  const { bucket, prefix } = parseS3Uri(job.destination_uri);
  const key = `${prefix}${job.id}.jsonl`;

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: createReadStream(filePath),
    ContentType: "application/x-ndjson",
    // 若 bucket 已启用 Object Lock，可启用以下参数：
    ...(job.worm_retention_until
      ? {
          ObjectLockMode: "COMPLIANCE",
          ObjectLockRetainUntilDate: new Date(job.worm_retention_until),
        }
      : {}),
  });

  const resp = await s3.send(cmd);
  const etag = resp.ETag?.replace(/"/g, "");
  return { objectUri: `s3://${bucket}/${key}`, etag };
}

async function completeJob(jobId: string, objectUri: string, etag?: string) {
  await pool.query(
    `SELECT obs.complete_audit_export_job($1, $2, $3, $4)`,
    [jobId, objectUri, etag ?? null, "COMPLIANCE"]
  );
}

async function failJob(jobId: string, err: unknown) {
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  await pool.query(`SELECT obs.fail_audit_export_job($1, $2)`, [jobId, msg.slice(0, 4000)]);
}

async function handleJob(job: Job) {
  if (job.format !== "JSONL") {
    throw new Error(`unsupported format for this worker: ${job.format}`);
  }

  const { filePath, rowCount } = await exportJobToJsonl(job);
  try {
    const { objectUri, etag } = await uploadToS3(job, filePath);
    await completeJob(job.id, objectUri, etag);
    console.log(`[OK] job=${job.id} rows=${rowCount} uri=${objectUri}`);
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
}

async function main() {
  console.log("audit export worker started");
  while (true) {
    try {
      const job = await claimJob();
      if (!job) {
        await sleep(POLL_MS);
        continue;
      }
      await handleJob(job);
    } catch (e) {
      // 如果已拿到 job，但中途抛错，会在 handleJob 内 failJob；这里兜底日志
      console.error("[ERR]", e);
      await sleep(1000);
    }
  }
}

process.on("SIGINT", async () => {
  console.log("shutdown...");
  await pool.end();
  process.exit(0);
});

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
```

---

## 3) 运行

```bash
export DATABASE_URL='postgres://user:pass@host:5432/db'
export AWS_REGION='ap-southeast-1'
export POLL_MS=3000
npx ts-node worker.ts
```

---

## 4) 建议加一个“RUNNING 超时回收”任务（防僵尸任务）

```sql
UPDATE obs.audit_export_job
SET status='PENDING',
    error_message='requeued by watchdog',
    updated_at=now()
WHERE status='RUNNING'
  AND started_at < now() - interval '30 minutes';
```

可配 pg_cron 每 10 分钟跑一次。

---

如果你点头，我下一条直接给你 **PARQUET 版 Worker（DuckDB/Arrow 路线）**，这样就和你 V10 默认格式完全对齐。

太好了，直接给你 **PARQUET 版 Node.js Worker**（可落地版）。
你这一步做完，`V10` 的默认 `PARQUET` 生命周期就能闭环了。

---

## 1) 安装依赖

```bash
npm i pg pg-query-stream parquetjs-lite @aws-sdk/client-s3 @aws-sdk/lib-storage
npm i -D typescript ts-node @types/node
```

---

## 2) `worker-parquet.ts`

```ts
import { Pool } from "pg";
import QueryStream from "pg-query-stream";
import * as parquet from "parquetjs-lite";
import { createReadStream, promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

type Job = {
  id: string;
  tenant_id: string | null;
  from_ts: string;
  to_ts: string;
  format: "JSONL" | "CSV" | "PARQUET";
  destination_uri: string;
  worm_retention_until: string | null;
};

const DATABASE_URL = process.env.DATABASE_URL!;
const AWS_REGION = process.env.AWS_REGION || "ap-southeast-1";
const POLL_MS = Number(process.env.POLL_MS || 3000);

if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString: DATABASE_URL, max: 10 });
const s3 = new S3Client({ region: AWS_REGION });

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseS3Uri(uri: string): { bucket: string; prefix: string } {
  if (!uri.startsWith("s3://")) throw new Error(`invalid s3 uri: ${uri}`);
  const noScheme = uri.slice("s3://".length);
  const idx = noScheme.indexOf("/");
  if (idx < 0) return { bucket: noScheme, prefix: "" };
  const bucket = noScheme.slice(0, idx);
  let prefix = noScheme.slice(idx + 1);
  if (prefix && !prefix.endsWith("/")) prefix += "/";
  return { bucket, prefix };
}

async function claimJob(): Promise<Job | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const rs = await client.query<Job>(`
      SELECT id, tenant_id, from_ts, to_ts, format, destination_uri, worm_retention_until
      FROM obs.audit_export_job
      WHERE status = 'PENDING'
        AND format = 'PARQUET'
      ORDER BY requested_at, id
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);

    if (rs.rowCount === 0) {
      await client.query("COMMIT");
      return null;
    }

    const job = rs.rows[0];
    await client.query(`SELECT obs.start_audit_export_job($1::uuid)`, [job.id]);
    await client.query("COMMIT");
    return job;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

function parquetSchema() {
  return new parquet.ParquetSchema({
    id: { type: "UTF8" },
    changed_at: { type: "TIMESTAMP_MILLIS" },
    source_txid: { type: "UTF8" },

    tenant_id: { type: "UTF8", optional: true },
    project_id: { type: "UTF8", optional: true },
    env_id: { type: "UTF8", optional: true },

    table_schema: { type: "UTF8" },
    table_name: { type: "UTF8" },
    operation: { type: "UTF8" },

    row_pk: { type: "UTF8" },
    before_data: { type: "UTF8", optional: true },
    after_data: { type: "UTF8", optional: true },

    trace_id: { type: "UTF8", optional: true },
    actor_type: { type: "UTF8", optional: true },
    actor_id: { type: "UTF8", optional: true },
    app_name: { type: "UTF8", optional: true },
    client_addr: { type: "UTF8", optional: true },
  });
}

async function exportJobToParquet(job: Job): Promise<{ filePath: string; rowCount: number }> {
  const filePath = join(tmpdir(), `audit-${job.id}-${randomUUID()}.parquet`);
  const client = await pool.connect();

  let writer: parquet.ParquetWriter | null = null;
  let rowCount = 0;

  try {
    writer = await parquet.ParquetWriter.openFile(parquetSchema(), filePath);

    const sql = `
      SELECT
        id::text,
        changed_at,
        source_txid::text,

        tenant_id::text,
        project_id::text,
        env_id::text,

        table_schema,
        table_name,
        operation,

        row_pk::text,
        before_data::text,
        after_data::text,

        trace_id,
        actor_type,
        actor_id,
        app_name,
        client_addr::text
      FROM obs.data_change_audit
      WHERE changed_at >= $1
        AND changed_at < $2
        AND ($3::uuid IS NULL OR tenant_id = $3::uuid)
      ORDER BY changed_at, id
    `;

    const qs = new QueryStream(sql, [job.from_ts, job.to_ts, job.tenant_id], { batchSize: 2000 });
    const stream = client.query(qs);

    for await (const row of stream as AsyncIterable<any>) {
      await writer.appendRow({
        id: row.id,
        changed_at: row.changed_at ? new Date(row.changed_at) : null,
        source_txid: row.source_txid,

        tenant_id: row.tenant_id ?? undefined,
        project_id: row.project_id ?? undefined,
        env_id: row.env_id ?? undefined,

        table_schema: row.table_schema,
        table_name: row.table_name,
        operation: row.operation,

        row_pk: row.row_pk,
        before_data: row.before_data ?? undefined,
        after_data: row.after_data ?? undefined,

        trace_id: row.trace_id ?? undefined,
        actor_type: row.actor_type ?? undefined,
        actor_id: row.actor_id ?? undefined,
        app_name: row.app_name ?? undefined,
        client_addr: row.client_addr ?? undefined,
      });
      rowCount++;
    }

    await writer.close();
    writer = null;

    return { filePath, rowCount };
  } finally {
    if (writer) {
      await writer.close().catch(() => {});
    }
    client.release();
  }
}

async function uploadParquet(job: Job, filePath: string): Promise<{ objectUri: string; etag?: string }> {
  const { bucket, prefix } = parseS3Uri(job.destination_uri);
  const key = `${prefix}${job.id}.parquet`;

  const uploader = new Upload({
    client: s3,
    params: {
      Bucket: bucket,
      Key: key,
      Body: createReadStream(filePath),
      ContentType: "application/octet-stream",
      ...(job.worm_retention_until
        ? {
            ObjectLockMode: "COMPLIANCE",
            ObjectLockRetainUntilDate: new Date(job.worm_retention_until),
          }
        : {}),
    },
  });

  const resp: any = await uploader.done();
  const etag = resp?.ETag ? String(resp.ETag).replace(/"/g, "") : undefined;

  return { objectUri: `s3://${bucket}/${key}`, etag };
}

async function completeJob(jobId: string, objectUri: string, etag?: string) {
  await pool.query(
    `SELECT obs.complete_audit_export_job($1::uuid, $2::text, $3::text, $4::varchar)`,
    [jobId, objectUri, etag ?? null, "COMPLIANCE"]
  );
}

async function failJob(jobId: string, err: unknown) {
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  await pool.query(`SELECT obs.fail_audit_export_job($1::uuid, $2::text)`, [
    jobId,
    msg.slice(0, 4000),
  ]);
}

async function handleJob(job: Job) {
  const { filePath, rowCount } = await exportJobToParquet(job);
  try {
    const { objectUri, etag } = await uploadParquet(job, filePath);
    await completeJob(job.id, objectUri, etag);
    console.log(`[OK] job=${job.id} rows=${rowCount} uri=${objectUri}`);
  } finally {
    await fs.unlink(filePath).catch(() => {});
  }
}

async function main() {
  console.log("PARQUET export worker started");
  while (true) {
    let job: Job | null = null;
    try {
      job = await claimJob();
      if (!job) {
        await sleep(POLL_MS);
        continue;
      }
      await handleJob(job);
    } catch (e) {
      console.error("[ERR]", e);
      if (job) {
        await failJob(job.id, e).catch((ee) => console.error("[FAIL_JOB_ERR]", ee));
      }
      await sleep(1000);
    }
  }
}

process.on("SIGINT", async () => {
  console.log("shutdown...");
  await pool.end();
  process.exit(0);
});

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
```

---

## 3) 启动

```bash
export DATABASE_URL='postgres://user:pass@host:5432/db'
export AWS_REGION='ap-southeast-1'
export POLL_MS=3000
npx ts-node worker-parquet.ts
```

---

## 4) 快速验收 SQL

```sql
-- 1) 看队列状态
SELECT status, count(*) FROM obs.audit_export_job GROUP BY status ORDER BY status;

-- 2) 看最近成功任务
SELECT id, from_ts, to_ts, object_uri, updated_at
FROM obs.audit_export_job
WHERE status='SUCCEEDED'
ORDER BY updated_at DESC
LIMIT 10;
```

---

如果你愿意，我下一步给你补一版 **Dockerfile + systemd + 健康检查 endpoint**，让这个 Worker 直接上生产。

很好，我们直接上生产化模板。下面给你 **Docker + systemd + 健康检查** 一套可直接用的版本（基于你现有 `worker-parquet.ts`）。

---

## 1) 给 Worker 增加健康检查与优雅停机

> 新建：`src/worker-parquet.ts`（在你原文件基础上加这段逻辑）

关键新增点：
- `/live`：进程活着就 200
- `/ready`：DB 可连通 + 主循环没卡死 + 没有超长卡住任务
- 处理 `SIGTERM`（容器/systemd 正常停机）

```ts
import http from "http";
// ...你原来的 import 保持不变

const HEALTH_PORT = Number(process.env.HEALTH_PORT || 8080);
const LOOP_STALE_MS = Number(process.env.LOOP_STALE_MS || 30000); // 主循环卡死阈值
const JOB_STUCK_SEC = Number(process.env.JOB_STUCK_SEC || 3600);  // 单任务超时阈值

let shuttingDown = false;
let lastLoopAt = Date.now();
let lastSuccessAt: number | null = null;
let lastError: string | null = null;
let inFlight: { jobId: string; startedAt: number } | null = null;

async function dbReady() {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

const healthServer = http.createServer(async (req, res) => {
  if (!req.url) return res.end();

  if (req.url === "/live") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: true, shuttingDown }));
  }

  if (req.url === "/ready") {
    const dbOk = await dbReady();
    const loopFresh = Date.now() - lastLoopAt < LOOP_STALE_MS;
    const jobNotStuck =
      !inFlight || (Date.now() - inFlight.startedAt) / 1000 < JOB_STUCK_SEC;

    const ok = dbOk && loopFresh && jobNotStuck && !shuttingDown;
    res.writeHead(ok ? 200 : 503, { "content-type": "application/json" });
    return res.end(
      JSON.stringify({
        ok,
        dbOk,
        loopFresh,
        jobNotStuck,
        shuttingDown,
        inFlight,
        lastSuccessAt,
        lastError,
      })
    );
  }

  res.writeHead(404).end();
});

async function main() {
  healthServer.listen(HEALTH_PORT, () => {
    console.log(`health server listening on :${HEALTH_PORT}`);
  });

  console.log("PARQUET export worker started");
  while (!shuttingDown) {
    lastLoopAt = Date.now();
    let job: Job | null = null;

    try {
      job = await claimJob();
      if (!job) {
        await sleep(POLL_MS);
        continue;
      }

      inFlight = { jobId: job.id, startedAt: Date.now() };
      await handleJob(job);
      lastSuccessAt = Date.now();
      lastError = null;
    } catch (e) {
      lastError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      console.error("[ERR]", e);
      if (job) await failJob(job.id, e).catch(console.error);
      await sleep(1000);
    } finally {
      inFlight = null;
    }
  }
}

async function shutdown(signal: string) {
  console.log(`received ${signal}, shutting down...`);
  shuttingDown = true;
  healthServer.close();
  await pool.end();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
```

---

## 2) Dockerfile（多阶段构建）

> 文件：`Dockerfile`

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache tini
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV HEALTH_PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.HEALTH_PORT||8080)+'/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","dist/worker-parquet.js"]
```

---

## 3) package.json / tsconfig 最小配置

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/worker-parquet.js"
  }
}
```

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*.ts"]
}
```

---

## 4) systemd（非容器部署时用）

> 文件：`/etc/systemd/system/audit-export-worker.service`

```ini
[Unit]
Description=Audit Export Worker (Parquet)
After=network.target

[Service]
Type=simple
User=app
Group=app
WorkingDirectory=/opt/audit-worker
EnvironmentFile=/etc/audit-export-worker.env
ExecStart=/usr/bin/node /opt/audit-worker/dist/worker-parquet.js
Restart=always
RestartSec=5
TimeoutStopSec=30
KillSignal=SIGTERM
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

> 环境文件：`/etc/audit-export-worker.env`

```bash
DATABASE_URL=postgres://user:pass@host:5432/db
AWS_REGION=ap-southeast-1
POLL_MS=3000
HEALTH_PORT=8080
LOOP_STALE_MS=30000
JOB_STUCK_SEC=3600
```

启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now audit-export-worker
sudo systemctl status audit-export-worker
journalctl -u audit-export-worker -f
```

---

## 5) 一条验收命令

```bash
curl -s http://127.0.0.1:8080/ready | jq
```

返回 `ok=true` 就说明 worker 处于可接单状态。

---

如果你愿意，我下一步给你补一份 **“重试与死信策略 SQL + 指标看板（Prometheus/Grafana）”**，这样你就有完整的生产可观测性闭环。