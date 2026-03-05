# NexusLog 日志从产生到入库的完整工作流程（V2）

## 1. 文档目的与范围

本文档定义远程日志采集链路的完整实现流程，覆盖：

1. 日志在远程服务器产生。
2. 远程 Agent 基于原文件增量采集。
3. 日志服务器按调度主动拉取。
4. 拉取响应加密传输与本地解密。
5. 结构化解析、优先级处理、去重、写入 Elasticsearch。
6. ACK/NACK 回执与 checkpoint 提交。

本文档聚焦主链路，不包含前端页面流程。

---

## 2. 总体状态流转

```text
LOG_CREATED
  -> DISCOVERED
  -> COLLECTED
  -> BUFFERED
  -> PULLED
  -> VERIFIED
  -> NORMALIZED
  -> DEDUPED
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

字段语义约束：

1. `source_path` 表示日志产生路径，例如 `/var/log/nginx/nginx.log`。
2. `source_collect_path` 表示 Agent 实际读取路径，例如 `/host-var-log/nginx/nginx.log`。
3. 两者禁止混用。

---

## 4. 端到端流程（逐步细节）

## 步骤 1：日志产生（应用/容器）

输入：

1. 应用运行日志输出。

处理：

1. 应用将日志写入本地文件或容器 stdout。

输出：

1. 原始日志行。

异常处理：

1. 应用日志格式异常不阻断采集链路，后续标记 `parse_status`。

---

## 步骤 2：Agent 发现日志更新

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

## 步骤 3：Agent 基于原文件增量读取

输入：

1. `source_collect_path`。
2. checkpoint 中该 source 的 `offset`。

处理：

1. 从 checkpoint 恢复 offset。
2. `seek(offset)` 后读取新增行。
3. 为每行记录“行尾绝对偏移”。
4. 同步采集 `inode/dev`，用于轮转识别。
5. 不写中间日志暂存文件。

输出：

1. raw 记录批次。

异常处理：

1. 文件截断或轮转：按 `inode/dev/fingerprint` 重建读取位置。
2. 文件不可读：记录错误并继续其他路径。

---

## 步骤 4：Agent 初步结构化与优先级打标

输入：

1. raw 记录。

处理：

1. 清理换行符、颜色控制符。
2. 解析级别关键词（error/fatal/warn/info/debug）。
3. 识别关键日志（critical source 或关键关键词）。
4. 构造 event 基础字段。

输出：

1. 标准记录（含 `log_priority`）。

异常处理：

1. 解析失败：保留原文，`parse_status=raw`。

---

## 步骤 5：Agent 待拉取缓冲（critical/normal 双通道）

输入：

1. 结构化记录。

处理：

1. 按优先级分入 critical 和 normal 队列。
2. 生成 `sequence`、`record_id`。
3. 按 cursor 维护单调顺序。

输出：

1. Pull API 可读取缓冲区。

异常处理：

1. 缓冲压力上升时优先保 critical，normal 降速并告警 backlog。

---

## 步骤 6：日志服务器调度拉取任务

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

## 步骤 7：日志服务器发起 Pull 请求

输入：

1. pull task。
2. 凭据（`X-Agent-Key` + `X-Key-Id`）。

处理：

1. 调用 `/agent/v1/logs/pull`。
2. 动态调整 `max_records/max_bytes`（慢链路降载，快链路增载）。
3. 透传 `request_id`。

输出：

1. agent pull 响应（可能为加密载荷）。

异常处理：

1. 网络超时重试。
2. 认证失败直接终止并报警。

---

## 步骤 8：Agent 组批、压缩、加密返回

输入：

1. pull 请求参数。
2. 缓冲记录。

处理：

1. 按 `cursor + priority + max_records + max_bytes` 选批。
2. 组装 `batch_id/records/next_cursor/has_more`。
3. 响应体先压缩（gzip，可扩展 zstd）。
4. 响应体再加密（AES-256-GCM）。
5. 生成 `payload_hash` 和签名（HMAC）。
6. 写入 `key_id` 与 `timestamp`（防重放）。

输出：

1. 加密响应体。

异常处理：

1. 参数非法返回标准错误，不推进 cursor。

---

## 步骤 9：日志服务器解密与完整性校验

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

## 步骤 10：规范化映射（event 层完成）

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

## 步骤 11：入库前去重（双层）

输入：

1. 标准化文档。

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

## 步骤 12：写入 Elasticsearch

输入：

1. 去重后文档。

处理：

1. 构造 bulk 请求。
2. 文档 `_id = event_id`，保证幂等。
3. 按批次大小分片写入。

输出：

1. ES 入库结果（成功/失败条数）。

异常处理：

1. 可重试错误走退避重试。
2. 重试后失败进入 dead-letter。

---

## 步骤 13：ACK/NACK 回执

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

## 步骤 14：Agent checkpoint 提交

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

## 5.1 安全

1. 传输层使用 HTTPS/mTLS（通道加密）。
2. 应用层使用响应体加密（内容加密）。
3. 必须有 `key_id` 支持密钥轮换。
4. 必须有签名和时间戳防篡改、防重放。

## 5.2 性能

1. 响应压缩默认开启。
2. 调度抖动 + 并发上限避免洪峰。
3. 动态 `max_records/max_bytes` 适配链路。
4. critical 低延迟通道优先。

## 5.3 可靠性

1. at-least-once：ACK 后才提交 checkpoint。
2. 幂等入库：`_id=event_id`。
3. 失败进入 dead-letter，支持 replay。

---

## 6. 关键配置建议（首版）

1. `critical_pull_interval_sec`: `1~3`。
2. `normal_pull_interval_sec`: `15~30`。
3. `max_records`: `200~500`。
4. `max_bytes`: `1MB`（上限 `5MB`）。
5. `pull_timeout_sec`: `15~30`。
6. `max_concurrent_pulls_per_agent`: `2`。
7. `payload_max_age_sec`: `300`。

---

## 7. 验收标准（上线前必须全部满足）

1. 抓包不可直接看到明文日志内容。
2. `source_path` 与 `source_collect_path` 语义正确。
3. critical 日志端到端时延显著低于 normal。
4. 重拉同批次时 ES 文档数不异常增长。
5. 轮转场景无明显漏采或爆量重复。
6. ACK/NACK 与 checkpoint 提交链路可追踪可回放。

