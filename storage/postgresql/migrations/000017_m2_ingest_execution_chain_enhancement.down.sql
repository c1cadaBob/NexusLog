-- 回滚 000017：移除 M2 接入主链路增强字段与表
-- change_level: normal

BEGIN;

DROP TABLE IF EXISTS agent_pull_cursors;
DROP TABLE IF EXISTS agent_pull_batches;
DROP TABLE IF EXISTS agent_pull_auth_keys;

DROP INDEX IF EXISTS idx_ingest_dead_letters_replay_batch;
DROP INDEX IF EXISTS idx_ingest_dead_letters_batch_failed;

ALTER TABLE ingest_dead_letters
    DROP COLUMN IF EXISTS replayed_at,
    DROP COLUMN IF EXISTS replay_reason,
    DROP COLUMN IF EXISTS replay_batch_id,
    DROP COLUMN IF EXISTS request_id,
    DROP COLUMN IF EXISTS batch_id,
    DROP COLUMN IF EXISTS task_id,
    DROP COLUMN IF EXISTS source_id;

ALTER TABLE agent_package_files
    DROP COLUMN IF EXISTS last_sequence,
    DROP COLUMN IF EXISTS first_sequence,
    DROP COLUMN IF EXISTS last_record_id,
    DROP COLUMN IF EXISTS first_record_id,
    DROP COLUMN IF EXISTS size_bytes;

DROP INDEX IF EXISTS idx_agent_incremental_packages_batch;
DROP INDEX IF EXISTS idx_agent_incremental_packages_task_created;

ALTER TABLE agent_incremental_packages
    DROP COLUMN IF EXISTS request_id,
    DROP COLUMN IF EXISTS nack_reason,
    DROP COLUMN IF EXISTS record_count,
    DROP COLUMN IF EXISTS next_cursor,
    DROP COLUMN IF EXISTS batch_id,
    DROP COLUMN IF EXISTS task_id;

UPDATE agent_incremental_packages
SET status = 'failed'
WHERE status = 'nacked';

ALTER TABLE agent_incremental_packages
    DROP CONSTRAINT IF EXISTS agent_incremental_packages_status_check;

ALTER TABLE agent_incremental_packages
    ADD CONSTRAINT agent_incremental_packages_status_check
        CHECK (status IN ('created', 'uploading', 'uploaded', 'acked', 'failed', 'dead_lettered'));

DROP INDEX IF EXISTS idx_ingest_pull_tasks_request_id;
DROP INDEX IF EXISTS idx_ingest_pull_tasks_status_next_retry;

ALTER TABLE ingest_pull_tasks
    DROP COLUMN IF EXISTS trace,
    DROP COLUMN IF EXISTS last_cursor,
    DROP COLUMN IF EXISTS next_retry_at,
    DROP COLUMN IF EXISTS retry_count,
    DROP COLUMN IF EXISTS batch_id,
    DROP COLUMN IF EXISTS request_id,
    DROP COLUMN IF EXISTS options,
    DROP COLUMN IF EXISTS trigger_type;

ALTER TABLE ingest_pull_sources
    DROP COLUMN IF EXISTS key_ref,
    DROP COLUMN IF EXISTS pull_timeout_sec,
    DROP COLUMN IF EXISTS pull_interval_sec,
    DROP COLUMN IF EXISTS agent_base_url;

COMMIT;
