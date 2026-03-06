-- 回滚 000019：移除 alert_events、notification_channels 和补充索引
-- change_level: normal

BEGIN;

-- 删除补充索引
DROP INDEX IF EXISTS idx_audit_logs_resource;
DROP INDEX IF EXISTS idx_audit_logs_action;
DROP INDEX IF EXISTS idx_audit_logs_user_time;

-- 删除通知渠道表
DROP TABLE IF EXISTS notification_channels;

-- 删除告警事件表
DROP TABLE IF EXISTS alert_events;

COMMIT;
