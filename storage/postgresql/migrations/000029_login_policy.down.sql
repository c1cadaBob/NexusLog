-- 回滚 000029：删除租户登录策略配置表
-- change_level: normal

BEGIN;

DROP TABLE IF EXISTS login_policy_settings;

COMMIT;
