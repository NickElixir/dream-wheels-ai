-- Future explicit Technical Fitment Vehicle actions, including accepted no-ops.
-- Widen the existing allowlist; do not backfill or mutate historical events.
ALTER TABLE fitment_change_events
    DROP CONSTRAINT IF EXISTS fitment_change_events_event_type_check,
    ADD CONSTRAINT fitment_change_events_event_type_check CHECK (
        event_type IN (
            'initial_prefill', 'user_save', 'user_confirm', 'candidate_applied',
            'modification_auto_confirmed', 'modification_suggested',
            'modification_invalidated', 'modification_user_confirmed',
            'vehicle_confirmation_intent'
        )
    );
