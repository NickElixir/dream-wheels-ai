BEGIN;
CREATE TABLE IF NOT EXISTS registration_attribution (
    account_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    touched_at TIMESTAMPTZ NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('landing', 'catalog')),
    locale TEXT NOT NULL CHECK (locale IN ('ru', 'en')),
    provider TEXT NOT NULL CHECK (provider IN ('supabase', 'telegram')),
    utm JSONB NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE registration_attribution ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON registration_attribution FROM anon, authenticated;
COMMIT;
