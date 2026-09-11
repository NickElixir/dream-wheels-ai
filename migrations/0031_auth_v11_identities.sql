-- Canonical external identities for Dream Wheels users.
-- Existing Telegram IDs are backfilled without changing users.id ownership.

CREATE TABLE IF NOT EXISTS user_identities (
    id                    BIGSERIAL PRIMARY KEY,
    user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider              VARCHAR(32) NOT NULL,
    provider_subject      TEXT NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_authenticated_at TIMESTAMPTZ,

    CONSTRAINT user_identities_provider_subject_key
        UNIQUE (provider, provider_subject),
    CONSTRAINT user_identities_provider_nonempty_check
        CHECK (btrim(provider) <> ''),
    CONSTRAINT user_identities_subject_nonempty_check
        CHECK (btrim(provider_subject) <> '')
);

CREATE INDEX IF NOT EXISTS idx_user_identities_user_id
    ON user_identities(user_id);

-- Auth metadata remains backend-owned, like the existing users table.
ALTER TABLE user_identities ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE user_identities FROM anon, authenticated;

-- Keep the Telegram column and its non-null uniqueness for compatibility, while
-- allowing canonical users created through a non-Telegram authority.
ALTER TABLE users
    ALTER COLUMN telegram_user_id DROP NOT NULL;

-- The backfill only creates missing Telegram identities. It never creates,
-- merges, or reassigns canonical users or their business-owned records.
INSERT INTO user_identities (user_id, provider, provider_subject)
SELECT id, 'telegram', telegram_user_id::TEXT
FROM users
WHERE telegram_user_id IS NOT NULL
ON CONFLICT (provider, provider_subject) DO NOTHING;
