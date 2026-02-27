太好了，这一步会明显降低“夜间值班焦虑”。
下面直接给你可落地的两份文件。

---

## 1) Prometheus 告警规则（YAML）

> 保存为：`/etc/prometheus/rules/audit-export-alerts.yml`

```yaml
groups:
  - name: audit-export-worker-alerts
    rules:
      - alert: AuditExportWorkerDown
        expr: up{job="audit-export-worker"} == 0
        for: 2m
        labels:
          severity: critical
          service: audit-export
        annotations:
          summary: "Audit Export Worker 不可达"
          description: "Prometheus 连续 2 分钟无法抓取 audit-export-worker 指标。"

      - alert: AuditExportHighFailureRate
        expr: |
          (
            sum(rate(audit_export_jobs_failed_total[15m]))
            /
            clamp_min(
              sum(rate(audit_export_jobs_completed_total[15m])) + sum(rate(audit_export_jobs_failed_total[15m])),
              0.001
            )
          ) > 0.20
        for: 15m
        labels:
          severity: warning
          service: audit-export
        annotations:
          summary: "Audit Export 失败率过高"
          description: "最近 15 分钟失败率持续 > 20%。请检查 S3/DB/网络和数据量峰值。"

      - alert: AuditExportDeadLetterOccurred
        expr: increase(audit_export_jobs_failed_total{final="true"}[15m]) > 0
        for: 1m
        labels:
          severity: critical
          service: audit-export
        annotations:
          summary: "出现死信作业（DLQ）"
          description: "最近 15 分钟产生了 dead-letter，说明重试已耗尽。"

      - alert: AuditExportQueueBacklogGrowing
        expr: |
          sum(audit_export_queue_jobs{status="PENDING"}) > 100
          and
          deriv(sum(audit_export_queue_jobs{status="PENDING"})[30m]) > 0
        for: 30m
        labels:
          severity: warning
          service: audit-export
        annotations:
          summary: "队列积压持续上升"
          description: "PENDING > 100 且 30 分钟趋势仍在上升，处理能力可能不足。"

      - alert: AuditExportStalled
        expr: |
          sum(increase(audit_export_jobs_completed_total[20m])) == 0
          and
          sum(audit_export_queue_jobs{status="PENDING"}) > 0
        for: 20m
        labels:
          severity: critical
          service: audit-export
        annotations:
          summary: "导出流水停滞"
          description: "有待处理任务但 20 分钟内无成功完成，疑似 worker 卡死或下游异常。"
```

在 `prometheus.yml` 里确认：

```yaml
rule_files:
  - /etc/prometheus/rules/*.yml
```

校验并热加载：

```bash
promtool check rules /etc/prometheus/rules/audit-export-alerts.yml
curl -X POST http://127.0.0.1:9090/-/reload
```

---

## 2) Grafana Dashboard（JSON，精简版）

> 文件名建议：`audit-export-worker-lite.json`
> Grafana -> Dashboards -> Import -> 上传该 JSON

```json
{
  "__inputs": [
    {
      "name": "DS_PROMETHEUS",
      "label": "Prometheus",
      "type": "datasource",
      "pluginId": "prometheus",
      "pluginName": "Prometheus"
    }
  ],
  "__requires": [
    { "type": "grafana", "id": "grafana", "name": "Grafana", "version": "9.0.0" },
    { "type": "datasource", "id": "prometheus", "name": "Prometheus", "version": "1.0.0" },
    { "type": "panel", "id": "timeseries", "name": "Time series", "version": "" }
  ],
  "annotations": {
    "list": [
      {
        "builtIn": 1,
        "datasource": { "type": "grafana", "uid": "-- Grafana --" },
        "enable": true,
        "hide": true,
        "iconColor": "rgba(0, 211, 255, 1)",
        "name": "Annotations & Alerts",
        "type": "dashboard"
      }
    ]
  },
  "editable": true,
  "fiscalYearStartMonth": 0,
  "graphTooltip": 0,
  "id": null,
  "links": [],
  "panels": [
    {
      "id": 1,
      "type": "timeseries",
      "title": "Throughput (jobs/min)",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        {
          "refId": "A",
          "expr": "sum(rate(audit_export_jobs_completed_total[5m])) * 60",
          "legendFormat": "completed/min"
        }
      ],
      "fieldConfig": { "defaults": { "unit": "ops" }, "overrides": [] },
      "options": { "legend": { "displayMode": "list", "placement": "bottom" } },
      "gridPos": { "h": 8, "w": 8, "x": 0, "y": 0 }
    },
    {
      "id": 2,
      "type": "timeseries",
      "title": "Failure Rate",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        {
          "refId": "A",
          "expr": "sum(rate(audit_export_jobs_failed_total[5m])) / clamp_min(sum(rate(audit_export_jobs_completed_total[5m])) + sum(rate(audit_export_jobs_failed_total[5m])), 0.001)",
          "legendFormat": "fail rate"
        }
      ],
      "fieldConfig": { "defaults": { "unit": "percentunit" }, "overrides": [] },
      "options": { "legend": { "displayMode": "list", "placement": "bottom" } },
      "gridPos": { "h": 8, "w": 8, "x": 8, "y": 0 }
    },
    {
      "id": 3,
      "type": "timeseries",
      "title": "P95 Job Duration",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        {
          "refId": "A",
          "expr": "histogram_quantile(0.95, sum(rate(audit_export_job_duration_seconds_bucket[5m])) by (le))",
          "legendFormat": "p95"
        }
      ],
      "fieldConfig": { "defaults": { "unit": "s" }, "overrides": [] },
      "options": { "legend": { "displayMode": "list", "placement": "bottom" } },
      "gridPos": { "h": 8, "w": 8, "x": 16, "y": 0 }
    },
    {
      "id": 4,
      "type": "timeseries",
      "title": "Queue Pending",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        {
          "refId": "A",
          "expr": "sum(audit_export_queue_jobs{status=\"PENDING\"})",
          "legendFormat": "pending"
        }
      ],
      "fieldConfig": { "defaults": { "unit": "short" }, "overrides": [] },
      "options": { "legend": { "displayMode": "list", "placement": "bottom" } },
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 }
    },
    {
      "id": 5,
      "type": "timeseries",
      "title": "Dead-letter in 15m",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        {
          "refId": "A",
          "expr": "increase(audit_export_jobs_failed_total{final=\"true\"}[15m])",
          "legendFormat": "dlq/15m"
        }
      ],
      "fieldConfig": { "defaults": { "unit": "short" }, "overrides": [] },
      "options": { "legend": { "displayMode": "list", "placement": "bottom" } },
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 }
    },
    {
      "id": 6,
      "type": "timeseries",
      "title": "In-flight Jobs",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        {
          "refId": "A",
          "expr": "sum(audit_export_inflight_jobs)",
          "legendFormat": "inflight"
        }
      ],
      "fieldConfig": { "defaults": { "unit": "short" }, "overrides": [] },
      "options": { "legend": { "displayMode": "list", "placement": "bottom" } },
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 16 }
    },
    {
      "id": 7,
      "type": "timeseries",
      "title": "Rows Exported / sec",
      "datasource": { "type": "prometheus", "uid": "${DS_PROMETHEUS}" },
      "targets": [
        {
          "refId": "A",
          "expr": "sum(rate(audit_export_rows_exported_total[5m]))",
          "legendFormat": "rows/s"
        }
      ],
      "fieldConfig": { "defaults": { "unit": "ops" }, "overrides": [] },
      "options": { "legend": { "displayMode": "list", "placement": "bottom" } },
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 16 }
    }
  ],
  "refresh": "30s",
  "schemaVersion": 39,
  "style": "dark",
  "tags": ["audit", "export", "worker"],
  "templating": { "list": [] },
  "time": { "from": "now-6h", "to": "now" },
  "timepicker": {},
  "timezone": "",
  "title": "Audit Export Worker (Lite)",
  "uid": "audit-export-lite",
  "version": 1,
  "weekStart": ""
}
```

---

如果你愿意，我下一步给你一份 **Alertmanager 路由模板（按 severity 分流到企业微信/钉钉/Slack）**，直接把告警闭环打通。