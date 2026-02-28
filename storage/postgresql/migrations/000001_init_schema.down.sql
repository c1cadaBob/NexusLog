-- NexusLog PostgreSQL 回滚 - 初始化 Schema

DROP INDEX IF EXISTS idx_alert_rules_tenant;
DROP INDEX IF EXISTS idx_audit_logs_user;
DROP INDEX IF EXISTS idx_audit_logs_tenant_created;
DROP INDEX IF EXISTS idx_users_tenant;

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS alert_rules;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS obs.tenant;
DROP SCHEMA IF EXISTS obs;
