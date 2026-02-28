-- MVP 检索：实时查询 + 历史 + 收藏
-- change_level: normal

BEGIN;

-- 查询历史
CREATE TABLE IF NOT EXISTS query_histories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES obs.tenant(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    query_text TEXT NOT NULL,
    query_hash CHAR(64),
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    time_range_start TIMESTAMPTZ,
    time_range_end TIMESTAMPTZ,
    result_count BIGINT,
    duration_ms INTEGER,
    status VARCHAR(20) NOT NULL DEFAULT 'success'
        CHECK (status IN ('success', 'failed', 'timeout', 'canceled')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (time_range_end IS NULL OR time_range_start IS NULL OR time_range_end >= time_range_start)
);

CREATE INDEX IF NOT EXISTS idx_query_histories_tenant_user_created
    ON query_histories (tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_histories_tenant_hash_created
    ON query_histories (tenant_id, query_hash, created_at DESC);

-- 收藏查询
CREATE TABLE IF NOT EXISTS saved_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES obs.tenant(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    query_text TEXT NOT NULL,
    filters JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_public BOOLEAN NOT NULL DEFAULT false,
    run_count BIGINT NOT NULL DEFAULT 0 CHECK (run_count >= 0),
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_saved_queries_tenant_public_created
    ON saved_queries (tenant_id, is_public, created_at DESC);

-- 收藏查询标签
CREATE TABLE IF NOT EXISTS saved_query_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    saved_query_id UUID NOT NULL REFERENCES saved_queries(id) ON DELETE CASCADE,
    tag VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (saved_query_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_saved_query_tags_tag
    ON saved_query_tags (tag, created_at DESC);

COMMIT;
