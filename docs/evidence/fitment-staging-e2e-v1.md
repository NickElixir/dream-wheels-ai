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
| Current frontend alias | staging production deployment from merged PR #106 |
| Current frontend deployment | `https://dream-wheels-ai-webapp-staging-3r9lj1tv5.vercel.app` (Ready Production) |

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
| Missing RimSpec ET | Persisted partial Toyota/Camry RimSpec was accepted; Check completed `unknown` with `reason_code=rim_offset_missing` and `missing_fields=["offset_et"]` | PASS |
| Exact compatible verdict | Exeed/RX and Toyota/Camry references returned no provider ET interval, so the engine conservatively stopped at `unknown` | BLOCKED — real Wheel Size staging data has no reference offset for tested variants |
| Wheel Size outage operational failure | No safe staging fault injection is configured | BLOCKED_UNSAFE_TO_INJECT |

## Corrective action

PR #97 (`fix(webapp): proxy nested Fitment routes`) initially exceeded the
Vercel Hobby limit by adding three functions. The corrective commit consolidates
all nested catalogue/variant paths into the existing `fitment-proxy`, keeping
the deployment at 12 functions. GitHub CI and Vercel staging deployment pass;
the live catalogue request was re-tested successfully.

## Mandatory matrix status

The proxy deployment blocker is closed. The authenticated matrix below is
based on live catalogue, persistence, worker and Check responses; scenarios
that require provider data or fault injection remain explicitly bounded.

| Scenario | Status |
| --- | --- |
| Save-before-lookup; single/multiple modification | PASS — authenticated Toyota/Camry and Exeed/RX provider cascades and explicit variant apply completed |
| Exact/larger DIA/PCD mismatch/missing ET/ET outside range | PARTIAL — PCD mismatch, larger-bore condition and both missing-ET unknown boundaries completed; exact compatible and ET-range cases await provider references |
| Worker lifecycle; stale Vehicle/RimSpec; staggered | PARTIAL — queued/processing/completed and stale RimSpec currentness completed; staggered branch remains |
| Fitment → Rendering → Fitment | NOT_EXECUTED — existing render result was used as the entry point; a fresh round-trip render was not created during this pass |
| 401 restoration/no replay | BLOCKED — safe authenticated expiry injection not available in this run |
| Provider failure boundary | BLOCKED_UNSAFE_TO_INJECT — no safe staging injection configured |
| Mobile full happy path | NOT_EXECUTED — desktop authenticated matrix continued; 390px pass remains separate visual gate |

## Release decision

`FITMENT_BETA_READY = NO`

The Vercel function-limit blocker is resolved and the live catalogue route is
healthy. Continue the mandatory matrix from the existing authenticated
context. Production Render was not modified.

## Wheel-Size reference gate — Lexus / BMW / Kia

The live provider payloads use `rim_offset` (not `offset` or `et`). The
pre-fix staging backend therefore exposed no ET interval even when the raw
provider record contained one. The raw records and mapped state are captured
here so the gate is auditable:

| Candidate | Provider context | Raw provider-derived reference | Backend mapping observed before fix | Mapping after `950026e` parser fix |
| --- | --- | --- | --- | --- |
| Lexus RX350, AL30, Russia+, 2023 | `lexus/rx/russia`, modification `01e91c5fa7`; technical `5×114.3`, DIA `60.1` | stock front `8Jx19 ET40` (`rim_diameter=19`, `rim_width=8`, `rim_offset=40`); rear empty | `offset_references=[]`; live Check returned `vehicle_reference_offset_missing` | front `19×8J → et_min_mm=40, et_max_mm=40`, `source_offsets_mm=[40]` |
| BMW 5 Series F10/F11 LCI, 520d, Europe, 2014 | `bmw/5-series/eudm`, generation `115f895031`, modification `0672911fa5`; technical `5×120`, DIA `72.6` | stock front `8Jx17 ET30`; additional records repeat `8Jx17 ET30` and list non-OE `18–20` sizes | `offset_references=[]` (same `rim_offset` shape) | front `17×8J → et_min_mm=30, et_max_mm=30`, `source_offsets_mm=[30]` |
| Kia Seltos 2.0 MPi, Russia+, 2020 | `kia/seltos/russia`, generation `10c72a9d42`, modification `c17536e6ff`; technical `5×114.3`, DIA `67.1` | stock front `7Jx17 ET50`; non-OE `6.5Jx16 ET44`, `7.5Jx18 ET52` | `offset_references=[]` (same `rim_offset` shape) | front `17×7J → et_min_mm=50, et_max_mm=50`, `source_offsets_mm=[50]` |

The parser fix is merged to `staging` and deployed on Render staging. The
authenticated Vercel alias used by the current run routes through the existing
`/api/backend` proxy to the Render staging service. No new Vercel deployment
was created for this verification.

## 2026-08-29 normalized-profile cache-fix deployment

| Field | Evidence |
| --- | --- |
| Root cause | stale unversioned normalized-profile Redis cache (`ws:profile:<params>`) retained profiles produced before `rim_offset` normalization |
| Fix | versioned profile key and normalization constant `wheel_size_profile_v2`; raw provider offsets are preserved as exact decimals |
| Render staging deployment | `dep-da99bne7bikc73ape2a0`, `live` |
| Deployed backend SHA | `5423418a770d614210e0a0f21dc2baad66a59b00` (merge of fix `6640936`) |
| Health | `/health` 200; `/health/full` 200 with `db=alive`, `redis=alive` |
| Manual Redis flush | not required; the versioned key bypassed the stale entry |
| Existing Vercel alias | `dream-wheels-ai-webapp-staging.vercel.app`; proxy health response carries Render/uvicorn headers and returns 200 |

The live Wheel-Size API response for Lexus RX350 AL30 (`01e91c5fa7`) contains
`rim_offset=40` for the stock front `19x8` record. Its canonical payload hash
is `sha256:ef5d5422b0c0f261f453156b29105fbf5425eb11568d3c36012b28fc44627c0d`.
The deployed normalizer maps it to `source_offsets_mm=[40]` and
`et_min_mm=et_max_mm=40` (and mirrors the square profile to the rear axle).

The authenticated staging UI produced the expected Lexus ET40 result
(`Совместимо`) after the deployment. Direct read-only staging DB verification
captured Check `6e562fa0-1d7d-4ff2-bb53-a2e1cee8b69b` as `completed` /
`compatible`; its authoritative `evaluation_snapshot.normalized_profile`
contains `raw_response_ref=sha256:ef5d5422b0c0f261f453156b29105fbf5425eb11568d3c36012b28fc44627c0d`,
the 19x8 stock offset reference `source_offsets_mm=[40.0]`, and
`et_min_mm=et_max_mm=40.0`. The normalizer mirrored the square profile to the
rear axle. The public Check response does not expose `evaluation_snapshot`, so
this snapshot evidence was collected from the staging database using the
read-only service connection.

The same authenticated UI session currently has a stale draft/source-resolver
conflict after editing the center bore: saving the B variant clears the
revision-bound vehicle selection and prevents a valid new Check from being
submitted. Consequently live B/C Check ids are not claimed here. The
deterministic engine was exercised locally against the live Lexus payload and
returns the required outcomes: A `compatible`, B
`compatible_with_conditions`/`hub_rings_required`, C `unknown`/
`et_outside_reference_range` with reference 40–40. Live B/C checks still require
a fresh authenticated UI context because the current draft/source-resolver
state clears the revision-bound vehicle selection when the center bore is
edited; they are not claimed as staging Check results.

## Live provider payload hashes (diagnostic smoke)

These are hashes of the API `data` arrays used by the normalizer (canonical
JSON, sorted keys, compact separators), not hashes of public HTML pages:

| Query | Provider result | Exact stock pair | `raw_response_ref` |
| --- | --- | --- | --- |
| `lexus/rx/russia`, 2023, `01e91c5fa7` | RX350 / AL30 | 19x8 ET40 | `sha256:ef5d5422b0c0f261f453156b29105fbf5425eb11568d3c36012b28fc44627c0d` |
| `bmw/5-series/eudm`, 2014, `0672911fa5` | **520d** / VI LCI (F10/F11) (the supplied slug does not return 520i) | 17x8 ET30 | `sha256:b8518f71893e052045664f9eee9397bfa9959d268eec79dbaa6b483a913cdb00` |
| `kia/seltos/russia`, 2020, `c17536e6ff` | 2.0 MPi / I (SP2) | **17x7 ET50** (no 17x6.5 record in this response) | `sha256:6467b77d90ea7fd6a6980e6e574830501a1b0daefc0e1cb2c15ccefc8fdf7309` |

BMW's response also contains non-OE records for the same 17x8 pair, but they
carry the same ET30 scalar; the stock evidence class remains authoritative.
Kia's captured payload does not justify a 17x6.5 expectation.
