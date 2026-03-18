-- 000028 rollback: 移除授权注册表基础表
-- change_level: normal

BEGIN;

DROP TABLE IF EXISTS authz_version;
DROP TABLE IF EXISTS legacy_permission_mapping;
DROP TABLE IF EXISTS capability_definition;

COMMIT;
