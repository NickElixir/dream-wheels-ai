-- Schema required by the Slice 7 rim source and currentness lifecycle.
--
-- Existing rendered jobs already reference rim_setups/rim_specs, so defaults
-- keep their immutable render snapshots compatible with the new editor state.

ALTER TABLE rim_specs
    ADD COLUMN IF NOT EXISTS source_fingerprint TEXT,
    ADD COLUMN IF NOT EXISTS selected_variant_sku TEXT,
    ADD COLUMN IF NOT EXISTS source_revision INTEGER NOT NULL DEFAULT 1;

ALTER TABLE rim_setups
    ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;

UPDATE rim_specs
SET source_revision = 1
WHERE source_revision IS NULL OR source_revision < 1;

UPDATE rim_setups
SET revision = 1
WHERE revision IS NULL OR revision < 1;

ALTER TABLE rim_specs
    ALTER COLUMN source_revision SET DEFAULT 1,
    ALTER COLUMN source_revision SET NOT NULL;

ALTER TABLE rim_setups
    ALTER COLUMN revision SET DEFAULT 1,
    ALTER COLUMN revision SET NOT NULL;

ALTER TABLE rim_specs
    DROP CONSTRAINT IF EXISTS rim_specs_source_revision_check,
    ADD CONSTRAINT rim_specs_source_revision_check CHECK (source_revision > 0);

ALTER TABLE rim_setups
    DROP CONSTRAINT IF EXISTS rim_setups_revision_check,
    ADD CONSTRAINT rim_setups_revision_check CHECK (revision > 0);
