-- 回滚：刷新令牌轮换链追踪与重放防护

BEGIN;

DROP INDEX IF EXISTS idx_user_sessions_tenant_family_status;

ALTER TABLE user_sessions
    DROP CONSTRAINT IF EXISTS fk_user_sessions_replaced_by_session;

ALTER TABLE user_sessions
    DROP COLUMN IF EXISTS replaced_by_session_id,
    DROP COLUMN IF EXISTS session_family_id;

COMMIT;
