-- Auth V1.1 Slice 4: extend the existing first-party analytics event allowlist.
-- Apply after 0025_product_analytics.sql; this does not change auth ownership.
ALTER TABLE IF EXISTS analytics_events
    DROP CONSTRAINT IF EXISTS analytics_events_event_name_check,
    ADD CONSTRAINT analytics_events_event_name_check CHECK (event_name IN (
        'app_opened', 'auth_completed', 'auth_started', 'otp_requested',
        'otp_verified', 'session_restored', 'session_refresh_failed',
        'auth_failed', 'auth_signed_out', 'upload_started', 'upload_completed',
        'render_started', 'render_completed', 'render_failed', 'result_opened',
        'feedback_submitted', 'repeat_render_started', 'payment_started',
        'payment_completed', 'payment_failed'
    ));
