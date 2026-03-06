-- 000018: roles 种子数据 —— admin / operator / viewer
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

-- 插入三个内置角色（幂等）
INSERT INTO roles (id, tenant_id, name, description, permissions)
VALUES
    (
        '10000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000001',
        'admin',
        'Full system access including user management and system settings',
        '["*"]'
    ),
    (
        '10000000-0000-0000-0000-000000000002',
        '00000000-0000-0000-0000-000000000001',
        'operator',
        'Operational access: log search, alert management, incident handling, monitoring',
        '["logs:read","logs:export","alerts:read","alerts:write","incidents:read","incidents:write","metrics:read","dashboards:read"]'
    ),
    (
        '10000000-0000-0000-0000-000000000003',
        '00000000-0000-0000-0000-000000000001',
        'viewer',
        'Read-only access: view logs, dashboards, and monitoring data',
        '["logs:read","dashboards:read","metrics:read"]'
    )
ON CONFLICT (tenant_id, name) DO NOTHING;

COMMIT;
