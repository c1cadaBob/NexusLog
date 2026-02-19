-- NexusLog PostgreSQL Row-Level Security 策略 - 租户隔离
-- change_level: cab
-- 生效时间: 发布窗口

-- 启用 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 租户隔离策略：用户只能访问自己租户的数据
-- current_setting('app.current_tenant_id') 由应用层在连接时设置

CREATE POLICY tenant_isolation_users ON users
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_roles ON roles
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_alert_rules ON alert_rules
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

CREATE POLICY tenant_isolation_audit_logs ON audit_logs
    USING (tenant_id::text = current_setting('app.current_tenant_id', true));

-- 超级管理员绕过 RLS（通过角色）
-- GRANT BYPASSRLS TO nexuslog_superadmin;
