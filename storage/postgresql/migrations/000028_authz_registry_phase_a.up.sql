-- 000028: 引入授权注册表基础表，承接旧权限到 capability 的兼容映射
-- change_level: normal

BEGIN;

CREATE TABLE IF NOT EXISTS capability_definition (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(128) NOT NULL UNIQUE,
    domain VARCHAR(64) NOT NULL,
    description TEXT,
    risk_level VARCHAR(16) NOT NULL DEFAULT 'low'
        CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    is_reserved BOOLEAN NOT NULL DEFAULT FALSE,
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    requires_jit BOOLEAN NOT NULL DEFAULT FALSE,
    requires_sod BOOLEAN NOT NULL DEFAULT FALSE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS legacy_permission_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    legacy_permission VARCHAR(128) NOT NULL UNIQUE,
    capability_bundle JSONB NOT NULL DEFAULT '[]'::jsonb,
    scope_bundle JSONB NOT NULL DEFAULT '[]'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (jsonb_typeof(capability_bundle) = 'array'),
    CHECK (jsonb_typeof(scope_bundle) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_legacy_permission_mapping_enabled
    ON legacy_permission_mapping (enabled);

CREATE TABLE IF NOT EXISTS authz_version (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES obs.tenant(id) ON DELETE CASCADE,
    subject_type VARCHAR(32) NOT NULL
        CHECK (subject_type IN ('user', 'service_account', 'system_subject')),
    subject_id UUID NOT NULL,
    authz_epoch BIGINT NOT NULL DEFAULT 1,
    reason TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_authz_version_subject
    ON authz_version (subject_type, subject_id);

INSERT INTO legacy_permission_mapping (
    legacy_permission,
    capability_bundle,
    scope_bundle,
    enabled,
    metadata
)
VALUES
    (
        'users:read',
        '["iam.role.read", "iam.user.read"]'::jsonb,
        '["tenant"]'::jsonb,
        TRUE,
        '{"managed_by":"migration:000028"}'::jsonb
    ),
    (
        'users:write',
        '["iam.user.create", "iam.user.delete", "iam.user.grant_role", "iam.user.revoke_role", "iam.user.update_profile", "iam.user.update_status"]'::jsonb,
        '["tenant"]'::jsonb,
        TRUE,
        '{"managed_by":"migration:000028"}'::jsonb
    ),
    (
        'logs:read',
        '["log.query.aggregate", "log.query.read", "query.history.read", "query.saved.read"]'::jsonb,
        '["tenant", "owned"]'::jsonb,
        TRUE,
        '{"managed_by":"migration:000028"}'::jsonb
    ),
    (
        'logs:export',
        '["export.job.create", "export.job.download", "export.job.read"]'::jsonb,
        '["tenant", "owned"]'::jsonb,
        TRUE,
        '{"managed_by":"migration:000028"}'::jsonb
    ),
    (
        'alerts:read',
        '["alert.event.read", "alert.rule.read", "alert.silence.read", "notification.channel.read_metadata"]'::jsonb,
        '["tenant"]'::jsonb,
        TRUE,
        '{"managed_by":"migration:000028"}'::jsonb
    ),
    (
        'alerts:write',
        '["alert.rule.create", "alert.rule.delete", "alert.rule.disable", "alert.rule.enable", "alert.rule.update", "alert.silence.create", "alert.silence.delete", "alert.silence.update", "notification.channel.create", "notification.channel.delete", "notification.channel.test", "notification.channel.update"]'::jsonb,
        '["tenant"]'::jsonb,
        TRUE,
        '{"managed_by":"migration:000028"}'::jsonb
    ),
    (
        'incidents:read',
        '["incident.analysis.read", "incident.archive.read", "incident.read", "incident.sla.read", "incident.timeline.read"]'::jsonb,
        '["tenant", "resource"]'::jsonb,
        TRUE,
        '{"managed_by":"migration:000028"}'::jsonb
    ),
    (
        'incidents:write',
        '["incident.archive", "incident.assign", "incident.close", "incident.create", "incident.update"]'::jsonb,
        '["tenant", "resource"]'::jsonb,
        TRUE,
        '{"managed_by":"migration:000028"}'::jsonb
    ),
    (
        'metrics:read',
        '["metric.read", "ops.health.read", "storage.capacity.read"]'::jsonb,
        '["tenant"]'::jsonb,
        TRUE,
        '{"managed_by":"migration:000028"}'::jsonb
    ),
    (
        'dashboards:read',
        '["dashboard.read", "report.read"]'::jsonb,
        '["tenant"]'::jsonb,
        TRUE,
        '{"managed_by":"migration:000028"}'::jsonb
    ),
    (
        'audit:read',
        '["audit.log.read"]'::jsonb,
        '["tenant"]'::jsonb,
        TRUE,
        '{"managed_by":"migration:000028"}'::jsonb
    ),
    (
        'audit:write',
        '["audit.log.write_system"]'::jsonb,
        '["system"]'::jsonb,
        TRUE,
        '{"managed_by":"migration:000028"}'::jsonb
    )
ON CONFLICT (legacy_permission) DO UPDATE
SET capability_bundle = EXCLUDED.capability_bundle,
    scope_bundle = EXCLUDED.scope_bundle,
    enabled = EXCLUDED.enabled,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

COMMIT;
