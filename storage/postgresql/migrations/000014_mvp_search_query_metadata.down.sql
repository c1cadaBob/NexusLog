-- 回滚：MVP 检索元数据

BEGIN;

DROP TABLE IF EXISTS saved_query_tags;
DROP TABLE IF EXISTS saved_queries;
DROP TABLE IF EXISTS query_histories;

COMMIT;
