-- Sprint 4 fitment editor support.
--
-- Canonical VehicleIdentity/RimSpec columns remain the current values used by
-- future fitment checks. field_candidates keeps VLM/OCR/provider suggestions
-- next to those values so user edits can be explained without changing old
-- render snapshots.

ALTER TABLE vehicle_identities
    ADD COLUMN IF NOT EXISTS field_candidates JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;

ALTER TABLE rim_specs
    ADD COLUMN IF NOT EXISTS field_candidates JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;

ALTER TABLE vehicle_identities
    DROP CONSTRAINT IF EXISTS vehicle_identities_revision_check,
    ADD CONSTRAINT vehicle_identities_revision_check CHECK (revision > 0);

ALTER TABLE rim_specs
    DROP CONSTRAINT IF EXISTS rim_specs_revision_check,
    ADD CONSTRAINT rim_specs_revision_check CHECK (revision > 0);
