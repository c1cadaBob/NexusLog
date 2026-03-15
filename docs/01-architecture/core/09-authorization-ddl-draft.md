# 09. 授权数据库 DDL 草案（V1）

## 1. 文档目标

本文档是以下两份文档的数据库落地草案：

- `docs/01-architecture/core/07-authorization-matrix-draft.md`
- `docs/01-architecture/core/08-authorization-migration-design.md`

它回答的问题不是“授权模型应该是什么”，而是：

1. 现有 PostgreSQL 结构上，授权模型第一批应该怎么落表
2. 哪些能力先建表，哪些暂时保留兼容层
3. 当前 `roles.permissions` 与保留用户名硬编码，怎样平滑迁移到新事实源
4. 审批、临时授权、互斥角色、授权审计应该怎样为后续实现预留结构

本文档只产出 **DDL 草案**，不等同于已经落库的正式迁移脚本。

## 2. 与当前运行时现状的衔接

### 2.1 当前真实基线

当前仓库运行时数据库真相源仍是：

- `storage/postgresql/migrations/000001_init_schema.up.sql`
- `storage/postgresql/migrations/000012_mvp_auth_session_and_security.up.sql`
- `storage/postgresql/migrations/000025_auth_session_rotation_replay_tracking.up.sql`
- `storage/postgresql/migrations/000026_auth_user_governance.up.sql`

其中与授权重构最相关的是 `000026_auth_user_governance.up.sql`，它已经完成了以下事情：

- 将旧 `admin` 角色收敛为 `system_admin`
- 固化 `super_admin` 与 `system_automation` 两个内置角色
- 将超级管理员账号收敛到 `sys-superadmin`
- 新增 `system-automation` 系统自动化账号
- 继续沿用 `roles.permissions` JSON 作为主要权限事实源
- 保留了若干以用户名为条件的硬编码治理逻辑

这意味着本 DDL 草案必须满足两个前提：

1. **不能打断当前 `roles.permissions` 的运行方式**
2. **要为 capability / route registry / 保留主体治理提供增量落地路径**

### 2.2 本草案不立即修改的内容

以下内容暂不在第一批 DDL 中强制落库：

- 通用 `actors` 主体总表
- 完整 `scope_definition` 字典表
- 完整 `entitlement_registry` / `feature_gate_registry`
- 字段级可见性策略
- 数据分级策略
- 全量服务账号体系

这些能力后续仍可引入，但不会阻塞 V1 授权迁移。

## 3. DDL 设计原则

### 3.1 增量优先

V1 原则：

- 先新增表，不先替换老表
- 先引入 capability 事实源，不先删 `roles.permissions`
- 先引入注册表，不先改所有业务代码
- 先支持审计与回滚，不先做不可逆重构

### 3.2 命名与字段规范

对齐当前仓库 PostgreSQL 风格，建议统一遵循：

- 主键使用 `UUID`，默认 `uuid_generate_v4()`
- 时间字段使用 `TIMESTAMPTZ`
- 所有注册表 / 治理表尽量包含 `created_at`、`updated_at`
- 可扩展附加字段统一使用 `metadata JSONB NOT NULL DEFAULT '{}'::jsonb`
- 枚举状态先用 `VARCHAR + CHECK`，不急于引入 PostgreSQL enum type

### 3.3 保持兼容面可回滚

第一批迁移必须满足：

- 新增表全部可单独回滚
- 老 `roles.permissions` 仍可继续工作
- `/users/me` 可以双轨返回旧权限串和新 capability
- 保留主体治理失败时，默认对高风险写操作 `fail-closed`

## 4. 建议迁移切分

建议将未来正式迁移拆成 4 个批次，而不是一个大 SQL：

1. `000027_authz_registry_phase_a.up.sql`
   - `capability_definition`
   - `legacy_permission_mapping`
   - `subject_reserved_policy`
   - `authz_version`
2. `000028_authz_registry_routing_phase_a.up.sql`
   - `role_capability_binding`
   - `route_registry`
   - `api_policy_registry`
3. `000029_authz_governance_phase_b.up.sql`
   - `approval_request`
   - `temporary_grant`
   - `role_conflict_policy`
   - `capability_conflict_policy`
4. `000030_authz_observability_phase_b.up.sql`
   - `authz_decision_log`
   - `audit_logs` 补充授权决策字段

这样拆分的原因：

- Phase A 可以先落注册表，不立即影响运行时拦截
- Phase B 属于高风险治理对象，适合在 capability 已接管后落地
- 观测与审计可独立上线，不与权限强切绑死
- 每批都可以单独回滚，符合当前项目迁移规范

## 5. Phase A：核心注册表 DDL 草案

### 5.1 `capability_definition`

用途：

- 统一管理 capability 字典
- 标记能力所属域、风险等级、治理要求
- 作为页面/API 注册表的能力引用源

```sql
CREATE TABLE IF NOT EXISTS capability_definition (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(128) NOT NULL UNIQUE,
    domain VARCHAR(64) NOT NULL,
    description TEXT,
    risk_level VARCHAR(16) NOT NULL DEFAULT 'low'
        CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    is_reserved BOOLEAN NOT NULL DEFAULT FALSE,
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    requires_jit BOOLEAN NOT NULL DEFAULT FALSE,
    requires_sod BOOLEAN NOT NULL DEFAULT FALSE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_capability_definition_domain_enabled
    ON capability_definition (domain, enabled);

CREATE INDEX IF NOT EXISTS idx_capability_definition_risk
    ON capability_definition (risk_level, enabled);
```

建议说明：

- `name` 直接使用统一 capability 名，例如 `iam.user.read`
- `domain` 用于前后端按域聚合，例如 `iam`、`audit`、`alert`
- `enabled=false` 用于迁移期间灰度、废弃能力兼容，而不是物理删除

### 5.2 `legacy_permission_mapping`

用途：

- 将旧权限串映射到新 capability bundle
- 在迁移中间件中承接 `roles.permissions` 到 capability 的兼容转换

```sql
CREATE TABLE IF NOT EXISTS legacy_permission_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legacy_permission VARCHAR(128) NOT NULL UNIQUE,
    capability_bundle JSONB NOT NULL DEFAULT '[]'::jsonb,
    scope_bundle JSONB NOT NULL DEFAULT '[]'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (jsonb_typeof(capability_bundle) = 'array'),
    CHECK (jsonb_typeof(scope_bundle) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_legacy_permission_mapping_enabled
    ON legacy_permission_mapping (enabled);
```

建议说明：

- 迁移期 capability 判定先查显式绑定，再查本表
- `capability_bundle` 用数组而不是逗号字符串，便于后续服务端直接反序列化
- 当前项目里的 `users:read`、`users:write`、`logs:read` 等都应在本表留档

### 5.3 `role_capability_binding`

用途：

- 将角色和 capability 的绑定从 `roles.permissions` JSON 中逐步剥离出来
- 支持 role 对 capability 的作用域上限约束

```sql
CREATE TABLE IF NOT EXISTS role_capability_binding (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    capability_id UUID NOT NULL REFERENCES capability_definition(id) ON DELETE CASCADE,
    scope_ceiling JSONB NOT NULL DEFAULT '[]'::jsonb,
    effect VARCHAR(10) NOT NULL DEFAULT 'allow'
        CHECK (effect IN ('allow', 'deny')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (role_id, capability_id, effect),
    CHECK (jsonb_typeof(scope_ceiling) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_role_capability_binding_role
    ON role_capability_binding (role_id);

CREATE INDEX IF NOT EXISTS idx_role_capability_binding_capability
    ON role_capability_binding (capability_id);
```

建议说明：

- V1 阶段业务上可以只使用 `allow`，但 DDL 预留 `deny`
- `scope_ceiling` 建议先存数组，例如 `['tenant', 'tenant_group:a']`
- 当前 `roles.permissions` 仍保留，等 capability 接管后再逐步退役

### 5.4 `subject_reserved_policy`

用途：

- 把 `sys-superadmin`、`system-automation` 等保留主体从用户名硬编码迁到事实源
- 统一控制交互式登录、Break-Glass、普通流程是否允许操作

```sql
CREATE TABLE IF NOT EXISTS subject_reserved_policy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES obs.tenant(id) ON DELETE CASCADE,
    subject_type VARCHAR(32) NOT NULL
        CHECK (subject_type IN ('user', 'role', 'service_account', 'system_subject')),
    subject_id UUID,
    subject_ref VARCHAR(128) NOT NULL,
    reserved BOOLEAN NOT NULL DEFAULT TRUE,
    interactive_login_allowed BOOLEAN NOT NULL DEFAULT TRUE,
    break_glass_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    ordinary_mutation_allowed BOOLEAN NOT NULL DEFAULT FALSE,
    managed_by VARCHAR(64) NOT NULL DEFAULT 'platform_governance',
    reserved_reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, subject_type, subject_ref)
);

CREATE INDEX IF NOT EXISTS idx_subject_reserved_policy_subject
    ON subject_reserved_policy (subject_type, subject_ref);

CREATE INDEX IF NOT EXISTS idx_subject_reserved_policy_reserved
    ON subject_reserved_policy (reserved, interactive_login_allowed);
```

建议说明：

- V1 不引入统一 `actors` 表，因此这里同时保留 `subject_id` 与 `subject_ref`
- `subject_ref` 用于兼容当前以用户名硬编码的保留主体识别逻辑
- `ordinary_mutation_allowed=false` 用于限制邀请、导入、禁用、删除、普通改绑角色等操作

### 5.5 `authz_version`

用途：

- 为撤权传播、前端强刷、长连接失效提供版本戳
- 解决修改角色后旧会话继续持有历史权限的问题

```sql
CREATE TABLE IF NOT EXISTS authz_version (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES obs.tenant(id) ON DELETE CASCADE,
    subject_type VARCHAR(32) NOT NULL
        CHECK (subject_type IN ('user', 'service_account', 'system_subject')),
    subject_id UUID NOT NULL,
    authz_epoch BIGINT NOT NULL DEFAULT 1,
    reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_authz_version_subject
    ON authz_version (subject_type, subject_id);
```

建议说明：

- 本表比直接给 `users` 加 `authz_epoch` 更易扩展到 `system-automation` 等非普通用户主体
- 用户改绑角色、scope、审批结果生效后，都应 bump `authz_epoch`

### 5.6 `route_registry`

用途：

- 将页面访问要求注册化
- 让菜单、路由守卫、Dashboard 快捷入口、底部导航使用统一事实源

```sql
CREATE TABLE IF NOT EXISTS route_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    path VARCHAR(255) NOT NULL UNIQUE,
    page_name VARCHAR(128) NOT NULL UNIQUE,
    view_capability VARCHAR(128) REFERENCES capability_definition(name),
    default_scope JSONB NOT NULL DEFAULT '[]'::jsonb,
    required_entitlement VARCHAR(128),
    required_feature_flag VARCHAR(128),
    risk_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (jsonb_typeof(default_scope) = 'array'),
    CHECK (jsonb_typeof(risk_tags) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_route_registry_enabled
    ON route_registry (enabled);
```

建议说明：

- `view_capability` 允许为空，以兼容少量公开页或纯跳转页
- `page_name` 用于前端路由、菜单、埋点、审计统一命名
- `risk_tags` 可用于标记 `high_risk_ui`、`reserved_subject_sensitive`

### 5.7 `api_policy_registry`

用途：

- 固化 API 与能力、作用域、入口层级、附加治理要求的映射
- 为后端 capability 中间件提供统一策略来源

```sql
CREATE TABLE IF NOT EXISTS api_policy_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    method VARCHAR(16) NOT NULL,
    path_pattern VARCHAR(255) NOT NULL,
    entry_tier VARCHAR(32) NOT NULL DEFAULT 'authenticated'
        CHECK (entry_tier IN ('public', 'authenticated', 'tenant_admin', 'platform_admin', 'system_only')),
    required_capability VARCHAR(128) REFERENCES capability_definition(name),
    default_scope JSONB NOT NULL DEFAULT '[]'::jsonb,
    required_entitlement VARCHAR(128),
    required_feature_flag VARCHAR(128),
    risk_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    policy_mode VARCHAR(16) NOT NULL DEFAULT 'enforce'
        CHECK (policy_mode IN ('shadow', 'soft_enforce', 'enforce')),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (method, path_pattern),
    CHECK (jsonb_typeof(default_scope) = 'array'),
    CHECK (jsonb_typeof(risk_tags) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_api_policy_registry_enabled
    ON api_policy_registry (enabled, entry_tier);
```

建议说明：

- `policy_mode` 用于支持 Shadow Mode -> Soft Enforce -> Enforce 的迁移路径
- `entry_tier` 用于区分开放接口、普通登录接口、平台管理员接口、系统仅内部接口
- 高风险接口应显式打上 `risk_tags`

## 6. Phase B：治理与审批 DDL 草案

### 6.1 `approval_request`

用途：

- 承载高风险动作审批
- 支持双人审批、审批过期、执行追踪

```sql
CREATE TABLE IF NOT EXISTS approval_request (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES obs.tenant(id) ON DELETE CASCADE,
    request_type VARCHAR(64) NOT NULL,
    initiator_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    approver_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id VARCHAR(255),
    requested_capability VARCHAR(128) REFERENCES capability_definition(name),
    requested_scope JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'cancelled', 'executed')),
    justification TEXT,
    ticket_id VARCHAR(128),
    request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    CHECK (jsonb_typeof(requested_scope) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_approval_request_tenant_status
    ON approval_request (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_request_initiator
    ON approval_request (initiator_user_id, created_at DESC);
```

建议说明：

- V1 先使用 `*_user_id`，等未来引入统一 actor 模型后再抽象为 `actor_id`
- 审批人与申请人不得相同，这条约束建议在服务层和测试层同时保证

### 6.2 `temporary_grant`

用途：

- 承载 JIT、临时授权、支持会话、Break-Glass 激活结果

```sql
CREATE TABLE IF NOT EXISTS temporary_grant (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES obs.tenant(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    grant_type VARCHAR(32) NOT NULL
        CHECK (grant_type IN ('jit', 'support_access', 'break_glass', 'temporary_role')),
    capability_bundle JSONB NOT NULL DEFAULT '[]'::jsonb,
    scope_bundle JSONB NOT NULL DEFAULT '[]'::jsonb,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    justification TEXT,
    ticket_id VARCHAR(128),
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('pending', 'active', 'expired', 'revoked', 'rejected')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (jsonb_typeof(capability_bundle) = 'array'),
    CHECK (jsonb_typeof(scope_bundle) = 'array'),
    CHECK (expires_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS idx_temporary_grant_user_status
    ON temporary_grant (user_id, status, expires_at);
```

建议说明：

- `temporary_grant` 只承载临时增权，不替代正式角色绑定
- 到期后应触发 `authz_version` bump，迫使会话重新获取权限上下文

### 6.3 `role_conflict_policy`

用途：

- 描述互斥角色与职责分离规则
- 防止审批者与执行者、审计管理员与审计完整性管理员等角色同时持有

```sql
CREATE TABLE IF NOT EXISTS role_conflict_policy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES obs.tenant(id) ON DELETE CASCADE,
    policy_name VARCHAR(128) NOT NULL,
    left_role VARCHAR(128) NOT NULL,
    right_role VARCHAR(128) NOT NULL,
    conflict_type VARCHAR(20) NOT NULL DEFAULT 'hard'
        CHECK (conflict_type IN ('hard', 'approval_block', 'warning')),
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, left_role, right_role)
);

CREATE INDEX IF NOT EXISTS idx_role_conflict_policy_enabled
    ON role_conflict_policy (tenant_id, enabled);
```

建议说明：

- `left_role` / `right_role` 在 V1 先按角色名处理，便于与当前 `roles` 表兼容
- 后续若角色模板全局化，可再切到 role id 或 role template id

### 6.4 `capability_conflict_policy`

用途：

- 表达互斥 capability 规则
- 适用于“申请能力 vs 审批能力”“读取明文密钥 vs 自批准”等冲突

```sql
CREATE TABLE IF NOT EXISTS capability_conflict_policy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_name VARCHAR(128) NOT NULL,
    left_capability VARCHAR(128) NOT NULL REFERENCES capability_definition(name),
    right_capability VARCHAR(128) NOT NULL REFERENCES capability_definition(name),
    conflict_type VARCHAR(20) NOT NULL DEFAULT 'hard'
        CHECK (conflict_type IN ('hard', 'approval_block', 'warning')),
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (left_capability, right_capability)
);

CREATE INDEX IF NOT EXISTS idx_capability_conflict_policy_enabled
    ON capability_conflict_policy (enabled);
```

## 7. Phase B：授权可观测 DDL 草案

### 7.1 `authz_decision_log`

用途：

- 独立记录授权通过/拒绝决策
- 将 401/403、能力缺失、scope 缺失、保留主体硬拒绝等原因结构化沉淀

```sql
CREATE TABLE IF NOT EXISTS authz_decision_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id VARCHAR(128),
    tenant_id UUID REFERENCES obs.tenant(id) ON DELETE SET NULL,
    actor_id UUID,
    actor_type VARCHAR(32) NOT NULL
        CHECK (actor_type IN ('user', 'service_account', 'system_subject', 'anonymous')),
    decision_result VARCHAR(16) NOT NULL
        CHECK (decision_result IN ('allow', 'deny', 'shadow_allow', 'shadow_deny')),
    decision_reason_code VARCHAR(64) NOT NULL,
    required_capability VARCHAR(128),
    required_scope JSONB NOT NULL DEFAULT '[]'::jsonb,
    policy_source VARCHAR(64),
    matched_hard_rule VARCHAR(128),
    resource_type VARCHAR(64),
    resource_id VARCHAR(255),
    request_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (jsonb_typeof(required_scope) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_authz_decision_log_tenant_created
    ON authz_decision_log (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_authz_decision_log_actor_created
    ON authz_decision_log (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_authz_decision_log_request
    ON authz_decision_log (request_id);
```

建议说明：

- 该表初期可不分区，待访问量稳定后再按月分区
- `actor_id` 暂不强制外键，避免未来非用户主体时被当前 `users` 表限制

## 8. 对现有表的最小增量修改建议

### 8.1 `audit_logs` 补充授权决策字段

当前 `audit_logs` 已存在，但缺少授权结果字段。建议在观测迁移中补齐：

```sql
ALTER TABLE audit_logs
    ADD COLUMN IF NOT EXISTS decision_result VARCHAR(16),
    ADD COLUMN IF NOT EXISTS decision_reason_code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS required_capability VARCHAR(128),
    ADD COLUMN IF NOT EXISTS required_scope JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS effective_actor_type VARCHAR(32),
    ADD COLUMN IF NOT EXISTS policy_source VARCHAR(64),
    ADD COLUMN IF NOT EXISTS matched_hard_rule VARCHAR(128),
    ADD COLUMN IF NOT EXISTS authz_epoch BIGINT;

CREATE INDEX IF NOT EXISTS idx_audit_logs_decision_created
    ON audit_logs (tenant_id, decision_result, created_at DESC);
```

建议说明：

- 审计日志仍保留业务语义
- 更高频、更结构化的授权解释写入 `authz_decision_log`
- 高风险写操作建议同时写入 `audit_logs` 与 `authz_decision_log`

### 8.2 `roles` 暂不移除 `permissions`

V1 明确不建议立即执行：

```sql
ALTER TABLE roles DROP COLUMN permissions;
```

原因：

- 现有前后端仍依赖该字段
- 兼容映射与 capability 绑定需要一个双轨期
- 过早删除会导致登录、菜单、接口守卫一起失稳

因此本阶段建议保留：

- `roles.permissions` 继续存在
- `role_capability_binding` 作为新事实源增量引入
- 等 Hard Enforce 稳定后再讨论角色 JSON 退役

## 9. 种子数据建议

### 9.1 保留主体策略种子

建议在正式迁移中同时插入两条保留主体策略。

这里**不要再写死固定租户 UUID**，而应使用数据库里已存在的随机租户 ID；推荐通过租户业务键（如 `name='default'`）查询目标租户，再写入策略表：

```sql
WITH target_tenant AS (
    SELECT id
    FROM obs.tenant
    WHERE name = 'default'
)
INSERT INTO subject_reserved_policy (
    tenant_id,
    subject_type,
    subject_ref,
    reserved,
    interactive_login_allowed,
    break_glass_allowed,
    ordinary_mutation_allowed,
    managed_by,
    reserved_reason
)
SELECT
    tenant.id,
    payload.subject_type,
    payload.subject_ref,
    payload.reserved,
    payload.interactive_login_allowed,
    payload.break_glass_allowed,
    payload.ordinary_mutation_allowed,
    payload.managed_by,
    payload.reserved_reason
FROM target_tenant tenant
CROSS JOIN (
    VALUES
        (
            'user',
            'sys-superadmin',
            TRUE,
            TRUE,
            FALSE,
            FALSE,
            'platform_governance',
            '平台唯一超级管理员'
        ),
        (
            'user',
            'system-automation',
            TRUE,
            FALSE,
            FALSE,
            FALSE,
            'platform_governance',
            '系统自动化归因主体，不允许交互式登录'
        )
) AS payload(
    subject_type,
    subject_ref,
    reserved,
    interactive_login_allowed,
    break_glass_allowed,
    ordinary_mutation_allowed,
    managed_by,
    reserved_reason
)
ON CONFLICT (tenant_id, subject_type, subject_ref) DO UPDATE
SET reserved = EXCLUDED.reserved,
    interactive_login_allowed = EXCLUDED.interactive_login_allowed,
    break_glass_allowed = EXCLUDED.break_glass_allowed,
    ordinary_mutation_allowed = EXCLUDED.ordinary_mutation_allowed,
    managed_by = EXCLUDED.managed_by,
    reserved_reason = EXCLUDED.reserved_reason,
    updated_at = NOW();
```

如果后续存在多个 bootstrap 租户，也应沿用同样原则：

- 租户主键使用随机 UUID
- 迁移脚本通过租户业务键或配置输入解析目标租户
- 不再依赖公开、可预测、固定的默认租户 UUID

### 9.2 兼容映射种子

建议至少预置以下映射：

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

具体 bundle 内容应与 `docs/01-architecture/core/10-authorization-legacy-permission-mapping-draft.md` 保持一致。

## 10. 代码改造联动点

在当前仓库中，以下位置后续都应从“用户名 / 旧权限串硬编码”迁到本草案定义的事实源：

- `services/api-service/internal/service/user_governance.go`
- `services/data-services/shared/auth/authorization.go`
- `services/control-plane/internal/middleware/global_tenant_access.go`
- `/users/me` 权限上下文构造逻辑
- 前端 `ProtectedRoute`、菜单、Dashboard 快捷入口

迁移顺序建议：

1. 先读新表，不拦截
2. 再做 Shadow Mode 比对
3. 高风险接口先 Hard Enforce
4. 最后退役 `roles.permissions` 主路径

## 11. 风险与未决问题

### 11.1 当前未引入统一 `actors` 表

这会带来两个现实影响：

- `approval_request`、`temporary_grant` 暂时先用 `*_user_id`
- `authz_decision_log.actor_id` 暂不加外键

这是一个有意识的取舍，不是遗漏。

原因在于：

- 当前系统的主体仍以 `users` 为主
- 一次引入 actor 总表会显著放大迁移面
- V1 先把 capability、注册表、审计闭环跑通更重要

### 11.2 `scope_ceiling` 仍使用 JSON 数组

V1 不单独建设 `scope_definition` 表，而是先采用 JSON 数组表达范围上限。

这样做的好处：

- 不阻塞 capability 迁移
- 前后端可快速共享结构
- 后续若引入正式 scope 字典，仍可平滑迁移

### 11.3 `route_registry` / `api_policy_registry` 先不做强外键到 entitlement / feature gate

因为：

- 当前 entitlement 与 feature gate 尚未形成稳定表结构
- 先以字符串键注册更适合增量阶段
- 后续正式表落地后可再补 FK 或改为注册中心服务

## 12. 建议下一步

基于本 DDL 草案，下一步最适合继续产出两项内容：

1. **旧权限映射表初版**
   - 把现有 `roles.permissions` 全量展开成 capability bundle

当前 V1 草案已落地到：`docs/01-architecture/core/10-authorization-legacy-permission-mapping-draft.md`

2. **前后端改造任务拆解单**
   - 精确到接口、中间件、页面、状态管理、菜单注册

当前 V1 草案已落地到：`docs/01-architecture/core/11-authorization-implementation-task-breakdown.md`

如果直接进入开发实施，则建议顺序为：

1. 先落 `000027` 与 `000028` 正式迁移脚本
2. 扩展 `/users/me` 返回 capability 上下文
3. 上后端 Shadow Mode capability 守卫
4. 再改前端路由守卫与菜单事实源
