# 文档与代码差异表（按文件逐条列差）

> 评估日期：2026-02-28  
> 评估范围：`docs/NexusLog/10-process/*.md`、`README.md`、`apps/*`、`services/*`、`agents/*`、`gateway/*`、`storage/postgresql/migrations/*`、`docker-compose.yml`
> 评估目标：将“文档目标”与“仓库代码现实”逐条对齐，识别阻塞交付的关键差异。

## 1. 结论摘要

1. 当前仓库处于“前端高保真原型 + 后端业务骨架 + 迁移扩展中”的阶段，核心判断与 `05-next-priority-development-plan.md` 一致。
2. 主要差异集中在四类：接口命名不一致、页面仍走 mock、本应闭环的后端接口尚未实现、网关路由与部署配置不一致。
3. 若不优先处理 P0 级差异，`M1~M3` 的验收会在“路由连通、鉴权一致性、去 mock 主路径”三处持续卡住。

## 2. 差异分级标准

| 级别 | 说明 |
|---|---|
| P0 | 直接阻断里程碑验收或导致主链路不可用。 |
| P1 | 不阻断主链路，但会造成行为偏差、联调返工或高运维风险。 |
| P2 | 文档时效性或结构性偏差，短期可接受但建议修订。 |

## 3. 差异矩阵（按文件逐条）

| ID | 文档声明（文件） | 代码事实（文件） | 差异说明 | 影响 | 级别 | 建议处理 |
|---|---|---|---|---|---|---|
| GAP-001 | 认证应走 `/api/v1/auth/*`（[04] `:26-29`；[05] `:40-51`） | 登录表单直接写本地状态（[LoginForm.tsx] `:26-33`），鉴权状态来自本地 store（[authStore.ts] `:20-23`） | 文档定义“真实认证 API”，代码仍是本地模拟登录 | 登录链路不可验证，网关与会话体系无法真实联调 | P0 | 按 `Week1~Week2` 完成 auth API 接入，移除本地模拟入口 |
| GAP-002 | Week2 认证接口使用 `password/reset-request` 与 `reset-confirm`（[05] `:50-51`） | 网关白名单仅包含 `/api/v1/auth/forgot-password`（[auth_check.lua] `:35`） | 认证路径命名已变更，但网关白名单未同步 | 新接口可能被鉴权拦截，导致重置流程失败 | P0 | 同步网关白名单路径，纳入 Week2 联调检查项 |
| GAP-003 | 检索接口定义为 `/api/v1/search/*`（[04] `:44-46`） | 新优先级文档定义为 `/api/v1/query/*`（[05] `:99-108`） | 文档内部接口命名冲突 | 前后端契约不稳定，容易返工 | P0 | 统一采用 `/api/v1/query/*`，修订 04 文档对应段落 |
| GAP-004 | Dashboard 目标接口为 `/api/v1/dashboard/overview`（[04] `:36`） | BFF 实际提供 `/api/v1/bff/overview`（[bff.controller.ts] `:4-11`）；Dashboard 页面仍读常量与随机数据（[Dashboard.tsx] `:10`, `:19-35`） | 目标接口与现有能力命名不一致，且页面未接 BFF | Dashboard 无法作为真实业务入口页 | P1 | 统一命名策略，Week6 先接 BFF 现有聚合，再决定是否改路径 |
| GAP-005 | RealtimeSearch 应改真实 API 并移除 mock（[05] `:99-101`） | 页面仍使用 `MOCK_LOGS`，查询按钮无后端调用（[RealtimeSearch.tsx] `:38`, `:230`, `:299`） | 文档目标与代码状态未对齐 | 检索主路径未打通，M3 关键验收失败 | P0 | Week5 完成 query-api 接入并移除主路径 mock |
| GAP-006 | SearchHistory/SavedQueries 应接 PG 元数据（[05] `:101`, `:106-109`） | `SearchHistory` 使用 `MOCK_HISTORY`（[SearchHistory.tsx] `:11`）；`SavedQueries` 使用 `INITIAL_SAVED` 本地状态（[SavedQueries.tsx] `:11`, `:30`） | 页面层仍是本地模拟数据 | 查询历史与收藏无法沉淀可追踪数据 | P0 | Week5 接 `query_histories/saved_queries/saved_query_tags` 接口 |
| GAP-007 | 审计、告警、用户、角色应形成最小闭环（[05] `:120-123`） | 审计页使用 `initialLogs`（[AuditLogs.tsx] `:27`）；告警规则页使用 `mockRules`（[AlertRules.tsx] `:13`）；用户/角色页为本地数据（[UserManagement.tsx] `:27`, [RolePermissions.tsx] `:46`） | 安全治理页面与后端未打通 | M3 关键业务能力不可用 | P0 | Week6 实现对应 API 并切换页面主数据源 |
| GAP-008 | `api-service` 需承载 auth、alerts、security 接口（[05] `:40-51`, `:121-123`） | 当前仅健康检查接口（[services/api-service/cmd/api/main.go] `:17-33`） | 业务 API 实现缺失 | 多条主链路无可用后端入口 | P0 | Week1/2/6 分段落地 API，先 auth 后治理接口 |
| GAP-009 | `control-plane` 需承载 ingestion 控制接口（[06] Week3/4） | 当前仅健康检查 + gRPC health（[services/control-plane/cmd/api/main.go] `:29-44`, `:53-57`） | 采集控制面接口未实现 | M2 拉取任务与回执链路无法完成 | P0 | Week3/4 补齐 `ingest/*` API 并落库 |
| GAP-010 | `query-api/audit-api/export-api` 需要真实业务能力（[05] `:99`, `:120`） | 三个服务均返回“待实现”，内部 handler/service/repository 为空包（[query-api main] `:20-25`；[audit-api main] `:20-25`；[export-api main] `:20-25`；`internal/*` 文件仅 `package` 声明） | 路由存在但业务未落地 | 前端联调只能拿占位响应 | P0 | Week5/6 先落 query 与 audit，export 保持最小可用 |
| GAP-011 | 网关应支持标准业务 API 路由（[05] `:36-43`, `:99-108`） | 网关转发主要使用 `/api/data/*`（[nginx.conf] `:240-306`），而非 `/api/v1/query|audit|export/*` | 网关路由模型与目标 API 前缀不一致 | 联调需要绕行或多重映射，增加错误率 | P0 | Week1 完成路由前缀统一与回归测试 |
| GAP-012 | 网关 upstream 应与实际服务名/端口一致（[05] Week1 目标） | `data_services -> data-services:8080`（[nginx.conf] `:93-95`），但 compose 仅定义 `query-api/audit-api/export-api`（[docker-compose.yml] `:120`, `:141`, `:159`）；`upstream.conf` 也使用 `query-api:8080` 等（[upstream.conf] `:7`, `:13`, `:19`） | 服务名与端口映射双重不一致 | 网关转发存在 502/误路由风险 | P0 | Week1 修正 upstream 到真实 service+port，并纳入冒烟门禁 |
| GAP-013 | README 架构强调 Gateway 入口层（[README.md] `:64-67`） | `docker-compose.yml` 未定义 `gateway` 服务（仅 frontend 与后端服务） | 架构说明与本地运行编排有断层 | 本地联调路径与生产假设不一致 | P1 | 增加 gateway 服务或在 README 说明本地直连模式 |
| GAP-014 | README 描述前端有 `src/services/hooks/utils`（[README.md] `:154-157`） | 实际 `src` 目录无 `services/hooks/utils`（[apps/frontend-console/src]） | 结构文档过时 | 新成员容易误判工程组织 | P2 | 更新 README 结构树或补建目录并明确用途 |
| GAP-015 | 03 文档曾称“实际迁移 6 表”（旧口径） | 运行时迁移目录已统一并执行到 `schema_migrations=15/dirty=false` | 已通过 1.5 文档同步，区分“文件存在态/环境执行态” | 已解除数据真相源认知混乱风险 | P1 | 已完成：更新 03 基线并新增 17 执行态基线文档（2026-03-01） |
| GAP-016 | 阶段 6 质量门禁要求“单元+集成+E2E+属性测试”（[02] `:46-50`） | Go 服务与 Agent 目录无 `_test.go` 文件（`services/`、`agents/` 扫描为空）；现有测试集中在前端与 BFF | 质量门禁目标与当前测试资产差距大 | 回归能力不足，变更风险高 | P1 | 按 M1~M3 每周补最小测试：每条链路至少成功/失败各 1 条 |
| GAP-017 | 05 文档指出 Health Worker 要走动态目标与阈值（[05] `:10`） | `getTargets()` 返回空列表，含 TODO（[scheduler.go] `:67`, `:87-90`） | 健康检查机制未接真实目标源 | 监控闭环不足，Dashboard 健康数据可信度低 | P1 | 增加目标配置来源（DB/配置中心）并实现动态加载 |
| GAP-018 | 05 文档指出 Agent 关键链路仍有 TODO（[05] `:11`） | 文件采集、syslog、Kafka 发送、gRPC/WASM 插件确有 TODO（[collector.go] `:126`, `:139`; [kafka_producer.go] `:46`, `:71`, `:90`; `plugins/*`） | 文档与代码一致，但属于明确未完成项 | M2 闭环风险集中 | P1 | 按 Week4 优先级落主路径，插件能力可保留渐进实现 |

## 4. 已对齐项（避免误判）

| 对齐点 | 证据 |
|---|---|
| “后端骨架/占位”判断与代码一致 | [05] `:8-12` 与 `api/query/audit/export` 入口代码一致 |
| BFF `overview` 能力已存在 | [bff.controller.ts] `:8-11`、[bff.service.ts] `:62-91` |
| 迁移文件态与执行态已对齐 | `000001 + 000012~000015` 文件存在，且环境 `schema_migrations=15/dirty=false`（见 17 与 1.5 证据） |
| 前端运行时配置加载机制已实现 | [runtime-config.ts] `:84-113`（支持 `/config/app-config.json` + fallback） |

## 5. 建议修复顺序（与 06 文档对齐）

1. **Week1~Week2（M1）优先清零 P0 鉴权链路差异**：`GAP-001/002/008/011/012`。  
2. **Week3~Week4（M2）清零采集链路差异**：`GAP-009/010/017/018`。  
3. **Week5~Week6（M3）清零页面去 mock 与治理闭环差异**：`GAP-003/004/005/006/007`。  
4. **并行修正文档时效性与结构偏差**：`GAP-013/014/015/016`。  

## 6. 维护规则（后续增量要求）

1. 每次接口命名变更必须同步更新 `04/05/06/07` 四份文档中的路径示例。
2. 每次新增迁移文件，必须在“文档基线事实”中标注“文件已新增”和“环境执行态”两个维度。
3. 每个里程碑结束后，更新本文件的差异状态（`open/in-progress/closed`）并附证据链接。
4. 未在本文件关闭的 P0 条目，不得标记该里程碑“验收通过”。

## 7. 差异执行追踪表（GAP-001~018）

状态说明：
- `open`：未开始
- `in-progress`：已开始实施但未完成验收
- `closed`：已完成并有证据

| GAP | 优先级 | 里程碑 | 目标周次 | 责任角色 | 当前状态 | 完成定义（DoD） | 证据链接 |
|---|---|---|---|---|---|---|---|
| GAP-001 | P0 | M1 | Week1~Week2 | FE + BE | open | 登录不再写本地状态，认证全流程走 `/api/v1/auth/*` | TBD |
| GAP-002 | P0 | M1 | Week2 | BE + DevOps | open | 网关白名单覆盖 `reset-request/reset-confirm` 路径并联调通过 | TBD |
| GAP-003 | P0 | M3 | Week5 | BE + FE | open | 04/05/06/07 接口命名统一为 `/api/v1/query/*` | TBD |
| GAP-004 | P1 | M3 | Week6 | FE + BE | open | Dashboard 对接真实聚合源，接口命名策略统一并文档更新 | TBD |
| GAP-005 | P0 | M3 | Week5 | FE + BE | open | RealtimeSearch 主路径去 `MOCK_*` 并接 `query-api` | TBD |
| GAP-006 | P0 | M3 | Week5 | FE + BE | open | SearchHistory/SavedQueries 使用 PG 元数据接口 | TBD |
| GAP-007 | P0 | M3 | Week6 | FE + BE | open | 审计/告警/用户/角色页面均接真实 API 主路径 | TBD |
| GAP-008 | P0 | M1/M3 | Week1~Week2, Week6 | BE | open | `api-service` 提供 auth/alerts/security 规划接口并通过集成测试 | TBD |
| GAP-009 | P0 | M2 | Week3~Week4 | BE | open | `control-plane` 提供 `ingest/*` 控制接口并落库验证通过 | TBD |
| GAP-010 | P0 | M3 | Week5~Week6 | BE | open | query/audit 至少完成真实业务实现，export 具备最小可用 | TBD |
| GAP-011 | P0 | M1 | Week1 | BE + DevOps | open | 网关路由前缀与目标 API 前缀统一 | TBD |
| GAP-012 | P0 | M1 | Week1 | BE + DevOps | open | upstream 服务名与端口映射与 compose 一致，冒烟通过 | TBD |
| GAP-013 | P1 | M1 | Week1~Week2 | DevOps + Docs | open | 本地编排与 README 网关入口说明一致（加服务或加说明） | TBD |
| GAP-014 | P2 | M1 | Week2 | FE + Docs | open | README 前端目录结构更新为仓库真实结构 | TBD |
| GAP-015 | P1 | M1 | Week1 | DBA + Docs | closed | 03/17 文档已区分“文件存在态”和“环境执行态”，并补齐 2026-03-01 证据 | `docs/NexusLog/10-process/03-frontend-api-data-coverage-matrix.md`；`docs/NexusLog/10-process/17-migration-execution-state-baseline.md`；`docs/NexusLog/10-process/evidence/task-1.5-migration-execution-state-sync-20260301.log` |
| GAP-016 | P1 | M1~M3 | Week1~Week6 | QA + BE + FE | open | 每周链路补齐最小自动化测试（成功/失败各 1） | TBD |
| GAP-017 | P1 | M2 | Week4 | BE | open | Health Worker 支持动态目标来源，不再返回空目标列表 | TBD |
| GAP-018 | P1 | M2 | Week4 | BE | open | Agent 主路径 TODO 清零（文件增量/syslog/Kafka）并通过链路验证 | TBD |

## 8. 每周更新模板（用于周报复制）

```md
### WeekX 差异状态更新
- 已关闭：GAP-xxx, GAP-xxx
- 进行中：GAP-xxx（阻塞点：...）
- 未开始：GAP-xxx
- 新增差异：无/有（编号：GAP-xxx）
- 证据链接：
  - GAP-xxx: <PR/测试报告/监控截图链接>
```
