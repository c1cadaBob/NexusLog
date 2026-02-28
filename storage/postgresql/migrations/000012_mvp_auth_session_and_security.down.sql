-- 回滚：MVP 认证会话与安全增强

BEGIN;

DROP TABLE IF EXISTS login_attempts;
DROP TABLE IF EXISTS password_reset_tokens;
DROP TABLE IF EXISTS user_sessions;

COMMIT;
