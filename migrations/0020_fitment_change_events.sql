-- Sprint 4 fitment editor audit log.
--
-- Canonical current values stay in vehicle_identities and rim_specs.
-- field_candidates explain AI/provider guesses.
-- fitment_change_events is append-only history for canonical edits and confirmations.

CREATE TABLE IF NOT EXISTS fitment_change_events (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id                   UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    vehicle_identity_id      UUID REFERENCES vehicle_identities(id) ON DELETE SET NULL,
    rim_spec_id              UUID REFERENCES rim_specs(id) ON DELETE SET NULL,
    event_type               TEXT NOT NULL,
    actor_type               TEXT NOT NULL,
    actor_user_id            INTEGER REFERENCES users(id) ON DELETE SET NULL,
    vehicle_revision_before  INTEGER,
    vehicle_revision_after   INTEGER,
    rim_revision_before      INTEGER,
    rim_revision_after       INTEGER,
    changes                  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fitment_change_events_event_type_check CHECK (
        event_type IN ('initial_prefill', 'user_save', 'user_confirm', 'candidate_applied')
    ),
    CONSTRAINT fitment_change_events_actor_type_check CHECK (
        actor_type IN ('system', 'user', 'admin', 'provider')
    )
);

CREATE INDEX IF NOT EXISTS idx_fitment_change_events_job_created
    ON fitment_change_events(job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fitment_change_events_vehicle_identity
    ON fitment_change_events(vehicle_identity_id);

CREATE INDEX IF NOT EXISTS idx_fitment_change_events_rim_spec
    ON fitment_change_events(rim_spec_id);
