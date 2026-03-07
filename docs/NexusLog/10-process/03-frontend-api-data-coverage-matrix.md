# 前端-接口-数据表覆盖矩阵（基于当前代码）

> 评估日期：2026-03-01  
> 评估范围：`apps/frontend-console`、`services/*`、`apps/bff-service`、`storage/postgresql/migrations`、`docs/NexusLog/20-database/sql`

## 1. 基线事实

- 前端显式路由：`59` 条（含认证路由，不含 `*` 回退）。
- 前端页面规模：15 个业务模块 + 认证模块，页面基本齐全。
- 后端业务接口现状：
  - `api-service` 仅健康检查。
  - `query-api` / `audit-api` / `export-api` 有业务路径，但返回“待实现”占位。
  - `bff-service` 已有 `GET /api/v1/bff/overview` 聚合健康探针。
- 数据模型现状：
  - 运行时迁移文件（仓库）：`000001` + `000012~000015`（单一入口：`storage/postgresql/migrations`）。
  - 环境执行态（2026-03-01）：`schema_migrations=15`、`dirty=false`，关键表校验 `25/25` 存在（见 `17-migration-execution-state-baseline.md`）。
  - 文档模型（V1 基线）：`78` 张表，外加 V6/V8/V9/V10/V11 增量表。

## 2. 模块覆盖矩阵

状态标记：
- `已实现`：前端已接真实接口，后端有可用业务逻辑并可落库。
- `部分`：前端页面可用，但接口或数据模型不完整。
- `未打通`：以前端 mock/静态数据为主，后端或数据层缺失。

| 模块 | 路由数 | 前端状态 | 后端 API 状态 | 实际迁移表覆盖 | 文档 SQL 覆盖 | 联通结论 |
|---|---:|---|---|---|---|---|
| 认证（`/login` `/register` `/forgot-password`） | 3 | 表单完整，但登录为本地模拟 | 无 `/api/v1/auth/*` 实现 | `users/roles` + `user_sessions/password_reset_tokens/login_attempts`（部分） | `tenant/project` 等较完整（部分） | `未打通` |
| Dashboard（`/`） | 1 | 页面完整，指标主要静态/本地状态 | 无聚合业务接口 | 无专用业务表 | 有基础治理表可支撑（间接） | `未打通` |
| 日志检索（`/search/*`） | 3 | `RealtimeSearch` 等使用 `MOCK_*` | `query-api` 占位 | `query_histories/saved_queries/saved_query_tags` 已存在（接口未接通） | 仅部分相关表，缺历史/收藏显式模型 | `未打通` |
| 日志分析（`/analysis/*`） | 3 | 以样例数据与图表骨架为主 | 无对应分析接口 | 无 | 无直接分析结果表 | `未打通` |
| 告警中心（`/alerts/*`） | 4 | 页面完整，规则/通知/静默均为本地状态 | 无 `/api/v1/alerts/*` 实现 | `alert_rules`（部分） | `alert_event/alert_ack` 存在，通知/静默模型不足 | `部分` |
| 事件管理（`/incidents/*`） | 6 | 页面完整，全部 mock | 无 incident 接口 | 无 incident 表 | incident 全链路表 + V6 SLA 较完整 | `未打通` |
| 采集接入（`/ingestion/*`） | 4 | 页面完整，配置和状态为本地数据 | 无 ingestion 管理接口 | `ingest_pull_*`、`agent_*`、`ingest_*` 已有迁移表（接口未接通） | `agent_*`、`collector_*` 表覆盖较好 | `未打通` |
| 解析与字段（`/parsing/*`） | 4 | 页面完整，规则/映射/字典为本地数据 | 无 parsing 接口 | 无 | 缺字段字典/映射专门表（可借配置表扩展） | `未打通` |
| 索引与存储（`/storage/*`） | 4 | 页面完整，索引/备份/容量为 mock | 无 storage 管理接口 | 无 | 存储域配置齐全，但应用元数据不足 | `部分` |
| 性能高可用（`/performance/*`） | 4 | 页面有展示，数据为样例 | `health-worker` 有健康状态接口 | 无健康结果表（实际） | `health_check_*` 表在文档模型存在 | `部分` |
| 分布式追踪（`/tracing/*`） | 3 | 页面完整，拓扑/trace 为 mock | 无 tracing 查询接口 | 无 | 缺 trace/span 一等实体表 | `未打通` |
| 报表中心（`/reports/*`） | 3 | 页面完整，任务与下载记录为 mock | `export-api` 占位 | 无报表任务表 | 无专用报表模型（仅零散字段） | `未打通` |
| 安全与审计（`/security/*`） | 4 | 页面完整，用户/角色/审计多为本地数据 | 无 user/role/audit 业务接口 | `users/roles/audit_logs`（部分） | 安全/审计模型较完整 | `部分` |
| 集成与开放平台（`/integration/*`） | 4 | API 文档与 Webhook/SDK/插件为静态或 mock | 无 integration 接口 | 无 | `api_definition/api_consumer/*` 与 `agent_plugin*` 部分覆盖 | `部分` |
| 成本管理（`/cost/*`） | 3 | 页面完整，指标为样例数据 | 无 cost 接口 | 无 | 缺预算/成本台账专门表 | `未打通` |
| 系统设置（`/settings/*`） | 3 | 页面完整，本地配置与版本样例 | 无 settings 接口 | `config_*` 与 `runtime_config_*` 已存在（接口未接通） | `config_namespace/config_item/config_version` 完整 | `未打通` |
| 帮助中心（`/help/*`） | 3 | 文档型页面，可独立运行 | 无需强依赖 | 可不依赖 | 可不依赖 | `部分（内容型）` |

## 3. 关键不一致

1. 任务文档中“API 服务层迁移完成”，但当前前端源码未形成可见 `services/hooks/utils` 业务调用层，页面仍以本地状态为主。  
2. 数据层运行时真相源已统一到 `storage/postgresql/migrations`；`docs/NexusLog/20-database/sql` 保留为设计/历史参考，文档需持续区分“文件态”与“执行态”。
3. 前端 API 文档页展示的接口与后端真实可调用接口不一致（文档接口多，落地接口少）。

## 4. 流程可完善点（建议加入强门禁）

在现有“范围收敛 -> 契约 -> 迁移 -> 切片开发 -> 发布”流程上，增加以下门禁：

1. **单一迁移源门禁**：只允许一个 DB 迁移入口作为生产真相源。  
2. **去 mock 门禁**：每完成一个模块，至少 1 个核心页面必须切到真实 API。  
3. **契约一致性门禁**：前端 API 文档中的端点必须有后端可调用实现与契约测试。  
4. **联通验收门禁**：验收标准从“页面可见”升级为“页面 -> API -> DB 可验证”。  
5. **回归门禁**：每条链路要有最小集成测试（至少 1 条成功 + 1 条失败路径）。

## 5. 建议优先级（按业务价值与改造成本）

1. **P0-1：告警规则 CRUD 闭环**  
   前端：`/alerts/rules` -> API：`/api/v1/alerts/rules` -> DB：`alert_rules`（先复用实际迁移表）。  

2. **P0-2：审计日志查询闭环**  
   前端：`/security/audit` -> API：`/api/v1/audit/logs` -> DB：`audit_logs`。  

3. **P0-3：用户与角色管理闭环**  
   前端：`/security/users` `/security/roles` -> API：`/api/v1/security/users|roles` -> DB：`users/roles/user_roles`。  

4. **P0-4：事件管理最小闭环**  
   先以“事件列表 + SLA”切入：补充实际迁移表（`incident`、`incident_response_sla`）并接通 `/incidents/list` `/incidents/sla`。  

5. **P0-5：检索最小闭环**  
   先实现“提交查询 + 返回列表 + 详情查看”，再补查询历史/收藏查询。

## 6. 一句话结论

当前项目是“前端高保真原型 + 后端骨架 + 数据模型双轨并存”状态。要进入可交付阶段，核心是先统一数据真相源，再按模块逐条打通页面、接口和数据表闭环。
