-- Add local checkout timeout without changing historical statuses or grants.
ALTER TABLE payments
    DROP CONSTRAINT IF EXISTS payments_status_check,
    ADD CONSTRAINT payments_status_check
        CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'cancelled'));
