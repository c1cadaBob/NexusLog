# NexusLog 日志结构重构 v1.2：分层字段方案、当前落地状态、全链路生命周期与最终结构定义

## 摘要

本文档用于统一 **Agent → Control-Plane → ES** 整条日志链路的 v2 结构化字段方案，并明确：

- 哪些结构已经落地
- 哪些字段是当前链路的真实契约
- 哪些原始设计项尚未完全实现
- ES 最终文档应采用什么结构

> 生效日期：2026-03-07  
> 当前基线：以 `agents/collector-agent/internal/pullapi`、`services/control-plane/internal/ingest`、`storage/elasticsearch/*/nexuslog-logs-v2.json` 的当前实现为准。  
> 如果本文与代码实现冲突，以代码与 `docs/NexusLog/process/24-sdlc-development-process.md` 第 13 章为准。

本方案的目标：

- 将服务名 / 实例名从日志正文中拆出
- 过滤无意义空行与前缀空行
- 将多行异常 / 错误块合并为单条结构化事件
- 实现两层去重：
  - **链路幂等去重**
  - **时间窗语义聚合去重**
- 当前阶段**不实现前端折叠展示**
- 输出一套可直接用于实现、联调与验收的字段规范

---

## 已确认前提

| 项 | 结论 |
|---|---|
| 优化范围 | `agent → control-plane → ES` 整条链路 |
| 兼容策略 | 允许破坏性重构 |
| Pull 协议策略 | 已切换为纯 v2，不再保留 legacy 扁平字段 |
| 前端折叠展示 | 本阶段不做，后续放到聚类分析模块 |
| 去重策略 | 双层去重：幂等去重 + 时间窗语义聚合去重 |
| 字段风格 | 平台语义 + 结构化 + 偏 ECS 风格 |
| 旧索引兼容 | 不要求兼容旧字段，不做双写 |
| 旧索引 | `logs-remote` 视为旧结构 |
| 新索引默认值 | `nexuslog-logs-v2` |
| 模板匹配模式 | `nexuslog-logs-v2` 与 `nexuslog-logs-v2-*` |
| Schema 版本 | `2.0` |
| Pipeline 版本 | `2.0` |

---

## 当前实施状态总览

| 项 | 当前状态 | 说明 |
|---|---|---|
| Agent Pull v2 顶层结构 | 已实现 | 使用 `batch_id`、`agent`、`cursor`、`records` |
| Agent Pull v2 单条记录结构 | 已实现 | 使用 `source`、`severity`、`service`、`container`、`attributes`、`multiline`、`dedup`、`original` |
| 服务名前缀拆分 | 已实现 | 从 `keycloak-1 | xxx` 提取 `service.*` / `container.name` |
| 空行 / 空白行过滤 | 已实现 | 纯空行、纯空白行直接丢弃 |
| 空前缀行过滤 | 已实现 | 例如 `keycloak-1 |` 直接丢弃 |
| 多行异常块合并 | 已实现 | Agent 优先合并 Java stack trace / `npm error` block |
| Agent 第一层去重 | 已实现 | 短时间窗去重，保留 `dedup.*` 统计 |
| Control-plane 只消费 v2 pull 字段 | 已实现 | 不再依赖 `data`、`timestamp`、`metadata` 等旧字段 |
| `event.id` 生成 | 已实现 | 由 control-plane 统一生成 |
| 第二层语义去重 | 已实现 | ES sink 内 10s 进程内窗口聚合 |
| ES v2 结构化文档 | 已实现 | 写入 `nexuslog-logs-v2` |
| Control-plane 服务名前缀兜底提取 | 未完全实现 | 当前主要依赖 Agent 已拆分结果 |
| Control-plane 多行合并兜底 | 未完全实现 | 当前主要信任 Agent 多行合并结果 |
| `labels.*` 白名单治理 | 部分实现 | 当前仅消费 `attributes` 中 `label.` 前缀并补 `env` |
| 前端折叠展示 | 未实现 | 已明确后置，不影响当前链路 |

---

## 总体分层模型

```text
原始日志行
  ↓
Agent 清洗 / 前缀提取 / 空行过滤 / 多行合并 / 初步去重
  ↓
Agent Pull 标准结构（LogEnvelope v2）
  ↓
Control-Plane 规范化 / 富化 / 生成 event.id / 二次去重
  ↓
Control-Plane 标准结构（NormalizedLogEvent / ES Input）
  ↓
ES 最终结构（nexuslog-logs-v2 document）
```

---

## 一、Agent 层结构化字段

### 1.1 Agent 返回顶层结构：`LogEnvelope`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `batch_id` | `string` | 是 | 本次 pull 批次唯一标识 |
| `agent.id` | `string` | 建议 | Agent 唯一标识 |
| `agent.version` | `string` | 建议 | Agent 版本 |
| `cursor.next` | `string` | 是 | 下次继续拉取的游标 |
| `cursor.has_more` | `boolean` | 是 | 是否还有更多数据 |
| `records` | `array<LogEnvelopeRecord>` | 是 | 标准化日志记录数组 |

### 1.2 Agent 单条记录结构：`LogEnvelopeRecord`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `record_id` | `string` | 是 | 批次内记录 ID |
| `sequence` | `int64` | 是 | Agent 本地递增序号 |
| `observed_at` | `RFC3339 string` | 是 | Agent 观察到该日志事件的时间 |
| `body` | `string` | 是 | 清洗后的日志正文 |
| `size_bytes` | `int` | 是 | `body` 字节数 |
| `source.kind` | `string` | 是 | 来源类型：`file/container/syslog/journald/other` |
| `source.path` | `string` | 建议 | 源日志路径 |
| `source.offset` | `int64` | 建议 | 来源偏移 |
| `source.stream` | `string` | 否 | 如 `stdout` / `stderr` |
| `severity.text` | `string` | 建议 | `trace/debug/info/warn/error/fatal/unknown` |
| `severity.number` | `int` | 建议 | 数值级别 |
| `service.name` | `string` | 强烈建议 | 服务名，如 `keycloak` |
| `service.instance.id` | `string` | 建议 | 实例名，如 `keycloak-1` |
| `service.version` | `string` | 否 | 服务版本 |
| `service.environment` | `string` | 否 | 环境标识 |
| `container.name` | `string` | 否 | 容器名 |
| `attributes.*` | `map<string,string>` | 否 | 受控扩展属性 |
| `multiline.enabled` | `boolean` | 是 | 是否由多行合并生成 |
| `multiline.line_count` | `int` | 否 | 合并后的有效行数 |
| `multiline.start_offset` | `int64` | 否 | 合并块起始偏移 |
| `multiline.end_offset` | `int64` | 否 | 合并块结束偏移 |
| `multiline.dropped_empty_prefix_lines` | `int` | 否 | 被过滤的空前缀行数量 |
| `dedup.hit` | `boolean` | 否 | Agent 层是否命中过去重 |
| `dedup.count` | `int` | 否 | Agent 层聚合后的原始次数 |
| `dedup.first_seen_at` | `RFC3339 string` | 否 | 去重窗口内首次出现时间 |
| `dedup.last_seen_at` | `RFC3339 string` | 否 | 去重窗口内最后一次出现时间 |
| `dedup.window_sec` | `int` | 否 | 去重窗口秒数 |
| `dedup.strategy` | `string` | 否 | `exact` / `multiline` |
| `original` | `string` | 否 | 合并前或清洗前保留的原始日志块 |

### 1.3 Agent 层职责（当前实现）

| 能力 | 当前是否在 Agent 做 | 说明 |
|---|---|---|
| 去掉空行 | 是 | 过滤纯空行和纯空白行 |
| 去掉空前缀行 | 是 | 例如 `keycloak-1 |` |
| 服务前缀拆分 | 是 | 从 `keycloak-1 | xxx` 提取 `service.*` 与 `container.name` |
| 多行异常块合并 | 是 | Java stack trace / `npm error` block |
| 第一层去重 | 是 | 对短时间窗内相同块做去重并累计次数 |
| 复杂业务语义解析 | 否 | 不在 Agent 层做重规则解析 |
| `event.id` 生成 | 否 | 放在 control-plane 统一生成 |

### 1.4 Agent Pull 协议已废弃字段

| 旧字段 | 状态 | 替代字段 |
|---|---|---|
| `next_cursor` | 废弃 | `cursor.next` |
| `has_more` | 废弃 | `cursor.has_more` |
| `data` | 废弃 | `body` |
| `timestamp` | 废弃 | `observed_at` |
| `collected_at` | 废弃 | `observed_at` |
| 顶层 `offset` | 废弃 | `source.offset` |
| 顶层字符串 `source` | 废弃 | `source.kind` + `source.path` + `source.offset` |
| `metadata` | 废弃 | 结构化字段 + `attributes.*` |
| 过渡字段 `source_v2` | 废弃 | 统一收口为 `source` |

---

## 二、Control-Plane 层结构化字段

### 2.1 Control-Plane 标准对象：`NormalizedLogEvent`

该对象是 control-plane 内部统一语义对象，用于：

- 校验 Agent v2 输入
- 补齐平台字段
- 生成 `event.id`
- 执行第二层去重
- 输出 ES v2 文档

### 2.2 `NormalizedLogEvent` 字段定义

#### A. 事件本体

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `event.id` | `string` | 是 | Control-plane 生成的全局唯一事件 ID |
| `event.record_id` | `string` | 否 | Agent 批次内记录 ID |
| `event.sequence` | `int64` | 是 | Agent 递增序号 |
| `event.original` | `string` | 建议 | 完整原始日志块 |
| `event.kind` | `string` | 是 | 当前固定为 `event` |
| `event.category` | `[]string` | 是 | 当前固定为 `application` |
| `event.type` | `[]string` | 是 | 当前固定为 `log` |
| `event.severity` | `int` | 否 | 数值级别 |

#### B. 时间字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `@timestamp` | `time.Time` | 是 | 主事件时间，来自 `observed_at` |
| `nexuslog.ingest.received_at` | `time.Time` | 是 | Control-plane 接收 / 准备写入时间 |

#### C. 日志语义字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `message` | `string` | 是 | 列表摘要，通常取首个有效非空行 |
| `log.level` | `string` | 是 | 标准日志级别 |
| `log.offset` | `int64` | 否 | 文件偏移 |
| `log.file.path` | `string` | 否 | 文件路径 |
| `log.file.name` | `string` | 否 | 文件名 |
| `log.file.directory` | `string` | 否 | 文件目录 |

#### D. Agent / 服务 / 容器 / 来源

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `agent.id` | `string` | 是 | Agent 标识 |
| `agent.version` | `string` | 否 | Agent 版本 |
| `agent.hostname` | `string` | 否 | Agent 所在主机名 |
| `service.name` | `string` | 强烈建议 | 服务名 |
| `service.instance.id` | `string` | 建议 | 服务实例名 |
| `service.version` | `string` | 否 | 服务版本 |
| `service.environment` | `string` | 否 | 环境 |
| `container.name` | `string` | 否 | 容器名 |
| `source.kind` | `string` | 是 | 来源类型 |
| `source.path` | `string` | 否 | 来源展示路径或来源路径 |
| `source.stream` | `string` | 否 | `stdout` / `stderr` |

#### E. 主机 / 进程 / 上下文

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `host.name` | `string` | 否 | 主机名 |
| `host.ip` | `string` | 否 | 主机 IP |
| `process.pid` | `int` | 否 | 进程 ID |
| `process.thread.id` | `int64` | 否 | 线程 ID |
| `trace.id` | `string` | 否 | Trace ID |
| `span.id` | `string` | 否 | Span ID |
| `request.id` | `string` | 否 | 请求 ID |
| `user.id` | `string` | 否 | 用户 ID |

#### F. HTTP / URL

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `http.request.method` | `string` | 否 | 请求方法 |
| `http.response.status_code` | `int` | 否 | 响应码 |
| `url.path` | `string` | 否 | URL 路径 |
| `url.full` | `string` | 否 | 完整 URL |

#### G. Error

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `error.type` | `string` | 否 | 异常类型 |
| `error.message` | `string` | 否 | 异常主消息 |
| `error.stack_trace` | `string` | 否 | 合并后的完整堆栈或正文 |

#### H. 平台链路字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `nexuslog.transport.batch_id` | `string` | 是 | Pull 批次 ID |
| `nexuslog.transport.channel` | `string` | 否 | 传输通道 |
| `nexuslog.transport.compressed` | `bool` | 否 | 是否压缩 |
| `nexuslog.transport.encrypted` | `bool` | 否 | 是否加密 |
| `nexuslog.ingest.schema_version` | `string` | 是 | Schema 版本 |
| `nexuslog.ingest.pipeline_version` | `string` | 是 | Pipeline 版本 |
| `nexuslog.ingest.parse_status` | `string` | 否 | 解析状态 |
| `nexuslog.ingest.parse_rule` | `string` | 否 | 命中规则 |
| `nexuslog.ingest.retry_count` | `int` | 否 | 重试次数 |

#### I. 多行合并字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `nexuslog.multiline.enabled` | `bool` | 是 | 是否多行合并 |
| `nexuslog.multiline.line_count` | `int` | 否 | 有效行数 |
| `nexuslog.multiline.start_offset` | `int64` | 否 | 起始偏移 |
| `nexuslog.multiline.end_offset` | `int64` | 否 | 结束偏移 |
| `nexuslog.multiline.dropped_empty_prefix_lines` | `int` | 否 | 被丢弃的前缀空行数 |

#### J. 去重字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `nexuslog.dedup.fingerprint` | `string` | 建议 | 语义去重指纹 |
| `nexuslog.dedup.hit` | `bool` | 否 | 是否命中聚合去重 |
| `nexuslog.dedup.count` | `int` | 否 | 聚合后的出现次数 |
| `nexuslog.dedup.first_seen_at` | `time.Time` | 否 | 首次出现时间 |
| `nexuslog.dedup.last_seen_at` | `time.Time` | 否 | 最后出现时间 |
| `nexuslog.dedup.window_sec` | `int` | 否 | 聚合窗口秒数 |
| `nexuslog.dedup.strategy` | `string` | 否 | `exact` / `normalized` / `multiline` |
| `nexuslog.dedup.suppressed_count` | `int` | 否 | 被聚合掉的次数 |

#### K. 治理与扩展字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `nexuslog.governance.tenant_id` | `string` | 否 | 租户归属 |
| `nexuslog.governance.retention_policy` | `string` | 否 | 保留策略 |
| `nexuslog.governance.pii_masked` | `bool` | 是 | 是否脱敏 |
| `nexuslog.governance.classification` | `string` | 否 | 数据分级 |
| `labels.*` | `map<string,string>` | 否 | 扩展标签 |

### 2.3 Control-Plane 关键职责与当前状态

| 能力 | 设计目标 | 当前实现 | 备注 |
|---|---|---|---|
| 校验 Agent payload | 必须 | 已实现 | 只接受 v2 pull 结构 |
| 统一生成 `event.id` | 必须 | 已实现 | 作为链路幂等主键 |
| 只消费 v2 字段 | 必须 | 已实现 | 不再依赖 legacy 扁平字段 |
| 服务名兜底提取 | 设计要求 | 未完全实现 | 当前主要依赖 Agent 拆分结果 |
| 多行合并兜底 | 设计要求 | 未完全实现 | 当前主要信任 Agent 合并结果 |
| 结构化 error 字段 | 必须 | 已实现（轻量） | 首行摘要 + 正则识别 + `npm.lifecycle_error` 特判 |
| 第二层去重 | 必须 | 已实现 | ES sink 内 10s 进程内窗口 |
| 写入 ES v2 文档 | 必须 | 已实现 | 默认写入 `nexuslog-logs-v2` |

---

## 三、ES 最终完整结构

### 3.1 索引与模板约定

| 项 | 当前约定 |
|---|---|
| 默认写入索引 | `nexuslog-logs-v2` |
| 模板匹配模式 | `nexuslog-logs-v2`、`nexuslog-logs-v2-*` |
| rollover alias | `nexuslog-logs-v2` |
| 模板文件 | `storage/elasticsearch/index-templates/nexuslog-logs-v2.json`、`storage/elasticsearch/templates/nexuslog-logs-v2.json` |

### 3.2 最终 ES 文档字段总表

#### 顶层与事件

| 字段 | 类型 | 必填 |
|---|---|---|
| `@timestamp` | `date` | 是 |
| `message` | `text + keyword` | 是 |
| `event.id` | `keyword` | 是 |
| `event.record_id` | `keyword` | 否 |
| `event.sequence` | `long` | 是 |
| `event.original` | `text` | 否 |
| `event.kind` | `keyword` | 是 |
| `event.category` | `keyword[]` | 是 |
| `event.type` | `keyword[]` | 是 |
| `event.severity` | `short` | 否 |

#### log / source / agent

| 字段 | 类型 | 必填 |
|---|---|---|
| `log.level` | `keyword` | 是 |
| `log.offset` | `long` | 否 |
| `log.file.path` | `keyword` | 否 |
| `log.file.name` | `keyword` | 否 |
| `log.file.directory` | `keyword` | 否 |
| `source.kind` | `keyword` | 是 |
| `source.path` | `keyword` | 否 |
| `source.stream` | `keyword` | 否 |
| `agent.id` | `keyword` | 是 |
| `agent.version` | `keyword` | 否 |
| `agent.hostname` | `keyword` | 否 |

#### service / container / host / process

| 字段 | 类型 | 必填 |
|---|---|---|
| `service.name` | `keyword` | 强烈建议 |
| `service.instance.id` | `keyword` | 建议 |
| `service.version` | `keyword` | 否 |
| `service.environment` | `keyword` | 否 |
| `container.name` | `keyword` | 否 |
| `host.name` | `keyword` | 否 |
| `host.ip` | `ip` | 否 |
| `process.pid` | `integer` | 否 |
| `process.thread.id` | `long` | 否 |

#### trace / request / http / url

| 字段 | 类型 | 必填 |
|---|---|---|
| `trace.id` | `keyword` | 否 |
| `span.id` | `keyword` | 否 |
| `request.id` | `keyword` | 否 |
| `user.id` | `keyword` | 否 |
| `http.request.method` | `keyword` | 否 |
| `http.response.status_code` | `short` | 否 |
| `url.path` | `keyword` | 否 |
| `url.full` | `keyword` | 否 |

#### error

| 字段 | 类型 | 必填 |
|---|---|---|
| `error.type` | `keyword` | 否 |
| `error.message` | `text` | 否 |
| `error.stack_trace` | `text` | 否 |

#### 平台链路字段

| 字段 | 类型 | 必填 |
|---|---|---|
| `nexuslog.transport.batch_id` | `keyword` | 是 |
| `nexuslog.transport.channel` | `keyword` | 否 |
| `nexuslog.transport.compressed` | `boolean` | 否 |
| `nexuslog.transport.encrypted` | `boolean` | 否 |
| `nexuslog.ingest.received_at` | `date` | 是 |
| `nexuslog.ingest.schema_version` | `keyword` | 是 |
| `nexuslog.ingest.pipeline_version` | `keyword` | 是 |
| `nexuslog.ingest.parse_status` | `keyword` | 否 |
| `nexuslog.ingest.parse_rule` | `keyword` | 否 |
| `nexuslog.ingest.retry_count` | `short` | 否 |

#### 多行合并字段

| 字段 | 类型 | 必填 |
|---|---|---|
| `nexuslog.multiline.enabled` | `boolean` | 是 |
| `nexuslog.multiline.line_count` | `integer` | 否 |
| `nexuslog.multiline.start_offset` | `long` | 否 |
| `nexuslog.multiline.end_offset` | `long` | 否 |
| `nexuslog.multiline.dropped_empty_prefix_lines` | `integer` | 否 |

#### 去重字段

| 字段 | 类型 | 必填 |
|---|---|---|
| `nexuslog.dedup.fingerprint` | `keyword` | 建议 |
| `nexuslog.dedup.hit` | `boolean` | 否 |
| `nexuslog.dedup.count` | `integer` | 否 |
| `nexuslog.dedup.first_seen_at` | `date` | 否 |
| `nexuslog.dedup.last_seen_at` | `date` | 否 |
| `nexuslog.dedup.window_sec` | `integer` | 否 |
| `nexuslog.dedup.strategy` | `keyword` | 否 |
| `nexuslog.dedup.suppressed_count` | `integer` | 否 |

#### 治理字段与扩展标签

| 字段 | 类型 | 必填 |
|---|---|---|
| `nexuslog.governance.tenant_id` | `keyword` | 否 |
| `nexuslog.governance.retention_policy` | `keyword` | 否 |
| `nexuslog.governance.pii_masked` | `boolean` | 是 |
| `nexuslog.governance.classification` | `keyword` | 否 |
| `labels.*` | `keyword` | 否 |

---

## 四、结构流转规则

### 4.1 Agent → Control-Plane → ES 字段流转

| Agent 字段 | Control-Plane 字段 | ES 字段 | 规则 |
|---|---|---|---|
| `batch_id` | `nexuslog.transport.batch_id` | `nexuslog.transport.batch_id` | 直接映射 |
| `agent.id` | `agent.id` | `agent.id` | 直接映射；缺失时使用调度侧 agent_id |
| `agent.version` | `agent.version` | `agent.version` | 直接映射 |
| `record_id` | `event.record_id` | `event.record_id` | 直接映射 |
| `sequence` | `event.sequence` | `event.sequence` | 直接映射 |
| `observed_at` | `@timestamp` | `@timestamp` | 作为主事件时间 |
| `body` | `message` / `error.stack_trace` | `message` / `error.stack_trace` | 正文先参与摘要，再保留为错误堆栈或完整正文 |
| `original` | `event.original` | `event.original` | 原样保留；为空则回退为 `body` |
| `source.path` | `log.file.path` / `source.path` | `log.file.path` / `source.path` | 当前实现会生成文件字段，并保留来源展示路径 |
| `source.offset` | `log.offset` | `log.offset` | 直接映射 |
| `source.kind` | `source.kind` | `source.kind` | 直接映射 |
| `source.stream` | `source.stream` | `source.stream` | 直接映射 |
| `severity.text` | `log.level` | `log.level` | 标准级别，缺失时从正文兜底推断 |
| `severity.number` | `event.severity` | `event.severity` | 数值级别 |
| `service.name` | `service.name` | `service.name` | 直接映射 |
| `service.instance.id` | `service.instance.id` | `service.instance.id` | 直接映射 |
| `service.version` | `service.version` | `service.version` | 直接映射 |
| `service.environment` | `service.environment` | `service.environment` | 直接映射，并可生成 `labels.env` |
| `container.name` | `container.name` | `container.name` | 直接映射 |
| `attributes.*` | 上下文字段 / `labels.*` | 对应结构字段 / `labels.*` | 当前通过受控 key 透传 |
| `multiline.*` | `nexuslog.multiline.*` | `nexuslog.multiline.*` | 直接映射 |
| `dedup.*` | `nexuslog.dedup.*` | `nexuslog.dedup.*` | Agent 命中信息保留，ES sink 可继续聚合 |

### 4.2 Control-Plane 计算字段规则（当前实现）

| 字段 | 当前规则 |
|---|---|
| `event.id` | `sha256(agent.id + source.kind + source.path + observed_at + sequence + normalized_body)` |
| `nexuslog.dedup.fingerprint` | `sha256(service.name + service.instance.id + log.level + normalized_message + error.type + normalized_stack_signature)` |
| `message` | 取首个有效非空行作为摘要 |
| `log.level` | 优先取 `severity.text`，缺失时根据正文关键字推断 |
| `error.type` | 首行正则识别 `Exception` / `Error`，或 `npm.lifecycle_error` 特判 |
| `error.message` | 通常为首个有效非空行 |
| `error.stack_trace` | 当前直接保留合并后的 `body` |
| `nexuslog.ingest.received_at` | Control-plane 当前时间 |
| `nexuslog.ingest.parse_rule` | 当前规则：`docker-compose-prefix-v1` / `multiline-fallback-v1` / `plain-line-v1` |
| `labels.*` | 当前从 `attributes` 中 `label.*` 前缀提取，并补充 `env` |

---

## 五、旧字段废弃清单

### 5.1 Pull 协议旧字段

| 旧字段 | 替代字段 |
|---|---|
| `next_cursor` | `cursor.next` |
| `has_more` | `cursor.has_more` |
| `data` | `body` |
| `timestamp` | `observed_at` |
| `collected_at` | `observed_at` |
| `offset` | `source.offset` |
| 顶层 `source` 字符串 | `source.kind` + `source.path` + `source.offset` |
| `metadata` | 结构化字段 + `attributes.*` |
| `source_v2` | `source` |

### 5.2 旧 ES / 链路扁平字段

| 旧字段 | 替代字段 |
|---|---|
| `raw_message` | `event.original` |
| `collect_time` | `@timestamp` |
| `ingested_at` | `nexuslog.ingest.received_at` |
| 顶层 `level` | `log.level` |
| 顶层 `agent_id` | `agent.id` |
| 顶层 `batch_id` | `nexuslog.transport.batch_id` |
| 顶层 `sequence` | `event.sequence` |
| 顶层 `source` | `source.kind` + `source.path` |
| 顶层 `metadata` | 结构化字段 + `labels.*` |

---

## 六、测试与验收场景

### 6.1 清洗与服务提取

| 场景 | 输入 | 期望 |
|---|---|---|
| 空前缀行 | `keycloak-1 |` | 丢弃 |
| 普通前缀日志 | `keycloak-1 | ERROR db timeout` | 提取 `service.name=keycloak`、`service.instance.id=keycloak-1` |
| 无前缀普通日志 | `ERROR db timeout` | 不误提取服务名 |

### 6.2 多行合并

| 场景 | 输入 | 期望 |
|---|---|---|
| Java 堆栈 | `Exception` + 多个 `at ...` | 合并为 1 条 |
| npm error block | 多个 `npm error ...` 行 | 合并为 1 条 |
| 中间夹空前缀行 | `service |` 插在堆栈中 | 空前缀行被丢弃，不打断块 |

### 6.3 幂等去重

| 场景 | 期望 |
|---|---|
| 同一 pull 包重复投递 | ES 仅 1 条 |
| ACK 重放 | ES 不重复 |
| 同一 `event.id` 重写 | 覆盖或拒绝，不产生重复文档 |

### 6.4 语义聚合去重

| 场景 | 期望 |
|---|---|
| 10 秒内 3 次同样 npm error block | ES 写 1 条，`dedup.count=3` |
| 仅路径、时间等非语义字段不同 | 归一化后可聚合 |
| 不同服务相同错误文本 | 不聚合 |
| 超过窗口后再次出现 | 生成新事件 |

### 6.5 最终结构验证

| 场景 | 期望 |
|---|---|
| ES 文档检查 | 所有新字段存在，旧字段不再写入 |
| 查询字段验证 | `service.name`、`log.level`、`agent.id`、`@timestamp` 可直接检索 |
| 异常详情验证 | `message` 为摘要，`error.stack_trace` 与 `event.original` 保存完整信息 |
| 索引模板验证 | `nexuslog-logs-v2` 模板已安装，mapping 命中新结构 |

---

## 七、当前实现 vs 原始方案差异清单

> 本节用于明确哪些内容已经落地，哪些仍是设计目标或后续建议。

| 项 | 原始设计 | 当前实现 | 影响 / 后续建议 |
|---|---|---|---|
| Pull 协议来源字段命名 | 过渡讨论中曾出现 `source_v2` | 当前已统一为 `source` 结构化对象 | 后续文档与联调示例都应只使用 `source.*` |
| Pull 协议兼容策略 | 早期允许新旧字段并存 | 当前已切为纯 v2，不再返回 `next_cursor` / `has_more` / `data` / `timestamp` / `metadata` 等旧字段 | 属于有意破坏性重构，所有联调方必须升级 |
| Control-plane 服务名兜底提取 | 设计要求 control-plane 对异常输入兜底解析 `service.*` | 当前主要依赖 Agent 已完成前缀拆分 | 后续若接入第三方 Agent，建议补齐兜底逻辑 |
| Control-plane 多行兜底合并 | 设计要求必须能兜底 stack trace merge | 当前默认信任 Agent 的多行合并结果 | 多来源 Agent 场景建议补 control-plane fallback merge |
| 第二层语义去重状态范围 | 平台级统一语义聚合 | 当前为 ES sink 进程内内存窗口，默认 `10s` | 单实例有效；多实例需共享状态或外部协调 |
| `message` / `error` 提取深度 | 设计希望更完整的摘要 / 类型 / 主消息 | 当前为轻量规则：首行摘要 + 正则识别 + `npm.lifecycle_error` 特判 | 足够支撑第一阶段，后续可补语言 / 框架规则 |
| 扩展字段自动解析深度 | 设计包括 `trace.*` / `http.*` / `url.*` / `host.*` / `process.*` 等 | 当前支持落 ES，但多数依赖 `attributes.*` 透传 | 若要提升检索质量，应增强 Agent 或 pipeline 解析 |
| `labels.*` 治理 | 设计要求受控标签体系 | 当前仅消费 `attributes` 中 `label.` 前缀，并补少量默认标签 | 后续应建立标签白名单，避免字段膨胀 |
| ES 索引命名 | 讨论稿中更偏 `nexuslog-logs-v2-*` | 当前已统一写入索引为 `nexuslog-logs-v2`，模板 pattern 同时兼容两种写法 | 部署时仍需确认 v2 模板已安装 |
| 前端折叠展示 | 已明确后置 | 当前仍未实现 | 保留到聚类分析模块，不影响本阶段链路 |

---

## 八、默认值与部署说明

| 项 | 默认值 / 当前约定 |
|---|---|
| 默认写入索引 | `nexuslog-logs-v2` |
| 模板匹配模式 | `nexuslog-logs-v2`、`nexuslog-logs-v2-*` |
| Schema 版本 | `2.0` |
| Pipeline 版本 | `2.0` |
| 语义去重窗口 | `10s` |
| 去重策略 | `Agent 短窗去重 + ES sink 语义聚合去重` |
| `event.kind` | `event` |
| `event.category` | `application` |
| `event.type` | `log` |
| `nexuslog.ingest.parse_status` | `success` |
| `nexuslog.governance.pii_masked` | `false` |
| 空日志处理 | 一律丢弃，不入 ES |
| 多行合并 | Agent 优先做；Control-plane 当前主要依赖 Agent 结果 |
| 前端折叠展示 | 本阶段不做 |
| 标签策略 | 当前仅允许 `label.*` 前缀映射到 `labels.*`，并补 `labels.env` |
| 模板安装与校验 | 参考 `docs/runbooks/es-template-v2-install-and-validate.md` |

---

## 九、后续建议优先级

| 优先级 | 建议项 | 原因 |
|---|---|---|
| P1 | 为 Control-plane 补服务名前缀 / 多行合并兜底 | 提升异构 Agent 接入容错 |
| P1 | 在部署流程中显式校验 v2 模板已安装且命中 `nexuslog-logs-v2` | 避免环境漂移导致模板失效 |
| P1 | 将语义去重从进程内缓存升级为共享状态 | 支持多实例 Control-plane |
| P2 | 增强 `error.type` / `error.message` / `trace/http/url` 提取规则 | 提升检索和分析质量 |
| P2 | 建立 `labels.*` 白名单治理 | 避免字段膨胀 |
| P3 | 前端聚类折叠展示 | 属于体验优化，已明确后置 |

---

## 十、字段契约清单

> 本节用于把方案进一步收敛为“可验收的字段契约”。  
> 建议在联调、测试、代码评审时逐项核对，而不是仅凭示例日志人工判断。

### 10.1 Agent 输出契约清单

| 契约项 | 级别 | 当前状态 | 说明 | 验收方式 |
|---|---|---|---|---|
| Pull 顶层必须输出 `batch_id` / `cursor.next` / `cursor.has_more` / `records` | MUST | 已实现 | 不再返回旧顶层字段 | 抓取 Pull API 响应 JSON 检查 |
| Pull 单条记录必须输出 `record_id` / `sequence` / `observed_at` / `body` / `size_bytes` / `source.kind` | MUST | 已实现 | 最小可用字段集 | 随机抽取 5 条记录校验 |
| 服务前缀必须拆出到 `service.name` / `service.instance.id` / `container.name` | MUST | 已实现 | 不能再拼接在正文前缀中作为唯一来源 | 用 `keycloak-1 | xxx` 样例校验 |
| 纯空行、纯空白行必须丢弃 | MUST | 已实现 | 避免无意义噪声进入链路 | 用空行样例回放校验 |
| 仅前缀空行必须丢弃 | MUST | 已实现 | 例如 `keycloak-1 |` | 用容器日志样例回放校验 |
| 多行异常块必须优先在 Agent 合并 | MUST | 已实现 | Java stack trace / `npm error` block | 用多行样例回放校验 |
| Agent 去重命中后必须保留 `dedup.*` 信息 | SHOULD | 已实现 | 至少保留 `count` / `hit` / `window_sec` / `strategy` | 连续重复日志回放校验 |
| 合并前原始日志块应保留在 `original` | SHOULD | 已实现 | 便于排障和验真 | 抽样比对 `body` 与 `original` |
| Pull 协议不得再返回 `next_cursor` / `has_more` / `data` / `timestamp` / `metadata` | MUST NOT | 已实现 | 纯 v2 契约 | JSON Schema / 集成测试校验 |
| Pull 协议不得再出现 `source_v2` | MUST NOT | 已实现 | 统一使用 `source` | Pull 响应字段扫描 |

### 10.2 Control-plane 归一化契约清单

| 契约项 | 级别 | 当前状态 | 说明 | 验收方式 |
|---|---|---|---|---|
| Control-plane 只消费 Agent v2 结构 | MUST | 已实现 | 不再解析 legacy pull 扁平字段 | 单测 / 联调样例校验 |
| 必须统一生成 `event.id` | MUST | 已实现 | 作为链路幂等主键 | 相同输入重复写入不应生成新文档 |
| 必须生成 `nexuslog.dedup.fingerprint` | MUST | 已实现 | 作为语义聚合指纹 | 抽样文档字段校验 |
| 必须生成 `message` 摘要 | MUST | 已实现 | 当前取首个有效非空行 | 用异常块样例校验 |
| 必须补齐 `event.kind` / `event.category` / `event.type` | MUST | 已实现 | 当前默认 `event` / `application` / `log` | 抽样文档字段校验 |
| 必须补齐 `nexuslog.ingest.received_at` / `schema_version` / `pipeline_version` | MUST | 已实现 | 支撑链路可观测与版本演进 | 抽样文档字段校验 |
| `error.type` / `error.message` / `error.stack_trace` 应结构化输出 | SHOULD | 已实现（轻量） | 当前为首行摘要 + 正则 + 特判 | 异常块样例校验 |
| `attributes.*` 应映射到受控上下文字段和 `labels.*` | SHOULD | 已实现（部分） | 当前主要支持 `host.*` / `process.*` / `trace.*` / `http.*` / `url.*` / `label.*` | 抽样文档字段校验 |
| Control-plane 应提供服务名前缀兜底提取 | SHOULD | 未完全实现 | 当前主要依赖 Agent 已拆分结果 | 后续补单测和回放样例 |
| Control-plane 应提供多行兜底合并 | SHOULD | 未完全实现 | 当前默认信任 Agent 结果 | 后续补单测和回放样例 |

### 10.3 ES 文档契约清单

| 契约项 | 级别 | 当前状态 | 说明 | 验收方式 |
|---|---|---|---|---|
| 文档必须写入 `nexuslog-logs-v2` | MUST | 已实现 | 当前默认写入索引 | 查看写入配置与实际索引 |
| ES 模板必须命中 `nexuslog-logs-v2` 和 `nexuslog-logs-v2-*` | MUST | 已实现 | 避免命名差异导致 mapping 漂移 | 按 runbook 执行模板校验 |
| 文档必须包含 `@timestamp` / `message` / `event.id` / `log.level` / `agent.id` | MUST | 已实现 | 最小检索字段集 | ES 抽样查询校验 |
| 文档必须包含 `service.name` 与 `nexuslog.transport.batch_id` | MUST | 已实现 | 支撑服务维度检索与批次追踪 | ES 抽样查询校验 |
| 多行事件必须保留 `event.original` 与 `error.stack_trace` | SHOULD | 已实现 | 保证可读摘要与原文并存 | 异常块样例校验 |
| 去重聚合后必须保留 `nexuslog.dedup.count` / `suppressed_count` | SHOULD | 已实现 | 支撑重复日志分析 | 重复样例校验 |
| 旧扁平字段不得继续写入新索引 | MUST NOT | 已实现 | 避免新旧结构混写 | ES `_source` 抽样检查 |

### 10.4 禁止事项清单

| 禁止项 | 原因 |
|---|---|
| 把服务名继续拼接在 `message` 正文前缀中作为唯一信息来源 | 会影响聚合、检索与展示 |
| 允许空行、空前缀行入 ES | 会制造大量噪声 |
| 新旧 Pull 协议字段混用 | 会导致联调歧义和代码复杂度回潮 |
| 在新索引继续写 legacy 扁平字段 | 会破坏 mapping 稳定性 |
| 在前端展示层再承担日志结构修复责任 | 结构问题应在采集与归一化链路解决 |

---

## 十一、改造任务清单

> 本节把当前方案拆解成可排期、可分工、可验收的任务项。  
> 其中“已完成”项用于沉淀当前基线，“待完成”项用于后续迭代。

### 11.1 已完成基线任务

| 任务 ID | 任务项 | 层级 | 当前状态 | 结果 |
|---|---|---|---|---|
| `NL-LOG-V2-001` | Pull 协议切换为纯 v2 顶层结构 | Agent / CP | 已完成 | 使用 `batch_id` / `agent` / `cursor` / `records` |
| `NL-LOG-V2-002` | Pull 单条记录切换为结构化字段 | Agent / CP | 已完成 | 使用 `source` / `severity` / `service` / `container` / `attributes` / `multiline` / `dedup` / `original` |
| `NL-LOG-V2-003` | 服务名前缀拆分 | Agent | 已完成 | 从正文中拆出 `service.*` 与 `container.name` |
| `NL-LOG-V2-004` | 过滤空行与空前缀行 | Agent | 已完成 | 无意义日志不再入链路 |
| `NL-LOG-V2-005` | 多行异常块合并 | Agent | 已完成 | Java / npm 多行块合并为单事件 |
| `NL-LOG-V2-006` | Agent 第一层短窗去重 | Agent | 已完成 | 保留 `dedup.*` 统计 |
| `NL-LOG-V2-007` | `event.id` 统一生成 | Control-plane | 已完成 | 提供幂等主键 |
| `NL-LOG-V2-008` | ES v2 结构化文档落地 | Control-plane / ES | 已完成 | 默认写入 `nexuslog-logs-v2` |
| `NL-LOG-V2-009` | 第二层语义聚合去重 | Control-plane / ES | 已完成 | ES sink 内 10s 聚合窗口 |
| `NL-LOG-V2-010` | v2 索引模板落地 | ES | 已完成 | 模板兼容 `nexuslog-logs-v2` 与 `nexuslog-logs-v2-*` |

### 11.2 P1 待完成任务

| 任务 ID | 任务项 | 层级 | 优先级 | 交付物 | 验收标准 |
|---|---|---|---|---|---|
| `NL-LOG-V2-101` | Control-plane 服务名前缀兜底提取 | Control-plane | P1 | 兜底解析逻辑 + 单测 + 回放样例 | 即使 Agent 未拆分，仍可补齐 `service.name` / `service.instance.id` |
| `NL-LOG-V2-102` | Control-plane 多行兜底合并 | Control-plane | P1 | fallback merge 逻辑 + 单测 | 漏合并日志进入 CP 后仍可合并为单事件 |
| `NL-LOG-V2-103` | ES 模板安装校验接入部署流程 | ES / 运维 | P1 | 安装与校验步骤脚本化 | 部署时自动确认模板已命中 v2 索引 |
| `NL-LOG-V2-104` | 语义去重升级为共享状态 | Control-plane | P1 | 共享缓存或外部状态方案 | 多实例 Control-plane 下重复日志仍只聚合一次 |

### 11.3 P2 待完成任务

| 任务 ID | 任务项 | 层级 | 优先级 | 交付物 | 验收标准 |
|---|---|---|---|---|---|
| `NL-LOG-V2-201` | 增强 `error.type` / `error.message` 提取规则 | Control-plane | P2 | 多语言 / 多框架规则集 | Java / Go / Node / Python 常见异常类型识别率提升 |
| `NL-LOG-V2-202` | 增强 `trace.*` / `http.*` / `url.*` 自动提取 | Agent / CP | P2 | 新增解析规则与测试样例 | 非透传场景下也能稳定落字段 |
| `NL-LOG-V2-203` | 建立 `labels.*` 白名单治理 | Control-plane / ES | P2 | 白名单规则、校验逻辑、异常处理策略 | `labels.*` 不再无限扩张 |
| `NL-LOG-V2-204` | 补统一字段契约测试集 | Agent / CP / ES | P2 | 契约测试样例与 CI 校验 | 变更后自动发现字段漂移 |

### 11.4 P3 后续任务

| 任务 ID | 任务项 | 层级 | 优先级 | 交付物 | 验收标准 |
|---|---|---|---|---|---|
| `NL-LOG-V2-301` | 前端聚类折叠展示 | Frontend / 分析模块 | P3 | 聚类摘要与折叠视图 | 同类重复异常可折叠查看 |
| `NL-LOG-V2-302` | 高级异常聚类与根因分析 | 分析模块 | P3 | 聚类规则 / 相似度算法 | 重复问题可自动归并到同类簇 |

### 11.5 推荐实施顺序

| 阶段 | 任务 | 目标 |
|---|---|---|
| Phase 1 | `NL-LOG-V2-101` + `NL-LOG-V2-102` | 先补齐 Control-plane 容错，降低异构 Agent 接入风险 |
| Phase 2 | `NL-LOG-V2-103` + `NL-LOG-V2-104` | 再收口部署一致性与多实例去重一致性 |
| Phase 3 | `NL-LOG-V2-201` + `NL-LOG-V2-202` + `NL-LOG-V2-203` | 最后提升字段质量与治理能力 |
| Phase 4 | `NL-LOG-V2-301` + `NL-LOG-V2-302` | 进入展示与分析增强阶段 |

---

## 十二、日志全链路与生命周期（生成 → 采集 → ES → 前端 → 温/冷/归档）

> 本节用于给当前 v2 字段契约补一张“链路全景图”，强调日志不仅要写入 ES，还需要明确：
>
> - 日志从哪里产生
> - 在哪一层进行清洗、合并、去重
> - 什么时候进入告警与分析
> - 多久从热数据迁移到温 / 冷 / 归档
>
> 详细说明与 UML 见：`docs/NexusLog/process/31-log-end-to-end-lifecycle-and-uml.md`

### 12.1 在线主链路

| 阶段 | 核心动作 | 当前实现 |
|---|---|---|
| 日志生成 | 应用 / 容器 / 系统文件写出原始日志 | 已存在 |
| Agent 采集 | 增量读取日志源 | 已实现 |
| Agent 预处理 | 空行过滤、服务拆分、多行合并、短窗去重 | 已实现 |
| Control-plane 执行 | Pull / ACK / NACK / 游标推进 / 批次落库 | 已实现 |
| Control-plane 归一化 | 生成 `event.id`、构建 `LogDocument`、语义去重 | 已实现 |
| ES v2 入库 | 写入 `nexuslog-logs-v2` data stream | 已实现 |
| Query API | 按 v2 字段查询并返回兼容前端的结构 | 已实现 |
| 前端展示 | 实时检索页列表、详情抽屉展示真实日志 | 已实现 |

### 12.2 聚合、去重、告警的推荐放置点

| 能力 | 推荐层级 | 当前状态 |
|---|---|---|
| 多行异常块合并 | Agent | 已实现 |
| 第一层短窗去重 | Agent | 已实现 |
| 第二层语义去重 | Control-plane / ES sink | 已实现 |
| 错误字段结构化 | Control-plane | 已实现（轻量） |
| 规则告警 | ES 落库后独立 evaluator | 已实现 |
| 静默 / 抑制 | 告警引擎层 | 已实现 |
| 聚类分析 / 前端折叠 | Analysis / Frontend | 后续规划 |

### 12.3 存储生命周期

| 阶段 | 默认阈值 | 动作 |
|---|---|---|
| Hot | `0ms` 起 | 实时写入与检索 |
| Warm | `3d` | readonly + shrink + forcemerge + warm 分配 |
| Cold | `30d` | searchable snapshot + cold 分配 |
| Delete | `90d` | `wait_for_snapshot` 后删除 |
| Archive | `90d+` | 对象存储长期归档 |

### 12.4 关键参考文件

- `agents/collector-agent/internal/pullapi/normalize.go`
- `services/control-plane/internal/ingest/executor.go`
- `services/control-plane/internal/ingest/field_model.go`
- `services/control-plane/internal/ingest/es_sink.go`
- `services/control-plane/internal/alert/evaluator.go`
- `services/data-services/query-api/internal/repository/repository.go`
- `apps/frontend-console/src/pages/search/RealtimeSearch.tsx`
- `storage/elasticsearch/ilm/nexuslog-logs-ilm.json`
- `storage/elasticsearch/snapshots/snapshot-policy.json`
- `storage/glacier/archive-policies/archive-policy.yaml`
- `docs/NexusLog/process/31-log-end-to-end-lifecycle-and-uml.md`

---

## 参考实现

- `agents/collector-agent/internal/pullapi/service.go`
- `agents/collector-agent/internal/pullapi/normalize.go`
- `services/control-plane/internal/ingest/agent_pull_mapper.go`
- `services/control-plane/internal/ingest/field_model.go`
- `services/control-plane/internal/ingest/es_sink.go`
- `storage/elasticsearch/index-templates/nexuslog-logs-v2.json`
- `storage/elasticsearch/templates/nexuslog-logs-v2.json`
- `docs/NexusLog/process/24-sdlc-development-process.md`
- `docs/runbooks/es-template-v2-install-and-validate.md`
