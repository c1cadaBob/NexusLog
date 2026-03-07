很好，这一步就是把系统从“能跑”升级到“可运营”。
下面给你一套 **重试 + 死信 + Prometheus/Grafana** 的最小生产闭环。

---

## 1) 数据库：重试与死信（建议新迁移 `V11`）

```sql
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
```

---

## 2) Worker 改造（关键两处）

### A. claim 条件加 `next_retry_at`

```sql
WHERE status = 'PENDING'
  AND format = 'PARQUET'
  AND next_retry_at <= now()
```

### B. 失败时不直接 `failJob`，改为“重试或死信”

```ts
async function retryOrDeadLetter(jobId: string, err: unknown) {
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  await pool.query(
    `SELECT * FROM obs.requeue_or_dead_letter_audit_export_job($1::uuid, $2::text, $3::text)`,
    [jobId, msg.slice(0, 4000), "EXPORT_ERROR"]
  );
}
```

在 `catch` 里调用 `retryOrDeadLetter(job.id, e)`。

---

## 3) Watchdog（处理 RUNNING 僵尸任务）

每 5 分钟执行一次（可用 `pg_cron`）：

```sql
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id
    FROM obs.audit_export_job
    WHERE status = 'RUNNING'
      AND started_at < now() - interval '30 minutes'
  LOOP
    PERFORM obs.requeue_or_dead_letter_audit_export_job(
      r.id,
      'timeout: RUNNING > 30 minutes',
      'TIMEOUT'
    );
  END LOOP;
END $$;
```

---

## 4) Prometheus 指标（Worker 内加 `/metrics`）

安装：

```bash
npm i prom-client
```

核心指标建议：

- `audit_export_jobs_completed_total`
- `audit_export_jobs_failed_total{final="true|false"}`
- `audit_export_rows_exported_total`
- `audit_export_job_duration_seconds`（Histogram）
- `audit_export_inflight_jobs`
- `audit_export_queue_jobs{status="PENDING|RUNNING|FAILED|SUCCEEDED"}`（定时查 DB 更新）

Prometheus 抓取配置：

```yaml
scrape_configs:
  - job_name: audit-export-worker
    static_configs:
      - targets: ["worker-host:8080"]
```

---

## 5) Grafana 面板（最实用 4 个）

1. **吞吐量**
   `sum(rate(audit_export_jobs_completed_total[5m]))`

2. **失败率**
   `sum(rate(audit_export_jobs_failed_total[5m])) / (sum(rate(audit_export_jobs_completed_total[5m])) + sum(rate(audit_export_jobs_failed_total[5m])))`

3. **P95 作业时长**
   `histogram_quantile(0.95, sum(rate(audit_export_job_duration_seconds_bucket[5m])) by (le))`

4. **队列积压**
   `sum(audit_export_queue_jobs{status="PENDING"})`

---

## 6) 告警规则（建议先上这三条）

- 失败率 > 20% 持续 15m
- `PENDING` 积压持续上升 30m
- 死信新增（`increase(audit_export_jobs_failed_total{final="true"}[15m]) > 0`）

---

如果你愿意，我下一步直接给你一份 **完整可粘贴的 `worker-parquet.ts`（已集成 prom-client + queue gauges + retryOrDeadLetter）**，你可以直接替换上线。