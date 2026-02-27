太好了，我们继续落地。下面给你 **可直接接入 Flyway** 的增强方案（在你现有 75 表基线之上）。

---

## 1) Flyway 目录建议（可直接用）

```text
sql/
  V1__baseline_75_tables.sql          -- 你上一步那份全量建表脚本
  V2__seed_incident_status_transition.sql
  V3__incident_state_machine_trigger.sql
  V4__partition_maintenance.sql
  V5__outbox_events.sql
```

> 如果你已经执行过 `V1`，从 `V2` 开始执行即可。

---

## 2) V2__seed_incident_status_transition.sql

```sql
-- Incident 合法状态迁移表
CREATE TABLE IF NOT EXISTS obs.incident_status_transition (
  from_status varchar(16) NOT NULL,
  to_status   varchar(16) NOT NULL,
  PRIMARY KEY (from_status, to_status)
);

-- 清空并重灌（可选）
TRUNCATE TABLE obs.incident_status_transition;

INSERT INTO obs.incident_status_transition(from_status, to_status) VALUES
-- 主路径
('NEW','ALERTED'),
('ALERTED','ACKED'),
('ACKED','MITIGATING'),
('MITIGATING','MITIGATED'),
('MITIGATED','RESOLVED'),
('RESOLVED','POSTMORTEM'),
('POSTMORTEM','ARCHIVED'),

-- 异常/终止路径
('NEW','CLOSED'),
('ALERTED','ESCALATED'),
('ALERTED','CLOSED'),
('ACKED','ESCALATED'),
('ACKED','CLOSED'),
('MITIGATING','ESCALATED'),
('MITIGATED','ESCALATED'),
('ESCALATED','ACKED'),
('ESCALATED','MITIGATING'),
('ESCALATED','RESOLVED'),
('ESCALATED','CLOSED'),
('RESOLVED','CLOSED');
```

---

## 3) V3__incident_state_machine_trigger.sql

```sql
CREATE OR REPLACE FUNCTION obs.fn_incident_status_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- 只在状态变化时检查
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT EXISTS (
      SELECT 1
      FROM obs.incident_status_transition t
      WHERE t.from_status = OLD.status
        AND t.to_status   = NEW.status
    ) THEN
      RAISE EXCEPTION '非法状态迁移: % -> % (incident_no=%)', OLD.status, NEW.status, OLD.incident_no;
    END IF;

    -- 自动打时间戳
    IF NEW.status = 'ALERTED' AND NEW.alerted_at IS NULL THEN
      NEW.alerted_at := now();
    ELSIF NEW.status = 'ACKED' AND NEW.acked_at IS NULL THEN
      NEW.acked_at := now();
    ELSIF NEW.status = 'MITIGATED' AND NEW.mitigated_at IS NULL THEN
      NEW.mitigated_at := now();
    ELSIF NEW.status = 'RESOLVED' AND NEW.resolved_at IS NULL THEN
      NEW.resolved_at := now();
    ELSIF NEW.status = 'ARCHIVED' AND NEW.archived_at IS NULL THEN
      NEW.archived_at := now();
    END IF;
  END IF;

  -- 基础时间一致性校验
  IF NEW.alerted_at IS NOT NULL AND NEW.detected_at IS NOT NULL AND NEW.alerted_at < NEW.detected_at THEN
    RAISE EXCEPTION '时间错误: alerted_at < detected_at (incident_no=%)', NEW.incident_no;
  END IF;
  IF NEW.acked_at IS NOT NULL AND NEW.alerted_at IS NOT NULL AND NEW.acked_at < NEW.alerted_at THEN
    RAISE EXCEPTION '时间错误: acked_at < alerted_at (incident_no=%)', NEW.incident_no;
  END IF;
  IF NEW.resolved_at IS NOT NULL AND NEW.alerted_at IS NOT NULL AND NEW.resolved_at < NEW.alerted_at THEN
    RAISE EXCEPTION '时间错误: resolved_at < alerted_at (incident_no=%)', NEW.incident_no;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incident_status_guard ON obs.incident;
CREATE TRIGGER trg_incident_status_guard
BEFORE UPDATE OF status, alerted_at, acked_at, mitigated_at, resolved_at, archived_at
ON obs.incident
FOR EACH ROW
EXECUTE FUNCTION obs.fn_incident_status_guard();
```

---

## 4) V4__partition_maintenance.sql

```sql
-- 创建某月分区（命名: 表名_YYYYMM）
CREATE OR REPLACE FUNCTION obs.create_month_partition(p_parent regclass, p_month date)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_start        timestamptz := date_trunc('month', p_month)::timestamptz;
  v_end          timestamptz := (date_trunc('month', p_month) + interval '1 month')::timestamptz;
  v_schema_name  text;
  v_table_name   text;
  v_child_name   text;
BEGIN
  SELECT n.nspname, c.relname
    INTO v_schema_name, v_table_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.oid = p_parent;

  IF v_table_name IS NULL THEN
    RAISE EXCEPTION 'parent table not found: %', p_parent;
  END IF;

  v_child_name := format('%s_%s', v_table_name, to_char(v_start, 'YYYYMM'));

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I.%I PARTITION OF %I.%I FOR VALUES FROM (%L) TO (%L)',
    v_schema_name, v_child_name, v_schema_name, v_table_name, v_start, v_end
  );
END;
$$;

-- 预创建未来 N 个月分区
CREATE OR REPLACE FUNCTION obs.ensure_future_partitions(p_months_ahead int DEFAULT 3)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  i int;
  v_month date;
BEGIN
  FOR i IN 0..p_months_ahead LOOP
    v_month := (date_trunc('month', now()) + make_interval(months => i))::date;

    PERFORM obs.create_month_partition('obs.operation_audit_log'::regclass, v_month);
    PERFORM obs.create_month_partition('obs.health_check_result'::regclass, v_month);
    PERFORM obs.create_month_partition('obs.incident_timeline'::regclass, v_month);
  END LOOP;
END;
$$;

-- 按命名规则清理老分区（保留近 keep_months 月）
CREATE OR REPLACE FUNCTION obs.drop_old_month_partitions(p_parent regclass, p_keep_months int)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
  v_cutoff date := (date_trunc('month', now()) - make_interval(months => p_keep_months))::date;
  v_part_month date;
  v_drop_count int := 0;
BEGIN
  FOR r IN
    SELECT ns.nspname AS schema_name, c.relname AS part_name
    FROM pg_inherits i
    JOIN pg_class c ON c.oid = i.inhrelid
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE i.inhparent = p_parent
      AND c.relname ~ '.*_[0-9]{6}$'
  LOOP
    v_part_month := to_date(right(r.part_name, 6), 'YYYYMM');
    IF v_part_month < v_cutoff THEN
      EXECUTE format('DROP TABLE IF EXISTS %I.%I', r.schema_name, r.part_name);
      v_drop_count := v_drop_count + 1;
    END IF;
  END LOOP;

  RETURN v_drop_count;
END;
$$;

-- 初始化执行一次
SELECT obs.ensure_future_partitions(6);
```

---

## 5) V5__outbox_events.sql（DB-Kafka 一致性关键）

```sql
CREATE TABLE IF NOT EXISTS obs.outbox_event (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid REFERENCES obs.tenant(id),
  project_id      uuid REFERENCES obs.project(id),
  env_id          uuid REFERENCES obs.environment(id),

  aggregate_type  varchar(64)  NOT NULL,     -- 如 INCIDENT
  aggregate_id    varchar(128) NOT NULL,     -- incident.id 或 incident_no
  event_type      varchar(128) NOT NULL,     -- INCIDENT_ACKED 等
  dedup_key       varchar(255) NOT NULL,     -- 幂等键

  payload         jsonb NOT NULL,
  headers         jsonb NOT NULL DEFAULT '{}'::jsonb,

  status          varchar(16) NOT NULL DEFAULT 'NEW'
                  CHECK (status IN ('NEW','PROCESSING','SENT','FAILED','DEAD')),
  retry_count     int NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  max_retry       int NOT NULL DEFAULT 16 CHECK (max_retry > 0),
  next_retry_at   timestamptz NOT NULL DEFAULT now(),
  published_at    timestamptz,
  last_error      text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (dedup_key)
);

CREATE INDEX IF NOT EXISTS idx_outbox_status_retry
  ON obs.outbox_event(status, next_retry_at, created_at);

CREATE INDEX IF NOT EXISTS idx_outbox_aggregate
  ON obs.outbox_event(aggregate_type, aggregate_id, created_at DESC);

-- 入箱函数（幂等）
CREATE OR REPLACE FUNCTION obs.outbox_enqueue(
  p_tenant_id uuid,
  p_project_id uuid,
  p_env_id uuid,
  p_aggregate_type varchar,
  p_aggregate_id varchar,
  p_event_type varchar,
  p_dedup_key varchar,
  p_payload jsonb,
  p_headers jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO obs.outbox_event(
    tenant_id, project_id, env_id,
    aggregate_type, aggregate_id, event_type, dedup_key,
    payload, headers
  )
  VALUES (
    p_tenant_id, p_project_id, p_env_id,
    p_aggregate_type, p_aggregate_id, p_event_type, p_dedup_key,
    p_payload, COALESCE(p_headers, '{}'::jsonb)
  )
  ON CONFLICT (dedup_key) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM obs.outbox_event WHERE dedup_key = p_dedup_key;
  END IF;

  RETURN v_id;
END;
$$;

-- 拉取待发送批次（供 dispatcher 使用）
CREATE OR REPLACE FUNCTION obs.outbox_claim_batch(p_limit int DEFAULT 100)
RETURNS SETOF obs.outbox_event
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH cte AS (
    SELECT id
    FROM obs.outbox_event
    WHERE status IN ('NEW','FAILED')
      AND next_retry_at <= now()
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  UPDATE obs.outbox_event o
  SET status = 'PROCESSING',
      updated_at = now()
  FROM cte
  WHERE o.id = cte.id
  RETURNING o.*;
END;
$$;

CREATE OR REPLACE FUNCTION obs.outbox_mark_sent(p_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE obs.outbox_event
  SET status='SENT',
      published_at=now(),
      last_error=NULL,
      updated_at=now()
  WHERE id = p_id;
$$;

CREATE OR REPLACE FUNCTION obs.outbox_mark_failed(p_id uuid, p_error text)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE obs.outbox_event
  SET retry_count = retry_count + 1,
      status = CASE WHEN retry_count + 1 >= max_retry THEN 'DEAD' ELSE 'FAILED' END,
      next_retry_at = now() + make_interval(secs => LEAST(3600, (5 * power(2, LEAST(retry_count, 10)))::int)),
      last_error = left(coalesce(p_error, 'unknown error'), 2000),
      updated_at = now()
  WHERE id = p_id;
$$;
```

---

## 6) 业务事务写法示例（建议你服务端照这个模式）

```sql
BEGIN;

UPDATE obs.incident
SET status = 'ACKED'
WHERE id = :incident_id;

INSERT INTO obs.incident_timeline(
  incident_id, event_type, event_time, actor_type, actor_id, detail
) VALUES (
  :incident_id, 'INCIDENT_ACKED', now(), 'USER', :user_id, jsonb_build_object('comment', :comment)
);

SELECT obs.outbox_enqueue(
  :tenant_id, :project_id, :env_id,
  'INCIDENT', :incident_id::text, 'INCIDENT_ACKED',
  concat('incident:', :incident_id::text, ':acked'),
  jsonb_build_object('incident_id', :incident_id, 'acked_by', :user_id, 'acked_at', now()),
  '{}'::jsonb
);

COMMIT;
```

---

如果你点头，我下一条直接给你：
1) **Flyway 回滚/前向兼容规范模板**（团队可直接执行），
2) **incident SLA 自动计算触发器**（自动写 `incident_response_sla` 的 MTTA/MTTR）。