-- Future provenance evidence. Run on local/test DB or read-only deployment audit.
-- Presence proves an accepted explicit Vehicle action at the recorded revision,
-- not current readiness or absence of other historical actions.
BEGIN READ ONLY;
SELECT j.id AS job_id, v.id AS vehicle_identity_id,
       v.revision AS current_vehicle_revision, e.id AS confirmation_event_id,
       e.created_at, e.actor_user_id,
       e.vehicle_revision_after AS confirmed_vehicle_revision,
       e.changes->>'action' AS action
FROM jobs j
JOIN vehicle_identities v ON v.id = j.vehicle_identity_id
JOIN fitment_change_events e ON e.job_id = j.id AND e.vehicle_identity_id = v.id
WHERE e.event_type = 'vehicle_confirmation_intent'
  AND e.actor_type = 'user'
  AND e.actor_user_id = j.user_id
  AND e.actor_user_id = v.owner_user_id
  AND e.changes->>'surface' = 'technical_fitment'
  AND e.changes->>'intent' = 'explicit_confirm'
  AND e.vehicle_revision_before = e.vehicle_revision_after
ORDER BY j.id, e.created_at, e.id;
ROLLBACK;
