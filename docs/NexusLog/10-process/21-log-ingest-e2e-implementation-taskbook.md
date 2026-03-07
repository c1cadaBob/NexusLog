# NexusLog 日志采集全链路改进任务书

> 本文档是 [20-log-ingest-e2e-workflow-v2.md](./20-log-ingest-e2e-workflow-v2.md) 的执行任务单。
> 基于 NexusLog 当前代码与 Log-Monitoring 项目对比分析，整理出 13 项核心改进 + 6 项子改进。
> 本文档为唯一执行事实源，`20` 负责规范口径与验收标准。

---

## 任务总览

| 编号 | 优先级 | 任务 | 状态 | 关键改动文件 |
|------|--------|------|------|-------------|
| T-01 | P0 | 加密传输（AES-256-GCM + HMAC + 防重放） | 待开始 | 新增 `crypto/`；改 `pullapi/service.go`、`executor.go` |
| T-02 | P0 | 应用层去重 + event_id 升级 | 待开始 | 新增 `dedup.go`；改 `es_sink.go` |
| T-03 | P0 | ES 字段分层落地 | 待开始 | 改 `es_sink.go`、`agent_pull_mapper.go` |
| T-04 | P0 | 日志级别检测（三层策略） | 待开始 | 改 `collector.go`；改 `es_sink.go` |
| T-05 | P1 | 传输压缩 + 连接池 + 速率限制 | 待开始 | 改 `pullapi/service.go`、`agent_client.go` |
| T-06 | P1 | 偏移量 inode/dev + 原子持久化 | 待开始 | 改 `checkpoint/checkpoint.go`、`collector.go` |
| T-07 | P1 | 优先级队列（堆 + 溢出丢低保高） | 待开始 | 改 `pullapi/service.go` |
| T-08 | P1 | 多行日志合并 | 待开始 | 改 `collector.go` |
| T-09 | P1 | 敏感信息脱敏 | 待开始 | 新增 `masking/`；改 `es_sink.go` |
| T-10 | P2 | 对象池复用（sync.Pool） | 待开始 | 改 `plugins/record.go`、`pullapi/service.go` |
| T-11 | P2 | 过滤与路由引擎 | 待开始 | 新增 `filter/`；改 `collector.go` |
| T-12 | P2 | 不活跃文件自动关闭 | 待开始 | 改 `collector.go` |
| T-13 | P2 | 工程补齐（6 项子任务） | 待开始 | 多文件 |

---

## T-01：加密传输（AES-256-GCM + HMAC + 防重放）

**优先级**：P0

**当前状态**：Agent Pull API 返回明文 JSON，Control Plane 直接解析，无任何加密/签名/防重放。流程文档步骤 8~9 描述了加密流程，但代码零实现。

**目标状态**：Agent 侧对 Pull 响应体执行"JSON → 压缩 → AES-256-GCM 加密 → HMAC 签名"，Control Plane 侧执行"验签 → 防重放校验 → 解密 → 解压 → payload_hash 校验"。

**参考实现**：`Log-Monitoring/internal/crypto/crypto.go` — `TransportSecurity` 结构体，`Encrypt/Decrypt/sign` 方法。

**改动清单**：

| 序号 | 文件 | 改动内容 |
|------|------|---------|
| 1 | 新增 `agents/collector-agent/internal/crypto/crypto.go` | 移植 `TransportSecurity`：AES-256-GCM 加解密、HMAC-SHA256 签名、`SecurePayload` 结构体、`EncryptJSON/DecryptJSON` 便捷方法、时间窗口校验（默认 5 分钟） |
| 2 | 改 `agents/collector-agent/internal/pullapi/service.go` | Pull 响应流程：JSON 序列化 → 加密 → 返回 `SecurePayload`；设置 `X-Encrypted: true` + `X-Encryption-Version` 响应头；生成 `payload_hash = SHA256(原始JSON)` |
| 3 | 改 `agents/collector-agent/cmd/` | 启动时从配置加载 `shared_secret`，初始化 `TransportSecurity` 并注入 `Service` |
| 4 | 改 `services/control-plane/internal/ingest/agent_client.go` | Pull 返回后检测 `X-Encrypted` 头；解密 `SecurePayload` → 验签 → 时间窗口 → 解压 → 校验 `payload_hash` |
| 5 | 改 `services/control-plane/internal/ingest/executor.go` | 解密/校验失败时用错误码 `INGEST_DECRYPT_FAILED` / `INGEST_PAYLOAD_VERIFY_FAILED` 走 NACK |
| 6 | 改 `services/control-plane/internal/ingest/pull_auth_keys.go` | `ResolveCredential` 同时返回 `shared_secret`，支持 active/next 密钥轮换 |

**验收标准**：

1. 抓包不可直接看到明文日志内容（流程文档第 7 节验收项 1）。
2. 密钥不匹配时 NACK + 错误码 `INGEST_DECRYPT_FAILED`，不入库、不推进 cursor。
3. 时间戳超过 5 分钟的 payload 被拒绝。
4. active/next 密钥轮换窗口内两把密钥均可解密。

---

## T-02：应用层去重 + event_id 升级

**优先级**：P0

**当前状态**：`es_sink.go` 用 `agent_id:batch_id:record_id` 作为 ES `_id`，只防同批次重写，不防内容重复。无应用层去重。

**目标状态**：入 ES 前增加滑动窗口去重；ES `_id` 升级为基于内容的 `event_id`。

**参考实现**：`Log-Monitoring/internal/collector/inputs/pull/dedup.go` — `PullDeduplicator`，滑动窗口 + 环形缓冲区 + hash 去重。

**改动清单**：

| 序号 | 文件 | 改动内容 |
|------|------|---------|
| 1 | 新增 `services/control-plane/internal/ingest/dedup.go` | 实现 `IngestDeduplicator`：按 `source_id+source_path` 分桶的滑动窗口（默认 5 批次）；hash = `SHA256(server_id + source_collect_path + offset + message_hash)` |
| 2 | 改 `services/control-plane/internal/ingest/es_sink.go` | `_id` 从 `agent_id:batch_id:record_id` 替换为 `event_id`；写入 `event_id`、`dedupe_key` 字段 |
| 3 | 改 `services/control-plane/internal/ingest/executor.go` | `writeToESWithRetry` 前调用 `dedup.DeduplicateBatch`，过滤重复；统计 `duplicate_count` |

**验收标准**：

1. 重拉同批次时 ES 文档数不异常增长（流程文档第 7 节验收项 4）。
2. 同一行日志被不同批次拉取，生成相同 `event_id`，ES 天然幂等。
3. `duplicate_ratio` 指标可查询、可告警。

---

## T-03：ES 字段分层落地

**优先级**：P0

**当前状态**：`es_sink.go` 仅写入 13 个字段（`@timestamp`、`message`、`source`、`source_path`、`source_internal`、`offset`、`sequence`、`record_id`、`batch_id`、`task_id`、`source_id`、`request_id`、`metadata`），缺少 `agent_id`、`level`、`host`、`collect_time`、`raw_size`、`ingested_at`、`schema_version`、`parse_status` 等。

**目标状态**：ES 文档覆盖流程文档第 3 节五层字段模型中的核心字段。

**改动清单**：

| 序号 | 文件 | 改动内容 |
|------|------|---------|
| 1 | 改 `services/control-plane/internal/ingest/es_sink.go` | `WriteRecords` 中补写：`agent_id`、`level`、`host`、`collect_time`（`record.collected_at`）、`raw_size`（`record.size_bytes`）、`ingested_at`（`time.Now().UTC()`）、`schema_version`（`"v2"`）、`parse_status`（默认 `"ok"`）、`source_collect_path`（当前 `source_internal` 重命名） |
| 2 | 改 `services/control-plane/internal/ingest/agent_pull_mapper.go` | 透传 `level`（从 `record.metadata["level"]` 读取） |

**验收标准**：

1. ES 文档至少包含 raw 层 6 字段 + event 层 6 字段 + ingest 层 5 字段 + governance 层 1 字段。
2. `source_path` 与 `source_collect_path` 语义正确（流程文档第 7 节验收项 2）。
3. `agent_id` 在 ES 中可检索、可聚合。

---

## T-04：日志级别检测（三层策略）

**优先级**：P0

**当前状态**：`splitCriticalBatch` 仅做 critical/normal 二分，不提取具体级别。ES 中 `level` 字段始终为空。

**目标状态**：Agent 侧对每条日志提取 `level`（DEBUG/INFO/WARN/ERROR/FATAL），写入 `metadata["level"]`，透传到 ES。

**参考实现**：`Log-Monitoring/internal/agent/reader.go` — `detectLogLevel`：方括号格式 > JSON/KV 格式 > 独立关键字，三层检测。

**改动清单**：

| 序号 | 文件 | 改动内容 |
|------|------|---------|
| 1 | 改 `agents/collector-agent/internal/collector/collector.go` | 新增 `detectLogLevel(line string) string`，三层检测策略；在 `readFileIncremental` 中调用，写入 `metadata["level"]` |
| 2 | 改 `agents/collector-agent/internal/collector/collector.go` | `splitCriticalBatch` 改为基于 `level` 的优先级推导：`FATAL/ERROR → critical`、`WARN → normal`、`INFO/DEBUG → low` |

**验收标准**：

1. ES 中 `level` 字段有值且准确（覆盖 `[ERROR]`、`"level":"error"`、`level=error`、独立 `ERROR` 四种格式）。
2. 未识别的日志 `level` 默认为 `UNKNOWN`。

---

## T-05：传输压缩 + 连接池 + 速率限制

**优先级**：P1

**当前状态**：Pull 响应直接传输原始 JSON，无压缩。`agent_client.go` 使用默认 `http.Client`，无连接池优化。Agent 侧无速率限制。调度器无 jitter。

**参考实现**：Log-Monitoring — 压缩管理器（LZ4/Zstd）+ HTTP `DisableCompression: false` + 令牌桶限流 + 连接池参数。

**改动清单**：

| 序号 | 文件 | 改动内容 |
|------|------|---------|
| 1 | 改 `agents/collector-agent/internal/pullapi/service.go` | Pull 响应 JSON → gzip 压缩（小于 1KB 跳过）→ 设置 `X-Compression: gzip` 头 |
| 2 | 改 `services/control-plane/internal/ingest/agent_client.go` | 配置 `http.Transport`：`MaxIdleConns=10`、`MaxIdleConnsPerHost=5`、`IdleConnTimeout=90s`、`TLSHandshakeTimeout=10s` |
| 3 | 改 `agents/collector-agent/internal/pullapi/service.go` | 新增令牌桶速率限制（默认 100 req/s），在 `RegisterRoutes` 中间件层拦截 |
| 4 | 改 `services/control-plane/internal/ingest/scheduler.go` | `shouldSchedule` 中为调度间隔增加 ±20% 随机抖动 |
| 5 | 改 `services/control-plane/internal/ingest/es_sink.go` | Bulk 分片：超过 500 条或 2MB 时拆分为多个 `_bulk` 请求 |

**验收标准**：

1. Pull 响应带宽降低 50% 以上（gzip 对 JSON 文本压缩率通常 70~85%）。
2. 多 source 并发拉取时不出现连接耗尽。
3. 多 source 调度不出现齐发洪峰。

---

## T-06：偏移量 inode/dev + 原子持久化

**优先级**：P1

**当前状态**：`checkpoint.FileStore` 只记录 `path+offset`，不追踪 `inode/device`。持久化方式非原子（直接 `WriteFile`）。文件截断后仅简单回退到 0。

**参考实现**：`Log-Monitoring/internal/collector/inputs/file/registry.go` — `FileState{Path, Inode, Device, Offset, Timestamp, TTL}`，`tmp+rename` 原子写。

**改动清单**：

| 序号 | 文件 | 改动内容 |
|------|------|---------|
| 1 | 改 `agents/collector-agent/internal/checkpoint/checkpoint.go` | `Position` 扩展为 `{Offset, Inode, Device, Timestamp, TTL}`；`Save` 改为 `tmp+rename` 原子写；添加 `cleanExpired` 定时清理过期状态 |
| 2 | 改 `agents/collector-agent/internal/collector/collector.go` | `readFileIncremental` 中通过 `syscall.Stat_t` 采集 `Ino/Dev`；对比 checkpoint 中的 inode/dev，不一致时判定轮转并重置 offset |
| 3 | 改 `agents/collector-agent/internal/collector/collector.go` | 定时批量 flush（默认 5 秒），减少磁盘 IO |

**验收标准**：

1. 轮转场景无明显漏采或爆量重复（流程文档第 7 节验收项 5）。
2. checkpoint 文件损坏时可从 0 恢复，不导致进程 panic。
3. 进程异常退出后重启，offset 正确恢复。

---

## T-07：优先级队列（堆 + 溢出丢低保高）

**优先级**：P1

**当前状态**：`pullapi/service.go` 使用单一 `[]internalRecord` 顺序缓冲，所有记录公平竞争。缓冲超限时裁剪最早记录（可能丢弃 critical）。

**参考实现**：`Log-Monitoring/internal/collector/priority/queue.go` — Min-Heap + `OverflowPolicyDropLow`（溢出时丢弃最低优先级）。

**改动清单**：

| 序号 | 文件 | 改动内容 |
|------|------|---------|
| 1 | 改 `agents/collector-agent/internal/pullapi/service.go` | `records` 拆分为 `criticalRecords` + `normalRecords` 双缓冲；`Pull` 时优先出 critical |
| 2 | 改 `agents/collector-agent/internal/pullapi/service.go` | 缓冲超限时优先裁剪 normal 队列；记录 `dropped_count` 指标 |
| 3 | 改 `agents/collector-agent/internal/collector/collector.go` | `internalRecord` 增加 `priority` 字段（critical/normal/low），`AddRecords` 时按 priority 分流 |

**验收标准**：

1. critical 日志端到端时延显著低于 normal（流程文档第 7 节验收项 3）。
2. 缓冲压力上升时 critical 不被裁剪。

---

## T-08：多行日志合并

**优先级**：P1

**当前状态**：`readFileIncremental` 按 `\n` 逐行读取，Java 堆栈/Python traceback 被拆成多条碎片记录。

**参考实现**：`Log-Monitoring/internal/collector/inputs/file/harvester.go` — `processMultiline`：正则模式匹配新事件起始行 + 超时自动 flush + 最大行数限制。

**改动清单**：

| 序号 | 文件 | 改动内容 |
|------|------|---------|
| 1 | 改 `agents/collector-agent/internal/collector/collector.go` | `SourceConfig` 增加 `Multiline` 配置（`Enabled/Pattern/Negate/Match/MaxLines/Timeout`） |
| 2 | 改 `agents/collector-agent/internal/collector/collector.go` | `readFileIncremental` 中增加多行缓冲逻辑：按正则判断是否属于同一事件，合并后输出为单条 `raw_line` |

**验收标准**：

1. Java 堆栈日志（`at com.xxx...` 开头的续行）合并为单条记录。
2. 多行超时（默认 3 秒）后自动 flush 当前缓冲。
3. 单事件超过 `MaxLines`（默认 50）时强制 flush。

---

## T-09：敏感信息脱敏

**优先级**：P1

**当前状态**：governance 层定义了 `pii_masked` 字段，但全链路无脱敏处理器。日志中的 IP/邮箱/手机号/密码直接存入 ES。

**参考实现**：`Log-Monitoring/internal/collector/processors/masking/masking.go` — `Masker`：正则规则引擎、按字段精细控制、动态规则增删、脱敏标签。

**改动清单**：

| 序号 | 文件 | 改动内容 |
|------|------|---------|
| 1 | 新增 `services/control-plane/internal/ingest/masking.go` | 实现 `Masker`：内置规则（IP/邮箱/手机号/密码字段）；可配置自定义正则；对 `message` + `attributes` 字段脱敏 |
| 2 | 改 `services/control-plane/internal/ingest/es_sink.go` | 入 ES 前调用 `masker.Mask(doc)`；脱敏后设置 `pii_masked=true` |

**验收标准**：

1. ES 中不可直接检索到原始 IP/邮箱/手机号。
2. `pii_masked=true` 的文档可追溯应用了哪些脱敏规则。

---

## T-10：对象池复用（sync.Pool）

**优先级**：P2

**当前状态**：全链路每条日志都创建新的 `plugins.Record`、`map[string]string`、`[]byte` 等对象。

**参考实现**：`Log-Monitoring/pkg/models/log_entry_pool.go` — `sync.Pool` 复用 `LogEntry`/`LogMetadata`/`LogEntryBatch`。

**改动清单**：

| 序号 | 文件 | 改动内容 |
|------|------|---------|
| 1 | 改 `agents/collector-agent/plugins/record.go` | 增加 `RecordPool`（`sync.Pool`）；`AcquireRecord/ReleaseRecord` |
| 2 | 改 `agents/collector-agent/internal/collector/collector.go` | `readFileIncremental` 中 `AcquireRecord`；`metadata` map 预分配容量 8 |
| 3 | 改 `agents/collector-agent/internal/pullapi/service.go` | ACK 成功后 `ReleaseRecord` 归还缓冲记录 |

**验收标准**：

1. 高吞吐（>10000 条/秒）下 GC pause 减少 30% 以上。

---

## T-11：过滤与路由引擎

**优先级**：P2

**当前状态**：所有日志无差别采集、传输、入库。高流量 debug 日志占用大量带宽和存储。

**参考实现**：`Log-Monitoring/internal/collector/filter/filter.go` — 规则引擎（Pass/Drop/Route），支持正则/范围匹配、配置热加载、延迟指标。

**改动清单**：

| 序号 | 文件 | 改动内容 |
|------|------|---------|
| 1 | 新增 `agents/collector-agent/internal/filter/filter.go` | 最小过滤引擎：按 level/source/keyword 过滤，支持 Drop/Pass 动作 |
| 2 | 改 `agents/collector-agent/internal/collector/collector.go` | `scanAndEmit` 中调用过滤器，过滤后再投递 |

**验收标准**：

1. 配置 `drop_levels: ["DEBUG"]` 后，debug 日志不传输、不入库。
2. 过滤统计 `dropped_count` 可审计。

---

## T-12：不活跃文件自动关闭

**优先级**：P2

**当前状态**：`collectFiles` 在 context 取消前持续运行，即使文件长时间无新内容仍持有文件句柄。

**参考实现**：`Log-Monitoring/internal/collector/inputs/file/harvester.go` — 不活跃超时后自动 `Stop()`。

**改动清单**：

| 序号 | 文件 | 改动内容 |
|------|------|---------|
| 1 | 改 `agents/collector-agent/internal/collector/collector.go` | 记录每个文件的 `lastActivity` 时间；连续 5 分钟无新增内容后从 `fileOffsets` 移除（下次扫描发现新内容时重新打开） |

**验收标准**：

1. 长时间运行的 Agent 不会累积无限的文件句柄。

---

## T-13：工程补齐（6 项子任务）

**优先级**：P2

### T-13.1：Checkpoint 写入与 ACK 一致性

改 `pullapi/service.go` `Ack` 方法：收集所有 source 的 offset 后作为一个原子操作写入，避免部分成功部分失败。

### T-13.2：Agent Graceful Shutdown

改 `collector.go` `Stop()`：先停止接收新数据 → 等待当前 pending Pull 批次超时或被 ACK → flush checkpoint → 关闭 channel。

### T-13.3：文档配置项统一

合并流程文档第 6 节和第 12 节的重叠配置建议，以第 12 节为准，删除第 6 节。

### T-13.4：实现矩阵步骤编号对齐

修正流程文档第 8 节矩阵的步骤编号，与第 4 节步骤定义一一对齐。

### T-13.5：Agent 侧错误码补充到失败决策表

在流程文档第 10 节补充 Agent 侧错误码（`REQ_INVALID_PARAMS`、`AUTH_MISSING_TOKEN`、`AUTH_INVALID_TOKEN`）及对应的 Control Plane 处理策略。

### T-13.6：SLO 指标口径与代码对齐

修正流程文档第 11 节 `critical_e2e_latency_p95` 口径说明，区分"任务调度延迟"（当前 `latency_monitor.go` 实现）与"端到端时延"（`ingested_at - collect_time`，需补实现）。

---

## 依赖关系

```text
T-04 (级别检测) ──→ T-03 (字段落地，需要 level 字段)
T-01 (加密传输) ──→ T-05 (压缩，加密前需要先压缩)
T-04 (级别检测) ──→ T-07 (优先级队列，需要 level → priority 推导)
T-02 (event_id)  ──→ T-03 (字段落地，需要 event_id/dedupe_key)
T-03 (字段落地) ──→ T-09 (脱敏，需要结构化字段后才能按字段脱敏)
```

建议执行顺序：`T-04 → T-03 → T-02 → T-01 → T-05 → T-06 → T-07 → T-08 → T-09 → T-10~T-13`

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-03-06 | v1.0 | 初始版本，基于 NexusLog/Log-Monitoring 对比分析创建 |
