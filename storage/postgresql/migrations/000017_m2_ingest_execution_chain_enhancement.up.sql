-- M2 接入主链路增强：落库、幂等、游标、密钥轮换、链路追踪
-- change_level: normal

BEGIN;

-- pull source 增强字段：远端 agent 基地址、拉取间隔、超时与密钥引用
ALTER TABLE ingest_pull_sources
    ADD COLUMN IF NOT EXISTS agent_base_url TEXT;

ALTER TABLE ingest_pull_sources
    ADD COLUMN IF NOT EXISTS pull_interval_sec INTEGER NOT NULL DEFAULT 30 CHECK (pull_interval_sec > 0);

ALTER TABLE ingest_pull_sources
    ADD COLUMN IF NOT EXISTS pull_timeout_sec INTEGER NOT NULL DEFAULT 30 CHECK (pull_timeout_sec > 0);

ALTER TABLE ingest_pull_sources
    ADD COLUMN IF NOT EXISTS key_ref VARCHAR(255);

-- pull task 增强字段：触发来源、执行参数、链路追踪与重试信息
ALTER TABLE ingest_pull_tasks
    ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(32) NOT NULL DEFAULT 'manual';

ALTER TABLE ingest_pull_tasks
    ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE ingest_pull_tasks
    ADD COLUMN IF NOT EXISTS request_id VARCHAR(128);

ALTER TABLE ingest_pull_tasks
    ADD COLUMN IF NOT EXISTS batch_id VARCHAR(128);

ALTER TABLE ingest_pull_tasks
    ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0);

ALTER TABLE ingest_pull_tasks
    ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

ALTER TABLE ingest_pull_tasks
    ADD COLUMN IF NOT EXISTS last_cursor TEXT;

ALTER TABLE ingest_pull_tasks
    ADD COLUMN IF NOT EXISTS trace JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_ingest_pull_tasks_status_next_retry
    ON ingest_pull_tasks (status, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_ingest_pull_tasks_request_id
    ON ingest_pull_tasks (request_id);

-- 包结构增强字段：task_id、batch_id、next_cursor、record_count、请求追踪
ALTER TABLE agent_incremental_packages
    ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES ingest_pull_tasks(id) ON DELETE SET NULL;

ALTER TABLE agent_incremental_packages
    ADD COLUMN IF NOT EXISTS batch_id VARCHAR(128);

ALTER TABLE agent_incremental_packages
    ADD COLUMN IF NOT EXISTS next_cursor TEXT;

ALTER TABLE agent_incremental_packages
    ADD COLUMN IF NOT EXISTS record_count INTEGER NOT NULL DEFAULT 0 CHECK (record_count >= 0);

ALTER TABLE agent_incremental_packages
    ADD COLUMN IF NOT EXISTS nack_reason TEXT;

ALTER TABLE agent_incremental_packages
    ADD COLUMN IF NOT EXISTS request_id VARCHAR(128);

ALTER TABLE agent_incremental_packages
    DROP CONSTRAINT IF EXISTS agent_incremental_packages_status_check;

ALTER TABLE agent_incremental_packages
    ADD CONSTRAINT agent_incremental_packages_status_check
        CHECK (status IN ('created', 'uploading', 'uploaded', 'acked', 'nacked', 'failed', 'dead_lettered'));

CREATE INDEX IF NOT EXISTS idx_agent_incremental_packages_task_created
    ON agent_incremental_packages (task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_incremental_packages_batch
    ON agent_incremental_packages (batch_id);

-- 文件级包摘要增强字段（与 12 文档 files[] 字段对齐）
ALTER TABLE agent_package_files
    ADD COLUMN IF NOT EXISTS size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0);

ALTER TABLE agent_package_files
    ADD COLUMN IF NOT EXISTS first_record_id VARCHAR(128);

ALTER TABLE agent_package_files
    ADD COLUMN IF NOT EXISTS last_record_id VARCHAR(128);

ALTER TABLE agent_package_files
    ADD COLUMN IF NOT EXISTS first_sequence BIGINT;

ALTER TABLE agent_package_files
    ADD COLUMN IF NOT EXISTS last_sequence BIGINT;

-- 死信增强字段：重放链路追踪与来源关联
ALTER TABLE ingest_dead_letters
    ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES ingest_pull_sources(id) ON DELETE SET NULL;

ALTER TABLE ingest_dead_letters
    ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES ingest_pull_tasks(id) ON DELETE SET NULL;

ALTER TABLE ingest_dead_letters
    ADD COLUMN IF NOT EXISTS batch_id VARCHAR(128);

ALTER TABLE ingest_dead_letters
    ADD COLUMN IF NOT EXISTS request_id VARCHAR(128);

ALTER TABLE ingest_dead_letters
    ADD COLUMN IF NOT EXISTS replay_batch_id VARCHAR(128);

ALTER TABLE ingest_dead_letters
    ADD COLUMN IF NOT EXISTS replay_reason TEXT;

ALTER TABLE ingest_dead_letters
    ADD COLUMN IF NOT EXISTS replayed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ingest_dead_letters_batch_failed
    ON ingest_dead_letters (batch_id, failed_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingest_dead_letters_replay_batch
    ON ingest_dead_letters (replay_batch_id);

-- Agent 拉取鉴权密钥表（支持 active/next 轮换）
CREATE TABLE IF NOT EXISTS agent_pull_auth_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES obs.tenant(id) ON DELETE SET NULL,
    key_ref VARCHAR(255) NOT NULL UNIQUE,
    agent_id VARCHAR(128),
    active_key_id VARCHAR(128) NOT NULL,
    active_key_ciphertext TEXT NOT NULL,
    next_key_id VARCHAR(128),
    next_key_ciphertext TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'rotating', 'revoked', 'disabled')),
    rotated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_pull_auth_keys_status_updated
    ON agent_pull_auth_keys (status, updated_at DESC);

-- Agent 拉取批次流水（幂等核心）
CREATE TABLE IF NOT EXISTS agent_pull_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES obs.tenant(id) ON DELETE SET NULL,
    source_id UUID REFERENCES ingest_pull_sources(id) ON DELETE SET NULL,
    task_id UUID REFERENCES ingest_pull_tasks(id) ON DELETE SET NULL,
    package_id UUID REFERENCES agent_incremental_packages(id) ON DELETE SET NULL,
    agent_id VARCHAR(128) NOT NULL,
    batch_id VARCHAR(128) NOT NULL,
    checksum VARCHAR(128) NOT NULL,
    cursor TEXT,
    next_cursor TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'created'
        CHECK (status IN ('created', 'processed', 'acked', 'nacked', 'failed', 'dead_lettered')),
    record_count INTEGER NOT NULL DEFAULT 0 CHECK (record_count >= 0),
    size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    request_id VARCHAR(128),
    error_code VARCHAR(64),
    error_message TEXT,
    acked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (batch_id, checksum)
);

CREATE INDEX IF NOT EXISTS idx_agent_pull_batches_task_created
    ON agent_pull_batches (task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_pull_batches_status_updated
    ON agent_pull_batches (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_pull_batches_request_id
    ON agent_pull_batches (request_id);

-- Agent 拉取游标表（按 source/path 持久化）
CREATE TABLE IF NOT EXISTS agent_pull_cursors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES ingest_pull_sources(id) ON DELETE CASCADE,
    task_id UUID REFERENCES ingest_pull_tasks(id) ON DELETE SET NULL,
    agent_id VARCHAR(128) NOT NULL,
    source_ref VARCHAR(512) NOT NULL,
    source_path TEXT NOT NULL,
    last_cursor TEXT,
    last_offset BIGINT NOT NULL DEFAULT 0 CHECK (last_offset >= 0),
    last_batch_id VARCHAR(128),
    request_id VARCHAR(128),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (source_id, source_path)
);

CREATE INDEX IF NOT EXISTS idx_agent_pull_cursors_agent_updated
    ON agent_pull_cursors (agent_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_pull_cursors_request_id
    ON agent_pull_cursors (request_id);

COMMIT;
