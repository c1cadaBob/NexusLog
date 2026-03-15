# 10. 旧权限兼容映射表初版（V1）

## 1. 文档目标

本文档是以下文档的实施级补充：

- `docs/01-architecture/core/08-authorization-migration-design.md`
- `docs/01-architecture/core/09-authorization-ddl-draft.md`

`08` 中给出了旧权限到 capability 的说明性样例，`09` 中给出了 `legacy_permission_mapping` 的 DDL 草案；而本文档进一步回答实施阶段最关键的四个问题：

1. 当前系统里到底有哪些旧权限串仍在生效
2. 每个旧权限串目前绑定了哪些角色、页面、API 与行为
3. 哪些旧权限可以进入 `legacy_permission_mapping` 做正式兼容
4. 哪些“只是前端临时借用”的旧权限，不应该写入正式映射表，而应单独做 UI 过渡别名

本文档的定位是：**旧权限兼容的实施真相源**。

## 2. 当前旧权限真实基线

### 2.1 当前仍在使用的旧权限串

结合当前运行时迁移、种子数据、后端中间件与前端菜单，当前可确认仍在使用的旧权限串如下：

- `*`
- `users:read`
- `users:write`
- `logs:read`
- `logs:export`
- `alerts:read`
- `alerts:write`
- `incidents:read`
- `incidents:write`
- `metrics:read`
- `dashboards:read`
- `audit:read`
- `audit:write`

### 2.2 当前角色绑定情况

当前真实角色绑定来源主要见：

- `storage/postgresql/migrations/000026_auth_user_governance.up.sql`
- `storage/postgresql/seeds/seed_data.sql`

可归纳为：

| 当前角色 | 当前旧权限 |
|---|---|
| `system_admin` | `users:read`、`users:write`、`logs:read`、`logs:export`、`alerts:read`、`alerts:write`、`incidents:read`、`incidents:write`、`metrics:read`、`dashboards:read`、`audit:read` |
| `operator` | `logs:read`、`logs:export`、`alerts:read`、`alerts:write`、`incidents:read`、`incidents:write`、`metrics:read`、`dashboards:read`、`audit:read` |
| `viewer` | `logs:read`、`dashboards:read`、`metrics:read` |
| `super_admin` | `*` |
| `system_automation` | `audit:write` |

### 2.3 当前后端使用面

当前后端仍在直接消费旧权限串：

- `services/api-service/cmd/api/router.go`
  - `users:read`：用户列表、详情、角色列表
  - `users:write`：用户创建、更新、删除、批量状态、角色授予/回收
- `services/data-services/query-api/cmd/api/main.go`
  - `logs:read`：查询 API 入口
- `services/data-services/export-api/cmd/api/main.go`
  - `logs:export`：导出任务创建、列表、详情、下载
- `services/data-services/audit-api/cmd/api/main.go`
  - `audit:read`：审计读取 API
- `services/data-services/shared/auth/authorization.go`
  - 统一中间件 `RequirePermission(...)` 仍以旧权限串为判定核心

### 2.4 当前前端使用面

当前前端菜单仍在直接使用旧权限串：

- `apps/frontend-console/src/constants/menu.ts`
  - `alerts:read`：告警中心分组
  - `incidents:read`：事件管理分组
  - `users:write`：用户管理、登录策略、系统设置分组
  - `users:read`：角色权限
  - `audit:read`：审计日志

同时还存在两个重要事实：

1. 很多页面目前**没有显式 `requiredPermission`**，例如：
   - `/search/realtime`
   - `/search/history`
   - `/search/saved`
   - `/analysis/aggregate`
   - `/reports/*`
2. 部分页面当前借用了**语义并不准确**的旧权限：
   - `/security/login-policy` 借用 `users:write`
   - `/settings/parameters`、`/settings/global`、`/settings/versions` 所在分组借用 `users:write`

这类借用不应该直接落入正式兼容映射表，否则会把 `users:write` 的语义从“用户治理”错误扩大成“安全策略 + 系统设置全能写”。

## 3. 映射设计原则

### 3.1 不放大旧权限语义

旧权限兼容的目标是“平滑迁移”，不是“顺便扩权”。

因此，`legacy_permission_mapping` 中的 capability bundle 必须遵循：

- 只覆盖当前已经存在、且与旧权限语义直接对应的能力
- 不自动把尚未上线的未来功能一起授予
- 不因为前端菜单临时借用，就把跨域能力永久绑到旧权限上

### 3.2 区分“正式兼容映射”与“前端过渡别名”

必须把两类东西严格分开：

1. **正式兼容映射**
   - 写入 `legacy_permission_mapping`
   - 被后端 capability 中间件使用
   - 作为 `/users/me` capability 展开依据之一
2. **前端过渡别名**
   - 只在 route/menu 过渡期使用
   - 不进入数据库映射表
   - 不作为未来 capability 真相源

### 3.3 `*` 不是普通旧权限

`*` 不应被视作普通旧权限串写入 `legacy_permission_mapping`。

原因：

- 它代表保留主体级别的全局治理语义
- 当前仅应绑定给 `sys-superadmin` 所持有的 `super_admin`
- 后续应由平台级保留角色 / capability 直接表达，而不是再做字符串展开

因此：

- `*` **不入正式映射表**
- `*` 由保留角色硬规则与 `subject_reserved_policy` 共同治理

### 3.4 `audit:write` 不是普通人工权限

`audit:write` 当前只出现在 `system_automation` 保留角色上。

因此它的迁移原则不是“给人使用”，而是：

- 仅映射到 `audit.log.write_system`
- 仅允许系统自动化主体或受控后台执行身份持有
- 默认禁止交互式登录主体通过普通角色获得该能力

## 4. 当前旧权限盘点与建议去向

| 旧权限 | 当前角色 | 当前使用面 | 建议迁移状态 | 说明 |
|---|---|---|---|---|
| `*` | `super_admin` | 保留超级管理员 | 不入表 | 由保留主体治理，不做普通兼容映射 |
| `users:read` | `system_admin` | 用户/角色读接口，角色权限页 | 入表 | 语义相对稳定 |
| `users:write` | `system_admin` | 用户写接口；前端还借用到登录策略/系统设置 | 入表，但只映射 IAM 写能力 | 登录策略与系统设置走前端临时别名，不入正式表 |
| `logs:read` | `system_admin`、`operator`、`viewer` | 查询 API；前端搜索/分析页实际依赖 | 入表 | 需收口到查询/分析只读能力 |
| `logs:export` | `system_admin`、`operator` | 导出任务 API | 入表 | 仅覆盖创建/查看/下载，不自动带取消 |
| `alerts:read` | `system_admin`、`operator` | 告警中心菜单 | 入表 | 应覆盖告警、规则、静默、通知元数据读取 |
| `alerts:write` | `system_admin`、`operator` | 告警规则、静默、通知渠道写 | 入表 | 不自动带 secret 明文读取 |
| `incidents:read` | `system_admin`、`operator` | 事件管理菜单 | 入表 | 应覆盖事件详情、时间线、SLA 等读能力 |
| `incidents:write` | `system_admin`、`operator` | 事件处置写动作 | 入表 | 应覆盖创建、更新、指派、关闭、归档 |
| `metrics:read` | `system_admin`、`operator`、`viewer` | 性能监控、容量/健康类只读页 | 入表 | 不自动带扩缩容修改 |
| `dashboards:read` | `system_admin`、`operator`、`viewer` | 概览与报表类只读页 | 入表 | 负责 Dashboard / 报表读能力 |
| `audit:read` | `system_admin`、`operator` | 审计读取 API、审计页面 | 入表 | 全租户范围不由旧权限自动赋予 |
| `audit:write` | `system_automation` | 系统自动化审计归因 | 入表，但仅保留主体可用 | 仅映射系统写审计能力 |

## 5. 实施级正式映射表（写入 `legacy_permission_mapping`）

以下表是实施阶段建议采用的正式兼容映射。

### 5.1 映射总表

| 旧权限 | capability bundle | 建议 scope bundle | 备注 |
|---|---|---|---|
| `users:read` | `iam.user.read`、`iam.role.read` | `tenant` | 不包含登录策略读取 |
| `users:write` | `iam.user.create`、`iam.user.update_profile`、`iam.user.update_status`、`iam.user.delete`、`iam.user.grant_role`、`iam.user.revoke_role` | `tenant` | 不包含邀请、导入、重置密码、登录策略、系统设置 |
| `logs:read` | `log.query.read`、`log.query.aggregate`、`query.history.read`、`query.saved.read` | `tenant`、`owned` | 不包含 Dashboard、异常检测、聚类分析 |
| `logs:export` | `export.job.create`、`export.job.read`、`export.job.download` | `tenant`、`owned` | 不包含 `export.job.cancel` 与未脱敏导出 |
| `alerts:read` | `alert.event.read`、`alert.rule.read`、`alert.silence.read`、`notification.channel.read_metadata` | `tenant` | 不包含 secret 明文读取 |
| `alerts:write` | `alert.rule.create`、`alert.rule.update`、`alert.rule.delete`、`alert.rule.enable`、`alert.rule.disable`、`alert.silence.create`、`alert.silence.update`、`alert.silence.delete`、`notification.channel.create`、`notification.channel.update`、`notification.channel.delete`、`notification.channel.test` | `tenant` | 不包含 `notification.channel.read_secret` / `update_secret` |
| `incidents:read` | `incident.read`、`incident.timeline.read`、`incident.analysis.read`、`incident.sla.read`、`incident.archive.read` | `tenant`、`resource` | 兼容当前前端整组事件页面 |
| `incidents:write` | `incident.create`、`incident.update`、`incident.assign`、`incident.close`、`incident.archive` | `tenant`、`resource` | 不自动包含审批/升级类未来能力 |
| `metrics:read` | `metric.read`、`ops.health.read`、`storage.capacity.read` | `tenant` | 不包含 `ops.scaling.update`、`dr.execute` |
| `dashboards:read` | `dashboard.read`、`report.read` | `tenant` | 报表计划/下载记录后续再细分 |
| `audit:read` | `audit.log.read` | `tenant` | `all_tenants` 需平台级显式能力，不由旧权限带出 |
| `audit:write` | `audit.log.write_system` | `system` | 仅保留主体可持有 |

### 5.2 逐项说明

#### `users:read`

保留为 IAM 读能力：

- `iam.user.read`
- `iam.role.read`

不建议自动追加：

- `auth.login_policy.read`
- `audit.log.read`
- `settings.*`

原因：这些能力虽都位于“安全与审计”区域，但治理语义完全不同。

#### `users:write`

这是当前最容易被误用的旧权限。

正式兼容时，只建议覆盖当前已经存在、且真实落在用户治理上的动作：

- `iam.user.create`
- `iam.user.update_profile`
- `iam.user.update_status`
- `iam.user.delete`
- `iam.user.grant_role`
- `iam.user.revoke_role`

明确不建议自动包含：

- `iam.user.invite`
- `iam.user.import`
- `iam.user.reset_password`
- `auth.login_policy.read`
- `auth.login_policy.update`
- `settings.parameter.*`
- `settings.global.*`
- `settings.version.*`

这些能力应在 capability 模型下显式授权，而不是继续搭便车挂在 `users:write` 上。

#### `logs:read`

建议把它收口到“查询/分析读能力”，而不是泛化成“任意只读业务能力”：

- `log.query.read`
- `log.query.aggregate`
- `query.history.read`
- `query.saved.read`

明确不建议自动包含：

- `dashboard.read`
- `analysis.anomaly.read`
- `analysis.cluster.read`
- `report.read`

原因：

- Dashboard / 报表应归属 `dashboards:read`
- 异常检测 / 聚类分析属于更高层分析能力，后续可能受 feature gate 或 license 约束

#### `logs:export`

只兼容当前已经真实存在的导出动作：

- `export.job.create`
- `export.job.read`
- `export.job.download`

不自动包含：

- `export.job.cancel`
- `log.export.unmasked`
- `audit.log.export`

#### `alerts:read` 与 `alerts:write`

这两个旧权限当前已经被用于控制整个告警中心，因此需要兼容告警、规则、静默与通知渠道的“元数据读 / 常规写”。

但必须明确排除：

- `notification.channel.read_secret`
- `notification.channel.update_secret`

因为 secret 明文查看 / 更新属于高敏治理动作，不能因为旧的 `alerts:write` 直接继承。

#### `incidents:read`

为了兼容当前整组事件管理入口，建议包含：

- `incident.read`
- `incident.timeline.read`
- `incident.analysis.read`
- `incident.sla.read`
- `incident.archive.read`

这里比 `08` 中的说明性样例更细，是为了尽量对齐现有 UI 已经暴露的页面范围。

#### `metrics:read`

保留为性能/容量/健康类只读能力：

- `metric.read`
- `ops.health.read`
- `storage.capacity.read`

不自动包含：

- `ops.scaling.read`
- `ops.scaling.update`
- `dr.read`
- `dr.execute`

原因：这些能力通常带有更强的系统级或变更级语义。

#### `dashboards:read`

建议承接：

- `dashboard.read`
- `report.read`

但不自动包含：

- `report.schedule.read`
- `report.download.read`
- `export.job.read`

报表调度和下载记录后续应独立为专门 capability，而不是继续混入 Dashboard 只读权限。

#### `audit:read`

只兼容：

- `audit.log.read`

不自动包含：

- `audit.log.export`
- `audit.log.read@all_tenants`
- `audit.policy.manage`

其中全租户审计读取必须由平台级治理角色显式持有，不应从旧租户级角色推导出来。

#### `audit:write`

仅兼容：

- `audit.log.write_system`

并且必须额外满足：

- 主体为 `system-automation` 或后续受控 `service_account`
- `interactive_login_allowed=false`
- 不允许从普通人工角色继承

## 6. 前端过渡别名矩阵（不写入 `legacy_permission_mapping`）

以下内容只允许作为前端 route/menu 过渡别名，不得写入正式映射表。

| 当前页面/分组 | 当前借用旧权限 | 正确目标 capability | 过渡建议 |
|---|---|---|---|
| `/security/login-policy` | `users:write` | `auth.login_policy.read` / `auth.login_policy.update` | 过渡期页面可用“新 capability 命中”或“旧 `users:write` 命中”显示；后端 API 一律按新 capability 鉴权 |
| `/settings/parameters` | `users:write` | `settings.parameter.read` / `settings.parameter.update` | 仅 UI 过渡兼容；不得把 `settings.*` 写进 `users:write` 正式映射 |
| `/settings/global` | `users:write` | `settings.global.read` / `settings.global.update` | 同上 |
| `/settings/versions` | `users:write` | `settings.version.read` / `settings.version.rollback` | 同上；回滚仍需额外审批/SoD |
| `/search/realtime` | 无 | `log.query.read` | 应尽快补 route registry，不建议长期无显式授权 |
| `/search/history` | 无 | `query.history.read` | 同上 |
| `/search/saved` | 无 | `query.saved.read` | 同上 |
| `/analysis/aggregate` | 无 | `log.query.aggregate` | 同上 |
| `/reports/management` | 无 | `report.read` | 不建议继续依赖 `dashboards:read` 的隐式效果 |
| `/reports/scheduled` | 无 | `report.schedule.read` | 应显式拆出能力 |
| `/reports/downloads` | 无 | `report.download.read` | 应显式拆出能力 |

核心原则是：

- **页面过渡别名只用于前端展示层**
- **后端 API 鉴权必须尽快切到新 capability**
- **一旦 route registry 落地，前端过渡别名就应删除**

## 7. 建议写入数据库的首批种子数据

下面给出一版与本文一致的 `legacy_permission_mapping` 种子草案。

```sql
INSERT INTO legacy_permission_mapping (
    legacy_permission,
    capability_bundle,
    scope_bundle,
    enabled
)
VALUES
    (
        'users:read',
        '["iam.user.read","iam.role.read"]'::jsonb,
        '["tenant"]'::jsonb,
        TRUE
    ),
    (
        'users:write',
        '["iam.user.create","iam.user.update_profile","iam.user.update_status","iam.user.delete","iam.user.grant_role","iam.user.revoke_role"]'::jsonb,
        '["tenant"]'::jsonb,
        TRUE
    ),
    (
        'logs:read',
        '["log.query.read","log.query.aggregate","query.history.read","query.saved.read"]'::jsonb,
        '["tenant","owned"]'::jsonb,
        TRUE
    ),
    (
        'logs:export',
        '["export.job.create","export.job.read","export.job.download"]'::jsonb,
        '["tenant","owned"]'::jsonb,
        TRUE
    ),
    (
        'alerts:read',
        '["alert.event.read","alert.rule.read","alert.silence.read","notification.channel.read_metadata"]'::jsonb,
        '["tenant"]'::jsonb,
        TRUE
    ),
    (
        'alerts:write',
        '["alert.rule.create","alert.rule.update","alert.rule.delete","alert.rule.enable","alert.rule.disable","alert.silence.create","alert.silence.update","alert.silence.delete","notification.channel.create","notification.channel.update","notification.channel.delete","notification.channel.test"]'::jsonb,
        '["tenant"]'::jsonb,
        TRUE
    ),
    (
        'incidents:read',
        '["incident.read","incident.timeline.read","incident.analysis.read","incident.sla.read","incident.archive.read"]'::jsonb,
        '["tenant","resource"]'::jsonb,
        TRUE
    ),
    (
        'incidents:write',
        '["incident.create","incident.update","incident.assign","incident.close","incident.archive"]'::jsonb,
        '["tenant","resource"]'::jsonb,
        TRUE
    ),
    (
        'metrics:read',
        '["metric.read","ops.health.read","storage.capacity.read"]'::jsonb,
        '["tenant"]'::jsonb,
        TRUE
    ),
    (
        'dashboards:read',
        '["dashboard.read","report.read"]'::jsonb,
        '["tenant"]'::jsonb,
        TRUE
    ),
    (
        'audit:read',
        '["audit.log.read"]'::jsonb,
        '["tenant"]'::jsonb,
        TRUE
    ),
    (
        'audit:write',
        '["audit.log.write_system"]'::jsonb,
        '["system"]'::jsonb,
        TRUE
    )
ON CONFLICT (legacy_permission) DO UPDATE
SET capability_bundle = EXCLUDED.capability_bundle,
    scope_bundle = EXCLUDED.scope_bundle,
    enabled = EXCLUDED.enabled,
    updated_at = NOW();
```

以下内容**不写入**种子表：

- `*`
- `auth.login_policy.*`
- `settings.*`
- `notification.channel.read_secret`
- `notification.channel.update_secret`
- `log.export.unmasked`
- `audit.log.read@all_tenants`

## 8. 不应被旧权限自动继承的后续能力

以下能力即使未来页面上线，也不建议通过旧权限自动带出，而应在 capability 模型下显式授权：

- `iam.user.invite`
- `iam.user.import`
- `iam.user.reset_password`
- `auth.login_policy.read`
- `auth.login_policy.update`
- `settings.parameter.update`
- `settings.global.update`
- `settings.version.rollback`
- `notification.channel.read_secret`
- `notification.channel.update_secret`
- `query.result.unmasked.read`
- `log.export.unmasked`
- `audit.log.read@all_tenants`
- `audit.log.export`
- `backup.restore`
- `auth.break_glass.use`
- `access.request.approve`

这些能力都带有更高的治理敏感度，若继续继承旧权限，会再次把授权模型拖回“粗粒度 + 语义漂移”的旧路。

## 9. 与 `08` / `09` 的关系

- `08-authorization-migration-design.md`
  - 负责说明迁移路径、双轨策略、阶段切换与回滚
  - 其中的旧权限映射表属于说明性样例
- `09-authorization-ddl-draft.md`
  - 负责说明 `legacy_permission_mapping` 的表结构与迁移拆分方式
- `10-authorization-legacy-permission-mapping-draft.md`
  - 负责说明每个旧权限串到底如何实施映射、哪些只做前端过渡别名、哪些必须排除

实施时建议以本文作为 **bundle 真相源**，并反向校准 `08` 中的说明性样例。

## 10. 下一步建议

基于本文档，下一步最适合继续产出：

1. **前后端改造任务拆解单**
   - 哪些接口先接 capability 中间件
   - 哪些页面先切 route registry
   - 哪些前端旧权限判断需要删掉或降级为过渡别名
2. **正式迁移脚本草案**
   - `000027_authz_registry_phase_a.up.sql`
   - `000028_authz_registry_routing_phase_a.up.sql`

如果直接进入实施，建议顺序为：

1. 先落 `legacy_permission_mapping` 种子表与 `subject_reserved_policy`
2. 扩展 `/users/me` 返回 capability / scope / authz_epoch
3. 让后端 capability 中间件先 Shadow Mode 对比旧权限判定
4. 再改前端菜单与 `ProtectedRoute`，把 `users:write` 的借用场景拆掉
