-- New purchases and starter grants retain their existing expiration contract.
ALTER TABLE credit_packages ALTER COLUMN expires_at DROP NOT NULL;
ALTER TABLE credit_packages DROP CONSTRAINT IF EXISTS credit_packages_source_check;
ALTER TABLE credit_packages ADD CONSTRAINT credit_packages_source_check
    CHECK (source IN ('starter_grant', 'purchase', 'refund', 'legacy_balance'));
ALTER TABLE credit_packages DROP CONSTRAINT IF EXISTS credit_packages_expiry_kind_check;
ALTER TABLE credit_packages ADD CONSTRAINT credit_packages_expiry_kind_check CHECK (
    (source = 'legacy_balance' AND expires_at IS NULL)
    OR (source <> 'legacy_balance' AND expires_at IS NOT NULL)
);

-- Written only by the coordinated, transactional pre-FIFO cutover tool.
CREATE TABLE IF NOT EXISTS legacy_credit_balance_cutovers (
    cutover_key TEXT PRIMARY KEY,
    balances JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE legacy_credit_balance_cutovers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON legacy_credit_balance_cutovers FROM anon, authenticated;
