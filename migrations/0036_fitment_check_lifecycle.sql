-- Slice 5: observable execution lifecycle and bounded recovery metadata.

ALTER TABLE fitment_checks
    ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS retry_at TIMESTAMPTZ;

ALTER TABLE fitment_checks
    DROP CONSTRAINT IF EXISTS fitment_checks_attempt_count_check,
    ADD CONSTRAINT fitment_checks_attempt_count_check CHECK (attempt_count >= 0);

CREATE INDEX IF NOT EXISTS idx_fitment_checks_active_context
    ON fitment_checks(owner_user_id, vehicle_identity_id, rim_setup_id, execution_status)
    WHERE execution_status IN ('queued', 'processing');
