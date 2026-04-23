-- 回滚 000030：移除采集源删除优化索引
-- change_level: normal

BEGIN;

DROP INDEX IF EXISTS idx_agent_pull_cursors_task_updated;
DROP INDEX IF EXISTS idx_ingest_dead_letters_task_failed;
DROP INDEX IF EXISTS idx_agent_pull_batches_source_created;
DROP INDEX IF EXISTS idx_ingest_dead_letters_source_failed;
DROP INDEX IF EXISTS idx_agent_incremental_packages_source_created;

COMMIT;
