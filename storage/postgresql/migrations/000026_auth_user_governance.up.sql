-- 000026: 优化用户/权限结构，收敛为单一超级管理员并新增系统自动化账号
-- change_level: normal

BEGIN;

-- 确保默认租户存在（幂等）
INSERT INTO obs.tenant (id, name, display_name, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'default',
    'Default Tenant',
    'active'
)
ON CONFLICT (name) DO NOTHING;

-- 旧 admin 角色在 system_admin 不存在时原地迁移
UPDATE roles
SET name = 'system_admin',
    description = 'System administrator with user, audit, alert, incident, and monitoring management permissions',
    permissions = '["users:read","users:write","logs:read","logs:export","alerts:read","alerts:write","incidents:read","incidents:write","metrics:read","dashboards:read","audit:read"]'::jsonb
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND lower(name) = 'admin'
  AND NOT EXISTS (
      SELECT 1
      FROM roles r2
      WHERE r2.tenant_id = roles.tenant_id
        AND lower(r2.name) = 'system_admin'
  );

-- 标准内置角色（幂等）
INSERT INTO roles (id, tenant_id, name, description, permissions)
VALUES
    (
        '10000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001',
        'system_admin',
        'System administrator with user, audit, alert, incident, and monitoring management permissions',
        '["users:read","users:write","logs:read","logs:export","alerts:read","alerts:write","incidents:read","incidents:write","metrics:read","dashboards:read","audit:read"]'::jsonb
    ),
    (
        '10000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001',
        'operator',
        'Operational access: log search, alert management, incident handling, monitoring',
        '["logs:read","logs:export","alerts:read","alerts:write","incidents:read","incidents:write","metrics:read","dashboards:read","audit:read"]'::jsonb
    ),
    (
        '10000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000001',
        'viewer',
        'Read-only access: view logs, dashboards, and monitoring data',
        '["logs:read","dashboards:read","metrics:read"]'::jsonb
    ),
    (
        '10000000-0000-0000-0000-000000000004',
        '00000000-0000-0000-0000-000000000001',
        'super_admin',
        'Reserved super administrator role. Only one bootstrap user may hold this role.',
        '["*"]'::jsonb
    ),
    (
        '10000000-0000-0000-0000-000000000005',
        '00000000-0000-0000-0000-000000000001',
        'system_automation',
        'Reserved system account role for automated operation and audit attribution.',
        '["audit:write"]'::jsonb
    )
ON CONFLICT (tenant_id, name) DO UPDATE
SET description = EXCLUDED.description,
    permissions = EXCLUDED.permissions;

-- 若存在遗留 admin 角色，将其绑定迁移到 system_admin 后再删除
INSERT INTO user_roles (user_id, role_id)
SELECT ur.user_id, system_admin_role.id
FROM user_roles ur
JOIN roles legacy_admin_role ON legacy_admin_role.id = ur.role_id
JOIN roles system_admin_role
  ON system_admin_role.tenant_id = legacy_admin_role.tenant_id
 AND lower(system_admin_role.name) = 'system_admin'
WHERE legacy_admin_role.tenant_id = '00000000-0000-0000-0000-000000000001'
  AND lower(legacy_admin_role.name) = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

DELETE FROM user_roles ur
USING roles legacy_admin_role
WHERE ur.role_id = legacy_admin_role.id
  AND legacy_admin_role.tenant_id = '00000000-0000-0000-0000-000000000001'
  AND lower(legacy_admin_role.name) = 'admin';

DELETE FROM roles
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND lower(name) = 'admin';

-- 将原 demo-admin 账号升级为系统超级管理员；若不存在则补建
UPDATE users
SET username = 'sys-superadmin',
    email = 'superadmin@nexuslog.dev',
    display_name = 'System Super Admin',
    status = 'active',
    updated_at = NOW()
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND username = 'demo-admin'
  AND NOT EXISTS (
      SELECT 1
      FROM users existing_super_admin
      WHERE existing_super_admin.tenant_id = users.tenant_id
        AND existing_super_admin.username = 'sys-superadmin'
  );

INSERT INTO users (id, tenant_id, username, email, display_name, status)
VALUES (
    '20000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'sys-superadmin',
    'superadmin@nexuslog.dev',
    'System Super Admin',
    'active'
)
ON CONFLICT (tenant_id, username) DO UPDATE
SET email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    status = 'active',
    updated_at = NOW();

INSERT INTO user_credentials (tenant_id, user_id, password_hash, password_algo, password_cost)
SELECT
    '00000000-0000-0000-0000-000000000001',
    user_super_admin.id,
    '$2a$12$Grb472rXmEStVJprIfaFwONirfpwc7iouq/IS1SPYX9kVUVCe188i',
    'bcrypt',
    12
FROM users user_super_admin
WHERE user_super_admin.tenant_id = '00000000-0000-0000-0000-000000000001'
  AND user_super_admin.username = 'sys-superadmin'
ON CONFLICT (user_id) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    password_algo = EXCLUDED.password_algo,
    password_cost = EXCLUDED.password_cost,
    password_updated_at = NOW(),
    updated_at = NOW();

-- 为系统自动化写审计预留独立账号（默认无密码，不允许交互式登录）
INSERT INTO users (id, tenant_id, username, email, display_name, status)
VALUES (
    '20000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'system-automation',
    'system-automation@nexuslog.dev',
    'System Automation',
    'active'
)
ON CONFLICT (tenant_id, username) DO UPDATE
SET email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    status = 'active',
    updated_at = NOW();

DELETE FROM user_credentials
WHERE user_id IN (
    SELECT id
    FROM users
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
      AND username = 'system-automation'
);

-- 固化系统保留账号的角色关系
DELETE FROM user_roles
WHERE user_id IN (
    SELECT id
    FROM users
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
      AND username IN ('sys-superadmin', 'system-automation')
);

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.tenant_id = u.tenant_id
WHERE u.tenant_id = '00000000-0000-0000-0000-000000000001'
  AND u.username = 'sys-superadmin'
  AND lower(r.name) = 'super_admin'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.tenant_id = u.tenant_id
WHERE u.tenant_id = '00000000-0000-0000-0000-000000000001'
  AND u.username = 'system-automation'
  AND lower(r.name) = 'system_automation'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 删除遗留演示用户前，先清空无法级联的引用
UPDATE alert_rules
SET created_by = NULL
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND created_by IN (
      SELECT id FROM users
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

UPDATE audit_logs
SET user_id = NULL
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND user_id IN (
      SELECT id FROM users
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

UPDATE notification_channels
SET created_by = NULL
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND created_by IN (
      SELECT id FROM users
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

UPDATE incidents
SET assigned_to = NULL
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND assigned_to IN (
      SELECT id FROM users
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

UPDATE incidents
SET created_by = NULL
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND created_by IN (
      SELECT id FROM users
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

UPDATE incident_timeline
SET actor_id = NULL
WHERE actor_id IN (
    SELECT id FROM users
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
      AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
);

UPDATE resource_thresholds
SET created_by = NULL
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND created_by IN (
      SELECT id FROM users
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

UPDATE export_jobs
SET created_by = NULL
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND created_by IN (
      SELECT id FROM users
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

UPDATE alert_silences
SET created_by = NULL
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND created_by IN (
      SELECT id FROM users
      WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
        AND username IN ('demo-admin', 'demo-operator', 'demo-viewer')
  );

-- 清理无用的演示用户，仅保留系统超级管理员与系统自动化账号
DELETE FROM users
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND username IN ('demo-admin', 'demo-operator', 'demo-viewer');

COMMIT;
