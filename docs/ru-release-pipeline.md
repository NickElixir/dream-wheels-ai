# RU frontend release pipeline

Canonical deployment contract. Historical handoffs are evidence, not current deployment instructions.

## Environments and ownership

| Profile | Frontend | Gateway | Data boundary |
|---|---|---|---|
| Local | localhost / 127.0.0.1 | explicitly configured local API | Use disposable fixtures by default |
| `ru-test` | https://app-test.dream-wheels.ru | https://gateway-test.dreamwheels.deno.net/api/backend | **Production API and Supabase data**; not an isolated staging backend |
| `ru-production` | https://app.dream-wheels.ru | https://gateway.dreamwheels.deno.net/api/backend | Production API and Supabase data |
| Vercel staging | existing Vercel staging project | same-origin `/api/backend` | Existing staging API/config |
| Vercel production | https://app.dreamwheels.pro | same-origin `/api/backend` | Existing production API/config |

`dream-wheels.ru` is reserved for the landing page, which is a separate release.
The Cyrillic domain/branding decision is deferred. RU website login is email only;
Telegram bot and Mini App remain separate supported entry points. No commercial,
payment, credit or database changes are part of frontend releases.

Timeweb App Platform frontend apps: test **281549**, production **281247**.
Repository: `NickElixir/dream-wheels-ai`. Static output: `dist/timeweb`, command
`npm run build`, Node 24. Deno app directory: `deploy/gateway`, dynamic entrypoint
`main.ts`, organization `dreamwheels`. Render upstream is fixed in gateway source:
`https://dream-wheels-ai-prod-vnext.onrender.com` (service `srv-dbgvles9v7es73bfshdg`).
Do not create a second backend/database just to change network routing.

## Source and release rules

- Work from a persistent checkout, not `/tmp`. GitHub is the source of truth.
- Follow `feature/fix/chore -> staging -> main`; no direct pushes to main.
- Every PR, including nested infrastructure PRs, must pass CI. A release uses
  the exact tested 40-character SHA, never a moving branch tip.
- Timeweb profiles are required. `TIMEWEB_API_TARGET` is obsolete and rejected.
  Never point production to `gateway-test`; host/profile/API mismatches fail closed.
- `APP_BUILD_SHA` must equal Git HEAD when Git metadata exists. In Timeweb's
  Git-less build sandbox it must be injected from the selected source commit.
- Disable provider-native automatic deployment for the RU apps. Use the release
  workflow, which explicitly selects the source commit and profile. A panel
  change is an emergency exception: record it and reconcile the repo afterward.
- Existing Vercel release workflow stays independent. Do not release Vercel or
  restart Render as a side effect of a RU-only frontend release. Inspect Render
  auto-deploy before any main merge, because main can trigger backend deployment.
  After the current infrastructure cutover, enable backend auto-deploy only after
  successful CI checks, per the owner’s explicit instruction on 2026-11-02.

## Configuration and secrets

Only publishable Supabase and Turnstile settings enter a frontend artifact.
Never supply service-role keys, bot tokens or backend secrets to frontend builds.
Both RU profiles currently use the existing production Supabase project and widget.
Use Actions variables `TIMEWEB_RU_TEST_{SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,TURNSTILE_SITE_KEY}`
and corresponding `TIMEWEB_RU_PRODUCTION_*` variables. This duplication identifies
ownership; it does not claim data isolation.

CI credentials are `TIMEWEB_CLOUD_TOKEN` and `DENO_DEPLOY_TOKEN`, kept in GitHub
Actions secrets. Do not put tokens in CLI arguments, logs, artifacts or this file.
Production environment reviewers and account permissions remain separate controls.

## Verification and release evidence

1. CI: Python lint/test, browser auth tests, builder/profile tests, gateway
   type/lint/tests, release verifier tests.
2. Build exact SHA; preserve artifact and manifest (SHA/profile/API target).
3. Deploy gateway and test frontend; verify `/health`, `/upstream-health`, CORS,
   no-token 401, forbidden origin 403, forbidden route denial, body limits and
   redirect denial. Negative/multipart cases use mock upstream tests, not real jobs.
4. Run `node scripts/verify_ru_release.mjs --profile ru-test --sha <SHA>`.
5. On Android mobile data and MacBook home internet **without VPN**: open app,
   email login, reload/restored session, history, balance, upload preview, logout.
   Record date, device/browser, network, SHA, pass/fail and sanitized HAR if failed.
   Agent-side internet checks cannot substitute for this network test.
6. Promote the tested source to production, then run verifier with
   `--profile ru-production`. Repeat no-VPN acceptance. Capture gateway revision,
   frontend SHA, previous SHA/profile and test results in release evidence.

Because RU test shares production data, do not use real customer accounts,
change balances, reset data, send many OTPs or run paid generation as a routine
smoke test. Use a designated test account; generation requires separate approval.
An OTP rate-limit response is an auth-provider limit, not proof of gateway failure.
Do not weaken rate limits or CAPTCHA to make tests pass.

## Logs and diagnostics

Gateway emits JSON request ID, method, route template, status and time to response
headers. Request/response bodies, bearer tokens, OTPs and query strings are not
logged. Streaming completion time is not inferred from header timing. Correlate
`X-Request-Id` with backend logs when available; backend-generated IDs may differ.
Frontend `version.json` and gateway `/health` identify deployed components.
Empty static-host runtime logs are not evidence that backend requests succeeded.
Never ask users to export HAR with sensitive data; sanitize bodies as well as headers.

## Rollback and maintenance

Before release, record each app's previous commit and build environment. Roll back
Timeweb to that exact commit **with its matching environment variables**; a new
profile must not be used with an old artifact. Roll back Deno to its recorded
revision or redeploy the previous reviewed gateway SHA. Verify health, version,
profile, auth and history afterward. No database rollback is needed for this scope.
Keep test app and gateway-test for future releases; delete only confirmed-unused
experiments after inventory and explicit permanent-deletion approval. Do not
remove Vercel, DNS records, bots or the current rollback version during cleanup.

Deno is a temporary routing dependency. Track replacement separately before the
announced Deploy end-of-service window; review the official notice, not an assumed
permanent free-tier guarantee: https://deno.com/blog/cloudflare .

Timeweb request spending limit is intentionally unset at the owner's request;
remind the owner at release completion. No paid VPS or CDN is created by this pipeline.

## Operator commands

After merge and green CI (replace SHA with the full tested commit):

```sh
gh workflow run deno-release.yml --ref staging -f profile=ru-test -f commit=SHA
gh workflow run ru-release.yml --ref main -f profile=ru-test -f operation=release -f commit=SHA -f gateway_sha=SHA
# Complete manual no-VPN acceptance before promotion.
gh workflow run deno-release.yml --ref main -f profile=ru-production -f commit=SHA
gh workflow run ru-release.yml --ref main -f profile=ru-production -f operation=release -f commit=SHA -f gateway_sha=SHA -f production_tested_sha=TESTED_SHA
```

The frontend workflow is dispatched from main but validates the selected source
against staging for ru-test and main for production. Production additionally
requires the currently served accepted test SHA, with no runtime/build source
changes since that test. Separate gateway release is completed first.

For rollback, dispatch ru-release with operation=rollback, the prior full SHA,
its matching gateway SHA, and snapshot_run_id/snapshot_sha of the release being
undone. The snapshot restores old managed settings, including legacy targets.
Timeouts do not trigger automatic rollback: inspect the still-running deploy
before dispatching another operation. Artifacts/snapshots are retained 30 days.

Render automatic deployment policy: `autoDeployTrigger=checksPass`; CI runs on
main/staging pushes as well as PRs. Reference: https://render.com/docs/deploys .

## Deferred gateway alternative

Owner decision on 2026-11-03: retain Deno for the current rollout. Evaluate a
Cloudflare Worker separately before Deno's end-of-service window. Require Android
and MacBook no-VPN tests, responses above 16 KiB, uploads and image downloads;
do not replace the working gateway solely on a small health response.

## Next phase: frontend loading optimization

Owner approved on 2026-11-03; start after the Deno/Timeweb rollout and no-VPN
acceptance. Necessary test requests remain authorized. Do not change hosting as
part of this optimization.

1. Record baseline HAR/resource timing on Android and MacBook: cold cache and
   repeat visit, logged out and with a restored session. Count Timeweb HTTP
   requests separately from Deno, Supabase and Turnstile. Source-graph estimates
   (roughly 40–50 requests) are not measured browser results.
2. Bundle JS/CSS with explicit cache keys and split non-home routes so history,
   wallet, fitment and help code loads when needed. Preserve auth bootstrap,
   routing, saved drafts and error recovery; retain the separate Vercel build.
3. Resize/compress images, provide appropriate WebP/AVIF variants where useful,
   and defer below-the-fold pictures. Do not lazy-load the primary visible image.
4. Cache immutable versioned assets; keep HTML and runtime configuration current.
   Avoid re-downloading unchanged modules on repeat visits.
5. Show the home shell without waiting for account/API requests; preserve clear
   timeout/retry states and avoid flashes of legacy UI.
6. Compare before/after evidence on the same devices/networks. Initial target:
   15–25 cold-load Timeweb requests, subject to baseline validation; report actual
   transferred bytes and startup time rather than promising unmeasured speedups.
   Require email login/session/history/balance/upload regression checks. Paid
   generation remains a separately authorized acceptance test.

Deliver as a separate PR/release with artifact SHA and rollback. Estimate costs
from measured per-visit requests using the current provider tariff; do not equate
one page view to one billed request or attribute all traffic to agent tests.
