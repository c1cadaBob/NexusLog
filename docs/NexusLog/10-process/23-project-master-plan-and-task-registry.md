# NexusLog 项目整体规划与任务登记表

> 版本：v1.0
> 基线日期：2026-03-06
> 上游规格：`.kiro/specs/docs`（25 模块 / 714 API）
> 执行版：`22-full-requirements-and-6week-plan.md`（Phase 1 详细执行）

---

## 1. 项目总览与现状评估

### 1.1 项目使命

NexusLog 是一套企业级日志管理平台，覆盖"采集 → 传输 → 存储 → 分析 → 告警 → 审计 → 可视化"全生命周期，目标为运维团队提供一站式日志观测与运营能力。

### 1.2 核心价值

| 价值维度 | 具体目标 |
|---------|---------|
| 故障定位 | MTTR < 30 分钟，通过告警 + 检索 + 事件流程闭环加速排障 |
| 安全合规 | 操作审计可追溯、日志脱敏、权限隔离、数据保留策略 |
| 运维效率 | 多源采集自动化、阈值告警自动通知、事件 SLA 看板 |
| 成本控制 | 热/温/冷分层存储、日志过滤减少传输与存储开销 |

### 1.3 技术架构现状

```text
┌───────────────────── 前端 ─────────────────────┐
│  React 19 + AntD + Zustand + ECharts            │
│  60 个页面（~90% mock）、HashRouter、懒加载       │
└──────────────────────┬──────────────────────────┘
                       │ /api/v1/*
              ┌────────┴────────┐
              │  Gateway (Nginx) │
              └────────┬────────┘
    ┌─────────┬────────┼────────┬──────────┐
    │         │        │        │          │
 api-service  CP    query-api  audit-api  export-api
 (认证)    (控制面) (检索)    (占位)     (占位)
    │         │        │
    └─────────┴────────┴────── PostgreSQL
                       │
              ┌────────┴────────┐
              │  Elasticsearch   │
              └─────────────────┘
                       │
              ┌────────┴────────┐
              │ collector-agent  │ × N 台
              │ (文件采集+PullAPI)│
              └─────────────────┘
```

> **网关路径映射说明**：前端通过 Nginx 网关访问各服务，路径映射如下：
> - `/api/v1/auth/*`, `/api/v1/users/*` → `api-service`
> - `/api/control/*` → `control-plane`（内部路径 `/api/v1/ingest/*` 等，网关转发时去掉 `/api/control` 前缀）
> - `/api/v1/query/*` → `query-api`
> - `/api/v1/health/*` → `health-worker`
> 
> 本文档中 API 路径均为**网关视角**（即前端调用路径），实际服务内部路径可能不同。

### 1.4 已完成能力清单

| 能力 | 状态 | 代码位置 |
|------|------|---------|
| 认证闭环（注册/登录/刷新/退出/重置） | 完成 | `api-service` |
| 网关统一路由 `/api/v1/*` | 完成 | `gateway/openresty` |
| 数据库迁移框架（000001~000017） | 完成 | `storage/postgresql/migrations` |
| 前端页面骨架（60 页面 + 侧边栏 + 路由守卫） | 完成 | `apps/frontend-console` |
| Pull 控制面（sources/tasks/packages/receipts/dead-letters） | 部分 | `control-plane/internal/ingest` |
| Control-Plane PG 降级为内存模式（`INGEST_STORE_ALLOW_FALLBACK`） | 完成 | `control-plane/cmd/api/main.go` |
| Control-Plane gRPC 健康检查 | 完成 | `control-plane/cmd/api/main.go` |
| 拉取延迟监控（P95/P99 阈值 + 冷却期 + 快照查询） | 完成 | `latency_monitor.go` |
| Agent 文件采集 + Pull API + checkpoint | 部分 | `collector-agent` |
| Agent Kafka 兼容链路（pull+kafka 双模式） | 骨架 | `collector-agent/cmd/agent/main.go` |
| Agent 路径标签规则（PathLabelRule） | 完成 | `collector/internal/collector/collector.go` |
| Agent fsnotify 事件触发采集 | 完成 | `collector.go` |
| Agent Syslog 采集类型定义 | 骨架 | `collector.go:SourceTypeSyslog` |
| Agent gRPC/WASM 插件框架 | 骨架 | `plugins/grpc/`、`plugins/wasm/` |
| Agent 磁盘重试缓存（at-least-once） | 完成 | `pipeline/`、`retry/` |
| 日志检索 API（ES 全文搜索 + 历史 + 收藏） | 部分 | `query-api` |
| Docker Compose 编排 + 热更新 | 完成 | `docker-compose*.yml` |
| CI/CD 流水线（backend/frontend/docker） | 完成 | `.github/workflows` |
| 监控配置（Prometheus/Grafana/Alertmanager/Jaeger） | 配置已备 | `observability/` |

### 1.5 25 模块 vs 代码实现 映射总览

| Spec 模块 | 代码组件 | 覆盖度 |
|-----------|---------|--------|
| M1 日志采集 | `collector-agent` | 40% — 文件采集 + checkpoint + critical/normal 双通道 + fsnotify + 路径标签 + 磁盘重试；缺加密/压缩/去重/级别检测 |
| M2 日志存储 | `es_sink.go` | 20% — 基础写入，无 ILM/备份/分层 |
| M3 日志分析 | 无 | 0% |
| M4 告警与响应 | `latency_monitor.go` | 10% — 拉取延迟监控（P95/P99 + 冷却期 + 快照查询）；缺规则引擎/通知渠道 |
| M5 分布式追踪 | Jaeger 配置已备 | 5% |
| M6 可视化与报告 | 前端页面骨架 | 15% — 页面存在但 mock |
| M7 安全与访问控制 | `api-service` 认证 | 25% — 认证完成，无 RBAC |
| M8 合规与审计 | `audit-api` 占位 | 5% |
| M9 高可用与灾备 | `health-worker` | 10% |
| M10 性能与扩展 | Prometheus 配置 | 10% |
| M11 自动化运维 | Helm chart、CI/CD | 15% |
| M12 API 与集成 | 各服务 REST API | 20% |
| M13 用户体验 | 前端框架 | 20% |
| M14 协作与工作流 | 无 | 0% |
| M15 企业级特性 | 无 | 0% |
| M16 高级功能 | 无 | 0% |
| M17 备份系统增强 | 无 | 0% |
| M18 真实备份集成 | 无 | 0% |
| M19 通用日志采集代理 | `collector-agent` 骨架 | 25% — Kafka 双模式 + gRPC/WASM 插件框架 + Syslog 类型定义 |
| M20 ML/AI | 无 | 0% |
| M21 NLP | 无 | 0% |
| M22 多租户 | `X-Tenant-ID` header | 10% |
| M23 边缘计算 | 无 | 0% |
| M24 成本管理 | 无 | 0% |
| M25 数据模型与系统接口 | PG + ES schema | 15% |

---

## 2. 25 模块全景图与优先级矩阵

| 优先级 | 模块编号 | 模块名称 | Spec 来源 | 实现状态 | 所属阶段 | 前端页面数 |
|--------|---------|---------|-----------|---------|---------|-----------|
| **P0** | M1 | 日志采集 | `requirements-module1` | 部分 | Phase 1 | 4 |
| **P0** | M2 | 日志存储 | `requirements-module2` | 部分 | Phase 1 | 4 |
| **P0** | M4 | 告警与响应 | `requirements-module4` | 未开始 | Phase 1 | 4 |
| **P0** | M6 | 可视化与报告 | `requirements-module6` | 骨架 | Phase 1 | 4 |
| **P0** | M7 | 安全与访问控制 | `requirements-module7` | 部分 | Phase 1 | 4 |
| **P0** | M17 | 备份系统增强 | `requirements-module17` | 未开始 | Phase 1 | 1 |
| **P0** | M18 | 真实备份集成 | `requirements-module18` | 未开始 | Phase 1 | 1 |
| **P0** | M25 | 数据模型与系统接口 | `requirements-module25` | 部分 | Phase 1 | 0 |
| **P1** | M3 | 日志分析 | `requirements-module3` | 未开始 | Phase 2 | 3 |
| **P1** | M8 | 合规与审计 | `requirements-module8` | 占位 | Phase 2 | 2 |
| **P1** | M10 | 性能与扩展 | `requirements-module10` | 配置备 | Phase 2 | 4 |
| **P1** | M12 | API与集成 | `requirements-module12` | 部分 | Phase 2 | 4 |
| **P1** | M13 | 用户体验 | `requirements-module13` | 骨架 | Phase 2 | 0 |
| **P1** | M19 | 通用日志采集代理 | `requirements-module19` | 骨架 | Phase 2 | 0 |
| **P2** | M5 | 分布式追踪与诊断 | `requirements-module5` | 配置备 | Phase 3 | 3 |
| **P2** | M9 | 高可用与灾备 | `requirements-module9` | 部分 | Phase 3 | 2 |
| **P2** | M11 | 自动化运维 | `requirements-module11` | 部分 | Phase 3 | 0 |
| **P2** | M14 | 协作与工作流 | `requirements-module14` | 未开始 | Phase 3 | 0 |
| **P2** | M22 | 多租户架构 | `requirements-module22` | 部分 | Phase 3 | 0 |
| **P3** | M15 | 企业级特性 | `requirements-module15` | 未开始 | Phase 4 | 0 |
| **P3** | M16 | 高级功能 | `requirements-module16` | 未开始 | Phase 4 | 0 |
| **P3** | M20 | ML/AI 机器学习框架 | `requirements-module20` | 未开始 | Phase 4 | 1 |
| **P3** | M21 | NLP 自然语言处理 | `requirements-module21` | 未开始 | Phase 4 | 0 |
| **P3** | M23 | 边缘计算 | `requirements-module23` | 未开始 | Phase 4 | 0 |
| **P3** | M24 | 成本管理 | `requirements-module24` | 未开始 | Phase 4 | 3 |

---

## 3. 前端页面 — 后端 API — 数据表 覆盖矩阵

### 3.1 P0 页面（Phase 1 必须接入真实 API）

| 页面 | 路由 | 所需后端 API | 所需数据表 | 当前状态 |
|------|------|-------------|-----------|---------|
| Dashboard | `/` | `GET /api/v1/query/stats/overview` | ES 聚合 | mock |
| RealtimeSearch | `/search/realtime` | `POST /api/v1/query/logs` | ES | 已接入 |
| SearchHistory | `/search/history` | `GET/DELETE /api/v1/query/history` | `query_histories` | 已接入 |
| SavedQueries | `/search/saved` | `CRUD /api/v1/query/saved` | `saved_queries` | 已接入 |
| AlertList | `/alerts/list` | `GET /api/v1/alert/events` | `alert_events` | mock |
| AlertRules | `/alerts/rules` | `CRUD /api/v1/alert/rules` | `alert_rules` | mock |
| NotificationConfig | `/alerts/notifications` | `CRUD /api/v1/notification/channels` | `notification_channels` | mock |
| IncidentList | `/incidents/list` | `GET /api/v1/incidents` | `incidents` | mock |
| IncidentDetail | `/incidents/detail/:id` | `GET /api/v1/incidents/:id` | `incidents` + `incident_timeline` | mock |
| IncidentTimeline | `/incidents/timeline` | `GET /api/v1/incidents/:id/timeline` | `incident_timeline` | mock |
| IncidentArchive | `/incidents/archive` | `PUT /api/v1/incidents/:id` (close) | `incidents` | mock |
| SourceManagement | `/ingestion/sources` | `CRUD /api/v1/ingest/pull-sources` | `ingest_pull_sources` | 后端已就绪，待前端接入 |
| AgentManagement | `/ingestion/agents` | `GET /api/v1/ingest/pull-sources` (按 agent 分组) | `ingest_pull_sources` + `agent_pull_auth_keys` | mock |
| BackupRecovery | `/storage/backup` | `GET/POST /api/v1/backup/snapshots` | ES snapshot API | mock |
| PerformanceMonitoring | `/performance/monitoring` | `GET /api/v1/metrics/servers` | `server_metrics` | mock |
| DownloadRecords | `/reports/downloads` | `GET/POST /api/v1/export/jobs` | `export_jobs` | mock |
| UserManagement | `/security/users` | `CRUD /api/v1/users` | `users` + `user_roles` | mock |
| RolePermissions | `/security/roles` | `GET /api/v1/roles` | `roles` | mock |
| LoginPage | `/login` | `POST /api/v1/auth/login` | `users` + `user_sessions` | 已接入 |
| RegisterPage | `/register` | `POST /api/v1/auth/register` | `users` | 已接入 |
| ForgotPasswordPage | `/forgot-password` | `POST /api/v1/auth/password/reset-request`, `POST .../reset-confirm` | `users` + `password_reset_tokens` | 已接入 |

### 3.2 P1 页面（Phase 2 接入真实 API）

| 页面 | 路由 | 所需后端 API | 当前状态 |
|------|------|-------------|---------|
| AggregateAnalysis | `/analysis/aggregate` | `POST /api/v1/query/stats/aggregate` | mock |
| AnomalyDetection | `/analysis/anomaly` | `GET /api/v1/analysis/anomalies` | mock |
| LogClustering | `/analysis/clustering` | `POST /api/v1/analysis/clusters` | mock |
| SilencePolicy | `/alerts/silence` | `CRUD /api/v1/alert/silences` | mock |
| IncidentAnalysis | `/incidents/analysis` | `GET /api/v1/incidents/:id/analysis` | mock |
| IncidentSLA | `/incidents/sla` | `GET /api/v1/incidents/sla/summary` | mock |
| SourceStatus | `/ingestion/status` | `GET /api/v1/ingest/pull-sources/status` | mock |
| AccessWizard | `/ingestion/wizard` | `POST /api/v1/ingest/wizard/*` | mock |
| FieldMapping | `/parsing/mapping` | `CRUD /api/v1/parsing/mappings` | mock |
| ParsingRules | `/parsing/rules` | `CRUD /api/v1/parsing/rules` | mock |
| MaskingRules | `/parsing/masking` | `CRUD /api/v1/parsing/masking-rules` | mock |
| FieldDictionary | `/parsing/dictionary` | `GET /api/v1/parsing/dictionary` | mock |
| IndexManagement | `/storage/indices` | `GET /api/v1/storage/indices` | mock |
| LifecyclePolicy | `/storage/ilm` | `GET/PUT /api/v1/storage/ilm-policies` | mock |
| CapacityMonitoring | `/storage/capacity` | `GET /api/v1/storage/capacity` | mock |
| AuditLogs | `/security/audit` | `GET /api/v1/audit/logs` | mock |
| LoginPolicy | `/security/login-policy` | `GET/PUT /api/v1/security/login-policy` | mock |
| HealthCheck | `/performance/health` | `GET /api/v1/health/status` | mock |
| ReportManagement | `/reports/management` | `CRUD /api/v1/reports/definitions` | mock |

### 3.3 P2/P3 页面（Phase 3/4，API 未开发前保持 mock，功能完成时必须完全去除）

| 页面 | 路由 | 所属阶段 |
|------|------|---------|
| TraceSearch | `/tracing/search` | Phase 3 |
| TraceAnalysis | `/tracing/analysis` | Phase 3 |
| ServiceTopology | `/tracing/topology` | Phase 3 |
| AutoScaling | `/performance/scaling` | Phase 3 |
| DisasterRecovery | `/performance/dr` | Phase 3 |
| ScheduledTasks | `/reports/scheduled` | Phase 3 |
| WebhookManagement | `/integration/webhook` | Phase 3 |
| ApiDocs | `/integration/api` | Phase 3 |
| SdkDownload | `/integration/sdk` | Phase 4 |
| PluginMarket | `/integration/plugins` | Phase 4 |
| CostOverview | `/cost/overview` | Phase 4 |
| BudgetAlerts | `/cost/budgets` | Phase 4 |
| OptimizationSuggestions | `/cost/optimization` | Phase 4 |
| SystemParameters | `/settings/parameters` | Phase 2 |
| GlobalConfig | `/settings/global` | Phase 2 |
| ConfigVersions | `/settings/versions` | Phase 3 |
| QuerySyntax | `/help/syntax` | Phase 2 |
| FAQ | `/help/faq` | Phase 2 |
| TicketPortal | `/help/tickets` | Phase 4 |

---

## 4. 分阶段实施路线图

```text
Phase 1 (Week 1~6): MVP 最小通路
├── M1  采集入库（加密 / 压缩 / 去重 / 级别检测 / 字段分层）
├── M2  存储基础（ES 写入规范 / 备份恢复 / 导出下载）
├── M4  告警基础（规则引擎 / 邮箱 + 钉钉通知 / 资源阈值告警）
├── M6  可视化核心（Dashboard 真实数据 / 日志检索增强）
├── M7  安全核心（RBAC 三角色 / 权限中间件 / 用户管理）
├── M17/M18 备份恢复（ES snapshot / 导出 CSV/JSON）
└── M25 数据模型与系统接口（新增 10 张表 / 字段规范）

Phase 2 (Week 7~10): 功能增强
├── M3  日志分析（聚合 / 异常检测 / 聚类）
├── M8  审计合规（操作审计完整化 / 合规报告）
├── M10 性能优化（ES 查询优化 / 连接池 / bulk 分片）
├── M12 API 标准化（统一响应 / 错误码 / 限流 / OpenAPI）
├── M13 UX 提升（虚拟滚动 / 实时推送 / 国际化基础）
├── M19 Agent 增强（Syslog / 多行合并 / 过滤路由）
└── 解析引擎（Grok / 字段字典 / 脱敏规则）

Phase 3 (Week 11~14): 可观测性与运维
├── M5  分布式追踪（OpenTelemetry / Jaeger 对接）
├── M9  高可用灾备（ES 多节点 / 故障转移）
├── M11 自动化运维（Helm 部署 / 健康自愈 / 配置热更新）
├── M14 协作工作流（事件评论 / @通知 / 任务看板）
└── M22 多租户基础（RLS / 租户隔离 / 配额）

Phase 4 (Week 15+): 企业级与高级功能
├── M15 企业特性（跨云 / K8s 深度集成 / IoT）
├── M16 高级功能（事件关联 / 语义分析 / 数据血缘）
├── M20 ML/AI（异常检测模型 / 根因推荐）
├── M21 NLP（自然语言查询 / LLM API 对接）
├── M23 边缘计算（边缘 Agent / MQTT / 断点续传）
└── M24 成本管理（用量追踪 / 预算告警 / 优化建议）
```

### 4.1 阶段目标与验收门

| 阶段 | 核心目标 | 验收门禁 |
|------|---------|---------|
| Phase 1 | 一条日志从产生到入库到查询到告警到事件归档的完整闭环 | 见 `22` 文档第 7 节验收清单（8 大类 26 项） |
| Phase 2 | 日志可分析、操作可审计、API 标准化、采集多协议 | 聚合分析可用、审计日志可查、OpenAPI 文档可访问 |
| Phase 3 | 追踪链路可视化、系统高可用、运维自动化 | Trace 搜索可用、故障转移演练通过、Helm 部署成功 |
| Phase 4 | 智能化与企业级 | ML 异常检测上线、NLP 查询可用、多租户计费 |

### 4.2 日志流程审计 7 步闭环映射

用户核心需求之一是完整的错误处理审计链路。以下展示这 7 步如何映射到系统模块和 API：

```text
① 目标服务器对日志进行打包
   └─ Agent 文件采集 + 级别检测 + 压缩加密（W1-B1~B7）
   └─ API: POST /agent/v1/logs/pull

② 日志服务器拉取日志
   └─ Control-Plane 定时拉取 + 解密验签（W1-B4）
   └─ API: POST /api/v1/ingest/pull-tasks/run

③ 按服务预设的告警级别进行告警
   └─ 告警评估引擎扫描 ES + 规则匹配（W2-B5）
   └─ 通知渠道分发（邮箱/钉钉/短信）（W2-B6~B7）
   └─ API: GET /api/v1/alert/events

④ 分析日志原因
   └─ 事件创建 + 运维人员查看日志详情（W3-B1）
   └─ API: GET /api/v1/incidents/:id, POST /api/v1/query/logs

⑤ 运维人员响应的时间
   └─ 事件确认操作 → 记录 acknowledged_at（W3-B2）
   └─ SLA 响应时间计算（W3-B4）
   └─ API: POST /api/v1/incidents/:id/acknowledge

⑥ 解决问题的时间
   └─ 事件解决操作 → 记录 resolved_at + 根因分析（W3-B2）
   └─ SLA 处理时间计算（W3-B4）
   └─ API: POST /api/v1/incidents/:id/resolve

⑦ 运维人员对错误的研判 + 全流程归档
   └─ 事件关闭操作 → 填写研判结论（verdict）+ 解决方案（resolution）
   └─ 时间线完整记录 → 归档（W3-B2）
   └─ API: POST /api/v1/incidents/:id/close
```

**关键表**：`incidents`（含 `acknowledged_at`/`resolved_at`/`closed_at`/`root_cause`/`resolution`/`verdict`）、`incident_timeline`（逐步操作日志）。

### 4.3 前后端并行开发策略

| 策略 | 说明 |
|------|------|
| API 先行 | 后端先输出 API 接口定义（路径 + 请求/响应结构），前端据此开发 |
| Mock Server | 前端使用 `msw`(Mock Service Worker) 或本地 mock 文件在 API 未就绪时开发 |
| 接口契约冻结 | 每周五冻结本周 API 契约；变更需双方同步 |
| 联调窗口 | 每周预留 1 天联调时间，解决前后端对接问题 |
| 增量去 mock | 后端 API 上线一个，前端即替换对应 mock |
| 环境隔离 | 前端 `DEV` 连 mock，`STAGING` 连真实后端 |
| 前端降级 | query 相关页面（SearchHistory/SavedQueries）在后端不可用时自动回退到 localStorage 本地存储，保证基本可用 |

### 4.4 容量规划初步估算

基于 10 台目标服务器、每台每日 500MB 日志的典型场景：

| 资源 | Phase 1 估算 | Phase 3+ 估算 | 说明 |
|------|-------------|-------------|------|
| 日志产生量 | ~5GB/日 | ~50GB/日（100 台） | 线性扩展 |
| ES 存储（7 天保留） | ~35GB | ~350GB | 含副本 ×2 |
| ES 存储（30 天保留） | ~150GB | ~1.5TB | Phase 2 引入 ILM |
| 网络带宽（Agent→Server） | ~50Mbps 峰值 | ~500Mbps 峰值 | gzip 压缩后减 50% |
| PG 存储 | < 1GB | < 10GB | 元数据为主 |
| 日志服务器内存 | 4GB+ | 16GB+ | ES JVM heap |
| 日志服务器 CPU | 2 核+ | 8 核+ | ES 索引 + 服务运行 |

> **建议**：Phase 1 最小配置为 4C8G 单节点 + 200GB SSD。Phase 3 起扩展为 3 节点 ES 集群。

---

## 5. Phase 1 详细任务表（Week 1~6）

> 完整执行细节见 `22-full-requirements-and-6week-plan.md`。本节在其基础上补充 Spec 映射、API 编号、验收标准细化和约束条件。

### 5.1 Week 1：采集链路打通

| 任务编号 | 任务 | Spec 映射 | 相关 API | 验收标准 | 约束 |
|---------|------|-----------|---------|---------|------|
| W1-B1 | Agent 日志级别检测（三层策略） | M1 需求 1-5 | - | ES 中 `level` 有值且准确覆盖 `[ERROR]`/`"level":"error"`/独立关键字三种格式；未识别默认 `UNKNOWN` | CPU 增量 < 2% |
| W1-B2 | Agent inode/dev + checkpoint 原子写入 | M1 需求 1-1 | - | 轮转后无漏采；进程 crash 后 offset 正确恢复；checkpoint 损坏不 panic | checkpoint flush 间隔 <= 5s |
| W1-B3 | Agent Pull 响应 gzip 压缩 | M1 需求 1-4 | - | 带宽降低 50%+；小于 1KB 跳过；`X-Compression` 响应头正确 | 压缩耗时 < 10ms/批次 |
| W1-B4 | 加密传输（AES-256-GCM + HMAC） | M7 需求 7-24 | - | 抓包不可见明文；密钥不匹配 NACK + `INGEST_DECRYPT_FAILED`；active/next 轮换窗口均可解密 | 时间窗口 5min 防重放 |
| W1-B5 | ES 五层字段落库 + event_id 幂等 | M25 需求 25-1, M2 需求 2-1 | - | ES 文档含 `agent_id`/`level`/`host`/`collect_time`/`ingested_at`/`schema_version`；`_id=event_id` | 与 `20` 文档第 3 节字段模型一致 |
| W1-B6 | 滑动窗口去重 | M2 需求 2-1 | - | 重拉同批次 ES 文档数不增长；`duplicate_ratio` 指标可查 | 窗口 5 批次；内存 < 50MB |
| W1-B7 | critical/normal 双通道缓冲 | M1 需求 1-2 | - | critical 端到端时延显著低于 normal；缓冲溢出时 critical 不被裁剪 | 缓冲上限 10000 条 |
| W1-B8 | Agent 断线缓冲 + 指数退避重试 | M1 需求 1-1 | - | 网络中断时本地 WAL 缓存最大 1GB；恢复后自动续传；指数退避（初始 1s，最大 5min）；缓存满时丢弃 normal 保留 critical | WAL 文件路径可配置 |
| W1-F1 | RealtimeSearch 级别/来源筛选 | M6 需求 6-20 | `POST /api/v1/query/logs` | 级别下拉可选 DEBUG~FATAL；来源下拉列出已有 agent | 筛选响应 < 3s |
| W1-F2 | 日志详情展开（五层字段） | M6 需求 6-20 | `POST /api/v1/query/logs` | 点击行展开显示 raw/event/transport/ingest/governance 分组 | - |
| W1-F3 | SourceManagement 接入真实 API | M1 需求 1-1 | `CRUD /api/v1/ingest/pull-sources` | 可新增/编辑/禁用采集源；状态实时刷新 | - |
| W1-F4 | AgentManagement 接入真实 API | M1 需求 1-1 | `GET /api/v1/ingest/pull-sources` | 按 agent 分组显示；在线/离线状态可见 | - |
| W1-D1 | 迁移 000018: roles + user_roles | M7 | - | `make db-migrate-up` 成功；种子数据含 admin/operator/viewer | up/down 双向演练 |

### 5.2 Week 2：权限体系 + 告警基础

| 任务编号 | 任务 | Spec 映射 | 相关 API | 验收标准 | 约束 |
|---------|------|-----------|---------|---------|------|
| W2-B1 | 用户 CRUD + 角色分配接口 | M7 需求 7-24 | `CRUD /api/v1/users`, `PUT /api/v1/users/:id/role` | admin 可创建/编辑/禁用用户并分配角色；密码最小 8 位，含大小写+数字+特殊字符中 3 种；连续 5 次失败锁定 15 分钟 | 密码 bcrypt hash；锁定状态记入 `login_attempts` |
| W2-B2 | 权限中间件 | M7 需求 7-24 | 全局中间件 | token → user → role → permission 校验；403 返回统一错误体 | 校验耗时 < 5ms |
| W2-B3 | `/users/me` 接口 | M7 需求 7-24 | `GET /api/v1/users/me` | 返回用户信息 + 角色 + 权限列表 | - |
| W2-B4 | 告警规则 CRUD | M4 需求 4-14 | `CRUD /api/v1/alert/rules` | 支持 keyword/level_count/threshold 三种规则类型 | 规则数上限 1000 |
| W2-B5 | 告警评估引擎（定时扫描 ES） | M4 需求 4-14 | - | 每 30s 扫描一次；匹配规则后 10s 内生成告警事件 | 单次扫描 < 5s |
| W2-B6 | 通知渠道管理 + 邮箱 SMTP | M4 需求 4-14 | `CRUD /api/v1/notification/channels` | 邮箱通知送达；测试发送接口可用 | SMTP TLS 加密 |
| W2-B7 | 钉钉 Webhook 通知 | M4 需求 4-14 | `POST /api/v1/notification/channels/:id/test` | 钉钉群收到告警消息卡片 | Webhook 超时 10s |
| W2-B8 | 操作审计日志中间件 | M8 需求 8-1 | `GET /api/v1/audit/logs` | 登录/退出/创建用户/修改规则等操作自动记录 | - |
| W2-B9 | 告警抑制规则（同源去重） | M4 需求 4-15 | - | 同一规则 + 同一 source 在 5 分钟内不重复生成告警事件；抑制计数可查 | 抑制窗口可配置 |
| W2-F1 | UserManagement 接入真实 API | M7 | `CRUD /api/v1/users` | 用户列表/创建/编辑/角色分配全部真实 | - |
| W2-F2 | RolePermissions 接入真实 API | M7 | `GET /api/v1/roles` | 角色列表展示权限详情 | - |
| W2-F3 | 菜单权限控制 | M7 | `GET /api/v1/users/me` | viewer 看不到管理类菜单项 | - |
| W2-F4 | AlertRules 接入真实 API | M4 | `CRUD /api/v1/alert/rules` | 规则创建/编辑/启用/禁用全部真实 | - |
| W2-F5 | AlertList 接入真实 API | M4 | `GET /api/v1/alert/events` | 告警列表实时刷新；支持状态筛选 | - |
| W2-F6 | NotificationConfig 接入 | M4 | `CRUD /api/v1/notification/channels` | 渠道配置 + 测试发送 | - |
| W2-D1 | 迁移 000019: alert_rules + alert_events + notification_channels + audit_logs | M4, M8 | - | 表创建成功；索引生效 | - |

### 5.3 Week 3：事件管理 + 资源监控

| 任务编号 | 任务 | Spec 映射 | 相关 API | 验收标准 | 约束 |
|---------|------|-----------|---------|---------|------|
| W3-B1 | 事件 CRUD 接口 | M4 需求 4-16 | `CRUD /api/v1/incidents` | 事件创建/列表/详情/更新/归档 | - |
| W3-B2 | 事件状态流转 + 时间线 | M4 需求 4-16 | `POST /api/v1/incidents/:id/acknowledge`, `/resolve`, `/close` | 每次状态变更记录到 `incident_timeline` | 状态机：open→acknowledged→investigating→resolved→closed |
| W3-B3 | 告警自动创建事件 | M4 | - | critical 告警自动创建事件；已有相同 alert 不重复创建 | - |
| W3-B4 | 事件 SLA 统计 | M4 | `GET /api/v1/incidents/sla/summary` | 统计平均响应时间/处理时间/SLA 达标率 | - |
| W3-B5 | Agent 系统资源采集 | M10 需求 10-1 | `GET /agent/v1/metrics` | CPU/内存/磁盘使用率 30s 采集一次 | 采集本身 CPU < 1% |
| W3-B6 | 资源指标上报 + 存储 | M10 | `POST /api/v1/metrics/report` | 指标写入 `server_metrics` 表 | 保留 30 天自动清理 |
| W3-B7 | 资源阈值 + 触发告警 | M10 | `CRUD /api/v1/resource/thresholds` | CPU>80% 时自动触发告警通知 | 复用 M4 通知渠道 |
| W3-B8 | 资源指标查询接口 | M10 | `GET /api/v1/metrics/servers/:agent_id` | 返回指定时间范围的指标序列 | 支持 1h/6h/24h/7d 范围 |
| W3-F1 | IncidentList 接入真实 API | M4 | `GET /api/v1/incidents` | 事件列表支持状态/严重度/时间筛选 | - |
| W3-F2 | IncidentDetail + 时间线 | M4 | `GET /api/v1/incidents/:id` | 完整时间线展示；状态流转按钮可操作 | - |
| W3-F3 | IncidentTimeline 接入 | M4 | `GET /api/v1/incidents/:id/timeline` | 时间线组件展示每个节点 | - |
| W3-F4 | IncidentArchive 接入 | M4 | `PUT /api/v1/incidents/:id` | 归档时必须填写研判结论 | - |
| W3-F5 | PerformanceMonitoring 接入 | M10 | `GET /api/v1/metrics/servers` | 按 agent 分组显示 CPU/内存/磁盘图表 | ECharts 时序图 |
| W3-F6 | HealthCheck 阈值配置 | M10 | `CRUD /api/v1/resource/thresholds` | 阈值 CRUD + 启用/禁用 | - |
| W3-D1 | 迁移 000020: incidents + incident_timeline + server_metrics + resource_thresholds | M4, M10 | - | 表创建成功 | - |

### 5.4 Week 4：导出/备份 + Dashboard

| 任务编号 | 任务 | Spec 映射 | 相关 API | 验收标准 | 约束 |
|---------|------|-----------|---------|---------|------|
| W4-B1 | 日志导出异步任务 | M17 需求 17-3 | `POST /api/v1/export/jobs` | 异步查 ES → 写 CSV/JSON → 存文件 | 单次上限 10 万条 |
| W4-B2 | 导出文件下载 | M17 | `GET /api/v1/export/jobs/:id/download` | 文件可下载；7 天后自动清理 | Content-Disposition |
| W4-B3 | ES snapshot 备份/恢复（含增量） | M18 需求 18-1 | `GET/POST /api/v1/backup/snapshots`, `POST .../restore` | 全量/增量备份均可用；增量基于上次 snapshot 时间戳；备份成功 → 删除索引 → 恢复 → 数据可查；备份可自定义名称和备注 | 备份路径可配置；增量备份依赖 ES snapshot 内置增量机制 |
| W4-B4 | Dashboard 概览统计 | M6 需求 6-20 | `GET /api/v1/query/stats/overview` | 返回日志总量/级别分布/来源 TopN/告警摘要 | ES 聚合查询 < 3s |
| W4-B5 | 自定义聚合分析 | M3 需求 3-1 | `POST /api/v1/query/stats/aggregate` | 按时间/级别/来源聚合 | - |
| W4-B6 | 告警静默策略 | M4 需求 4-15 | `CRUD /api/v1/alert/silences` | 静默期内不发通知但记录告警 | - |
| W4-B7 | 审计日志查询接口 | M8 | `GET /api/v1/audit/logs` | 按用户/动作/时间筛选 | 分页 + 排序 |
| W4-F1 | DownloadRecords 接入 | M17 | `GET/POST /api/v1/export/jobs` | 创建/列表/下载全流程 | - |
| W4-F2 | BackupRecovery 接入 | M18 | `GET/POST /api/v1/backup/snapshots` | 备份列表/触发备份/恢复操作 | - |
| W4-F3 | Dashboard 真实数据 | M6 | `GET /api/v1/query/stats/overview` | 趋势图/饼图/TopN/告警摘要/健康卡片 | 自动刷新 30s |
| W4-F4 | AggregateAnalysis 接入 | M3 | `POST /api/v1/query/stats/aggregate` | 按维度聚合图表 | - |
| W4-F5 | AuditLogs 接入 | M8 | `GET /api/v1/audit/logs` | 审计日志列表 + 筛选 | - |
| W4-F6 | SilencePolicy 接入 | M4 | `CRUD /api/v1/alert/silences` | 静默规则管理 | - |
| W4-D1 | 迁移 000021: export_jobs | M17 | - | 表创建成功 | - |

### 5.5 Week 5：联调测试 + 体验优化

| 任务编号 | 任务 | 验收标准 | 约束 |
|---------|------|---------|------|
| W5-T1 | 采集链路 E2E 测试 | 多源多文件、轮转、压力场景通过 | 10000 条/分钟无丢失 |
| W5-T2 | 告警 E2E 测试 | 规则触发 → 通知送达 → 事件创建 | 30s 内完成 |
| W5-T3 | 事件管理 E2E 测试 | 全流程审计 7 步闭环 | 时间线完整 |
| W5-T4 | 权限 E2E 测试 | 三角色隔离验证 | admin/operator/viewer |
| W5-T5 | 备份恢复 E2E 测试 | 备份 → 删除 → 恢复 → 数据可查 | - |
| W5-B1 | Bug 修复 + 性能优化 | 无 P0 Bug | - |
| W5-B2 | Agent graceful shutdown | flush checkpoint → 等待 pending → 关闭 | 30s 超时 |
| W5-B3 | 敏感信息脱敏 | ES 中不可检索原始 IP/邮箱/手机号 | `pii_masked=true` |
| W5-F1 | 剩余核心页面去 mock | SourceStatus/IncidentSLA/LoginPolicy | - |
| W5-F2 | 错误处理统一 | API 错误提示/网络异常降级 | 统一 toast 组件 |
| W5-F3 | 响应式布局检查 | 移动端底部导航可用 | 断点 768px |
| W5-F4 | UI 细节打磨 | loading/空数据/表单校验 | - |

### 5.6 Week 6：文档 + 部署 + 验收

| 任务编号 | 任务 | 验收标准 |
|---------|------|---------|
| W6-D1 | 部署手册 | Docker Compose 一键部署 + 环境变量说明 |
| W6-D2 | 用户使用手册（含截图） | 覆盖核心功能操作 |
| W6-D3 | 数据库设计文档 | ER 图 + 字段说明 |
| W6-D4 | API 接口文档 | Swagger 或 Markdown |
| W6-P1 | 目标服务器部署 | 全套环境运行 |
| W6-P2 | 冒烟测试 + 参数调优 | 各服务健康检查通过 |
| W6-P3 | 数据备份 + 版本归档 | git tag + DB dump |
| W6-V1 | 全功能验收 | 第 7 节验收清单全部通过 |
| W6-V2 | 答辩材料准备 | PPT + 演示脚本 |

---

## 6. Phase 2 详细任务表（Week 7~10）

### 6.1 M3 日志分析

| 任务编号 | 任务 | Spec 映射 | API | 验收标准 |
|---------|------|-----------|-----|---------|
| P2-M3-01 | ES 聚合分析后端 | M3 需求 3-1 | `POST /api/v1/query/stats/aggregate` | 支持按时间/级别/来源/主机多维聚合 |
| P2-M3-02 | 异常检测（统计方法） | M3 需求 3-2 | `GET /api/v1/analysis/anomalies` | 基于 3-sigma 检测日志量突变 |
| P2-M3-03 | 日志聚类 | M3 需求 3-3 | `POST /api/v1/analysis/clusters` | 相似日志归类，返回 Top 模式 |
| P2-M3-04 | 前端分析页面去 mock | M6 | - | AggregateAnalysis/AnomalyDetection/LogClustering 全接真实 API |

### 6.2 M8 审计合规

| 任务编号 | 任务 | Spec 映射 | API | 验收标准 |
|---------|------|-----------|-----|---------|
| P2-M8-01 | 操作审计完整化 | M8 需求 8-1 | `GET /api/v1/audit/logs` | 覆盖所有写操作（创建/更新/删除/导出/备份） |
| P2-M8-02 | 审计日志导出 | M8 | `POST /api/v1/audit/logs/export` | 按时间范围导出审计日志为 CSV |
| P2-M8-03 | 登录策略配置 | M7 | `GET/PUT /api/v1/security/login-policy` | 密码复杂度/失败锁定/会话超时可配置 |
| P2-M8-04 | 前端审计页面去 mock | M6 | - | AuditLogs/LoginPolicy 全接真实 API |

### 6.3 解析引擎与脱敏

| 任务编号 | 任务 | Spec 映射 | API | 验收标准 |
|---------|------|-----------|-----|---------|
| P2-PARSE-01 | Grok 解析规则引擎 | M1 需求 1-5 | `CRUD /api/v1/parsing/rules` | 支持 Grok 模式解析；可在线测试 |
| P2-PARSE-02 | 字段映射管理 | M1 | `CRUD /api/v1/parsing/mappings` | 原始字段 → 标准字段映射 |
| P2-PARSE-03 | 字段字典 | M25 | `GET /api/v1/parsing/dictionary` | 展示所有已知字段的类型/含义/来源 |
| P2-PARSE-04 | 脱敏规则引擎 | M1 需求 1-3 | `CRUD /api/v1/parsing/masking-rules` | 按正则/字段名脱敏；可在线预览效果 |
| P2-PARSE-05 | 前端解析页面去 mock | M6 | - | FieldMapping/ParsingRules/MaskingRules/FieldDictionary 全接真实 API |

### 6.4 性能优化（M10）

| 任务编号 | 任务 | 验收标准 |
|---------|------|---------|
| P2-PERF-01 | ES 查询优化（索引模板 + 分片策略） | 检索 P95 < 2s |
| P2-PERF-02 | Agent 连接池 + HTTP/2 | 多 Agent 并发无连接耗尽 |
| P2-PERF-03 | ES bulk 分片（>500 条拆分） | 单次 bulk 无超时 |
| P2-PERF-04 | 前端虚拟滚动（日志列表） | 10 万条日志不卡顿 |
| P2-PERF-05 | IndexManagement/LifecyclePolicy/CapacityMonitoring 页面去 mock | 真实数据展示 |

### 6.5 API 标准化（M12）

| 任务编号 | 任务 | 验收标准 |
|---------|------|---------|
| P2-API-01 | 统一响应结构 `{code, message, data, timestamp, request_id}` | 所有 API 一致 |
| P2-API-02 | 统一错误码体系（0/400/401/403/404/409/422/429/500/503） | 错误码文档化 |
| P2-API-03 | API 限流中间件（令牌桶） | 默认 100 req/min/user |
| P2-API-04 | OpenAPI/Swagger 文档生成 | `/api/docs` 可访问 |
| P2-API-05 | ApiDocs 前端页面接入 | 嵌入 Swagger UI |

### 6.6 UX 提升（M13）+ Agent 增强（M19）

| 任务编号 | 任务 | 验收标准 |
|---------|------|---------|
| P2-UX-01 | WebSocket 实时告警推送 | 新告警 2s 内前端弹窗通知 |
| P2-UX-02 | 国际化基础（中英双语） | 菜单/按钮/提示中英可切换 |
| P2-UX-03 | 帮助页面内容填充 | QuerySyntax/FAQ 有实际内容 |
| P2-NOTIFY-01 | SMS 短信通知渠道 | 对接短信网关（阿里云/腾讯云 SMS API）；告警通知可选短信 |
| P2-NOTIFY-02 | 通知渠道容错 | 主渠道失败时自动降级到备用渠道；重试 3 次 |
| P2-AGT-01 | Syslog 采集支持 | UDP/TCP syslog 可收可存 |
| P2-AGT-02 | 多行日志合并 | Java 堆栈合并为单条 |
| P2-AGT-03 | 日志过滤路由引擎 | 按 level/source/keyword 过滤 |

### 6.7 Spec 差距补齐

| 任务编号 | 任务 | Spec 映射 | 验收标准 |
|---------|------|-----------|---------|
| P2-GAP-01 | 负载自适应采集 | M1 需求 1-2 | CPU > 80% 时自动降低非关键日志采集频率 50%；恢复后自动提升 |
| P2-GAP-02 | 异常事件自动提升日志源优先级 | M1 需求 1-2 | 错误率 > 5% 时自动将对应 source 提升为 critical |
| P2-GAP-03 | 告警自动修复操作 | M4 需求 4-16 | 支持配置自动响应规则：服务重启 / Webhook 触发；操作记录到事件时间线 |
| P2-GAP-04 | 自定义仪表盘 | M6 需求 6-21 | 用户可拖拽组件 + 保存布局 + 加载预设模板；至少支持 8 种图表类型 |
| P2-GAP-05 | 合规报告生成 | M8 需求 8-x | 按模板生成合规报告（操作审计摘要 / 权限变更 / 数据访问统计）；支持 PDF 导出 |
| P2-GAP-06 | 用户偏好设置 | M13 需求 13-x | `GET/PUT /api/v1/preferences`；含主题/语言/时区/默认页面/快捷键配置 |

### 6.8 系统设置

| 任务编号 | 任务 | API | 验收标准 |
|---------|------|-----|---------|
| P2-SYS-01 | 系统参数配置 | `GET/PUT /api/v1/settings/parameters` | 可配置采集间隔/ES 索引前缀/日志保留天数等 |
| P2-SYS-02 | 全局配置管理 | `GET/PUT /api/v1/settings/global` | 统一管理全局开关和默认值 |
| P2-SYS-03 | 前端设置页面去 mock | - | SystemParameters/GlobalConfig 全接真实 API |

---

## 7. Phase 3 概要任务表（Week 11~14）

### 7.1 M5 分布式追踪

| 任务编号 | 任务 | 验收标准 |
|---------|------|---------|
| P3-TRACE-01 | OpenTelemetry SDK 集成（各服务埋点） | Trace 数据写入 Jaeger |
| P3-TRACE-02 | Trace 检索 API | `GET /api/v1/tracing/traces` — 按 traceID/服务/时间查询 |
| P3-TRACE-03 | 调用链可视化 | 前端 TraceAnalysis 页面展示火焰图/瀑布图 |
| P3-TRACE-04 | 服务拓扑图 | 前端 ServiceTopology 页面展示服务依赖关系 |
| P3-TRACE-05 | 日志 - Trace 关联 | 日志详情页可跳转到关联 Trace |

### 7.2 M9 高可用与灾备

| 任务编号 | 任务 | 验收标准 |
|---------|------|---------|
| P3-HA-01 | ES 多节点部署（3 节点） | 单节点故障后数据不丢失 |
| P3-HA-02 | PG 主从复制 | 主库故障后从库可读 |
| P3-HA-03 | 服务健康检查增强 | 各服务 `/healthz` + `/readyz` 完善 |
| P3-HA-04 | 故障转移演练 | 有回放脚本和恢复手册 |
| P3-HA-05 | DisasterRecovery 页面去 mock | 灾备状态可视化 |

### 7.3 M11 自动化运维

| 任务编号 | 任务 | 验收标准 |
|---------|------|---------|
| P3-OPS-01 | Helm Chart 完善 | `helm install nexuslog` 一键部署到 K8s |
| P3-OPS-02 | 配置热更新实现 | 修改配置后 30s 内生效 |
| P3-OPS-03 | 配置版本管理 | ConfigVersions 页面展示配置历史和 diff |
| P3-OPS-04 | Agent 远程升级 | 日志服务器下发升级指令 → Agent 自动更新 |

### 7.4 M14 协作工作流

| 任务编号 | 任务 | 验收标准 |
|---------|------|---------|
| P3-COLLAB-01 | 事件评论功能 | 事件详情页可添加评论 |
| P3-COLLAB-02 | @通知 | 评论中 @用户，被 @用户收到通知 |
| P3-COLLAB-03 | Webhook 管理 | 事件状态变更时触发外部 Webhook |

### 7.5 M22 多租户基础

| 任务编号 | 任务 | 验收标准 |
|---------|------|---------|
| P3-MT-01 | PG RLS 策略启用 | 不同租户数据隔离 |
| P3-MT-02 | ES 索引前缀隔离 | 租户 A 无法搜索租户 B 日志 |
| P3-MT-03 | 租户管理 API | `CRUD /api/v1/tenants` |

---

## 8. Phase 4 路线图（规划级）

| 模块 | 方向 | 关键技术 | 前置依赖 |
|------|------|---------|---------|
| M15 企业级特性 | 跨云部署、K8s 深度集成、IoT 设备管理 | Terraform、K8s Operator | Phase 3 完成 |
| M16 高级功能 | 事件关联引擎、语义分析、数据血缘、健康评分 | CEP 引擎、图数据库 | M3/M5 完成 |
| M20 ML/AI | 异常检测模型训练、根因推荐、日志模式学习 | MLflow、ONNX、Flink ML | M3 完成 |
| M21 NLP | 自然语言查询、LLM API 对接、意图识别 | 大模型 API（OpenAI/Deepseek） | M3 完成 |
| M23 边缘计算 | 边缘 Agent、本地缓存、MQTT、断点续传 | MQTT Broker、BoltDB | M1/M19 完成 |
| M24 成本管理 | 用量追踪、成本计算、预算告警、优化建议 | 计量系统、计费引擎 | M22 完成 |

---

## 9. 接口规划总表

### 9.1 Phase 1 接口（80 个）

#### 9.1.1 认证与用户（api-service，已有 + 新增）

| 方法 | 路径 | 说明 | 权限 | 状态 |
|------|------|------|------|------|
| POST | `/api/v1/auth/register` | 注册 | public | 已实现 |
| POST | `/api/v1/auth/login` | 登录 | public | 已实现 |
| POST | `/api/v1/auth/refresh` | 刷新 token | authenticated | 已实现 |
| POST | `/api/v1/auth/logout` | 登出 | authenticated | 已实现 |
| POST | `/api/v1/auth/password/reset-request` | 请求重置密码 | public | 已实现 |
| POST | `/api/v1/auth/password/reset-confirm` | 确认重置密码 | public | 已实现 |
| GET | `/api/v1/users` | 用户列表 | admin | 待实现 |
| POST | `/api/v1/users` | 创建用户 | admin | 待实现 |
| GET | `/api/v1/users/:id` | 用户详情 | admin | 待实现 |
| PUT | `/api/v1/users/:id` | 编辑用户 | admin | 待实现 |
| DELETE | `/api/v1/users/:id` | 禁用用户 | admin | 待实现 |
| PUT | `/api/v1/users/:id/role` | 分配角色 | admin | 待实现 |
| GET | `/api/v1/users/me` | 当前用户信息 + 权限 | authenticated | 待实现 |
| GET | `/api/v1/roles` | 角色列表 | admin | 待实现 |
| GET | `/api/v1/audit/logs` | 操作审计日志 | admin | 待实现 |

#### 9.1.2 采集控制面（control-plane，已有 + 新增）

| 方法 | 路径 | 说明 | 权限 | 状态 |
|------|------|------|------|------|
| GET | `/api/v1/ingest/pull-sources` | 采集源列表 | operator+ | 已实现 |
| POST | `/api/v1/ingest/pull-sources` | 创建采集源 | operator+ | 已实现 |
| PUT | `/api/v1/ingest/pull-sources/:source_id` | 更新采集源 | operator+ | 已实现 |
| GET | `/api/v1/ingest/pull-tasks` | 任务列表 | operator+ | 已实现 |
| POST | `/api/v1/ingest/pull-tasks/run` | 执行任务 | operator+ | 已实现 |
| GET | `/api/v1/ingest/packages` | 包列表 | operator+ | 已实现 |
| POST | `/api/v1/ingest/receipts` | 提交回执 | operator+ | 已实现 |
| POST | `/api/v1/ingest/dead-letters/replay` | 死信重放 | operator+ | 已实现 |
| GET | `/api/v1/ingest/metrics/latency` | 延迟监控 | operator+ | 已实现 |
| GET | `/api/v1/ingest/pull-sources/status` | 采集源状态汇总（在线/离线/采集速率） | operator+ | 待实现 |

#### 9.1.3 告警管理（control-plane，全部新增）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/alert/rules` | 规则列表 | operator+ |
| POST | `/api/v1/alert/rules` | 创建规则 | operator+ |
| GET | `/api/v1/alert/rules/:id` | 规则详情 | operator+ |
| PUT | `/api/v1/alert/rules/:id` | 更新规则 | operator+ |
| DELETE | `/api/v1/alert/rules/:id` | 删除规则 | operator+ |
| PUT | `/api/v1/alert/rules/:id/enable` | 启用规则 | operator+ |
| PUT | `/api/v1/alert/rules/:id/disable` | 禁用规则 | operator+ |
| GET | `/api/v1/alert/events` | 告警事件列表 | operator+ |
| GET | `/api/v1/alert/events/:id` | 告警事件详情 | operator+ |
| POST | `/api/v1/alert/events/:id/resolve` | 手动解决 | operator+ |
| GET | `/api/v1/alert/silences` | 静默策略列表 | operator+ |
| POST | `/api/v1/alert/silences` | 创建静默策略 | operator+ |
| PUT | `/api/v1/alert/silences/:id` | 更新静默策略 | operator+ |
| DELETE | `/api/v1/alert/silences/:id` | 删除静默策略 | operator+ |

#### 9.1.4 通知渠道（control-plane，全部新增）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/notification/channels` | 渠道列表 | admin |
| POST | `/api/v1/notification/channels` | 创建渠道 | admin |
| PUT | `/api/v1/notification/channels/:id` | 更新渠道 | admin |
| DELETE | `/api/v1/notification/channels/:id` | 删除渠道 | admin |
| POST | `/api/v1/notification/channels/:id/test` | 测试发送 | admin |

#### 9.1.5 事件管理（control-plane，全部新增）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/incidents` | 事件列表 | operator+ |
| POST | `/api/v1/incidents` | 手动创建事件 | operator+ |
| GET | `/api/v1/incidents/:id` | 事件详情（含时间线） | operator+ |
| PUT | `/api/v1/incidents/:id` | 更新事件 | operator+ |
| POST | `/api/v1/incidents/:id/acknowledge` | 确认（记录响应时间） | operator+ |
| POST | `/api/v1/incidents/:id/resolve` | 解决（记录处理时间） | operator+ |
| POST | `/api/v1/incidents/:id/close` | 归档（填写研判结论） | operator+ |
| POST | `/api/v1/incidents/:id/timeline` | 添加时间线 | operator+ |
| GET | `/api/v1/incidents/sla/summary` | SLA 统计 | operator+ |

#### 9.1.6 资源监控（control-plane，全部新增）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/v1/metrics/report` | Agent 上报指标 | agent |
| GET | `/api/v1/metrics/servers` | 服务器资源列表 | operator+ |
| GET | `/api/v1/metrics/servers/:agent_id` | 单台指标历史 | operator+ |
| GET | `/api/v1/resource/thresholds` | 阈值配置列表 | admin |
| POST | `/api/v1/resource/thresholds` | 创建阈值 | admin |
| PUT | `/api/v1/resource/thresholds/:id` | 更新阈值 | admin |
| DELETE | `/api/v1/resource/thresholds/:id` | 删除阈值 | admin |

#### 9.1.7 导出与备份（control-plane，全部新增）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/v1/export/jobs` | 创建导出任务 | operator+ |
| GET | `/api/v1/export/jobs` | 导出任务列表 | operator+ |
| GET | `/api/v1/export/jobs/:id` | 导出任务详情 | operator+ |
| GET | `/api/v1/export/jobs/:id/download` | 下载导出文件 | operator+ |
| GET | `/api/v1/backup/snapshots` | 备份列表 | admin |
| POST | `/api/v1/backup/snapshots` | 触发备份 | admin |
| GET | `/api/v1/backup/snapshots/:id` | 备份详情 | admin |
| POST | `/api/v1/backup/snapshots/:id/restore` | 从备份恢复 | admin |
| DELETE | `/api/v1/backup/snapshots/:id` | 删除备份 | admin |
| GET | `/api/v1/backup/snapshots/:id/download` | 备份文件下载（支持断点续传） | admin |
| POST | `/api/v1/backup/snapshots/:id/cancel` | 取消进行中的备份 | admin |

#### 9.1.8 日志检索（query-api，已有 + 新增）

| 方法 | 路径 | 说明 | 权限 | 状态 |
|------|------|------|------|------|
| POST | `/api/v1/query/logs` | 日志检索 | viewer+ | 已实现 |
| GET | `/api/v1/query/history` | 查询历史 | viewer+ | 已实现 |
| DELETE | `/api/v1/query/history/:id` | 删除历史 | viewer+ | 已实现 |
| GET | `/api/v1/query/saved` | 收藏列表 | viewer+ | 已实现 |
| POST | `/api/v1/query/saved` | 创建收藏 | viewer+ | 已实现 |
| PUT | `/api/v1/query/saved/:id` | 更新收藏 | viewer+ | 已实现 |
| DELETE | `/api/v1/query/saved/:id` | 删除收藏 | viewer+ | 已实现 |
| GET | `/api/v1/query/stats/overview` | Dashboard 概览统计 | viewer+ | 待实现 |
| POST | `/api/v1/query/stats/aggregate` | 自定义聚合 | viewer+ | 待实现 |

#### 9.1.9 Agent 接口（collector-agent，已有 + 新增）

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| GET | `/agent/v1/meta` | Agent 元信息 | 已实现 |
| POST | `/agent/v1/logs/pull` | 拉取日志 | 已实现 |
| POST | `/agent/v1/logs/ack` | 确认/回写 checkpoint | 已实现 |
| GET | `/agent/v1/metrics` | 获取系统资源指标 | 待实现 |
| GET | `/healthz` | 健康检查 | 已实现 |
| GET | `/readyz` | 就绪检查 | 已实现 |

### 9.2 Phase 2 接口概要（约 40 个，待细化）

| 分类 | 接口数 | 路径前缀 | 状态 |
|------|--------|---------|------|
| 日志分析 | 5 | `/api/v1/analysis/*` | 待细化 |
| 解析规则 | 8 | `/api/v1/parsing/*` | 待细化 |
| 存储管理 | 6 | `/api/v1/storage/*` | 待细化 |
| API 文档 | 2 | `/api/docs`, `/api/v1/openapi.json` | 待细化 |
| 系统设置 | 4 | `/api/v1/settings/*` | 待细化 |
| 安全策略 | 3 | `/api/v1/security/*` | 待细化 |
| 帮助内容 | 3 | `/api/v1/help/*` | 待细化 |
| Agent 增强 | 3 | `/agent/v1/syslog/*` | 待细化 |
| WebSocket | 2 | `/ws/alerts`, `/ws/logs` | 待细化 |
| 报表 | 5 | `/api/v1/reports/*` | 待细化 |
| 用户偏好 | 2 | `/api/v1/preferences` | 待细化 |
| 合规报告 | 3 | `/api/v1/compliance/*` | 待细化 |

### 9.3 Phase 3/4 接口概要（约 60 个，待规划）

| 分类 | 路径前缀 | 所属阶段 |
|------|---------|---------|
| 追踪 | `/api/v1/tracing/*` | Phase 3 |
| 租户管理 | `/api/v1/tenants/*` | Phase 3 |
| 集成 Webhook | `/api/v1/integration/webhooks/*` | Phase 3 |
| 配置版本 | `/api/v1/settings/versions/*` | Phase 3 |
| ML 模型 | `/api/v1/ml/*` | Phase 4 |
| NLP 查询 | `/api/v1/nlp/*` | Phase 4 |
| 成本管理 | `/api/v1/cost/*` | Phase 4 |

---

## 10. 数据库演进规划

### 10.0 已有迁移基线（000001~000017）

以下迁移已在代码库中就绪，Phase 1 开始前**不需重建**，但需了解其内容以避免重复建表：

| 迁移编号 | 核心表 | 说明 |
|---------|-------|------|
| 000001 | `obs.tenant`, `users`, `roles`, `user_roles`, `alert_rules`, `audit_logs` | 基础数据模型（租户/用户/角色/告警/审计） |
| 000002~000011 | 索引、约束、字段增补 | 基础表的迭代优化 |
| 000012 | `user_sessions`, `password_reset_tokens`, `login_attempts` | 认证相关表 |
| 000013 | `ingest_pull_sources`, `ingest_pull_tasks`, `agent_incremental_packages`, `agent_package_files`, `ingest_delivery_receipts`, `ingest_file_checkpoints`, `ingest_dead_letters` | 采集控制面 7 张核心表 |
| 000014 | `query_histories`, `saved_queries`, `saved_query_tags` | 检索功能相关表 |
| 000015 | `config_namespace`, `config_item`, `config_version`, `config_publish`, `runtime_config_subscription`, `runtime_config_dispatch_log` | 运行时配置中心 |
| 000016 | `user_credentials` | 用户凭证扩展 |
| 000017 | ALTER `ingest_pull_sources`; 新增 `agent_pull_auth_keys`, `agent_pull_batches`, `agent_pull_cursors` | 采集表结构增强 + Agent 认证/批次/游标 |

### 10.1 Phase 1 增量迁移脚本

> 注：`roles`/`user_roles`/`alert_rules`/`audit_logs` 已在 000001 中创建，以下迁移仅包含 **种子数据填充** 和 **新增表**。

| 迁移编号 | 内容 | 阶段 | 周次 |
|---------|------|------|------|
| 000018 | `roles` 种子数据（admin/operator/viewer 三角色 + 权限矩阵） | Phase 1 | W1 |
| 000019 | 新增 `alert_events`, `notification_channels`；`audit_logs` 补充索引 | Phase 1 | W2 |
| 000020 | 新增 `incidents`, `incident_timeline`, `server_metrics`, `resource_thresholds` | Phase 1 | W3 |
| 000021 | 新增 `export_jobs` | Phase 1 | W4 |

完整 DDL 见 `22-full-requirements-and-6week-plan.md` 第 4 章。

### 10.2 Phase 2 迁移预览

| 迁移编号 | 表 | 核心字段 |
|---------|---|---------|
| 000022 | `parsing_rules` | `id, name, type(grok/regex/json), pattern, test_input, enabled` |
| 000023 | `field_mappings` | `id, source_field, target_field, transform_type` |
| 000024 | `masking_rules` | `id, name, pattern, replacement, field_scope, enabled` |
| 000025 | `login_policies` | `id, min_password_length, max_failed_attempts, lockout_duration_min, session_timeout_min` |
| 000026 | `alert_silences` | `id, rule_id, source_pattern, start_at, end_at, reason, created_by` |
| 000027 | `system_parameters` | `id, key, value, description, category, updated_by, updated_at` |

### 10.3 Phase 3 迁移预览

| 迁移编号 | 表 | 说明 |
|---------|---|------|
| 000028 | `tenants` | 多租户管理 |
| 000029 | `tenant_quotas` | 租户资源配额 |
| 000030 | `webhook_configs` | Webhook 配置 |
| 000031 | `incident_comments` | 事件评论 |
| 000032 | `config_versions` | 配置版本历史 |
| 000033 | `agent_versions` | Agent 版本管理 |

---

## 11. 跨模块关注点

### 11.1 安全策略

| 层面 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| 传输加密 | AES-256-GCM + HMAC（Agent↔Server） | TLS 1.3 全链路 | mTLS |
| 认证 | opaque token + bcrypt | JWT 迁移（可选） | OAuth 2.0 / LDAP |
| 授权 | RBAC 三角色 | 模块级细粒度权限 | ABAC + RLS |
| 数据安全 | 日志脱敏基础 | 脱敏规则引擎 | Vault 密钥管理 |
| 审计 | 操作审计中间件 | 审计日志导出 + 合规报告 | 不可变审计日志 |

### 11.2 测试策略

| 测试类型 | Phase 1 | Phase 2 | Phase 3 |
|---------|---------|---------|---------|
| 单元测试 | 核心函数（加密/去重/级别检测） | 解析引擎/告警引擎 | RLS 策略 |
| 集成测试 | 采集 → ES 链路 | 告警 → 通知链路 | 追踪 → Jaeger |
| E2E 测试 | 5 条核心链路（见 W5） | 分析/审计/解析页面 | 追踪/灾备 |
| 性能测试 | - | ES 查询 < 2s；Agent 10k 条/min | 100 Agent 并发 |
| 安全测试 | 权限隔离验证 | SQL 注入/XSS 扫描 | 渗透测试 |
| 覆盖率目标 | 核心模块 > 60% | 整体 > 50% | 整体 > 70% |

### 11.3 技术债务管理

| 类别 | 说明 | 管理方式 |
|------|------|---------|
| 代码技术债 | 临时方案、硬编码、跳过的错误处理 | 每个 Phase 末预留 1 周偿还；记录到 `TECH_DEBT.md` |
| 测试技术债 | 缺失的单元/集成测试 | Phase 2 补充 Phase 1 遗漏的测试 |
| 架构技术债 | 单体化趋势、服务边界模糊 | Phase 3 重构窗口 |
| 文档技术债 | API 文档与实现不同步 | Phase 2 引入 OpenAPI 自动生成 |
| 依赖技术债 | 过期依赖、安全漏洞 | 月度 `go get -u` / `npm audit` |

### 11.4 Agent 注册与发现流程

```text
Agent 启动
  │
  ├─ 1. 读取本地配置（server_url, agent_id, auth_key）
  │
  ├─ 2. 向 Control-Plane 注册
  │     POST /api/v1/ingest/pull-sources
  │     Body: { agent_id, hostname, ip, os, version, capabilities }
  │
  ├─ 3. Control-Plane 分配采集任务
  │     返回 { source_id, files[], pull_interval, encryption_key_id }
  │
  ├─ 4. 心跳保活（每 30s）
  │     GET /agent/v1/meta → Control-Plane 轮询或 Agent 主动上报
  │     超过 3 次未响应 → 标记离线 → 触发告警
  │
  └─ 5. 动态配置更新
        Control-Plane 下发新文件路径/过滤规则 → Agent 热加载
```

### 11.5 监控与告警

```text
                 ┌─────── 基础设施监控 ───────┐
                 │  Prometheus + Grafana       │
                 │  node_exporter, ES exporter │
                 │  服务 /metrics 端点          │
                 └────────────┬───────────────┘
                              │
                 ┌────────────┴───────────────┐
                 │     Alertmanager            │
                 │  基础设施告警（服务宕机等）    │
                 └────────────┬───────────────┘
                              │
         ┌────────────────────┴────────────────────┐
         │           NexusLog 业务告警               │
         │  日志关键词/频率告警（control-plane 评估） │
         │  资源阈值告警（server_metrics 评估）       │
         │  通知渠道：邮箱 / 钉钉 / 短信（预留）     │
         └─────────────────────────────────────────┘
```

基础设施告警（Alertmanager）与业务告警（NexusLog 内置）是两个独立体系，不混用。

### 11.6 部署策略演进

| 阶段 | 部署方式 | 适用场景 |
|------|---------|---------|
| Phase 1 | Docker Compose（单机） | 开发/演示/小规模生产 |
| Phase 2 | Docker Compose + 远程 Agent（systemd） | 中小规模生产 |
| Phase 3 | Kubernetes + Helm | 大规模生产 |
| Phase 4 | K8s + GitOps（ArgoCD） | 企业级 |

#### 发布策略

| 策略 | 适用阶段 | 说明 |
|------|---------|------|
| 直接替换 | Phase 1 | `docker-compose up -d --build`；停机窗口 < 2 分钟 |
| 滚动升级 | Phase 3 | K8s `RollingUpdate`；maxSurge=1, maxUnavailable=0 |
| 蓝绿部署 | Phase 3 | 两套环境切换；适用于数据库迁移等大变更 |
| 金丝雀发布 | Phase 4 | 按百分比逐步放量；通过 Istio/Nginx 权重控制 |
| 快速回滚 | 全阶段 | Phase 1：`git checkout` + `docker-compose up`；Phase 3：`helm rollback` |

#### 版本策略

- 遵循语义版本（SemVer）：`MAJOR.MINOR.PATCH`
- API 向后兼容 2 个大版本（如 v1 API 在 v3 发布前不下线）
- 数据库迁移脚本必须提供 `.up.sql` 和 `.down.sql`

### 11.7 非功能需求基线

#### 11.7.1 性能目标

| 指标 | Phase 1 (MVP) | Phase 2 (增强) | Phase 3+ |
|------|---------------|---------------|----------|
| 日志写入延迟（Agent → ES） | < 2s | < 1s | < 500ms |
| 简单查询响应时间 | < 2s | < 1s | < 500ms |
| 复杂聚合查询响应时间 | < 5s | < 3s | < 2s |
| 告警触发延迟（日志入库 → 通知送达） | < 30s | < 15s | < 10s |
| 查询 QPS | 100 | 1000 | 5000 |
| Agent 单实例采集速率 | 10k 条/min | 50k 条/min | 100k 条/s |
| Agent CPU 占用 | < 5% | < 5% | < 10% |
| Agent 内存占用 | < 100MB | < 200MB | < 500MB |
| ES bulk 写入吞吐 | 5k 条/s | 20k 条/s | 100k 条/s |
| Dashboard 首屏加载 | < 3s | < 2s | < 1s |

#### 11.7.2 可用性目标

| 指标 | Phase 1 | Phase 2 | Phase 3+ |
|------|---------|---------|----------|
| 系统可用性 | 99.9%（年停机 < 8.76h） | 99.95% | 99.99% |
| MTTD（平均检测时间） | < 10 分钟 | < 5 分钟 | < 2 分钟 |
| MTTR（平均恢复时间） | < 30 分钟 | < 15 分钟 | < 10 分钟 |
| RPO（恢复点目标） | 1 小时 | 30 分钟 | 5 分钟 |
| RTO（恢复时间目标） | 4 小时 | 1 小时 | 15 分钟 |

#### 11.7.3 安全要求补充

| 项 | 适用阶段 | 具体要求 |
|---|---------|---------|
| 密码策略 | Phase 1 | 最小 8 位；必须包含大写、小写、数字、特殊字符中的 3 种 |
| 会话超时 | Phase 1 | 默认 30 分钟；Phase 2 可配置（`login_policies` 表） |
| 登录失败锁定 | Phase 1 | 连续 5 次失败后锁定 15 分钟 |
| 密钥轮换周期 | Phase 1 | 推荐 90 天；active/next 双 key 窗口 |
| 审计日志保留 | Phase 1 | 至少 1 年；Phase 3 实现不可篡改审计（追加写入 + hash 链） |
| IP 黑白名单 | Phase 3 | 支持 IP/CIDR 白名单/黑名单 |
| 暴力破解防护 | Phase 3 | 基于 IP 的速率限制 + 账户锁定联动 |

### 11.8 Git 分支策略

```text
main ─────────────────────── 发布分支（tag: v1.0.0, v1.1.0, ...）
  │
  └── develop ──────────── 开发主分支（CI 自动构建）
        │
        ├── feature/W1-B1-level-detect ── 功能分支（命名: feature/{task-id}-{short-desc}）
        ├── fix/W2-B5-alert-scan ──────── 修复分支
        └── release/v1.0 ─────────────── 发布准备分支（冻结 → 测试 → 合入 main）
```

| 规则 | 说明 |
|------|------|
| 分支命名 | `feature/{周次-任务号}-{描述}`、`fix/{周次-任务号}-{描述}`、`release/v{版本}` |
| PR 合并 | 必须通过 CI + 至少 1 人 review（单人项目可自审） |
| 合并策略 | `feature` → `develop`：Squash Merge；`release` → `main`：Merge Commit |
| tag | `main` 每次合入打 tag（`v{major}.{minor}.{patch}`） |

### 11.9 文档策略

| 文档类型 | 交付时间 | 格式 |
|---------|---------|------|
| 部署手册 | Phase 1 W6 | Markdown |
| 用户使用手册 | Phase 1 W6 | Markdown + 截图 |
| API 接口文档 | Phase 2（OpenAPI） | Swagger UI |
| 数据库设计文档 | Phase 1 W6 | Markdown + ER 图 |
| 运维手册 | Phase 3 | Runbook 格式 |
| 架构设计文档 | 已有 `docs/architecture/` | Markdown |

---

## 12. 风险登记册与未考虑事项

### 12.1 已识别风险

| 风险编号 | 风险 | 影响 | 概率 | 应对策略 |
|---------|------|------|------|---------|
| RISK-01 | 单人开发容量不足 | P0 任务延期 | 高 | 砍 P1/P2 保 P0；前后端并行 |
| RISK-02 | ES 性能瓶颈 | 查询/写入超时 | 中 | Phase 2 优化；查询缓存；分片调优 |
| RISK-03 | 加密实现 bug | 日志无法入库 | 中 | 提供 fallback 明文模式开关 |
| RISK-04 | Agent 远程部署失败 | 采集链路不通 | 中 | 预编译二进制 + systemd 双模式 |
| RISK-05 | 前端去 mock 工作量大 | 核心页面未完成 | 高 | 仅去 mock P0 的 20 个页面 |
| RISK-06 | 告警通知渠道不通 | 通知不可达 | 低 | 测试发送接口；多渠道容错 |
| RISK-07 | 数据量增长超预期 | 磁盘/内存不足 | 中 | ILM 策略；日志保留天数可配 |
| RISK-08 | ES 集群不可用 | 写入/查询中断 | 低 | Agent 本地 WAL 缓存；查询降级提示；Phase 3 多节点 |
| RISK-09 | 目标服务器网络中断 | 日志采集停滞 | 中 | Agent 本地缓存 + checkpoint；恢复后自动续传 |
| RISK-10 | 密钥泄露 | 日志明文暴露 | 低 | 密钥不持久化到磁盘；Phase 3 集成 Vault |
| RISK-11 | 前端依赖安全漏洞 | XSS/供应链攻击 | 中 | `npm audit` 周检；依赖锁定 `package-lock.json` |
| RISK-12 | 日志格式碎片化 | 解析失败率高 | 高 | Phase 1 提供 3 种默认 Grok 模式；Phase 2 规则引擎 |

### 12.2 用户未考虑到的事项（补充清单）

以下事项基于 `.kiro/specs/docs` 25 模块规格和工程实践分析得出，按优先级排列：

#### 必须在 Phase 1 同步考虑

| 编号 | 事项 | 说明 | 建议 |
|------|------|------|------|
| EXT-01 | 日志保留策略 | 日志不能无限增长，需配置保留天数和自动清理 | Phase 1 配置 ES ILM（热 7 天 → 删除）；Phase 2 引入温/冷分层 |
| EXT-02 | 数据库连接池管理 | 多服务共享 PG，连接数可能耗尽 | 每服务 `max_open_conns=25`，总计不超过 PG `max_connections` |
| EXT-03 | API 请求追踪（request_id） | 排查问题需要端到端追踪 | 网关层生成 `X-Request-ID`，透传到所有服务和日志 |
| EXT-04 | 错误日志自身的采集 | NexusLog 自身的错误日志也需要被管理 | Agent 同时采集 NexusLog 服务日志 |
| EXT-05 | 时区统一 | 多服务器时区不一致导致日志时间混乱 | 所有时间字段 UTC；前端按用户本地时区展示 |
| EXT-21 | ES 索引命名规范 | 多来源日志混在同一索引中难以管理 | 按来源分索引：`nexuslog-{source_id}-{date}`；统一 index template |
| EXT-22 | 服务优雅降级 | ES/PG 不可用时系统全面崩溃 | 健康检查 → 降级模式（ES 不可用时 Agent 缓存 + 查询提示）|
| EXT-23 | Agent 自身资源限制 | Agent 消耗过多目标服务器资源 | 默认限制 CPU < 5%、内存 < 100MB；可配置 |

#### Phase 2 应考虑

| 编号 | 事项 | 说明 | 建议 |
|------|------|------|------|
| EXT-06 | WebSocket 实时推送 | 告警和日志流需要实时通知，轮询效率低 | Phase 2 实现 `/ws/alerts` 和 `/ws/logs` |
| EXT-07 | 配置版本管理与回滚 | 配置修改无法追溯和回滚 | Phase 2 实现 `config_versions` 表 + diff 展示 |
| EXT-08 | API 限流与熔断 | 无限流时恶意/异常请求可能压垮服务 | Phase 2 实现令牌桶限流（100 req/min/user） |
| EXT-09 | Agent 升级管理 | 远程 Agent 版本漂移导致不兼容 | Phase 2 实现版本检测 + 灰度升级指令 |
| EXT-10 | 数据导入功能 | 从其他日志系统迁移历史数据 | Phase 2 预留 `POST /api/v1/import/logs` |
| EXT-11 | 国际化（i18n） | 前端仅中文硬编码 | Phase 2 引入 react-i18next |
| EXT-12 | 性能基线与压测 | 无基线无法判断优化效果 | Phase 2 建立性能基线（写入 TPS/查询 P95） |

#### Phase 3+ 应考虑

| 编号 | 事项 | 说明 | 建议 |
|------|------|------|------|
| EXT-13 | 多环境管理 | dev/staging/prod 配置隔离 | Phase 3 环境变量 + 配置模板 |
| EXT-14 | 灾难恢复演练 | 有预案但从未演练过 | Phase 3 季度演练制度 |
| EXT-15 | 无障碍访问（a11y） | 满足 WCAG 2.1 AA | Phase 3 前端审计 |
| EXT-16 | 移动端适配深化 | 当前仅有底部导航，核心页面未适配 | Phase 3 响应式重构 |
| EXT-17 | 日志采集的背压机制 | Agent 产生速率超过服务器处理能力时的保护 | Phase 3 令牌桶 + 动态 batch 调整 |
| EXT-18 | 密钥轮换自动化 | 当前 active/next 手动管理 | Phase 3 自动轮换 + Vault 集成 |
| EXT-19 | 监控告警的告警 | Alertmanager 本身故障时的兜底 | Phase 3 PagerDuty/外部看门狗 |
| EXT-20 | 日志采集的容量规划 | 预估日志量 → 存储/带宽/计算资源需求 | Phase 1 起步时应做初步估算 |
| EXT-24 | 备份完整性验证 | 备份是否真的可恢复未知 | Phase 3 定期自动恢复测试 |
| EXT-25 | 平台自身升级策略 | NexusLog 版本升级时的数据迁移和兼容性 | 遵循语义版本；迁移脚本双向兼容 |
| EXT-26 | 日志采集的多样性适配 | 不同日志格式（JSON/文本/Syslog/W3C）需统一处理 | Phase 1 支持纯文本 + JSON 自动检测；Phase 2 增加 Syslog/Grok |
| EXT-27 | 告警风暴抑制 | 大故障时成百上千条告警同时触发淹没运维 | Phase 1 静默策略基础；Phase 2 告警聚合（同源/同类合并） |
| EXT-28 | 操作确认与审批流 | 高危操作（删除备份/禁用用户）需二次确认 | Phase 1 前端二次确认弹窗；Phase 3 审批工作流 |

---

## 13. 日志结构 v2 完成 / 未完成项清单（截至 2026-03-07）

> 本节用于记录 **NexusLog 日志结构重构 v2** 的当前完成状态。结论以 2026-03-07 当天开发环境中的实际运行态核验为准，而不是仅基于代码静态分析。字段契约与实施细节的完整技术口径可继续参考 `docs/PLAN.md` 与 `24-sdlc-development-process.md` 第 13 章。

### 13.1 摘要

当前总体结论如下：

- **v2 主链路已完成并已跑通**
  - `agent → control-plane → ES v2 → query-api → 前端实时检索页`
- **页面已不再以旧测试数据作为主显示来源**
- **ES 已切换为 v2 结构化存储**
- **query-api 与前端详情展示已完成 v2 兼容**
- 仍有少量 **收尾项 / 可优化项**，但 **不阻塞 v2 主链路完成** 的判断

### 13.2 完成项

#### 13.2.1 ES v2 模板与索引结构

- **状态**：已完成
- **结果**：
  - `nexuslog-logs-v2` 模板已安装
  - 当前已解析为 **data stream**
  - backing index 为：
    - `.ds-nexuslog-logs-v2-2026.03.07-000001`
  - 当前 mapping 根字段已包含：
    - `@timestamp`
    - `message`
    - `event`
    - `log`
    - `service`
    - `source`
    - `agent`
    - `nexuslog`
    - `labels`
    - 以及 `container` / `host` / `process` / `http` / `url` / `error` / `trace` / `span` / `request` / `user`

#### 13.2.2 control-plane 写入 ES v2

- **状态**：已完成
- **结果**：
  - control-plane 已成功将真实日志写入 ES v2
  - `exists(event.id)` 当前计数 **> 0**
  - 当前核验值：
    - `event.id` 文档数：`57`
  - 最近 `ingest_pull_tasks` 已连续为：
    - `status=success`

#### 13.2.3 control-plane ES data stream 写入适配

- **状态**：已完成
- **结果**：
  - bulk 写入已适配 data stream 模式
  - 幂等冲突场景下的 `409 version_conflict` 已作为可接受结果处理
  - 避免了此前“v2 文档结构正确，但 ES 全写失败”的情况

#### 13.2.4 query-api 查询逻辑切换到 v2

- **状态**：已完成
- **结果**：
  - `/api/v1/query/logs` 底层已按 v2 嵌套字段查询
  - 仍对前端维持兼容返回结构
  - 顶层返回仍保留：
    - `id`
    - `timestamp`
    - `level`
    - `service`
    - `message`
    - `raw_log`
    - `fields`
  - `fields` 中已补齐 v2-compatible aliases

#### 13.2.5 query-api 兼容字段映射

- **状态**：已完成
- **结果**：
  - 已支持以下兼容输出字段：
    - `event_id`
    - `batch_id`
    - `agent_id`
    - `collect_time`
    - `sequence`
    - `ingested_at`
    - `schema_version`
    - `pipeline_version`
    - `tenant_id`
    - `retention_policy`
    - `pii_masked`
    - `source`
    - `source_path`
    - `host`
    - `env`
    - `method`
    - `statusCode`
    - `traceId`
    - `spanId`
    - `service_name`
    - `service_instance_id`
    - `container_name`
    - `error_type`
    - `error_message`

#### 13.2.6 query-api 兼容筛选翻译

- **状态**：已完成
- **结果**：
  - 仍支持前端当前传法：
    - `filters.level`
    - `filters.service`
  - 已在 query-api 内完成到 v2 字段的翻译
  - 当前已确认：
    - `filters.level=error` 可生效
    - `filters.service=<当前页面展示值>` 可生效

#### 13.2.7 前端实时检索页列表已读取真实数据

- **状态**：已完成
- **结果**：
  - 页面当前显示的已是真实日志
  - 不再显示旧测试数据：
    - `test-service`
    - `Test log message number N`

#### 13.2.8 前端详情抽屉已切换到 v2-compatible 字段

- **状态**：已完成
- **结果**：
  - 详情抽屉当前已正确展示：
    - `event_id`
    - `agent_id`
    - `batch_id`
    - `collect_time`
    - `sequence`
    - `ingested_at`
    - `schema_version`
    - `pipeline_version`
    - `source`
  - 当前浏览器核验中，首条真实日志详情可见：
    - `event_id`
    - `batch_id`
    - `source=/var/log/dnf.log`
    - `schema_version=2.0`
    - `pipeline_version=2.0`

#### 13.2.9 前端本地类型与命中归一化

- **状态**：已完成
- **结果**：
  - 前端已补充本地字段类型
  - 前端命中归一化逻辑已优先读取 query-api 输出的兼容字段
  - 页面不再依赖旧扁平 ES 字段猜测路径

#### 13.2.10 基础可观测性增强

- **状态**：已完成（代码层）
- **结果**：
  - control-plane 已补充 bulk 首个失败 item 的解析能力
  - 当前错误对象已支持输出：
    - `index`
    - `document_id`
    - `status`
    - `error.type`
    - `error.reason`
    - `field`
  - 同时已支持把失败摘要透传到死信 payload

### 13.3 未完成项 / 收尾项

#### 13.3.1 `service.name` 富化未完成

- **状态**：未完成
- **影响级别**：中
- **当前现象**：
  - 当前这批真实日志主要来自：
    - `/var/log/dnf.log`
  - 原始日志中缺少稳定服务语义
  - 页面“服务”列目前回退显示为：
    - `agent.id = 172.29.0.1`
- **结论**：
  - 这不表示 v2 链路未完成
  - 这表示 **字段链路已通，但服务名提取 / 富化能力尚未补齐**
- **后续建议**：
  - 对 file source 增加基于 `source.path` / `source_ref` / source 配置的服务归属规则
  - 或由 source 配置显式声明 `service.name`

#### 13.3.2 陈旧 `running` 任务自动恢复未完成

- **状态**：未完成
- **影响级别**：中
- **当前现象**：
  - 调度器会因为 source 存在 `pending` / `running` 任务而跳过继续入队
  - 本次恢复过程中曾存在陈旧 `running` 任务，需要人工清理
- **结论**：
  - 当前 v2 已可用
  - 但“运维自愈能力”仍未完全收口
- **后续建议**：
  - 为超时未更新的 `running` 任务增加自动回收机制
  - 例如按 `updated_at < now - X` 自动标记为 `failed` / `stale`

#### 13.3.3 bulk 失败新可观测性未做故障注入复验

- **状态**：未完成
- **影响级别**：低
- **当前现象**：
  - 代码层已补充 ES bulk 首失败项解析
  - 但修复后未再主动制造一次 mapping 冲突来验证新报错内容
- **结论**：
  - 实现已在
  - 运行态回归仍缺 1 次故障注入验证

#### 13.3.4 前端筛选控件的完整交互回归未单独留档

- **状态**：未完成
- **影响级别**：低
- **当前现象**：
  - API 层已经验证 `level` / `service` 兼容筛选可用
  - 但浏览器内未逐项完成：
    - 级别下拉筛选
    - 服务 / 来源下拉筛选
    - 多轮自动刷新稳定性
- **结论**：
  - 核心功能已可用
  - UI 交互回归记录仍可补齐

### 13.4 明确不在本期范围

#### 13.4.1 前端聚类折叠展示

- **状态**：不在本期范围
- **说明**：
  - 按既定决策，后续放入聚类分析模块
  - 不属于本次 v2 收口

#### 13.4.2 旧索引兼容 / 双写 / 测试数据迁移

- **状态**：不在本期范围
- **说明**：
  - 本次采用破坏性切换
  - 不做双写
  - 不保留旧测试数据兼容链路

### 13.5 公共接口 / 类型变化现状

#### 13.5.1 保持不变

- HTTP 路由保持不变：
  - `POST /api/v1/query/logs`
- 返回 envelope 保持不变：
  - `code`
  - `message`
  - `data.hits`
  - `meta`

#### 13.5.2 已完成的内部语义升级

- query-api 已切换到底层读取 v2 ES 文档
- `SearchLogHit.fields` 已升级为：
  - **v2-compatible normalized fields**
- 前端 `LogEntry.fields` 已从宽泛 map 收口为更明确的本地字段类型

#### 13.5.3 当前仍保留的兼容策略

- 前端仍可继续传：
  - `filters.level`
  - `filters.service`
- query-api 负责翻译到 v2 字段，无需前端修改请求协议

### 13.6 测试与验收现状

#### 13.6.1 已通过项

**ES / ingest**

- `nexuslog-logs-v2` 已命中 v2 模板
- 当前 ES 已存在 `event.id`
- 最近 ingest 任务已连续成功
- ES 中已存在真实日志文档

**query-api**

- `POST /api/v1/query/logs` 返回 `200`
- 返回 `hits[].fields.event_id`、`fields.batch_id`、`fields.ingested_at`
- `filters.level=error` 可筛出错误日志
- `filters.service=<当前展示值>` 可返回结果

**前端页面**

- 实时检索页已显示真实日志
- 详情抽屉已显示 v2 兼容字段
- 页面不再显示旧测试数据主列表

#### 13.6.2 仍建议补做项

- 浏览器内逐项验证：
  - 级别筛选
  - 服务筛选
  - 自动刷新 3 个周期稳定性
- 故障注入验证：
  - ES mapping 冲突时，任务错误信息是否带首失败详情

### 13.7 浏览器核验证据

#### 13.7.1 目标 URL

- `http://localhost:3000/#/search/realtime`

#### 13.7.2 Console

- 当前新开页面后无运行时报错
- 仅剩 1 条 issue：
  - `A form field element should have an id or name attribute`
- 在一次 reload 过程中曾见：
  - `net::ERR_NETWORK_CHANGED`
- 该问题在重新打开页面后未影响页面正常查询与展示

#### 13.7.3 Network

- 当前页面持续发起真实请求：
  - `POST /api/v1/query/logs`
- 最近有效请求时间：
  - `2026-03-07 10:43:39 UTC`
- 请求返回 `200`
- 返回内容已为真实 v2 派生数据，包括：
  - `_index=.ds-nexuslog-logs-v2-2026.03.07-000001`
  - `event_id`
  - `batch_id`
  - `source=/var/log/dnf.log`
  - `schema_version=2.0`
  - `pipeline_version=2.0`

#### 13.7.4 可复现步骤

1. 打开 `http://localhost:3000/#/search/realtime`
2. 保持空查询并等待自动查询
3. 页面应显示真实日志，如：
   - `dnf.exceptions.RepoError`
   - `source=/var/log/dnf.log`
4. 打开 DevTools Network，查看 `POST /api/v1/query/logs`
5. 返回体中应包含：
   - `event_id`
   - `batch_id`
   - `ingested_at`
   - `schema_version`
   - `pipeline_version`
6. 点击首条日志，详情抽屉应显示上述字段

### 13.8 最终判断

#### 13.8.1 判断 1：v2 是否已经完成？

- **答案**：**是，已完成主链路收口**

#### 13.8.2 判断 2：v2 是否已经达到“零尾项”状态？

- **答案**：**否，还存在收尾项**
- 当前主要尾项：
  - `service.name` 富化
  - 陈旧 `running` 任务自动恢复
  - 故障注入式可观测性复验
  - 前端筛选交互留档回归

### 13.9 显式假设与默认值

- 当前判断基于 **2026-03-07** 的开发环境运行态核验
- 当前真实日志样本主要来自：
  - `/var/log/dnf.log`
- 当前页面“服务”列回退显示 `agent.id` 被视为：
  - **可接受的临时兼容结果**
  - 不是 v2 主链路失败
- 前端聚类折叠展示继续视为后续功能，不纳入本次完成判断
- 不要求恢复旧测试数据，也不要求回退到旧索引结构

---

## 14. 与已有文档的关系

| 文档 | 编号 | 关系 |
|------|------|------|
| 项目开发策略 | `01` | 本文档的方法论基础 |
| 前端页面功能清单 | `04` | 本文档第 3 章覆盖矩阵的输入源 |
| 当前项目整体规划 | `11` | 本文档为其长期扩展版 |
| 日志采集链路规范 | `20` | Phase 1 M1 的技术口径 |
| 日志采集改进任务书 | `21` | Phase 1 W1 任务的代码级分解 |
| 6 周实施规划 | `22` | Phase 1 的详细执行版，本文档引用但不替代 |
| Spec 需求文档 | `.kiro/specs/docs/requirements/` | 本文档的上游需求基线 |
| Spec 设计文档 | `.kiro/specs/docs/designs/` | 本文档的上游设计参考 |
| Spec API 设计 | `.kiro/specs/docs/designs/api-design.md` | 714 个 API 的完整规格 |

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-03-06 | v1.0 | 初始版本。覆盖 25 模块全景图、4 Phase 路线图、Phase 1/2 详细任务表、80+ 接口规划、数据库演进、风险登记 |
| 2026-03-06 | v1.1 | Spec 差距补齐。修正表名/迁移编号/网关路径/覆盖矩阵；补充 Agent 已有能力（Kafka/fsnotify/插件/磁盘重试）；新增已有迁移基线（10.0 节）；补充 Phase 1 断线缓冲/告警抑制/增量备份任务；补充 Phase 2 GAP 任务 6 项；新增非功能需求基线（11.7 节）；新增 Git 分支策略（11.8 节）；完善部署发布/版本策略 |
| 2026-03-07 | v1.2 | 新增“日志结构 v2 完成 / 未完成项清单”（第 13 章）；记录 ES v2 模板、control-plane 写入、query-api/前端 v2 兼容的当前完成状态；补充浏览器核验证据、尾项与不在本期范围说明 |
