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
| Current frontend alias | staging production deployment from merged PR #97 |
| Current frontend deployment | Ready; explicit nested routes share `fitment-proxy` |

## Evidence collected in this pass

| Scenario | Expected | Observed | Status |
| --- | --- | --- | --- |
| Infrastructure health | staging backend and dependencies available | Render `/health` 200; `/health/full` 200; Postgres and Redis alive | PASS |
| Auth | authenticated Telegram session | `@nick_elixir` session established in staging UI | PASS |
| Result → Fitment | authenticated overview loads | Existing Porsche Cayenne result opened; overview request 200 and Fitment UI rendered | PASS |
| Live catalogue route | catalogue request reaches backend | `GET /api/backend/jobs/{id}/fitment/catalogue/regions` returned 200 with live regions | PASS |
| Render/backend separation | Render receives catalogue request | Response carried Render/uvicorn headers; route reached staging backend | PASS |
| Parser fallback | legacy unsupported URL may return safe 422/manual fallback | Existing resolver request returned expected 422 | PASS |
| Browser console | no critical errors | No critical browser console errors observed | PASS |

## Corrective action

PR #97 (`fix(webapp): proxy nested Fitment routes`) initially exceeded the
Vercel Hobby limit by adding three functions. The corrective commit consolidates
all nested catalogue/variant paths into the existing `fitment-proxy`, keeping
the deployment at 12 functions. GitHub CI and Vercel staging deployment pass;
the live catalogue request was re-tested successfully.

## Mandatory matrix status

The proxy deployment blocker is closed. The remaining technical Standard
Fitment matrix still requires execution from the live catalogue context; no
scenario is marked PASS based on local fixtures or the frozen prototype.

| Scenario | Status |
| --- | --- |
| Save-before-lookup; single/multiple modification | PENDING — catalogue route now passes; matrix not yet run |
| Exact/larger DIA/PCD mismatch/missing ET/ET outside range | BLOCKED — no confirmed live modification/RimSpec context |
| Worker lifecycle; stale Vehicle/RimSpec; staggered | BLOCKED — no valid live check can be created |
| Fitment → Rendering → Fitment | BLOCKED — current frontend cannot complete catalogue flow |
| 401 restoration/no replay | BLOCKED — safe authenticated expiry injection not available in this run |
| Provider failure boundary | BLOCKED_UNSAFE_TO_INJECT — no safe staging injection configured |
| Mobile full happy path | BLOCKED — catalogue flow stops before technical check |

## Release decision

`FITMENT_BETA_READY = NO`

The Vercel function-limit blocker is resolved and the live catalogue route is
healthy. Continue the mandatory matrix from the existing authenticated
context. Production Render was not modified.
