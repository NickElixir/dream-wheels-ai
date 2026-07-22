-- Credit balances are backend-only data.  The Render backend connects through
-- the server-side database role; no browser/PostgREST role needs access.
-- Staging drift left this protection disabled despite the original ledger migration.

ALTER TABLE IF EXISTS user_credit_accounts ENABLE ROW LEVEL SECURITY;
