-- Rollback 000021
-- change_level: normal

BEGIN;

DROP INDEX IF EXISTS idx_alert_events_resource_threshold;
-- Delete resource threshold alerts before making rule_id NOT NULL
DELETE FROM alert_events WHERE resource_threshold_id IS NOT NULL;
ALTER TABLE alert_events DROP COLUMN IF EXISTS resource_threshold_id;
ALTER TABLE alert_events ALTER COLUMN rule_id SET NOT NULL;
ALTER TABLE resource_thresholds DROP COLUMN IF EXISTS notification_channels;

COMMIT;
