-- 000027: 将保留主体治理从用户名硬编码迁移到事实源表
-- change_level: normal

BEGIN;

CREATE TABLE IF NOT EXISTS subject_reserved_policy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES obs.tenant(id) ON DELETE CASCADE,
    subject_type VARCHAR(32) NOT NULL,
    subject_ref VARCHAR(255) NOT NULL,
    reserved BOOLEAN NOT NULL DEFAULT true,
    interactive_login_allowed BOOLEAN NOT NULL DEFAULT true,
    system_subject BOOLEAN NOT NULL DEFAULT false,
    break_glass_allowed BOOLEAN NOT NULL DEFAULT false,
    managed_by VARCHAR(64) NOT NULL DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_subject_reserved_policy_type CHECK (subject_type IN ('username')),
    CONSTRAINT uq_subject_reserved_policy UNIQUE (tenant_id, subject_type, subject_ref)
);

CREATE INDEX IF NOT EXISTS idx_subject_reserved_policy_lookup
    ON subject_reserved_policy (tenant_id, subject_type, lower(subject_ref));

INSERT INTO subject_reserved_policy (
    tenant_id,
    subject_type,
    subject_ref,
    reserved,
    interactive_login_allowed,
    system_subject,
    break_glass_allowed,
    managed_by
)
SELECT
    u.tenant_id,
    'username',
    'sys-superadmin',
    true,
    true,
    false,
    true,
    'migration:000027'
FROM users u
WHERE u.username = 'sys-superadmin'
GROUP BY u.tenant_id
ON CONFLICT (tenant_id, subject_type, subject_ref) DO UPDATE
SET reserved = EXCLUDED.reserved,
    interactive_login_allowed = EXCLUDED.interactive_login_allowed,
    system_subject = EXCLUDED.system_subject,
    break_glass_allowed = EXCLUDED.break_glass_allowed,
    managed_by = EXCLUDED.managed_by,
    updated_at = NOW();

INSERT INTO subject_reserved_policy (
    tenant_id,
    subject_type,
    subject_ref,
    reserved,
    interactive_login_allowed,
    system_subject,
    break_glass_allowed,
    managed_by
)
SELECT
    u.tenant_id,
    'username',
    'system-automation',
    true,
    false,
    true,
    false,
    'migration:000027'
FROM users u
WHERE u.username = 'system-automation'
GROUP BY u.tenant_id
ON CONFLICT (tenant_id, subject_type, subject_ref) DO UPDATE
SET reserved = EXCLUDED.reserved,
    interactive_login_allowed = EXCLUDED.interactive_login_allowed,
    system_subject = EXCLUDED.system_subject,
    break_glass_allowed = EXCLUDED.break_glass_allowed,
    managed_by = EXCLUDED.managed_by,
    updated_at = NOW();

COMMIT;
