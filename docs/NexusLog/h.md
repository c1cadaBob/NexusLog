非常好，这一步很关键：**把“重试+死信+可观测”真正落地到单文件 Worker**。
下面是你要的可直接替换版本：`src/worker-parquet.ts`（已集成）

- `next_retry_at` 领取逻辑
- `retryOrDeadLetter`（调用 `obs.requeue_or_dead_letter_audit_export_job`）
- `/live` `/ready` `/metrics`
- Prometheus 指标（吞吐、失败、时长、行数、inflight、队列状态）

> 先确保你已经执行了前面给的 `V11` SQL。

---

```ts
import { Pool } from "pg";
import QueryStream from "pg-query-stream";
import * as parquet from "parquetjs-lite";
import { createReadStream, promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import http from "http";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import {
  Registry,
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
} from "prom-client";

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

const HEALTH_PORT = Number(process.env.HEALTH_PORT || 8080);
const LOOP_STALE_MS = Number(process.env.LOOP_STALE_MS || 30000);
const JOB_STUCK_SEC = Number(process.env.JOB_STUCK_SEC || 3600);
const QUEUE_GAUGE_REFRESH_MS = Number(process.env.QUEUE_GAUGE_REFRESH_MS || 15000);

if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString: DATABASE_URL, max: 10 });
const s3 = new S3Client({ region: AWS_REGION });

/* =========================
   Runtime state
========================= */
let shuttingDown = false;
let lastLoopAt = Date.now();
let lastSuccessAt: number | null = null;
let lastError: string | null = null;
let inFlight: { jobId: string; startedAt: number } | null = null;

/* =========================
   Prometheus
========================= */
const register = new Registry();
collectDefaultMetrics({ register });

const jobsCompletedTotal = new Counter({
  name: "audit_export_jobs_completed_total",
  help: "Total completed export jobs",
  registers: [register],
});

const jobsFailedTotal = new Counter({
  name: "audit_export_jobs_failed_total",
  help: "Total failed export jobs (final=false means requeued, final=true means dead-lettered)",
  labelNames: ["final"] as const,
  registers: [register],
});

const rowsExportedTotal = new Counter({
  name: "audit_export_rows_exported_total",
  help: "Total exported rows",
  registers: [register],
});

const jobDurationSeconds = new Histogram({
  name: "audit_export_job_duration_seconds",
  help: "Job duration in seconds",
  buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1800],
  registers: [register],
});

const inflightJobsGauge = new Gauge({
  name: "audit_export_inflight_jobs",
  help: "Current in-flight jobs in this worker process",
  registers: [register],
});

const queueJobsGauge = new Gauge({
  name: "audit_export_queue_jobs",
  help: "Queue jobs by status (queried from DB)",
  labelNames: ["status"] as const,
  registers: [register],
});

const KNOWN_STATUSES = ["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"] as const;

/* =========================
   Utils
========================= */
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

async function dbReady() {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

async function refreshQueueGauges() {
  try {
    for (const s of KNOWN_STATUSES) queueJobsGauge.labels(s).set(0);

    const rs = await pool.query<{ status: string; count: string }>(`
      SELECT status, count(*)::text
      FROM obs.audit_export_job
      GROUP BY status
    `);

    for (const r of rs.rows) {
      queueJobsGauge.labels(r.status).set(Number(r.count));
    }
  } catch (e) {
    // 不抛出，避免影响主流程
    console.error("[METRICS_QUEUE_REFRESH_ERR]", e);
  }
}

/* =========================
   DB job lifecycle
========================= */
async function claimJob(): Promise<Job | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const rs = await client.query<Job>(`
      SELECT id, tenant_id, from_ts, to_ts, format, destination_uri, worm_retention_until
      FROM obs.audit_export_job
      WHERE status = 'PENDING'
        AND format = 'PARQUET'
        AND next_retry_at <= now()
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

async function completeJob(jobId: string, objectUri: string, etag?: string) {
  await pool.query(
    `SELECT obs.complete_audit_export_job($1::uuid, $2::text, $3::text, $4::varchar)`,
    [jobId, objectUri, etag ?? null, "COMPLIANCE"]
  );
}

async function retryOrDeadLetter(jobId: string, err: unknown) {
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);

  const rs = await pool.query<{
    final_failed: boolean;
    attempts: number;
    retry_at: string | null;
  }>(
    `SELECT * FROM obs.requeue_or_dead_letter_audit_export_job($1::uuid, $2::text, $3::text)`,
    [jobId, msg.slice(0, 4000), "EXPORT_ERROR"]
  );

  const row = rs.rows[0];
  const finalFailed = Boolean(row?.final_failed);

  jobsFailedTotal.labels(finalFailed ? "true" : "false").inc();

  if (finalFailed) {
    console.error(`[DLQ] job=${jobId} attempts=${row?.attempts} error=${msg}`);
  } else {
    console.warn(`[RETRY] job=${jobId} attempts=${row?.attempts} next=${row?.retry_at}`);
  }
}

/* =========================
   Export parquet
========================= */
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
    if (writer) await writer.close().catch(() => {});
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

async function handleJob(job: Job) {
  const timerEnd = jobDurationSeconds.startTimer();

  const { filePath, rowCount } = await exportJobToParquet(job);
  try {
    const { objectUri, etag } = await uploadParquet(job, filePath);
    await completeJob(job.id, objectUri, etag);

    jobsCompletedTotal.inc();
    rowsExportedTotal.inc(rowCount);

    console.log(`[OK] job=${job.id} rows=${rowCount} uri=${objectUri}`);
  } finally {
    timerEnd();
    await fs.unlink(filePath).catch(() => {});
  }
}

/* =========================
   Health/metrics server
========================= */
const healthServer = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end();
    return;
  }

  if (req.url === "/live") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, shuttingDown }));
    return;
  }

  if (req.url === "/ready") {
    const dbOk = await dbReady();
    const loopFresh = Date.now() - lastLoopAt < LOOP_STALE_MS;
    const jobNotStuck = !inFlight || (Date.now() - inFlight.startedAt) / 1000 < JOB_STUCK_SEC;
    const ok = dbOk && loopFresh && jobNotStuck && !shuttingDown;

    res.writeHead(ok ? 200 : 503, { "content-type": "application/json" });
    res.end(
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
    return;
  }

  if (req.url === "/metrics") {
    res.writeHead(200, { "content-type": register.contentType });
    res.end(await register.metrics());
    return;
  }

  res.writeHead(404).end();
});

/* =========================
   Main loop
========================= */
async function main() {
  await refreshQueueGauges();

  const interval = setInterval(() => {
    void refreshQueueGauges();
  }, QUEUE_GAUGE_REFRESH_MS);
  interval.unref();

  healthServer.listen(HEALTH_PORT, () => {
    console.log(`health server listening on :${HEALTH_PORT}`);
  });

  console.log("PARQUET export worker started");

  while (!shuttingDown) {
    lastLoopAt = Date.now();
    let job: Job | null = null;
    let markedInFlight = false;

    try {
      job = await claimJob();
      if (!job) {
        await sleep(POLL_MS);
        continue;
      }

      inFlight = { jobId: job.id, startedAt: Date.now() };
      inflightJobsGauge.inc();
      markedInFlight = true;

      await handleJob(job);
      lastSuccessAt = Date.now();
      lastError = null;
    } catch (e) {
      lastError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      console.error("[ERR]", e);

      if (job) {
        await retryOrDeadLetter(job.id, e).catch((ee) =>
          console.error("[RETRY_OR_DLQ_ERR]", ee)
        );
      }

      await sleep(1000);
    } finally {
      inFlight = null;
      if (markedInFlight) inflightJobsGauge.dec();
    }
  }
}

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`received ${signal}, shutting down...`);
  healthServer.close();

  await pool.end();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
```

---

### 还需要补一个依赖
```bash
npm i prom-client
```

### 快速自检
```bash
curl -s http://127.0.0.1:8080/live
curl -s http://127.0.0.1:8080/ready | jq
curl -s http://127.0.0.1:8080/metrics | head
```

---

如果你点头，我下一条直接给你：**Prometheus 告警规则 YAML + Grafana Dashboard JSON（精简版）**。