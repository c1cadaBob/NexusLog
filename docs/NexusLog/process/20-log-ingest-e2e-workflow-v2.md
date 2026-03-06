# NexusLog 日志从产生到入库的完整工作流程（V2）

## 1. 文档目的与范围

本文档定义远程日志采集链路的完整实现流程，覆盖：

1. 日志在远程服务器产生。
2. 远程 Agent 基于原文件增量采集。
3. 日志服务器按调度主动拉取。
4. 拉取响应加密传输与本地解密。
5. 结构化解析、优先级处理、敏感信息脱敏、去重、写入 Elasticsearch。
6. ACK/NACK 回执与 checkpoint 提交。
7. 可选过滤（Agent 侧按规则丢弃噪音日志）。

本文档聚焦主链路，不包含前端页面流程。

---

## 2. 总体状态流转

```text
LOG_CREATED
  -> DISCOVERED
  -> COLLECTED
  -> FILTERED (可选，Agent 侧按规则 Drop)
  -> BUFFERED (critical/normal 双通道)
  -> PULLED
  -> VERIFIED (解密 + 签名 + 防重放)
  -> NORMALIZED
  -> MASKED (敏感信息脱敏)
  -> DEDUPED (滑动窗口 + event_id)
  -> INDEXED
  -> ACKED
```

异常分支：

```text
PULLED -> VERIFY_FAILED -> NACK -> RETRY
INDEXED_FAILED -> NACK -> RETRY/DEAD_LETTER
ACK_FAILED -> RE-PULL (依赖幂等ID防重)
```

---

## 3. 分层字段模型（必须执行）

### 3.1 raw 层（采集保真层）

- `raw_line`
- `raw_size`
- `collect_time`
- `source_collect_path`
- `offset`
- `file_inode`
- `file_dev`
- `agent_id`
- `server_id`

### 3.2 event 层（结构化检索层）

- `@timestamp`
- `message`
- `level`
- `source_path`
- `source_type`
- `host`
- `service`
- `stream`
- `parse_status`
- `parser`

### 3.3 transport 层（传输安全层）

- `batch_id`
- `cursor`
- `key_id`
- `encrypted`
- `compressed`
- `payload_hash`
- `sent_at`

### 3.4 ingest 层（入库追踪层）

- `record_id`
- `sequence`
- `event_id`
- `dedupe_key`
- `ingested_at`
- `task_id`
- `request_id`

### 3.5 governance 层（治理层）

- `schema_version`
- `tenant_id`
- `retention_class`
- `pii_masked`
- `trace_id`
- `span_id`
- `attributes`

### 3.6 分层字段示例（推荐模板）

#### raw 示例

```json
{
  "raw_line": "2026-03-05 12:53:12 [error] connect() failed while connecting to upstream",
  "raw_size": 86,
  "collect_time": "2026-03-05T04:53:12.792533134Z",
  "source_collect_path": "/host-var-log/nginx/nginx.log",
  "offset": 987654,
  "file_inode": "1234567",
  "file_dev": "fd00",
  "agent_id": "collector-agent-01",
  "server_id": "srv-prod-hz-001"
}
```

#### event 示例

```json
{
  "@timestamp": "2026-03-05T04:53:12.790917696Z",
  "message": "connect() failed while connecting to upstream",
  "level": "ERROR",
  "source_path": "/var/log/nginx/nginx.log",
  "source_type": "file",
  "host": "app-node-01",
  "service": "nginx",
  "stream": "stdout",
  "parse_status": "ok",
  "parser": "plain"
}
```

#### transport 示例

```json
{
  "batch_id": "batch-20260305-0001",
  "cursor": "1024",
  "key_id": "active",
  "encrypted": true,
  "compressed": "gzip",
  "payload_hash": "sha256:7c9f2c88e9c3b4fd2d6a8d2c1f7a4e81b9d5b7f3f1dcb72cb5c3dc9d6f3310c1",
  "sent_at": "2026-03-05T04:53:13.000000000Z"
}
```

#### ingest 示例

```json
{
  "record_id": "rec-1024",
  "sequence": 1024,
  "event_id": "evt-3f7d1c2f1d4a4a5890cf9eac8f3f7b11",
  "dedupe_key": "sha256:3f2a8a7730f4fb7462dce4c5f4e3929c6be52a3f4f6dc713f0db1f0ce9f20a0d",
  "ingested_at": "2026-03-05T04:53:13.120000000Z",
  "task_id": "task-pull-001",
  "request_id": "req-abc-123"
}
```

#### governance 示例

```json
{
  "schema_version": "v2",
  "tenant_id": "tenant-default",
  "retention_class": "hot-7d-warm-30d",
  "pii_masked": true,
  "trace_id": "9f0d3a2b4f3e4c7a8b9c0d1e2f3a4b5c",
  "span_id": "7a8b9c0d1e2f3a4b",
  "attributes": {
    "env": "prod",
    "cluster": "cn-hz-a"
  }
}
```

示例使用规则：

1. 示例值仅用于参考，不是固定常量。
2. `source_path` 与 `source_collect_path` 语义不可互换。
3. 时间字段统一使用 UTC 的 RFC3339Nano。

字段语义约束：

1. `source_path` 表示日志产生路径，例如 `/var/log/nginx/nginx.log`。
2. `source_collect_path` 表示 Agent 实际读取路径，例如 `/host-var-log/nginx/nginx.log`。
3. 两者禁止混用。

---

## 4. 端到端流程（逐步细节）

### 步骤 1：日志产生（应用/容器）

输入：

1. 应用运行日志输出。

处理：

1. 应用将日志写入本地文件或容器 stdout。

输出：

1. 原始日志行。

异常处理：

1. 应用日志格式异常不阻断采集链路，后续标记 `parse_status`。

---

### 步骤 2：Agent 发现日志更新

输入：

1. source 配置（include/exclude、扫描间隔、关键字规则）。
2. 文件系统事件（fsnotify）。

处理：

1. fsnotify 事件触发快速扫描。
2. 定时扫描做事件丢失兜底。

输出：

1. 本轮需要读取的路径集合。

异常处理：

1. 事件丢失时，定时扫描补偿。
2. 单 source 异常不影响其他 source。

---

### 步骤 3：Agent 基于原文件增量读取

输入：

1. `source_collect_path`。
2. checkpoint 中该 source 的 `offset`、`inode`、`device`。

处理：

1. 从 checkpoint 恢复 offset，同时比对 `inode/dev` 判定是否发生轮转。
2. `seek(offset)` 后读取新增行。
3. 为每行记录“行尾绝对偏移”。
4. 同步采集 `inode/dev`，用于轮转识别。
5. 不写中间日志暂存文件。
6. 若启用多行合并（`multiline`），按正则模式缓冲续行，超时或超过最大行数后合并输出为单条 `raw_line`。
7. checkpoint 持久化采用 `tmp+rename` 原子写入，防止进程崩溃导致数据损坏。
8. 文件连续 5 分钟无新增内容时释放文件句柄，下次发现新内容时重新打开。

输出：

1. raw 记录批次。

异常处理：

1. 文件截断或轮转：按 `inode/dev/fingerprint` 重建读取位置。
2. 文件不可读：记录错误并继续其他路径。
3. checkpoint 文件损坏：从 offset=0 重新开始，不导致进程 panic。

---

### 步骤 4：Agent 初步结构化与优先级打标

输入：

1. raw 记录。

处理：

1. 清理换行符、颜色控制符。
2. 三层级别检测：方括号格式（`[ERROR]`）→ JSON/KV 格式（`"level":"error"` / `level=error`）→ 独立关键字。
3. 优先级推导：`FATAL/ERROR → critical`、`WARN → normal`、`INFO/DEBUG → low`。
4. 识别关键日志（critical source 或关键关键词）。
5. 构造 event 基础字段（含 `level`、`log_priority`）。
6. 可选过滤：按配置的 `drop_levels`（如 `["DEBUG"]`）丢弃噪音日志，不进入缓冲区。

输出：

1. 标准记录（含 `level`、`log_priority`）。

异常处理：

1. 解析失败：保留原文，`parse_status=raw`，`level=UNKNOWN`。

---

### 步骤 5：Agent 待拉取缓冲（critical/normal 双通道）

输入：

1. 结构化记录。

处理：

1. 按优先级分入 critical 和 normal 双通道缓冲。
2. 生成 `sequence`、`record_id`。
3. 按 cursor 维护单调顺序。
4. 缓冲溢出策略：优先裁剪 normal 队列，保留 critical。

输出：

1. Pull API 可读取缓冲区（critical 通道优先出队）。

异常处理：

1. 缓冲压力上升时优先保 critical，normal 降速并告警 backlog。
2. 被丢弃的记录计入 `dropped_count` 指标，可审计。

---

### 步骤 6：日志服务器调度拉取任务

输入：

1. active pull source。
2. 上次游标、任务状态、调度策略。

处理：

1. 先调度 critical，再调度 normal。
2. 对调度时间做 jitter，避免齐发。
3. 限制每个 agent 并发拉取数量。

输出：

1. pull task（含 `cursor/max_records/max_bytes/timeout/priority`）。

异常处理：

1. source 不存在或禁用时快速失败并打错误码。

---

### 步骤 7：日志服务器发起 Pull 请求

输入：

1. pull task。
2. 凭据（`X-Agent-Key` + `X-Key-Id`）。

处理：

1. 调用 `/agent/v1/logs/pull`。
2. 动态调整 `max_records/max_bytes`（慢链路降载，快链路增载）。
3. 透传 `request_id`。
4. 使用连接池（`MaxIdleConns=10`、`MaxIdleConnsPerHost=5`），复用 TCP 连接。

输出：

1. agent pull 响应（可能为加密载荷）。

异常处理：

1. 网络超时重试。
2. 认证失败直接终止并报警。

---

### 步骤 8：Agent 组批、压缩、加密返回

输入：

1. pull 请求参数。
2. 缓冲记录。

处理：

1. 按 `cursor + priority + max_records + max_bytes` 选批。
2. 组装 `batch_id/records/next_cursor/has_more`。
3. 响应体先压缩（gzip，小于 1KB 跳过；可扩展 zstd）。
4. 响应体再加密（AES-256-GCM）。
5. 生成 `payload_hash` 和签名（HMAC）。
6. 写入 `key_id` 与 `timestamp`（防重放）。

输出：

1. 加密响应体。

异常处理：

1. 参数非法返回标准错误，不推进 cursor。

---

### 步骤 9：日志服务器解密与完整性校验

输入：

1. 加密响应体。
2. key store 中 `active/next` 密钥。

处理：

1. 按 `key_id` 取密钥。
2. 校验时间窗口（防重放）。
3. 校验签名。
4. 解密并解压。
5. 校验 `payload_hash`。

输出：

1. 明文批次记录。

异常处理：

1. 校验失败直接 NACK，不入库，不推进 cursor。

---

### 步骤 10：规范化映射（event 层完成）

输入：

1. 明文批次记录。

处理：

1. 统一字段名（`data -> message_raw/message` 等）。
2. 生成/修正 `@timestamp`（优先日志事件时间）。
3. 映射 `source_collect_path -> source_path`（显示层）。
4. 补充 `schema_version` 与治理字段。

输出：

1. 标准化文档列表。

异常处理：

1. 单条解析失败不丢弃，降级为 `parse_status=partial/raw`。

---

### 步骤 11：敏感信息脱敏

输入：

1. 标准化文档。

处理：

1. 按内置规则（IP/邮箱/手机号/密码字段）对 `message` 和 `attributes` 执行正则替换。
2. 可配置自定义脱敏规则。
3. 脱敏后设置 `pii_masked=true`。

输出：

1. 脱敏后文档。

异常处理：

1. 脱敏规则异常不阻断入库，降级为 `pii_masked=false` 并告警。

---

### 步骤 12：入库前去重（双层）

输入：

1. 脱敏后文档。

处理：

1. 生成 `message_hash`。
2. 生成 `event_id`：
   `sha256(server_id + source_collect_path + file_fingerprint + offset + message_hash)`。
3. 生成 `dedupe_key`（同 `event_id` 或扩展版本）。
4. 内存短窗去重（LRU/Bloom）。

输出：

1. 去重后文档。

异常处理：

1. 命中重复时计数上报，不作为失败。

---

### 步骤 13：写入 Elasticsearch

输入：

1. 去重后文档。

处理：

1. 构造 bulk 请求，文档需覆盖第 3 节五层字段模型核心字段。
2. 文档 `_id = event_id`，保证幂等。
3. 按批次大小分片写入（超过 500 条或 2MB 时拆分为多个 `_bulk` 请求）。
4. 补写 `ingested_at`（当前 UTC 时间）、`schema_version`（`"v2"`）。

输出：

1. ES 入库结果（成功/失败条数）。

异常处理：

1. 可重试错误走退避重试。
2. 重试后失败进入 dead-letter。

---

### 步骤 14：ACK/NACK 回执

输入：

1. ES 写入结果。

处理：

1. 全成功发送 ACK（`batch_id + committed_cursor`）。
2. 失败发送 NACK（带 reason/code）。

输出：

1. 回执状态。

异常处理：

1. ACK 失败不推进游标，下轮重拉，依赖 `_id=event_id` 防重复。

---

### 步骤 15：Agent checkpoint 提交

输入：

1. ACK 批次中的记录。

处理：

1. 按 source 计算最大 offset。
2. 持久化 checkpoint（建议按 source 文件原子写）。

输出：

1. 新 checkpoint。

异常处理：

1. checkpoint 失败：记录错误并告警，禁止错误推进。

---

## 5. 安全与性能细节（实现要求）

### 5.1 安全

1. 传输层使用 HTTPS/mTLS（通道加密）。
2. 应用层使用响应体加密（内容加密）。
3. 必须有 `key_id` 支持密钥轮换。
4. 必须有签名和时间戳防篡改、防重放。

### 5.2 性能

1. 响应压缩默认开启。
2. 调度抖动 + 并发上限避免洪峰。
3. 动态 `max_records/max_bytes` 适配链路。
4. critical 低延迟通道优先。

### 5.3 可靠性

1. at-least-once：ACK 后才提交 checkpoint。
2. 幂等入库：`_id=event_id`。
3. 失败进入 dead-letter，支持 replay。

---

## 6. 关键配置建议

> 配置参数的完整定义（含建议区间、默认推荐值、当前配置映射）统一见第 12 节。本节仅列出首版推荐的快速参考值。

| 参数 | 默认推荐值 | 完整定义 |
|------|-----------|---------|
| `critical_pull_interval_sec` | `2s` | 见 §12 `critical_interval` |
| `normal_pull_interval_sec` | `30s` | 见 §12 `normal_interval` |
| `max_records` | `500` | 见 §12 `max_records` |
| `max_bytes` | `1MB` | 见 §12 `max_bytes` |
| `pull_timeout_sec` | `30s` | 见 §12 `pull_timeout` |
| `max_concurrent_pulls_per_agent` | `2` | 见 §12 `max_concurrent_pulls_per_agent` |
| `payload_max_age_sec` | `300s` | 见 §12 `payload_max_age` |
| `compression_threshold` | `1KB` | 小于此值不压缩 |
| `dedup_window_batches` | `5` | 滑动窗口去重批次数 |
| `inactive_file_timeout` | `5min` | 不活跃文件自动释放句柄 |

---

## 7. 验收标准（上线前必须全部满足）

1. 抓包不可直接看到明文日志内容（加密传输）。
2. `source_path` 与 `source_collect_path` 语义正确（字段分层）。
3. critical 日志端到端时延显著低于 normal（优先级队列）。
4. 重拉同批次时 ES 文档数不异常增长（event_id 幂等 + 滑动窗口去重）。
5. 轮转场景无明显漏采或爆量重复（inode/dev 追踪 + 原子 checkpoint）。
6. ACK/NACK 与 checkpoint 提交链路可追踪可回放。
7. ES 文档 `level` 字段有值且与日志内容一致（三层级别检测）。
8. ES 文档至少覆盖第 3 节五层字段模型的核心字段（`agent_id`、`level`、`host`、`collect_time`、`ingested_at`、`schema_version` 等）。
9. 密钥不匹配时返回 NACK + 错误码 `INGEST_DECRYPT_FAILED`，不入库、不推进 cursor。
10. ES 中不可直接检索到原始 IP/邮箱/手机号（敏感信息脱敏）。
11. checkpoint 文件损坏时可从 0 恢复，不导致进程 panic。

---

## 8. 实现对照矩阵（流程步骤 -> 代码实现）

> 说明：
> 1. 本表用于把第 4 节步骤和当前仓库实现对齐，便于研发直接定位入口函数。
> 2. 若某能力尚未落地（如 payload 解密校验、event_id/dedupe_key），在“失败后的下一动作”中给出补齐方向。
> 3. 第 4 节更新后新增了步骤 11（敏感信息脱敏），原步骤 11~14 编号依次后移为 12~15。本表暂保留原有步骤映射，待代码实现后同步更新编号和入口函数。

| 步骤编号 | 组件 | 入口文件与函数 | 输入关键字段 | 输出关键字段 | 幂等点 | 回执行为（ACK/NACK 条件） | 失败后的下一动作 |
|---|---|---|---|---|---|---|---|
| 步骤 1 | Agent | `agents/collector-agent/internal/collector/collector.go` `readFileIncremental` | `path`、文件新增行、`startOffset` | `plugins.Record{Source,Data,Timestamp,Metadata[offset]}` | `source_collect_path + offset` | 无 | 日志格式异常不阻断，降级后续 `parse_status` |
| 步骤 2 | Agent | `agents/collector-agent/internal/collector/collector.go` `startFileEventWatcher`、`scanAndEmit` | `source.paths`、fsnotify 事件 | 需读取路径集合 | `path` 去重 | 无 | fsnotify 失效时回落定时扫描 |
| 步骤 3 | Agent + Checkpoint | `agents/collector-agent/internal/collector/collector.go` `loadOffsetIfNeeded`、`readFileIncremental`；`agents/collector-agent/internal/checkpoint/checkpoint.go` `Load` | `source_collect_path`、checkpoint `offset` | 增量 raw 记录 + 新 `offset` | `source_collect_path + offset` | 无 | 文件截断/轮转时回退并重建读取位置 |
| 步骤 4 | Agent | `agents/collector-agent/internal/collector/collector.go` `splitCriticalBatch` | `record.data`、`critical_keywords`、`metadata.log_priority` | `critical/normal` 批次 | `record_id(后续生成)` + `sequence(后续生成)` | 无 | 解析失败保留原文并打低优先级 |
| 步骤 5 | Agent Pull API | `agents/collector-agent/internal/pullapi/service.go` `AddRecords` | `[]plugins.Record` | 内存缓冲 + `Seq` | `Sequence` 单调递增 | 无 | 超上限触发窗口裁剪并告警 backlog |
| 步骤 6 | Scheduler | `services/control-plane/internal/ingest/scheduler.go` `scheduleSource`、`buildTaskOptions` | `PullSource`、上次调度时间 | `PullTask{options.timeout_ms,priority}` | `HasInFlight(source_id)` 防重入 | 无 | source 异常则跳过并记录任务创建失败 |
| 步骤 7 | Control Plane Agent Client | `services/control-plane/internal/ingest/agent_client.go` `Pull` | `cursor`、`max_records`、`max_bytes`、`timeout_ms`、鉴权头 | `AgentPullResponse` | `request_id + cursor` | 无 | 网络/鉴权失败标记 `INGEST_AGENT_PULL_FAILED`，按调度重试 |
| 步骤 8 | Agent Pull API | `agents/collector-agent/internal/pullapi/service.go` `Pull`、`tryBuildPullResponse` | Pull 请求 + 缓冲区 | `batch_id`、`records`、`next_cursor`、`has_more` | `batch_id`（pending map） | 等待后续 `/logs/ack` | 参数非法返回错误，不推进 cursor |
| 步骤 9 | Control Plane Executor | `services/control-plane/internal/ingest/executor.go` `Execute`（`Pull` 后处理段） | pull 返回包体、`key_id`、`payload_hash`（目标） | 通过校验的明文记录 | `payload_hash`（目标） | 校验失败必须 NACK | 当前未完整实现解密签名校验；优先补齐并接入错误码 |
| 步骤 10 | Mapper | `services/control-plane/internal/ingest/agent_pull_mapper.go` `BuildPullPackageFromAgentPull` | `AgentPullResponse.records` | `PullPackage`、`files[]`、`checksum` | `checksum` + `batch_id` | 无 | 映射失败标记 `INGEST_PACKAGE_BUILD_FAILED` |
| 步骤 11 | 去重 | `services/control-plane/internal/ingest/es_sink.go` `WriteRecords`（当前 `_id` 规则） | 标准化文档 | 去重后写入文档集合 | 当前 `_id=agent_id:batch_id:record_id`；目标 `event_id/dedupe_key` | 重复命中不应 NACK | 补齐 `event_id/dedupe_key`，并在入库前统计重复率 |
| 步骤 12 | ES Sink | `services/control-plane/internal/ingest/es_sink.go` `WriteRecords`；`services/control-plane/internal/ingest/executor.go` `writeToESWithRetry` | 批量文档、ES 连接参数 | `indexed/failed` 统计 | ES `_id` | 全成功进入 ACK；部分失败按重试后 NACK | 超过重试上限写 dead-letter 并告警 |
| 步骤 13 | 回执 | `services/control-plane/internal/ingest/executor.go` `Execute`、`handleNack`；`services/control-plane/internal/ingest/agent_client.go` `Ack` | `batch_id`、`status`、`committed_cursor`、`reason` | 回执状态 + receipt/dead-letter | `batch_id + checksum` | `ack`=ES 成功；`nack`=ES/ACK/校验失败 | ACK 失败不推进 cursor，下轮重拉 |
| 步骤 14 | Checkpoint + Cursor | `agents/collector-agent/internal/pullapi/service.go` `Ack`、`checkpoint.Save`；`services/control-plane/internal/ingest/executor.go` `persistCursors` | ACK 记录、source offset、`next_cursor` | agent checkpoint + control-plane cursor | `source_id + source_path` Upsert | 仅在 ACK 成功后推进 | checkpoint/cursor 写入失败标记失败并阻止错误推进 |

---

## 9. 接口契约与字段映射（执行口径）

### 9.1 Agent 接口契约（`/meta`、`/logs/pull`、`/logs/ack`）

#### `GET /agent/v1/meta`

请求：

1. Header：`X-Agent-Key`（必填）、`X-Key-Id`（建议，命中 active/next 密钥）。
2. Body：无。

响应字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `agent_id` | string | 是 | Agent 实例标识 |
| `version` | string | 是 | Agent 版本 |
| `status` | string | 是 | 运行状态 |
| `sources` | string[] | 是 | 当前可拉取 source 列表 |
| `capabilities` | string[] | 是 | 能力声明（如 pull/ack） |

#### `POST /agent/v1/logs/pull`

请求体：

| 字段 | 类型 | 必填 | 约束/默认 |
|---|---|---|---|
| `cursor` | string | 否 | 非负整数；空表示从 committed cursor 开始 |
| `max_records` | int | 否 | 默认 `200`，最大 `1000` |
| `max_bytes` | int | 否 | 默认 `1MB`，最大 `5MB` |
| `timeout_ms` | int | 否 | 默认 `30000`，必须 `>=0` |

响应体：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `batch_id` | string | 是 | 本次批次标识 |
| `records` | array | 是 | 记录列表 |
| `next_cursor` | string | 是 | 下次游标 |
| `has_more` | bool | 是 | 是否还有可拉取记录 |

`records[]` 子字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `record_id` | string | 是 | 批次内记录标识 |
| `sequence` | int64 | 是 | Agent 侧递增序号 |
| `source` | string | 是 | 采集路径（即 `source_collect_path` 语义） |
| `timestamp` | int64 | 是 | UnixNano |
| `collected_at` | string | 是 | RFC3339Nano |
| `data` | string | 是 | 原始日志正文 |
| `size_bytes` | int | 是 | 单条字节数 |
| `offset` | int64 | 是 | 行尾绝对偏移 |
| `metadata` | map | 否 | 扩展字段，至少包含 `offset` 兼容信息 |

#### `POST /agent/v1/logs/ack`

请求体：

| 字段 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `batch_id` | string | 是 | 批次 ID |
| `status` | string | 是 | `ack` 或 `nack` |
| `committed_cursor` | string | 条件必填 | `ack` 场景可填，需为非负整数 |
| `reason` | string | 条件必填 | `nack` 场景必填 |

响应体：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `accepted` | bool | 是 | Agent 是否接受回执 |
| `checkpoint_updated` | bool | 是 | 是否更新了 checkpoint |

统一错误响应：

1. 结构：`{"code": "...", "message": "..."}`。
2. 典型错误码：`REQ_INVALID_PARAMS`、`RES_NOT_FOUND`、`INTERNAL_ERROR`、`AUTH_MISSING_TOKEN`、`AUTH_INVALID_TOKEN`。

### 9.2 Pull 记录字段 -> ES 文档字段映射（含路径语义）

| Pull 字段 | ES 目标字段（规范） | 当前实现字段 | 映射规则 |
|---|---|---|---|
| `record.data` | `message` | `message` | 原文透传；入库前应清理换行/颜色符 |
| `record.timestamp` | `@timestamp` | `@timestamp` | UnixNano 转 RFC3339Nano |
| `record.source` | `source_collect_path` | `source_internal` | 该字段语义是采集路径，不可替代 `source_path` |
| `record.source` | `source_path` | `source_path` | 通过 `normalizeSourcePathForDisplay` 映射为日志产生路径 |
| `record.offset` | `offset` | `offset` | 行尾绝对偏移，checkpoint 依据 |
| `record.sequence` | `sequence` | `sequence` | Agent 单调序号 |
| `record.record_id` | `record_id` | `record_id` | 批次内幂等跟踪 |
| `batch_id` | `batch_id` | `batch_id` | pull 批次追踪 |
| `task.request_id` | `request_id` | `request_id` | 链路请求追踪 |
| `task.task_id` | `task_id` | `task_id` | 调度任务追踪 |
| `source.source_id` | `source_id` | `source_id` | pull source 标识 |

### 9.3 分层字段与当前实现兼容映射

> 原则：第 3 节定义是单一事实源；本节只说明“当前实现如何贴合或待补齐”，不重新定义字段语义。

#### raw 层兼容

| 规范字段 | 当前实现映射 | 状态 |
|---|---|---|
| `raw_line` | `record.data` | 已覆盖（未单独保留原字段名） |
| `raw_size` | `record.size_bytes` | 已覆盖 |
| `collect_time` | `record.collected_at`/`record.timestamp` | 已覆盖 |
| `source_collect_path` | `record.source`（当前入 ES 为 `source_internal`） | 已覆盖（字段名待统一） |
| `offset` | `record.offset`/`metadata.offset` | 已覆盖 |
| `file_inode`、`file_dev` | 未稳定入库 | 待补齐 |
| `agent_id` | `resolveAgentID(...)` | 已覆盖 |
| `server_id` | `source.host` 或 metadata 推断 | 部分覆盖 |

#### event 层兼容

| 规范字段 | 当前实现映射 | 状态 |
|---|---|---|
| `@timestamp` | `toRFC3339Nano(record.timestamp)` | 已覆盖 |
| `message` | `record.data` | 已覆盖 |
| `level` | 未统一标准化 | 待补齐 |
| `source_path` | `normalizeSourcePathForDisplay(record.source)` | 已覆盖 |
| `source_type` | `source.protocol` 或静态推断 | 部分覆盖 |
| `host` | `PullSource.host` | 部分覆盖 |
| `service`、`stream` | `record.metadata` | 部分覆盖 |
| `parse_status`、`parser` | 未统一入库 | 待补齐 |

#### transport 层兼容

| 规范字段 | 当前实现映射 | 状态 |
|---|---|---|
| `batch_id` | `pull_resp.batch_id` | 已覆盖 |
| `cursor` | `next_cursor` + cursorStore | 已覆盖 |
| `key_id`、`encrypted`、`compressed`、`payload_hash`、`sent_at` | 传输加密封装未完整落地 | 待补齐（P0） |

#### ingest 层兼容

| 规范字段 | 当前实现映射 | 状态 |
|---|---|---|
| `record_id` | `record.record_id` | 已覆盖 |
| `sequence` | `record.sequence` | 已覆盖 |
| `event_id`、`dedupe_key` | 当前以 ES `_id=agent_id:batch_id:record_id` 近似 | 待补齐（P0） |
| `ingested_at` | 由 ES 写入时间/`@timestamp`近似 | 部分覆盖 |
| `task_id`、`request_id` | task 与请求上下文 | 已覆盖 |

#### governance 层兼容

| 规范字段 | 当前实现映射 | 状态 |
|---|---|---|
| `schema_version` | 未统一写入 | 待补齐 |
| `tenant_id` | 多租户字段未统一 | 待补齐 |
| `retention_class` | 依赖索引/ILM 策略 | 部分覆盖 |
| `pii_masked` | 脱敏标志未统一 | 待补齐 |
| `trace_id`、`span_id` | 部分来源可透传 | 部分覆盖 |
| `attributes` | `record.metadata` | 已覆盖（需治理约束） |

### 9.4 字段冲突处理规则（同名异义/缺失/默认值）

1. 同名异义：
   `source_path` 只表示日志产生路径；`source_collect_path` 只表示 Agent 采集路径。两者禁止覆盖写入。
2. 缺失值：
   允许缺省字段入库，但必须落 `parse_status`，并在 `attributes.missing_fields` 记录缺失集合。
3. 默认值：
   时间字段统一 UTC RFC3339Nano；`level` 缺失时默认 `UNKNOWN`；`parser` 缺失时默认 `raw`。
4. 优先级：
   同一字段同时存在日志正文解析值与 metadata 值时，优先使用解析值，并保留 metadata 到 `attributes`。
5. 兼容升级：
   新字段只能增量添加，不得复用旧字段名改变语义；语义变化必须升级 `schema_version`。

---

## 10. 失败分支决策表（错误码、重试、回执）

| 场景 | 触发条件 | 检测点 | 错误码 | 立即动作（ACK/NACK/重试） | 是否推进 cursor | 是否写 dead-letter | 告警等级 |
|---|---|---|---|---|---|---|---|
| 解密失败 | AES-GCM 解密失败、密钥不匹配 | 步骤 9 解密模块 | `INGEST_DECRYPT_FAILED` | 立即 NACK，不重试同包 | 否 | 是 | P1 |
| 签名或 hash 校验失败 | HMAC 不匹配或 `payload_hash` 校验失败 | 步骤 9 校验模块 | `INGEST_PAYLOAD_VERIFY_FAILED` | 立即 NACK，阻断入库 | 否 | 是 | P1 |
| ES 部分失败 | `_bulk` 返回 `errors=true` 或 failed>0 | `ESSink.WriteRecords` | `INGEST_ES_WRITE_FAILED` | 退避重试；超过上限后 NACK | 否 | 是（超过重试上限） | P1 |
| ACK 请求失败 | 回写 `/logs/ack` 非 2xx 或网络失败 | `AgentClient.Ack` | `INGEST_ACK_FAILED` | 标记任务失败并走 NACK 分支 | 否 | 是 | P1 |
| checkpoint 写入失败 | Agent checkpoint 保存失败或控制面 cursor 写入失败 | `Service.Ack` / `persistCursors` | `AGENT_CHECKPOINT_SAVE_FAILED` / `INGEST_CURSOR_STORE_FAILED` | 标记失败并告警；下轮按旧 cursor 重拉 | 否 | 否 | P1 |
| 拉取超时/网络抖动 | Pull 请求超时、连接中断、抖动 | `AgentClient.Pull` | `INGEST_AGENT_PULL_FAILED` | 任务失败并由调度器重试 | 否 | 否 | P2 |
| 文件轮转导致 offset 异常 | 文件截断、inode 变化、offset 回退 | `readFileIncremental` / offset 校验 | `AGENT_OFFSET_ANOMALY` | 重建读取位置并标记告警，必要时 NACK 当前批次 | 条件推进（仅确认轮转后） | 否 | P2 |
| Agent 参数校验失败 | Pull 请求参数无效（cursor 非法、max_records 超限等） | Agent Pull API 入口 | `REQ_INVALID_PARAMS` | 返回 400，不组批、不推进 cursor | 否 | 否 | P3 |
| Agent 缺少认证令牌 | 请求未携带 `X-Agent-Key` | Agent Pull API 中间件 | `AUTH_MISSING_TOKEN` | 返回 401，立即拒绝 | 否 | 否 | P1 |
| Agent 认证令牌无效 | `X-Agent-Key` 校验失败 | Agent Pull API 中间件 | `AUTH_INVALID_TOKEN` | 返回 403，立即拒绝并报警 | 否 | 否 | P1 |
| 脱敏规则异常 | 正则编译失败或脱敏处理器 panic | 步骤 11 脱敏模块 | `INGEST_MASKING_FAILED` | 降级为 `pii_masked=false`，不阻断入库 | 不影响 | 否 | P2 |

闭环约束：

1. 任一 `NACK` 都必须携带 `reason`，并在 receipt/dead-letter 落证据。
2. “不推进 cursor”是默认安全策略；只有 ACK 且 checkpoint/cursor 同步成功才允许推进。
3. 错误码必须可检索且可聚合，不可只写自由文本。

---

## 11. 可观测性与 SLO 建议区间

> 本节全部为建议区间，默认值可按环境调优（开发、预发、生产可不同）。

| 指标 | 计算口径 | 建议区间 | 默认推荐值 | 调优说明 |
|---|---|---|---|---|
| `critical_e2e_latency_p95` | `P95(ingested_at - collect_time)`，仅 `priority=critical`。注意：当前 `latency_monitor.go` 实现的是"任务调度延迟"（`finishedAt - scheduledAt`），与本指标口径不同，需补充 `ingested_at - collect_time` 的端到端计算 | `1s~5s` | `<=3s` | 高优先级链路优先保障时延 |
| `normal_e2e_latency_p95` | `P95(ingested_at - collect_time)`，`priority=normal`。同上需补充端到端计算 | `5s~30s` | `<=15s` | 随吞吐可适度放宽 |
| `duplicate_ratio` | `duplicate_docs / total_docs` | `0%~1%` | `<=0.3%` | 高于阈值优先排查 cursor/幂等键 |
| `decrypt_fail_rate` | `decrypt_failed_batches / pulled_batches` | `0%~0.01%` | `<=0.001%` | 重点关注密钥轮换窗口 |
| `ack_fail_rate` | `ack_failed / ack_total` | `0%~0.5%` | `<=0.1%` | 升高通常意味着网络或鉴权异常 |
| `pull_backlog` | `pending_records` 或 `pending_bytes` | `0~2 个调度周期可消化` | `critical<1000 条，normal<10000 条` | 建议按 source 分桶监控 |

指标落地建议：

1. 采集维度至少包含 `source_id`、`agent_id`、`priority`、`status`。
2. 指标窗口建议同时提供 `1m/5m/15m`，避免短时抖动误报。
3. 告警触发采用“连续窗口命中”（例如连续 3 个窗口超过默认推荐值）。

---

## 12. 性能与安全参数建议区间（默认值）

> 本节为“建议区间 + 默认推荐值”，不作为硬编码阈值门禁。

| 参数 | 建议区间 | 默认推荐值 | 当前配置映射 | 说明 |
|---|---|---|---|---|
| `max_records` | `200~800` | `500` | `task.options.max_records`；Agent 端上限 `1000` | 大批量提升吞吐，小批量降低时延 |
| `max_bytes` | `512KB~5MB` | `1MB` | `task.options.max_bytes`；Agent 端上限 `5MB` | 建议与链路 MTU/带宽联合调优 |
| `pull_timeout` | `10s~60s` | `30s` | `pull_timeout_sec` / `task.options.timeout_ms` | 慢链路可上调，避免假失败 |
| `critical_interval` | `1s~5s` | `2s` | `PullTaskSchedulerConfig.CriticalPullIntervalSec` | 优先保证关键日志时效 |
| `normal_interval` | `10s~60s` | `30s` | `PullSource.pull_interval_sec` | 平衡资源消耗与时效 |
| `max_concurrent_pulls_per_agent` | `1~4` | `2` | 当前仅 `HasInFlight(source_id)`；agent 维度并发待补齐 | 多源扩展时用于限流防拥塞 |
| `payload_max_age` | `60s~600s` | `300s` | 当前未落地；目标接入步骤 9 时间窗口校验 | 防重放与过期包拒收 |

补充安全参数建议：

| 参数 | 建议区间 | 默认推荐值 | 当前配置映射 | 说明 |
|---|---|---|---|---|
| `key_rotation_interval_hours` | `24~168` | `72` | `key_ref` + active/next 密钥机制 | 降低长期密钥泄露风险 |
| `retry_backoff` | `1s~10s` | `3s` | `PullTaskExecutorConfig.RetryBackoff` | 与 `MaxRetries` 联动 |
| `max_retries` | `0~5` | `2` | `PullTaskExecutorConfig.MaxRetries` | 避免失败风暴压垮下游 |

---

## 13. 发布、回滚与审计最小流程

### 13.1 发布最小流程

1. 发布前校验：
   配置项可解析（含 `max_records/max_bytes/timeout/key_ref`），并完成文档第 7 节验收项预检查。
2. 灰度发布：
   先在单 `source_id` 或单 `agent_id` 灰度，观察 `critical_e2e_latency_p95`、`ack_fail_rate`、`duplicate_ratio`。
3. 全量发布：
   指标稳定后扩大到全量 source，并保留旧配置可回滚快照。

### 13.2 回滚触发条件

1. 连续 3 个窗口 `ack_fail_rate` 超过默认推荐值。
2. `decrypt_fail_rate` 或签名失败率持续异常。
3. ES 写入失败导致 dead-letter 快速增长且无法在窗口内回落。

### 13.3 回滚最小步骤

1. 回退配置：
   恢复上一版本调度参数与密钥配置（active/next）。
2. 回退执行：
   暂停新增任务，保留 cursor 与 checkpoint，不做人工推进。
3. 回放恢复：
   对 dead-letter 执行定向 replay，验证幂等后恢复全量调度。

### 13.4 审计最小证据

1. 发布证据：变更单、参数差异、发布时间窗口。
2. 运行证据：关键指标截图（发布前/后对比）。
3. 失败证据：错误码聚合、NACK 原因、dead-letter 条目。
4. 回滚证据：回滚命令/配置快照、恢复结果、复盘结论。

---

## 14. 执行任务摘要（P0/P1/P2）

完整任务单（唯一执行事实源）：

1. [21-log-ingest-e2e-implementation-taskbook.md](./21-log-ingest-e2e-implementation-taskbook.md)（共 13 项核心任务 + 6 项子任务）

摘要任务：

| 优先级 | 任务编号 | 目标 | 关键产出 | 验收出口 |
|---|---|---|---|---|
| P0 | T-01~T-04 | 打通"安全传输 + 字段规范 + 去重幂等 + 级别检测"闭环 | AES-256-GCM 加解密、event_id/dedupe_key 去重、五层字段落库、三层级别检测 | 第 7 节验收项 1~4、7~9 全部通过 |
| P1 | T-05~T-09 | 提升稳定性与扩展性 | 传输压缩、连接池、inode/dev 原子 checkpoint、优先级队列、多行合并、PII 脱敏 | 第 7 节验收项 3、5、10 通过；高峰期 backlog 可控 |
| P2 | T-10~T-13 | 治理与长期演进 | 对象池、过滤路由引擎、不活跃文件自动关闭、工程补齐（6 项） | GC 优化、存储降本、运维标准化 |

建议执行顺序：`T-04 → T-03 → T-02 → T-01 → T-05 → T-06 → T-07 → T-08 → T-09 → T-10~T-13`

执行说明：

1. `20` 负责规范口径与验收标准。
2. `21` 负责文件级任务拆解、执行更新与完成状态维护。
3. 任务间依赖关系详见 `21` 文档"依赖关系"章节。
