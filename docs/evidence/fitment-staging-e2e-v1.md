# Fitment staging E2E v1 — evidence record

## Run identity

| Field | Value |
| --- | --- |
| Date | 2026-08-27 |
| Environment | Staging only |
| Frontend staging project | `dream-wheels-ai-webapp-staging` |
| Backend deployment/version | `1889885` (PR #96), live |
| Worker/health | `/health` 200; `/health/full` 200 (`db=alive`, `redis=alive`) |
| Authenticated method | Live Telegram session, `@nick_elixir` |
| Current frontend alias | `20260827-fitment-slice-7` (before PR #97) |
| Current frontend deployment | Does not contain PR #97 routing fix |

## Evidence collected in this pass

| Scenario | Expected | Observed | Status |
| --- | --- | --- | --- |
| Infrastructure health | staging backend and dependencies available | Render `/health` 200; `/health/full` 200; Postgres and Redis alive | PASS |
| Auth | authenticated Telegram session | `@nick_elixir` session established in staging UI | PASS |
| Result → Fitment | authenticated overview loads | Existing Porsche Cayenne result opened; overview request 200 and Fitment UI rendered | PASS |
| Live catalogue route | catalogue request reaches backend | `GET /api/backend/jobs/{id}/fitment/catalogue/regions` returned Vercel 404 `NOT_FOUND` before Render | BLOCKED |
| Render/backend separation | Render receives catalogue request | No upstream request possible because Vercel route terminated at edge | BLOCKED |
| Parser fallback | legacy unsupported URL may return safe 422/manual fallback | Existing resolver request returned expected 422 | PASS |
| Browser console | no critical errors | No critical browser console errors observed | PASS |

## Corrective action

PR #97 (`fix(webapp): proxy nested Fitment routes`) adds explicit Vercel
proxies for catalogue and vehicle-variant routes and regression coverage. The
GitHub CI `lint-and-test` check passes. Vercel staging deployments for the PR
currently fail after `Build Completed` at `Deploying outputs… status Error`, so
the staging alias has not advanced and the fix cannot yet be re-tested live.

## Mandatory matrix status

The technical Standard Fitment matrix is not executed from a valid live
catalogue context until the frontend proxy deploy is available. No scenario is
marked PASS based on local fixtures or the frozen prototype.

| Scenario | Status |
| --- | --- |
| Save-before-lookup; single/multiple modification | BLOCKED — catalogue proxy 404 |
| Exact/larger DIA/PCD mismatch/missing ET/ET outside range | BLOCKED — no confirmed live modification/RimSpec context |
| Worker lifecycle; stale Vehicle/RimSpec; staggered | BLOCKED — no valid live check can be created |
| Fitment → Rendering → Fitment | BLOCKED — current frontend cannot complete catalogue flow |
| 401 restoration/no replay | BLOCKED — safe authenticated expiry injection not available in this run |
| Provider failure boundary | BLOCKED_UNSAFE_TO_INJECT — no safe staging injection configured |
| Mobile full happy path | BLOCKED — catalogue flow stops before technical check |

## Release decision

`FITMENT_BETA_READY = NO`

Blocker: Vercel staging deployment of PR #97 fails at the platform deploy
step, leaving the authenticated staging alias without the explicit nested
Fitment proxy routes. Re-test the catalogue request after a successful
frontend deployment, then continue the mandatory matrix from the existing
authenticated context. Production Render was not modified.
