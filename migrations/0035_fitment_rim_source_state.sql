-- Slice 4: durable source identity and setup revision for Standard Fitment.
-- Existing rows intentionally remain readable: absent source identity is
-- legacy/unknown evidence, never an inferred confirmed parser source.

ALTER TABLE rim_specs
    ADD COLUMN IF NOT EXISTS source_fingerprint TEXT,
    ADD COLUMN IF NOT EXISTS selected_variant_sku TEXT,
    ADD COLUMN IF NOT EXISTS source_revision INTEGER NOT NULL DEFAULT 1;

ALTER TABLE rim_specs
    DROP CONSTRAINT IF EXISTS rim_specs_source_revision_check,
    ADD CONSTRAINT rim_specs_source_revision_check CHECK (source_revision > 0);

ALTER TABLE rim_setups
    ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;

ALTER TABLE rim_setups
    DROP CONSTRAINT IF EXISTS rim_setups_revision_check,
    ADD CONSTRAINT rim_setups_revision_check CHECK (revision > 0);

CREATE INDEX IF NOT EXISTS idx_rim_specs_owner_source_fingerprint
    ON rim_specs(owner_user_id, source_fingerprint)
    WHERE source_fingerprint IS NOT NULL;

-- Slice 3 introduced explicit modification audit events in the application;
-- widen the original Sprint 4 allow-list without rewriting historical rows.
ALTER TABLE fitment_change_events
    DROP CONSTRAINT IF EXISTS fitment_change_events_event_type_check,
    ADD CONSTRAINT fitment_change_events_event_type_check CHECK (
        event_type IN (
            'initial_prefill', 'user_save', 'user_confirm', 'candidate_applied',
            'modification_auto_confirmed', 'modification_suggested',
            'modification_invalidated', 'modification_user_confirmed'
        )
    );
