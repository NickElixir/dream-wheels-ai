-- Release 1 account linking: identities remain server-owned, while a merged
-- source user is retained for audit and can no longer receive an identity.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS merged_into_user_id INTEGER REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS merged_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_merged_into_user_id
    ON users(merged_into_user_id)
    WHERE merged_into_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS account_merges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survivor_user_id INTEGER NOT NULL REFERENCES users(id),
    source_user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
    initiated_by_user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT account_merges_distinct_users CHECK (survivor_user_id <> source_user_id)
);

CREATE INDEX IF NOT EXISTS idx_account_merges_survivor_created
    ON account_merges(survivor_user_id, created_at DESC);

ALTER TABLE account_merges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE account_merges FROM anon, authenticated;

-- A user merge changes jobs.user_id.  The matching render-feedback ownership
-- must move in the same statement to preserve its composite owner/job FK.
DO $$
BEGIN
    IF to_regclass('public.render_feedback') IS NOT NULL THEN
        ALTER TABLE render_feedback
            DROP CONSTRAINT IF EXISTS render_feedback_render_job_owner_fk;
        ALTER TABLE render_feedback
            ADD CONSTRAINT render_feedback_render_job_owner_fk
            FOREIGN KEY (render_job_id, owner_user_id)
            REFERENCES jobs(id, user_id)
            ON UPDATE CASCADE
            ON DELETE CASCADE;
    END IF;
END $$;
