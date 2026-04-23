-- 000030: 优化采集源删除时的外键检查性能
-- change_level: normal

BEGIN;

CREATE INDEX IF NOT EXISTS idx_agent_incremental_packages_source_created
    ON agent_incremental_packages (source_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingest_dead_letters_source_failed
    ON ingest_dead_letters (source_id, failed_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_pull_batches_source_created
    ON agent_pull_batches (source_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingest_dead_letters_task_failed
    ON ingest_dead_letters (task_id, failed_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_pull_cursors_task_updated
    ON agent_pull_cursors (task_id, updated_at DESC);

COMMIT;
