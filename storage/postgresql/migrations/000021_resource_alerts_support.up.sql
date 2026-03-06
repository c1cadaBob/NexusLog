-- 000021: Support resource threshold alerts (nullable rule_id, notification_channels on thresholds)
-- change_level: normal

BEGIN;

-- Allow alert_events.rule_id to be NULL for resource threshold alerts
ALTER TABLE alert_events ALTER COLUMN rule_id DROP NOT NULL;

-- Add resource_threshold_id for resource threshold alerts
ALTER TABLE alert_events ADD COLUMN IF NOT EXISTS resource_threshold_id UUID REFERENCES resource_thresholds(id);

-- Add notification_channels to resource_thresholds for alert delivery
ALTER TABLE resource_thresholds ADD COLUMN IF NOT EXISTS notification_channels JSONB DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_alert_events_resource_threshold ON alert_events(resource_threshold_id);

COMMIT;
