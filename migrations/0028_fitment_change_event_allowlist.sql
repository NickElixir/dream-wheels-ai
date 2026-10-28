-- Slice 7: allow the revision-bound modification lifecycle events emitted by
-- the live vehicle-variant lookup flow.
--
-- 0026 widened this constraint for the first modification events. Keep this
-- migration idempotent so staging databases that already have the wider
-- constraint can be safely re-run.

ALTER TABLE fitment_change_events
    DROP CONSTRAINT IF EXISTS fitment_change_events_event_type_check,
    ADD CONSTRAINT fitment_change_events_event_type_check CHECK (
        event_type IN (
            'initial_prefill', 'user_save', 'user_confirm', 'candidate_applied',
            'modification_auto_confirmed', 'modification_suggested',
            'modification_invalidated', 'modification_user_confirmed'
        )
    );
