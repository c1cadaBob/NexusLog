-- Rollback 000023: alert_silences

BEGIN;

DROP TABLE IF EXISTS alert_silences;

COMMIT;
