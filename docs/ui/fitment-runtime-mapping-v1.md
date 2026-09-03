# Standard Fitment V1 — Runtime Mapping Audit

## Checkpoint and authority

```text
STANDARD_FITMENT_ARCHITECTURE = FROZEN
STANDARD_FITMENT_UI = FROZEN
RUNTIME_MAPPING = COMPLETE
SLICE_1_STANDARD_ENGINE_CORRECTION = COMPLETE
SLICE_2_VEHICLE_CATALOGUE_STATE_API = COMPLETE
SLICE_3_MODIFICATION_PERSISTENCE = COMPLETE
SLICE_4_RIMSPEC_RIMSETUP_STATE = COMPLETE
SLICE_5_CHECK_LIFECYCLE_CURRENTNESS = COMPLETE
SLICE_6_FROZEN_FRONTEND = COMPLETE
SLICE_7_CROSS_FLOW_STAGING_E2E = BLOCKED
IMPLEMENTATION = IN_PROGRESS

VEHICLE_CATALOGUE_API = IMPLEMENTED
VEHICLE_AUTHORITATIVE_STATE = IMPLEMENTED
SAVE_BEFORE_LOOKUP_INVARIANT = ENFORCED
MODIFICATION_STATE = IMPLEMENTED
SELECTION_SOURCE = IMPLEMENTED
POSITIVE_STANDARD_VERDICT_GUARD = ENFORCED
RIMSPEC_FIELD_STATE = IMPLEMENTED
RIMSETUP_STATE = IMPLEMENTED
RIM_SOURCE_IDENTITY = IMPLEMENTED
RIM_SOURCE_INVALIDATION = ENFORCED
PARTIAL_RIMSPEC_STANDARD_CHECK = ENABLED
STAGGERED_RIMSETUP = IMPLEMENTED
CHECK_LIFECYCLE = IMPLEMENTED
CHECK_PENDING_STATES = IMPLEMENTED
CHECK_ERROR_TAXONOMY = IMPLEMENTED
CHECK_RETRY_METADATA = IMPLEMENTED
CHECK_CURRENTNESS = IMPLEMENTED
CHECK_HISTORY = IMPLEMENTED
FROZEN_FRONTEND_STATE_ADAPTER = IMPLEMENTED
FROZEN_FRONTEND_CONTROLS = IMPLEMENTED
FITMENT_FRONTEND_POLLING = IMPLEMENTED
CROSS_FLOW_DRAFT_RESTORATION = IMPLEMENTED
RENDER_FITMENT_DECOUPLING = IMPLEMENTED
AUTHENTICATED_STAGING_E2E = PENDING

NEXT = Deploy Slice 7 to authenticated staging and run the mandatory E2E matrix
BLOCKER = staging frontend is deployment-protected and does not contain this worktree; backend/worker/migrations are not verified
FITMENT_BETA_READY = NO
```

This document began as a runtime audit. It now also records completed runtime
slices against the frozen Standard Fitment UI contract. It does not redefine
the visual prototype or Fitment domain semantics.

Authority remains, in order:

1. [Fitment Verdict V1](../fitment/fitment-verdict-v1.md) for product/domain
   semantics;
2. [Fitment API Contract V1](../fitment-api-contract-v1.md) for the check API;
3. [Standard Fitment UI State Specification V1](fitment-ui-state-spec-v1.md)
   for UI behaviour;
4. [UI Design Code](../ui-design-code.md) and the frozen visual reference
   [standard-fitment-v1.html](../references/standard-fitment-v1.html).

The state specification status has been synchronized with the approved UI
freeze. No behavioural state or visual decision changed in that correction.

## Areas inspected

| Area | Runtime evidence |
| --- | --- |
| Existing web client | `webapp/index.html`, `webapp/app.js`, `webapp/style.css` |
| Fitment overview, save and modification routes | `src/jobs_api.py` |
| Check API and durable snapshots | `src/fitment_checks_api.py`, `migrations/0021_fitment_checks.sql`, `migrations/0022_fitment_evidence_fallbacks.sql`, `migrations/0027_fitment_check_lifecycle.sql` |
| Vehicle/Rim persistence and provenance | `src/identity_service.py`, `migrations/0017_vehicle_rim_identity.sql`, `migrations/0019_fitment_identity_candidates.sql`, `migrations/0020_fitment_change_events.sql`, `migrations/0026_fitment_rim_source_state.sql` |
| Wheel Size client | `src/fitment/providers/wheel_size.py` and provider cache |
| Rim URL resolver | `src/rim_url_resolver.py`, `src/rim_url_extract.py` |
| Deterministic rules | `src/fitment/rules/engine.py`, `checks.py`, `verdict.py`, `src/fitment/schemas.py` |
| Existing automated coverage | `tests/test_jobs_fitment_api.py`, `tests/test_fitment_checks_api.py`, `tests/test_fitment_verdict_evidence.py`, resolver, provider-cache and frontend static tests |

`YES` means the required state is available to the frozen UI without changing
its meaning. `PARTIAL` means a reusable foundation exists but its exposed
state or semantics are insufficient. `NO` means it is absent. `LEGACY_CONFLICT`
means existing code would produce a result forbidden by the frozen contract.

## Main state mapping

| Frozen UI state / family | Runtime source | Backend / API source of truth | Existing implementation | Gap | Required implementation |
| --- | --- | --- | --- | --- | --- |
| `vehicle.empty` | Existing client draft | `GET /jobs/{id}/fitment` → `vehicle_state` | YES (backend) | frontend | Render the explicit state; no local substitute becomes authoritative |
| `vehicle.unconfirmed` | Field candidates | `vehicle_field_states` + `vehicle_state` | YES (backend) | frontend | Render proposals as proposals, never as confirmed evidence |
| `vehicle.confirmed_incomplete` | No explicit client state | Required `make/model/year/region` field confirmation | YES (backend) | frontend | Render the explicit state and clear stale modification context |
| `vehicle.confirmed_ready` | `overview.readiness` plus `provider_readiness` | `vehicle_state=confirmed_ready`; modification remains separate | YES (backend) | frontend | Use authoritative `next_action`; Slice 4 now maps RimSpec state |
| Vehicle form `clean` | Form is reconstructed from overview | Saved overview/revisions | YES | none | A revision/source baseline is captured for transient restoration |
| Vehicle/Rim form `dirty` | Input listeners mutate `state.fitmentForm` | Short-lived session draft only | YES | none | Navigation and 401 preserve a bounded job-scoped draft without treating it as saved |
| Form `saving` | `state.fitmentSaving` | PATCH request in flight | YES | none | Reuse as a transient state, split vehicle and rim if the frozen UI saves separately |
| Form `save_failed` | `state.fitmentError` | HTTP/Pydantic errors as mostly free text | PARTIAL | frontend, api | Preserve dirty fields, map machine error category to inline/form copy and retry CTA |
| Validation `valid` / `invalid` | Browser inputs plus Pydantic validation | `FitmentDetailsUpdateRequest` validates broad numeric ranges | PARTIAL | frontend, api | Add explicit local validation result; do not use `dirty` as invalid; return field-addressable validation errors where server validation applies |
| Authoritative `next_action` | `fitmentNextAction()` | `overview.next_action.kind` | YES | none | The frozen UI renders the server action directly |
| Fitment availability | `fitmentAvailable(job)` | VehicleIdentity + RimSetup; independent from render status | YES | none | No visual try-on action depends on a Fitment verdict |

### Vehicle invariant: save before modification lookup

Slice 2 makes the backend sequence explicit:

```text
validate current make/model/year/region draft
→ persist exactly the provider-validated catalogue values
→ receive the authoritative overview and incremented `vehicle_revision`
→ request modification lookup, which reads that saved revision only
```

`PATCH /jobs/{id}/fitment` performs exact catalogue validation when a complete
core vehicle context is saved. It stores canonical provider-recognizable
make/model/region values, clears an old generation/modification mapping, and
keeps only the exact make/model/region mapping required for the next lookup.
Validation or provider failure returns without writing or invoking lookup.
`POST /vehicle-variants` returns the saved `vehicle_revision`; new catalogue
saves use exact provider slugs, while legacy persisted identities retain a
read-only fuzzy compatibility path.

## Vehicle control mapping

| Frozen control | Current implementation | Existing implementation | Gap | Required implementation |
| --- | --- | --- | --- | --- |
| Region: provider-backed select | `vehicle.market` is still legacy free text in the shipped client | Authenticated `catalogue/regions` endpoint, Russian labels/order and canonical provider value | YES (backend) | frontend | Bind the frozen select to the API; persist the provider value, never a guessed region |
| Year: provider-backed cascading select | `vehicle.year` is still legacy free numeric input | Exact `catalogue/years` endpoint for saved parent selection | YES (backend) | frontend | Bind the select and invalidate dependent draft values on parent changes |
| Make/model | Free text inputs remain in shipped client | Exact `catalogue/makes` / `catalogue/models` endpoints | YES (backend) | frontend | Use constrained options; do not use fuzzy selection in the new flow |
| Cache / provider fault / no data | No UI state | Existing `ProviderCache`; API returns `success`/`no_data` and structured 503 provider categories | YES (backend) | frontend | Render loading, no-data and operational failure as separate states |

The server-owned endpoints are `GET /jobs/{job_id}/fitment/catalogue/regions`,
`/makes`, `/models` and `/years`. They use the existing Wheel Size adapter and
its cache; no provider credential or raw provider payload is exposed to the
client.

### Vehicle Catalogue Editor state-machine amendment — 2026-09-02

The frontend now treats the catalogue as one sequential dependency chain:

```text
market
  → validated makes response
  → validated models response
  → validated years response
```

On a parent change, the client increments a job-local context version,
aborts obsolete requests and keeps the previous child values internally until
the relevant response is available. Each response is accepted only when its
version, request identity and dependency tuple still match the current draft.
After the response is known, valid children are retained and invalid children
plus their descendants are cleared. Models are never requested before the
make response validates the make; years are never requested before the model
response validates the model.

The browser keeps a bounded, expiring session memory under a key containing
the Fitment `job_id`. It remembers the latest coherent market → make → model
→ year chain and may propose it when returning to a previous context. This is
only a convenience draft: every remembered value is matched against the live
catalogue response before restoration, and no memory is shared between jobs
or written to the backend.

The field renderer distinguishes `idle_parent_missing`, `loading`,
`loaded_unselected`, `selected`, `no_data` and `failed`. `no_data` renders a
neutral empty disabled control; provider/auth/transport failure renders an
inline retryable error. Save remains disabled until the selected values are
validated by all four current option sets. Base Vehicle edit and modification
edit are mutually exclusive; the modification group is absent while an
unsaved base draft is open.

## Modification mapping

| Frozen UI state / family | Runtime source | Backend / API source | Existing implementation | Gap | Required implementation |
| --- | --- | --- | --- | --- |
| Lookup `idle` | Empty `state.fitmentVehicleVariants` | None | PARTIAL | frontend | Add an explicit mutually-exclusive lookup state instead of inferring from an empty list |
| Lookup `loading` | `state.fitmentVehicleVariantsLoading` | Request in flight | YES | none | Reuse and render it separately from no-match, failed and auth-expired |
| Lookup `loaded` | Non-empty variants array | `POST /vehicle-variants` returns all items, `total_count`, `has_more=false` | YES (backend) | frontend | Render the complete candidate set; UI pagination remains unnecessary until a bounded API is introduced |
| Lookup `no_match` | Empty array mapped to a message | Explicit `outcome=no_match` | YES (backend) | frontend | Render a distinct no-match state |
| Lookup `failed` | Generic `fitmentError` | Structured 503 provider category | YES (backend) | frontend | Map category to approved copy/retry UI; never render it as technical `unknown` |
| Modification `none` | No explicit client state | Overview returns explicit state and null selection fields | YES (backend) | frontend | Render a normal no-selection state, distinct from provider failure |
| Modification `suggested` | Client list only | Revision-bound state in Wheel Size mapping; candidate items are transient | YES (backend) | frontend | Render explicit selection controls from the current lookup result |
| Modification `confirmed` | Legacy mapping formerly implied readiness | Revision-bound source and canonical selected provider identity | YES (backend) | frontend | Render source and selected identity; use server `next_action` |
| Exactly one candidate | Current UI still asks the user to choose | Server persists exact candidate with `selection_source=wheel_size_single` | YES (backend) | frontend | Present the automatic origin plus change/recheck actions |
| Multiple candidates | Picker is explicit | Server persists only `suggested`; apply revalidates then persists `user` | YES (backend) | frontend | Never infer probability from provider ordering |
| `selection_source` | None | `wheel_size_single` / `user`; `vehicle_recognition` reserved | YES (backend) | frontend | Do not create the reserved source before its quality gate |

Candidate items are deliberately transient: no candidate snapshot is persisted
only for display. Lookup and apply both use the saved vehicle revision as a
concurrency boundary, and apply revalidates the submitted exact candidate
against a fresh provider result. The automatic single path performs the same
revision check before persistence. Legacy mappings without new evidence remain
readable but conservative (`none`).

## RimSpec and RimSetup mapping

| Frozen UI state / family | Runtime source | Backend / API source | Existing implementation | Gap | Required implementation |
| --- | --- | --- | --- | --- |
| Source `none` / `present` | `rim.product_url`, local source drawer | `rim_specs.product_url` | PARTIAL | api, frontend | Expose source identity and source revision independently of values |
| Resolver `idle/resolving/resolved/failed` | `fitmentSourceResolving`, status/tone | `POST /rim-source/resolve` returns draft or safe 422 reason | PARTIAL | frontend | Replace free-text/tone with the four mutually-exclusive state values and mapped parser category |
| Variant `not_applicable/none/selection_required/selected` | `fitmentSourceVariants`, local selected values | Resolver returns `variants`, `selection_required`, `selected_variant_sku` | PARTIAL | persistence, api, frontend | Persist chosen SKU/source revision on save; make selected status durable and keep no-selection separate from no variants |
| Critical field value and source | Local form + `fitmentRimManualFields` | `rim_specs` values and `field_provenance` | PARTIAL | api, frontend | Return a field object or normalized parallel map with exact `value`, `field_state`, `field_source`, confirmation and revision |
| Critical field `missing` | Empty form value/readiness list | Nullable columns and overview `missing_fields` | PARTIAL | api | Retain current data but expose status per diameter, width, PCD pair, ET and DIA |
| Critical field `suggested` | Parser applies values into local form | Resolver candidates/variants are unpersisted | PARTIAL | frontend | Render resolver output as suggestion until user saves/confirms it |
| Critical field `entered` | `fitmentRimManualFields` exists only in page memory | None | NO | persistence, api | Persist a distinction between entered-but-unconfirmed and confirmed if the interaction needs a separate confirmation action |
| Critical field `confirmed` | `field_provenance.is_user_confirmed` | JSONB provenance records it | PARTIAL | api, frontend | Expose field-level status directly; do not collapse it to a single rim label |
| RimSetup `empty/partial/complete_unconfirmed/confirmed_ready` | Generic readiness + one `fitmentRimMeta()` label | Rim values/provenance plus setup IDs | PARTIAL | backend, api, frontend | Server must aggregate field evidence and missingness into the four frozen states |
| Setup mode `uniform` | `is_staggered` exists | `rim_setups.is_staggered`, same front/rear ID on normal creation | YES | none | Reuse durable model |
| Setup mode `staggered` | UI only renders front rim | DB, API and engine now support independent front/rear specs | YES (backend) | frontend | Render both axles and per-axle results in the frozen UI slice |
| Rim form `clean/dirty/saving/save_failed` | Form, saving flag, generic error | Revisions and PATCH | PARTIAL | frontend, persistence | Same independent form/validation model as vehicle; durable values only after save |

### Critical evidence and confirmation

`rim_specs.field_provenance` is a valuable reusable durable structure. It
records `source`, `confidence` and `is_user_confirmed` per field and the
rules engine turns it into `FieldValue`. The current overview exposes the
map but not field-state objects; the frontend collapses all values into
inputs and uses `fitmentRimMeta()` to show one aggregate label. This is not
sufficient for the frozen field-level UI.

Today `PATCH /jobs/{id}/fitment` writes changed rim values with
`source="user_edited"` and `is_user_confirmed=true`; saving an unchanged
prefilled value writes `source="user_confirmed"`. Therefore a successful
save can remain the V1 confirmation action, but UI state must state it
clearly. A visible value cannot be used as proof of confirmation.

### Rim parser integration

| Frozen invariant | Existing behaviour | Classification | Required implementation |
| --- | --- | --- | --- |
| Resolver produces suggestions | Resolver returns an unpersisted `RimSourceResolveResponse` | YES | Retain |
| Multiple SKU requires explicit selection | Resolver sets `selection_required`; UI renders picker | PARTIAL | Persist the selected SKU/source revision only after explicit selection and confirmation |
| Manual fallback | Safe parser errors and manual fields exist | YES | Retain, map errors to parser taxonomy |
| Parser cannot overwrite confirmed value | `applyRimSourceValues()` fills only blank values and avoids session-local manual fields | PARTIAL | Protect durable confirmed fields, not only current-page manual fields |
| Same URL/SKU re-resolve preserves confirmation | Resolver returns a source fingerprint; persisted source/SKU metadata is compared server-side | YES (Slice 4) | frontend conflict presentation | Same source/SKU keeps confirmed values and exposes a separate suggestion |
| New URL/SKU forces reconfirmation | Source fingerprint/SKU change increments source boundary and clears confirmation relationship | YES (Slice 4) | Slice 5 currentness compares the changed identity | Preserve history, require fresh confirmation |

## Rim control mapping

| Frozen control | Current control | Reuse decision | Gap / required implementation |
| --- | --- | --- | --- |
| Diameter preset select + custom | Plain numeric input | incompatible with frozen model | Add 12–24 presets and custom exact numeric value; store canonical numeric value without using presets as a whitelist |
| Width preset select + custom | Plain `step=0.5` numeric input | incompatible with frozen model | Add frozen 4–12J presets including 11J and custom exact value |
| DIA searchable presets + custom | Plain `step=0.1` numeric input | incompatible with frozen model | Add searchable common presets plus custom exact value; preserve 63.3/63.35/63.4 and 66.45/66.5/66.6 distinctly |
| ET exact numeric input | Plain numeric input, `step=1` | reusable UI only | Change to decimal-capable exact input; canonical parse accepts Russian comma but serializes exact dot decimal; no nearest-value conversion |
| PCD constrained presets + custom pair | PCD select plus a separate bolt-count input and custom `step=0.1` input | reusable UI only | Retain visual select/custom pattern, but bind the pair (`bolt_count`, `pcd_mm`), preserve exact custom values and do not use `toFixed(1)` |
| Presets are not validation whitelist | Custom branch exists for PCD only | PARTIAL | Apply the rule uniformly; parser/manual values outside presets remain exact and selectable |

`fitmentPcdOptionValue()` currently uses `pcd.toFixed(1)`, which can silently
round exact values. `normalizeFitmentNumber()` uses `Number(value)` and does
not accept a Russian comma decimal. The existing PCD UI is reusable only as a
visual/control starting point, never as its value-normalization logic.

## Manual RimSpec save flow

The current PATCH route persists values, provenance and revision counters,
and the change-event log is append-only. That is the durable foundation for
the frozen flow. It can store partial values because all fields are optional
in `FitmentRimUpdate`.

The overview contradicts the frozen behavior: `_fitment_readiness_from_row()`
requires every PCD/DIA/diameter/width/ET field before `next_action` can be
`run_standard_check`, even though the check engine can safely produce an
`unknown` for missing/unconfirmed critical evidence. The frontend repeats the
same rule in `fitmentDraftMissingFields()` and hides the verdict card whenever
`readiness.ready` is false.

Required frozen sequence:

```text
local draft → explicit save → persisted partial or complete_unconfirmed
→ explicit confirmation where the UI requires it → confirmed_ready
→ user-requested Standard Check from persisted snapshot only
```

No Standard Check is to use an unsaved draft. A valid persisted partial
RimSpec may receive `next_action=run_standard_check`; its returned technical
verdict is allowed to be `unknown` rather than being blocked by a frontend
heuristic.

## Standard Check, verdict and field-result mapping

| Frozen state / rule | Current runtime | Existing implementation | Gap | Required implementation |
| --- | --- | --- | --- | --- |
| Client `idle` / `submitting` | `state.fitmentChecking` | YES | none | Reuse transient submit state |
| Backend `queued` / `processing` | Redis-backed worker queue and atomic claim transition | YES (Slice 5) | frontend | Poll `GET /fitment/checks/{id}` only while pending |
| Backend `completed` | Worker (or no-worker fallback) persists deterministic result | YES (Slice 5) | frontend | Reuse result shape through the common lifecycle |
| Backend `failed` | Worker persists stable operational `{code,retry_mode,retryable}` | YES (Slice 5) | frontend | Preserve distinction from unknown and map the category to approved copy |
| Frontend polling | Frozen client still awaits Slice 6 adapter | NO | frontend | Poll only queued/processing check IDs; stop on completed/failed/auth |
| Overall verdict render | Client renders `check.verdict` and issue lists | PARTIAL | frontend | Retain server-rendered overall result; render field status and all supported machine codes without fallback ambiguity |
| Client-side compatibility calculation | None found in client | YES | none | Continue not to calculate PCD/DIA/ET locally |
| PCD mismatch → fail/incompatible | Rule returns `pcd_mismatch` and aggregation blocks | YES | none | Cover through API and E2E |
| DIA smaller → fail/incompatible | Rule returns `center_bore_too_small` | YES | none | Cover through API and E2E |
| DIA larger → conditional | Rule returns `hub_rings_required` | YES | none | Cover through API and E2E |
| Size outside provider reference → unknown | `size_not_in_reference` is unknown critical | YES | none | Cover through API and E2E |
| Missing/untrusted critical evidence → unknown | Rule returns unknown; engine evaluates `FieldValue` evidence | PARTIAL | backend, api | Ensure UI permits persisted partial check and check snapshot reflects confirmed state |
| ET inside reference → pass | `check_size_and_offset()` returns compatible | YES | none | Cover through API and E2E |
| ET outside reference → unknown `et_outside_reference_range` | `check_size_and_offset()` returns unknown with exact ET/reference evidence | YES | none | Retain; user-facing copy advises a separate inner/outer-clearance check without changing the technical status |
| Standard subset only | `CompatibilityEngine.STANDARD_RULES` invokes only PCD, DIA and size/ET checks | YES | none | Retain fastener/load implementations outside the Standard execution path for future approved use |

The ET runtime conflict has been corrected in Slice 1. Out-of-range ET now
produces the canonical `unknown` because Standard V1 does not calculate
clearance. The legacy `offset_deviation_check_required` code remains in the
generic schema to avoid a blind removal from future non-Standard work, but
Standard execution never emits it.

### `next_action` and readiness

The backend already has the desired enum values:

```text
complete_vehicle_details
complete_rim_specs
select_vehicle_variant
run_standard_check
```

It must become the single frontend authority. The client currently uses it
only when `useDraft` is false, then replaces it with local missing-field and
provider-readiness logic. The server also treats all missing rim fields as a
blocker and ignores `unconfirmed_fields` when deciding `ready`; both need
contract-aligned aggregation before the frozen UI can render the flow safely.

## Session restoration, errors and retry

| Frozen category / state | Current source and UI | Existing implementation | Gap | Required implementation |
| --- | --- | --- | --- | --- |
| `DREAM_WHEELS_401` | 401 in save/check/resolve/apply invokes `showFitmentAuthRequired()` | PARTIAL | frontend, persistence | Retain draft save and no automatic replay; restore full semantic draft (including unsaved source/selection state) and clear it only after successful restoration |
| 401 does not create check failed | Check request returns before POST result is read | YES | none | Retain |
| `LOCAL_VALIDATION` | Browser/Pydantic error text | PARTIAL | api, frontend | Field code → UI category → copy → CTA matrix |
| `NO_MATCH` | Empty variants list converted to a message | PARTIAL | api, frontend | Explicit machine result, separate no-match island and refine CTA |
| `MULTIPLE_MODIFICATIONS` | Nonempty picker | PARTIAL | api, frontend | Explicit category with selection required; no automatic first result |
| `WHEEL_SIZE_VALIDATION_ERROR` | Generic 503/plain detail | NO | api, frontend | Stable code and corrective CTA |
| `THROTTLED` / `QUOTA` | Provider retries internally, caller sees generic ProviderError | NO | backend, api, frontend | Preserve HTTP 429 / quota code and Retry-After or provider-supplied retry timestamp |
| `TIMEOUT` / `NETWORK` / `PROXY` | Generic ProviderError or client fetch error | PARTIAL | api, frontend | Stable operational categories, retryability and safe copy |
| `PROVIDER_5XX` | Mapped to `provider_unavailable` in check create | PARTIAL | api, frontend | Keep `failed`, add exact category and safe retry metadata |
| `MALFORMED_RESPONSE` | Provider throws generic error | PARTIAL | api, frontend | Stable category, no technical verdict |
| Parser taxonomy | Resolver has safe `RimUrlError.reason_code`; UI maps several codes | YES | none | Keep separate from Wheel Size and Fitment-check categories |
| Retry UI | Boolean `retryable` only | NO | api, frontend | Model `retryable`, `retry_later`, `not_applicable`; render relative time only when `retry_at`/Retry-After is supplied, never invent a countdown |

## Current versus historical check mapping

| Requirement | Current support | Gap / required implementation |
| --- | --- | --- |
| Immutable historical input snapshot | `fitment_checks.input_snapshot`, `evaluation_snapshot`, versions, input hash | Supported durable foundation |
| Historical verdict remains readable | `GET /fitment/checks/{id}` plus history query | Implemented in Slice 5 | frontend linkage remains Slice 6 |
| Current verdict becomes stale on vehicle/rim/modification/source/axle change | `is_current` compares immutable snapshot identity with current canonical context | Implemented in Slice 5 | frontend badge/rendering remains Slice 6 |
| Correct current selection | Context hash over IDs, revisions, mapping and per-axle source/SKU identity | Implemented in Slice 5 | Never pick latest timestamp |
| URL/SKU change | Rim revision and source revision increment | Implemented in Slice 4; currentness now reflects the changed identity | frontend badge remains Slice 6 |
| Staggered input/current state | Both axles are snapshotted and compared independently | Implemented in Slices 4–5 | frontend rendering remains Slice 6 |

## Fitment ↔ rendering cross-flow

The current UI can open Fitment from a completed render and return to its
origin view via `fitmentOriginView`/`fitmentOriginJobId`. It does not create an
image from a verdict, so the core non-blocking direction is reusable.

However, opening Fitment resets its local form and closing it discards unsaved
normal drafts. The only restoration store is a sessionStorage re-auth draft.
The current Fitment overview itself is tied to a completed render job, which
is stricter than the frozen rule that Fitment readiness is independent of
render readiness. Existing render history does not select a current Fitment
check by snapshot; it only retains a temporary `state.fitmentCheck` in the
open Fitment session.

Required: preserve valid draft/context on Fitment → Rendering → Fitment,
retain confirmation/provenance unchanged, make every verdict compatible with
visual try-on, and read current/history through snapshot identity rather than
time order.

## Persistence inventory

| State class | Current storage | Mapping result / needed storage |
| --- | --- | --- |
| VehicleIdentity | `vehicle_identities` with revisions, provenance, candidates and provider mappings | Reusable; add/expose aggregate state and provider-backed market value |
| Confirmed modification | Wheel Size mapping JSONB | Implemented in Slice 3: selected variant identity, durable `selection_source` and vehicle-revision binding |
| Vehicle Fitment Reference | Mapping plus check `evaluation_snapshot` | Implemented for immutable check evidence; expose presentation in Slice 6 |
| Persisted RimSpec/RimSetup | `rim_specs`, `rim_setups`, field provenance, source identity and revisions | Implemented in Slice 4: field states, source/SKU identity, aggregate setup state and front/rear mapping |
| FitmentCheck / history | `fitment_checks`, snapshots, lifecycle metadata, `fitment_change_events` | Implemented in Slice 5; list/query and context-based `is_current` are available |
| Dirty/validation/loading/open selector/submitting | Page memory only | Correctly transient; add a structured frontend state adapter, no Postgres entity |
| Pre-401 restoration | `sessionStorage` keyed by job | Partial; store complete semantic local state with expiry and no automatic replay |
| Valid draft across render navigation | None except re-auth draft | Persistence gap; use bounded session/local restoration keyed to the Fitment context and current revision |

## Runtime gaps

### A. Already supported or directly reusable

- Durable canonical `VehicleIdentity`, `RimSpec`, `RimSetup`, revisions,
  field provenance and append-only change events
- Wheel Size server adapter with cache, catalogue ladder and explicit
  variant revalidation on apply
- Safe unpersisted Rim URL resolver with multiple variant response and
  parser-specific error codes
- Immutable check input/evaluation snapshots, idempotency key and failed
  versus technical unknown separation
- Deterministic PCD, DIA and size checks, per-axle engine data model, and
  backend-rendered verdict/result lists
- Existing short-lived 401 draft and no automatic check replay

### B. Frontend-only mapping gaps

- Structured form/validation/lookup/resolver/check state adapter, mutually
  exclusive visual states and field-level display
- Render server `next_action` directly instead of local fallback inference
- Provider control UI: select/combobox/custom composition, Russian decimal
  presentation, exact-value retention and accessible dependent controls
- Check lifecycle polling when backend begins returning pending statuses
- Machine-code copy/error/retry renderer, stale/current badge and history UI
- Context/draft restoration through rendering navigation

### C. Backend/API gaps

- Check lifecycle, pending states, operational error taxonomy/retry metadata,
  context-based currentness and history query are implemented in Slice 5.
- Remaining backend work is limited to frontend-facing presentation choices;
  the frozen UI adapter and polling are Slice 6.

### D. Persistence gaps

- Durable `selection_source`, exact selected modification identity and its
  revision binding (Slice 3)
- Source URL/SKU fingerprint plus reconfirmation/invalidation records (Slice 4)
- Current-versus-historical check identity is exposed through `input_hash` and
  `is_current`; no mutable stale flag is required
- Bounded restoration of a valid unsaved Fitment draft across navigation

### E. Legacy behaviour to remove or replace

- Legacy client free region/year inputs and client-side fuzzy/provider
  inference; Slice 2 supplies the backend catalogue replacement
- `fitmentDraftMissingFields()` and `fitmentProviderReady()` taking authority
  away from server `next_action`
- PCD `toFixed(1)` rounding and lack of Russian comma parsing
- Automatic URL re-resolution without durable same/new-source semantics
- Legacy front-only overview and explicit rejection of a real staggered setup
  (replaced by Slice 4 axle-aware mapping)
- Generic error strings where stable machine categories are required

## Severity, dependency order and implementation slices

### P0 — correctness and frozen-contract blockers (resolved by Slice 4)

1. Make backend `next_action` and UI use contract-compatible confirmation and
   persisted-partial RimSpec semantics; eliminate local readiness authority
2. Replace value-exists-as-confirmed UI with per-field provenance/state and
   protect confirmed RimSpec data from parser/new-source overwrites
3. Deliver complete front/rear API mapping or explicitly gate staggered UI;
   the frozen UI cannot claim a supported staggered setup while PATCH rejects it

### P1 — required complete flow

1. Frozen frontend lifecycle polling and state rendering
2. Preserve draft/context across Fitment ↔ Rendering navigation and complete
   the semantic 401 restoration draft
3. Implement frozen preset/custom controls with exact decimal parsing/display

### P2 — follow after correct core mapping

1. Refine visual progress, cache provenance and timing/accessibility polish
2. Historical check browsing and additional telemetry presentation, while
   preserving the approved telemetry boundaries

### Independent implementation slices

| Slice | Scope and likely files | Dependencies | Acceptance criteria | Tests / risks |
| --- | --- | --- | --- | --- |
| 1. Standard engine correction | `src/fitment/rules/{engine,checks,verdict}.py`, schemas and evidence tests | Complete | ET-outside is unknown with canonical code; no Standard fastener/load result | Verified by unit/API/benchmark regression |
| 2. Vehicle catalogue and state API | Wheel Size adapter, authenticated routes/contracts, overview aggregation | Slice 1 | **Complete:** exact provider-backed region/make/model/year cascade, explicit vehicle field/aggregate state, saved revision before lookup, and distinct no-data/provider failures | Automated API/cache tests; live smoke remains optional |
| 3. Modification persistence | `provider_mappings.wheel_size`, jobs/check routes and overview | Slice 2 | **Complete:** revision-bound `none | suggested | confirmed`, exact single auto-confirm, multiple explicit apply, source audit and positive-check guard | API/integration tests; no migration; do not persist first-of-many |
| 4. RimSpec/RimSetup state and invalidation | persistence/API, resolver boundary, overview | Slice 1 | **Complete:** field source/state/confirmation, partial check eligibility, source/SKU invalidation and coherent front/rear mapping | API/unit tests; provenance and stale-data risk |
| 5. Check lifecycle/currentness | checks API, storage/query routes | Slices 3–4 | **Complete:** genuine pending lifecycle, failed distinct from unknown, current result selected by snapshot | API/integration tests; frontend polling remains Slice 6 |
| 6. Frozen frontend state adapter and controls | `webapp/index.html`, `app.js`, `style.css` | Slices 2–5 | No parallel readiness; frozen controls/copy/state matrix; exact custom decimal values | Frontend state/visual tests; mobile/accessibility risk |
| 7. Cross-flow and authenticated E2E | frontend restoration, history/current API surface | Slices 5–6 | Navigation preserves context, 401 restores/no replay, visual try-on never blocked | Authenticated staging E2E; deployment/provider availability risk |

## Required future test mapping

| Scenario | Primary level | Additional level |
| --- | --- | --- |
| Exact compatible | rule unit + check API | authenticated staging E2E |
| Larger DIA conditional | rule unit + check API | authenticated staging E2E |
| PCD mismatch incompatible | rule unit + check API | authenticated staging E2E |
| Missing ET unknown | rule unit + overview/next-action API | authenticated staging E2E |
| ET outside reference unknown | rule unit + benchmark + check API | authenticated staging E2E |
| Wheel Size outage failed | provider/check integration | authenticated staging E2E |
| Session restoration without replay | frontend state test | authenticated staging E2E |
| Persisted partial RimSpec check | overview/check API | frontend state test and staging E2E |
| Multiple modification selection | provider/jobs API | frontend state test and staging E2E |
| Parser fallback/manual entry | resolver API + frontend state | staging E2E where public test page is stable |
| Stale verdict after vehicle change | persistence/API integration | frontend state test |
| Stale verdict after RimSpec/source change | persistence/API integration | frontend state test |
| Staggered front/rear result | engine/API integration | staging E2E when UI slice exists |
| Fitment → Rendering → same Fitment context | frontend state test | authenticated staging E2E |

## Architecture blocker assessment

No conflict was found between the frozen Standard Fitment UI and the frozen
domain/API product contracts. The remaining gaps are implementation gaps.
Slices 1–6 resolved the engine, Vehicle catalogue/state, modification,
RimSpec, check lifecycle/currentness and frozen frontend authority without
altering the behavioural contract.

## Recommended next step

Slice 6 is complete. Next is **Slice 7 — cross-flow and session-restoration
E2E**. It owns the remaining preservation/return behaviour and authenticated
staging proof; it must not revise the frozen Standard engine or UI contract.

## Vehicle Catalogue make-first corrective amendment — 2026-09-03

The Vehicle catalogue section above records the superseded market-first
implementation for historical traceability. The current implementation is
make-first and the following contract is authoritative for Phase 07B:

```text
VEHICLE_CATALOGUE_TOPOLOGY = MAKE_MODEL_YEAR_THEN_CONDITIONAL_MARKET
VEHICLE_CATALOGUE_AGGREGATION = BACKEND_OWNED
VEHICLE_CATALOGUE_BROWSER_PROVIDER_FANOUT = FORBIDDEN
VEHICLE_CATALOGUE_PROVIDER_REGION_UNIVERSE = COMPLETE_PROVIDER_LIST
VEHICLE_CATALOGUE_PROVIDER_IDENTITY = PRESERVED_PER_REGION
VEHICLE_CATALOGUE_INTERACTIVE_FUZZY_MATCHING = FORBIDDEN
VEHICLE_CATALOGUE_SAVE_REVALIDATION = BACKEND_EXACT
VEHICLE_CATALOGUE_DROPDOWN_PATCH = FORBIDDEN
```

The backend aggregate layer is implemented in
`src/fitment/vehicle_catalogue.py` and is exposed through authenticated
`/fitment/vehicle-catalogue/makes`, `models`, `years` and `markets` routes.
Wheel-Size cataloging remains behind `WheelSizeProvider`; its cacheable
catalogue methods accept the documented repeated region parameter. Makes and
models use provider region evidence when available, while years are bounded
fan-out calls over the exact make/model identities. The short-lived aggregate
is never presented as a client-side provider topology.

Frontend controls are `make → model → year`; the conditional market selector
appears only for an ambiguous market resolution. A single result auto-resolves
and hides the selector. Provider empty responses render `no_data`; operational
errors render `failed` with retry. Request aborts, a context version, a
monotonic token and exact dependency keys protect against stale responses.
The child draft remains visible while a parent request is loading and is
revalidated before it is cleared. The job-scoped expiring draft graph stores
`lastMake`, nested `lastModel`, `lastYear` and `lastExplicitMarket` only as
UI memory. The summary omits an auto-resolved market, and the existing
variant/rim/check/render/`next_action` paths are unchanged.

The deterministic guest fixture includes `ZEEKR 007 → 001`, a single-region
resolution and a multi-region `selection_required` resolution. This amendment
supersedes only the Vehicle catalogue topology and state mapping from
2026-09-02; it does not alter Fitment domain or verdict semantics.
