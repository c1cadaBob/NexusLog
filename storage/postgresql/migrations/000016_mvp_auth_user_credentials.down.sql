-- MVP 注册凭据表回滚
-- change_level: normal

BEGIN;

DROP INDEX IF EXISTS idx_user_credentials_tenant_user;
DROP TABLE IF EXISTS user_credentials;

COMMIT;
