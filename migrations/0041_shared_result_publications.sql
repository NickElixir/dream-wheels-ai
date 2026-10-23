-- Apply before enabling the new share writer. Publications are server-only snapshots.
BEGIN;
CREATE TABLE IF NOT EXISTS shared_result_publications (
    id TEXT PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{32}$'),
    owner_user_id INTEGER NOT NULL REFERENCES users(id),
    job_id UUID NOT NULL REFERENCES jobs(id),
    fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
    snapshot JSONB NOT NULL,
    original_path TEXT NOT NULL,
    result_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (owner_user_id, job_id, fingerprint)
);
ALTER TABLE shared_result_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON shared_result_publications FROM anon, authenticated;
COMMIT;
