-- NexusLog PostgreSQL 种子数据（开发环境）
-- change_level: none

WITH default_tenant AS (
    INSERT INTO obs.tenant (name, display_name, status)
    VALUES ('default', '默认租户', 'active')
    ON CONFLICT (name) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        status = EXCLUDED.status,
        updated_at = NOW()
    RETURNING id
)
INSERT INTO roles (id, tenant_id, name, description, permissions)
SELECT role.id, default_tenant.id, role.name, role.description, role.permissions
FROM default_tenant
CROSS JOIN (
    VALUES
        (
            '10000000-0000-0000-0000-000000000001'::uuid,
            'system_admin',
            '系统管理员',
            '["users:read", "users:write", "logs:read", "logs:export", "alerts:read", "alerts:write", "incidents:read", "incidents:write", "metrics:read", "dashboards:read", "audit:read"]'::jsonb
        ),
        (
            '10000000-0000-0000-0000-000000000002'::uuid,
            'operator',
            '运维人员',
            '["logs:read", "logs:export", "alerts:read", "alerts:write", "incidents:read", "incidents:write", "metrics:read", "dashboards:read", "audit:read"]'::jsonb
        ),
        (
            '10000000-0000-0000-0000-000000000003'::uuid,
            'viewer',
            '只读用户',
            '["logs:read", "dashboards:read", "metrics:read"]'::jsonb
        ),
        (
            '10000000-0000-0000-0000-000000000004'::uuid,
            'super_admin',
            '系统超级管理员（保留角色）',
            '["*"]'::jsonb
        ),
        (
            '10000000-0000-0000-0000-000000000005'::uuid,
            'system_automation',
            '系统自动化操作（保留角色）',
            '["audit:write"]'::jsonb
        )
) AS role(id, name, description, permissions)
ON CONFLICT (tenant_id, name) DO UPDATE
SET description = EXCLUDED.description,
    permissions = EXCLUDED.permissions;
