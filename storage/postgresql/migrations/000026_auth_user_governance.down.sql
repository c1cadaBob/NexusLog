-- 回滚 000026：恢复原始 demo 用户结构
-- change_level: normal

BEGIN;

-- 删除系统保留账号与角色绑定
DELETE FROM user_roles
WHERE user_id IN (
    SELECT id
    FROM users
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
      AND username IN ('sys-superadmin', 'system-automation')
);

DELETE FROM user_credentials
WHERE user_id IN (
    SELECT id
    FROM users
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
      AND username = 'system-automation'
);

DELETE FROM users
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND username = 'system-automation';

-- 将系统超级管理员恢复为 demo-admin
UPDATE users
SET username = 'demo-admin',
    email = 'admin@nexuslog.dev',
    display_name = 'Demo Admin',
    status = 'active',
    updated_at = NOW()
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND username = 'sys-superadmin';

-- 恢复默认 demo 用户
INSERT INTO users (id, tenant_id, username, email, display_name, status)
VALUES
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'demo-operator', 'operator@nexuslog.dev', 'Demo Operator', 'active'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'demo-viewer', 'viewer@nexuslog.dev', 'Demo Viewer', 'active')
ON CONFLICT (tenant_id, username) DO UPDATE
SET email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    status = 'active',
    updated_at = NOW();

INSERT INTO user_credentials (tenant_id, user_id, password_hash, password_algo, password_cost)
VALUES
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '$2a$12$Grb472rXmEStVJprIfaFwONirfpwc7iouq/IS1SPYX9kVUVCe188i', 'bcrypt', 12),
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '$2a$12$Grb472rXmEStVJprIfaFwONirfpwc7iouq/IS1SPYX9kVUVCe188i', 'bcrypt', 12),
  ('00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', '$2a$12$Grb472rXmEStVJprIfaFwONirfpwc7iouq/IS1SPYX9kVUVCe188i', 'bcrypt', 12)
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
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND lower(name) = 'system_admin';

DELETE FROM roles
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
  AND lower(name) IN ('super_admin', 'system_automation');

DELETE FROM user_roles
WHERE user_id IN (
    '20000000-0000-0000-0000-000000000001'::uuid,
    '20000000-0000-0000-0000-000000000002'::uuid,
    '20000000-0000-0000-0000-000000000003'::uuid
);

INSERT INTO user_roles (user_id, role_id)
VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003')
ON CONFLICT (user_id, role_id) DO NOTHING;

COMMIT;
