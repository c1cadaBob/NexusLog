-- 回滚：MVP 采集链路（拉取 + 增量打包）

BEGIN;

DROP TABLE IF EXISTS ingest_dead_letters;
DROP TABLE IF EXISTS ingest_file_checkpoints;
DROP TABLE IF EXISTS ingest_delivery_receipts;
DROP TABLE IF EXISTS agent_package_files;
DROP TABLE IF EXISTS agent_incremental_packages;
DROP TABLE IF EXISTS ingest_pull_tasks;
DROP TABLE IF EXISTS ingest_pull_sources;

COMMIT;
