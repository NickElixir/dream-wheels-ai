# Fitment staging E2E v1 — evidence record

## Run identity

| Field | Value |
| --- | --- |
| Date | 2026-08-27 |
| Environment | Staging only |
| Frontend staging project | `dream-wheels-ai-webapp-staging` |
| Backend deployment/version | `0868618` (PR #101), live |
| Worker/health | `/health` 200; `/health/full` 200 (`db=alive`, `redis=alive`) |
| Authenticated method | Live Telegram session, `@nick_elixir` |
| Current frontend alias | staging production deployment from merged PR #103 |
| Current frontend deployment | `https://dream-wheels-ai-webapp-staging-9as7xobgg.vercel.app` (Ready Production) |

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

## Mandatory matrix evidence — authenticated continuation

| Scenario | Observed evidence | Status |
| --- | --- | --- |
| Provider cascade `regions → makes → models → years` | Russia+ returned 200; Toyota/Camry catalogue returned live makes, models and years | PASS |
| Vehicle save before lookup | Toyota/Camry 2020 saved first; lookup was rejected until the vehicle was confirmed, then returned 5 provider variants | PASS |
| Multiple modification selection | Exeed/RX 2023 returned 13 variants; Toyota/Camry 2020 returned 5 variants; explicit variant apply returned 200 and `modification_state=confirmed` | PASS |
| RimSpec source resolver and exact controls | Koleso.ru resolver returned exact `5×120`, `19`, `10J`, `74.1`, `ET45`; manual override path was re-tested after PR #103 | PASS |
| Async Check lifecycle and Vercel polling | `POST /fitment/checks` returned 200; polling `GET /fitment/checks/{id}` returned 200 through Vercel and reached `completed`; `is_current=true` | PASS |
| Historical currentness after context change | Changing the persisted RimSpec revision made the prior completed Check return 200 with `is_current=false` while retaining its `incompatible` verdict | PASS |
| PCD mismatch | Exeed/RX check returned `incompatible`, `reason_code=pcd_mismatch` for both axles | PASS |
| Larger-bore conditional | Check returned `hub_rings_required` with vehicle hub `65.1` and rim bore `74.1` | PASS — condition observed; final verdict remained gated by missing provider ET |
| Missing provider ET reference | Exact Exeed/RX size and PCD returned safe `unknown`, `vehicle_reference_offset_missing`, not a compatibility claim | PASS |
| Exact compatible verdict | Exeed/RX and Toyota/Camry references returned no provider ET interval, so the engine conservatively stopped at `unknown` | BLOCKED — real Wheel Size staging data has no reference offset for tested variants |
| Wheel Size outage operational failure | No safe staging fault injection is configured | BLOCKED_UNSAFE_TO_INJECT |

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
| Save-before-lookup; single/multiple modification | PASS — authenticated Toyota/Camry and Exeed/RX provider cascades and explicit variant apply completed |
| Exact/larger DIA/PCD mismatch/missing ET/ET outside range | PARTIAL — PCD mismatch, larger-bore condition and safe missing-provider-ET `unknown` completed; exact compatible and ET-range cases await provider references |
| Worker lifecycle; stale Vehicle/RimSpec; staggered | PARTIAL — queued/processing/completed and stale RimSpec currentness completed; staggered branch remains |
| Fitment → Rendering → Fitment | BLOCKED — current frontend cannot complete catalogue flow |
| 401 restoration/no replay | BLOCKED — safe authenticated expiry injection not available in this run |
| Provider failure boundary | BLOCKED_UNSAFE_TO_INJECT — no safe staging injection configured |
| Mobile full happy path | NOT_EXECUTED — desktop authenticated matrix continued; 390px pass remains separate visual gate |

## Release decision

`FITMENT_BETA_READY = NO`

The Vercel function-limit blocker is resolved and the live catalogue route is
healthy. Continue the mandatory matrix from the existing authenticated
context. Production Render was not modified.
