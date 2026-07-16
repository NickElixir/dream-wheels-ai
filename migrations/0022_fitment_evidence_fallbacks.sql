-- Exact-provider evidence is immutable and separate from the user input snapshot.
-- Legacy checks intentionally retain NULL evaluation_snapshot.

ALTER TABLE fitment_checks
    ADD COLUMN IF NOT EXISTS evaluation_snapshot JSONB,
    ADD COLUMN IF NOT EXISTS resolution_status TEXT NOT NULL DEFAULT 'legacy',
    ADD COLUMN IF NOT EXISTS provider_mapping_revision INTEGER,
    ADD COLUMN IF NOT EXISTS disclaimer_version TEXT NOT NULL DEFAULT 'stock_vehicle_only_v1';

ALTER TABLE vehicle_identities
    ADD COLUMN IF NOT EXISTS provider_mapping_revision INTEGER NOT NULL DEFAULT 0;

ALTER TABLE fitment_checks
    DROP CONSTRAINT IF EXISTS fitment_checks_resolution_status_check;

ALTER TABLE fitment_checks
    ADD CONSTRAINT fitment_checks_resolution_status_check CHECK (
        resolution_status IN ('legacy', 'unresolved', 'variant_required', 'resolved', 'market_confirmation_required', 'provider_failed')
    );

CREATE INDEX IF NOT EXISTS idx_fitment_checks_resolution_status
    ON fitment_checks(owner_user_id, resolution_status, created_at DESC);
