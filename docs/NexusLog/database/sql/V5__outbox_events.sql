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