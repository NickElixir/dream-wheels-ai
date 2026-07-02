-- Sprint 2 assisted vehicle and rim identity.
--
-- Render jobs remain the canonical render lifecycle aggregate. The new
-- identity entities are shared by rendering now and the future fitment
-- pipeline later. Render input drafts hold pre-render uploads without
-- creating history jobs, reserving credits, or publishing render queue items.

CREATE TABLE IF NOT EXISTS vehicle_identities (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    make                TEXT NOT NULL,
    model               TEXT NOT NULL,
    year                INTEGER,
    year_start          INTEGER,
    year_end            INTEGER,
    body                TEXT,
    generation          TEXT,
    modification        TEXT,
    market              TEXT,
    is_user_confirmed   BOOLEAN NOT NULL DEFAULT false,
    provider_mappings   JSONB,
    field_provenance    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT vehicle_identities_year_check CHECK (
        year IS NULL OR (year >= 1886 AND year <= 2100)
    ),
    CONSTRAINT vehicle_identities_year_range_check CHECK (
        (year_start IS NULL AND year_end IS NULL)
        OR (
            year_start IS NOT NULL
            AND year_end IS NOT NULL
            AND year_start <= year_end
            AND year_start >= 1886
            AND year_end <= 2100
        )
    )
);

CREATE TABLE IF NOT EXISTS rim_specs (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    brand                TEXT,
    model                TEXT,
    sku                  TEXT,
    product_url          TEXT,
    bolt_count           INTEGER,
    pcd_mm               NUMERIC,
    center_bore_mm       NUMERIC,
    wheel_diameter_in    NUMERIC,
    wheel_width_j        NUMERIC,
    offset_et_mm         NUMERIC,
    load_rating_kg       INTEGER,
    fastener_system      TEXT,
    seat_type            TEXT,
    thread_diameter_mm   NUMERIC,
    thread_pitch_mm      NUMERIC,
    bolt_length_mm       NUMERIC,
    field_provenance     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT rim_specs_bolt_count_check CHECK (
        bolt_count IS NULL OR bolt_count > 0
    ),
    CONSTRAINT rim_specs_pcd_mm_check CHECK (
        pcd_mm IS NULL OR pcd_mm > 0
    ),
    CONSTRAINT rim_specs_center_bore_mm_check CHECK (
        center_bore_mm IS NULL OR center_bore_mm > 0
    ),
    CONSTRAINT rim_specs_wheel_diameter_in_check CHECK (
        wheel_diameter_in IS NULL OR wheel_diameter_in > 0
    ),
    CONSTRAINT rim_specs_wheel_width_j_check CHECK (
        wheel_width_j IS NULL OR wheel_width_j > 0
    ),
    CONSTRAINT rim_specs_load_rating_kg_check CHECK (
        load_rating_kg IS NULL OR load_rating_kg > 0
    ),
    CONSTRAINT rim_specs_fastener_system_check CHECK (
        fastener_system IS NULL OR fastener_system IN ('bolt', 'stud_and_nut', 'unknown')
    ),
    CONSTRAINT rim_specs_seat_type_check CHECK (
        seat_type IS NULL OR seat_type IN ('cone', 'ball', 'flat', 'unknown')
    )
);

CREATE TABLE IF NOT EXISTS rim_setups (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    front_rim_spec_id   UUID NOT NULL REFERENCES rim_specs(id) ON DELETE RESTRICT,
    rear_rim_spec_id    UUID NOT NULL REFERENCES rim_specs(id) ON DELETE RESTRICT,
    is_staggered        BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS render_input_drafts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    car_asset_id        UUID REFERENCES assets(id) ON DELETE SET NULL,
    rim_asset_id        UUID REFERENCES assets(id) ON DELETE SET NULL,
    identity_proposal   JSONB NOT NULL DEFAULT '{}'::jsonb,
    status              TEXT NOT NULL DEFAULT 'resolving',
    expires_at          TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '1 hour'),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT render_input_drafts_status_check CHECK (
        status IN ('resolving', 'resolved', 'consumed', 'expired')
    )
);

ALTER TABLE render_input_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE rim_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rim_setups ENABLE ROW LEVEL SECURITY;

ALTER TABLE assets
    ADD COLUMN IF NOT EXISTS render_input_draft_id UUID REFERENCES render_input_drafts(id) ON DELETE SET NULL;

ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS vehicle_identity_id UUID REFERENCES vehicle_identities(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS rim_setup_id UUID REFERENCES rim_setups(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS render_input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_vehicle_identities_owner_created
    ON vehicle_identities(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vehicle_identities_lookup
    ON vehicle_identities(make, model, year, generation, market);

CREATE INDEX IF NOT EXISTS idx_rim_specs_owner_created
    ON rim_specs(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rim_specs_quick_lookup
    ON rim_specs(bolt_count, pcd_mm, wheel_diameter_in, wheel_width_j, offset_et_mm);

CREATE INDEX IF NOT EXISTS idx_rim_setups_owner_created
    ON rim_setups(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_render_input_drafts_owner_status
    ON render_input_drafts(owner_user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_render_input_drafts_expires
    ON render_input_drafts(expires_at)
    WHERE status IN ('resolving', 'resolved');

CREATE INDEX IF NOT EXISTS idx_assets_render_input_draft_id
    ON assets(render_input_draft_id);

CREATE INDEX IF NOT EXISTS idx_jobs_vehicle_identity_id
    ON jobs(vehicle_identity_id);

CREATE INDEX IF NOT EXISTS idx_jobs_rim_setup_id
    ON jobs(rim_setup_id);
