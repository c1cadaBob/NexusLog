# 下一步开发流程（按优先级，含基础用户能力闭环）

> 目标：将当前“前端高保真 + 后端骨架”推进到“用户可用的最小闭环”。  
> 约束：优先热固化机制（配置动态下发/热更新），避免改 YAML + 重启。

## 1. 当前状态（简述）

- 前端：59 页面结构完整，核心页面仍以 mock/本地状态为主。
- 后端：`api-service` 仅健康检查；`query-api/audit-api/export-api` 为占位端点。
- 网关：OpenResty 路由、认证、限流 Lua 基本具备。
- 采集：Agent 已有 checkpoint/retry/cache 框架，但文件采集、Kafka 发送仍有 TODO。
- 数据：存在双迁移源（运行时 6 表 vs 文档 87 表）。

结论：下一阶段应先打通 MVP 基础链路，不再继续扩页面。

---

## 2. P0（必须优先）

## 2.1 P0-0：统一数据真相源（第 0 优先级）

目标：消除“迁移分叉”，后续开发只维护一套迁移。

交付：

- 确认唯一迁移入口（建议 `storage/postgresql/migrations`）。
- 制定 V12+ 迁移基线（见 `database/08-schema-gap-and-extension-plan.md`）。
- 建立迁移验收门禁：`up/down` 可执行、回滚可演练。

验收标准：

- 任一环境只需要一个迁移命令即可初始化完整元数据表。

## 2.2 P0-1：网关 + 登录注册最小可用

目标：先把“能登录 + 能鉴权 + 能走通受保护 API”打通。

功能范围：

- 登录、注册、找回密码 API（`/api/v1/auth/*`）。
- 会话管理（refresh/revoke/logout）。
- 网关鉴权路径校验与统一错误码。

建议接口：

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/password/reset-request`
- `POST /api/v1/auth/password/reset-confirm`

涉及表：

- `users/roles/user_roles`（已有）
- `user_session/password_reset_token/login_attempt`（新增）

热固化要求：

- 登录策略（密码复杂度、失败锁定、token TTL）走 `config_*` 表动态下发，不改 YAML。

## 2.3 P0-2：日志接入最小闭环（你提出的 a + b）

### a) 日志通过远端服务器指定端口主动拉取

目标：支持中央采集器按任务从远端端口拉取日志。

建议流程：

1. 控制台配置 `ingest_pull_source`（host/port/protocol/path）。
2. 调度器生成 `ingest_pull_task` 并执行拉取。
3. 产生日志包并写入 ingest pipeline（Kafka 或对象存储中转）。
4. 回写任务状态与错误。

### b) 远端服务器 Agent 自动增量打包

目标：支持 agent 基于 checkpoint 做增量包，保证日志服务器可获取。

建议流程：

1. Agent 扫描日志源 -> 对比本地 checkpoint。
2. 生成增量包 `agent_incremental_package` + 包内清单 `agent_package_file`。
3. 上传/推送到日志服务器。
4. 服务器写 `ingest_delivery_receipt` ACK/NACK。
5. ACK 后更新中心 `ingest_file_checkpoint`；失败进 `ingest_dead_letter`。

关键原则：

- 幂等：`package_no + checksum` 唯一。
- 可补偿：失败可重放，不丢数据（at-least-once）。
- 可追溯：每个包可追到文件和 offset。

## 2.4 P0-3：日志存储与查询闭环（你提出的 c）

目标：日志在前端可见、可查询、可筛选、可分页。

功能范围：

- `query-api` 实现真实查询：`POST /api/v1/query/logs`。
- `RealtimeSearch` 页面改为真实 API 调用（移除 mock 主路径）。
- `SearchHistory/SavedQueries` 接入 PG 元数据。

建议接口：

- `POST /api/v1/query/logs`
- `GET /api/v1/query/history`
- `DELETE /api/v1/query/history/:id`
- `GET/POST/PUT/DELETE /api/v1/query/saved`

数据流：

- ES Data Stream 存日志正文。
- PG 存查询历史、收藏、审计。
- Redis 存热点查询缓存。

## 2.5 P0-4：其他高优先级能力（你提出的 d）

建议顺序：

1. 审计日志查询闭环：`/security/audit` -> `audit-api` -> `audit_logs`。
2. 告警规则闭环：`/alerts/rules` -> `alert_rules` + 规则版本。
3. 用户/角色闭环：`/security/users` `/security/roles` -> IAM API -> PG。
4. Dashboard 最小聚合：先复用 BFF `overview`，再接业务统计。

---

## 3. P1（P0 稳定后）

- 事件管理（Incident）全链路（状态机 + SLA + postmortem）。
- 解析与字段（mapping/rules/masking）版本化发布。
- 存储运维（ILM、备份恢复、容量建议）联动。
- 报表中心（任务调度 + 下载记录 + 重试死信）。

---

## 4. 热固化机制落地规则（必须执行）

## 4.1 配置中心化

- 所有业务配置优先落 `config_namespace/config_item/config_version/config_publish`。
- 禁止把业务规则长期固化在服务 YAML。

## 4.2 动态下发

- 服务启动加载基线配置。
- 运行中通过 `config_publish` + 事件通知（Redis PubSub/Kafka）热更新内存配置。
- 更新失败自动回滚到上一版本（记录 `runtime_config_dispatch_log`）。

## 4.3 网关配置热更新

- OpenResty Lua 通过定时拉取配置 API/Redis，不依赖重载 Nginx 主进程。
- 仅证书/核心内核参数保留维护窗口重载。

---

## 5. 建议执行节奏（两周一个小里程碑）

### 里程碑 M1（第 1-2 周）

- 完成 P0-0、P0-1（迁移真相源 + 登录注册闭环）。

### 里程碑 M2（第 3-4 周）

- 完成 P0-2（远端拉取 + agent 增量打包 + 回执闭环）。

### 里程碑 M3（第 5-6 周）

- 完成 P0-3、P0-4（检索展示查询 + 审计/告警/用户角色最小闭环）。

---

## 6. 每个里程碑统一验收清单

- 页面不再使用 mock 主路径。
- API 有契约、实现、集成测试。
- 数据链路可追溯（请求 -> 事件 -> 表记录）。
- 配置变更可热生效，失败可回滚。
- 关键指标可观测（错误率、延迟、积压、重试次数）。

---

## 7. 已确认的关键决策（2026-02-28）

1. **迁移真相源**：统一到 `storage/postgresql/migrations`。
2. **采集主模式（MVP）**：服务器主动拉取为主；后续演进为 Agent 推送为主、服务器主动拉取为辅。
3. **登录体系（MVP）**：先本地账号；后续业务完善再接 Keycloak。
4. **检索优先级**：先做实时检索，同时做历史/收藏。
5. **租户命名标准**：统一为 `obs.tenant`（单数 + schema），不保留兼容视图。

## 8. 已执行落地（与上述决策对齐）

已新增以下迁移（待你验收后执行）：

- `storage/postgresql/migrations/000012_mvp_auth_session_and_security.up.sql`
- `storage/postgresql/migrations/000013_mvp_ingest_pull_and_incremental_package.up.sql`
- `storage/postgresql/migrations/000014_mvp_search_query_metadata.up.sql`
- `storage/postgresql/migrations/000015_runtime_config_dispatch_and_subscription.up.sql`

对应回滚脚本已同步提供 `.down.sql`。
