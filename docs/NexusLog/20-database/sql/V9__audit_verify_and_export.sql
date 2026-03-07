-- V9__audit_verify_and_export.sql
SET lock_timeout = '3s';
SET statement_timeout = '10min';

-- digest() 来自 pgcrypto；如果没有会给出明确报错
DO $$
BEGIN
  IF to_regprocedure('digest(text,text)') IS NULL
     AND to_regprocedure('digest(bytea,text)') IS NULL THEN
    RAISE EXCEPTION 'digest() not found. Please install pgcrypto extension first.';
  END IF;
END $$;

-- =========================================================
-- 1) Trace 还原：按 trace_id 复原完整变更链
-- =========================================================
CREATE OR REPLACE VIEW obs.v_audit_trace_chain AS
SELECT
  a.trace_id,
  row_number() OVER (PARTITION BY a.trace_id ORDER BY a.changed_at, a.id) AS step_no,
  a.changed_at,
  a.source_txid,
  a.tenant_id,
  a.project_id,
  a.env_id,
  a.table_schema,
  a.table_name,
  a.operation,
  a.row_pk,
  a.before_data,
  a.after_data,
  a.actor_type,
  a.actor_id,
  a.app_name,
  a.client_addr
FROM obs.data_change_audit a
WHERE a.trace_id IS NOT NULL;

CREATE OR REPLACE FUNCTION obs.get_audit_trace_chain(p_trace_id text)
RETURNS TABLE (
  trace_id text,
  step_no bigint,
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
  actor_type varchar(32),
  actor_id varchar(128),
  app_name text,
  client_addr inet
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    t.trace_id,
    t.step_no,
    t.changed_at,
    t.source_txid,
    t.tenant_id,
    t.project_id,
    t.env_id,
    t.table_schema,
    t.table_name,
    t.operation,
    t.row_pk,
    t.before_data,
    t.after_data,
    t.actor_type,
    t.actor_id,
    t.app_name,
    t.client_addr
  FROM obs.v_audit_trace_chain t
  WHERE t.trace_id = p_trace_id
  ORDER BY t.step_no;
$$;

-- =========================================================
-- 2) 导出任务 + WORM 清单（manifest）
-- =========================================================
CREATE TABLE IF NOT EXISTS obs.audit_export_job (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid,
  from_ts             timestamptz NOT NULL,
  to_ts               timestamptz NOT NULL,
  format              varchar(16) NOT NULL DEFAULT 'PARQUET'
                      CHECK (format IN ('JSONL', 'PARQUET', 'CSV')),
  destination_uri     text NOT NULL,  -- 例如 s3://bucket/audit/dt=2026-02-19/
  status              varchar(16) NOT NULL DEFAULT 'PENDING'
                      CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED')),
  requested_by        text,
  requested_at        timestamptz NOT NULL DEFAULT now(),
  started_at          timestamptz,
  finished_at         timestamptz,
  error_message       text,
  result_row_count    bigint,
  result_digest_sha256 char(64),
  worm_retention_until timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (from_ts < to_ts)
);

CREATE INDEX IF NOT EXISTS idx_aej_status_reqtime
  ON obs.audit_export_job (status, requested_at);

CREATE INDEX IF NOT EXISTS idx_aej_tenant_timerange
  ON obs.audit_export_job (tenant_id, from_ts, to_ts);

CREATE TABLE IF NOT EXISTS obs.audit_export_manifest (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              uuid NOT NULL UNIQUE REFERENCES obs.audit_export_job(id) ON DELETE RESTRICT,
  tenant_id           uuid,
  from_ts             timestamptz NOT NULL,
  to_ts               timestamptz NOT NULL,
  object_uri          text NOT NULL,
  row_count           bigint NOT NULL,
  digest_sha256       char(64) NOT NULL,
  storage_etag        text,
  worm_mode           varchar(16) NOT NULL DEFAULT 'COMPLIANCE'
                      CHECK (worm_mode IN ('COMPLIANCE', 'GOVERNANCE')),
  retention_until     timestamptz,
  exported_at         timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aem_tenant_time
  ON obs.audit_export_manifest (tenant_id, exported_at DESC);

CREATE INDEX IF NOT EXISTS idx_aem_digest
  ON obs.audit_export_manifest (digest_sha256);

-- manifest append-only（禁止 UPDATE/DELETE）
CREATE OR REPLACE FUNCTION obs.fn_guard_append_only_any()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % not allowed', TG_TABLE_NAME, TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_aem_append_only ON obs.audit_export_manifest;
CREATE TRIGGER trg_aem_append_only
BEFORE UPDATE OR DELETE ON obs.audit_export_manifest
FOR EACH ROW
EXECUTE FUNCTION obs.fn_guard_append_only_any();

CREATE OR REPLACE VIEW obs.v_audit_export_job_pending AS
SELECT *
FROM obs.audit_export_job
WHERE status = 'PENDING'
ORDER BY requested_at, id;

-- =========================================================
-- 3) 完整性校验：日级 checksum checkpoint
-- =========================================================
CREATE TABLE IF NOT EXISTS obs.audit_integrity_checkpoint (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_date         date NOT NULL,
  tenant_id           uuid,
  row_count           bigint NOT NULL,
  digest_sha256       char(64) NOT NULL,
  first_changed_at    timestamptz,
  last_changed_at     timestamptz,
  run_count           int NOT NULL DEFAULT 1,
  status              varchar(16) NOT NULL
                      CHECK (status IN ('BASELINED', 'VERIFIED', 'MISMATCH')),
  note                text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- tenant_id 可空：用双唯一索引保证“每天每租户唯一、全局(null)每天唯一”
CREATE UNIQUE INDEX IF NOT EXISTS uq_aic_day_tenant_notnull
  ON obs.audit_integrity_checkpoint(bucket_date, tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_aic_day_tenant_null
  ON obs.audit_integrity_checkpoint(bucket_date)
  WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_aic_status_day
  ON obs.audit_integrity_checkpoint(status, bucket_date DESC);

-- 计算某时间窗 digest（可按 tenant 过滤）
CREATE OR REPLACE FUNCTION obs.compute_audit_digest(
  p_from_ts timestamptz,
  p_to_ts timestamptz,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS TABLE (
  row_count bigint,
  digest_sha256 text,
  first_changed_at timestamptz,
  last_changed_at timestamptz
)
LANGUAGE sql
AS $$
WITH base AS (
  SELECT
    a.id,
    a.changed_at,
    encode(
      digest(
        concat_ws('|',
          a.id::text,
          a.changed_at::text,
          a.source_txid::text,
          coalesce(a.tenant_id::text, ''),
          coalesce(a.project_id::text, ''),
          coalesce(a.env_id::text, ''),
          a.table_schema,
          a.table_name,
          a.operation,
          coalesce(a.row_pk::text, '{}'),
          coalesce(a.before_data::text, ''),
          coalesce(a.after_data::text, ''),
          coalesce(a.trace_id, ''),
          coalesce(a.actor_type, ''),
          coalesce(a.actor_id, ''),
          coalesce(a.app_name, ''),
          coalesce(a.client_addr::text, '')
        ),
        'sha256'
      ),
      'hex'
    ) AS row_fp
  FROM obs.data_change_audit a
  WHERE a.changed_at >= p_from_ts
    AND a.changed_at < p_to_ts
    AND (p_tenant_id IS NULL OR a.tenant_id = p_tenant_id)
),
agg AS (
  SELECT
    count(*)::bigint AS row_count,
    encode(
      digest(
        coalesce(string_agg(row_fp, '' ORDER BY changed_at, id::text), ''),
        'sha256'
      ),
      'hex'
    ) AS digest_sha256,
    min(changed_at) AS first_changed_at,
    max(changed_at) AS last_changed_at
  FROM base
)
SELECT row_count, digest_sha256, first_changed_at, last_changed_at
FROM agg;
$$;

-- 每日校验（重复跑会比对历史 checkpoint）
CREATE OR REPLACE FUNCTION obs.run_daily_audit_integrity_check(
  p_day date DEFAULT (current_date - 1),
  p_tenant_id uuid DEFAULT NULL,
  p_raise_on_mismatch boolean DEFAULT true
)
RETURNS TABLE (
  bucket_date date,
  tenant_id uuid,
  row_count bigint,
  digest_sha256 text,
  status text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_from_ts timestamptz;
  v_to_ts timestamptz;
  v_row_count bigint;
  v_digest text;
  v_first timestamptz;
  v_last timestamptz;
  v_old obs.audit_integrity_checkpoint%ROWTYPE;
  v_status text;
BEGIN
  -- 固定按 UTC 日窗口
  v_from_ts := (p_day::text || ' 00:00:00+00')::timestamptz;
  v_to_ts   := v_from_ts + interval '1 day';

  SELECT c.row_count, c.digest_sha256, c.first_changed_at, c.last_changed_at
    INTO v_row_count, v_digest, v_first, v_last
  FROM obs.compute_audit_digest(v_from_ts, v_to_ts, p_tenant_id) c;

  SELECT *
    INTO v_old
  FROM obs.audit_integrity_checkpoint
  WHERE bucket_date = p_day
    AND tenant_id IS NOT DISTINCT FROM p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_status := 'BASELINED';
    INSERT INTO obs.audit_integrity_checkpoint(
      bucket_date, tenant_id, row_count, digest_sha256,
      first_changed_at, last_changed_at, status, note, created_at, updated_at
    )
    VALUES (
      p_day, p_tenant_id, v_row_count, v_digest::char(64),
      v_first, v_last, v_status, 'first baseline', now(), now()
    );
  ELSE
    IF v_old.row_count = v_row_count AND v_old.digest_sha256::text = v_digest THEN
      v_status := 'VERIFIED';
      UPDATE obs.audit_integrity_checkpoint
      SET run_count = run_count + 1,
          status = v_status,
          note = 'verified',
          first_changed_at = v_first,
          last_changed_at = v_last,
          updated_at = now()
      WHERE id = v_old.id;
    ELSE
      v_status := 'MISMATCH';
      UPDATE obs.audit_integrity_checkpoint
      SET run_count = run_count + 1,
          status = v_status,
          note = format(
            'mismatch: old(count=%s,digest=%s), new(count=%s,digest=%s)',
            v_old.row_count, v_old.digest_sha256, v_row_count, v_digest
          ),
          row_count = v_row_count,
          digest_sha256 = v_digest::char(64),
          first_changed_at = v_first,
          last_changed_at = v_last,
          updated_at = now()
      WHERE id = v_old.id;

      IF p_raise_on_mismatch THEN
        RAISE EXCEPTION 'Audit integrity mismatch on %, tenant=%', p_day, p_tenant_id;
      END IF;
    END IF;
  END IF;

  RETURN QUERY
  SELECT p_day, p_tenant_id, v_row_count, v_digest, v_status;
END;
$$;

-- =========================================================
-- 4) 导出任务函数（队列式）
-- =========================================================
CREATE OR REPLACE FUNCTION obs.enqueue_audit_export_job(
  p_from_ts timestamptz,
  p_to_ts timestamptz,
  p_destination_uri text,
  p_tenant_id uuid DEFAULT NULL,
  p_format varchar DEFAULT 'PARQUET',
  p_requested_by text DEFAULT 'system',
  p_worm_retention_until timestamptz DEFAULT (now() + interval '3650 days')
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  INSERT INTO obs.audit_export_job(
    tenant_id, from_ts, to_ts, format, destination_uri,
    status, requested_by, worm_retention_until, created_at, updated_at
  )
  VALUES (
    p_tenant_id, p_from_ts, p_to_ts, p_format, p_destination_uri,
    'PENDING', p_requested_by, p_worm_retention_until, now(), now()
  )
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION obs.start_audit_export_job(
  p_job_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE obs.audit_export_job
  SET status = 'RUNNING',
      started_at = now(),
      updated_at = now()
  WHERE id = p_job_id
    AND status = 'PENDING';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job % not in PENDING state', p_job_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION obs.complete_audit_export_job(
  p_job_id uuid,
  p_object_uri text,
  p_storage_etag text DEFAULT NULL,
  p_worm_mode varchar DEFAULT 'COMPLIANCE'
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_job obs.audit_export_job%ROWTYPE;
  v_row_count bigint;
  v_digest text;
  v_first timestamptz;
  v_last timestamptz;
BEGIN
  SELECT * INTO v_job
  FROM obs.audit_export_job
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job not found: %', p_job_id;
  END IF;

  IF v_job.status <> 'RUNNING' THEN
    RAISE EXCEPTION 'job % must be RUNNING, current=%', p_job_id, v_job.status;
  END IF;

  SELECT c.row_count, c.digest_sha256, c.first_changed_at, c.last_changed_at
    INTO v_row_count, v_digest, v_first, v_last
  FROM obs.compute_audit_digest(v_job.from_ts, v_job.to_ts, v_job.tenant_id) c;

  UPDATE obs.audit_export_job
  SET status = 'SUCCEEDED',
      finished_at = now(),
      result_row_count = v_row_count,
      result_digest_sha256 = v_digest::char(64),
      updated_at = now()
  WHERE id = p_job_id;

  INSERT INTO obs.audit_export_manifest(
    job_id, tenant_id, from_ts, to_ts, object_uri,
    row_count, digest_sha256, storage_etag, worm_mode, retention_until, exported_at, created_at
  )
  VALUES (
    v_job.id, v_job.tenant_id, v_job.from_ts, v_job.to_ts, p_object_uri,
    v_row_count, v_digest::char(64), p_storage_etag, p_worm_mode, v_job.worm_retention_until, now(), now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION obs.fail_audit_export_job(
  p_job_id uuid,
  p_error_message text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE obs.audit_export_job
  SET status = 'FAILED',
      finished_at = now(),
      error_message = left(p_error_message, 4000),
      updated_at = now()
  WHERE id = p_job_id
    AND status IN ('PENDING', 'RUNNING');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job % not in PENDING/RUNNING state', p_job_id;
  END IF;
END;
$$;

-- =========================================================
-- 5) 权限 + RLS 挂载（若 V7 存在则自动应用）
-- =========================================================
REVOKE ALL ON TABLE obs.audit_export_job, obs.audit_export_manifest, obs.audit_integrity_checkpoint FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='obs_app_rw') THEN
    EXECUTE 'GRANT SELECT, INSERT ON obs.audit_export_job TO obs_app_rw';
    EXECUTE 'GRANT EXECUTE ON FUNCTION obs.enqueue_audit_export_job(timestamptz,timestamptz,text,uuid,varchar,text,timestamptz) TO obs_app_rw';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='obs_audit_ro') THEN
    EXECUTE 'GRANT SELECT ON obs.audit_export_job, obs.audit_export_manifest, obs.audit_integrity_checkpoint TO obs_audit_ro';
    EXECUTE 'GRANT SELECT ON obs.v_audit_trace_chain TO obs_audit_ro';
    EXECUTE 'GRANT EXECUTE ON FUNCTION obs.get_audit_trace_chain(text) TO obs_audit_ro';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='obs_ops_admin') THEN
    EXECUTE 'GRANT ALL ON obs.audit_export_job, obs.audit_export_manifest, obs.audit_integrity_checkpoint TO obs_ops_admin';
    EXECUTE 'GRANT EXECUTE ON FUNCTION obs.run_daily_audit_integrity_check(date,uuid,boolean) TO obs_ops_admin';
    EXECUTE 'GRANT EXECUTE ON FUNCTION obs.start_audit_export_job(uuid) TO obs_ops_admin';
    EXECUTE 'GRANT EXECUTE ON FUNCTION obs.complete_audit_export_job(uuid,text,text,varchar) TO obs_ops_admin';
    EXECUTE 'GRANT EXECUTE ON FUNCTION obs.fail_audit_export_job(uuid,text) TO obs_ops_admin';
  END IF;
END $$;

-- 若 V7 的自动 RLS 函数存在，则把新表纳入 RLS
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

-- 可选：pg_cron（示例）
-- SELECT cron.schedule(
--   'audit-integrity-daily',
--   '15 1 * * *',
--   $$SELECT obs.run_daily_audit_integrity_check(current_date - 1, NULL, true);$$
-- );