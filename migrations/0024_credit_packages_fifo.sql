-- Durable package accounting.  The balance remains a cached total; packages
-- are the source for expiry order and reservation attribution.

CREATE TABLE IF NOT EXISTS credit_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('starter_grant', 'purchase', 'refund')),
    credits_granted INTEGER NOT NULL CHECK (credits_granted > 0),
    remaining_credits INTEGER NOT NULL CHECK (remaining_credits >= 0),
    expires_at TIMESTAMPTZ NOT NULL,
    related_payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (remaining_credits <= credits_granted)
);

CREATE INDEX IF NOT EXISTS idx_credit_packages_active_fifo
    ON credit_packages(user_id, expires_at, created_at)
    WHERE remaining_credits > 0;

CREATE TABLE IF NOT EXISTS credit_package_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES credit_packages(id) ON DELETE RESTRICT,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
    credits INTEGER NOT NULL CHECK (credits > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (package_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_credit_package_allocations_job
    ON credit_package_allocations(job_id);

ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_package_allocations ENABLE ROW LEVEL SECURITY;

INSERT INTO credit_packages (user_id, source, credits_granted, remaining_credits, expires_at, related_payment_id, idempotency_key, created_at)
SELECT l.user_id, 'starter_grant', l.credits_delta, l.credits_delta,
       l.created_at + INTERVAL '30 days', NULL, l.idempotency_key, l.created_at
FROM credit_ledger l
WHERE l.event_type = 'trial_grant' AND l.credits_delta > 0
ON CONFLICT (idempotency_key) DO NOTHING;

INSERT INTO credit_packages (user_id, source, credits_granted, remaining_credits, expires_at, related_payment_id, idempotency_key, created_at)
SELECT p.user_id, 'purchase', p.credits_granted, p.credits_granted,
       COALESCE(p.paid_at, p.created_at) + INTERVAL '30 days', p.id,
       'payment_package:' || p.invoice_id::text, COALESCE(p.paid_at, p.created_at)
FROM payments p
WHERE p.status = 'paid' AND p.credits_granted > 0
ON CONFLICT (idempotency_key) DO NOTHING;

WITH ordered AS (
    SELECT cp.id, cp.user_id, cp.credits_granted,
           COALESCE(SUM(cp.credits_granted) OVER (PARTITION BY cp.user_id ORDER BY cp.expires_at, cp.created_at ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS before_credits,
           a.balance
    FROM credit_packages cp
    JOIN user_credit_accounts a ON a.user_id = cp.user_id
    WHERE cp.expires_at > CURRENT_TIMESTAMP
)
UPDATE credit_packages cp
SET remaining_credits = LEAST(ordered.credits_granted, GREATEST(ordered.balance - ordered.before_credits, 0))
FROM ordered WHERE cp.id = ordered.id;

UPDATE credit_packages SET remaining_credits = 0 WHERE expires_at <= CURRENT_TIMESTAMP;

UPDATE user_credit_accounts a
SET balance = COALESCE((SELECT SUM(cp.remaining_credits) FROM credit_packages cp WHERE cp.user_id = a.user_id), 0),
    updated_at = CURRENT_TIMESTAMP;
