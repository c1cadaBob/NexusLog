-- NexusLog PostgreSQL 种子数据（开发环境）
-- change_level: none

-- 默认租户
INSERT INTO tenants (id, name, display_name, status) VALUES
    ('00000000-0000-0000-0000-000000000001', 'default', '默认租户', 'active')
ON CONFLICT (name) DO NOTHING;

-- 默认角色
INSERT INTO roles (id, tenant_id, name, description, permissions) VALUES
    ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'admin', '系统管理员', '["*"]'),
    ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'operator', '运维人员', '["logs:read", "logs:search", "alerts:read", "alerts:manage", "dashboard:read"]'),
    ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'viewer', '只读用户', '["logs:read", "logs:search", "alerts:read", "dashboard:read"]')
ON CONFLICT (tenant_id, name) DO NOTHING;
