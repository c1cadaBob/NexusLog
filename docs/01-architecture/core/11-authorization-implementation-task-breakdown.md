# 11. 授权改造实施任务拆解单（V1）

## 1. 文档目标

本文档将以下设计进一步拆成可执行的实施任务：

- `docs/01-architecture/core/08-authorization-migration-design.md`
- `docs/01-architecture/core/09-authorization-ddl-draft.md`
- `docs/01-architecture/core/10-authorization-legacy-permission-mapping-draft.md`

与前面几份文档的区别是：

- `08` 解决“如何迁移”
- `09` 解决“数据库怎么落表”
- `10` 解决“旧权限怎么兼容映射”
- `11` 解决“代码到底改哪些文件、先改什么、每个文件改什么”

本文档的目标不是给出完整代码，而是形成一份**可直接进入开发排期**的任务清单。

## 2. 总体实施原则

### 2.1 分四条工作流推进

建议按四条工作流并行推进，而不是所有文件同时大改：

1. **工作流 A：随机租户 ID 治理**
2. **工作流 B：后端授权上下文与 `/users/me` 改造**
3. **工作流 C：统一 capability 中间件与共享鉴权链路改造**
4. **工作流 D：前端 `ProtectedRoute` / `authStore` / 菜单 / 路由注册表改造**

### 2.2 迁移期间保留双轨

实施阶段必须同时满足：

- 旧 `permissions` 继续可返回、可判定
- 新 `capabilities/scopes/authz_epoch` 同步返回
- 高风险写接口优先 capability 化
- 前端菜单与页面可短期保留“过渡别名”，但后端 API 不再继续扩权

### 2.3 本轮重点是“文件级拆解”，不是“一次性编码”

因此本文档会同时覆盖：

- 需要修改的现有文件
- 建议新增的文件
- 每个文件的职责变化
- 推荐优先级（P0/P1/P2）
- 与随机租户 ID 的关系

## 3. 工作流 A：随机租户 ID 治理

## 3.1 目标

当前仓库仍存在“默认租户 UUID 被写成固定、可预测值”的实现与示例。

这会带来三个问题：

1. 默认租户主键可预测
2. 文档、种子、运行时配置耦合在同一个固定值上
3. 后续多租户 bootstrap、租户隔离与安全审计会被固定 UUID 拖住

目标状态应为：

- 租户主键始终由数据库随机生成
- 代码与迁移脚本通过业务键或配置解析目标租户
- 不再依赖公开、固定、可预测的默认租户 UUID

## 3.2 文件级任务拆解

### P0：数据库与种子

| 文件 | 当前职责 | 需要改动 | 与随机租户 ID 的关系 |
|---|---|---|---|
| `storage/postgresql/seeds/seed_data.sql` | 开发环境默认租户、角色、用户种子 | 去掉写死的租户 UUID；默认租户改为 `INSERT ... RETURNING id` 或按 `name='default'` 回查；后续角色种子通过 `tenant.name` 关联，不直接写固定主键 | 这是默认租户固定 UUID 的主要来源之一 |
| `storage/postgresql/migrations/000018_roles_seed_data.up.sql` | 早期默认角色种子迁移 | 移除固定 `tenant_id` 插入；改为通过租户业务键回查默认租户，或将默认角色种子收敛到后续治理迁移统一处理 | 若保留该迁移，任何从零初始化环境都会重新引入固定租户主键 |
| `storage/postgresql/migrations/000026_auth_user_governance.up.sql` | 收敛 `sys-superadmin` / `system-automation` / 默认内置角色 | 去掉对固定默认租户 UUID 的直接依赖；统一通过 `WITH target_tenant AS (...)` 查租户；若要创建默认租户，应让 `obs.tenant.id` 使用 DB 默认随机 UUID | 否则保留主体治理仍然绑定到固定租户主键 |
| `storage/postgresql/migrations/000026_auth_user_governance.down.sql` | 回滚用户治理与保留主体 | 与 `up.sql` 同步改造：不再按固定 UUID 删除/恢复，而是按租户业务键或迁移记录查找目标租户 | 回滚也不能重新引入固定 UUID 假设 |

### P0：运行时代码

| 文件 | 当前职责 | 需要改动 | 与随机租户 ID 的关系 |
|---|---|---|---|
| `services/control-plane/internal/ingest/store_pg_common.go` | ingest PG 后端默认租户兜底 | 删除固定默认租户 UUID 的硬编码兜底；改为“显式配置 / 请求上下文 / 启动失败”三选一；缺失租户时不要默默落到固定租户 | 当前控制面 ingest 仍把固定 UUID 当系统默认租户 |
| `apps/frontend-console/public/config/app-config.json` | 前端默认运行时配置 | 去掉仓库内固定 `tenantId`；改为部署注入、环境覆盖或空值；开发环境若需要示例值，也应使用临时随机 UUID 而不是固定值 | 当前前端运行时配置直接暴露固定租户 UUID |
| `apps/frontend-console/src/config/runtime-config.ts` | 加载并缓存运行时配置 | 保留 `tenantId` 支持，但明确它只是“部署时注入的当前环境租户”；不再假定它是固定常量；当 `tenantId` 为空时给出明确错误或引导，而不是依赖静态默认值 | 这里决定前端是否继续传播固定租户 |

### P1：前端登录与 API 头部传播

| 文件 | 当前职责 | 需要改动 | 与随机租户 ID 的关系 |
|---|---|---|---|
| `apps/frontend-console/src/components/auth/LoginForm.tsx` | 登录、写本地会话、同步租户 ID | 保持 `X-Tenant-ID` 头逻辑，但不再假定固定默认值存在；错误提示改为“租户未配置”而不是暗示固定本地键就是标准来源 | 登录链路是用户接触租户 ID 的第一入口 |
| `apps/frontend-console/src/components/auth/RegisterForm.tsx` | 注册请求 | 同步改造租户解析逻辑，避免固定默认租户依赖 | 与登录一致 |
| `apps/frontend-console/src/components/auth/ForgotPasswordForm.tsx` | 密码重置请求 | 同步改造租户解析逻辑与错误提示 | 与登录一致 |
| `apps/frontend-console/src/api/auth.ts` | 注销请求 | 保持从当前运行时配置 / 本地上下文读取租户，不依赖固定默认值 | 避免仓库级固定租户传到 API |
| `apps/frontend-console/src/api/user.ts` | 用户与 `/users/me` 请求 | 同步移除“固定租户默认值”的任何隐式假设 | `/users/me` 是授权上下文入口 |
| `apps/frontend-console/src/api/query.ts`、`apps/frontend-console/src/api/export.ts`、`apps/frontend-console/src/api/audit.ts`、`apps/frontend-console/src/api/alert.ts`、`apps/frontend-console/src/api/incident.ts`、`apps/frontend-console/src/api/notification.ts`、`apps/frontend-console/src/api/ingest.ts`、`apps/frontend-console/src/api/metrics.ts` | 各业务 API 头部构造 | 统一改为只传当前环境下真实租户 ID；不依赖仓库固定值 | 避免所有 API 客户端都持有固定租户假设 |

### P1：测试与脚本

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `services/api-service/tests/register_smoke.sh` | 注册烟测脚本 | 不再在帮助信息中展示固定默认租户 UUID；改为 `SMOKE_TENANT_ID` 显式传入或启动前查询租户 ID |
| `apps/frontend-console/tests/authStoreLogout.test.ts` | 前端登出状态测试 | 将固定 UUID 改为随机测试值或测试内生成值 |
| `apps/frontend-console/tests/protectedRouteRefreshFailure.test.tsx` | `ProtectedRoute` 刷新失败测试 | 同步替换固定租户 UUID |
| `apps/frontend-console/tests/runtimeConfig.test.ts` | 运行时配置测试 | 保留随机 UUID 示例，不再暗示固定默认租户存在 |
| `scripts/local/ensure-local-tenant-config.sh` | 本地兼容租户同步脚本 | 改为显式 `LOCAL_TENANT_ID` 输入；默认仅在“兼容模式”下写入，不再静默回填固定 UUID |
| `scripts/seed-demo.sh` | Demo 数据灌入脚本 | 改为必填或启动时查询租户 ID，不再用固定默认值兜底 |
| `tests/e2e/tests/*.spec.js` | E2E 默认租户环境变量 | 保留 `E2E_TENANT_ID`，但默认值改由启动脚本注入；仓库不再内置固定 UUID |
| `DEPLOYMENT.md` | 部署说明 | 从“默认兼容租户”表述改为“可选本地兼容模式”；明确生产/长期环境禁止固定租户默认值 |

## 3.3 实施建议

随机租户 ID 治理不建议与 capability 改造混在同一个 MR 里硬切，推荐顺序：

1. 先改种子 / 迁移 / 运行时默认配置
2. 再改前端请求头构造与错误提示
3. 最后统一替换脚本与测试中的固定默认租户 UUID

补充约束：

- 历史证据文档和单元测试可以保留**显式测试 UUID** 作为夹具
- 但运行时代码、部署默认配置、自动同步脚本不得再反向依赖这些夹具值

## 4. 工作流 B：`/users/me` 与授权上下文改造

## 4.1 目标

设计起点中的 `/users/me` 只返回：

- `user`
- `roles`
- `permissions`

当前仓库已经完成第一阶段扩展，能够返回：

- `capabilities`
- `scopes`
- `entitlements`
- `feature_flags`
- `authz_epoch`
- `actor_flags`
- 兼容期继续保留 `permissions`

但当前这些字段仍主要来自 `roles.permissions + 内存兼容映射 + 保留主体硬编码` 的聚合结果，尚未切到正式的授权注册表 / capability 绑定 / reserved policy 事实源。

下一阶段目标应为：

- 保持现有 `/users/me` 对前端的返回结构稳定
- 将 capability/scopes/authz_epoch 的生成迁到数据库授权事实源
- 兼容期继续保留 `permissions`

## 4.2 文件级任务拆解

### P0：API Contract

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `services/api-service/internal/model/user.go` | 定义 `GetMeResponseData` | 扩展 `GetMeResponseData`，新增 `Capabilities []string`、`Scopes []string`、`Entitlements []string`、`FeatureFlags []string`、`AuthzEpoch int64`、`ActorFlags map[string]bool` 等字段；保留 `Permissions []string` 兼容前端旧逻辑 |
| `apps/frontend-console/src/api/user.ts` | 定义 `GetMeResponse` 并解析 `/users/me` | 同步扩展前端响应类型与 `fetchCurrentUser()` 返回结构；让前端同时拿到旧 `permissions` 与新授权上下文 |

### P0：服务与仓储

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `services/api-service/internal/service/user_service.go` | 聚合用户、角色与旧权限串 | `GetMe()` 不再只平铺 `roles.permissions`；要引入“旧权限 -> capability 映射 + 角色 capability 绑定 + 保留主体策略 + authz_version”；兼容期继续返回 `permissions` |
| `services/api-service/internal/repository/user_repository.go` | 用户与角色查询 | 可保留原用户/角色查询，但建议补充或拆分出授权相关读取方法，避免 `user_repository.go` 继续承担过多授权逻辑；尤其不要再让 `RoleRecord.Permissions` 成为唯一运行时事实源 |
| `services/api-service/internal/repository/authorization_repository.go` | 新增文件 | 新增授权仓储：读取 `legacy_permission_mapping`、`role_capability_binding`、`subject_reserved_policy`、`authz_version`、后续 `route_registry` / `api_policy_registry` |
| `services/api-service/internal/service/authorization_context_service.go` | 已新增文件 | 当前已承接 `/users/me` 的 capability/scopes 聚合；下一步需要从“内存兼容映射”切到数据库事实源，并与中间件共享 |
| `services/api-service/internal/model/auth.go` | JWT claims 模型 | 决定是否在 access token 中增加 `authz_epoch`、`actor_type` 或 reserved flag；若不加，也要明确 capability 真相只能来自服务端回查 |
| `services/api-service/internal/service/auth_service.go` | 登录、注册、token 生成与校验 | 与 `model/auth.go` 同步决定 token 是否携带 `authz_epoch`；注册链路对保留用户名的限制也应从硬编码迁到保留主体策略 |

### P0：Handler 与路由

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `services/api-service/internal/handler/user_handler.go` | 处理 `/users/me` | `GetMe()` 仍保持路由不变，但返回体切到新模型；保留原错误语义 |
| `services/api-service/cmd/api/router.go` | 注册 `/api/v1/users/me` | 当前路由本身无需改路径，但要在任务清单中确认 `GET /users/me` 是前端授权事实源，后续所有前端权限同步都依赖这个接口 |

### P1：测试

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `services/api-service/internal/handler/user_handler_test.go` | 用户 handler 单测 | 补 `GetMe()` 新字段断言：`capabilities`、`authz_epoch`、`actor_flags` |
| `services/api-service/cmd/api/router_test.go` | API 路由与 `/users/me` 返回测试 | 同步更新 `/users/me` 结构断言 |

## 4.3 `/users/me` 兼容期返回建议

建议兼容期保持如下结构：

```json
{
  "user": { ... },
  "roles": [ ... ],
  "permissions": ["users:read", "logs:read"],
  "capabilities": ["iam.user.read", "log.query.read"],
  "scopes": ["tenant", "owned"],
  "entitlements": [],
  "feature_flags": [],
  "authz_epoch": 12,
  "actor_flags": {
    "reserved": false,
    "interactive_login_allowed": true,
    "system_subject": false
  }
}
```

说明：

- `permissions`：仅用于迁移兼容
- `capabilities`：作为页面/API 新判定主轴
- `scopes`：决定是否可跨租户、仅本人、仅资源拥有者等
- `authz_epoch`：后续用于前端缓存失效、token 内版本比对、JIT 授权刷新
- `actor_flags`：承载系统保留主体、系统自动化主体、交互式登录是否允许等治理信号

## 5. 工作流 C：统一 capability 中间件与共享鉴权链路改造

## 5.1 目标

当前仓库的鉴权链路存在三套旧逻辑：

1. `api-service` 以 `RequirePermission("users:read")` 为主
2. `data-services` 以共享 `RequirePermission("logs:read")`、`RequirePermission("audit:read")` 为主
3. `control-plane` 仍有 `RequireAdminRole`、`RequireOperatorRole`、`sys-superadmin + super_admin` 的硬编码查询

目标状态应为：

- 统一以 capability 为主判定
- scope 决定租户/租户组/全租户/本人等资源边界
- `permissions` 仅作为迁移兼容别名
- 保留主体策略不再通过用户名、角色名硬编码散落在多个服务中

## 5.2 文件级任务拆解

### 5.2.1 当前代码现状补充（2026-03-15）

| 服务 | 当前入口 | 当前主要耦合点 | 本轮拆解重点 |
|---|---|---|---|
| `api-service` | `AuthRequired` + `RequirePermission` 位于 `services/api-service/internal/handler/auth_middleware.go`，路由挂载在 `services/api-service/cmd/api/router.go`，`/users/me` 通过 `services/api-service/internal/service/authorization_context_service.go` 聚合上下文 | `authorization_context_service.go` 内存 `legacyPermissionCapabilityAliases` 仍把 `users:write` 扩展到登录策略、系统设置、采集、存储、Webhook、插件市场等非 IAM 能力，导致 `/users/me` 继续传播过大的 capability 面 | 先把 `/users/me` 的能力事实源从“内存扩权别名”收敛到“正式兼容映射 + 保留主体策略”，再逐步让 API 路由切到 `RequireCapability` / `RequireScope` |
| `data-services` | `RequireAuthenticatedIdentity` + `RequirePermission` 分别挂在 `query-api`、`audit-api`、`export-api` 的 `cmd/api/main.go` | `shared/auth` 已提供 typed capability/scope 与 `TenantReadScope`；`query-api` / `audit-api` 已切到显式 `TenantReadScope`，但 `export-api` 仍未显式建模 export scope，`stats_service` / repository 仍存在 `tenant_id IS NULL`、`tenantScope=nil` 等跨租户旧表达 | 继续把剩余 `NULL/空值=跨租户` 语义替换为显式 scope，并补齐 export 侧 actor 能力建模 |
| `control-plane` | `RequireAuthenticatedIdentity`、`RequireOperatorRole`、`RequireAdminRole` 在 `services/control-plane/cmd/api/main.go` 统一接线 | `RequireAdminRole` / `RequireOperatorRole` 直接查角色名；`global_tenant_access.go` 直接写死 `sys-superadmin` + `super_admin`；`/api/v1/metrics/report` 还靠 `auth_middleware.go` 的 path 特判分流 Agent 身份 | 先把 route group 改成 capability guard，再拆出显式 `agentRoutes`，最后清理 `tenantScope=""` 和角色名/用户名硬编码 |

### P0：api-service

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `services/api-service/internal/handler/auth_middleware.go` | API-service JWT 鉴权与 `RequirePermission` | 在不破坏现有 `RequirePermission` 的前提下新增 `RequireCapability` / `RequireScope`；允许先从 `permissions` + compatibility mapping 判定，再逐步切到 capability binding |
| `services/api-service/internal/handler/identity_context.go` | 读出 `tenant_id/user_id/permissions` | 增加 `AuthenticatedCapabilities()`、`AuthenticatedScopes()`、`AuthenticatedAuthzEpoch()`、`AuthenticatedActorFlags()` |
| `services/api-service/internal/service/authorization_context_service.go` | 当前在内存中维护 `legacyPermissionCapabilityAliases` / `legacyPermissionScopes`，作为 `/users/me` 的能力事实源 | 改为优先读取正式 `legacy_permission_mapping`、`role_capability_binding`、`subject_reserved_policy`；移除 `users:write -> auth.login_policy.* / settings.* / ingest.* / integration.*` 这类前端借权能力扩张 |
| `services/api-service/internal/service/authorization_context_service_test.go` | `/users/me` 授权上下文单测 | 补约束性测试：`users:write` 仅映射 IAM 写能力，不再隐式命中登录策略、系统设置、采集、Webhook、插件市场等 capability |
| `services/api-service/cmd/api/router.go` | 用户/角色接口的旧权限挂载点 | 逐步把 `users:read` / `users:write` 改成 `iam.user.read`、`iam.user.create`、`iam.user.update_status`、`iam.user.grant_role` 等精细 capability，并保持 `/users/me` 路由路径不变 |
| `services/api-service/internal/service/auth_service.go` | 注册流程与保留用户名限制 | 当前注册流程直接禁止保留用户名，后续应改成读取 `subject_reserved_policy` 或保留主体注册表，而不是继续写死两个用户名 |

### P0：data-services 共享鉴权包

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `services/data-services/shared/auth/middleware.go` | 解析 JWT、注入 `tenant_id/user_id`、加载 `permissions` | 增加 capability/scopes/authz_epoch 装载；保留 permissions 兼容；把 `authorization_ready` 与新上下文字段一起设置 |
| `services/data-services/shared/auth/authorization.go` | `RequirePermission` 与旧权限加载 | 保留 `RequirePermission` 兼容；新增 `RequireCapability`、`RequireScope`；将 `globalLogAccessQuery` 从用户名/角色硬编码改为 capability + scope + reserved policy 组合判断 |
| `services/data-services/shared/auth/identity_context.go` | 读取鉴权上下文 | 已提供 `AuthenticatedCapabilities()`、`AuthenticatedScopes()`、`AuthenticatedAuthzEpoch()`、`AuthenticatedActorFlags()`；跨租户读取统一通过 `AuthenticatedTenantReadScope()` 表达 |
| `services/data-services/query-api/internal/handler/handler.go` | 将 Gin 上下文翻译成 Query actor | 已切到 `TenantReadScope`；下一步补 `authorizedTenants` / export 复用模型，避免 handler 仍只传单一租户或全租户两态 |
| `services/data-services/query-api/internal/service/service.go` | Query actor 与查询权限聚合 | 当前只用 `{TenantID, UserID, CanReadAllLogs}` 表达查询权限，需要改成显式 capability/scope 上下文，支持 `tenant`、`owned`、`all_tenants` |
| `services/data-services/query-api/internal/service/stats_service.go` | 统计聚合与告警摘要 | 当前仍用 `CanReadAllLogs` 和 `tenant_id IS NULL` 表达跨租户；需要改成显式 scope，不再用 `NULL = all_tenants` |
| `services/data-services/query-api/internal/repository/repository.go` | ES 查询入参与 tenant bypass | 当前有 `BypassTenantScope` 语义，需要改成显式 scope/授权租户集合，避免 capability 迁移后继续保留布尔绕过 |
| `services/data-services/audit-api/internal/handler/audit_handler.go` | 将 Gin 上下文翻译成 Audit actor | 已切到 `TenantReadScope`；下一步继续与 service/repository 一起消除 `nil tenantScope = all_tenants` 旧语义 |
| `services/data-services/audit-api/internal/service/audit_service.go` | 审计 actor 与查询控制 | 当前用 `BypassTenantScope` 表达跨租户，需要改成 capability + scope 模型，并消除 service 层“要求 tenant 非空”与 repository 层“允许 nil tenantScope”之间的语义冲突 |
| `services/data-services/audit-api/internal/repository/audit_repository.go` | 审计查询仓储 | 当前 `tenantScope=nil` 表示全租户，需要改成显式 scope/专门全租户路径 |
| `services/data-services/export-api/internal/handler/export_handler.go` | 构造导出 actor 并下发服务层 | 当前仅传 `tenantID/userID`，未显式声明 export 是否允许跨租户；需要补 capability/scope，或明确保持 tenant-scoped 并在 handler 层 fail-closed |
| `services/data-services/export-api/internal/service/export_service.go` | 导出任务创建/读取/下载服务 | 当前只有 `tenantID/userID` 身份入参，需要补 capability 粒度与 `owned vs tenant` scope |
| `services/data-services/export-api/internal/repository/es_export_repository.go` | 导出 ES 查询过滤 | 当前只接受 tenant 过滤，后续若支持受控跨租户导出，需要升级为显式 scope |

### P0：control-plane

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `services/control-plane/internal/middleware/auth_middleware.go` | 控制面认证入口 | 与 data-services 共享鉴权语义保持一致：除了 `tenant_id/user_id`，还应支持 capabilities/scopes/authz_epoch 上下文 |
| `services/control-plane/internal/middleware/admin_authorization.go` | 基于角色名 / `*` 判断管理员 | 改成 capability 判定，例如 `iam.user.read` / `iam.user.update_status` / `settings.*` 等；不再依赖角色名白名单 |
| `services/control-plane/internal/middleware/operator_authorization.go` | 基于角色名判断 operator/admin | 改成 capability 判定，不再依赖 `role.name IN (...)` |
| `services/control-plane/internal/middleware/global_tenant_access.go` | 跨租户读权限硬编码判断 | 用 `subject_reserved_policy + capability + scope(all_tenants)` 替代当前 `sys-superadmin + super_admin` 查询 |
| `services/control-plane/internal/middleware/identity_context.go` | 控制面身份上下文读取 | 扩展 getter，支持新授权上下文字段 |
| `services/control-plane/cmd/api/main.go` | control-plane 路由 wiring | 当前通过 `RequireOperatorRole/RequireAdminRole` 组合接线，capability 化后要同步替换 wiring；同时把 `/api/v1/metrics/report` 从 path 特判迁到显式 `agentRoutes`，避免 `auth_middleware.go` 继续维护路由字符串分流 |
| `services/control-plane/cmd/api/ingest_runtime.go`、`services/control-plane/cmd/api/ingestv3_routes.go` | admin/operator 路由注册与边界声明 | 让注册函数接收“已授权 router”或显式 authz requirement，而不是在 bootstrap 里依赖 `adminRoutes/operatorRoutes` 隐式传递角色语义 |
| `services/control-plane/internal/alert/event_handler.go`、`services/control-plane/internal/alert/silence_handler.go`、`services/control-plane/internal/alert/rule_handler.go`、`services/control-plane/internal/notification/channel_handler.go` | control-plane 业务 handler | 当前有以 `tenantScope=""` 表达全租户的旧语义，后续要改成 capability + scope 显式模型，不能继续依赖空字符串代表全租户 |

### P1：服务入口路由

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `services/data-services/query-api/cmd/api/main.go` | 查询 API 路由入口 | 保留 `RequirePermission("logs:read")` 兼容期入口，同时准备切到 `RequireCapability("log.query.read")` |
| `services/data-services/export-api/cmd/api/main.go` | 导出 API 路由入口 | 从 `logs:export` 逐步切到 `export.job.create/read/download` capability 组合 |
| `services/data-services/audit-api/cmd/api/main.go` | 审计 API 路由入口 | 从 `audit:read` 逐步切到 `audit.log.read`；全租户读取使用额外 scope/capability |
| `services/api-service/cmd/api/router.go` | 用户/角色 API 路由 | `users:*` 逐步切到 `iam.user.*` 与 `iam.role.read` |

### P1：测试

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `services/data-services/shared/auth/authorization_test.go` | 共享鉴权单测 | 新增 capability / scope / compatibility mapping 双轨测试 |
| `services/data-services/shared/auth/identity_context_test.go` | 上下文 getter 测试 | 新增 capabilities / scopes / authz_epoch getter 测试 |
| `services/data-services/shared/auth/middleware_test.go` | 鉴权中间件测试 | 新增上下文装载与 `X-Tenant-ID` 覆盖逻辑测试 |
| `services/control-plane/cmd/api/main_test.go` | control-plane 鉴权与查询测试 | 去掉对 `LOWER(u.username) = 'sys-superadmin'` 硬编码查询的依赖，改测保留主体策略与 capability/scope |
| `services/control-plane/internal/middleware/*_test.go` | control-plane 中间件测试 | 对齐 capability 化后的判定结果 |

### 5.3 建议的后端切换顺序（接口级）

1. **先收紧 `api-service` 的 `/users/me` 能力事实源**
   - 优先改 `services/api-service/internal/service/authorization_context_service.go`
   - 先消除 `users:write` 对登录策略、系统设置、采集、集成等非正式能力的扩张，再谈前后端双轨收口
2. **再让 `shared/auth` 装载 typed authz snapshot**
   - 改 `services/data-services/shared/auth/middleware.go`
   - 改 `services/data-services/shared/auth/authorization.go`
   - 改 `services/data-services/shared/auth/identity_context.go`
3. **随后替换 query / audit / export 的 actor 形态**
   - 把 `CanReadAllLogs`、`BypassTenantScope`、`tenantScope=nil` 改成 capability + scope + authorized tenant set
4. **最后替换 control-plane 的角色分组 wiring**
   - 改 `services/control-plane/cmd/api/main.go`
   - 改 `services/control-plane/internal/middleware/admin_authorization.go`
   - 改 `services/control-plane/internal/middleware/operator_authorization.go`
   - 改 `services/control-plane/internal/middleware/global_tenant_access.go`
5. **配套回归测试一起迁移**
   - `*_test.go` 统一从“角色名 / 用户名字面量断言”切到“capability / scope / reserved policy 断言”

## 6. 工作流 D：前端 `ProtectedRoute` / `authStore` / 菜单 / 路由注册表改造

## 6.1 目标

当前仓库已经解决了“只校验登录，不校验页面访问”的主问题，但仍存在四个结构性缺口：

1. `ProtectedRoute` 已能做页面访问控制，但页面内按钮、弹窗、抽屉和二级入口尚未统一 capability 化
2. `authStore` 已缓存完整授权上下文，但部分页面仍会直接请求 `/users/me` 或继续只看 `permissions`
3. `apps/frontend-console/src/auth/routeAuthorization.ts` 已成为页面访问事实源，但 `menu.ts` 仍保留过渡字段，且路由注册表中还存在 `dashboards:read`、`metrics:read` 等 legacy alias 过渡项
4. `scope/feature_flags/authz_epoch` 已返回，但大多数页面尚未真正消费这些字段

目标状态是：

- `ProtectedRoute` 既处理登录态，也能按路由注册表做页面授权
- `authStore` 持有完整授权上下文
- 菜单、移动端导航、Dashboard 快捷入口与页面内动作共享同一套授权事实源
- 旧权限只作为过渡别名，不再充当真实授权事实源

### 6.1.1 当前前端过渡别名收敛状态（2026-03-15）

| 批次 | 当前状态 | 说明 |
|---|---|---|
| Dashboard / 报表中心隐式借权 | 已完成 | `dashboards:read` 不再隐式放行 `reports/management`、`reports/scheduled`、`reports/downloads`，Dashboard 快捷入口与导航已统一走 `routeAuthorization` |
| 登录策略 / 系统设置 `users:write` 借权 | 已完成 | `/security/login-policy`、`/settings/parameters`、`/settings/global`、`/settings/versions` 已切到显式 capability 访问 |
| 采集 / 解析 / 存储 / 扩缩容 / 灾备 / Webhook / 插件市场 `users:write` 借权 | 已完成 | 相关页面已移除 `users:write` 页面访问别名；`metrics:read` 仍只保留在监控相关过渡路由 |
| `metrics:read` 监控类过渡别名 | 部分完成 | `/ingestion/status`、`/storage/capacity`、`/performance/scaling`、`/performance/dr` 仍保留兼容；后续要在 capability 种子与后端接口就绪后收口 |
| 剩余 `dashboards:read` 页面过渡别名 | 未完成 | `integration/api`、`integration/sdk`、`cost/*`、`help/*` 等页面仍有旧权限过渡入口，需要继续逐批收敛 |
| 页面内动作级授权 | 未完成 | 路由访问已统一，但按钮、弹窗、抽屉、批量操作和高风险动作还需逐页 capability 化 |

## 6.2 文件级任务拆解

### P0：状态与 API

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `apps/frontend-console/src/stores/authStore.ts` | 保存 `isAuthenticated/user/permissions`，同步 `/users/me` | 扩展状态：`capabilities`、`scopes`、`entitlements`、`featureFlags`、`authzEpoch`、`actorFlags`、`authzReady`；将 `syncPermissions()` 升级为 `syncAuthorizationContext()` 或保持旧名但拉取完整上下文；不要再把 `permissions=['*']` 当成长期真相源 |
| `apps/frontend-console/src/api/user.ts` | 用户与 `/users/me` API 类型 | 与后端同步扩展 `GetMeResponse`；兼容期保留 `permissions`，但应在这一层统一归一化成前端消费的 capability 上下文 |
| `apps/frontend-console/src/types/authz.ts` | 授权上下文类型定义 | 作为前端统一 `AuthorizationSnapshot` 模型；后续若补 `requiredScopes` / `featureFlags` 消费，应优先从这里收敛，而不是在页面里散落字段判断 |
| `apps/frontend-console/src/components/layout/AppLayout.tsx` | 页面刷新时同步权限 | 将 `syncPermissions()` 替换为新的授权上下文同步；必要时监听 `authz_epoch` 变化触发刷新或登出；避免“授权未就绪时先渲染全部导航” |

### P0：路由守卫与注册表

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `apps/frontend-console/src/components/auth/ProtectedRoute.tsx` | 已处理登录态、token 刷新、授权同步与路由访问判定 | 下一步补齐 `scope` / `featureFlags` / `authzEpoch` 的更细粒度判定，并把“页内动作无权”导向统一的 `disabled / tooltip / redirect` 策略 |
| `apps/frontend-console/src/App.tsx` | 所有受保护路由都挂在统一 `ProtectedRoute` 下 | 保留统一壳层；新增页面时必须先在 `routeAuthorization.ts` 注册后再挂路由，禁止无注册直挂受保护页面 |
| `apps/frontend-console/src/auth/routeAuthorization.ts` | 已新增页面授权注册表与基础判定工具 | 继续补 `requiredScopes`、`featureFlags`、`routeKey`、`riskTags`、`fallbackPath` 规范；若逻辑继续增长，再拆出独立 `utils/authorization.ts` |

### P0：菜单与导航

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `apps/frontend-console/src/constants/menu.ts` | 侧边栏菜单元数据，仍使用 `requiredPermission` | 逐步从 `requiredPermission` 切到 `requiredCapability` / `routeKey`；兼容期可保留 `compatPermissions` 字段；`users:write` 的页面借权已基本移除，下一步重点收敛剩余 `dashboards:read` / `metrics:read` 过渡别名 |
| `apps/frontend-console/src/types/navigation.ts` | 菜单类型定义 | 扩展字段：`requiredCapability`、`requiredScope`、`compatPermissions`、`routeKey`；`requiredPermission` 标记为过渡字段 |
| `apps/frontend-console/src/components/layout/AppSidebar.tsx` | 根据 `permissions` 过滤菜单 | 改成根据 `capabilities + route registry + compat alias` 过滤；不再把“权限为空时显示全部菜单”作为长期行为，而要基于 `authzReady` 明确控制渲染 |
| `apps/frontend-console/src/components/layout/MobileBottomNav.tsx` | 移动端底部导航 | 目前属于侧边栏外的独立入口，需要改成与 sidebar 共用 route registry 和授权判定，避免移动端绕过页面权限过滤 |
| `apps/frontend-console/src/pages/Dashboard.tsx` | Dashboard 快捷入口 | 快捷入口应从 route registry 生成或在点击前统一调用 `canAccessRoute()`，避免绕过 sidebar 直达受限页 |

### P0：页面内动作与二级入口

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `apps/frontend-console/src/pages/security/UserManagement.tsx` | 用户列表、详情、创建、编辑、批量状态、角色授予/移除；页头有“邀请用户/导入用户”占位入口 | 将页面访问 `iam.user.read` 与动作权限拆开：`iam.user.create`、`iam.user.update_profile`、`iam.user.update_status`、`iam.user.grant_role`、`iam.user.revoke_role`；为后续“邀请/导入”预留 `iam.user.invite`、`iam.user.import`；所有按钮、弹窗、行操作与批量操作统一走 capability 判定 |
| `apps/frontend-console/src/pages/security/RolePermissions.tsx` | 角色列表、详情抽屉、权限复制 | 页面访问继续用 `iam.role.read`；若复制/导出权限视为敏感动作，应额外拆 `iam.role.export` 或 `iam.role.copy_permission`，避免“能看即能导出” |
| `apps/frontend-console/src/pages/security/AuditLogs.tsx` | 审计日志查询、筛选、快速过滤、详情展示 | 页面访问使用 `audit.log.read`；若后续增加导出、保留主体快速过滤、跨租户查询，应补 `audit.log.export`、`audit.log.read_reserved_subject` 或由后端 scope/actor_flags 接管，不能只依赖提示文案 |
| `apps/frontend-console/src/pages/security/securityGovernance.ts` | 前端硬编码保留用户名与角色名 | 逐步从硬编码迁到后端保留主体事实源（`actor_flags` + reserved policy 字典）；前端只负责展示，不负责裁决 |
| `apps/frontend-console/src/pages/Dashboard.tsx` | Dashboard 卡片导航 | 与侧边栏、移动端导航共用同一套 `routeAuthorization` 结果，不得通过卡片点击绕过页面鉴权 |

### P1：页面级修正

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `apps/frontend-console/src/pages/security/LoginPolicy.tsx` | 登录策略页面 | 不再依赖菜单借用的 `users:write`；页面内读操作按 `auth.login_policy.read`，保存操作按 `auth.login_policy.update` |
| `apps/frontend-console/src/pages/settings/SystemParameters.tsx` | 系统参数 | 改为 `settings.parameter.read/update` |
| `apps/frontend-console/src/pages/settings/GlobalConfig.tsx` | 全局配置 | 改为 `settings.global.read/update`，敏感项预留 secret/sensitive 子能力 |
| `apps/frontend-console/src/pages/settings/ConfigVersions.tsx` | 配置版本 / 回滚 | 改为 `settings.version.read/rollback` |
| `apps/frontend-console/src/pages/reports/ReportManagement.tsx` | 报表管理 | 不再依赖“菜单没有显式权限”带来的隐式可见，改为 `report.read` |
| `apps/frontend-console/src/pages/reports/ScheduledTasks.tsx` | 定时任务 | 改为 `report.schedule.read` |
| `apps/frontend-console/src/pages/reports/DownloadRecords.tsx` | 下载记录 | 将查看、创建导出任务、下载文件拆成 `report.download.read`、`log.export.read/create/download` 等细粒度能力 |
| `apps/frontend-console/src/pages/alerts/AlertRules.tsx` | 告警规则页面 | 页面访问与规则操作拆成 `alert.rule.read/create/update/enable/disable/delete` |
| `apps/frontend-console/src/pages/alerts/NotificationConfig.tsx` | 通知配置 | 拆成 `notification.channel.read_metadata/update/test/rotate_secret` 等能力 |
| `apps/frontend-console/src/pages/security/UserManagement.tsx` | 用户管理页 | 当前页内会再次读取 `/users/me`，建议改为统一消费 `authStore` 中的授权上下文和当前主体，避免页面绕开授权状态层 |

### P1：前端测试

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `apps/frontend-console/tests/protectedRouteRefreshFailure.test.tsx` | `ProtectedRoute` 刷新失败测试 | 补 capability / authz_epoch 测试场景 |
| `apps/frontend-console/tests/authStoreLogout.test.ts` | `authStore` 登出与状态清理 | 同步断言新授权上下文字段清空 |
| `apps/frontend-console/tests/securityGovernance.test.ts` | 安全治理相关 UI 测试 | 用 capability / route registry 替换旧 permissions 场景 |
| `apps/frontend-console/tests/runtimeConfig.test.ts` | 运行时配置测试 | 确认 tenantId 为部署注入的随机 UUID，不依赖固定默认值 |

## 7. 已新增 / 建议新增文件

为避免把所有逻辑继续堆到旧文件里，建议按“已落地”和“尚需补齐”两类看待：

| 文件 | 作用 | 优先级 |
|---|---|---|
| `services/api-service/internal/service/authorization_context_service.go` | 已新增；当前承接 `/users/me` 的兼容聚合，后续接入 DB 事实源 | P0（已落地，待深化） |
| `apps/frontend-console/src/auth/routeAuthorization.ts` | 已新增；页面授权注册表 + 判定工具 | P0（已落地，待补 scopes/featureFlags） |
| `apps/frontend-console/src/types/authz.ts` | 已新增；统一前端授权上下文模型 | P0（已落地） |
| `services/api-service/internal/repository/authorization_repository.go` | 尚未新增；承担 mapping / binding / reserved policy / authz_version 读取 | P1 |

## 8. 实施优先级建议

### Sprint P0：补齐当前基线的缺口

1. 收尾随机租户 runtime 遗留：
   - `scripts/local/ensure-local-tenant-config.sh`（仅保留 `LOCAL_TENANT_COMPAT_MODE=true` 时的兼容常量）
   - `tests/e2e/tests/*.spec.js`（将固定演示租户默认值改为运行时注入或本地生成）
2. 把安全页动作级授权补齐：
   - `apps/frontend-console/src/pages/security/UserManagement.tsx`
   - `apps/frontend-console/src/pages/security/RolePermissions.tsx`
   - `apps/frontend-console/src/pages/security/AuditLogs.tsx`
   - `apps/frontend-console/src/pages/security/securityGovernance.ts`
   - `apps/frontend-console/src/pages/Dashboard.tsx`
3. 补 route registry 维度：
   - `apps/frontend-console/src/auth/routeAuthorization.ts`
   - `apps/frontend-console/src/components/auth/ProtectedRoute.tsx`
   - `apps/frontend-console/src/components/layout/AppSidebar.tsx`
   - `apps/frontend-console/src/components/layout/MobileBottomNav.tsx`
   - 继续清理剩余 `dashboards:read` / `metrics:read` 过渡别名，并补齐 route-level 与 action-level 的一致性约束

### Sprint P1：替换后端 capability 判定主路径

1. `services/api-service/internal/handler/auth_middleware.go`
2. `services/data-services/shared/auth/authorization.go`
3. `services/data-services/shared/auth/middleware.go`
4. `services/control-plane/internal/middleware/auth_middleware.go`
5. `services/control-plane/internal/middleware/admin_authorization.go`
6. `services/control-plane/internal/middleware/operator_authorization.go`
7. `services/control-plane/internal/middleware/global_tenant_access.go`

### Sprint P2：下沉正式授权事实源并清除兼容别名

1. `services/api-service/internal/repository/authorization_repository.go`
2. `storage/postgresql/migrations/000027*`、`000028*`、`000029*`
3. `services/api-service/internal/service/authorization_context_service.go`
4. `apps/frontend-console/src/auth/routeAuthorization.ts`
5. `apps/frontend-console/src/pages/**` 中仍依赖 `permissions` 或硬编码保留主体的页面

## 9. 下一轮最值得先开的实施任务

如果下一步继续编码，建议优先开这 6 个任务：

1. **收尾固定租户兼容项与测试夹具**
   - 改 `scripts/local/ensure-local-tenant-config.sh` 的兼容模式说明，以及 `tests/e2e/tests/*.spec.js` 的默认租户注入方式
2. **把安全页从“页面可见”升级到“动作可控”**
   - 改 `UserManagement.tsx`、`RolePermissions.tsx`、`AuditLogs.tsx`、`Dashboard.tsx`
3. **把保留主体硬编码迁向事实源**
   - 改 `securityGovernance.ts`、`user_governance.go`、`auth_service.go`、`global_tenant_access.go`
4. **让后端 capability 中间件接管主路径**
   - 改 `auth_middleware.go`、`shared/auth/authorization.go`、`admin_authorization.go`、`operator_authorization.go`
5. **把 `/users/me` 从兼容聚合升级到正式授权聚合**
   - 新增 `authorization_repository.go`，并让 `authorization_context_service.go` 读取正式注册表/绑定表
6. **把路由注册表升级到 scope / feature flag 维度**
   - 改 `routeAuthorization.ts`、`ProtectedRoute.tsx`、`AppSidebar.tsx`、`MobileBottomNav.tsx`

## 10. 与前面文档的衔接

- `08-authorization-migration-design.md`
  - 定义迁移阶段、双轨与回滚策略
- `09-authorization-ddl-draft.md`
  - 定义授权相关表结构与随机租户 ID 的种子写法
- `10-authorization-legacy-permission-mapping-draft.md`
  - 定义旧权限的正式兼容映射与前端过渡别名边界
- `11-authorization-implementation-task-breakdown.md`
  - 定义需要修改的代码文件、优先级、实施顺序

后续如果继续推进，建议下一份文档直接进入：

- **`000027` / `000028` 正式迁移脚本草案**，或
- **按本文件 P0 清单开始逐文件实施**

## 11. 当前仓库基线对齐（2026-03-15）

| 主题 | 当前状态 | 说明 |
|---|---|---|
| `/users/me` 返回授权上下文 | 已完成第一阶段 | 后端与前端已对齐 `capabilities/scopes/entitlements/feature_flags/authz_epoch/actor_flags`，但能力事实源仍是内存兼容映射 |
| 页面级路由访问控制 | 已完成第一阶段 | `ProtectedRoute`、`routeAuthorization.ts`、`AppSidebar`、`MobileBottomNav` 已共享同一套页面授权事实源；`reports/*`、登录策略/系统设置、采集/解析/存储/平台若干页的 `users:write` 借权已完成收敛 |
| 前端过渡别名清理 | 部分完成 | 已移除主要 `users:write` 借权，并收敛一批 `dashboards:read` 隐式访问；剩余 `dashboards:read` / `metrics:read` 过渡项和页内动作 capability 化仍待继续 |
| 页面内动作级授权 | 未完成 | 多数页面按钮、弹窗、批量操作仍主要依赖“能进页面”这一层，不足以覆盖完整治理闭环 |
| 运行时固定租户 UUID | 已基本完成 | 运行时代码与部署链路已去掉固定默认租户；仅保留 `ensure-local-tenant-config.sh` 的显式兼容模式常量，以及少量测试夹具默认值 |
| 保留主体事实源 DB 化 | 未完成 | `securityGovernance.ts`、`user_governance.go`、`auth_service.go`、跨租户访问中间件仍保留用户名/角色名硬编码 |
| data-services / control-plane capability 中间件 | 未完成 | 仍以 `RequirePermission`、`RequireAdminRole`、`RequireOperatorRole` 和特定用户名/角色 SQL 查询为主 |

## 12. 不应遗漏的联动项

1. `docs/01-architecture/core/05-security-architecture.md` 仍是旧 RBAC 描述，后续需补 capability / scope 模型对齐。
2. `docs/NexusLog/10-process/11-current-project-overall-planning.md` 中 Week6 的“治理闭环”验收，必须同时覆盖页面访问和页面内操作授权，不能只验菜单隐藏。
3. Query / export / audit 当前仍有 `tenant_id IS NULL`、`BypassTenantScope`、空字符串代表跨租户的旧语义，能力化改造时必须一起收口。
4. `authz_epoch` 目前主要用于前端同步链路，若要做即时失效或临时授权（JIT），还需要同步到 token refresh、缓存失效和跨服务鉴权策略。
