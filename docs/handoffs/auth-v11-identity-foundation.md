# Auth V1.1 Slice 0: Canonical Identity Foundation

## Baseline

Implementation starts from `staging` commit `e5b93c1`:

```text
Merge pull request #156 from NickElixir/hardening/webapp-url-origin-validation
```

The preceding migration is `0030_results_bucket_20m.sql`; this slice owns
`0031_auth_v11_identities.sql`.

At the time of reconciliation, PR #140 (AUTH-01), PR #142 (old AUTH-02) and
PR #157 (approved Auth V1.1 scope document) were open and absent from
`staging`. PR #142 is implementation reference only and this clean branch
supersedes it as the candidate identity-foundation change. Do not merge #142
on top of this work.

## Existing ownership model

`users.id` already owns jobs, credit accounts and ledger, payments, assets,
vehicle/rim identity, render drafts/history, Fitment, feedback and analytics.
AUTH V1.1 keeps all of those references unchanged.

`preorders.telegram_user_id` is a legacy value without a foreign key to
`users`; it is not an active canonical ownership path and is intentionally
deferred. No business records are moved, copied or merged in this slice.

## Resulting identity model

```text
external identity
  -> user_identities(provider, provider_subject)
  -> users.id
  -> credits / payments / jobs / history / Fitment / analytics
```

`user_identities` has a foreign key to `users.id`, global uniqueness on
`(provider, provider_subject)`, and an index on `user_id`. There is no
`UNIQUE(user_id, provider)`: future account-linking requirements may allow
multiple identities from one authority.

The database deliberately has no provider enum. Application helpers currently
accept the stable lowercase values `telegram` and `supabase`; later providers
can be introduced through an explicit application change without schema churn.

For the future website-auth authority:

```text
provider = supabase
provider_subject = stable auth.users UUID text
```

No tokens, OTPs, authorization codes, scopes, credentials, emails or profile
fields are stored in `user_identities`.

## Migration and compatibility

`migrations/0031_auth_v11_identities.sql`:

- creates `user_identities` with `ON DELETE CASCADE` and RLS enabled;
- revokes `anon` and `authenticated` grants and creates no public RLS
  policies, retaining backend-owned auth metadata;
- changes only `users.telegram_user_id` from `NOT NULL` to nullable;
- preserves its existing unique constraint, which still protects non-null
  Telegram IDs;
- backfills every non-null Telegram ID with `provider='telegram'`;
- uses `ON CONFLICT DO NOTHING`, so reruns do not duplicate or reassign rows;
- neither creates nor renumbers existing `users`, nor changes business rows.

The existing `ensure_user(conn, telegram_user_id, username)` signature remains
the Telegram compatibility boundary. It now atomically ensures the legacy user
row and a Telegram identity. `ensure_user_identity()` creates a Supabase-only
canonical user with `telegram_user_id = NULL` when necessary.

## Race and transaction safety

`ensure_user_identity()` executes in a transaction and first takes a
transaction-scoped PostgreSQL advisory lock keyed by provider plus subject.
The unique database constraint remains the final correctness boundary.

If a concurrent or external writer owns the identity after the initial lookup,
the identity insert returns no row, `IdentityConflictError` is raised, and the
transaction rolls back the newly-created user. Identities are never silently
reassigned and no orphan canonical user remains.

## Staging integration barrier

`0031_auth_v11_identities.sql` has already been applied manually to the
canonical staging database. It is a backward-compatible schema-only change:
current staging runtime does not query `user_identities`, and no Auth V1.1 code
has been deployed from this branch.

Do not roll back the migration. Instead, preserve the 03B integration barrier:

1. Complete 03B merge and its canonical staging E2E gate.
2. Record the resulting `PRE_AUTH_BASELINE` SHA.
3. Rebase this branch once on that SHA and repeat Auth CI/tests.
4. Run the verification SQL below against staging and record the results.
5. Only then consider merging/deploying the Auth integration work.

Production is not touched.

## Staging verification SQL

```sql
SELECT count(*) AS telegram_users
FROM users
WHERE telegram_user_id IS NOT NULL;

SELECT count(*) AS telegram_identities
FROM user_identities
WHERE provider = 'telegram';

SELECT u.id, u.telegram_user_id
FROM users u
WHERE u.telegram_user_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM user_identities i
      WHERE i.user_id = u.id
        AND i.provider = 'telegram'
        AND i.provider_subject = u.telegram_user_id::text
  );

SELECT provider, provider_subject, count(*)
FROM user_identities
GROUP BY provider, provider_subject
HAVING count(*) > 1;

SELECT count(*) AS orphan_identities
FROM user_identities i
LEFT JOIN users u ON u.id = i.user_id
WHERE u.id IS NULL;

BEGIN;
INSERT INTO users (telegram_user_id)
VALUES (NULL)
RETURNING id;
ROLLBACK;
```

Expected: Telegram counts match; missing rows, duplicates and orphans are zero.
For preservation evidence, compare a known existing `users.id` before/after
with its job count, credit balance, payments and Fitment ownership. The final
rolled-back insert proves nullable support without creating a staging user.

## Live staging verification

Verification ran read-only against canonical staging on `2026-09-05`.
The migration was applied manually through SQL Editor before this verification;
the exact editor execution timestamp is not available from database metadata.

```text
STAGING_DB_MIGRATION_APPLIED_AT  = manual SQL Editor, timestamp unavailable
STAGING_DB_VERIFICATION_DATE     = 2026-09-05
TELEGRAM_USERS                   = 22
TELEGRAM_IDENTITIES              = 22
MISSING_IDENTITIES               = 0
MISMATCHED_IDENTITIES            = 0
DUPLICATE_IDENTITIES             = 0
ORPHAN_IDENTITIES                = 0
TELEGRAM_USER_ID_NULLABLE        = YES
RLS_STATUS                       = enabled; no policies
CLIENT_GRANTS_STATUS             = anon/authenticated SELECT/INSERT/UPDATE/DELETE all false
TELEGRAM_SMOKE_STATUS            = PENDING (no safe authorized Telegram context)
```

Live catalog inspection confirmed the expected six columns, `ON DELETE
CASCADE` foreign key, unique `(provider, provider_subject)` constraint and
`idx_user_identities_user_id`. Existing business foreign keys still point to
`users.id` for jobs, credits/ledger, payments, analytics, Fitment and
render/history tables; no ownership migration was run.

Supabase security advisor reports `rls_enabled_no_policy` for
`user_identities` as an informational result, which is intentional for this
backend-only table because client table privileges are revoked. Its remaining
warnings predate this slice and concern existing credit/payment functions.

## Tests

`tests/test_auth_v11_identities.py` covers migration contract, Telegram
backfill, legacy/new Telegram paths, Supabase subject creation/lookup/retry,
identity conflict rollback and database concurrency when `DATABASE_URL` is
available.

The current execution environment has no `DATABASE_URL` or Supabase CLI, so
the two live database tests are skipped and no staging/production SQL was run.

## Deferred

- Supabase Auth configuration, Email OTP and JWT verification;
- provider-neutral `AuthPrincipal` and API auth cutover;
- browser sessions, refresh, cookies and frontend login UX;
- Yandex, VK and global OAuth providers;
- explicit Telegram-to-Supabase linking and account merge;
- migration/cleanup of legacy `preorders.telegram_user_id`.

## Gate status

```text
AUTH_IDENTITY_SCHEMA              = PASS (live staging verified)
AUTH_TELEGRAM_BACKFILL            = PASS (live staging verified)
AUTH_EXISTING_USER_IDS_PRESERVED  = PASS (live identity mapping; no ownership migration)
AUTH_TELEGRAM_ID_NULLABLE         = PASS (live schema verified)
AUTH_LEGACY_TELEGRAM_CREATE       = PASS
AUTH_NEW_TELEGRAM_IDENTITY        = PASS
AUTH_GENERIC_IDENTITY_LOOKUP      = PASS
AUTH_GENERIC_USER_CREATE          = PASS
AUTH_SUPABASE_SUBJECT_SUPPORTED   = PASS
AUTH_IDENTITY_UNIQUENESS          = PASS (live unique constraint and zero duplicates)
AUTH_IDENTITY_RACE_SAFETY         = PASS (unit; DB concurrency pending without DATABASE_URL)
AUTH_IDENTITY_TRANSACTION_SAFETY  = PASS
AUTH_BUSINESS_DATA_MIGRATION      = NONE
AUTH_TELEGRAM_REGRESSION          = NONE
AUTH_CREDITS_REGRESSION           = NONE
AUTH_PAYMENTS_REGRESSION          = NONE
AUTH_FITMENT_REGRESSION           = NONE
FULL_TEST_SUITE                   = PASS (461 passed, 5 skipped)
CI                                = PASS (PR #159 checks before Slice 0.1 docs)
AUTH_FOUNDATION_STAGING_MIGRATION = APPLIED
AUTH_FOUNDATION_STAGING_VERIFICATION = PASS
AUTH_TELEGRAM_BACKFILL_LIVE       = PASS
AUTH_IDENTITY_ORPHANS             = 0
AUTH_IDENTITY_DUPLICATES          = 0
AUTH_IDENTITY_RLS                 = PASS
AUTH_TELEGRAM_STAGING_SMOKE       = PENDING
AUTH_IDENTITY_FOUNDATION_READY    = YES (code checkpoint; 03B integration barrier remains)
PR_159                            = DRAFT
AUTH_RUNTIME_DEPLOYED             = NO
PRODUCTION                        = NOT_TOUCHED
```
