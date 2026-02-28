-- 回滚：运行时配置中心与分发日志

BEGIN;

DROP TABLE IF EXISTS runtime_config_dispatch_log;
DROP TABLE IF EXISTS runtime_config_subscription;
DROP TABLE IF EXISTS config_publish;
DROP TABLE IF EXISTS config_version;
DROP TABLE IF EXISTS config_item;
DROP TABLE IF EXISTS config_namespace;

COMMIT;
