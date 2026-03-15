-- 000018: roles 种子数据 —— admin / operator / viewer
-- change_level: normal

BEGIN;

-- 确保默认租户存在（幂等），租户主键由数据库默认值生成
WITH default_tenant AS (
    INSERT INTO obs.tenant (name, display_name, status)
    VALUES ('default', 'Default Tenant', 'active')
    ON CONFLICT (name) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        status = EXCLUDED.status,
        updated_at = NOW()
    RETURNING id
)
-- 插入三个内置角色（幂等）
INSERT INTO roles (id, tenant_id, name, description, permissions)
SELECT role.id, default_tenant.id, role.name, role.description, role.permissions
FROM default_tenant
CROSS JOIN (
    VALUES
        (
            '10000000-0000-0000-0000-000000000001'::uuid,
            'admin',
            'Full system access including user management and system settings',
            '["*"]'::jsonb
        ),
        (
            '10000000-0000-0000-0000-000000000002'::uuid,
            'operator',
            'Operational access: log search, alert management, incident handling, monitoring',
            '["logs:read","logs:export","alerts:read","alerts:write","incidents:read","incidents:write","metrics:read","dashboards:read"]'::jsonb
        ),
        (
            '10000000-0000-0000-0000-000000000003'::uuid,
            'viewer',
            'Read-only access: view logs, dashboards, and monitoring data',
            '["logs:read","dashboards:read","metrics:read"]'::jsonb
        )
) AS role(id, name, description, permissions)
ON CONFLICT (tenant_id, name) DO NOTHING;

COMMIT;
