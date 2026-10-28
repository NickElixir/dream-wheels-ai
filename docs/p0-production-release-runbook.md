# P0 production release runbook

## Vercel WebApp environments

The WebApp sends all non-local API requests to its same-origin `/api/backend/*`
function. Configure `BACKEND_URL` in each Vercel project/environment before deployment:

| Environment | `BACKEND_URL` |
| --- | --- |
| staging | Staging Render backend origin, without a trailing slash |
| production | Production Render backend origin, without a trailing slash |

Do not configure `BACKEND_URL` as a client-exposed environment variable. After
deployment, request `/api/backend/health` (or another safe backend endpoint) and
confirm in the Vercel Function logs that it reaches the intended environment.

## Migration ledger

Before a production deployment, take a database backup and record the current
schema state. Do not infer it from staging.

1. Compare production tables, columns, indexes, constraints, RLS policies and
   storage policies against `migrations/0015` through `0024`.
2. Record each migration as `already present`, `apply`, or `manual review`, with
   the schema evidence and operator in the release ticket.
3. Apply only the missing migrations in ascending order. After each migration,
   run its matching schema check and application smoke check.
4. Stop on a destructive or ambiguous transition; create a forward migration
   instead of changing an existing migration.

## Release verification

- Confirm CI is green for the staging PR.
- Verify the production defaults remain disabled for vehicle identity, fitment
  verdict and rim URL resolution.
- Run the staging sandbox payment flow and verify duplicate callback/webhook
  handling, credit debit/refund, and pending-payment refresh.
- Run the browser E2E flow on staging, including protected asset access, history,
  feedback, retry/double-submit and mobile viewport.
- Promote to `main` only after the release report has a GO decision.
