-- 000022: export_jobs 表
-- change_level: normal

BEGIN;

CREATE TABLE IF NOT EXISTS export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES obs.tenant(id),
    query_params JSONB NOT NULL,
    format VARCHAR(10) NOT NULL DEFAULT 'csv',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_records INT,
    file_path VARCHAR(500),
    file_size_bytes BIGINT,
    error_message TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_tenant ON export_jobs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_expires ON export_jobs(expires_at) WHERE expires_at IS NOT NULL;

COMMIT;
