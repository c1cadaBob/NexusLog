-- V11__audit_export_retry_dead_letter.sql
BEGIN;

-- 1) 作业表增加重试字段
ALTER TABLE obs.audit_export_job
  ADD COLUMN IF NOT EXISTS attempt_count      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts       integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS next_retry_at      timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS first_failed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS last_failed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS dead_lettered_at   timestamptz,
  ADD COLUMN IF NOT EXISTS error_code         text;

CREATE INDEX IF NOT EXISTS idx_audit_export_job_claim
  ON obs.audit_export_job(status, next_retry_at, requested_at);

CREATE INDEX IF NOT EXISTS idx_audit_export_job_running
  ON obs.audit_export_job(status, started_at)
  WHERE status = 'RUNNING';

-- 2) 死信表
CREATE TABLE IF NOT EXISTS obs.audit_export_dead_letter (
  id            bigserial PRIMARY KEY,
  job_id         uuid NOT NULL,
  failed_at      timestamptz NOT NULL DEFAULT now(),
  error_code     text,
  error_message  text,
  attempts       integer NOT NULL,
  payload        jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_export_dead_letter_job_id
  ON obs.audit_export_dead_letter(job_id);

-- 3) 失败后：重试或进死信
CREATE OR REPLACE FUNCTION obs.requeue_or_dead_letter_audit_export_job(
  p_job_id uuid,
  p_error_message text,
  p_error_code text DEFAULT NULL
)
RETURNS TABLE(final_failed boolean, attempts integer, retry_at timestamptz)
LANGUAGE plpgsql
AS $$
DECLARE
  j obs.audit_export_job%ROWTYPE;
  v_attempts integer;
  v_backoff_sec integer;
  v_retry_at timestamptz;
BEGIN
  SELECT * INTO j
  FROM obs.audit_export_job
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'job % not found', p_job_id;
  END IF;

  v_attempts := j.attempt_count + 1;

  IF v_attempts < j.max_attempts THEN
    -- 指数退避: 30s,60s,120s... capped 1h + 抖动
    v_backoff_sec := LEAST(3600, (2 ^ GREATEST(v_attempts - 1, 0)) * 30) + (random() * 10)::int;
    v_retry_at := now() + make_interval(secs => v_backoff_sec);

    UPDATE obs.audit_export_job
    SET status         = 'PENDING',
        attempt_count  = v_attempts,
        next_retry_at  = v_retry_at,
        error_message  = left(p_error_message, 4000),
        error_code     = p_error_code,
        first_failed_at= COALESCE(first_failed_at, now()),
        last_failed_at = now(),
        updated_at     = now()
    WHERE id = p_job_id;

    RETURN QUERY SELECT false, v_attempts, v_retry_at;
  ELSE
    UPDATE obs.audit_export_job
    SET status          = 'FAILED',
        attempt_count   = v_attempts,
        error_message   = left(p_error_message, 4000),
        error_code      = p_error_code,
        first_failed_at = COALESCE(first_failed_at, now()),
        last_failed_at  = now(),
        dead_lettered_at= now(),
        updated_at      = now()
    WHERE id = p_job_id;

    INSERT INTO obs.audit_export_dead_letter(job_id, error_code, error_message, attempts, payload)
    VALUES (
      p_job_id,
      p_error_code,
      left(p_error_message, 4000),
      v_attempts,
      to_jsonb(j)
    );

    RETURN QUERY SELECT true, v_attempts, NULL::timestamptz;
  END IF;
END;
$$;

COMMIT;