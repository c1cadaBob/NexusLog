-- 回滚 000026：恢复原始 demo 用户结构
-- change_level: normal

BEGIN;

CREATE TEMP TABLE tmp_target_tenant (
    id UUID PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO tmp_target_tenant (id)
SELECT id
FROM obs.tenant
WHERE name = 'default'
ON CONFLICT (id) DO NOTHING;

-- 删除系统保留账号与角色绑定
DELETE FROM user_roles
WHERE user_id IN (
    SELECT u.id
    FROM users u
    JOIN tmp_target_tenant target_tenant ON u.tenant_id = target_tenant.id
    WHERE u.username IN ('sys-superadmin', 'system-automation')
);

DELETE FROM user_credentials
WHERE user_id IN (
    SELECT u.id
    FROM users u
    JOIN tmp_target_tenant target_tenant ON u.tenant_id = target_tenant.id
    WHERE u.username = 'system-automation'
);

DELETE FROM users
WHERE id IN (
    SELECT u.id
    FROM users u
    JOIN tmp_target_tenant target_tenant ON u.tenant_id = target_tenant.id
    WHERE u.username = 'system-automation'
);

-- 将系统超级管理员恢复为 demo-admin
UPDATE users
SET username = 'demo-admin',
    email = 'admin@nexuslog.dev',
    display_name = 'Demo Admin',
    status = 'active',
    updated_at = NOW()
WHERE id IN (
    SELECT u.id
    FROM users u
    JOIN tmp_target_tenant target_tenant ON u.tenant_id = target_tenant.id
    WHERE u.username = 'sys-superadmin'
);

-- 恢复默认 demo 用户
INSERT INTO users (id, tenant_id, username, email, display_name, status)
SELECT user_seed.id, target_tenant.id, user_seed.username, user_seed.email, user_seed.display_name, 'active'
FROM tmp_target_tenant target_tenant
CROSS JOIN (
    VALUES
        (
            '20000000-0000-0000-0000-000000000002'::uuid,
            'demo-operator',
            'operator@nexuslog.dev',
            'Demo Operator'
        ),
        (
            '20000000-0000-0000-0000-000000000003'::uuid,
            'demo-viewer',
            'viewer@nexuslog.dev',
            'Demo Viewer'
        )
) AS user_seed(id, username, email, display_name)
ON CONFLICT (tenant_id, username) DO UPDATE
SET email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    status = 'active',
    updated_at = NOW();

INSERT INTO user_credentials (tenant_id, user_id, password_hash, password_algo, password_cost)
SELECT
    target_tenant.id,
    u.id,
    '$2a$12$Grb472rXmEStVJprIfaFwONirfpwc7iouq/IS1SPYX9kVUVCe188i',
    'bcrypt',
    12
FROM tmp_target_tenant target_tenant
JOIN users u
  ON u.tenant_id = target_tenant.id
 AND u.username IN ('demo-admin', 'demo-operator', 'demo-viewer')
ON CONFLICT (user_id) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    password_algo = EXCLUDED.password_algo,
    password_cost = EXCLUDED.password_cost,
    password_updated_at = NOW(),
    updated_at = NOW();

-- 恢复 admin 角色名称与绑定
UPDATE roles
SET name = 'admin',
    description = 'Full system access including user management and system settings',
    permissions = '["*"]'::jsonb
WHERE tenant_id IN (SELECT id FROM tmp_target_tenant)
  AND lower(name) = 'system_admin';

DELETE FROM roles
WHERE tenant_id IN (SELECT id FROM tmp_target_tenant)
  AND lower(name) IN ('super_admin', 'system_automation');

DELETE FROM user_roles
WHERE user_id IN (
    SELECT u.id
    FROM users u
    JOIN tmp_target_tenant target_tenant ON u.tenant_id = target_tenant.id
    WHERE u.username IN ('demo-admin', 'demo-operator', 'demo-viewer')
);

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.tenant_id = u.tenant_id
JOIN tmp_target_tenant target_tenant ON u.tenant_id = target_tenant.id
WHERE (u.username = 'demo-admin' AND lower(r.name) = 'admin')
   OR (u.username = 'demo-operator' AND lower(r.name) = 'operator')
   OR (u.username = 'demo-viewer' AND lower(r.name) = 'viewer')
ON CONFLICT (user_id, role_id) DO NOTHING;

COMMIT;
