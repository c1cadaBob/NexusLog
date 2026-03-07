# 当前项目全量 API 蓝图（MVP~P2）

> 版本：v1.0  
> 基线日期：2026-02-28  
> 文档定位：全项目范围 API 规划总册（不是仅 M1~M3）

## 1. 文档目的

本文件用于回答“API 设计是否覆盖整个项目”这个问题，并给出统一答案：

1. `12-current-project-api-interface-design.md` 负责 M1~M3 当前执行闭环。  
2. 本文件负责 MVP、P1、P2 的全量 API 蓝图与演进边界。  
3. 后续新增域能力（ML/NLP/多租户/边缘/成本）都以本文件为总入口。

## 2. 范围与非范围

### 2.1 本文件覆盖范围

1. 对外同步 API（REST，`/api/v1/*`）。
2. 对内服务接口（gRPC/内部 HTTP）。
3. 异步事件接口（Kafka Topic + Schema 契约 + DLQ/重试）。
4. API 版本与兼容策略、变更门禁、冻结点。

### 2.2 本文件不覆盖

1. 具体代码实现细节（函数级设计）。
2. 数据库 DDL 细粒度字段定义（由迁移脚本与数据设计文档维护）。
3. 非接口层的前端 UI 交互细节。

## 3. 输入基线（统一事实源）

1. 当前执行基线：`06/07/08/09/10/11/12`。
2. 项目前置总规：`.kiro/specs/project-roadmap/requirements.md`、`.kiro/specs/project-roadmap/design.md`。
3. 全量 API 索引：`.kiro/specs/docs/designs/api-design.md`（25 模块，714 接口）。
4. 异步契约事实源：`messaging/kafka/topics/nexuslog-topics.yaml`、`contracts/schema-contracts/*`。

## 4. 当前现实 vs 全量目标

| 维度 | 当前现实（2026-02-28） | 全量目标（MVP~P2） |
|---|---|---|
| API 覆盖 | M1~M3 优先接口已定义在 `12`，部分服务仍占位实现 | 形成全域 API 分层蓝图，覆盖 25 模块能力 |
| 网关路由 | `/api/v1/*` 与 `/api/data/*` 并存 | 全量收敛到统一 `/api/v1/*` 前缀 |
| 数据服务 | `query/audit/export` 仍以最小占位为主 | 按域补齐检索、审计、导出、分析与治理能力 |
| 异步接口 | Topic/Schema 已建目录与配置 | 形成“同步 API + 异步事件”一体契约治理 |

## 5. 全项目 API 分层模型

```text
客户端/第三方
  -> Gateway (OpenResty)
      -> 同步 API: /api/v1/*
          -> api-service / control-plane / query-api / audit-api / export-api / bff-service
          -> P1/P2 扩展域服务（analysis, storage, ops, integration, ml, edge ...）
      -> 异步事件: Kafka Topics
          -> Schema Contracts (Avro/Protobuf/JSON Schema)
          -> DLQ + Retry Policies
```

分层原则：

1. 外部契约统一走 REST。
2. 服务间高频调用优先 gRPC（控制面、任务编排、Agent 管理）。
3. 跨域解耦优先事件驱动（Kafka + Schema Registry）。

## 6. 模块覆盖矩阵（25 模块全景）

说明：

1. “参考接口量”来自 `.kiro/specs/docs/designs/api-design.md`。  
2. “当前覆盖”是指 `12` 已定义并进入 M1~M3 的接口族。  
3. “目标阶段”指该模块在全项目中的主落地阶段。

| 模块 | 模块名称 | 参考接口量 | 目标前缀（蓝图） | 当前覆盖 | 目标阶段 |
|---|---|---:|---|---|---|
| M1 | 日志采集 | 31 | `/api/v1/collector/*`、`/api/v1/ingest/*` | 部分（ingest） | M2/P1 |
| M2 | 日志存储 | 34 | `/api/v1/storage/*` | 未覆盖 | P1 |
| M3 | 日志查询与检索 | 36 | `/api/v1/query/*`、`/api/v1/analysis/*` | 部分（query） | M3/P1 |
| M4 | 日志分析 | 53 | `/api/v1/analysis/*` | 未覆盖 | P1 |
| M5 | 告警与通知 | 35 | `/api/v1/alerts/*`、`/api/v1/notifications/*` | 部分（rules） | M3/P1 |
| M6 | 可视化与报表 | 47 | `/api/v1/dashboard/*`、`/api/v1/reports/*` | 部分（bff/overview） | M3/P1 |
| M7 | 用户与权限管理 | 42 | `/api/v1/security/*` | 部分（users/roles） | M3/P1 |
| M8 | 系统配置与管理 | 41 | `/api/v1/config/*`、`/api/v1/platform/*` | 部分（config 落库） | P1 |
| M9 | 日志安全 | 33 | `/api/v1/audit/*`、`/api/v1/compliance/*` | 部分（audit/logs） | M3/P1 |
| M10 | 性能优化 | 39 | `/api/v1/perf/*`、`/api/v1/cache/*` | 未覆盖 | P1/P2 |
| M11 | 集成与扩展 | 20 | `/api/v1/integrations/*`、`/api/v1/webhooks/*` | 未覆盖 | P1 |
| M12 | 监控与运维 | 41 | `/api/v1/ops/*`、`/api/v1/health/*` | 部分（health） | P1 |
| M13 | 日志生命周期管理 | 17 | `/api/v1/lifecycle/*` | 未覆盖 | P1 |
| M14 | 高可用与容灾 | 33 | `/api/v1/dr/*`、`/api/v1/backup/*` | 未覆盖 | P1 |
| M15 | 企业级功能 | 65 | `/api/v1/enterprise/*` | 未覆盖 | P2 |
| M16 | 高级功能补充 | 122 | `/api/v1/advanced/*` | 未覆盖 | P2 |
| M17 | 备份系统增强 | 12 | `/api/v1/backup/*` | 未覆盖 | P1/P2 |
| M18 | 真实备份集成 | 5 | `/api/v1/storage/backup/*` | 未覆盖 | P1/P2 |
| M19 | 通用日志采集代理 | 8 | `/api/v1/agents/*` | 部分（ingest/packages） | M2/P1 |
| M20 | ML/AI 机器学习框架 | 0（待定义） | `/api/v1/ml/*` | 未覆盖 | P2 |
| M21 | NLP 自然语言处理 | 0（待定义） | `/api/v1/nlp/*` | 未覆盖 | P2 |
| M22 | 多租户架构 | 0（待定义） | `/api/v1/tenants/*` | 未覆盖 | P2 |
| M23 | 边缘计算 | 0（待定义） | `/api/v1/edge/*` | 未覆盖 | P2 |
| M24 | 成本管理 | 0（待定义） | `/api/v1/cost/*` | 未覆盖 | P2 |
| M25 | 数据模型与系统接口 | 0（待定义） | `/api/v1/meta/*`、`/api/v1/contracts/*` | 未覆盖 | P2 |

## 7. 对外同步 API 蓝图（按阶段）

### 7.1 当前执行阶段（M1~M3）

以 `12` 为准，核心前缀：

1. `/api/v1/auth/*`
2. `/api/v1/ingest/*`
3. `/api/v1/query/*`
4. `/api/v1/audit/*`
5. `/api/v1/alerts/*`
6. `/api/v1/security/*`
7. `/api/v1/bff/*`

### 7.2 生产就绪阶段（P1 扩展）

新增重点前缀：

1. `/api/v1/collector/*`
2. `/api/v1/storage/*`
3. `/api/v1/analysis/*`
4. `/api/v1/notifications/*`
5. `/api/v1/config/*`
6. `/api/v1/ops/*`
7. `/api/v1/lifecycle/*`
8. `/api/v1/backup/*`
9. `/api/v1/integrations/*`

### 7.3 增强阶段（P2 扩展）

新增重点前缀：

1. `/api/v1/ml/*`
2. `/api/v1/nlp/*`
3. `/api/v1/tenants/*`
4. `/api/v1/edge/*`
5. `/api/v1/cost/*`
6. `/api/v1/enterprise/*`
7. `/api/v1/advanced/*`

## 8. 异步接口蓝图（Kafka + Schema）

### 8.1 Topic 基线（仓库已存在）

| Topic | 生产者 | 消费者 | 说明 |
|---|---|---|---|
| `nexuslog.logs.raw` | Collector Agent | Parser/Flink | 原始日志输入 |
| `nexuslog.logs.parsed` | Parser/Flink | ES Sink/Query | 结构化日志 |
| `nexuslog.alerts.events` | Alert Engine | Notification Service | 告警事件 |
| `nexuslog.alerts.notifications` | Alert Service | 通知网关 | 通知下发 |
| `nexuslog.audit.logs` | API/Gateway | Audit Pipeline | 审计事件流 |
| `nexuslog.metrics.aggregated` | Flink/Worker | Dashboard/Monitoring | 聚合指标 |
| `nexuslog.dlq.logs` | 各域失败处理器 | Replay/人工处置 | 死信回收 |

### 8.2 Schema 契约基线（仓库已存在）

| 协议 | 路径 | 用途 |
|---|---|---|
| Avro | `contracts/schema-contracts/avro/*.avsc` | 事件主契约 |
| Protobuf | `contracts/schema-contracts/protobuf/*.proto` | 服务间高效序列化 |
| JSON Schema | `contracts/schema-contracts/jsonschema/*.json` | 校验与开放集成 |
| 兼容策略 | `contracts/schema-contracts/compatibility/compatibility-policy.yaml` | CI 兼容门禁 |

### 8.3 DLQ/重试策略基线（仓库已存在）

1. `messaging/dlq-retry/retry-policies/retry-policy.yaml` 定义重试次数、退避策略、不可重试错误。
2. 默认保持 at-least-once 语义，禁止静默丢失。
3. Schema 不兼容类错误直接入 DLQ，不做盲目重试。

## 9. 对内接口蓝图（gRPC/内部 HTTP）

| 域 | 接口形式 | 目标职责 | 现状 |
|---|---|---|---|
| Control Plane 编排 | gRPC + HTTP | 任务调度、状态汇聚、分发控制 | 目录与健康探针已在，业务接口待补齐 |
| Agent 管理 | gRPC | Agent 注册、能力上报、配置下发、回执 | 插件与框架存在，控制面契约需补齐 |
| Data Services 协同 | 内部 HTTP/gRPC | 查询、审计、导出服务间协作 | 以 HTTP 占位为主，后续按性能演进 |
| 可观测汇聚 | 内部 HTTP | 健康、指标、追踪关联 | 已有健康路径，业务指标待完整化 |

## 10. 统一契约规范（全项目适用）

1. URL 版本：统一 `/api/v1/*`，破坏性升级才允许 `v2`。
2. 鉴权模型：`public/session/admin` 三层。
3. 错误模型：统一 `code/message/request_id/details`。
4. 幂等策略：关键写接口需支持 `X-Idempotency-Key`。
5. 分页策略：`page/page_size/sort` + `meta` 返回。
6. 观测要求：网关和服务日志必须可通过 `request_id` 关联。

## 11. 冻结与变更治理

### 11.1 分阶段冻结点

1. Week2：冻结认证接口族。
2. Week4：冻结接入接口族。
3. Week5：冻结检索接口族。
4. Week6：冻结治理接口族。
5. P1 里程碑：冻结 storage/analysis/config/ops 前缀。
6. P2 里程碑：冻结 ml/nlp/tenant/edge/cost 前缀。

### 11.2 变更同步要求

1. 路径或字段变更必须同步更新 `09/10/11/12/13`。
2. 异步事件 Schema 变更必须通过兼容性 CI。
3. CAB 级变更（网关、消息拓扑、主存储策略）必须附回滚方案。

## 12. 与现有文档关系

| 文档 | 角色 |
|---|---|
| `08-current-project-requirements.md` | 需求边界 |
| `09-current-project-design.md` | 架构与流程设计 |
| `10-current-project-tasks.md` | 当前执行任务 |
| `11-current-project-overall-planning.md` | 当前阶段整体规划 |
| `12-current-project-api-interface-design.md` | 当前阶段 API 设计（M1~M3） |
| `13-current-project-full-api-blueprint.md` | 全项目 API 蓝图（MVP~P2） |

## 13. 落地建议（从当前到全量）

1. 先按 `12` 完成 M1~M3 接口闭环，确保可运行可验收。  
2. 在 P1 启动时，将 `M2/M3` 的接口稳定版本沉淀为 OpenAPI 文件并按域拆包。  
3. 以 `模块 -> 前缀 -> 服务 -> 契约文件` 为索引，逐步把 25 模块接口从蓝图转入执行清单。  
4. 每次新增域（例如 ML/NLP）先定义最小接口集，再扩展批量接口，避免一次性过大设计。

## 14. 版本记录

- `v1.0`（2026-02-28）：首次建立全项目 API 蓝图，覆盖 MVP~P2 及同步/异步接口边界。
