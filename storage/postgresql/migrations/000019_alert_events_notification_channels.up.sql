-- 000019: alert_events + notification_channels + audit_logs 补充索引
-- change_level: normal

BEGIN;

-- ===== 告警事件表 =====
CREATE TABLE IF NOT EXISTS alert_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES obs.tenant(id),
    rule_id UUID NOT NULL REFERENCES alert_rules(id),
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(500) NOT NULL,
    detail TEXT,
    source_id VARCHAR(200),
    agent_id VARCHAR(200),
    status VARCHAR(20) NOT NULL DEFAULT 'firing',
    fired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    notified_at TIMESTAMPTZ,
    notification_result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_events_tenant_status ON alert_events(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_alert_events_rule_id ON alert_events(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_events_fired_at ON alert_events(tenant_id, fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_events_severity ON alert_events(tenant_id, severity);

-- ===== 通知渠道表 =====
CREATE TABLE IF NOT EXISTS notification_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES obs.tenant(id),
    name VARCHAR(200) NOT NULL,
    type VARCHAR(30) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_notification_channels_tenant ON notification_channels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notification_channels_type ON notification_channels(tenant_id, type);

-- ===== audit_logs 补充索引 =====
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(tenant_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(tenant_id, resource_type, resource_id);

COMMIT;
