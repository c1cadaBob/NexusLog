-- MVP 认证会话与安全增强
-- change_level: normal

BEGIN;

-- 用户会话表：支持 refresh token、踢下线、会话追踪
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES obs.tenant(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    access_token_jti VARCHAR(128),
    session_status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (session_status IN ('active', 'revoked', 'expired')),
    client_ip INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (refresh_token_hash)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_tenant_status
    ON user_sessions (tenant_id, session_status, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_created
    ON user_sessions (user_id, created_at DESC);

-- 密码重置令牌表
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES obs.tenant(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    requested_ip INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_expires
    ON password_reset_tokens (user_id, expires_at DESC);

-- 登录尝试表：支持登录风控与锁定策略
CREATE TABLE IF NOT EXISTS login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES obs.tenant(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(128) NOT NULL,
    email VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    result VARCHAR(20) NOT NULL
        CHECK (result IN ('success', 'failed', 'locked')),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_tenant_user_created
    ON login_attempts (tenant_id, username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_created
    ON login_attempts (ip_address, created_at DESC);

COMMIT;
