-- 回滚 000022：移除 export_jobs 表
BEGIN;
DROP TABLE IF EXISTS export_jobs;
COMMIT;
