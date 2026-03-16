# Runbook: 本地 `docker-compose` 验收 NexusLog M1 日志链路（Pull + Stream）

## 目的

用于在 **Docker daemon 可用** 后，按最短路径验证本地 M1 日志链路是否满足以下目标：

- 日志可采
- Pull 主链可写入 ES
- Stream 主链可写入 canary ES
- `event_id` 可在双路对比中重合
- Query API 可查询真实日志与统计结果

## 适用范围

- 仓库根目录：`/opt/projects/NexusLog`
- 验收环境：本地 `docker-compose.yml` + `docker-compose.override.yml`
- 当前覆盖范围：**采集 → 传输 → 存储 → 分析**
- 当前不覆盖范围：Alertmanager / Grafana / 前端浏览器结论本身

> 说明：当前仓库已实现 Pull/Stream 双轨本地自举，但本机会话截至 **2026-03-08** 仍无法连接 Docker daemon；本 runbook 用于 Docker 恢复后直接执行。

## 通过标准

满足以下条件即可判定本轮 E2E 通过：

1. `make dev-up` 与 `make dev-test-smoke` 均通过
2. `schema-registry` 已注册 `raw/parsed/alerts/metrics` subjects
3. 手工追加的一条测试日志能被 `control-plane` 拉取成功
4. 同一条测试日志能在 `nexuslog-logs-write-pull` 中查到
5. 同一条测试日志能在 `nexuslog-logs-write-stream` 中查到
6. `scripts/compare-pull-stream-by-event-id.sh` 输出 `shared_count > 0`
7. `POST /api/v1/query/logs` 能按关键字查到该日志
8. `GET /api/v1/query/stats/overview` 与 `POST /api/v1/query/stats/aggregate` 返回 `200`

## 前置条件

- Docker daemon 已启动，`docker ps` 可正常返回
- 当前主机可执行：`docker`、`curl`、`jq`、`make`
- 主机具备写入 `/var/log` 的权限；如无权限，请使用 `sudo`
- 已存在 `.env.mirrors`

## 步骤 0：进入仓库并加载镜像变量

```bash
cd /opt/projects/NexusLog
set -a
. ./.env.mirrors
set +a

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.override.yml"
```

## 步骤 1：确认 Docker daemon 可用

```bash
docker ps >/dev/null
```

预期：命令退出码为 `0`。

若失败并出现 `Cannot connect to the Docker daemon`，本次验收直接判定为阻塞。

## 步骤 2：启动本地链路并做基础冒烟

```bash
make dev-up
make dev-test-smoke
```

如需顺手补一轮前端入口与本地租户联动校验，可额外执行：

```bash
make e2e-list
make e2e-smoke
```

如需切到系统 Chrome 或无桌面环境，可使用：

```bash
make e2e-list-chrome
make e2e-smoke-chrome
make e2e-smoke-headed
make e2e-smoke-headed-chrome
```

说明：以上命令会先自动同步本地有效租户；若未显式传入 `E2E_TENANT_ID`，将复用本地 bootstrap 租户，并同步前端运行时配置。

预期至少包含：

- `http://localhost:18081/subjects` 可访问
- `http://localhost:8088/overview` 可访问
- `http://localhost:8080/healthz` 可访问
- `http://localhost:8082/healthz` 可访问
- `http://localhost:9091/healthz` 可访问

## 步骤 3：校验 Schema / Flink / ES 自举结果

### 3.1 Schema Registry subjects

```bash
curl -fsS http://localhost:18081/subjects | jq
```

预期至少包含：

- `nexuslog.logs.raw-value`
- `nexuslog.logs.parsed-value`
- `nexuslog.alerts.events-value`
- `nexuslog.metrics.aggregated-value`

### 3.2 Flink 概览

```bash
curl -fsS http://localhost:8088/overview | jq
curl -fsS http://localhost:8088/jobs/overview | jq
```

预期：`taskmanagers` 大于 `0`，且作业列表中可见日志解析 / 聚合作业。

### 3.3 ES 别名

```bash
curl -fsS http://localhost:9200/_alias/nexuslog-logs-read | jq 'keys'
curl -fsS http://localhost:9200/_alias/nexuslog-logs-write-pull | jq 'keys'
curl -fsS http://localhost:9200/_alias/nexuslog-logs-write-stream | jq 'keys'
```

预期：

- `nexuslog-logs-read` 指向 Pull 默认数据流
- `nexuslog-logs-write-pull` 与 `nexuslog-logs-write-stream` 指向不同 backing data stream

### 3.4 一次性初始化日志

```bash
$COMPOSE logs --tail=200 elasticsearch-init schema-registry-init flink-sql-init
```

预期：没有持续报错；`flink-sql-init` 能输出 SQL 提交成功日志。

## 步骤 4：创建一个用于本次验收的 Pull Source

> 从 `2026-03-14` 起，`control-plane` 的 `/api/v1/*` 与 `/api/v2/*` 接口要求同时携带 `Authorization: Bearer <access_token>` 与 `X-Tenant-ID: <tenant_id>`。`ACCESS_TOKEN` 可通过前端登录后的浏览器存储读取，或直接调用 `/api/v1/auth/login` 获取。

```bash
SOURCE_NAME="local-agent-e2e-$(date -u +%Y%m%d%H%M%S)"
: "${ACCESS_TOKEN:?set ACCESS_TOKEN before calling control-plane APIs}"
: "${TENANT_ID:?set TENANT_ID before calling control-plane APIs}"

SOURCE_ID="$({
  curl -fsS -X POST http://localhost:8080/api/v1/ingest/pull-sources \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "X-Tenant-ID: ${TENANT_ID}" \
    -H 'Content-Type: application/json' \
    -d '{
      "name": "'"$SOURCE_NAME"'",
      "host": "collector-agent",
      "port": 9091,
      "protocol": "http",
      "path": "/var/log/nexuslog-e2e.log",
      "auth": "agent_key",
      "agent_base_url": "http://collector-agent:9091",
      "pull_interval_sec": 15,
      "pull_timeout_sec": 15,
      "key_ref": "active",
      "status": "active"
    }' | jq -r '.data.source_id'
})"

echo "$SOURCE_ID"
```

预期：输出一个非空 `source_id`。

> 注意：当前执行器通过 `agent_base_url` 调 Agent 的 `/agent/v1/logs/pull`，`path` 字段在本地验收中主要用作来源标识与 cursor 追踪，因此这里仍应填写实际测试日志路径。

## 步骤 5：向主机 `/var/log` 写入一条唯一测试日志

```bash
E2E_TOKEN="NEXUSLOG_E2E_$(date -u +%Y%m%dT%H%M%SZ)"
TS_NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

printf '%s level=ERROR service=nexuslog-e2e token=%s message="stream and pull e2e"\n' "$TS_NOW" "$E2E_TOKEN" \
  | sudo tee -a /var/log/nexuslog-e2e.log

echo "$E2E_TOKEN"
```

预期：`/var/log/nexuslog-e2e.log` 中新增一行，且包含唯一 `token`。

## 步骤 6：触发一次手工 Pull Task，并轮询到成功

```bash
TASK_ID="$({
  curl -fsS -X POST http://localhost:8080/api/v1/ingest/pull-tasks/run \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "X-Tenant-ID: ${TENANT_ID}" \
    -H 'Content-Type: application/json' \
    -d '{
      "source_id": "'"$SOURCE_ID"'",
      "trigger_type": "manual",
      "options": {
        "max_records": 200,
        "timeout_ms": 15000
      }
    }' | jq -r '.data.task_id'
})"

echo "$TASK_ID"

for i in $(seq 1 30); do
  RESP="$(curl -fsS "http://localhost:8080/api/v1/ingest/pull-tasks?source_id=${SOURCE_ID}&page=1&page_size=20" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "X-Tenant-ID: ${TENANT_ID}")"
  STATUS="$(echo "$RESP" | jq -r --arg id "$TASK_ID" '.data.items[] | select(.task_id == $id) | .status' | head -n1)"
  BATCH_ID="$(echo "$RESP" | jq -r --arg id "$TASK_ID" '.data.items[] | select(.task_id == $id) | .batch_id // empty' | head -n1)"
  LAST_CURSOR="$(echo "$RESP" | jq -r --arg id "$TASK_ID" '.data.items[] | select(.task_id == $id) | .last_cursor // empty' | head -n1)"

  echo "attempt=$i status=${STATUS} batch_id=${BATCH_ID} last_cursor=${LAST_CURSOR}"

  case "$STATUS" in
    success)
      break
      ;;
    failed|canceled)
      echo "ERROR: pull task failed" >&2
      exit 1
      ;;
  esac

  sleep 2
done

test "$STATUS" = "success"
```

预期：`status=success`。

## 步骤 7：验证 Pull 主链写入 ES

```bash
PULL_QUERY="$(jq -n --arg token "$E2E_TOKEN" '{
  size: 5,
  sort: [{"@timestamp": {"order": "desc"}}],
  _source: ["@timestamp", "message", "event.id", "event_id", "log.level", "service.name", "source_collect_path", "nexuslog.ingest.schema_version", "tenant_id"],
  query: {
    simple_query_string: {
      query: $token,
      fields: ["message", "event.original", "service.name"]
    }
  }
}')"

curl -fsS -X POST http://localhost:9200/nexuslog-logs-write-pull/_search \
  -H 'Content-Type: application/json' \
  -d "$PULL_QUERY" | jq
```

预期：至少命中 `1` 条，并可看到：

- `message`
- `event.id` 或 `event_id`
- `log.level`
- `source_collect_path`
- `nexuslog.ingest.schema_version`

## 步骤 8：验证 Stream 主链写入 ES canary

```bash
STREAM_QUERY="$PULL_QUERY"

for i in $(seq 1 30); do
  HIT_COUNT="$(curl -fsS -X POST http://localhost:9200/nexuslog-logs-write-stream/_search \
    -H 'Content-Type: application/json' \
    -d "$STREAM_QUERY" | jq -r '.hits.total.value // 0')"
  echo "attempt=$i stream_hits=$HIT_COUNT"
  if [ "${HIT_COUNT:-0}" -gt 0 ]; then
    break
  fi
  sleep 2
done

test "${HIT_COUNT:-0}" -gt 0
```

预期：`30` 次轮询内出现命中。

> 按当前目标，Stream canary 最好在 `5` 秒内可查；本地环境允许一定波动，但不应长期为 `0`。

## 步骤 9：执行 Pull / Stream 双路 event_id 对比

```bash
ES_HOST=http://localhost:9200 \
SINCE_MINUTES=15 \
SAMPLE_SIZE=200 \
./scripts/compare-pull-stream-by-event-id.sh
```

预期输出至少满足：

- `shared_count > 0`
- `field_log_level_match_rate_shared` 有值
- `field_service_name_match_rate_shared` 有值
- `field_nexuslog_ingest_schema_version_match_rate_shared` 有值
- `field_source_collect_path_match_rate_shared` 有值
- `latency_delta_ms_p50` / `p95` / `max` / `avg` 有值或明确为 `NA`

## 步骤 10：验证 Query API 已可查询真实日志

### 10.1 搜索日志

```bash
curl -fsS -X POST http://localhost:8082/api/v1/query/logs \
  -H 'Content-Type: application/json' \
  -d '{
    "keywords": "'"$E2E_TOKEN"'",
    "page": 1,
    "page_size": 20
  }' | jq
```

预期：返回 `code=OK`，且 `data.hits` 中包含测试日志。

### 10.2 概览统计

```bash
curl -fsS http://localhost:8082/api/v1/query/stats/overview | jq
```

预期：返回 `200` 且 `code=OK`。

### 10.3 聚合统计

```bash
curl -fsS -X POST http://localhost:8082/api/v1/query/stats/aggregate \
  -H 'Content-Type: application/json' \
  -d '{
    "group_by": "level",
    "time_range": "1h",
    "filters": {}
  }' | jq
```

预期：返回 `200` 且 `code=OK`。

## 步骤 11：可选的前端验收要求

如果要继续验证 `/search/realtime`、`/dashboard` 等页面，请遵守以下规则：

- 必须使用 `chrome-devtools` MCP
- 每次结论都必须保留四类证据：
  - 目标 URL
  - Console 信息
  - Network 请求
  - 可复现步骤
- 缺少任一证据，页面结论视为无效

> 当前 runbook 不直接给出页面“已通过”的结论；页面验证需在执行时单独留痕。

## 步骤 12：清理本次验收对象

### 12.1 禁用本次 Pull Source

```bash
curl -fsS -X PUT "http://localhost:8080/api/v1/ingest/pull-sources/${SOURCE_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "X-Tenant-ID: ${TENANT_ID}" \
  -H 'Content-Type: application/json' \
  -d '{
    "status": "disabled"
  }' | jq
```

### 12.2 可选：删除测试日志文件

```bash
sudo rm -f /var/log/nexuslog-e2e.log
```

## 失败定位建议

### 1. `schema-registry` subjects 为空

优先检查：

```bash
$COMPOSE logs --tail=200 schema-registry schema-registry-init
```

### 2. Pull 成功但 Stream 查不到

优先检查：

```bash
$COMPOSE logs --tail=200 kafka-init flink-jobmanager flink-taskmanager flink-sql-init
curl -fsS http://localhost:8088/jobs/overview | jq
```

### 3. Pull / Stream 都写入了，但 `shared_count=0`

优先检查：

- Agent 是否仍在生成统一 `event_id`
- Stream SQL 是否落下了 `event_id`
- 查询窗口 `SINCE_MINUTES` 是否太短

### 4. Query API 搜索不到，但 ES 中已能查到

优先检查：

```bash
curl -fsS http://localhost:9200/_alias/nexuslog-logs-read | jq
$COMPOSE logs --tail=200 query-api
```

确认 `nexuslog-logs-read` 当前仍指向 Pull 默认数据流是符合预期的；切流前 Query API 不会默认读取 Stream canary。

## 关联文件

- `Makefile`
- `docker-compose.yml`
- `docker-compose.override.yml`
- `scripts/install-es-v2-template.sh`
- `scripts/install-es-log-aliases.sh`
- `scripts/register-schema-contracts.sh`
- `scripts/deploy-flink-sql-jobs.sh`
- `scripts/compare-pull-stream-by-event-id.sh`
- `stream/flink/jobs/sql/log-parser.sql`
- `stream/flink/jobs/sql/log-aggregation-direct.sql`
- `services/control-plane/cmd/api/ingest_runtime.go`
- `services/data-services/query-api/cmd/api/main.go`
