BEGIN;

UPDATE obs.incident
SET status = 'ACKED'
WHERE id = :incident_id;

INSERT INTO obs.incident_timeline(
  incident_id, event_type, event_time, actor_type, actor_id, detail
) VALUES (
  :incident_id, 'INCIDENT_ACKED', now(), 'USER', :user_id, jsonb_build_object('comment', :comment)
);

SELECT obs.outbox_enqueue(
  :tenant_id, :project_id, :env_id,
  'INCIDENT', :incident_id::text, 'INCIDENT_ACKED',
  concat('incident:', :incident_id::text, ':acked'),
  jsonb_build_object('incident_id', :incident_id, 'acked_by', :user_id, 'acked_at', now()),
  '{}'::jsonb
);

COMMIT;