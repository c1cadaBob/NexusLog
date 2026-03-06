-- 000023: alert_silences 表
-- change_level: normal

BEGIN;

CREATE TABLE IF NOT EXISTS alert_silences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES obs.tenant(id),
    matchers JSONB NOT NULL DEFAULT '{}',
    reason TEXT,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_silences_tenant ON alert_silences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_silences_active ON alert_silences(tenant_id, starts_at, ends_at);

COMMIT;
