-- 000020: incidents + incident_timeline + server_metrics + resource_thresholds
-- change_level: normal

BEGIN;

-- ===== 事件表 =====
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES obs.tenant(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    source_alert_id UUID REFERENCES alert_events(id),
    assigned_to UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    root_cause TEXT,
    resolution TEXT,
    verdict TEXT,
    sla_response_minutes INT,
    sla_resolve_minutes INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_tenant_status ON incidents(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(tenant_id, severity);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned_to ON incidents(assigned_to);

-- ===== 事件时间线 =====
CREATE TABLE IF NOT EXISTS incident_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    actor_id UUID REFERENCES users(id),
    detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_timeline_incident ON incident_timeline(incident_id, created_at);

-- ===== 服务器资源指标 =====
CREATE TABLE IF NOT EXISTS server_metrics (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES obs.tenant(id),
    agent_id VARCHAR(200) NOT NULL,
    server_id VARCHAR(200) NOT NULL,
    cpu_usage_pct DECIMAL(5,2),
    memory_usage_pct DECIMAL(5,2),
    disk_usage_pct DECIMAL(5,2),
    disk_io_read_bytes BIGINT,
    disk_io_write_bytes BIGINT,
    net_in_bytes BIGINT,
    net_out_bytes BIGINT,
    collected_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_server_metrics_agent_time ON server_metrics(agent_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_server_metrics_tenant ON server_metrics(tenant_id, collected_at DESC);

-- ===== 资源阈值配置 =====
CREATE TABLE IF NOT EXISTS resource_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES obs.tenant(id),
    agent_id VARCHAR(200),
    metric_name VARCHAR(50) NOT NULL,
    threshold_value DECIMAL(5,2) NOT NULL,
    comparison VARCHAR(10) NOT NULL DEFAULT '>',
    alert_severity VARCHAR(20) NOT NULL DEFAULT 'warning',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resource_thresholds_tenant ON resource_thresholds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_resource_thresholds_agent ON resource_thresholds(agent_id);

COMMIT;
