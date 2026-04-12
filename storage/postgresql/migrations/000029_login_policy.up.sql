-- 000029: 新增租户登录策略配置表
-- change_level: normal

BEGIN;

CREATE TABLE IF NOT EXISTS login_policy_settings (
    tenant_id UUID PRIMARY KEY REFERENCES obs.tenant(id) ON DELETE CASCADE,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_policy_settings_updated_at
    ON login_policy_settings (updated_at DESC);

COMMIT;
