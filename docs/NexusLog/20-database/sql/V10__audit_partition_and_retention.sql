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