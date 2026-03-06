-- 回滚 000020：移除 incidents + metrics 相关表
-- change_level: normal

BEGIN;

DROP TABLE IF EXISTS resource_thresholds;
DROP TABLE IF EXISTS server_metrics;
DROP TABLE IF EXISTS incident_timeline;
DROP TABLE IF EXISTS incidents;

COMMIT;
