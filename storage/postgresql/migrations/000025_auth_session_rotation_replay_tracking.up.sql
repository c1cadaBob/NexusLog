-- 刷新令牌轮换链追踪与重放防护
-- change_level: normal

BEGIN;

ALTER TABLE user_sessions
    ADD COLUMN IF NOT EXISTS session_family_id UUID,
    ADD COLUMN IF NOT EXISTS replaced_by_session_id UUID;

UPDATE user_sessions
SET session_family_id = id
WHERE session_family_id IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_user_sessions_replaced_by_session'
    ) THEN
        ALTER TABLE user_sessions
            ADD CONSTRAINT fk_user_sessions_replaced_by_session
            FOREIGN KEY (replaced_by_session_id) REFERENCES user_sessions(id) ON DELETE SET NULL;
    END IF;
END $$;

ALTER TABLE user_sessions
    ALTER COLUMN session_family_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_sessions_tenant_family_status
    ON user_sessions (tenant_id, session_family_id, session_status);

COMMIT;
