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
