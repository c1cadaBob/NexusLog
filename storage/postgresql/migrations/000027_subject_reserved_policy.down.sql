-- 000027 rollback: 删除保留主体治理事实源表
-- change_level: normal

BEGIN;

DROP TABLE IF EXISTS subject_reserved_policy;

COMMIT;
