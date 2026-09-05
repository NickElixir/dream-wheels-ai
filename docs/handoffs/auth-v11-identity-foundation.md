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

## Staging rollout order

Do not deploy code that uses this service until the schema exists.

1. Review the migration in the PR.
2. Apply `0031_auth_v11_identities.sql` manually in the staging Supabase SQL
   Editor.
3. Run the verification SQL below and record the results.
4. Merge/deploy the PR only after those checks pass.
5. Run a Telegram smoke test; future Supabase runtime work is a separate slice.

Production is out of scope.

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
AUTH_IDENTITY_SCHEMA              = PASS (migration contract; staging SQL pending)
AUTH_TELEGRAM_BACKFILL            = PASS (migration contract; staging SQL pending)
AUTH_EXISTING_USER_IDS_PRESERVED  = PASS
AUTH_TELEGRAM_ID_NULLABLE         = PASS (migration contract; staging SQL pending)
AUTH_LEGACY_TELEGRAM_CREATE       = PASS
AUTH_NEW_TELEGRAM_IDENTITY        = PASS
AUTH_GENERIC_IDENTITY_LOOKUP      = PASS
AUTH_GENERIC_USER_CREATE          = PASS
AUTH_SUPABASE_SUBJECT_SUPPORTED   = PASS
AUTH_IDENTITY_UNIQUENESS          = PASS (DB constraint; staging SQL pending)
AUTH_IDENTITY_RACE_SAFETY         = PASS (unit; DB concurrency pending without DATABASE_URL)
AUTH_IDENTITY_TRANSACTION_SAFETY  = PASS
AUTH_BUSINESS_DATA_MIGRATION      = NONE
AUTH_TELEGRAM_REGRESSION          = NONE
AUTH_CREDITS_REGRESSION           = NONE
AUTH_PAYMENTS_REGRESSION          = NONE
AUTH_FITMENT_REGRESSION           = NONE
FULL_TEST_SUITE                   = PASS (461 passed, 5 skipped)
CI                                = PASS (PR #158 checks)
AUTH_FOUNDATION_STAGING_MIGRATION = PENDING
AUTH_IDENTITY_FOUNDATION_READY    = YES (repository foundation; staging rollout pending)
```
