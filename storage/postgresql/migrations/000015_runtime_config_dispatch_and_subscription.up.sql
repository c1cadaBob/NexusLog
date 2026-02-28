-- 运行时配置中心与动态分发日志
-- change_level: normal

BEGIN;

-- 配置命名空间（租户级）
CREATE TABLE IF NOT EXISTS config_namespace (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES obs.tenant(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_config_namespace_tenant_status
    ON config_namespace (tenant_id, status, updated_at DESC);

-- 配置项
CREATE TABLE IF NOT EXISTS config_item (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    namespace_id UUID NOT NULL REFERENCES config_namespace(id) ON DELETE CASCADE,
    item_key VARCHAR(255) NOT NULL,
    item_value TEXT,
    is_sensitive BOOLEAN NOT NULL DEFAULT false,
    value_ref VARCHAR(512),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (namespace_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_config_item_namespace
    ON config_item (namespace_id, updated_at DESC);

-- 配置版本（快照）
CREATE TABLE IF NOT EXISTS config_version (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    namespace_id UUID NOT NULL REFERENCES config_namespace(id) ON DELETE CASCADE,
    version_no INTEGER NOT NULL CHECK (version_no > 0),
    snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    change_level VARCHAR(16) NOT NULL DEFAULT 'none'
        CHECK (change_level IN ('none', 'normal', 'cab')),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (namespace_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_config_version_namespace
    ON config_version (namespace_id, version_no DESC);

-- 发布记录
CREATE TABLE IF NOT EXISTS config_publish (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    namespace_id UUID NOT NULL REFERENCES config_namespace(id) ON DELETE CASCADE,
    config_version_id UUID NOT NULL REFERENCES config_version(id) ON DELETE RESTRICT,
    status VARCHAR(16) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'success', 'failed', 'rollback')),
    published_by UUID REFERENCES users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_publish_namespace_created
    ON config_publish (namespace_id, created_at DESC);

-- 运行时订阅：记录服务实例当前配置状态
CREATE TABLE IF NOT EXISTS runtime_config_subscription (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    namespace_id UUID NOT NULL REFERENCES config_namespace(id) ON DELETE CASCADE,
    service_name VARCHAR(128) NOT NULL,
    instance_id VARCHAR(128) NOT NULL,
    current_version_id UUID REFERENCES config_version(id) ON DELETE SET NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'online'
        CHECK (status IN ('online', 'offline', 'degraded')),
    last_pull_at TIMESTAMPTZ,
    last_ack_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (namespace_id, service_name, instance_id)
);

CREATE INDEX IF NOT EXISTS idx_runtime_config_subscription_service_status
    ON runtime_config_subscription (service_name, status, updated_at DESC);

-- 分发日志：发布/回滚/重试过程可追溯
CREATE TABLE IF NOT EXISTS runtime_config_dispatch_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    namespace_id UUID NOT NULL REFERENCES config_namespace(id) ON DELETE CASCADE,
    config_version_id UUID REFERENCES config_version(id) ON DELETE RESTRICT,
    service_name VARCHAR(128) NOT NULL,
    instance_id VARCHAR(128),
    action VARCHAR(16) NOT NULL CHECK (action IN ('publish', 'rollback', 'retry')),
    status VARCHAR(16) NOT NULL CHECK (status IN ('pending', 'success', 'failed')),
    error_message TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (acked_at IS NULL OR acked_at >= dispatched_at)
);

CREATE INDEX IF NOT EXISTS idx_runtime_config_dispatch_log_namespace_time
    ON runtime_config_dispatch_log (namespace_id, dispatched_at DESC);
CREATE INDEX IF NOT EXISTS idx_runtime_config_dispatch_log_service_status
    ON runtime_config_dispatch_log (service_name, status, dispatched_at DESC);

COMMIT;
