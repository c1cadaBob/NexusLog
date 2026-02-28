-- MVP 采集：服务器主动拉取 + Agent 增量打包
-- change_level: normal

BEGIN;

-- 远端拉取源配置
CREATE TABLE IF NOT EXISTS ingest_pull_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES obs.tenant(id) ON DELETE CASCADE,
    project_id UUID,
    env_id UUID,
    name VARCHAR(255) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL CHECK (port > 0 AND port <= 65535),
    protocol VARCHAR(20) NOT NULL
        CHECK (protocol IN ('ssh', 'sftp', 'syslog_tcp', 'syslog_udp', 'http', 'https', 'tcp')),
    path_pattern TEXT,
    auth_ref VARCHAR(255),
    poll_interval_sec INTEGER NOT NULL DEFAULT 30 CHECK (poll_interval_sec > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'paused', 'disabled')),
    last_polled_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_ingest_pull_sources_tenant_status
    ON ingest_pull_sources (tenant_id, status, updated_at DESC);

-- 主动拉取任务流水
CREATE TABLE IF NOT EXISTS ingest_pull_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES ingest_pull_sources(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'success', 'failed', 'canceled')),
    error_code VARCHAR(64),
    error_message TEXT,
    bytes_pulled BIGINT NOT NULL DEFAULT 0 CHECK (bytes_pulled >= 0),
    files_pulled INTEGER NOT NULL DEFAULT 0 CHECK (files_pulled >= 0),
    package_count INTEGER NOT NULL DEFAULT 0 CHECK (package_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingest_pull_tasks_source_status_sched
    ON ingest_pull_tasks (source_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_ingest_pull_tasks_status_created
    ON ingest_pull_tasks (status, created_at DESC);

-- Agent 增量打包记录
CREATE TABLE IF NOT EXISTS agent_incremental_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID REFERENCES ingest_pull_sources(id) ON DELETE SET NULL,
    agent_id VARCHAR(128) NOT NULL,
    source_ref VARCHAR(512) NOT NULL,
    package_no VARCHAR(128) NOT NULL,
    from_offset BIGINT NOT NULL DEFAULT 0 CHECK (from_offset >= 0),
    to_offset BIGINT NOT NULL DEFAULT 0 CHECK (to_offset >= from_offset),
    file_count INTEGER NOT NULL DEFAULT 0 CHECK (file_count >= 0),
    size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
    checksum VARCHAR(128) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'created'
        CHECK (status IN ('created', 'uploading', 'uploaded', 'acked', 'failed', 'dead_lettered')),
    sent_at TIMESTAMPTZ,
    acked_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (agent_id, source_ref, package_no),
    UNIQUE (agent_id, source_ref, checksum)
);

CREATE INDEX IF NOT EXISTS idx_agent_incremental_packages_status_created
    ON agent_incremental_packages (status, created_at DESC);

-- 包内文件清单
CREATE TABLE IF NOT EXISTS agent_package_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    package_id UUID NOT NULL REFERENCES agent_incremental_packages(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_inode BIGINT,
    from_offset BIGINT NOT NULL DEFAULT 0 CHECK (from_offset >= 0),
    to_offset BIGINT NOT NULL DEFAULT 0 CHECK (to_offset >= from_offset),
    line_count INTEGER NOT NULL DEFAULT 0 CHECK (line_count >= 0),
    checksum VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (package_id, file_path, from_offset, to_offset)
);

CREATE INDEX IF NOT EXISTS idx_agent_package_files_package
    ON agent_package_files (package_id, created_at DESC);

-- 服务器接收回执
CREATE TABLE IF NOT EXISTS ingest_delivery_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    package_id UUID NOT NULL REFERENCES agent_incremental_packages(id) ON DELETE CASCADE,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    result VARCHAR(16) NOT NULL CHECK (result IN ('ack', 'nack')),
    error_code VARCHAR(64),
    error_message TEXT,
    consumer_offset BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingest_delivery_receipts_package_received
    ON ingest_delivery_receipts (package_id, received_at DESC);

-- 中心化文件断点（与 Agent 本地 checkpoint 双保险）
CREATE TABLE IF NOT EXISTS ingest_file_checkpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id VARCHAR(128) NOT NULL,
    source_ref VARCHAR(512) NOT NULL,
    file_path TEXT NOT NULL,
    file_inode BIGINT,
    checkpoint_offset BIGINT NOT NULL DEFAULT 0 CHECK (checkpoint_offset >= 0),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (agent_id, source_ref, file_path)
);

CREATE INDEX IF NOT EXISTS idx_ingest_file_checkpoints_updated
    ON ingest_file_checkpoints (updated_at DESC);

-- 采集死信
CREATE TABLE IF NOT EXISTS ingest_dead_letters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES obs.tenant(id) ON DELETE SET NULL,
    source_ref VARCHAR(512),
    package_id UUID REFERENCES agent_incremental_packages(id) ON DELETE SET NULL,
    payload JSONB NOT NULL,
    error_code VARCHAR(64),
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingest_dead_letters_tenant_failed
    ON ingest_dead_letters (tenant_id, failed_at DESC);

COMMIT;
