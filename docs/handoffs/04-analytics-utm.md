# Analytics / UTM attribution

## Status

- Date: 2026-08-19
- Base: `origin/staging` at `80cccd8093b2b8b313a29ed90601eca6d3040ac0`
- Branch: `feature/analytics-utm-attribution`
- Commit: `962b0a613b15605fa4ed1d6a274fc7a472d4c7c3` (amended below to include this handoff reference)
- Ready to merge into staging: **YES**, after applying migration `0025_product_analytics.sql` in staging.

`04-analytics-utm.md` was not present in the fetched `origin/staging`; this document is the newly created, implementation-backed handoff.

## Delivered

- First-party event ingestion: `POST /analytics/events`.
- UTM fields: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`.
- Durable anonymous visitor UUID in `localStorage`; first-touch is retained and last-touch updates when a new UTM link is opened.
- Attribution fields: `landing_url`, `referrer`, `first_seen_at`, `last_seen_at`.
- Authenticated events associate that visitor with the canonical `users` row, so attribution survives website auth, Telegram Mini App auth, and re-open.
- Telegram deep-link `start_param` / `tgWebAppStartParam` is stored only as event metadata. No staging domain is hard-coded: the frontend uses the existing relative/proxy API resolver.
- Funnel events allowlisted in the database: `app_opened`, `auth_completed`, `upload_started`, `upload_completed`, `render_started`, `render_completed`, `render_failed`, `result_opened`, `feedback_submitted`, `repeat_render_started`, `payment_started`, `payment_completed`, `payment_failed`.
- Render completion/failure and payment completion are additionally recorded server-side, avoiding loss when the client closes. Payment completion is idempotent per user/invoice.

## Files

- `migrations/0025_product_analytics.sql`
- `src/analytics_api.py`
- `src/main.py`
- `src/payments_api.py`
- `webapp/app.js`
- `tests/test_analytics_contract.py`

## Verification

- `ruff check src/analytics_api.py src/main.py src/payments_api.py tests/test_analytics_contract.py` — passed.
- `python -m compileall -q src tests` — passed.
- `node --check webapp/app.js` — passed.
- `pytest -q` — **222 passed, 3 skipped**.
- Browser E2E: not run; this worktree intentionally has no staging deployment and the task forbids production rollout. Before merge/deploy, manually open an UTM URL on the staging domain, authenticate both through the website and Telegram Mini App, submit a render, and complete the configured test payment flow; verify rows in `analytics_visitors` and `analytics_events`.

## Exact next step

1. Apply migration `0025_product_analytics.sql` to staging.
2. Merge this branch into `staging`.
3. Run the listed staging-only E2E checks; do not promote to production as part of this workstream.

## Follow-up: nested proxy and staging failure (2026-08-19)

- Branch: `fix/vercel-backend-nested-routes`
- PR: https://github.com/NickElixir/dream-wheels-ai/pull/81
- Base: `origin/staging` at `db1295acd7b592f8150de4172c2c1759cf5889ab`
- Fix: explicit Vercel nested catch-all routes for `auth`, `analytics`, `fitment`, `identity`, `jobs`, `payments`, and `health`, sharing `webapp/lib/backend-proxy.js`.
- Render log root cause fixed: `TypeError: Object of type datetime is not JSON serializable` in analytics attribution ingestion; timestamps now use Pydantic JSON mode.
- Verification: `pytest -q` — **223 passed, 3 skipped**; Ruff and JavaScript syntax checks passed; Vercel preview deployment completed.
- Preview E2E is pending because Vercel Deployment Protection requires an authenticated preview session. After PR #81 merges, verify `/api/backend/auth/telegram/nonce`, `/api/backend/jobs`, and `POST /api/backend/analytics/events` on the staging alias.

## Follow-up: Telegram auth route completion (2026-08-19)

- Branch: `fix/vercel-telegram-auth-routes`
- Cause: the merged nested catch-all Vercel function did not match the three-segment endpoints `/api/backend/auth/telegram/nonce` and `/api/backend/auth/telegram/verify-id-token`; Vercel returned an edge `404`, while the direct Render nonce endpoint returned `200`.
- Fix: explicit proxy functions at `webapp/api/backend/auth/telegram/nonce.js` and `webapp/api/backend/auth/telegram/verify-id-token.js`, both using the shared, domain-agnostic `webapp/lib/backend-proxy.js`.
- Verification: JavaScript syntax and module-resolution checks passed; `vercel build --yes` passed and emitted both explicit functions. Staging E2E remains to be run after merge/deploy: obtain nonce and complete Telegram ID-token verification through the staging alias.
- Ready to merge into `staging`: **YES**.

## Follow-up: decoded upstream response header (2026-08-19)

- Branch: `fix/vercel-proxy-content-encoding`
- Cause: Node `fetch` decompresses the gzip body returned by Render but retains the original `content-encoding: gzip` header. The shared Vercel proxy returned that stale header with plain JSON, which made Chrome fail the Telegram nonce request with `net::ERR_CONTENT_DECODING_FAILED` despite HTTP `200`.
- Fix: do not forward `content-encoding` from upstream responses; Vercel/browser may apply compression to the final response themselves.
- Verification: regression check confirms the proxy returns the decoded body without `content-encoding` or stale `content-length`; `vercel build --yes` passed and emitted both Telegram auth functions.
- Ready to merge into `staging`: **YES**.
