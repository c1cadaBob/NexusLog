# 授权与租户治理重构方案（草案）

## 1. 文档目标

本文档用于汇总 NexusLog 当前权限体系、授权规则、租户权限规则与页面访问控制的主要问题，并给出一套统一、可落地的重构方案。

本文档的目标不是直接替代实现，而是作为后续“针对性修改”的统一基线，回答以下问题：

1. 当前系统的授权问题到底出在哪里。
2. 后端、前端、租户边界、保留账号应如何统一建模。
3. 如何覆盖系统现有主要操作与页面访问控制。
4. 如何分阶段迁移，避免一次性大改导致系统不可用。

## 2. 当前系统现状总结

### 2.1 当前并不是一套统一授权系统

当前仓库中至少存在三套并行的鉴权/授权实现：

1. `api-service`：
   - 使用 Bearer JWT + 会话校验。
   - 从数据库加载用户角色，再把 `roles.permissions` 展平成权限字符串列表。
   - 接口权限校验主要通过 `RequirePermission("users:read")`、`RequirePermission("users:write")` 一类中间件实现。
   - 参考：`services/api-service/cmd/api/router.go`、`services/api-service/internal/handler/auth_middleware.go`

2. `data-services/shared/auth`：
   - `query-api`、`audit-api`、`export-api` 共用一套 JWT 身份校验与权限加载逻辑。
   - 运行时仍然基于权限字符串判定，但额外引入了 `global_log_access` 特殊逻辑。
   - 参考：`services/data-services/shared/auth/middleware.go`、`services/data-services/shared/auth/authorization.go`

3. `control-plane`：
   - 先做 JWT 身份校验。
   - 再通过 `RequireOperatorRole` / `RequireAdminRole` 按角色名进行粗粒度授权。
   - 并不真正按 `roles.permissions` 的细粒度权限控制业务接口。
   - 参考：`services/control-plane/cmd/api/main.go`、`services/control-plane/internal/middleware/operator_authorization.go`、`services/control-plane/internal/middleware/admin_authorization.go`

这意味着当前系统的“身份认证”相对接近，但“授权语义”不统一：

- 有的服务按权限字符串。
- 有的服务按角色名。
- 有的服务还夹带用户名/保留角色特判。

这会导致：

- 权限模型无法扩展。
- 新功能很难知道该接哪套规则。
- 前后端展示与后端实际放行规则可能不一致。
- 超管、租户、系统自动化这类特殊主体只能靠硬编码兜底。

### 2.2 当前权限模型过于扁平

当前核心 RBAC 数据模型如下：

- `users`
- `roles`
- `user_roles`
- `roles.permissions JSONB`

参考：`storage/postgresql/migrations/000001_init_schema.up.sql`

其中，权限直接作为字符串数组存储在 `roles.permissions` 中，例如：

- `users:read`
- `users:write`
- `logs:read`
- `logs:export`
- `alerts:read`
- `alerts:write`
- `audit:read`
- `*`

参考：`storage/postgresql/seeds/seed_data.sql`

这套模型的主要问题：

1. 没有统一的权限目录（permission catalog）。
2. 没有资源-动作拆分规范。
3. 没有数据范围（scope）建模。
4. 没有“页面访问权限”和“接口操作权限”的分层。
5. 没有资源实例级、主体属性级、条件级控制。
6. `*` 会不断诱发绕过式设计。

### 2.3 当前租户边界主要靠应用层手工传递

当前系统虽然大量数据表都有 `tenant_id`，例如：

- `users`
- `roles`
- `user_sessions`
- `query_histories`
- `saved_queries`
- `export_jobs`
- `alert_rules`
- `audit_logs`

但租户隔离主要仍然依赖：

- 请求头里的 `X-Tenant-ID`
- JWT claim 中的 `tenant_id`
- 应用代码里手写 `WHERE tenant_id = ...`
- Elasticsearch 查询里手工追加租户过滤

相关参考：

- `services/api-service/internal/handler/auth_middleware.go`
- `services/data-services/shared/auth/middleware.go`
- `services/data-services/query-api/internal/repository/repository.go`
- `services/data-services/export-api/internal/repository/export_repository.go`
- `services/data-services/audit-api/internal/repository/audit_repository.go`

数据库层面虽然存在 RLS 方案草稿：

- `storage/postgresql/rls/tenant_isolation.sql`

但从现有运行时代码中看，没有形成一致、可验证的“每个请求都设置数据库租户上下文”的闭环，因此当前数据库并不是强制租户边界的最终防线。

### 2.4 当前存在多个基于硬编码的特例

典型特例包括：

1. 跨租户日志读取绑定到：
   - 用户名必须是 `sys-superadmin`
   - 角色名必须是 `super_admin`
   - 参考：`services/data-services/shared/auth/authorization.go`

2. `control-plane` 的管理员判断绑定到角色名：
   - `super_admin`
   - `system_admin`
   - `operator`
   - 参考：`services/control-plane/internal/middleware/admin_authorization.go`、`services/control-plane/internal/middleware/operator_authorization.go`

3. 系统保留账号、系统自动化账号治理绑定到用户名与角色名：
   - `sys-superadmin`
   - `system-automation`
   - 参考：`storage/postgresql/migrations/000026_auth_user_governance.up.sql`

这类特例可以暂时解决问题，但会让系统越改越难统一，最终导致授权规则只能靠记忆与经验维护。

### 2.5 前端当前主要是“菜单隐藏”，不是“页面授权”

前端当前路由基本都挂在同一个 `ProtectedRoute` 下，而 `ProtectedRoute` 主要负责：

- 判断是否已登录
- 判断 access token 是否有效
- 必要时刷新 token
- 失效后跳转到登录页

参考：`apps/frontend-console/src/components/auth/ProtectedRoute.tsx`

但它并不负责：

- 校验当前页面是否允许访问
- 校验当前页面的按钮/动作是否允许执行
- 在权限加载失败时安全降级

当前菜单权限只影响侧边栏渲染，参考：

- `apps/frontend-console/src/components/layout/AppSidebar.tsx`
- `apps/frontend-console/src/constants/menu.ts`

因此当前前端存在如下问题：

1. 已登录用户可直接输入 URL 访问业务页面。
2. 菜单隐藏不等于页面不能访问。
3. 部分写操作页面只要具备读权限就能进入。
4. 移动端底部导航与桌面侧边栏权限策略不一致。
5. 权限同步失败时可能回退成展示全量菜单。

## 3. 当前问题清单

### 3.1 架构级问题

1. 认证与授权事实源不统一。
2. `api-service`、`control-plane`、`data-services` 授权语义不一致。
3. 身份模型、角色模型、租户模型、页面访问模型没有统一抽象。
4. 设计文档写的是 `OIDC/Keycloak + OPA/RBAC/ABAC`，实际代码是多套本地实现，架构意图与落地实现已经明显漂移。
   - 参考：`docs/01-architecture/core/05-security-architecture.md`

### 3.2 数据模型问题

1. `roles.permissions JSONB` 过于粗放。
2. 没有一等公民的权限表、能力表、策略表、范围表。
3. `user_roles` 不带独立租户约束，只能依赖应用层保证一致性。
4. 租户上下文没有作为数据库层的硬边界被真正使用。

### 3.3 授权语义问题

1. 读写权限过于粗，例如 `users:write` 覆盖：
   - 创建用户
   - 编辑用户资料
   - 启停用户
   - 删除用户
   - 分配角色
   - 回收角色

2. `logs:read` 覆盖：
   - 实时检索
   - 聚合统计
   - 查询历史
   - 保存查询
   - 共享查询

3. `logs:export` 覆盖：
   - 创建导出任务
   - 查看导出任务
   - 下载导出文件

4. `control-plane` 中很多业务能力根本没有细粒度权限映射。

### 3.4 租户治理问题

1. 跨租户访问规则没有被显式建模，只是个别接口里的特殊逻辑。
2. 平台级资源与租户级资源边界不清。
3. `tenant_id IS NULL OR tenant_id = ?` 之类混合语义在扩展时容易失控。
4. 租户初始化、内置角色初始化、新租户授权基线尚未统一。

### 3.5 页面访问控制问题

已通过前端调试确认的典型问题如下：

1. 已登录用户可直链访问无菜单入口或无菜单权限的页面。
2. `alerts:read` 等只读权限可进入包含“新建、编辑、删除”动作的页面。
3. 移动端导航未按权限过滤。
4. 权限同步失败时菜单可能退回全量展示。

前端调试证据如下：

#### 证据 A：可直链访问设置页面

- 目标 URL：`http://127.0.0.1:4174/#/settings/parameters`
- Console：仅见表单可访问性 issue，无权限报错
- Network：`/api/v1/users/me` 返回 `200`，权限仅 `['alerts:read']`
- 可复现步骤：
  1. 写入已登录本地会话
  2. 打开 `#/settings/parameters`
  3. 侧边栏无“系统设置”菜单
  4. 主区域仍渲染“系统参数配置”页

#### 证据 B：只读权限可进入可写页面

- 目标 URL：`http://127.0.0.1:4174/#/alerts/rules`
- Console：仅见表单 issue
- Network：`/api/v1/alert/rules?page=1&page_size=200` 与 `/api/v1/users/me` 均为 `200`
- 可复现步骤：
  1. 以仅拥有 `['alerts:read']` 的用户登录
  2. 打开 `#/alerts/rules`
  3. 页面仍显示“新建规则”、编辑、删除等按钮

#### 证据 C：移动端导航绕过权限过滤

- 目标 URL：`http://127.0.0.1:4174/#/`
- Console：无异常消息
- Network：`/api/v1/users/me` 返回 `200`
- 可复现步骤：
  1. 切换移动端视口
  2. 以仅拥有 `['alerts:read']` 的用户登录
  3. 底部导航仍显示“告警”“设置”

#### 证据 D：权限接口失败时菜单回退全量

- 目标 URL：`http://127.0.0.1:4173/#/`
- Console：存在 `404` 资源错误
- Network：`/api/v1/users/me` 为 `404`
- 可复现步骤：
  1. 使用无后端的静态站点打开首页
  2. 打开菜单
  3. 仍可看到完整管理类菜单

相关实现参考：

- `apps/frontend-console/src/App.tsx`
- `apps/frontend-console/src/components/auth/ProtectedRoute.tsx`
- `apps/frontend-console/src/components/layout/AppSidebar.tsx`
- `apps/frontend-console/src/components/layout/MobileBottomNav.tsx`
- `apps/frontend-console/src/stores/authStore.ts`
- `apps/frontend-console/src/constants/menu.ts`

## 4. 重构目标

新方案必须同时满足以下目标：

1. **统一授权语义**
   - 所有服务都以同一种能力模型进行授权，不再出现“某些服务按角色名、某些服务按权限串、某些服务按用户名特判”的情况。

2. **前后端同源**
   - 菜单、页面、按钮、接口都使用同一份授权结果。
   - 前端只能展示后端明确允许的能力；后端仍然是最终裁决者。

3. **租户边界强约束**
   - 租户访问默认受限。
   - 跨租户访问必须显式授权。
   - 数据库、应用、搜索层都要形成一致边界。

4. **平台级保留主体可治理**
   - `sys-superadmin` 与 `system-automation` 这类保留主体必须由制度化规则管理，而不是散落在业务代码里。

5. **可覆盖现有全部主要业务操作**
   - 日志查询
   - 导出
   - 审计
   - 用户与角色
   - 告警
   - 事件
   - 通知
   - 采集与接入
   - 指标与资源阈值
   - 备份恢复
   - 系统设置
   - 集成开放平台
   - 以及页面访问与按钮动作权限

6. **具备分阶段迁移能力**
   - 新旧权限可以有兼容层。
   - 可以逐步替换中间件与页面路由控制。
   - 不要求一次性推翻所有实现。

## 5. 统一授权模型

建议将全系统统一为以下模型：

`Subject -> Capability -> Scope -> Policy -> Decision`

### 5.1 Subject（主体）

主体是“谁在执行操作”，统一抽象为：

1. `human_user`
   - 普通人工用户
2. `service_account`
   - 系统内部服务账号
3. `agent`
   - 采集 Agent、上报 Agent、机器身份
4. `system_reserved`
   - 保留系统主体，如 `sys-superadmin`、`system-automation`

所有主体在运行时都应被统一映射为 `Actor`：

- `actor_id`
- `actor_type`
- `tenant_id`
- `principal_name`
- `assigned_roles`
- `effective_capabilities`
- `effective_scopes`
- `flags`（如 `reserved`、`interactive_login_allowed`、`break_glass`）

### 5.2 Capability（能力）

能力替代当前零散的权限字符串，统一命名为：

`resource.action`

例如：

- `iam.user.read`
- `iam.user.create`
- `iam.user.update_profile`
- `iam.user.update_status`
- `iam.user.delete`
- `iam.user.grant_role`
- `iam.role.read`
- `iam.role.create`
- `auth.login_policy.read`
- `auth.login_policy.update`
- `audit.log.read`
- `audit.log.export`
- `log.query.read`
- `log.query.aggregate`
- `query.saved.create`
- `export.job.create`
- `export.job.download`
- `alert.rule.create`
- `incident.assign`
- `notification.channel.test`
- `ingest.dead_letter.replay`
- `backup.restore`
- `settings.global.update`

### 5.3 Scope（数据范围）

能力必须与范围一起判定，建议统一采用以下范围：

- `self`：仅本人
- `owned`：本人创建的资源
- `assigned`：分派给本人处理的资源
- `tenant`：本租户全部资源
- `all_tenants`：所有租户资源
- `system`：平台级系统资源

示例：

- `query.history.read@self`
- `query.saved.read@tenant`
- `alert.rule.update@tenant`
- `audit.log.read@tenant`
- `audit.log.read@all_tenants`
- `settings.global.update@system`

### 5.4 Policy（条件规则）

当仅靠能力与范围仍不足以判断时，引入策略条件，例如：

- 是否是资源所有者
- 是否是当前指派人
- 是否是保留账号
- 是否是保留角色
- 是否允许跨租户
- 是否允许对系统资源写入
- 是否允许交互式登录
- 是否允许导出敏感数据

推荐硬拒绝规则优先级最高：

1. 非平台主体不能跨租户
2. 非保留管理流不得修改保留主体
3. 审计日志不得被删除
4. 任何角色不得授予超出授权人上限的能力
5. 普通租户管理员不得授予 `system` 或 `all_tenants` 范围能力

### 5.5 Decision（决策）

统一决策公式建议为：

`已认证 && 主体有效 && 具备能力 && 范围匹配 && 条件通过 && 非硬拒绝`

## 6. 新角色体系建议

角色不再是授权判断的最终依据，而是能力集合的载体。建议内置如下角色：

### 6.1 平台级角色

1. `platform_super_admin`
   - 平台唯一超级管理员
   - 仅允许绑定到 `sys-superadmin`
   - 拥有平台级治理能力
   - 默认可拥有 `all_tenants` / `system` 范围

2. `system_automation`
   - 系统自动化主体专属角色
   - 用于后台任务、自动修复、系统流程、审计归因
   - 默认不允许交互式登录
   - 只授予必要能力

### 6.2 租户级角色

1. `tenant_admin`
   - 租户管理员
   - 可管理租户内用户、角色、业务配置
   - 默认不拥有跨租户与系统级写权限

2. `security_admin`
   - 安全治理管理员
   - 重点管理用户、角色、登录策略、审计查看
   - 不默认拥有所有业务写权限

3. `operator`
   - 运维操作员
   - 重点负责日志检索、告警、事件、采集运行态、通知等

4. `auditor`
   - 审计员
   - 以只读访问审计、日志证据、导出记录为主

5. `viewer`
   - 业务只读用户

### 6.3 角色治理规则

1. 平台保留角色不可被普通租户管理员编辑。
2. 平台保留角色不可被普通用户手动绑定。
3. 内置角色可复制为自定义角色，但原角色建议保持只读。
4. 角色分配必须做“授权上限校验”。
5. 角色只是能力集合，运行时鉴权不得再直接依赖角色名。

### 6.4 角色 × 权限组 × 范围建议

为便于后续落地，建议将内置角色的默认授权基线整理如下。

| 角色 | 主体类型 | 默认范围 | IAM/角色治理 | 认证/登录治理 | 审计/导出 | 日志查询/分析 | 告警/通知/事件 | 采集/接入/字段 | 指标/备份/设置 | 集成开放 | 备注 |
|------|----------|----------|--------------|----------------|-----------|----------------|----------------|----------------|----------------|----------|------|
| `platform_super_admin` | `system_reserved` | `system` + `all_tenants` + `tenant` | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 | 全部 | 平台唯一超级管理员，仅绑定 `sys-superadmin` |
| `system_automation` | `system_reserved` / `service_account` | `system`，必要时 `tenant` | 无人工治理权限 | 受限 | 受限 | 受限 | 受限 | 受限 | 受限 | 受限 | 仅执行系统流程，默认不允许交互式登录 |
| `tenant_admin` | `human_user` | `tenant` | 全部@`tenant` | 大部分@`tenant` | 只读/导出@`tenant` | 全部@`tenant` | 全部@`tenant` | 全部@`tenant` | 大部分@`tenant` | 大部分@`tenant` | 不得授予 `system` / `all_tenants` 能力 |
| `security_admin` | `human_user` | `tenant` | 全部@`tenant` | 全部@`tenant` | 全部@`tenant` | 只读@`tenant` | 只读@`tenant` | 只读@`tenant` | 只读@`tenant` | 只读@`tenant` | 重点负责账户、角色、登录策略、审计治理 |
| `operator` | `human_user` | `tenant` + `assigned` + `owned` | 只读或无 | 无 | 只读/按需导出 | 全部@`tenant` | 全部@`tenant` | 运行态管理@`tenant` | 指标读写、备份只读、设置只读 | 按需只读 | 负责日常运维与处置，不管理身份体系 |
| `auditor` | `human_user` | `tenant`，可选 `all_tenants`（仅平台审计） | 无 | 只读 | 全部@`tenant` | 只读@`tenant` | 只读@`tenant` | 只读@`tenant` | 只读@`tenant` | 只读@`tenant` | 默认不允许业务写操作 |
| `viewer` | `human_user` | `self` + `tenant`（只读） | 无 | 无 | 无或只读 | 只读@`tenant` | 只读@`tenant` | 只读@`tenant` | 只读@`tenant` | 只读@`tenant` | 不允许任何写操作 |

补充说明：

1. “全部”指该权限组下的读、创建、更新、删除、分配、启停等动作均可授权，但仍受硬拒绝规则约束。
2. “大部分”指租户内可配置、可治理的能力可授权，但平台级能力与保留主体治理不在此列。
3. “受限”表示仅允许系统流程所需的白名单动作，例如 `audit.log.write_system`、部分后台任务读写、必要的运行态维护动作。
4. `tenant_admin` 与 `security_admin` 的核心区别是：前者偏租户经营与业务配置，后者偏身份、角色、登录策略、审计治理。
5. `operator` 与 `auditor` 的核心区别是：前者可执行业务运行动作，后者原则上只读。
6. 除 `platform_super_admin` 外，其他角色默认均不得直接拥有 `system` 或 `all_tenants` 范围能力；如确需平台审计，可通过单独平台角色授予。

### 6.5 默认角色与页面访问关系

建议按“默认角色 -> 页面层级”建立初始映射：

| 角色 | 默认可访问页面层级 |
|------|------------------|
| `platform_super_admin` | 全部页面 |
| `system_automation` | 无人工页面，仅系统流程接口 |
| `tenant_admin` | 租户内全部管理页与业务页 |
| `security_admin` | 安全与审计、用户角色、登录策略、部分只读业务页 |
| `operator` | 检索、告警、事件、采集、指标、部分导出页 |
| `auditor` | 审计、检索、导出记录、只读业务页 |
| `viewer` | 仪表盘、检索、只读业务页、帮助页 |

后续如需实现页面矩阵，可继续细化为：

- 页面路由
- 页面所需 `view capability`
- 页面内动作所需 `action capability`
- 页面数据范围基线

## 7. 权限字典与能力分组建议

### 7.1 IAM / 身份治理

- `iam.user.read`
- `iam.user.create`
- `iam.user.update_profile`
- `iam.user.update_status`
- `iam.user.reset_password`
- `iam.user.delete`
- `iam.user.invite`
- `iam.user.import`
- `iam.user.grant_role`
- `iam.user.revoke_role`
- `iam.role.read`
- `iam.role.create`
- `iam.role.update`
- `iam.role.delete`
- `iam.role.bind_capability`

### 7.2 认证与登录治理

- `auth.session.read`
- `auth.session.revoke`
- `auth.login_policy.read`
- `auth.login_policy.update`
- `auth.break_glass.use`

### 7.3 审计与导出

- `audit.log.read`
- `audit.log.export`
- `audit.log.write_system`
- `export.job.create`
- `export.job.read`
- `export.job.download`
- `export.job.cancel`

### 7.4 日志检索与查询元数据

- `log.query.read`
- `log.query.aggregate`
- `log.query.analyze`
- `query.history.read`
- `query.history.delete`
- `query.saved.read`
- `query.saved.create`
- `query.saved.update`
- `query.saved.delete`
- `query.saved.share`

### 7.5 告警、通知、事件

- `alert.event.read`
- `alert.rule.read`
- `alert.rule.create`
- `alert.rule.update`
- `alert.rule.delete`
- `alert.rule.enable`
- `alert.silence.read`
- `alert.silence.create`
- `alert.silence.update`
- `alert.silence.delete`
- `notification.channel.read`
- `notification.channel.create`
- `notification.channel.update`
- `notification.channel.delete`
- `notification.channel.test`
- `incident.read`
- `incident.create`
- `incident.update`
- `incident.assign`
- `incident.close`
- `incident.archive`

### 7.6 采集、接入、字段治理

- `ingest.source.read`
- `ingest.source.create`
- `ingest.source.update`
- `ingest.source.delete`
- `ingest.task.read`
- `ingest.task.run`
- `ingest.package.read`
- `ingest.receipt.create`
- `ingest.dead_letter.read`
- `ingest.dead_letter.replay`
- `agent.read`
- `agent.register`
- `agent.rotate_key`
- `parse.rule.read`
- `parse.rule.update`
- `field.dictionary.read`
- `field.dictionary.update`
- `masking.rule.read`
- `masking.rule.update`

### 7.7 指标、资源、备份、设置

- `metric.read`
- `metric.report`
- `resource.threshold.read`
- `resource.threshold.create`
- `resource.threshold.update`
- `resource.threshold.delete`
- `backup.read`
- `backup.create`
- `backup.restore`
- `backup.delete`
- `settings.parameter.read`
- `settings.parameter.update`
- `settings.global.read`
- `settings.global.update`
- `settings.version.read`
- `settings.version.rollback`

### 7.8 集成与开放平台

- `integration.api_doc.read`
- `integration.webhook.read`
- `integration.webhook.create`
- `integration.webhook.update`
- `integration.webhook.delete`
- `integration.sdk.read`
- `integration.plugin.read`
- `integration.plugin.install`

### 7.9 其他页面能力

- `dashboard.read`
- `trace.read`
- `report.read`
- `report.create`
- `report.schedule.read`
- `report.schedule.update`
- `report.download.read`
- `cost.read`
- `cost.budget.update`
- `help.read`

## 8. 页面访问控制方案

### 8.1 页面访问必须分三层

前端页面访问必须拆成：

1. **路由访问权**
2. **页内动作权**
3. **数据范围权**

### 8.2 路由访问权

每个页面都必须绑定一个 `view capability`，建议示例如下：

- `/` -> `dashboard.read`
- `/search/realtime` -> `log.query.read`
- `/search/history` -> `query.history.read`
- `/search/saved` -> `query.saved.read`
- `/analysis/aggregate` -> `log.query.aggregate`
- `/alerts/list` -> `alert.event.read`
- `/alerts/rules` -> `alert.rule.read`
- `/alerts/notifications` -> `notification.channel.read`
- `/alerts/silence` -> `alert.silence.read`
- `/incidents/list` -> `incident.read`
- `/incidents/detail/:id` -> `incident.read`
- `/ingestion/sources` -> `ingest.source.read`
- `/ingestion/agents` -> `agent.read`
- `/parsing/rules` -> `parse.rule.read`
- `/parsing/dictionary` -> `field.dictionary.read`
- `/storage/backup` -> `backup.read`
- `/performance/monitoring` -> `metric.read`
- `/reports/management` -> `report.read`
- `/security/users` -> `iam.user.read`
- `/security/roles` -> `iam.role.read`
- `/security/audit` -> `audit.log.read`
- `/security/login-policy` -> `auth.login_policy.read`
- `/settings/parameters` -> `settings.parameter.read`
- `/settings/global` -> `settings.global.read`
- `/settings/versions` -> `settings.version.read`
- `/integration/api` -> `integration.api_doc.read`
- `/integration/webhook` -> `integration.webhook.read`
- `/integration/sdk` -> `integration.sdk.read`
- `/integration/plugins` -> `integration.plugin.read`
- `/cost/overview` -> `cost.read`
- `/help/*` -> `help.read`

### 8.3 页内动作权

页面可访问不代表页面上的所有按钮都可用，例如：

- 进入 `/alerts/rules` 仅要求 `alert.rule.read`
- “新建规则”要求 `alert.rule.create`
- “编辑规则”要求 `alert.rule.update`
- “删除规则”要求 `alert.rule.delete`
- “启用/停用规则”要求 `alert.rule.enable`

同理：

- 用户列表页面可见 ≠ 可分配角色
- 审计页面可见 ≠ 可导出
- 导出任务列表可见 ≠ 可下载全部租户文件
- 通知配置页面可见 ≠ 可发送测试请求

### 8.4 数据范围权

页面渲染的数据仍需按范围收敛：

- 查询历史默认 `self`
- 保存查询默认 `self` 或 `tenant`
- 事件列表通常 `tenant`
- 审计日志通常 `tenant`，平台审计才可 `all_tenants`
- 系统设置通常 `system`

### 8.5 前端实现建议

建议增加统一授权引导接口，例如：

- `GET /api/v1/authz/bootstrap`

返回内容至少包括：

- `actor`
- `capabilities`
- `scopes`
- `route_access`
- `ui_actions`
- `reserved_subject_rules`

然后由以下位置统一消费：

- 侧边栏菜单
- 移动端导航
- 路由守卫
- 页面按钮显隐
- 批量操作显隐

## 9. 接口授权方案

### 9.1 统一中间件

建议逐步统一为：

- `RequireAuthenticatedActor`
- `RequireCapability(capability, scopeResolver)`

而不是继续保留：

- 一部分 `RequirePermission`
- 一部分 `RequireOperatorRole`
- 一部分 `RequireAdminRole`
- 一部分用户名特判

### 9.2 后端统一规则

所有服务都应遵循：

1. 身份认证只负责解析并验证主体。
2. 授权中间件只负责判断能力、范围、条件。
3. 业务代码不再直接判断角色名或用户名。
4. 后端接口永远是最终裁决者。

### 9.3 兼容层建议

考虑到当前已有旧权限字符串，迁移初期可保留兼容映射，例如：

- `users:read` -> `iam.user.read`
- `users:write` -> `iam.user.create` / `iam.user.update_profile` / `iam.user.update_status` / `iam.user.delete` / `iam.user.grant_role` / `iam.user.revoke_role`
- `logs:read` -> `log.query.read` / `log.query.aggregate` / `query.history.read` / `query.saved.read`
- `logs:export` -> `export.job.create` / `export.job.read` / `export.job.download`
- `audit:read` -> `audit.log.read`

但兼容层只应作为过渡，不应长期保留为正式权限模型。

## 10. 租户治理方案

### 10.1 租户访问默认原则

1. 默认所有操作只能作用于本租户。
2. 跨租户访问必须显式授予 `all_tenants` 范围。
3. 平台级资源只能由平台级角色访问。
4. 租户管理员不能管理平台级主体与平台级资源。

### 10.2 数据层治理原则

1. 所有业务表都应明确其作用域：
   - `tenant`
   - `system`
   - 或极少数 `global`

2. 避免继续扩散 `tenant_id IS NULL OR tenant_id = ?` 一类混合语义。
3. PostgreSQL 应逐步启用真正的请求级上下文设置，例如：
   - `SET LOCAL app.current_tenant_id = ...`
   - `SET LOCAL app.current_actor_id = ...`
   - `SET LOCAL app.current_scope = ...`
4. RLS 应作为兜底强约束，而不是文档摆设。
5. Elasticsearch 层也必须按统一 scope 注入租户过滤器。

### 10.3 特殊跨租户能力

当前 `sys-superadmin + super_admin` 的跨租户日志读取逻辑，应改为：

- 具备 `log.query.read@all_tenants` 能力的主体可跨租户查询
- 不再依赖用户名/角色名硬编码

## 11. 保留账号与系统自动化治理

### 11.1 平台保留主体

建议将以下主体定义为保留主体：

1. `sys-superadmin`
2. `system-automation`

平台保留主体必须具备显式属性：

- `reserved = true`
- `managed_by = platform_governance`
- `interactive_login_allowed = true/false`
- `break_glass = true/false`

### 11.2 运行时硬规则

普通 UI / API 不得对保留主体执行：

- 邀请
- 导入
- 删除
- 禁用
- 密码重置
- 改绑普通角色
- 批量状态操作

必须保留的规则：

- `sys-superadmin`：平台唯一超级管理员
- `system-automation`：系统自动化归因主体，不允许交互式登录

### 11.3 审计要求

审计日志应至少记录：

- `actor_id`
- `actor_type`
- `actor_display_name_snapshot`
- `decision_capability`
- `decision_scope`
- `target_type`
- `target_id`
- `tenant_id`
- `request_id`
- `result`
- `reason`

这样才能区分：

- 人工操作
- 系统自动化操作
- Agent 行为
- 平台治理行为

## 12. 覆盖系统主要功能域的授权建议

### 12.1 已有后端能力域

结合现有服务，建议优先覆盖：

1. `api-service`
   - 认证
   - 用户
   - 角色

2. `query-api`
   - 日志查询
   - 查询历史
   - 保存查询
   - 聚合统计

3. `export-api`
   - 导出任务创建
   - 导出任务查看
   - 导出文件下载

4. `audit-api`
   - 审计日志查询

5. `control-plane`
   - 告警规则
   - 告警事件
   - 静默策略
   - 通知渠道
   - 事件
   - 指标查询
   - 阈值管理
   - 备份恢复
   - 采集与接入运行态

### 12.2 前端页面域

即便部分页面当前仍是本地模拟或占位实现，也应先定义清晰的访问能力，否则后续真实接 API 时还会重复出现权限漂移问题。

需统一治理的页面域包括：

- 监控与概览
- 日志检索
- 日志分析
- 告警中心
- 事件管理
- 数据接入
- 解析与字段
- 存储与性能
- 分布式追踪
- 报表中心
- 安全与审计
- 集成与开放平台
- 成本管理
- 系统设置
- 帮助中心

## 13. 分阶段落地建议

### Phase 0：统一事实源

先统一两件事情：

1. **认证事实源**
   - 明确 JWT 的唯一签发与校验链路
   - 明确是继续本地 IAM，还是收敛到外部 IdP/Keycloak

2. **租户事实源**
   - 统一租户配置来源
   - 消除数据库租户配置与网关租户文件的双轨制

### Phase 1：建立能力字典与兼容映射

1. 建立权限/能力目录表
2. 定义旧权限到新能力的映射
3. 建立角色-能力关系
4. 提供 `/authz/bootstrap` 或等价接口

### Phase 2：前端路由与 UI 授权统一

1. 菜单、移动端导航、路由守卫改用同一份授权结果
2. 页面级访问控制替代单纯菜单隐藏
3. 按钮级动作控制替代页面级粗放控制
4. 权限加载失败时默认最小可见，而不是全量可见

### Phase 3：后端授权中间件统一

1. 将 `control-plane` 从按角色名授权迁移到按能力授权
2. 清理用户名/保留角色特判
3. 将 `query-api`、`export-api`、`audit-api` 的粗粒度权限拆细
4. 新业务统一走 `RequireCapability`

### Phase 4：租户与保留主体治理收口

1. 补齐租户范围模型
2. 落实 RLS 上下文
3. 收口保留账号/保留角色的治理规则
4. 审计授权变更、导出、跨租户访问等高风险动作

### Phase 5：策略引擎外置（可选）

若后续确实需要更复杂的 ABAC / PBAC，可在统一语义稳定后再接入：

- OPA
- Cedar
- Casbin

但不建议在当前三套规则并存的基础上直接上策略引擎。

## 14. 优先级建议

### P0（必须先改）

1. 统一页面访问控制，不再允许直链绕过。
2. 统一后端授权语义，停止新增角色名硬编码。
3. 清理跨租户读取的用户名/角色名硬编码。
4. 让权限同步失败时默认最小暴露，而不是全量暴露。

### P1（应尽快完成）

1. 建立能力字典。
2. 拆分粗粒度权限。
3. 建立保留主体统一治理规则。
4. 把移动端导航纳入同一权限系统。

### P2（中期完成）

1. 数据库层真正启用租户上下文与 RLS。
2. 统一新租户初始化与内置角色基线。
3. 引入系统级/平台级资源边界。

## 15. 建议的下一步产出

基于本文档，下一步建议输出以下两类具体材料之一：

### 方案 A：权限矩阵

形成一张覆盖以下维度的矩阵表：

- 页面
- 路由
- 后端接口
- 能力
- 范围
- 默认角色
- 是否保留能力
- 是否高风险操作

### 方案 B：迁移设计

形成一份可执行的迁移清单：

- 新表结构设计
- 旧权限兼容映射
- 中间件替换计划
- 前端路由守卫改造清单
- 保留主体治理改造清单
- 测试与回归清单

## 16. 结论

当前 NexusLog 的问题并不是“少几个权限字符串”，而是：

1. 授权语义不统一
2. 页面授权与接口授权脱节
3. 租户边界没有强制收口
4. 保留主体治理依赖硬编码
5. 权限模型无法承载后续平台化扩展

因此，推荐方向不是继续打补丁，而是统一为：

- 一套主体模型
- 一套能力字典
- 一套范围模型
- 一套路由与接口授权链路
- 一套保留主体治理规则
- 一套分阶段迁移路径

在这个基础上，再进行针对性修改，成本会更可控，后续也更容易验收。