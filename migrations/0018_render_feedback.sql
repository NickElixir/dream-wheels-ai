-- Sprint 3 durable render feedback.
--
-- Keep legacy jobs.feedback for rollout compatibility and backfill, but move
-- canonical read/write paths to render_feedback.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'jobs_id_user_id_unique'
    ) THEN
        ALTER TABLE jobs
            ADD CONSTRAINT jobs_id_user_id_unique UNIQUE (id, user_id);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS render_feedback (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    render_job_id   UUID NOT NULL,
    owner_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sentiment       TEXT NOT NULL,
    reason          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'render_feedback_sentiment_check'
    ) THEN
        ALTER TABLE render_feedback
            ADD CONSTRAINT render_feedback_sentiment_check
            CHECK (sentiment IN ('liked', 'disliked'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'render_feedback_reason_check'
    ) THEN
        ALTER TABLE render_feedback
            ADD CONSTRAINT render_feedback_reason_check
            CHECK (
                reason IS NULL
                OR reason IN (
                    'wheel_differs',
                    'car_changed',
                    'angle_or_scale',
                    'image_quality',
                    'other'
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'render_feedback_liked_reason_null_check'
    ) THEN
        ALTER TABLE render_feedback
            ADD CONSTRAINT render_feedback_liked_reason_null_check
            CHECK (
                sentiment <> 'liked'
                OR reason IS NULL
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'render_feedback_owner_job_unique'
    ) THEN
        ALTER TABLE render_feedback
            ADD CONSTRAINT render_feedback_owner_job_unique
            UNIQUE (owner_user_id, render_job_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'render_feedback_render_job_owner_fk'
    ) THEN
        ALTER TABLE render_feedback
            ADD CONSTRAINT render_feedback_render_job_owner_fk
            FOREIGN KEY (render_job_id, owner_user_id)
            REFERENCES jobs(id, user_id)
            ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_render_feedback_render_job_id
    ON render_feedback(render_job_id);

INSERT INTO render_feedback (
    render_job_id,
    owner_user_id,
    sentiment,
    reason,
    created_at,
    updated_at
)
SELECT
    jobs.id,
    jobs.user_id,
    CASE jobs.feedback
        WHEN 'like' THEN 'liked'
        WHEN 'dislike' THEN 'disliked'
    END AS sentiment,
    NULL,
    COALESCE(jobs.completed_at, jobs.created_at, CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
FROM jobs
WHERE jobs.user_id IS NOT NULL
  AND jobs.status = 'completed'
  AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'jobs'
        AND column_name = 'feedback'
  )
  AND jobs.feedback IN ('like', 'dislike')
ON CONFLICT (owner_user_id, render_job_id) DO UPDATE
SET sentiment = EXCLUDED.sentiment,
    reason = EXCLUDED.reason,
    updated_at = CURRENT_TIMESTAMP;
