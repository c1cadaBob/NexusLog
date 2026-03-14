-- NexusLog PostgreSQL 种子数据（开发环境）
-- change_level: none

-- 默认租户
INSERT INTO obs.tenant (id, name, display_name, status) VALUES
    ('00000000-0000-0000-0000-000000000001', 'default', '默认租户', 'active')
ON CONFLICT (name) DO NOTHING;

-- 默认角色
INSERT INTO roles (id, tenant_id, name, description, permissions) VALUES
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'system_admin', '系统管理员', '["users:read", "users:write", "logs:read", "logs:export", "alerts:read", "alerts:write", "incidents:read", "incidents:write", "metrics:read", "dashboards:read", "audit:read"]'),
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'operator', '运维人员', '["logs:read", "logs:export", "alerts:read", "alerts:write", "incidents:read", "incidents:write", "metrics:read", "dashboards:read", "audit:read"]'),
    ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'viewer', '只读用户', '["logs:read", "dashboards:read", "metrics:read"]'),
    ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'super_admin', '系统超级管理员（保留角色）', '["*"]'),
    ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'system_automation', '系统自动化操作（保留角色）', '["audit:write"]')
ON CONFLICT (tenant_id, name) DO NOTHING;
