-- Durable, provider-neutral detailed fitment checks.
-- Snapshots preserve the exact inputs and rule/provider versions evaluated.

CREATE TABLE IF NOT EXISTS fitment_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_identity_id UUID NOT NULL REFERENCES vehicle_identities(id) ON DELETE RESTRICT,
    rim_setup_id UUID NOT NULL REFERENCES rim_setups(id) ON DELETE RESTRICT,
    render_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    idempotency_key TEXT NOT NULL,
    input_hash TEXT NOT NULL,
    execution_status TEXT NOT NULL DEFAULT 'queued',
    verdict TEXT,
    is_preliminary BOOLEAN NOT NULL DEFAULT true,
    input_snapshot JSONB NOT NULL,
    result JSONB,
    error JSONB,
    provider_version TEXT,
    engine_version TEXT,
    rules_version TEXT,
    evaluated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fitment_checks_execution_status_check CHECK (
        execution_status IN ('queued', 'processing', 'completed', 'failed')
    ),
    CONSTRAINT fitment_checks_verdict_check CHECK (
        verdict IS NULL OR verdict IN ('compatible', 'compatible_with_conditions', 'unknown', 'incompatible')
    ),
    CONSTRAINT fitment_checks_idempotency_owner_unique UNIQUE (owner_user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_fitment_checks_identity_setup_created
    ON fitment_checks(vehicle_identity_id, rim_setup_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fitment_checks_owner_created
    ON fitment_checks(owner_user_id, created_at DESC);
