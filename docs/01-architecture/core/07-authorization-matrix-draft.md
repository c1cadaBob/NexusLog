# 07. 授权矩阵草案（V1）

## 1. 文档目标

本文档将 `docs/01-architecture/core/06-authorization-redesign.md` 收敛为一份可执行的授权矩阵草案，供后续做以下工作时直接引用：

- 前端页面访问控制与菜单可见性改造
- 后端接口 capability / scope 守卫实现
- 系统自动化主体、Agent、内部服务的授权收口
- 高风险操作审批、JIT 访问、SoD、拒绝审计等治理能力落地

本文档覆盖四层矩阵：

1. 页面 / 路由访问矩阵
2. API / 能力 / 范围矩阵
3. 非人类主体 / 后台执行矩阵
4. 高风险操作附加治理矩阵

> 说明：
>
> - 本文中的 capability 以“重设计后的能力字典”为准。
> - 若某些 capability 在 `06-authorization-redesign.md` 尚未正式入典，本文会明确标为“建议新增”。
> - 本文同时覆盖“当前代码已存在”与“总体规划已定义但待实现”的能力，便于后续统一改造而非继续打补丁。

## 2. 使用约定

### 2.1 Capability 命名

统一使用：

`resource.action`

示例：

- `iam.user.read`
- `alert.rule.update`
- `backup.restore`
- `notification.channel.read_secret`
- `query.result.unmasked.read`

### 2.2 Scope 取值

当前推荐统一使用以下范围：

- `self`
- `owned`
- `assigned`
- `tenant`
- `tenant_group`
- `all_tenants`
- `system`
- `project`（预留）
- `env`（预留）
- `resource`（预留）

### 2.3 Control Tag 说明

| 标签 | 含义 |
|---|---|
| `A` | 需要审批或至少二次确认 |
| `J` | 建议支持 JIT / 临时授权 |
| `S` | 受职责分离（SoD）或双人治理约束 |
| `E` | 受 entitlement / 版本能力控制 |
| `F` | 受 feature flag / 灰度开关控制 |
| `M` | 涉及 masked / unmasked 或敏感字段可见性 |
| `R` | 撤权后需快速失效 / 即时收口 |
| `P` | 平台保留能力，不应向普通角色开放 |

## 3. 默认主体与角色集合

| 角色 / 主体 | actor_type | 默认 scope | 说明 |
|---|---|---:|---|
| `platform_super_admin` | `human_user` | `system` | 平台唯一超级管理员 |
| `system_automation` | `system_reserved` / `service_account` | `system`，必要时 `tenant` | 系统自动执行主体，不允许交互式登录 |
| `security_admin` | `human_user` | `tenant_group` / `tenant` | 偏身份、角色、登录策略、审计治理 |
| `tenant_admin` | `human_user` | `tenant_group` / `tenant` | 偏租户运营、配置、业务管理 |
| `operator` | `human_user` | `tenant` | 业务运营与处置 |
| `auditor` | `human_user` | `tenant`，必要时 `all_tenants` | 默认只读，不应拥有破坏审计完整性的能力 |
| `viewer` | `human_user` | `tenant` | 基础只读 |
| `agent_runtime` | `agent` | `tenant` / `resource` | Agent 注册、拉取、心跳、指标上报 |
| `internal_service` | `service_account` | `system` / `tenant` | 内部服务协同与后台编排 |
| `support_access_session` | `human_user` + `temporary_grant` | 临时指定 | 运维代操作 / 支持访问 |
| `break_glass_session` | `human_user` + `temporary_grant` | 临时指定 | 应急提权，必须审计 |

## 4. 页面访问矩阵

### 4.1 公共与认证页

| 路由 | 页面 | view capability | 默认 scope | 标签 | 备注 |
|---|---|---:|---:|---|---|
| `/login` | 登录 | `public.auth.login` | - | - | 公共入口 |
| `/register` | 注册 | `public.auth.register` | - | `F` | 是否开放注册应受平台策略控制 |
| `/forgot-password` | 忘记密码 | `public.auth.password_reset_request` | - | - | 公共入口 |

### 4.2 概览、检索与分析

| 路由 | 页面 | view capability | 默认 scope | 标签 | 页内动作 / 备注 |
|---|---|---:|---:|---|---|
| `/` | 概览 | `dashboard.read` | `tenant` | - | Dashboard 卡片与快捷入口需复用同一授权事实源 |
| `/search/realtime` | 实时检索 | `log.query.read` | `tenant` | `M` | 查询结果还要叠加字段可见性规则 |
| `/search/history` | 查询历史 | `query.history.read` | `owned` | - | 删除历史需 `query.history.delete` |
| `/search/saved` | 收藏查询 | `query.saved.read` | `owned` / `tenant` | - | 共享需 `query.saved.share` |
| `/analysis/aggregate` | 聚合分析 | `log.query.aggregate` | `tenant` | `M` | 聚合结果不得绕过敏感字段策略 |
| `/analysis/anomaly` | 异常检测 | `analysis.anomaly.read` | `tenant` | `E,F` | 建议新增 capability |
| `/analysis/clustering` | 聚类分析 | `analysis.cluster.read` | `tenant` | `E,F` | 建议新增 capability |

### 4.3 告警与事件

| 路由 | 页面 | view capability | 默认 scope | 标签 | 页内动作 / 备注 |
|---|---|---:|---:|---|---|
| `/alerts/list` | 告警列表 | `alert.event.read` | `tenant` | - | 仅查看不代表可变更规则 |
| `/alerts/rules` | 告警规则 | `alert.rule.read` | `tenant` | `A` | 新建/编辑/删除/启停分别要求 `create/update/delete/enable/disable` |
| `/alerts/notifications` | 通知配置 | `notification.channel.read_metadata` | `tenant` | `A,M` | 查看明文 secret、测试发送需额外能力 |
| `/alerts/silence` | 静默策略 | `alert.silence.read` | `tenant` | `A` | 创建/删除应单独鉴权 |
| `/incidents/list` | 事件列表 | `incident.read` | `tenant` | - | 处置动作需额外能力 |
| `/incidents/detail/:id` | 事件详情 | `incident.read` | `resource` / `tenant` | - | 详情页动作需独立鉴权 |
| `/incidents/timeline` | 全流程时间线 | `incident.timeline.read` | `tenant` | - | 建议新增 capability |
| `/incidents/analysis` | 根因分析 | `incident.analysis.read` | `tenant` | `E,F` | 建议新增 capability |
| `/incidents/sla` | SLA 监控 | `incident.sla.read` | `tenant` | - | 建议新增 capability |
| `/incidents/archive` | 归档管理 | `incident.archive.read` | `tenant` | `A` | 建议新增 capability |

### 4.4 数据接入与字段治理

| 路由 | 页面 | view capability | 默认 scope | 标签 | 页内动作 / 备注 |
|---|---|---:|---:|---|---|
| `/ingestion/sources` | 采集源管理 | `ingest.source.read` | `tenant` | `A` | 创建/更新/删除/禁用需单独 capability |
| `/ingestion/agents` | Agent 管理 | `agent.read` | `tenant` | `A,P` | 注册、密钥轮换需高风险控制 |
| `/ingestion/wizard` | 接入向导 | `ingest.source.read` | `tenant` | - | 提交向导结果需 `ingest.source.create` |
| `/ingestion/status` | 数据源状态 | `ingest.task.read` | `tenant` | - | 失败重放需 `ingest.dead_letter.replay` |
| `/parsing/mapping` | 字段映射 | `field.mapping.read` | `tenant` | `A` | 建议新增 capability |
| `/parsing/rules` | 解析规则 | `parse.rule.read` | `tenant` | `A` | 修改影响全局解析结果 |
| `/parsing/masking` | 脱敏规则 | `masking.rule.read` | `tenant` | `A,S,M` | 修改属于高风险治理动作 |
| `/parsing/dictionary` | 字段字典 | `field.dictionary.read` | `tenant` | `M` | 敏感字段定义需单独可见性规则 |

### 4.5 存储、性能与容灾

| 路由 | 页面 | view capability | 默认 scope | 标签 | 页内动作 / 备注 |
|---|---|---:|---:|---|---|
| `/storage/indices` | 索引管理 | `storage.index.read` | `tenant` | `A` | 建议新增 capability |
| `/storage/ilm` | 生命周期 ILM | `data.retention.read` | `tenant` | `A` | 调整保留策略属于高风险 |
| `/storage/backup` | 备份与恢复 | `backup.read` | `tenant` / `system` | `A,J,S` | 恢复、删除、下载、取消需拆分能力 |
| `/storage/capacity` | 容量监控 | `storage.capacity.read` | `tenant` | - | 建议新增 capability |
| `/performance/monitoring` | 性能监控 | `metric.read` | `tenant` | - | 只读 |
| `/performance/health` | 健康检查 | `ops.health.read` | `tenant` / `system` | - | 建议新增 capability |
| `/performance/scaling` | 扩缩容策略 | `ops.scaling.read` | `tenant` / `system` | `A,E,F` | 调整策略属于高风险，建议新增 `ops.scaling.update` |
| `/performance/dr` | 灾备状态 | `dr.read` | `system` / `tenant` | `A,E` | 建议新增 capability |

### 4.6 追踪与报表

| 路由 | 页面 | view capability | 默认 scope | 标签 | 页内动作 / 备注 |
|---|---|---:|---:|---|---|
| `/tracing/search` | Trace 搜索 | `trace.read` | `tenant` | `E,F,M` | 追踪明细同样受字段可见性影响 |
| `/tracing/analysis` | 调用链分析 | `trace.analysis.read` | `tenant` | `E,F` | 建议新增 capability |
| `/tracing/topology` | 服务拓扑 | `trace.topology.read` | `tenant` | `E,F` | 建议新增 capability |
| `/reports/management` | 报表管理 | `report.read` | `tenant` | `A` | 创建/更新报表需独立 capability |
| `/reports/scheduled` | 定时任务 | `report.schedule.read` | `tenant` | `A,J,R` | 执行主体与授权快照需单独建模 |
| `/reports/downloads` | 下载记录 | `report.download.read` | `owned` / `tenant` | `M,R` | 高敏下载建议默认仅本人可见 |

### 4.7 安全、集成、成本与系统设置

| 路由 | 页面 | view capability | 默认 scope | 标签 | 页内动作 / 备注 |
|---|---|---:|---:|---|---|
| `/security/users` | 用户管理 | `iam.user.read` | `tenant` | `A,S,R` | 批量禁用/角色下发属于高风险 |
| `/security/roles` | 角色权限 | `iam.role.read` | `tenant` | `A,S,R` | 角色绑定 capability 需 SoD 控制 |
| `/security/audit` | 审计日志 | `audit.log.read` | `tenant` / `all_tenants` | `M,P` | 平台审计只应开放给少数治理主体 |
| `/security/login-policy` | 登录策略 | `auth.login_policy.read` | `tenant` | `A,S,R` | 修改后应快速传播 |
| `/integration/api` | API 文档 | `integration.api_doc.read` | `tenant` | - | 纯只读 |
| `/integration/webhook` | Webhook | `integration.webhook.read_metadata` | `tenant` | `A,M` | 明文 secret 与测试发送需额外能力 |
| `/integration/sdk` | SDK 下载 | `integration.sdk.read` | `tenant` | - | 只读 |
| `/integration/plugins` | 插件市场 | `integration.plugin.read` | `tenant` | `E,F` | 安装/启用插件属于高风险 |
| `/cost/overview` | 成本概览 | `cost.read` | `tenant` | `E` | 只读 |
| `/cost/budgets` | 预算告警 | `cost.budget.read` | `tenant` | `A,E` | 建议新增 capability |
| `/cost/optimization` | 优化建议 | `cost.optimization.read` | `tenant` | `E,F` | 建议新增 capability |
| `/settings/parameters` | 系统参数 | `settings.parameter.read` | `tenant` / `system` | `A` | 修改属于高风险 |
| `/settings/global` | 全局配置 | `settings.global.read` | `tenant` / `system` | `A,M,S` | 敏感配置需区分 metadata / secret |
| `/settings/versions` | 配置版本 | `settings.version.read` | `tenant` / `system` | `A,S,R` | 回滚需双人治理 |
| `/help/syntax` | 查询语法 | `help.read` | `tenant` | - | 只读 |
| `/help/faq` | FAQ | `help.read` | `tenant` | - | 只读 |
| `/help/tickets` | 工单入口 | `help.read` | `tenant` | - | 若后续接工单系统建议独立 capability |

## 5. API 授权矩阵

### 5.1 认证、会话与身份治理

| 路由 / 前缀 | 代表操作 | capability | scope | entry tier | 标签 | 状态 |
|---|---|---:|---:|---|---|---|
| `POST /api/v1/auth/login` | 登录 | `public.auth.login` | - | `public` | - | 当前 |
| `POST /api/v1/auth/register` | 注册 | `public.auth.register` | - | `public` | `F` | 当前 |
| `POST /api/v1/auth/refresh` | 刷新令牌 | `public.auth.refresh` | `self` | `authenticated_session` | `R` | 当前 |
| `POST /api/v1/auth/logout` | 注销 | `auth.session.revoke` | `self` | `authenticated_session` | `R` | 当前 |
| `POST /api/v1/auth/password/reset-request` | 发起重置 | `public.auth.password_reset_request` | - | `public` | - | 当前 |
| `POST /api/v1/auth/password/reset-confirm` | 确认重置 | `public.auth.password_reset_confirm` | - | `public` | - | 当前 |
| `GET /api/v1/users/me` | 获取当前身份与权限 | `auth.session.read` | `self` | `authenticated_session` | `R` | 当前 |
| `GET/PUT /api/v1/security/login-policy` | 登录策略查询/更新 | `auth.login_policy.read/update` | `tenant` | `delegated_admin` | `A,S,R` | 当前 / 规划 |

### 5.2 用户、角色与委派治理

| 路由 / 前缀 | 代表操作 | capability | scope | entry tier | 标签 | 状态 |
|---|---|---:|---:|---|---|---|
| `GET /api/v1/users` | 用户列表 | `iam.user.read` | `tenant` | `delegated_admin` | - | 当前 |
| `POST /api/v1/users` | 创建用户 | `iam.user.create` | `tenant` | `delegated_admin` | `A,S,R` | 当前 |
| `PUT /api/v1/users/:id` | 更新资料 / 状态 | `iam.user.update_profile` / `iam.user.update_status` | `resource` / `tenant` | `delegated_admin` | `A,S,R` | 当前 |
| `POST /api/v1/users/batch/status` | 批量启停 | `iam.user.update_status` | `tenant` | `delegated_admin` | `A,S,R` | 当前 |
| `POST /api/v1/users/:id/roles` | 赋予角色 | `iam.user.grant_role` | `tenant` | `delegated_admin` | `A,S,R` | 当前 |
| `DELETE /api/v1/users/:id/roles/:role_id` | 回收角色 | `iam.user.revoke_role` | `tenant` | `delegated_admin` | `A,S,R` | 当前 |
| `GET /api/v1/roles` | 角色列表 | `iam.role.read` | `tenant` | `delegated_admin` | - | 当前 |
| `POST /api/v1/roles` | 新建角色 | `iam.role.create` | `tenant` | `delegated_admin` | `A,S` | 当前 |
| `PUT /api/v1/roles/:id` | 更新角色 | `iam.role.update` | `tenant` | `delegated_admin` | `A,S` | 当前 |
| `POST /api/v1/roles/:id/capabilities` | 绑定能力 | `iam.role.bind_capability` | `tenant` | `security_admin` | `A,S,R` | 规划 |
| `POST /api/v1/access/requests` | 发起临时授权 | `access.request.create` | `target_scope` | `authenticated_session` | `A,J` | 建议新增 |
| `POST /api/v1/access/requests/:id/approve` | 审批临时授权 | `access.request.approve` | `target_scope` | `delegated_admin` / `platform_admin` | `A,J,S` | 建议新增 |

### 5.3 查询、历史、收藏与分析

| 路由 / 前缀 | 代表操作 | capability | scope | entry tier | 标签 | 状态 |
|---|---|---:|---:|---|---|---|
| `POST /api/v1/query/logs` | 日志检索 | `log.query.read` | `tenant` | `authenticated_session` | `M` | 当前 |
| `GET /api/v1/query/history` | 查询历史列表 | `query.history.read` | `owned` | `authenticated_session` | - | 当前 |
| `DELETE /api/v1/query/history/:id` | 删除历史 | `query.history.delete` | `owned` | `authenticated_session` | - | 当前 |
| `GET /api/v1/query/saved` | 收藏列表 | `query.saved.read` | `owned` / `tenant` | `authenticated_session` | - | 当前 |
| `POST /api/v1/query/saved` | 创建收藏 | `query.saved.create` | `owned` | `authenticated_session` | - | 当前 |
| `PUT /api/v1/query/saved/:id` | 更新收藏 | `query.saved.update` | `owned` | `authenticated_session` | - | 当前 |
| `DELETE /api/v1/query/saved/:id` | 删除收藏 | `query.saved.delete` | `owned` | `authenticated_session` | - | 当前 |
| `GET /api/v1/query/stats/overview` | 概览聚合 | `log.query.aggregate` | `tenant` | `authenticated_session` | `M` | 规划 |
| `/api/v1/analysis/*` | 异常/聚类/高级分析 | `analysis.*` | `tenant` | `authenticated_session` | `E,F,M` | 规划 |

### 5.4 告警、通知与事件处置

| 路由 / 前缀 | 代表操作 | capability | scope | entry tier | 标签 | 状态 |
|---|---|---:|---:|---|---|---|
| `/api/v1/alert/rules*` | 规则 CRUD / 启停 | `alert.rule.read/create/update/delete/enable/disable` | `tenant` | `delegated_admin` / `operator` | `A` | 当前 / 规划 |
| `/api/v1/alert/silences*` | 静默策略 CRUD | `alert.silence.read/create/update/delete` | `tenant` | `delegated_admin` / `operator` | `A` | 当前 / 规划 |
| `/api/v1/notification/channels*` | 渠道 CRUD | `notification.channel.read_metadata/create/update/delete` | `tenant` | `delegated_admin` / `operator` | `A,M` | 当前 |
| `POST /api/v1/notification/channels/:id/test` | 测试发送 | `notification.channel.test` | `resource` / `tenant` | `delegated_admin` / `operator` | `A,M,S` | 当前 |
| `/api/v1/incidents*` | 事件列表、详情、指派、关闭、归档 | `incident.read/create/update/assign/close/archive` | `tenant` | `delegated_admin` / `operator` | `A` | 当前 / 规划 |
| `/api/v1/incidents/:id/timeline` | 时间线维护 | `incident.timeline.read` / `incident.update` | `resource` | `authenticated_session` | - | 规划 |
| `/api/v1/incidents/sla/summary` | SLA 汇总 | `incident.sla.read` | `tenant` | `authenticated_session` | - | 规划 |

### 5.5 数据接入、Agent 与运行链路

| 路由 / 前缀 | 代表操作 | capability | scope | entry tier | 标签 | 状态 |
|---|---|---:|---:|---|---|---|
| `/api/v1/ingest/pull-sources*` | 采集源 CRUD / 禁停 | `ingest.source.read/create/update/delete/disable` | `tenant` | `delegated_admin` / `operator` | `A` | 当前 / 规划 |
| `/api/v1/ingest/tasks*` | 任务查询 / 手动执行 | `ingest.task.read/run` | `tenant` | `delegated_admin` / `operator` | `A` | 当前 / 规划 |
| `/api/v1/ingest/packages*` | 包状态查询 | `ingest.package.read` | `tenant` | `authenticated_session` | - | 当前 |
| `/api/v1/ingest/dead-letters*` | 死信查看 / 重放 | `ingest.dead_letter.read/replay` | `tenant` | `delegated_admin` / `operator` | `A` | 规划 |
| `POST /api/v1/metrics/report` | Agent 上报指标 | `metric.report` | `tenant` / `resource` | `agent` | `P` | 当前 |
| Agent pull / ack / heartbeat | Agent 拉取/回执/心跳 | `agent.runtime.pull` / `agent.runtime.ack` / `agent.runtime.heartbeat` | `resource` / `tenant` | `agent` | `P` | 建议新增 |
| Agent 注册 / 轮换 key | 管理 Agent 身份 | `agent.register` / `agent.rotate_key` | `tenant` | `delegated_admin` | `A,P` | 当前 / 规划 |

### 5.6 审计、导出、备份与容灾

| 路由 / 前缀 | 代表操作 | capability | scope | entry tier | 标签 | 状态 |
|---|---|---:|---:|---|---|---|
| `GET /api/v1/audit/logs` | 审计日志读取 | `audit.log.read` | `tenant` / `all_tenants` | `authenticated_session` / `platform_admin` | `M,P` | 当前 |
| `POST /api/v1/audit/logs/export` | 审计导出 | `audit.log.export` | `tenant` / `all_tenants` | `delegated_admin` / `platform_admin` | `A,M,P` | 规划 |
| `/api/v1/export/jobs*` | 导出任务创建/查询/下载/取消 | `export.job.create/read/download/cancel` | `owned` / `tenant` | `authenticated_session` | `A,M,R` | 当前 |
| `GET /api/v1/backup/snapshots` | 备份列表 | `backup.read` | `tenant` / `system` | `delegated_admin` / `platform_admin` | `A` | 当前 |
| `POST /api/v1/backup/snapshots` | 触发备份 | `backup.create` | `tenant` / `system` | `delegated_admin` / `platform_admin` | `A,J,S` | 当前 |
| `POST /api/v1/backup/snapshots/:id/restore` | 恢复备份 | `backup.restore` | `tenant` / `system` | `delegated_admin` / `platform_admin` | `A,J,S,R` | 当前 |
| `DELETE /api/v1/backup/snapshots/:id` | 删除备份 | `backup.delete` | `tenant` / `system` | `delegated_admin` / `platform_admin` | `A,J,S` | 当前 |
| `GET /api/v1/backup/snapshots/:id/download` | 下载备份 | `backup.download` | `tenant` / `system` | `delegated_admin` / `platform_admin` | `A,M` | 建议新增 |
| `POST /api/v1/backup/snapshots/:id/cancel` | 取消备份 | `backup.cancel` | `tenant` / `system` | `delegated_admin` / `platform_admin` | `A` | 建议新增 |
| `/api/v1/dr/*` | 灾备状态 / 演练 | `dr.read` / `dr.execute` | `system` / `tenant` | `platform_admin` | `A,J,S,E` | 规划 |

### 5.7 字段治理、配置中心与集成开放

| 路由 / 前缀 | 代表操作 | capability | scope | entry tier | 标签 | 状态 |
|---|---|---:|---:|---|---|---|
| `/api/v1/parsing/rules*` | 解析规则 CRUD | `parse.rule.read/update` | `tenant` | `delegated_admin` | `A` | 规划 |
| `/api/v1/parsing/mappings*` | 字段映射 CRUD | `field.mapping.read/update` | `tenant` | `delegated_admin` | `A,M` | 建议新增 |
| `/api/v1/parsing/masking-rules*` | 脱敏规则 CRUD | `masking.rule.read/update` | `tenant` | `security_admin` | `A,S,M` | 规划 |
| `/api/v1/parsing/field-dictionary*` | 字段字典读取/维护 | `field.dictionary.read/update` | `tenant` | `delegated_admin` | `M` | 规划 |
| `/api/v1/settings/parameters*` | 系统参数 | `settings.parameter.read/update` | `tenant` / `system` | `delegated_admin` | `A` | 规划 |
| `/api/v1/settings/global*` | 全局配置 | `settings.global.read/update` | `tenant` / `system` | `delegated_admin` | `A,M,S` | 规划 |
| `/api/v1/settings/versions*` | 配置版本 / 回滚 | `settings.version.read/rollback` | `tenant` / `system` | `delegated_admin` / `platform_admin` | `A,S,R` | 规划 |
| `/api/v1/integrations/webhooks*` | Webhook CRUD | `integration.webhook.read_metadata/create/update/delete` | `tenant` | `delegated_admin` | `A,M` | 规划 |
| `/api/v1/integrations/plugins*` | 插件读取 / 安装 | `integration.plugin.read/install` | `tenant` | `delegated_admin` | `A,E,F` | 规划 |
| `/api/v1/integrations/sdk*` | SDK / 文档读取 | `integration.sdk.read` / `integration.api_doc.read` | `tenant` | `authenticated_session` | - | 规划 |

### 5.8 成本、多租户与企业扩展

| 路由 / 前缀 | 代表操作 | capability | scope | entry tier | 标签 | 状态 |
|---|---|---:|---:|---|---|---|
| `/api/v1/cost/overview` | 成本概览 | `cost.read` | `tenant` | `authenticated_session` | `E` | 规划 |
| `/api/v1/cost/budgets*` | 预算读取 / 更新 | `cost.budget.read/update` | `tenant` | `delegated_admin` | `A,E` | 规划 |
| `/api/v1/cost/optimization*` | 优化建议 | `cost.optimization.read` | `tenant` | `authenticated_session` | `E,F` | 建议新增 |
| `/api/v1/tenants*` | 租户管理 | `tenant.read/create/update/suspend` | `system` / `all_tenants` | `platform_admin` | `A,S,P` | 规划 |
| `/api/v1/enterprise/*` | 企业能力 | `enterprise.*` | `tenant` / `system` | `authenticated_session` | `E,F` | 规划 |
| `/api/v1/advanced/*` | 高级分析/智能能力 | `advanced.*` | `tenant` | `authenticated_session` | `E,F,M` | 规划 |

## 6. 非人类主体与后台执行矩阵

| 主体 | 身份证明 | 允许 capability | 默认 scope | 明确禁止 | 审计归因 |
|---|---|---|---:|---|---|
| `agent_runtime` | `X-Agent-Key` / agent key ref | `metric.report`、`agent.runtime.pull`、`agent.runtime.ack`、`agent.runtime.heartbeat` | `resource` / `tenant` | 不得调用人类 IAM / 设置 / 审计管理接口 | `actor_type=agent` |
| `internal_service` | service credential / mTLS / API key | `internal.rpc.invoke.*`、`topic.produce.*`、`topic.consume.*`、必要的数据域内部调用 | `system` / `tenant` | 不得模拟人类用户做交互式治理 | `actor_type=service_account` |
| `system_automation` | reserved internal principal | `audit.log.write_system`、调度执行、清理、后台编排 | `system` / `tenant` | 不允许交互式登录，不允许修改人类身份体系 | `actor_type=system_reserved` |
| `support_access_session` | approved temporary grant | 仅工单批准范围内能力 | `target_scope` | 超时后不得继续使用，不得长期持有 | 同时记录 initiator / approver / executor |
| `break_glass_session` | emergency approved grant | 仅应急白名单能力 | `target_scope` | 不得用于常规运营，不得绕过审计 | `actor_type=human_user`, `break_glass=true` |

## 7. 高风险操作附加治理矩阵

| 操作 | capability | 附加控制 | 审计必须记录 |
|---|---|---|---|
| 恢复备份 | `backup.restore` | `A,J,S,R`，建议双人审批 + JIT | `decision_reason_code`、`ticket_id`、`approved_by` |
| 删除备份 | `backup.delete` | `A,S`，建议二次确认 + 审批 | `decision_result`、`policy_source` |
| 配置回滚 | `settings.version.rollback` | `A,S,R`，审批人与执行人分离 | `config_version_id`、`approved_by` |
| 读取明文通知 secret | `notification.channel.read_secret` | `A,J,M,S` | `required_capability`、`target_id`、`justification` |
| 测试通知/Webhook 出网 | `notification.channel.test` / `integration.webhook.test` | `A,S`，建议审批和 SSRF 防护 | `target_scope`、`operated_via` |
| 导出未脱敏数据 | `log.export.unmasked` + `export.job.download` | `A,J,M,S` | `query_fingerprint`、`approval_snapshot_id` |
| 在线查看未脱敏字段 | `query.result.unmasked.read` | `A,J,M` | `field_visibility`、`data_classification` |
| 全租户审计读取 | `audit.log.read@all_tenants` | `P,S,M` | `effective_actor_type`、`required_scope` |
| 临时授权激活 | `access.request.activate` | `A,J,S,R` | `approved_by`、`expires_at` |
| Break-glass 使用 | `auth.break_glass.use` | `A,J,S,P,R` | `break_glass=true`、`ticket_id`、`reason` |
| 保留主体角色修改 | `iam.user.grant_role` / `iam.user.revoke_role` | `P,S,R`，默认硬拒绝，仅白名单治理流程可行 | `matched_hard_rule` |
| 资源归属转移 | `resource.transfer_ownership` | `A,S` | `previous_owner`、`new_owner` |

## 8. 建议新增或补齐的 Capability

以下 capability 已在本矩阵中使用，但尚未完整沉淀进 `06-authorization-redesign.md` 的能力字典，建议作为下一轮字典补齐对象：

- `analysis.anomaly.read`
- `analysis.cluster.read`
- `incident.timeline.read`
- `incident.analysis.read`
- `incident.sla.read`
- `incident.archive.read`
- `field.mapping.read`
- `field.mapping.update`
- `storage.index.read`
- `storage.index.update`
- `storage.capacity.read`
- `ops.health.read`
- `ops.scaling.read`
- `ops.scaling.update`
- `dr.read`
- `dr.execute`
- `trace.analysis.read`
- `trace.topology.read`
- `cost.budget.read`
- `cost.optimization.read`
- `backup.download`
- `backup.cancel`
- `notification.channel.read_metadata`
- `notification.channel.read_secret`
- `notification.channel.update_secret`
- `integration.webhook.read_metadata`
- `integration.webhook.read_secret`
- `integration.webhook.rotate_secret`
- `settings.sensitive.read`
- `settings.sensitive.update`
- `query.result.unmasked.read`
- `log.field.masked.read`
- `log.field.raw.read`
- `access.request.create`
- `access.request.approve`
- `access.request.activate`
- `access.request.revoke`
- `support.access.use`
- `internal.rpc.invoke.*`
- `topic.produce.*`
- `topic.consume.*`
- `agent.runtime.pull`
- `agent.runtime.ack`
- `agent.runtime.heartbeat`

## 9. 实施建议顺序

1. **冻结能力字典**
   - 以本文矩阵为底稿，将所有 capability 拆成“已有 / 新增 / P2 预留”三组。
2. **先做 `/users/me` + permission version**
   - 让前端路由守卫、菜单、快捷入口先统一基于同一事实源。
3. **建立页面注册表**
   - 将 `path -> view capability -> feature gate -> entitlement` 固化。
4. **建立后端 capability 守卫表**
   - 按 API 前缀收口，不再散落写 if/else。
5. **优先落高风险能力**
   - `backup.restore`
   - `settings.version.rollback`
   - `notification.channel.read_secret`
   - `query.result.unmasked.read`
   - `auth.break_glass.use`
6. **最后再接策略增强**
   - JIT、SoD、拒绝审计、字段可见性、非人类主体矩阵。

## 10. 与 `06-authorization-redesign.md` 的关系

- `06-authorization-redesign.md`：回答“为什么要重设计、设计原则是什么、还有哪些缺口”。
- `07-authorization-matrix-draft.md`：回答“页面、API、主体、高风险操作，到底怎么授权”。

建议后续把二者配合使用：

1. 先在 `06` 冻结原则与治理边界
2. 再在 `07` 冻结 capability / scope / route / API 矩阵
3. 最后输出迁移设计与数据库事实模型
