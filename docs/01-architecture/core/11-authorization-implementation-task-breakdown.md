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

## 3.3 实施建议

随机租户 ID 治理不建议与 capability 改造混在同一个 MR 里硬切，推荐顺序：

1. 先改种子 / 迁移 / 运行时默认配置
2. 再改前端请求头构造与错误提示
3. 最后统一替换脚本与测试中的固定默认租户 UUID

## 4. 工作流 B：`/users/me` 与授权上下文改造

## 4.1 目标

当前 `/users/me` 只返回：

- `user`
- `roles`
- `permissions`

目标是扩展为授权上下文接口，至少补齐：

- `capabilities`
- `scopes`
- `entitlements`
- `feature_flags`
- `authz_epoch`
- `actor_flags`
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
| `services/api-service/internal/service/authorization_context_service.go` | 新增文件 | 新增授权上下文聚合服务：输入 `tenant_id + user_id`，输出 `permissions + capabilities + scopes + entitlements + authz_epoch + actor_flags` |
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

## 5. 工作流 C：统一 capability 中间件与共享鉴权链路改造

## 5.1 目标

当前鉴权链路分散在三套实现中：

- `services/api-service/internal/handler/auth_middleware.go`
- `services/data-services/shared/auth/*`
- `services/control-plane/internal/middleware/*`

并且大量逻辑仍基于：

- `RequirePermission("users:read")`
- `role.name IN ('system_admin', 'operator')`
- `LOWER(u.username) = 'sys-superadmin'`

目标是把它们迁到统一 capability 语义，并保留旧权限兼容层。

## 5.2 文件级任务拆解

### P0：api-service

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `services/api-service/internal/handler/auth_middleware.go` | 登录态校验 + 用户角色/权限加载 + `RequirePermission` | 拆成“认证”和“授权上下文装载”两个层次；上下文里新增 `user_capabilities`、`user_scopes`、`authz_epoch`、`actor_flags`；保留 `RequirePermission`，新增 `RequireCapability`；`hasPermission` 不再是唯一判定入口 |
| `services/api-service/internal/service/user_governance.go` | 保留主体用户名/角色硬编码判断 | 逐步从用户名/角色名判断迁到 `subject_reserved_policy` 读取；兼容期保留常量，但以 DB 事实源优先 |
| `services/api-service/internal/service/auth_service.go` | 注册流程与保留用户名限制 | 当前注册流程直接禁止保留用户名，后续应改成读取 `subject_reserved_policy` 或保留主体注册表，而不是继续写死两个用户名 |

### P0：data-services 共享鉴权包

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `services/data-services/shared/auth/middleware.go` | 解析 JWT、注入 `tenant_id/user_id`、加载 `permissions` | 增加 capability/scopes/authz_epoch 装载；保留 permissions 兼容；把 `authorization_ready` 与新上下文字段一起设置 |
| `services/data-services/shared/auth/authorization.go` | `RequirePermission` 与旧权限加载 | 保留 `RequirePermission` 兼容；新增 `RequireCapability`、`RequireScope`；将 `globalLogAccessQuery` 从用户名/角色硬编码改为 capability + scope + reserved policy 组合判断 |
| `services/data-services/shared/auth/identity_context.go` | 读取鉴权上下文 | 新增 `AuthenticatedCapabilities()`、`AuthenticatedScopes()`、`AuthenticatedAuthzEpoch()`、`AuthenticatedActorFlags()` |
| `services/data-services/query-api/internal/service/service.go` | Query actor 与查询权限聚合 | 当前只用 `{TenantID, UserID, CanReadAllLogs}` 表达查询权限，需要改成显式 capability/scope 上下文，支持 `tenant`、`owned`、`all_tenants` |
| `services/data-services/query-api/internal/service/stats_service.go` | 统计聚合与告警摘要 | 当前仍用 `CanReadAllLogs` 和 `tenant_id IS NULL` 表达跨租户；需要改成显式 scope，不再用 `NULL = all_tenants` |
| `services/data-services/query-api/internal/repository/repository.go` | ES 查询入参与 tenant bypass | 当前有 `BypassTenantScope` 语义，需要改成显式 scope/授权租户集合，避免 capability 迁移后继续保留布尔绕过 |
| `services/data-services/audit-api/internal/service/audit_service.go` | 审计 actor 与查询控制 | 当前用 `BypassTenantScope` 表达跨租户，需要改成 capability + scope 模型 |
| `services/data-services/audit-api/internal/repository/audit_repository.go` | 审计查询仓储 | 当前 `tenantScope=nil` 表示全租户，需要改成显式 scope/专门全租户路径 |
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
| `services/control-plane/cmd/api/main.go` | control-plane 路由 wiring | 当前通过 `RequireOperatorRole/RequireAdminRole` 组合接线，capability 化后要同步替换 wiring，否则 control-plane 会停留在旧角色模型 |
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

## 6. 工作流 D：前端 `ProtectedRoute` / `authStore` / 菜单 / 路由注册表改造

## 6.1 目标

当前前端存在三个结构性问题：

1. `ProtectedRoute` 只负责“是否登录”，不负责“当前路由是否有权访问”
2. `authStore` 只缓存 `permissions`，没有 capability/scopes/authz_epoch
3. `menu.ts` 中存在旧权限借用，例如 `users:write` 被借到登录策略和系统设置

目标状态是：

- `ProtectedRoute` 既处理登录态，也能按路由注册表做页面授权
- `authStore` 持有完整授权上下文
- 菜单与路由共享同一份注册表
- 旧权限只作为过渡别名，不再充当真实授权事实源

## 6.2 文件级任务拆解

### P0：状态与 API

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `apps/frontend-console/src/stores/authStore.ts` | 保存 `isAuthenticated/user/permissions`，同步 `/users/me` | 扩展状态：`capabilities`、`scopes`、`entitlements`、`featureFlags`、`authzEpoch`、`actorFlags`、`authzReady`；将 `syncPermissions()` 升级为 `syncAuthorizationContext()` 或保持旧名但拉取完整上下文；不要再把 `permissions=['*']` 当成长期真相源 |
| `apps/frontend-console/src/api/user.ts` | 用户与 `/users/me` API 类型 | 与后端同步扩展 `GetMeResponse`；兼容期保留 `permissions`，但应在这一层统一归一化成前端消费的 capability 上下文 |
| `apps/frontend-console/src/components/layout/AppLayout.tsx` | 页面刷新时同步权限 | 将 `syncPermissions()` 替换为新的授权上下文同步；必要时监听 `authz_epoch` 变化触发刷新或登出；避免“授权未就绪时先渲染全部导航” |

### P0：路由守卫与注册表

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `apps/frontend-console/src/components/auth/ProtectedRoute.tsx` | 只做登录态校验与 token 刷新 | 扩展为“登录态 + 页面授权”双职责；引入按 `location.pathname` 查 route registry；支持 capability 判定、scope 判定、过渡别名与 `authz_epoch` 强刷；当 `authzReady=false` 时阻塞渲染，避免深链先放行 |
| `apps/frontend-console/src/App.tsx` | 所有路由都挂在统一 `ProtectedRoute` 下 | 保留统一壳层，但要引入页面注册表或让 `ProtectedRoute` 能读取 pathname -> capability 元数据；不再依赖页面是否出现在菜单中来决定可访问性 |
| `apps/frontend-console/src/constants/routeRegistry.ts` | 新增文件 | 新增页面注册表：`path`、`viewCapability`、`scope`、`featureFlag`、`compatPermissions`、`riskTags`、`routeKey` |
| `apps/frontend-console/src/utils/authorization.ts` | 新增文件 | 新增前端授权判定工具：`hasCapability`、`hasScope`、`matchesCompatPermission`、`canAccessRoute`、`shouldRefreshAuthzContext` |

### P0：菜单与导航

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `apps/frontend-console/src/constants/menu.ts` | 侧边栏菜单元数据，仍使用 `requiredPermission` | 逐步从 `requiredPermission` 切到 `requiredCapability` / `routeKey`；兼容期可保留 `compatPermissions` 字段，但要删除 `users:write` 对登录策略与系统设置的借用 |
| `apps/frontend-console/src/types/navigation.ts` | 菜单类型定义 | 扩展字段：`requiredCapability`、`requiredScope`、`compatPermissions`、`routeKey`；`requiredPermission` 标记为过渡字段 |
| `apps/frontend-console/src/components/layout/AppSidebar.tsx` | 根据 `permissions` 过滤菜单 | 改成根据 `capabilities + route registry + compat alias` 过滤；不再把“权限为空时显示全部菜单”作为长期行为，而要基于 `authzReady` 明确控制渲染 |
| `apps/frontend-console/src/components/layout/MobileBottomNav.tsx` | 移动端底部导航 | 目前属于侧边栏外的独立入口，需要改成与 sidebar 共用 route registry 和授权判定，避免移动端绕过页面权限过滤 |
| `apps/frontend-console/src/pages/Dashboard.tsx` | Dashboard 快捷入口 | 快捷入口应从 route registry 生成或在点击前统一调用 `canAccessRoute()`，避免绕过 sidebar 直达受限页 |

### P1：页面级修正

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `apps/frontend-console/src/pages/security/LoginPolicy.tsx` | 登录策略页面 | 不再依赖菜单借用的 `users:write`；页面内读操作按 `auth.login_policy.read`，保存操作按 `auth.login_policy.update` |
| `apps/frontend-console/src/pages/settings/SystemParameters.tsx` | 系统参数 | 改为 `settings.parameter.read/update` |
| `apps/frontend-console/src/pages/settings/GlobalConfig.tsx` | 全局配置 | 改为 `settings.global.read/update`，敏感项预留 secret/sensitive 子能力 |
| `apps/frontend-console/src/pages/settings/ConfigVersions.tsx` | 配置版本 / 回滚 | 改为 `settings.version.read/rollback` |
| `apps/frontend-console/src/pages/reports/ReportManagement.tsx` | 报表管理 | 不再依赖“菜单没有显式权限”带来的隐式可见，改为 `report.read` |
| `apps/frontend-console/src/pages/reports/ScheduledTasks.tsx` | 定时任务 | 改为 `report.schedule.read` |
| `apps/frontend-console/src/pages/reports/DownloadRecords.tsx` | 下载记录 | 改为 `report.download.read` |
| `apps/frontend-console/src/pages/security/UserManagement.tsx` | 用户管理页 | 当前页内会再次读取 `/users/me`，建议改为统一消费 `authStore` 中的授权上下文和当前主体，避免页面绕开授权状态层 |

### P1：前端测试

| 文件 | 当前职责 | 需要改动 |
|---|---|---|
| `apps/frontend-console/tests/protectedRouteRefreshFailure.test.tsx` | `ProtectedRoute` 刷新失败测试 | 补 capability / authz_epoch 测试场景 |
| `apps/frontend-console/tests/authStoreLogout.test.ts` | `authStore` 登出与状态清理 | 同步断言新授权上下文字段清空 |
| `apps/frontend-console/tests/securityGovernance.test.ts` | 安全治理相关 UI 测试 | 用 capability / route registry 替换旧 permissions 场景 |
| `apps/frontend-console/tests/runtimeConfig.test.ts` | 运行时配置测试 | 确认 tenantId 为部署注入的随机 UUID，不依赖固定默认值 |

## 7. 建议新增文件

为避免把所有逻辑继续堆到旧文件里，建议新增以下文件：

| 新文件 | 作用 | 优先级 |
|---|---|---|
| `services/api-service/internal/repository/authorization_repository.go` | 授权相关 DB 读取（mapping / binding / reserved policy / authz version） | P0 |
| `services/api-service/internal/service/authorization_context_service.go` | 聚合 `/users/me` 与中间件共用的授权上下文 | P0 |
| `apps/frontend-console/src/constants/routeRegistry.ts` | 页面授权事实源 | P0 |
| `apps/frontend-console/src/utils/authorization.ts` | 前端 capability / scope 判定工具 | P0 |

## 8. 实施优先级建议

### Sprint P0：先打通授权上下文最短路径

1. 处理随机租户 ID：
   - `storage/postgresql/seeds/seed_data.sql`
   - `storage/postgresql/migrations/000026_auth_user_governance.up.sql`
   - `storage/postgresql/migrations/000026_auth_user_governance.down.sql`
   - `services/control-plane/internal/ingest/store_pg_common.go`
   - `apps/frontend-console/public/config/app-config.json`
2. 扩展 `/users/me`：
   - `services/api-service/internal/model/user.go`
   - `services/api-service/internal/service/user_service.go`
   - `services/api-service/internal/handler/user_handler.go`
   - `apps/frontend-console/src/api/user.ts`
   - `apps/frontend-console/src/stores/authStore.ts`
3. 落前端注册表：
   - `apps/frontend-console/src/constants/routeRegistry.ts`
   - `apps/frontend-console/src/components/auth/ProtectedRoute.tsx`
   - `apps/frontend-console/src/constants/menu.ts`
   - `apps/frontend-console/src/components/layout/AppSidebar.tsx`

### Sprint P1：替换后端 capability 判定主路径

1. `services/api-service/internal/handler/auth_middleware.go`
2. `services/data-services/shared/auth/authorization.go`
3. `services/data-services/shared/auth/middleware.go`
4. `services/control-plane/internal/middleware/auth_middleware.go`
5. `services/control-plane/internal/middleware/admin_authorization.go`
6. `services/control-plane/internal/middleware/operator_authorization.go`
7. `services/control-plane/internal/middleware/global_tenant_access.go`

### Sprint P2：去掉前端过渡别名与高风险借用

1. `apps/frontend-console/src/pages/security/LoginPolicy.tsx`
2. `apps/frontend-console/src/pages/settings/SystemParameters.tsx`
3. `apps/frontend-console/src/pages/settings/GlobalConfig.tsx`
4. `apps/frontend-console/src/pages/settings/ConfigVersions.tsx`
5. `apps/frontend-console/src/pages/reports/ReportManagement.tsx`
6. `apps/frontend-console/src/pages/reports/ScheduledTasks.tsx`
7. `apps/frontend-console/src/pages/reports/DownloadRecords.tsx`

## 9. 本轮最值得先开的实施任务

如果下一步要直接开始编码，建议先开这 6 个任务：

1. **去掉固定默认租户 UUID**
   - 改 `seed_data.sql`、`000026*.sql`、`app-config.json`、`store_pg_common.go`
2. **扩展 `/users/me` 返回 capability 上下文**
   - 改 `model/user.go`、`user_service.go`、`user_handler.go`、`api/user.ts`
3. **新增授权上下文仓储与服务**
   - 新增 `authorization_repository.go`、`authorization_context_service.go`
4. **前端 `authStore` 改为完整授权上下文**
   - 改 `authStore.ts`、`AppLayout.tsx`
5. **新增 route registry 并改 `ProtectedRoute`**
   - 新增 `routeRegistry.ts`、`authorization.ts`，改 `ProtectedRoute.tsx`
6. **拆掉 `users:write` 的前端借用**
   - 改 `menu.ts`、`AppSidebar.tsx`、`LoginPolicy.tsx`、`settings/*`

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
