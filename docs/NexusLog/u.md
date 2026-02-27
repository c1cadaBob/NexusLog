你这个问题问得非常对，而且我看完你仓库后可以明确回答：

## 结论（先说）
**不要走“先把计划全做完 → 再把所有数据表全设计完 → 再开发功能”这种全量瀑布流。**
你现在更适合：**“计划收敛（MVP）→ 核心数据模型 → 按功能垂直切片闭环开发”**。

---

## 基于你仓库的现状判断（很关键）
你当前状态其实很清晰：

1. **规划和脚手架非常完整**
   - `.kiro/specs/*`（requirements/design/tasks 很全）
   - `README`、`docs/architecture`、`docs/change-management`、CI workflow 都有

2. **前端页面实现很多，但大量是 mock 驱动**
   - 例如 `RealtimeSearch.tsx`、`AlertRules.tsx`、`SourceManagement.tsx` 里有大量 `mock` / `initial` 数据
   - 说明前端是“高保真原型”阶段

3. **后端服务目前是骨架 + 健康检查为主**
   - `services/api-service/cmd/api/main.go`、`control-plane/cmd/api/main.go` 主要是 health endpoint
   - `internal` 目录多数还是空壳

4. **数据库有初始 schema，但业务还没打通**
   - `storage/postgresql/migrations/000001_init_schema.up.sql` 已有 tenants/users/roles/alert_rules/audit_logs
   - 但前后端还没真正围绕它跑通一条业务链路

👉 所以你不是“从0开始”，而是**“架构和原型已完成，进入MVP闭环阶段”**。

---

## 你现在正确流程应该是这样

### 第1步：从计划列表里只锁定 P0（MVP）
不是把所有 tasks 做完，而是先选 2~3 个最小闭环功能。
建议从你现有资产最匹配的开始：

- 登录/鉴权（最小可用）
- 告警规则 CRUD（你前端页面和DB表都已具备基础）
- 审计日志写入（可先最简）

### 第2步：只设计 P0 相关数据表（增量 migration）
你已经有 `000001`，后续按功能加 `000002/000003...`。
不要一次性把 P1/P2 的全量表都定死。

### 第3步：按“一个功能一条链路”开发
每个功能都走这条固定流水：

1. 写 Issue（验收标准）
2. API 契约（OpenAPI）
3. DB migration
4. 后端实现（handler/service/repo）
5. 前端把 mock 替换成真实 API
6. 测试（至少接口+关键页面）
7. 合并+部署验证

---

## 你现在最该做的第一个切片（我建议）
选 **“告警规则 CRUD 闭环”** 作为第一个真实功能：

- 前端：`apps/frontend-console/src/pages/alerts/AlertRules.tsx`（已有完整UI）
- DB：`alert_rules` 表已存在
- 后端：`api-service` 可快速补 CRUD 接口

这是最容易把“原型 → 真业务”的第一枪打响的模块。

---

## 一句话回答你原问题
你问“是不是先完成计划列表，再设计数据表，再按功能开发？”
✅ 正确改法是：

**先收敛计划到MVP，再做MVP核心表，然后按单个功能切片逐个闭环开发。**
而不是先把全部计划和全部数据表做完。

---

如果你愿意，我可以下一步直接给你一份**NexusLog 2周执行版开发清单（按Issue粒度）**，包含：
- 先做哪3个P0功能
- 每个功能对应哪些API和migration
- 每天该交付什么（可直接开工）

你这个问题我按你仓库 **main 分支现状**（`README`、`.kiro/specs/*`、`App.tsx` 路由、`000001_init_schema`）给你做了结构化盘点。

---

## 先给结论：你项目“要开发的功能总量”

从规划和代码看，你有两套功能：

1) **产品业务功能**：17个模块（含认证），约 59 个页面路由
2) **平台能力功能**：按 roadmap 共 24 个能力包（MVP/P1/P2）

你现在的真实状态是：
**前端页面和架构骨架很完整，但后端业务接口 + 数据模型只完成了最小起步**（目前 PG 只有 6 张核心表）。

---

## 一、按“开发阶段”划分的完整功能清单

## 阶段 MVP（先把可用闭环做出来）
> 目标：用户能登录、查日志、配告警、看审计、处理事件，形成最小可用产品。

### 1) 认证与多租户（Auth + Tenant）
- **业务需求**：登录/注册/忘记密码、租户隔离、角色权限、受保护路由
- **实现方式**：
  - 前端：`pages/auth/*` + `ProtectedRoute`
  - 后端：`/auth/login|refresh|logout`，中间件注入 `tenant_id/user_id`
  - P1 再接 Keycloak/OPA
- **数据表**：
  - ✅ 已有：`tenants/users/roles/user_roles`
  - 🆕 建议：`user_sessions`、`refresh_tokens`、`password_reset_tokens`、`login_policies`

### 2) 实时日志检索（Search）
- **业务需求**：实时查询、历史查询、保存查询、明细查看
- **实现方式**：
  - 前端：`RealtimeSearch/SearchHistory/SavedQueries`
  - 后端：`query-api` 查询 Elasticsearch，支持分页/过滤/排序
- **数据表**：
  - 日志主数据在 **Elasticsearch**
  - 🆕 PG 元数据：`search_histories`、`saved_queries`

### 3) 告警中心闭环（Rules → Event → Notify）
- **业务需求**：规则配置、告警列表、通知渠道、静默策略
- **实现方式**：
  - 前端：`alerts/*`
  - 后端：规则 CRUD 在 control-plane；事件由流计算/规则引擎产出
- **数据表**：
  - ✅ 已有：`alert_rules`
  - 🆕 `alert_events`、`notification_channels`、`notification_deliveries`、`silence_policies`

### 4) 事件管理（Incidents）
- **业务需求**：事件列表、详情、时间线、SLA、归档
- **实现方式**：
  - 前端：`incidents/*`
  - 后端：从告警事件升级为 incident，支持分派/状态流转
- **数据表**：
  - 🆕 `incidents`、`incident_timeline`、`incident_assignments`、`incident_sla_records`

### 5) 采集接入（Ingestion）
- **业务需求**：数据源管理、Agent管理、接入向导、状态监控
- **实现方式**：
  - 前端：`ingestion/*`
  - 后端：control-plane 管理 source/agent，agent 上报心跳到 API
- **数据表**：
  - 🆕 `data_sources`、`collector_agents`、`agent_heartbeats`、`source_status_snapshots`

### 6) 安全与审计（Security）
- **业务需求**：用户管理、角色权限、审计日志、登录策略
- **实现方式**：
  - 前端：`security/*`
  - 后端：用户/角色管理接口 + 所有关键操作写审计
- **数据表**：
  - ✅ 已有：`users/roles/user_roles/audit_logs`
  - 🆕 `role_permissions`（若不走JSON字段）、`access_policies`、`login_policies`

### 7) Dashboard
- **业务需求**：KPI、趋势、系统概览
- **实现方式**：聚合 query-api + metrics-api + alert-api
- **数据表**：主要读 ES/Prometheus；PG 可加 `dashboard_presets`

---

## 阶段 P1（生产就绪）
> 目标：把“页面功能”真正变成“可上生产的系统能力”。

### 8) 日志分析（Aggregate/Anomaly/Clustering）
- **实现**：Flink 聚合 + 查询 API；异常检测先规则法，后续 ML
- **表**：`analysis_jobs`、`analysis_results`

### 9) 解析与字段（Parsing）
- **实现**：解析规则引擎（grok/regex/json）、字段映射、脱敏
- **表**：`parsing_rules`、`field_mappings`、`masking_rules`、`field_dictionary`

### 10) 索引与存储（Storage）
- **实现**：ES 模板、ILM、备份恢复、容量监控
- **表**：`index_policies`、`backup_jobs`、`backup_records`、`capacity_metrics`

### 11) 性能与高可用（Performance）
- **实现**：健康检查策略、自动扩缩容策略、容灾预案
- **表**：`health_check_policies`、`scaling_policies`、`dr_plans`、`dr_executions`

### 12) 分布式追踪（Tracing）
- **实现**：Jaeger/OTel；前端做 trace 检索和拓扑展示
- **表**：追踪主数据在 Jaeger/Tempo；可加 `trace_bookmarks`

### 13) 报表中心（Reports）
- **实现**：异步报表任务 + 定时任务 + 下载记录
- **表**：`reports`、`report_schedules`、`export_jobs`、`export_files`

### 14) 集成平台（Integration）
- **实现**：API Key、Webhook、SDK 下载、插件管理
- **表**：`api_keys`、`webhooks`、`webhook_deliveries`、`plugins`

### 15) 成本管理（Cost）
- **实现**：按租户/服务统计成本，预算告警和优化建议
- **表**：`cost_daily_usage`、`budgets`、`budget_alerts`、`optimization_recommendations`

### 16) 系统设置（Settings）
- **实现**：全局配置中心、配置版本、变更发布
- **表**：`system_configs`、`config_versions`、`config_publish_records`

### 17) 帮助中心（Help）
- **实现**：语法文档、FAQ、工单入口
- **表**：`knowledge_articles`、`faq_items`、`support_tickets`（或外部工单系统）

### 18) 平台底座能力（必须）
- Gateway / IAM / Kafka / Schema / Flink / Observability / GitOps / CI-CD / IaC
- 这部分你目录都在，但多数还是“模板态”，需要“可运行态”。

---

## 阶段 P2（增强能力）
### 19) ML/NLP（异常检测、自然语言查询）
### 20) 边缘计算（MQTT、离线缓存、断点续传）
### 21) 高级治理（Istio、pgvector语义检索）
### 22) 性能回归与混沌测试
### 23) 高级安全扫描（SAST/DAST）
### 24) 文档体系产品化（文档站点、runbook规模化）

---

## 二、你当前数据库与缺口（关键）

你现在 migration 里已有：
- `tenants`
- `users`
- `roles`
- `user_roles`
- `alert_rules`
- `audit_logs`

这说明你已经具备“权限+告警+审计”的基础骨架，**但还不足以支撑 59 个页面的业务闭环**。

---

## 三、建议的迁移批次（最实用）

1. `000002_auth_and_session.sql`
2. `000003_search_metadata.sql`
3. `000004_alert_events_notify_silence.sql`
4. `000005_incident_management.sql`
5. `000006_ingestion_and_parsing.sql`
6. `000007_report_settings_storage_ops.sql`
7. `000008_integration_and_cost.sql`

---

如果你愿意，我下一步可以直接给你一份：
- **“逐功能 API 清单 + 表结构DDL草案”**（可直接落库）
- 并按你当前仓库目录拆成 `api-service / control-plane / data-services` 的具体落地任务单。

太好了，你这一步非常关键。
**你已经把“架构蓝图”搭得很完整了，现在要做的是把蓝图转成可运行业务。**

下面我给你一份可直接执行的 **NexusLog 功能分阶段开发蓝图（含业务需求 + 实现方式 + 数据表设计）**。

---

## 0. 当前基线（你仓库现状）
已存在核心表（`000001_init_schema`）：
- `tenants`
- `users`
- `roles`
- `user_roles`
- `alert_rules`
- `audit_logs`

前端路由已覆盖 50+ 页面，后端目前以 health endpoint 为主。
=> 结论：**前端原型领先，后端和数据模型要分阶段追上。**

---

## 1. 分阶段总览

## 阶段 A：MVP（必须先打通）
1. 认证与租户隔离
2. Dashboard 基础概览
3. 日志检索（实时/历史/保存查询）
4. 告警中心（规则+事件+通知）
5. 事件管理（Incident）
6. 采集接入（数据源/Agent）
7. 安全审计（用户/角色/审计日志）

## 阶段 B：P1（生产可用）
8. 日志分析（聚合/异常/聚类）
9. 解析与字段（解析规则/字段映射/脱敏）
10. 索引与存储（ILM/备份恢复/容量）
11. 性能与高可用（健康检查/扩缩容/容灾）
12. 分布式追踪（trace 检索与分析）
13. 报表中心（导出/定时任务）
14. 集成开放平台（API Key/Webhook/插件）
15. 系统设置（全局配置、版本）

## 阶段 C：P2（增强）
16. 成本管理（预算/优化建议）
17. 帮助中心（知识库/FAQ/工单）
18. ML/NLP、边缘计算、网格治理等高级能力

---

## 2. 每个功能的业务需求 + 实现方式 + 数据设计

> 下面按“功能模块”给你最核心落地点。

### 1) 认证与租户（MVP）
- **业务需求**
  - 登录/登出/刷新 token
  - 多租户隔离（所有业务按 tenant_id 过滤）
  - 受保护路由与权限校验
- **实现方式**
  - 前端：`auth/*` 页面 + `ProtectedRoute`
  - 后端：`/auth/login /auth/refresh /auth/logout /auth/me`
  - 中间件：解析 JWT，注入 `tenant_id/user_id/roles`
- **核心表**
  - 已有：`tenants`, `users`, `roles`, `user_roles`
  - 新增：`user_credentials`, `user_sessions`, `password_reset_tokens`

---

### 2) Dashboard（MVP）
- **业务需求**
  - 展示日志量、告警数、错误率、趋势图
- **实现方式**
  - 聚合接口从 ES + PG 拉摘要
  - 前端图表组件直接消费 `/dashboard/summary`
- **核心表**
  - 可选新增：`dashboard_presets`（用户自定义看板）
  - 主数据来源：ES + 告警事件表

---

### 3) 日志检索（MVP）
- **业务需求**
  - 实时检索、历史检索、保存查询、查询历史
- **实现方式**
  - `query-api` 对 ES 查询封装（分页、排序、过滤）
  - 前端 search 页面从 mock 切到真实 API
- **核心表**
  - `saved_queries(id, tenant_id, user_id, name, query_dsl, created_at)`
  - `search_histories(id, tenant_id, user_id, query_text, filters, created_at)`
  - 日志数据在 Elasticsearch（非 PG）

---

### 4) 告警中心（MVP）
- **业务需求**
  - 规则管理、告警事件列表、通知发送、静默策略
- **实现方式**
  - control-plane：规则 CRUD
  - stream/Flink：根据规则产出告警事件
  - notifier：按渠道发送（邮件/webhook）
- **核心表**
  - 已有：`alert_rules`
  - 新增：`alert_events`, `notification_channels`, `notification_deliveries`, `silence_policies`

---

### 5) 事件管理 Incident（MVP）
- **业务需求**
  - 告警升级为事件、状态流转、分派、时间线、SLA
- **实现方式**
  - `POST /incidents`（手动或自动从 alert_event 升级）
  - 状态机：open → acknowledged → resolved → archived
- **核心表**
  - `incidents`
  - `incident_timeline`
  - `incident_assignments`
  - `incident_sla_records`

---

### 6) 采集接入（MVP）
- **业务需求**
  - 数据源配置、agent 注册、心跳监控、接入向导
- **实现方式**
  - control-plane 管理 source/agent 配置
  - agent 定时上报 `/agents/{id}/heartbeat`
- **核心表**
  - `data_sources`
  - `collector_agents`
  - `agent_heartbeats`
  - `source_status_snapshots`

---

### 7) 安全与审计（MVP）
- **业务需求**
  - 用户管理、角色权限、关键操作审计追踪
- **实现方式**
  - 用户/角色 API + 审计中间件（统一写审计日志）
- **核心表**
  - 已有：`audit_logs`
  - 建议补充：`login_policies`, `access_policies`

---

### 8) 日志分析（P1）
- **业务需求**
  - 聚合统计、异常检测、聚类分析
- **实现方式**
  - Flink/离线任务产出分析结果
- **核心表**
  - `analysis_jobs`
  - `analysis_results`
  - （P2）`anomaly_models`

---

### 9) 解析与字段（P1）
- **业务需求**
  - 解析规则、字段映射、脱敏策略、字段字典
- **实现方式**
  - 采集/流处理阶段应用解析规则
- **核心表**
  - `parsing_rules`
  - `field_mappings`
  - `masking_rules`
  - `field_dictionary`

---

### 10) 索引与存储（P1）
- **业务需求**
  - 索引模板、生命周期策略、备份恢复、容量监控
- **实现方式**
  - 对 ES ILM/snapshot API 做 control-plane 封装
- **核心表**
  - `index_policies`
  - `backup_jobs`
  - `restore_jobs`
  - `capacity_metrics`

---

### 11) 性能与高可用（P1）
- **业务需求**
  - 健康检测、扩缩容策略、容灾演练记录
- **实现方式**
  - health-worker 定时探活并入库
- **核心表**
  - `health_check_policies`
  - `health_check_results`
  - `scaling_policies`
  - `dr_plans`, `dr_executions`

---

### 12) 分布式追踪（P1）
- **业务需求**
  - trace 搜索、链路分析、服务拓扑
- **实现方式**
  - 接 Jaeger/OTel；前端调用 tracing query API
- **核心表**
  - 追踪主数据在 Jaeger/Tempo
  - 可选：`trace_bookmarks`

---

### 13) 报表中心（P1）
- **业务需求**
  - 报表生成、定时导出、下载记录
- **实现方式**
  - `export-api` 异步任务 + 对象存储文件
- **核心表**
  - `reports`
  - `report_schedules`
  - `export_jobs`
  - `export_files`

---

### 14) 集成开放平台（P1）
- **业务需求**
  - API文档、Webhook、SDK下载、插件市场
- **实现方式**
  - API Key + 签名校验 + webhook 重试队列
- **核心表**
  - `api_keys`
  - `webhooks`
  - `webhook_deliveries`
  - `plugins`

---

### 15) 系统设置（P1）
- **业务需求**
  - 全局参数配置、版本回滚、发布记录
- **实现方式**
  - 配置中心 + 版本化发布（GitOps）
- **核心表**
  - `system_configs`
  - `config_versions`
  - `config_publish_records`

---

### 16) 成本管理（P2）
- **业务需求**
  - 成本概览、预算告警、优化建议
- **实现方式**
  - 每日汇总作业按租户计算成本
- **核心表**
  - `cost_daily_usage`
  - `budgets`
  - `budget_alerts`
  - `optimization_recommendations`

---

### 17) 帮助中心（P2）
- **业务需求**
  - 查询语法文档、FAQ、工单入口
- **实现方式**
  - 内建知识库或对接外部工单系统
- **核心表**
  - `knowledge_articles`
  - `faq_items`
  - `support_tickets`

---

## 3. 推荐 Migration 拆分（可直接建文件）

1. `000002_auth_session.up.sql`
2. `000003_search_metadata.up.sql`
3. `000004_alert_event_notify.up.sql`
4. `000005_incident_management.up.sql`
5. `000006_ingestion_parsing.up.sql`
6. `000007_storage_performance.up.sql`
7. `000008_reports_integration.up.sql`
8. `000009_settings_cost_help.up.sql`

---

## 4. 服务职责拆分（非常关键）

- **api-service**：用户访问主 API（auth、dashboard、incident、security）
- **control-plane**：配置类 API（rules、sources、parsing、index policy、settings）
- **data-services/query-api**：日志与追踪查询
- **data-services/audit-api**：审计查询与导出
- **data-services/export-api**：报表和下载任务

---

如果你同意，我下一步就给你直接输出：
1) **`000002~000005` 的可执行 SQL 草案**
2) **每个功能对应的 OpenAPI 路径清单（按服务拆分）**
3) **首月开发排期（按周/按 issue）**
你可以直接复制到仓库开工。