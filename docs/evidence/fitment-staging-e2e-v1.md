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

`FITMENT_IMPLEMENTATION_READY = YES`

The Vercel function-limit blocker is resolved and the live catalogue route is
healthy. The implementation is ready; beta remains deferred until the
post-Phase 08 Generation Provider revalidation. Production Render was not
modified.

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

The regression guard in `tests/test_wheel_size_square_setup.py` also covers a
same-pair stock/non-OE conflict: stock ET40 remains the authoritative 40–40
reference when non-OE ET45 is present; the values are not widened to 40–45.

## 2026-08-29 RimSpec/Vehicle state-isolation follow-up

The first live A attempt after the frontend isolation fix exposed a separate
backend edge case: a RimSpec-only PATCH omitted `vehicle`, but the save handler
still entered the partial vehicle-map branch and later indexed the missing
`market` key.  This produced a Render 500 and was corrected by `ba26545`
(`fix(fitment): accept rim-only saves for confirmed vehicles`), merged to
`staging` as `f7da80ff35a519dea55032c6cf514e36fe68d777`.  The guard now enters
the unchanged-vehicle path only when a vehicle payload is actually present.

| Field | Evidence |
| --- | --- |
| Local gate before deploy | `299 passed, 3 skipped`; `ruff check .` PASS; `ruff format --check .` PASS; `node --check webapp/app.js` PASS; `git diff --check` PASS |
| Render staging deployment | `dep-da9alkoae00c73aglap0`, `live` |
| Render deployed SHA | `f7da80ff35a519dea55032c6cf514e36fe68d777` |
| Render health | `/health=200`; `/health/full=200`; `db=alive`; `redis=alive` |
| Vercel staging deployment | Existing `dpl_2oKqd8hami9gnPP9hxxHn9iezQDY`, `Ready`; no new frontend deployment was required for this backend-only patch |
| Vercel source SHA | `e9dbf5153f639c62bb90f9598d9fc10ffbd3b160` (frontend isolation fix already deployed) |
| Staging frontend backend target | `https://dream-wheels-ai-robokassa-staging.onrender.com`; alias `/api/backend/health/full=200` with `x-render-origin-server: uvicorn`, `db=alive`, `redis=alive` |
| Redis | No manual flush; the normalized-profile versioned key remained in use |

### Authenticated Lexus A/B/C sequence

The sequence used one authenticated staging context for Lexus RX350 AL30,
Russia+, 2023, provider modification `01e91c5fa7`, with no Vehicle
re-selection, lookup, or re-apply between checks.  The Vehicle identity stayed
`f775db8b-41b0-439c-b6a1-fb8cfd9ff7a4`, revision `10`; the RimSetup stayed
`7ebd98a6-3401-469a-ae45-5b290549bde9`.

| Check | Rim edit | Vehicle revision | Rim revision | Modification | Result |
| --- | --- | ---: | ---: | --- | --- |
| A `1fda44c5-a8d6-4166-89c0-74915343ee43` | exact DIA `60.1`, 19×8J, ET40 | 10 | 16 | `confirmed` | `compatible`, `is_current=true` |
| B `ad53beeb-3d33-43a0-911b-5cb63e21dbaa` | DIA only `60.1 → 74.1` | 10 → 10 | 16 → 18 | preserved `confirmed` | `compatible_with_conditions`, `hub_rings_required`, `is_current=true` |
| C `7651120f-8002-434d-a687-827f7092d809` | DIA `74.1 → 60.1`, ET `40 → 45` | 10 → 10 | 18 → 20 | preserved `confirmed` | `unknown`, `et_outside_reference_range`, `is_current=true` |

After B, Check A was historical (`is_current=false`); after C, Check B was
historical (`is_current=false`).  The authoritative C response contained
`rim_et_mm=45`, `reference_et_min_mm=40`, and `reference_et_max_mm=40` on both
axles.  The A response contained no `vehicle_reference_offset_missing` and
returned the captured provider-backed exact reference:
`source_offsets_mm=[40]`, `et_min_mm=40`, `et_max_mm=40`,
`raw_response_ref=sha256:ef5d5422b0c0f261f453156b29105fbf5425eb11568d3c36012b28fc44627c0d`.

The live C response also preserved the frozen API semantics (`missing_fields`
retains the legacy `offset_et` diagnostic while the authoritative reason is
`et_outside_reference_range`); no verdict rule was changed.

Network capture of the initial exact RimSpec save showed the PATCH body had no
`vehicle` member.  The B/C saves used the same frontend RimSpec-only path, and
the backend regression tests assert that no vehicle-identity UPDATE occurs:
`test_rim_only_save_preserves_revision_bound_modification_from_stale_vehicle_form`
and `test_rim_only_save_without_vehicle_payload_preserves_confirmed_modification`.
The negative invariant remains covered by
`test_each_core_vehicle_change_invalidates_current_modification`.

`RIMSPEC_VEHICLE_STATE_ISOLATION = PASSED`
`LEXUS_A_B_C_LIVE = PASSED`
`SLICE_7_CROSS_FLOW_STAGING_E2E = IN_PROGRESS`
`FITMENT_BETA_READY = NO`

The in-progress marker above is historical for the state-isolation follow-up;
the final classification is recorded in the completion section below.

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

## 2026-08-29 Final mandatory Slice 7 completion pass

The earlier matrix at the top of this document is retained as chronology from
before the normalized-profile cache fix, state-isolation fixes, and mobile CSS
fixes.  The matrix below is the authoritative reconciliation for the current
staging state.

### Deployment and infrastructure

| Field | Evidence |
| --- | --- |
| Current staging backend SHA | `5423418a770d614210e0a0f21dc2baad66a59b00` (Render deployment `dep-da99bne7bikc73ape2a0`) |
| Current frontend SHA | `689d2bb8b284348fdc0004faac857c317518e199` (Vercel deployment `dpl_2LdA4MSQtM5wk18QtU3MrPQucQkr`, `READY`) |
| Staging alias | `https://dream-wheels-ai-webapp-staging.vercel.app` → `dream-wheels-ai-webapp-staging-4ts7ofc4w.vercel.app` |
| Backend target | `https://dream-wheels-ai-robokassa-staging.onrender.com` (workflow guard and proxy health evidence) |
| Render health | `/health=200`; `/health/full=200`; `db=alive`; `redis=alive` |
| Production changed | `NO` |
| Manual Redis flush | `NO`; versioned normalized-profile key bypassed stale cache |

The coordinated staging workflow run `33249461966` succeeded.  It created
exactly one staging Vercel artifact and skipped production, admin, and manual
preview jobs.  The alias `/api/backend/health/full` returned the Render
staging health payload; no production backend URL was used.

### Reconciled live matrix

| Scenario | Final status | Evidence |
| --- | --- | --- |
| Single modification | `PASS` | Live provider cascade/explicit apply plus `test_single_auto_confirm_is_idempotent_and_no_match_clears_current_selection` |
| Multiple modifications | `PASS` | Authenticated Toyota/Camry and Exeed/RX cascades with explicit variant apply |
| Exact Lexus reference | `PASS` | `source_offsets_mm=[40]`, `et_min_mm=40`, `et_max_mm=40`, raw ref `sha256:ef5d5422b0c0f261f453156b29105fbf5425eb11568d3c36012b28fc44627c0d` |
| Lexus A — exact DIA/ET | `PASS` | Check `1fda44c5-a8d6-4166-89c0-74915343ee43`: `compatible`, current |
| Lexus B — larger DIA | `PASS` | Check `ad53beeb-3d33-43a0-911b-5cb63e21dbaa`: `compatible_with_conditions`, `hub_rings_required`, current |
| Lexus C — ET outside exact reference | `PASS` | Check `7651120f-8002-434d-a687-827f7092d809`: `unknown`, `et_outside_reference_range`, reference `40–40`, current |
| PCD mismatch / missing ET boundaries | `PASS` | Existing authenticated and API matrix evidence; missing evidence remains technical `unknown` |
| Staggered setup | `PASS` | Kia setup `9bcef738-339b-482e-a548-939c0396a911`, independent front/rear specs |
| Rear-only edit invalidates old check | `PASS` | Old `ec53bfbc-c0c3-4418-b6dc-8d1fa3038bce` became stale; new current check `7b98c364-3cd0-4e32-b3a8-2dff5e15b125` |
| Stale RimSpec currentness | `PASS` | A stale after B; B stale after C; immutable snapshot identity used |
| Stale Vehicle currentness | `PASS` | `test_each_core_vehicle_change_invalidates_current_modification` |
| Stock ET40 vs non-OE ET45 | `PASS` | `test_stock_offset_wins_over_non_oem_for_same_exact_pair`; remains `40–40`, never `40–45` |
| Mobile 390×844 happy path | `PASS` | Authenticated Kia Fitment form and completed Check at exact 390×844; `scrollWidth=390`, no console errors; controls remained usable |
| Fitment → Rendering → Fitment fresh round-trip | `BLOCKED_BY_EXTERNAL_RENDER_PROVIDER` | Legitimate new jobs `c61d985d-2443-459a-af36-7ab462c0ddf2` and `c30f5511-36d2-465f-8fe1-dccd56db1cac` reached the external flow but failed before output with `PARTNER_API_CLOSED`; this is not an unresolved Fitment implementation defect |
| 401 live restoration | `ACCEPTED_WITH_AUTOMATED_COVERAGE` | No safe staging expiry seam; automated draft persistence/no-replay/overview-first/current-pending coverage passes |
| Provider outage live injection | `ACCEPTED_WITH_AUTOMATED_COVERAGE` | No safe staging fault-injection seam; operational failure boundary is covered by API tests |
| Parser/source regression | `PASS` | Wheel-Size fixtures, source resolver, and pair-level stock precedence tests |

### Session-restoration and failure-boundary decisions

401 automated coverage is provided by
`test_ordinary_return_is_silent_but_401_restoration_is_explicit`,
`test_401_stops_requests_and_never_replays_a_mutation`,
`test_navigation_tears_down_requests_and_resumes_only_current_pending_check`,
and `test_fitment_reauth_prompt_preserves_the_unsaved_form_for_the_same_job`.
No safe staging method exists to expire the authenticated session without
mutating production-like state, so live 401 injection is formally accepted as
blocked for this pass; the release remains beta-blocked.

Provider failure taxonomy and the invariant that `failed` never becomes
technical `unknown` are covered by `test_create_check_records_provider_failure`
and the Fitment checks/jobs API suites.  A live provider outage was not injected
because no safe staging seam is configured; this is a formal test-environment
decision, not a claim that the live outage scenario passed.

The fresh rendering attempt was a real user flow and did not trigger any
automatic Fitment lookup, resolver, or Check.  The external Render provider
returned `PARTNER_API_CLOSED`, so the round-trip is `NOT_AVAILABLE` until that
provider is restored or a safe staging rendering fixture is supplied.

### Final status for this pass

```ini
FINAL_MANDATORY_MATRIX = COMPLETE_WITH_ACCEPTED_LIMITATIONS
SLICE_7_CROSS_FLOW_STAGING_E2E = COMPLETE_WITH_ACCEPTED_LIMITATIONS
PHASE_07_FITMENT = COMPLETE
FITMENT_IMPLEMENTATION_READY = YES
FITMENT_BETA_READY = NO
NEXT = Phase 08 — Generation Provider
```

## Accepted limitations

The three deferred scenarios are intentionally not labelled `PASS`:

1. `FRESH_FITMENT_RENDERING_ROUNDTRIP = BLOCKED_BY_EXTERNAL_RENDER_PROVIDER`.
   Fresh jobs reached the external rendering flow and failed with
   `PARTNER_API_CLOSED` before a result existed. Re-test after Generation
   Provider availability is restored; this is not an unresolved Fitment defect.
2. `401_LIVE_RESTORATION = ACCEPTED_WITH_AUTOMATED_COVERAGE`. No safe staging
   expiry seam exists. Preserve automated proof of draft persistence, no
   mutation replay, authoritative overview-first restore, and current pending
   polling only.
3. `PROVIDER_OUTAGE_LIVE_E2E = ACCEPTED_WITH_AUTOMATED_COVERAGE`. No safe
   staging fault-injection seam exists. Preserve proof that provider
   operational failure becomes `execution_status=failed` and never technical
   `verdict=unknown`.

## POST_PHASE_08_REVALIDATION

- Restore Generation Provider availability.
- Execute one fresh `Rendering → Fitment → Rendering → Fitment` round-trip.
- Confirm no automatic save, catalogue lookup, resolver, or Standard Check
  replay.
- If the round-trip passes, promote `FITMENT_BETA_READY` according to the
  release gate.
