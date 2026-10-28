-- Minimal, first-party product analytics. Visitor identifiers are random client UUIDs,
-- not Telegram IDs; attribution is linked to a user only after authenticated activity.
CREATE TABLE IF NOT EXISTS analytics_visitors (
    visitor_id UUID PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    first_touch JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_touch JSONB NOT NULL DEFAULT '{}'::jsonb,
    landing_url TEXT,
    referrer TEXT,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_visitors_user_id ON analytics_visitors(user_id);

CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id UUID REFERENCES analytics_visitors(visitor_id),
    user_id INTEGER REFERENCES users(id),
    event_name TEXT NOT NULL CHECK (event_name IN (
        'app_opened', 'auth_completed', 'upload_started', 'upload_completed',
        'render_started', 'render_completed', 'render_failed', 'result_opened',
        'feedback_submitted', 'repeat_render_started', 'payment_started',
        'payment_completed', 'payment_failed'
    )),
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name_occurred
    ON analytics_events(event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor_occurred
    ON analytics_events(visitor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_occurred
    ON analytics_events(user_id, occurred_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_payment_completed_once
    ON analytics_events (user_id, event_name, (properties->>'invoice_id'))
    WHERE event_name = 'payment_completed';
