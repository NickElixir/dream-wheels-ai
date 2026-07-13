-- Durable backend-only storage for preliminary and confirmed fitment checks.
-- RLS is intentionally enabled without anon/authenticated policies.

CREATE TABLE IF NOT EXISTS fitment_preliminary_runs (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_telegram_user_id      BIGINT NOT NULL,
    status                      TEXT NOT NULL,
    stage                       TEXT NOT NULL DEFAULT 'preliminary',
    car_image_sha256            TEXT,
    rim_image_sha256            TEXT,
    payload                     JSONB NOT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at                TIMESTAMPTZ,

    CONSTRAINT fitment_preliminary_runs_owner_key
        UNIQUE (id, owner_telegram_user_id),
    CONSTRAINT fitment_preliminary_runs_status_check
        CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    CONSTRAINT fitment_preliminary_runs_stage_check
        CHECK (stage = 'preliminary'),
    CONSTRAINT fitment_preliminary_runs_car_sha256_check
        CHECK (car_image_sha256 IS NULL OR car_image_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT fitment_preliminary_runs_rim_sha256_check
        CHECK (rim_image_sha256 IS NULL OR rim_image_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE TABLE IF NOT EXISTS fitment_vehicle_identities (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_telegram_user_id      BIGINT NOT NULL,
    payload                     JSONB NOT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fitment_vehicle_identities_owner_key
        UNIQUE (id, owner_telegram_user_id)
);

CREATE TABLE IF NOT EXISTS fitment_rim_setups (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_telegram_user_id      BIGINT NOT NULL,
    payload                     JSONB NOT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fitment_rim_setups_owner_key
        UNIQUE (id, owner_telegram_user_id)
);

CREATE TABLE IF NOT EXISTS fitment_checks (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_telegram_user_id      BIGINT NOT NULL,
    status                      TEXT NOT NULL,
    stage                       TEXT NOT NULL DEFAULT 'confirmed',
    vehicle_identity_id         UUID NOT NULL,
    rim_setup_id                UUID NOT NULL,
    preliminary_run_id          UUID,
    render_job_id               UUID REFERENCES jobs(id) ON DELETE SET NULL,
    vehicle_snapshot            JSONB,
    rim_setup_snapshot          JSONB,
    profile_snapshot            JSONB,
    verdict_snapshot            JSONB,
    risk_snapshot               JSONB,
    payload                     JSONB NOT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at                TIMESTAMPTZ,

    CONSTRAINT fitment_checks_owner_key
        UNIQUE (id, owner_telegram_user_id),
    CONSTRAINT fitment_checks_status_check
        CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    CONSTRAINT fitment_checks_stage_check
        CHECK (stage = 'confirmed'),
    CONSTRAINT fitment_checks_vehicle_owner_fk
        FOREIGN KEY (vehicle_identity_id, owner_telegram_user_id)
        REFERENCES fitment_vehicle_identities (id, owner_telegram_user_id),
    CONSTRAINT fitment_checks_rim_owner_fk
        FOREIGN KEY (rim_setup_id, owner_telegram_user_id)
        REFERENCES fitment_rim_setups (id, owner_telegram_user_id),
    CONSTRAINT fitment_checks_preliminary_owner_fk
        FOREIGN KEY (preliminary_run_id, owner_telegram_user_id)
        REFERENCES fitment_preliminary_runs (id, owner_telegram_user_id)
);

CREATE TABLE IF NOT EXISTS fitment_check_idempotency (
    owner_telegram_user_id      BIGINT NOT NULL,
    idempotency_key             TEXT NOT NULL,
    check_id                    UUID NOT NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fitment_check_idempotency_pkey
        PRIMARY KEY (owner_telegram_user_id, idempotency_key),
    CONSTRAINT fitment_check_idempotency_key_check
        CHECK (length(idempotency_key) BETWEEN 1 AND 255),
    CONSTRAINT fitment_check_idempotency_check_owner_fk
        FOREIGN KEY (check_id, owner_telegram_user_id)
        REFERENCES fitment_checks (id, owner_telegram_user_id)
        ON DELETE CASCADE
);

ALTER TABLE fitment_preliminary_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitment_vehicle_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitment_rim_setups ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitment_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE fitment_check_idempotency ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_fitment_preliminary_runs_owner_created
    ON fitment_preliminary_runs (owner_telegram_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fitment_preliminary_runs_status_created
    ON fitment_preliminary_runs (status, created_at);

CREATE INDEX IF NOT EXISTS idx_fitment_vehicle_identities_owner_created
    ON fitment_vehicle_identities (owner_telegram_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fitment_rim_setups_owner_created
    ON fitment_rim_setups (owner_telegram_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fitment_checks_owner_created
    ON fitment_checks (owner_telegram_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fitment_checks_status_created
    ON fitment_checks (status, created_at);

CREATE INDEX IF NOT EXISTS idx_fitment_checks_render_job
    ON fitment_checks (render_job_id)
    WHERE render_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fitment_checks_preliminary_run
    ON fitment_checks (preliminary_run_id)
    WHERE preliminary_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fitment_check_idempotency_check
    ON fitment_check_idempotency (check_id);
