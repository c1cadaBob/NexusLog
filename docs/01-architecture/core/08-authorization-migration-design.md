# 08. 授权迁移设计（V1）

## 1. 文档目标

本文档将以下两份设计文档进一步收敛为一份可执行迁移方案：

- `docs/01-architecture/core/06-authorization-redesign.md`
- `docs/01-architecture/core/07-authorization-matrix-draft.md`

目标不是一次性重写全系统，而是在**不打断当前业务**的前提下，逐步把 NexusLog 从“零散权限字符串 + 页面/API 不一致 + 保留主体硬编码”迁移到统一授权模型。

本文档回答五个问题：

1. 迁移的事实源应该长什么样
2. 数据库需要新增哪些结构，哪些先不动
3. 旧权限如何兼容到新 capability
4. 前后端改造顺序如何安排
5. 如何回滚、如何验收、如何避免迁移期权限漂移

## 2. 迁移原则

### 2.1 只做增量迁移，不做一次性重构

迁移阶段原则上采用：

- 先新增，不先删除
- 先兼容，不先切断
- 先双轨，不先替换
- 先观测，不先强切

这意味着：

- 现有 `roles.permissions` JSON 权限串先保留
- 新 capability 字典与授权注册表先增量引入
- 中间件先支持“兼容映射 + 新能力判断”双轨
- 当前前端旧权限串判断先保留，但逐步被新的页面注册表替换

### 2.2 所有迁移都以“统一事实源”收口

迁移后，权限不应再分散在以下多个地方各自解释：

- 前端菜单里的 `requiredPermission`
- 路由守卫里的本地判断
- 后端 handler 里的角色 if/else
- 保留用户的用户名硬编码
- 导出/备份/配置等高风险接口里的临时规则

统一事实源至少应包括：

1. capability 字典
2. scope 字典
3. 页面注册表
4. API 注册表
5. 保留主体注册表
6. entitlement / feature gate 注册表
7. 审批 / JIT / SoD 等治理规则注册表

### 2.3 迁移过程默认 fail-closed

在中间件、能力注册表、权限版本同步出现异常时，系统默认策略应为：

- 不放大权限
- 对高风险写操作 fail-closed
- 对只读页面可根据场景降级或显式提示“授权后端不可用”

## 3. 当前基础与约束

### 3.1 已有基础

当前仓库已经具备以下迁移基础：

- `users` / `roles` / `user_roles` 关系模型
- `user_sessions`、`login_attempts`、`user_credentials`
- `audit_logs`
- `export_jobs`
- `config_namespace` / `config_item` / `config_version` / `config_publish`
- 前端 `GET /users/me` 获取当前 `permissions`
- 多服务统一 `401/403` 错误体与 `request_id`
- 保留主体：`sys-superadmin`、`system-automation`

### 3.2 当前不能立即打破的兼容面

迁移期必须兼容以下现实：

1. 前端菜单和页面还在使用旧权限串，例如：
   - `users:write`
   - `users:read`
   - `audit:read`
   - `alerts:read`
2. 后端仍有若干接口按旧角色或旧权限字符串工作。
3. 现有数据库中 `roles.permissions` 仍是主要权限事实源。
4. 多个规划模块仍未真正落地，文档需要同时覆盖“当前实现”和“规划能力”。

因此迁移设计必须支持：

- 旧权限字符串 -> 新 capability bundle 的兼容映射
- 已实现接口与规划接口共存
- 前后端在一段时间内双轨运行

## 4. 目标事实模型

### 4.1 核心对象

迁移后的统一授权事实源建议至少包含以下对象：

1. `actor`
2. `role`
3. `capability`
4. `scope`
5. `entitlement`
6. `feature_gate`
7. `approval_policy`
8. `temporary_grant`
9. `role_conflict_policy`
10. `route_registry`
11. `api_policy_registry`

### 4.2 最小运行时决策输入

迁移完成后，后端授权决策输入建议收敛为：

- `actor_id`
- `actor_type`
- `tenant_id`
- `effective_roles`
- `effective_capabilities`
- `effective_scopes`
- `entitlements`
- `feature_flags`
- `authz_epoch`
- `reserved_flags`
- `break_glass_flags`

前端最小授权上下文建议为：

- `user`
- `capabilities`
- `scopes`
- `entitlements`
- `feature_flags`
- `authz_epoch`
- `actor_flags`

## 5. 数据库迁移设计

### 5.1 设计原则

数据库迁移分三类：

1. **立即需要的最小表 / 字段**
2. **高风险治理需要但可延后落地的表**
3. **只做注册表、不直接影响运行时的辅助表**

### 5.2 第一批必须新增的结构（Phase A）

#### A1. `capability_definition`

用途：

- 统一管理 capability 字典
- 标记 capability 所属域、风险级别、是否保留、是否需要审批/JIT/SoD

建议字段：

- `id`
- `name`
- `domain`
- `description`
- `risk_level` (`low|medium|high|critical`)
- `is_reserved`
- `requires_approval`
- `requires_jit`
- `requires_sod`
- `created_at`
- `updated_at`

#### A2. `role_capability_binding`

用途：

- 将角色与 capability 解绑出 JSON 字段
- 支持每个 role-capability 绑定附加 scope ceiling

建议字段：

- `id`
- `role_id`
- `capability_id`
- `scope_ceiling`
- `effect` (`allow|deny`，初期可仅支持 `allow`)
- `created_at`

#### A3. `subject_reserved_policy`

用途：

- 把 `sys-superadmin`、`system-automation` 等保留主体从业务逻辑硬编码，转移到治理事实源

建议字段：

- `id`
- `subject_type`
- `subject_ref`
- `reserved`
- `interactive_login_allowed`
- `break_glass_allowed`
- `managed_by`
- `created_at`
- `updated_at`

#### A4. `authz_version`

用途：

- 提供权限版本戳，用于撤权传播、前端强刷、长连接失效

建议字段：

- `id`
- `subject_id`
- `tenant_id`
- `authz_epoch`
- `updated_at`
- `reason`

> 也可直接在 `users` 表新增 `authz_epoch`，但独立表更便于后续扩展到非人类主体。

#### A5. `route_registry`

用途：

- 固化 `path -> view capability -> entitlement -> feature gate`
- 让菜单、路由守卫、Dashboard 快捷入口复用同一份注册表

建议字段：

- `id`
- `path`
- `page_name`
- `view_capability`
- `default_scope`
- `required_entitlement`
- `required_feature_flag`
- `risk_tags` (jsonb)
- `enabled`

#### A6. `api_policy_registry`

用途：

- 固化 API 路由到 capability / scope / entry tier / 风险标签的映射

建议字段：

- `id`
- `method`
- `path_pattern`
- `entry_tier`
- `required_capability`
- `default_scope`
- `required_entitlement`
- `required_feature_flag`
- `risk_tags` (jsonb)
- `enabled`

### 5.3 第二批建议新增的治理表（Phase B）

#### B1. `approval_request`

用途：

- 承载高风险操作审批流
- 让“二次确认 / 双人审批”从前端弹窗升级为真实治理对象

建议字段：

- `id`
- `request_type`
- `initiator_actor_id`
- `approver_actor_id`
- `target_type`
- `target_id`
- `requested_capability`
- `requested_scope`
- `status`
- `justification`
- `ticket_id`
- `expires_at`
- `approved_at`
- `executed_at`

#### B2. `temporary_grant`

用途：

- 承载 JIT / 临时授权 / support access / break-glass session

建议字段：

- `id`
- `actor_id`
- `grant_type`
- `capability_bundle`
- `scope_bundle`
- `approved_by`
- `justification`
- `ticket_id`
- `starts_at`
- `expires_at`
- `revoked_at`
- `status`

#### B3. `role_conflict_policy`

用途：

- 承载职责分离（SoD）与互斥角色规则

建议字段：

- `id`
- `policy_name`
- `left_role`
- `right_role`
- `conflict_type` (`hard|approval_block|warning`)
- `description`
- `enabled`

#### B4. `capability_conflict_policy`

用途：

- 承载互斥 capability，例如：
  - 审批能力 vs 申请能力
  - 审计只读 vs 审计完整性管理
  - 敏感配置明文读取 vs 审批自批准

#### B5. `authz_decision_log`

用途：

- 把拒绝决策与授权解释从普通业务日志中独立出来
- 兼容后续 deny audit / explainability 需求

建议字段：

- `id`
- `request_id`
- `actor_id`
- `actor_type`
- `tenant_id`
- `decision_result`
- `decision_reason_code`
- `required_capability`
- `required_scope`
- `policy_source`
- `matched_hard_rule`
- `created_at`

### 5.4 第三批可选或延后结构（Phase C）

- `tenant_group`
- `admin_delegation`
- `entitlement_registry`
- `feature_gate_registry`
- `field_visibility_policy`
- `data_classification_policy`
- `support_access_session`
- `break_glass_session`

> 这些结构很重要，但并不都要在第一批落地；可先以配置化/代码注册形式实现，再落库。

## 6. 旧权限兼容映射设计

### 6.1 迁移目标

迁移期间，旧权限字符串不直接废弃，而是进入“兼容映射层”。

目标状态：

- 前端可以同时识别旧权限和新 capability
- 后端 capability 中间件可通过映射表兼容旧角色
- 文档、菜单、API 守卫最终全部切换到 capability 命名

### 6.2 建议兼容映射表

建议新增：`legacy_permission_mapping`

字段：

- `id`
- `legacy_permission`
- `capability_bundle` (jsonb)
- `scope_bundle` (jsonb)
- `enabled`

### 6.3 首批映射建议

| 旧权限 | 新 capability bundle |
|---|---|
| `users:read` | `iam.user.read`, `iam.role.read` |
| `users:write` | `iam.user.create`, `iam.user.update_profile`, `iam.user.update_status`, `iam.user.grant_role`, `iam.user.revoke_role` |
| `logs:read` | `log.query.read`, `query.history.read`, `query.saved.read`, `dashboard.read` |
| `logs:export` | `export.job.create`, `export.job.read`, `export.job.download` |
| `alerts:read` | `alert.event.read`, `alert.rule.read`, `alert.silence.read`, `notification.channel.read_metadata` |
| `alerts:write` | `alert.rule.create`, `alert.rule.update`, `alert.rule.delete`, `alert.rule.enable`, `alert.rule.disable`, `alert.silence.create`, `alert.silence.update`, `alert.silence.delete`, `notification.channel.create`, `notification.channel.update`, `notification.channel.delete`, `notification.channel.test` |
| `incidents:read` | `incident.read`, `incident.timeline.read`, `incident.sla.read` |
| `incidents:write` | `incident.create`, `incident.update`, `incident.assign`, `incident.close`, `incident.archive` |
| `metrics:read` | `metric.read`, `ops.health.read`, `storage.capacity.read` |
| `dashboards:read` | `dashboard.read`, `report.read` |
| `audit:read` | `audit.log.read` |
| `audit:write` | `audit.log.write_system` |

详细实施映射、范围建议、前端过渡别名与 `*` / `audit:write` 特殊处理，以 `docs/01-architecture/core/10-authorization-legacy-permission-mapping-draft.md` 为准。

### 6.4 映射期中间件策略

迁移期 capability 判定建议采用：

1. 先查显式 capability 绑定
2. 若未命中，再查 legacy permission mapping
3. 若仍未命中，则拒绝

这样可以保证：

- 新数据优先
- 旧数据不立即失效
- 有明确的兼容关闭点

## 7. 后端迁移方案

### 7.1 Phase 0：冻结能力字典与注册表草案

输出物：

- `capability_definition` 初版
- `route_registry` 初版
- `api_policy_registry` 初版
- `legacy_permission_mapping` 初版

交付要求：

- 所有现有页面和 API 必须能找到对应 capability
- 高风险动作必须具备风险标签
- 保留主体与系统自动化主体必须入表或入注册配置

### 7.2 Phase 1：保持原鉴权链路，新增授权注册层

本阶段不替换现有 JWT / session / tenant 校验，只新增授权解释层。

工作项：

1. 新增 capability 读取服务
2. 新增 legacy -> capability 映射服务
3. 在 `GET /users/me` 返回：
   - `capabilities`
   - `scopes`
   - `entitlements`
   - `feature_flags`
   - `authz_epoch`
4. 审计日志新增：
   - `decision_capability`
   - `decision_scope`
   - `decision_result`
   - `decision_reason_code`（可先选配）

### 7.3 Phase 2：后端中间件双轨运行

对关键接口按域推进：

1. `users/roles/login-policy`
2. `notification/alert/incident`
3. `query/export/audit`
4. `backup/settings/integration`

每个域都按三步走：

- Shadow Mode：记录 capability 判定，但不拦截
- Soft Enforce：对只读接口提示差异，对高风险写接口严格拦截
- Hard Enforce：完全以 capability 中间件为准

### 7.4 Phase 3：治理能力落地

优先顺序：

1. `notification.channel.read_secret`
2. `query.result.unmasked.read`
3. `backup.restore`
4. `settings.version.rollback`
5. `auth.break_glass.use`
6. `access.request.*`
7. `role_conflict_policy`

## 8. 前端迁移方案

### 8.1 先改事实源，不先改页面细节

前端改造的第一优先级不是每个按钮，而是统一事实源。

建议顺序：

1. `authStore` 扩展为保存：
   - `capabilities`
   - `scopes`
   - `entitlements`
   - `feature_flags`
   - `authz_epoch`
2. 路由守卫读取 `route_registry` 对应配置
3. 侧边栏 / Dashboard 快捷入口 / 底部导航统一读取同一页面注册表
4. 页面内按钮改为 capability 驱动

### 8.2 前端兼容期策略

迁移期前端判断可以是：

- 若新 capability 存在，则以 capability 为准
- 若 capability 未返回，则临时兼容旧权限串
- 若 `authz_epoch` 变化，则强制刷新 `GET /users/me`

### 8.3 前端优先改造顺序

1. `ProtectedRoute`
2. `authStore`
3. `constants/menu.ts`
4. Dashboard 快捷入口
5. 安全与审计页
6. 通知配置 / 备份恢复 / 下载记录 / 定时任务等高风险页

## 9. 保留主体治理迁移

### 9.1 目标

将保留主体治理从“用户名特殊判断”迁移为“事实源 + 硬规则”模型。

### 9.2 迁移动作

1. 将 `sys-superadmin`、`system-automation` 注册到 `subject_reserved_policy`
2. 中间件统一读取保留主体策略，而不是散落在页面或 service 层硬编码
3. 所有普通流程默认硬拒绝对保留主体执行：
   - 邀请
   - 导入
   - 删除
   - 禁用
   - 普通角色改绑
   - 批量状态更新
4. 审计中明确记录：
   - `reserved=true`
   - `managed_by=platform_governance`

## 10. 审计与可观测迁移

### 10.1 必须新增的审计字段

建议在现有审计模型上补齐：

- `decision_result`
- `decision_reason_code`
- `required_capability`
- `required_scope`
- `effective_actor_type`
- `policy_source`
- `matched_hard_rule`
- `authz_epoch`

### 10.2 高风险事件最小审计清单

必须覆盖：

- 保留主体治理动作
- 用户禁用 / 角色变更 / scope 变更
- 配置回滚
- 备份恢复
- 导出未脱敏数据
- 明文 secret 读取
- 临时授权申请 / 审批 / 激活 / 回收
- break-glass 使用
- 拒绝访问（401/403）

## 11. 测试与回归方案

### 11.1 单元测试

至少新增：

1. legacy permission -> capability mapping 测试
2. capability + scope 判定测试
3. 保留主体硬拒绝测试
4. 互斥角色 / SoD 测试
5. 审批互斥测试（申请人与审批人不能同一主体）
6. `authz_epoch` 变化后前端重新拉取权限测试

### 11.2 集成测试

至少覆盖：

1. `/users/me` 返回 capability / entitlements / authz_epoch
2. 同一路由旧权限与新 capability 双轨一致
3. 撤权后已登录用户访问高风险接口被拒绝
4. 导出未脱敏数据必须满足附加控制
5. `system-automation` 不可交互式登录
6. 拒绝访问写入授权决策审计

### 11.3 E2E / 回归重点

优先回归页面：

- `/security/users`
- `/security/roles`
- `/alerts/notifications`
- `/storage/backup`
- `/reports/scheduled`
- `/reports/downloads`
- `/settings/versions`
- `/security/audit`

## 12. 上线与回滚策略

### 12.1 上线顺序

1. 上 capability / registry / mapping 表
2. 上 `/users/me` 扩展返回
3. 上前端 capability 读取与 route registry
4. 上后端 Shadow Mode capability 守卫
5. 上高风险接口 Hard Enforce
6. 上审批 / JIT / SoD 能力
7. 关闭旧权限串兼容

### 12.2 回滚原则

若迁移异常，回滚优先级为：

1. 关闭 capability 强制开关，退回 compatibility mode
2. 保留新增表结构，不立即 drop
3. 前端回退到旧权限串判断
4. 高风险接口仍维持 fail-closed，不回退到完全放行

### 12.3 迁移完成判定

当满足以下条件，可认为授权迁移完成：

1. 所有页面均已绑定 `view capability`
2. 所有关键 API 均已绑定 `required capability + scope`
3. `/users/me` 不再依赖旧权限串作为主事实源
4. 高风险操作具备审批 / JIT / 审计 / SoD 控制
5. 保留主体治理不再依赖页面或业务 service 中的硬编码用户名判断
6. 旧权限映射层仅用于历史兼容，不再作为新增功能入口

## 13. 与 `07-authorization-matrix-draft.md` 的配合方式

推荐三份文档的使用顺序如下：

1. `06-authorization-redesign.md`
   - 定义原则、问题、治理边界、缺口
2. `07-authorization-matrix-draft.md`
   - 定义页面 / API / 主体 / 高风险动作的 capability 与 scope
3. `08-authorization-migration-design.md`
   - 定义如何从当前实现迁移到目标模型

## 14. 下一步建议产出

基于本文档，下一轮建议直接落三项实施材料：

1. **数据库 DDL 草案**
   - capability_definition
   - role_capability_binding
   - route_registry
   - api_policy_registry
   - authz_version
   - approval_request
   - temporary_grant
   - role_conflict_policy

当前 V1 草案已落地到：`docs/01-architecture/core/09-authorization-ddl-draft.md`

2. **旧权限映射表初版**
   - 将当前 `users:read` / `logs:read` / `alerts:write` 等全部映射完成

当前 V1 草案已落地到：`docs/01-architecture/core/10-authorization-legacy-permission-mapping-draft.md`

3. **前后端改造任务拆解单**
   - 精确到文件/模块/接口级别

当前 V1 草案已落地到：`docs/01-architecture/core/11-authorization-implementation-task-breakdown.md`
