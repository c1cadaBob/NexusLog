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
   - 运行时已开始收敛到 `capability + scope + TenantReadScope`，但路由入口仍保留 `permissions` 兼容层。
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

### 6.3 兼容委派管理的角色分层建议

结合本次讨论，当前方案可兼容收敛为以下四层角色/主体体系：

1. **系统超级管理员**
   - 对应本文的 `platform_super_admin`
   - 平台全局唯一
   - 拥有平台级全部能力
   - 默认具备 `system`、`all_tenants`、`tenant` 范围
   - 可执行日志查询、审计查看、权限分配、系统治理等平台级操作
   - 仅允许绑定到保留主体 `sys-superadmin`

2. **系统用户（系统自动化主体）**
   - 对应本文的 `system_automation`
   - 建议定义为保留系统主体，而不是普通人类用户
   - 用于记录系统自动执行的任务，例如：智能分析、聚合、告警、自动修复、后台调度
   - 默认不允许交互式登录
   - 不参与普通用户生命周期管理，不应出现在邀请、导入、密码重置、批量启停等普通用户流程中

3. **系统管理员（委派管理层）**
   - 建议保留该概念，但明确其本质是“平台委派管理员”，而非平台超级管理员的等价替身
   - 数量不受限
   - 权限由系统超级管理员授予
   - 必须带两个显式约束：
     - `managed_scope`：可管理的租户组或租户范围
     - `grant_ceiling`：最多可授予哪些能力与范围
   - 该角色可进一步按职能拆分为：
     - 偏租户经营与业务配置的 `tenant_admin`
     - 偏身份、角色、登录策略、审计治理的 `security_admin`

4. **其他用户与自定义角色**
   - 数量不受限
   - 可以按业务需要定义角色模板
   - 其权限不应在运行时通过“属于哪个系统管理员”动态推导
   - 正确模型应为：
     - 用户显式绑定角色
     - 角色显式绑定能力
     - 能力显式绑定范围
   - 系统管理员只负责“能否授予”，不负责“运行时如何计算权限”

上述四层设计与本文现有方案并不冲突，但需要补齐以下治理要点：

1. **新增租户组/委派范围概念**
   - 当前文档已有 `self`、`owned`、`assigned`、`tenant`、`all_tenants`、`system` 范围。
   - 若采用“系统管理员负责若干租户组”的设计，则后续数据模型中还需新增：
     - `tenant_group`
     - `managed_scope`
     - `admin_delegation`
   - 否则“系统管理员管理哪些租户”无法被严谨表达。

2. **运行时权限不得依赖管理员归属关系推导**
   - 推荐规则是：
     - 授权阶段：由系统超级管理员或系统管理员决定是否可授予
     - 运行阶段：只看主体、角色、能力、范围、策略条件
   - 这样可以避免“管理员变更导致其下属全部权限漂移”的复杂问题。

3. **系统用户应视为保留主体，不视为普通用户**
   - 虽然名称上可以叫“系统用户”，但运行语义更接近“系统服务主体”或“自动化主体”。
   - 它的核心目的是审计归因与后台动作记录，而不是登录控制台执行人工操作。

4. **系统管理员不应天然拥有平台全权**
   - 即使由系统超级管理员授予，也应受 `managed_scope` 与 `grant_ceiling` 约束。
   - 默认不得拥有 `system` 与 `all_tenants` 级别的无限制能力，除非被明确提升为平台治理角色。

从兼容命名角度看，可采用以下映射关系：

- `系统超级管理员` -> `platform_super_admin`
- `系统用户` -> `system_automation`
- `系统管理员` -> `delegated_admin` / `tenant_admin` / `security_admin`
- `其他用户和角色（可自定义）` -> 自定义角色 + 标准内置角色（如 `operator`、`auditor`、`viewer`）

### 6.4 角色治理规则

1. 平台保留角色不可被普通租户管理员编辑。
2. 平台保留角色不可被普通用户手动绑定。
3. 内置角色可复制为自定义角色，但原角色建议保持只读。
4. 角色分配必须做“授权上限校验”。
5. 角色只是能力集合，运行时鉴权不得再直接依赖角色名。
6. 若引入“系统管理员”委派层，则必须同步落地：
   - 委派范围模型
   - 授权上限模型
   - 租户组/租户绑定模型
   - 委派关系审计日志

### 6.5 角色 × 权限组 × 范围建议

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

### 6.6 默认角色与页面访问关系

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

当前 V1 草案已落地到：`docs/01-architecture/core/07-authorization-matrix-draft.md`

### 方案 B：迁移设计

形成一份可执行的迁移清单：

- 新表结构设计
- 旧权限兼容映射
- 中间件替换计划
- 前端路由守卫改造清单
- 保留主体治理改造清单
- 测试与回归清单

当前 V1 草案已落地到：`docs/01-architecture/core/08-authorization-migration-design.md`

## 16. 对照代码与总体规划后，仍需补齐的设计缺口

在当前版本方案基础上，继续对照以下内容复核后，发现仍有若干尚未完全覆盖的设计点：

- 总体规划与路线图：`docs/NexusLog/10-process/23-project-master-plan-and-task-registry.md`
- 当前 API 蓝图：`docs/NexusLog/10-process/13-current-project-full-api-blueprint.md`
- 多租户 RLS 规划：`docs/NexusLog/20-database/03-v7-rls-multitenancy.md`
- 安全审计基线：`docs/NexusLog/30-delivery-security/08-code-security-audit-baseline.md`
- 现有安全架构文档：`docs/01-architecture/core/05-security-architecture.md`
- 关键运行时代码：`services/api-service/*`、`services/control-plane/*`、`services/data-services/*`

这些缺口不会推翻当前方案，但如果不提前纳入设计，后续在租户治理、Agent、异步任务、导出、合规、Phase 2/3 扩展模块落地时，很容易再次出现权限语义分叉。

### 16.1 入口分层与信任边界

当前方案已定义主体、能力、范围与策略，但尚未把“入口分层”单独建模。

结合蓝图与安全基线，建议增加 `Entry Tier` 概念，至少区分：

- `public`
- `authenticated_session`
- `delegated_admin`
- `platform_admin`
- `internal_service`
- `agent`

原因：

1. 当前蓝图明确要求鉴权模型存在 `public/session/admin` 三层。
2. 安全基线强调内部服务直连、弱验签、头部信任会破坏权限体系的根基。
3. 如果不先明确“哪些入口允许哪类主体访问”，后续再细化角色权限也无法真正闭环。

### 16.2 非人类主体矩阵尚未成型

虽然本文主体模型已包含：

- `service_account`
- `agent`
- `system_reserved`

但当前角色矩阵仍主要面向人类用户与保留系统主体，尚未形成完整的非人类主体授权基线。

建议补充至少两类默认主体：

1. `agent_runtime`
   - 仅允许 Agent 注册、上报、拉取任务、回执、心跳等运行时动作
2. `internal_service`
   - 仅允许内部服务调用、异步任务编排、系统流程协同

说明：

- 代码中 Agent 已经拥有独立鉴权链路，例如 `X-Agent-Key`。
- 指标上报、采集下发、回执、批次处理等都不是普通用户权限能合理表达的。
- 后续若进入 gRPC、事件驱动和后台任务编排，这部分必须单独建模。

### 16.3 范围模型还应预留更细粒度层级

当前范围模型为：

- `self`
- `owned`
- `assigned`
- `tenant`
- `all_tenants`
- `system`

这已经覆盖了当前大部分需求，但对照多租户 RLS 规划后，建议继续预留：

- `tenant_group`
- `project`
- `env`
- `resource`

原因：

1. RLS 规划里已出现 `tenant_id + project_id` 的分层方向。
2. 本文已引入“系统管理员负责若干租户组”的委派概念。
3. 后续成本管理、企业版、多环境、项目级隔离都可能依赖更细作用域。

建议做法：

- 当前先不全部落地，但在数据模型和能力结构上预留扩展位。
- 避免未来从 `tenant` 直接跳到 `project/env` 时再次推翻授权设计。

### 16.4 共享资源与可见性模型未独立定义

当前文档已定义 `query.saved.share`，但还未把“共享资源可见性”抽象成统一规则。

结合现有代码与表结构，建议增加资源可见性模型：

- `private`
- `tenant_shared`
- `system_template`

优先应用到以下资源：

- 收藏查询
- 查询模板
- 报表模板
- 解析模板
- 通知模板
- 规则模板

原因：

1. `saved_queries` 表已存在 `is_public` 字段。
2. 当前实现仍主要按“本人拥有”读取，未来一旦启用共享功能，必须有统一的可见性规则。
3. 如果不提前统一，后续各模块容易各自定义一套 `public/shared/template` 语义。

### 16.5 导出权限还缺“归属范围 + 敏感级别”双维控制

当前文档已有：

- `export.job.create`
- `export.job.read`
- `export.job.download`
- `export.job.cancel`

但还未明确：

1. 导出任务是“仅本人可见”还是“租户内可见”。
2. 导出内容是“脱敏数据”还是“原始数据”。

建议补充两层控制：

1. 资源范围：
   - `export.job.read@owned`
   - `export.job.read@tenant`
2. 数据敏感级别：
   - `log.export.masked`
   - `log.export.unmasked`

这对日志安全、审计与合规非常关键，尤其在后续引入敏感数据导出审批时会直接复用。

### 16.6 身份生命周期与会话治理仍需单独建模

当前方案已覆盖：

- `auth.session.read`
- `auth.session.revoke`
- `auth.login_policy.read`
- `auth.login_policy.update`
- `auth.break_glass.use`

但对照当前代码和周计划，仍建议单独形成“身份生命周期治理”子模型，覆盖：

- 注册
- 邀请
- 导入
- 密码重置
- 登录失败锁定
- 会话轮换
- refresh replay 防护
- break-glass 使用与审计

原因：

1. 这些内容在认证链路里是安全高风险点。
2. 规划文档已明确存在登录锁定、登录策略、会话治理要求。
3. 安全基线也把 logout、session、lockout 列为优先整改项。

### 16.7 审计域还缺“不可篡改”和“合规报告”建模

当前方案已考虑：

- `audit.log.read`
- `audit.log.export`
- `audit.log.write_system`

但对照总体规划，仍建议补充两类能力：

1. 审计完整性能力
   - `audit.log.integrity.verify`
   - `audit.log.append_only`
   - `audit.retention.manage`
2. 合规报告能力
   - `compliance.report.read`
   - `compliance.report.generate`
   - `compliance.report.export`

原因：

1. 规划里明确存在“不可变审计日志”路线。
2. 合规报告是后续阶段的重要输出物。
3. 如果现在只把审计当成“能看、能导出”，后面接不可篡改和合规功能时还会再分叉一次。

### 16.8 租户生命周期、配额与成本治理尚未纳入主模型

当前方案重点在“租户内授权”，但对照总体规划后，后续还需要覆盖：

- 租户创建/禁用/删除
- 租户配额管理
- 成本查看与预算管理

建议新增平台运营类能力：

- `tenant.read`
- `tenant.create`
- `tenant.update`
- `tenant.suspend`
- `tenant.quota.read`
- `tenant.quota.update`
- `cost.read`
- `cost.budget.update`

这部分对于平台经营、企业版和多租户正式商用都是必要项。

### 16.9 异步链路、内部协同与 WebSocket 权限尚未纳入

当前文档主要覆盖：

- 页面访问
- REST API
- 后端同步调用

但对照蓝图，还应补充以下对象的授权策略：

- Kafka / 事件流生产消费主体
- 内部 HTTP / gRPC 服务协同主体
- WebSocket 订阅权限
- 异步任务与后台作业的审计归因

建议后续增加以下设计项：

- `topic.produce.*`
- `topic.consume.*`
- `ws.logs.subscribe`
- `ws.alerts.subscribe`
- `internal.rpc.invoke.*`

这样才能确保实时告警、日志流、异步分析、ML/NLP 作业不会游离于统一授权体系之外。

### 16.10 治理级技术约束尚未写入权限设计

当前权限设计已经比较完整，但仍建议补充以下治理约束：

1. 高风险写接口需支持 `X-Idempotency-Key`
2. 所有权限变更、委派变更、租户变更、导出任务都应能通过 `request_id` 串联审计与服务日志
3. 需提供“旧三角色 → 新角色体系”的兼容映射

原因：

- API 蓝图已明确要求幂等和 `request_id` 关联。
- 当前总体规划仍大量沿用 `admin/operator/viewer` 三角色表述。
- 如果缺少兼容映射，测试、文档、UI 文案与实现会长期不一致。

### 16.11 身份联邦、服务凭证与密钥轮换治理尚未纳入模型

当前方案已经覆盖本地用户、会话与 Agent，但对照安全架构与现有实现后，仍缺少“凭证类型”这一层统一建模。

证据与原因：

1. 安全架构文档明确列出了 `OIDC`、`SAML`、`API Key`、`mTLS` 四类认证方式。
2. 当前数据库迁移仅落了 `user_credentials`（本地密码凭证），而代码中又已经存在 `X-Agent-Key` 这类运行时共享密钥链路。
3. 如果权限模型不区分“人类账号凭证”“系统服务凭证”“Agent 凭证”“联邦身份凭证”，后续 SSO、密钥轮换、凭证吊销、非交互式调用治理都会再次散落到各模块。

建议补充一层“凭证/认证器模型”，至少区分：

- `local_password`
- `oidc_federated`
- `saml_federated`
- `service_api_key`
- `agent_shared_key`
- `mtls_client`

并预留以下治理能力：

- `auth.idp.read`
- `auth.idp.update`
- `credential.read`
- `credential.rotate`
- `credential.revoke`
- `service_account.key.rotate`

### 16.12 高危操作的确认与审批链路尚未建模

当前方案已经考虑了“谁有权限执行某动作”，但还没有独立回答“高危动作是否需要二次确认或审批”。

结合总体规划，这一块应单独纳入授权设计：

1. 路线图已明确提出高危操作需要二次确认，Phase 3 还会引入审批工作流。
2. 删除备份、恢复备份、禁用用户、权限下发、脱敏规则修改等动作，不适合仅凭一个 `delete/update` 能力直接放行。
3. 如果没有审批链路模型，后续实现通常会退化成前端弹窗确认，无法形成真正可审计的双人治理。

建议增加审批相关主体与能力：

- `approval.request.create`
- `approval.request.read`
- `approval.request.approve`
- `approval.request.reject`
- `approval.request.execute`

并明确哪些动作属于：

- 普通确认即可
- 需要双人审批
- 需要超级管理员执行

### 16.13 资源生命周期动作语义尚未统一

当前能力字典里已经有部分显式动作，例如：

- `notification.channel.test`
- `incident.archive`
- `export.job.cancel`
- `backup.restore`

但对照现有代码和路由后，动作语义仍不统一，典型问题包括：

1. 文档中有 `alert.rule.enable`，但代码中真实存在 `alert_rules.disable` 动作。
2. 采集源当前也存在 `disable` 状态流转，但能力字典尚未单独表达。
3. 备份接口规划包含 `download` 与 `cancel`，但当前能力字典只到 `read/create/restore/delete`。

这意味着目前仍有一部分状态迁移动作，被隐含在 `update` 或“其他默认管理权限”里，不利于页面按钮、API 守卫与审计事件统一。

建议建立统一动作词表，明确区分：

- `enable`
- `disable`
- `pause`
- `resume`
- `cancel`
- `download`
- `restore`
- `test`
- `archive`
- `rollback`

并优先补齐以下能力缺口：

- `alert.rule.disable`
- `ingest.source.disable`
- `backup.download`
- `backup.cancel`

### 16.14 用户退场后的资源归属与交接机制尚未定义

当前方案已经覆盖了用户禁用、删除与会话撤销，但对照迁移脚本后，还缺少“用户退场后资源怎么办”的正式设计。

现有迁移已经暴露出这一问题：

1. 删除遗留用户前，需要先把 `alert_rules.created_by`、`notification_channels.created_by`、`incidents.assigned_to`、`export_jobs.created_by` 等字段置空。
2. 这说明当前系统默认允许资源变成“无所有者”状态，而不是先经过交接或归档。
3. 如果将来批量禁用系统管理员、自定义角色持有者或租户负责人，这会直接影响审计追溯、页面展示和后续授权判断。

建议单独补充“主体退场治理”规则：

- 哪些资源允许无所有者
- 哪些资源必须先转交
- 删除与禁用是否采用不同策略
- 审计中如何保留原始归属快照

可预留的能力包括：

- `iam.user.deactivate`
- `iam.user.offboard`
- `resource.transfer_ownership`
- `resource.reassign`

### 16.15 数据生命周期（保留/归档/恢复）治理尚未纳入主模型

当前方案已经覆盖备份恢复与部分审计保留，但对照总体规划、ES/对象存储配置后，仍缺少“日志数据生命周期治理”的完整授权设计。

证据包括：

1. 总体规划已明确“日志保留策略”是扩展项。
2. 存储配置与归档策略中已经出现 retention / archive / restore 相关能力。
3. 日志索引模板里也已存在 `retention_policy`、`pii_masked` 等字段，说明未来页面与 API 会逐步暴露这些治理项。

如果当前只建模 `backup.*`，后续在以下动作上仍会权限漂移：

- 调整日志保留策略
- 触发归档
- 从冷存储/归档恢复
- 查看归档状态与恢复进度

建议补充数据生命周期能力：

- `data.retention.read`
- `data.retention.update`
- `archive.read`
- `archive.restore`
- `archive.delete`

### 16.16 异步/定时任务的授权快照与代理执行语义尚未定义

当前文档已经把异步链路、内部服务和系统自动化主体纳入讨论，但对“用户发起、系统延后执行”的场景仍缺少一层关键定义：

- 创建时按谁的权限校验
- 执行时按谁的身份落审计
- 发起人与执行人不一致时如何归因
- 发起人后续被禁用、降权、移出租户时任务是否继续执行

这在当前规划和代码里都已经不是纯未来问题，而是正在形成中的能力：

1. 前端已经存在 `/reports/scheduled` 页面与对应路由。
2. 页面工作流文档已定义“配置 cron -> 保存任务 -> 查看执行历史/失败重试”。
3. 当前系统已存在 `export_jobs`、采集调度器、`health-worker`、后台 cleanup/job 等异步执行链路。
4. `system-automation` 已被定义为系统自动化归因主体，但尚未与“代执行语义”正式绑定。

建议补充统一规则：

1. **创建校验**：由发起用户在提交任务时完成 capability/scope/approval 校验。
2. **执行身份**：后台真正执行时使用 `system-automation` 或受控 `service_account`。
3. **归因双写**：审计同时记录 `initiator_actor` 与 `executor_actor`。
4. **授权快照**：保存 `authorized_capability_snapshot`、`authorized_scope_snapshot`、`approval_snapshot_id`。
5. **失效策略**：明确“发起人被禁用/降权/退租户后，已有计划任务是否暂停、取消或继续”。

### 16.17 前端真实路由与导航入口仍未完全纳入权限映射

当前 8.2 节给出了路由访问权示例，但对照真实前端代码后，仍然属于“部分示例”，还没有覆盖当前实际存在的页面与导航入口。

对照结果包括：

1. `App.tsx` 中已存在大量实际路由，但 8.2 只映射了其中一部分。
2. `constants/menu.ts` 中的侧边栏已经暴露更多页面，例如：
   - `/analysis/anomaly`
   - `/analysis/clustering`
   - `/incidents/timeline`
   - `/incidents/analysis`
   - `/incidents/sla`
   - `/incidents/archive`
   - `/ingestion/wizard`
   - `/ingestion/status`
   - `/parsing/mapping`
   - `/parsing/masking`
   - `/storage/indices`
   - `/storage/ilm`
   - `/storage/capacity`
   - `/performance/health`
   - `/performance/scaling`
   - `/performance/dr`
   - `/tracing/analysis`
   - `/tracing/topology`
   - `/reports/scheduled`
   - `/reports/downloads`
   - `/cost/budgets`
   - `/cost/optimization`
3. 当前菜单配置里仍直接使用旧权限字符串，如 `users:write`、`users:read`、`audit:read`、`alerts:read`、`incidents:read`，说明“旧权限 → 新 capability”的前端收口还未完成。
4. 除了路由本身，Dashboard 快捷入口、侧边栏、底部导航等多个导航面也需要共用同一套授权事实源。

建议新增“页面注册表 / 路由注册表”治理模型，每个页面至少定义：

- `path`
- `view_capability`
- `action_capabilities`
- `required_feature_gate`
- `navigation_visibility_rule`

否则后续仍会出现“页面能进、菜单不隐藏、按钮却灰掉”或“菜单隐藏但 URL 直达还能打开”的不一致问题。

### 16.18 产品版本能力与功能开关尚未与授权模型解耦

当前文档已经把“有没有权限”讲得越来越完整，但对照蓝图与总体设计后，还缺少另一层独立判断：

- 该租户/环境是否开通了该模块
- 该功能当前是否被 feature flag 打开
- 当前版本回滚时是否通过功能开关降级

证据：

1. API 蓝图已明确存在 `/api/v1/enterprise/*` 与 `/api/v1/advanced/*` 两大模块。
2. 当前设计文档的发布与回滚策略里，已经出现“功能开关降级”。
3. 这说明未来一定会出现“用户有权限，但产品版本未开通”或“版本已开通，但当前灰度未开启”的情况。

因此建议把授权判断拆成三层：

1. `authorization`：主体是否具备 capability + scope
2. `entitlement`：租户或部署是否具备该产品能力
3. `feature_flag`：当前发布窗口是否允许暴露该功能

对于页面和 API，都应预留：

- `required_entitlement`
- `required_feature_flag`

否则后续企业版、高级分析、多租户增强、边缘节点等模块接入时，会把“权限控制”和“产品售卖/开关控制”再次混在一起。

### 16.19 敏感配置与外部凭据的可见性/可编辑性尚未拆分

当前能力字典已经覆盖：

- `notification.channel.read/create/update/delete/test`
- `integration.webhook.read/create/update/delete`
- `settings.global.read/update`
- `settings.version.read/rollback`

但这些能力仍默认把“查看配置元数据”“查看敏感值”“修改敏感值”“测试触发外部请求”混在一起。

对照代码与安全基线，这一块仍有明显缺口：

1. 安全审计基线已明确指出：通知渠道 `config` 曾直接返回 SMTP/Webhook 等敏感字段，测试发送接口还会触发真实对外请求，形成凭据泄露与 SSRF 的复合风险。
2. 配置中心表结构已经区分 `is_sensitive` 与 `value_ref`，说明系统本身也在为“敏感配置不应与普通配置同权”预留能力。
3. 前端集成页仍出现 `API Key / Secret Key`、Webhook Secret 等概念，后续插件、Webhook、通知渠道、全局配置都会遇到同类问题。

建议补充分层模型：

1. **元数据读取**：可查看渠道/配置项是否存在、类型、状态、更新时间。
2. **敏感值读取**：可查看明文 secret / password / token。
3. **敏感值更新**：可轮换或重置 secret，但不必拥有明文读取权。
4. **外部触发测试**：可执行 test/send/ping 等真实出网动作。

建议能力至少拆分为：

- `notification.channel.read_metadata`
- `notification.channel.read_secret`
- `notification.channel.update_secret`
- `notification.channel.test`
- `integration.webhook.read_metadata`
- `integration.webhook.read_secret`
- `integration.webhook.rotate_secret`
- `settings.sensitive.read`
- `settings.sensitive.update`

### 16.20 字段级/分类级数据可见性尚未纳入查询与页面授权

当前方案已经开始处理：

- 脱敏规则管理
- 导出时的 `masked/unmasked` 区分
- 日志数据里的 `pii_masked`
- 字段字典与字段映射

但对照数据模型与规划后，仍缺少“谁可以在页面/API 中看到哪些字段明文”的正式授权设计。

证据包括：

1. 日志索引模板中已经存在 `classification` 与 `pii_masked` 字段。
2. 配置/字段模型中已经出现 `is_sensitive` 这类结构。
3. 总体规划明确要求原始 IP/邮箱/手机号在 ES 中不可检索或需被脱敏。
4. 当前文档只明确了 `log.export.masked/unmasked`，却还没有把相同逻辑推广到实时检索、聚合分析、事件详情、报表、Trace、API 响应等在线读取场景。

如果缺少这一层，后续仍会出现：

- 页面可查到记录，但敏感字段是否显示明文没有统一规则
- 聚合分析和报表可能绕过导出授权模型拿到敏感值
- 字段字典能标记敏感字段，但查询结果并不会自动按角色降级展示

建议把“字段可见性”作为独立维度纳入决策：

- `field_visibility = hidden | masked | raw`
- `data_classification = public | internal | sensitive | restricted`

并预留能力：

- `log.field.masked.read`
- `log.field.raw.read`
- `field.dictionary.sensitive.read`
- `query.result.unmasked.read`

### 16.21 权限撤销传播与缓存失效机制尚未定义

当前文档已经覆盖“权限如何判定”，但还没有明确“权限变化后，系统要多久收口”。

对照现有实现，这已经是一个真实运行时问题：

1. 前端 `authStore` 会在内存中缓存 permissions，并使用短时间去重窗口避免重复同步。
2. 前端还会持久化 `isAuthenticated/user` 状态；菜单、路由守卫、页面按钮通常依赖这一侧的客户端事实源。
3. 后端鉴权虽然会基于当前会话和角色即时校验，但文档尚未定义：角色调整、用户禁用、租户变更、敏感能力回收之后，前端菜单、已打开页面、长轮询、WebSocket、计划任务、后台执行链路应如何及时失效。

如果这一层缺失，常见问题会包括：

- 后端已拒绝，但前端菜单和按钮短时间仍显示可用
- 用户被禁用后，浏览器标签页仍保留旧权限视图
- 已创建的长任务、下载页、实时订阅在撤权后继续保留访问上下文
- 不同服务由于本地缓存/异步同步时延，短时间内产生授权结果不一致

建议增加“授权传播治理”规则：

1. 定义 `authz_epoch` / `permission_version` 之类的版本戳。
2. 规定用户状态、角色绑定、委派范围、租户归属变更后的收口 SLA。
3. 区分哪些动作要求**立即失效**，哪些允许**短暂最终一致**。
4. 明确前端何时必须强制刷新 `GET /users/me`、何时必须主动登出或重载权限。
5. 为 WebSocket、后台任务、计划任务、下载链接等长生命周期对象补充失效规则。

### 16.22 拒绝决策审计与可解释性尚未制度化

当前文档已经有 `Decision` 公式，也规划了审计字段，但对“被拒绝的请求”仍缺少单独治理。

对照现有代码可以看到：

1. 鉴权/授权中间件会返回统一 `401/403` 错误体。
2. 但现有审计中间件主要对写操作默认记审计，对读操作依赖显式设置；并没有把“拒绝访问”本身作为统一审计对象。
3. 这意味着后续在排障、合规取证、误授/误拒分析时，可能只能看到接口失败，却看不到完整的授权决策链路。

建议单独补一层“拒绝决策治理”：

- 审计 `UNAUTHORIZED`
- 审计 `FORBIDDEN`
- 区分认证失败、能力不足、范围不匹配、硬拒绝、审批缺失、特性未开通等原因
- 对高风险拒绝（如尝试读取敏感配置、访问跨租户数据、调用保留主体管理接口）提升审计等级

建议审计/响应里至少保留：

- `decision_result = allow|deny`
- `decision_reason_code`
- `required_capability`
- `required_scope`
- `effective_actor_type`
- `policy_source`
- `matched_hard_rule`

这样后续才能同时满足：

- 用户侧的最小可解释性反馈
- 管理员侧的排障定位
- 审计侧的拒绝行为追踪

### 16.23 临时授权 / JIT 访问与运维代操作尚未建模

当前文档已经考虑：

- `break_glass`
- 审批流
- 系统自动化主体
- 保留主体治理

但对“临时提升权限”“运维代执行”“生产应急访问”这类高风险、短时效访问仍没有形成正式模型。

证据包括：

1. 当前主体模型已经为 `break_glass` 预留了标志位与 `auth.break_glass.use` 能力。
2. 运维/交付文档已明确存在生产双人审核、最小 sudoers、部署账号最小权限这类制度化控制。
3. 审计页面的资源类型筛选中已经出现 `sudo`、`sshd`、`systemd` 等运维侧对象，说明系统实际会面对“平台内授权”与“平台外运维代操作”交织的问题。

如果这一层不单独建模，后续很容易出现两种极端：

- 要么把应急访问直接塞进普通管理员权限，导致长期越权
- 要么所有应急操作都靠线下流程，无法和系统审计、审批、时效控制真正打通

建议补充临时访问模型：

- `temporary_grant`
- `support_access_session`
- `break_glass_session`

并明确以下字段：

- `approved_by`
- `expires_at`
- `justification`
- `target_scope`
- `ticket_id`
- `operated_via`

可预留能力：

- `access.request.create`
- `access.request.approve`
- `access.request.activate`
- `access.request.revoke`
- `support.access.use`

### 16.24 职责分离（SoD）与互斥角色约束尚未形成正式规则

当前文档已经提出：

- `tenant_admin` / `security_admin` 的职能拆分
- 系统管理员应受 `managed_scope` 与 `grant_ceiling` 约束
- 审批链路中可能需要双人治理

但这仍然停留在“建议分工”层面，尚未上升为“系统必须强制校验的互斥约束”。

结合代码与运维制度，仍有两个明显缺口：

1. 当前 API 服务中的 `ErrRoleConflict` 实际只处理“角色已绑定”的重复冲突，不处理“角色语义冲突”或“互斥职责冲突”。
2. 运维交付文档已经对生产变更要求双人审核与最小 sudo，这说明系统外部流程已经在执行职责分离，而系统内部授权模型尚未把这种治理原则制度化。

如果缺少 SoD 规则，后续会出现：

- 同一个人既能提权又能审批自己的高危操作
- 同一个人既能管理登录策略/审计，又能擦除高风险配置或代持敏感权限
- “建议拆分为 tenant_admin/security_admin” 只停留在命名层，无法真正阻止危险组合

建议增加“互斥角色/互斥能力”治理：

- `role_conflict_policy`
- `capability_conflict_policy`
- `approval_self_block`
- `dual_control_required`

并至少定义三类互斥约束：

1. **审批互斥**：申请人与审批人不得为同一主体。
2. **治理互斥**：高风险身份治理能力与部分运行运维能力不得在同一主体长期并存。
3. **审计互斥**：审计只读主体不得拥有影响审计完整性的治理能力。

### 16.25 建议按优先级纳入后续设计

#### P0（必须先补）

1. 入口分层与信任边界
2. 非人类主体矩阵（Agent / 内部服务）
3. 身份生命周期 + 身份联邦 / 服务凭证模型
4. 前端真实路由与导航入口的 capability 映射收口
5. 敏感配置与外部凭据的可见性/可编辑性拆分
6. 权限撤销传播与缓存失效机制
7. 导出权限的归属范围与敏感级别
8. 资源生命周期动作语义（`enable/disable/cancel/download/restore`）

#### P1（应尽快补）

1. 共享资源可见性模型
2. 审计不可篡改与合规报告能力
3. 高危操作确认与审批链路
4. 临时授权 / JIT 访问与运维代操作模型
5. 职责分离（SoD）与互斥角色约束
6. 异步/定时任务的授权快照与代理执行语义
7. 字段级/分类级数据可见性模型
8. 拒绝决策审计与可解释性
9. 用户退场后的资源归属与交接机制
10. 数据生命周期（保留/归档/恢复）治理
11. 作用域扩展位（`tenant_group/project/env/resource`）
12. 治理级技术约束（幂等、`request_id`、旧角色兼容）

#### P2（中期补齐）

1. 租户生命周期、配额、成本治理
2. 异步链路、内部协同与 WebSocket 权限
3. 产品版本能力 / 功能开关与授权解耦
4. 与 Phase 2/3 模块扩展的能力前缀统一

## 17. 结论

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
