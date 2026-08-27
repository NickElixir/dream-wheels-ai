# 07 — Fitment Verdict V1 — Engineering Handoff

## Status

`FITMENT_BETA_READY: NO`

`STANDARD_FITMENT_ARCHITECTURE = FROZEN`

`ARCHITECTURE_BLOCKERS_FOR_UI = NONE`

`VEHICLE_MODIFICATION_STATE_INVENTORY = APPROVED`

`VEHICLE_MODIFICATION_WIREFRAME = APPROVED`

`FITMENT_RENDER_CROSS_FLOW = APPROVED`

`STANDARD_FITMENT_STATE_CTA_MATRIX = APPROVED`

`STANDARD_FITMENT_COPY_ERROR_MATRIX = APPROVED`

`INTERACTIVE_FITMENT_PROTOTYPE = CREATED`

`FITMENT_PROTOTYPE_DESKTOP_QA = PASSED`

`FITMENT_PROTOTYPE_390_QA = PASSED`

`STANDARD_FITMENT_UI = FROZEN`

`RUNTIME_MAPPING = COMPLETE`

`SLICE_1_STANDARD_ENGINE_CORRECTION = COMPLETE`

`SLICE_2_VEHICLE_CATALOGUE_STATE_API = COMPLETE`

`SLICE_3_MODIFICATION_PERSISTENCE = COMPLETE`

`SLICE_4_RIMSPEC_RIMSETUP_STATE = COMPLETE`

`SLICE_5_CHECK_LIFECYCLE_CURRENTNESS = COMPLETE`

`SLICE_6_FROZEN_FRONTEND = COMPLETE`

`SLICE_7_CROSS_FLOW_STAGING_E2E = BLOCKED`

`IMPLEMENTATION = IN_PROGRESS`

`ET_OUTSIDE_REFERENCE_SEMANTICS = CORRECTED`

`STANDARD_RULESET_SCOPE = CORRECTED`

`VEHICLE_CATALOGUE_API = IMPLEMENTED`

`VEHICLE_AUTHORITATIVE_STATE = IMPLEMENTED`

`SAVE_BEFORE_LOOKUP_INVARIANT = ENFORCED`

`MODIFICATION_STATE = IMPLEMENTED`

`SELECTION_SOURCE = IMPLEMENTED`

`POSITIVE_STANDARD_VERDICT_GUARD = ENFORCED`

`RIMSPEC_FIELD_STATE = IMPLEMENTED`

`RIMSETUP_STATE = IMPLEMENTED`

`RIM_SOURCE_IDENTITY = IMPLEMENTED`

`RIM_SOURCE_INVALIDATION = ENFORCED`

`PARTIAL_RIMSPEC_STANDARD_CHECK = ENABLED`

`STAGGERED_RIMSETUP = IMPLEMENTED`

`CHECK_LIFECYCLE = IMPLEMENTED`

`CHECK_PENDING_STATES = IMPLEMENTED`

`CHECK_ERROR_TAXONOMY = IMPLEMENTED`

`CHECK_RETRY_METADATA = IMPLEMENTED`

`CHECK_CURRENTNESS = IMPLEMENTED`

`CHECK_HISTORY = IMPLEMENTED`

`FROZEN_FRONTEND_STATE_ADAPTER = IMPLEMENTED`

`FROZEN_FRONTEND_CONTROLS = IMPLEMENTED`

`FITMENT_FRONTEND_POLLING = IMPLEMENTED`

`CROSS_FLOW_DRAFT_RESTORATION = IMPLEMENTED`

`RENDER_FITMENT_DECOUPLING = IMPLEMENTED`

`NEXT = Deploy Slice 7 to authenticated staging and run the mandatory E2E matrix`

`BLOCKER = staging Vercel frontend returns 404 for nested Fitment catalogue routes; PR #97 adds explicit proxies but its Vercel deployment fails at Deploying outputs, so the alias cannot yet be re-tested`

The deterministic implementation and its automated verification were recorded in the prior implementation handoff. The beta gate remains **NO** until an authenticated staging end-to-end run succeeds against the configured Wheel Size API. Slices 2–6 add runtime/API and presentation behaviour but do not alter the frozen domain or UI contract, and the gate remains unchanged.

## Canonical product contract

The normative product specification is [Fitment Verdict V1](../fitment/fitment-verdict-v1.md). It is deliberately kept separate from this handoff so that product rules are not duplicated across status documents.

The contract fixes these decisions for the next implementation pass:

- Standard Fitment is the free, non-blocking preliminary deterministic check; visual try-on remains independent of its technical outcome.
- RAG/LLM do not determine compatibility. A confirmed RimSpec and Wheel Size technical reference feed the deterministic CompatibilityEngine.
- False compatibility is worse than `unknown`; provider outages are operational failures, never technical `unknown`.
- For the exact axle, diameter and width, ET outside the provider-derived Wheel Size interval is `unknown` (`et_outside_reference_range`), not `compatible_with_conditions`; Standard V1 does not calculate clearance.
- `region` is the vehicle market (default `Russia+`), not user geolocation; edits to make/model/year/region invalidate modification, reference and verdict but retain RimSpec.
- A multi-modification vehicle requires explicit user selection/confirmation before a positive Standard verdict. An unresolved modification may offer a future Extended all-modifications check.
- Modification has an explicit `none | suggested | confirmed` state and a
  provenance value: `wheel_size_single`, `user`, or future
  `vehicle_recognition`.
- Dream Wheels 401 follows a short-lived-draft **session restoration** flow; it is distinct from external provider authentication failure.
- Standard collects privacy-safe product telemetry for modification count,
  lookup outcomes/latency, selection behaviour, provider requests and
  available pagination totals. This is distinct from operational error logs.
- Extended all-modifications sweep is documented future scope. Its fanout cap
  will be determined later from Standard's real-traffic telemetry, not invented
  during implementation.

## Existing implementation record

The existing V1 delivery recorded a deterministic pipeline, field-level results, conservative aggregation, Wheel Size v2 reference mapping and a versioned benchmark. Its prior baseline was:

- branch: `codex/fitment-verdict-v1`;
- base: `origin/staging @ bed5c4cd1ff0f9b9d585e525b56e39fd43739794`;
- implementation commit: `d02b79e6257e24c8626601080631d0935dbfd035`;
- benchmark: `fitment_verdict_v1_2026-08-20`, 33 cases, reported false-compatible rate `0 / 33`;
- recorded automated checks: `ruff check .`, `ruff format --check .`, `pytest -q` (237 passed, 3 skipped), and the benchmark runner.

These are historical implementation records, not a replacement for the authenticated staging E2E gate.

## Standard Fitment UI and runtime-mapping checkpoint

The current self-contained visual reference is
[standard-fitment-v1.html](../references/standard-fitment-v1.html). It covers
the progressive Vehicle, RimSpec and Compatibility flow with a separate
demo-only state controller. The authority for its state/CTA and copy/error
behaviour is [Standard Fitment UI State Specification V1](../ui/fitment-ui-state-spec-v1.md);
the frozen Fitment domain contract still takes precedence.

Desktop and 390 px visual QA passed. The UI is now frozen by the approved
audit baseline. Its runtime mapping is recorded in
[Standard Fitment V1 — Runtime Mapping Audit](../ui/fitment-runtime-mapping-v1.md).
The UI checkpoint itself remains frozen. Subsequent runtime slices update API
and persistence behaviour only where required by that frozen contract; the
Fitment beta gate remains unchanged.

### Runtime implementation progress

The audit found no architecture conflict between the frozen UI and frozen
domain/API contracts. Slice 2 resolved the Vehicle catalogue/state foundation:

- authenticated server-owned `regions`, `makes`, `models` and `years` routes
  use the Wheel Size adapter and existing provider cache;
- catalogue data has explicit `success` / `no_data` outcomes, while provider
  failures remain structured operational 503 errors;
- overview now exposes `vehicle_state` and `vehicle_field_states` for
  `empty | unconfirmed | confirmed_incomplete | confirmed_ready`;
- an exact validated vehicle save increments the authoritative revision,
  invalidates an old modification mapping and must succeed before lookup;
- Slice 2 lookup returns its saved `vehicle_revision`, all candidates, count
  metadata and `no_match | single | multiple`; Slice 3 adds the corresponding
  durable modification outcome.

Slice 3 resolves modification authority without a schema migration. The
existing `vehicle_identities.provider_mappings.wheel_size` JSONB now carries
the canonical provider identifiers plus `modification_state`,
`selection_source`, `selected_modification` and the bound vehicle revision.

- A single exact provider candidate is persisted as `confirmed` with
  `wheel_size_single`; repeating the same lookup is a no-op.
- Multiple candidates persist only `suggested`; candidates are deliberately
  transient, and explicit apply revalidates the exact user choice before it
  persists `confirmed` with source `user`.
- A no-match clears any current selection. Provider failure for an unchanged
  revision leaves a current confirmed selection intact; a changed vehicle has
  already cleared it through Slice 2 invalidation.
- Legacy mapping without source/revision evidence is safe to read but is
  exposed as `none`, never silently labelled as a user selection.
- Standard-check creation now requires a current revision-bound confirmed
  source (`wheel_size_single` or `user`), preventing a stale mapping from
  yielding a positive Standard verdict.

Remaining implementation gap is the **authenticated staging E2E gate**. The
runtime now has bounded revision-safe cross-flow restoration, request teardown
and Fitment/Rendering independence; it still needs evidence against the real
deployed backend, worker, Redis and Wheel Size configuration.

### Slice 1 — Standard engine correction

Slice 1 is complete. Standard execution now runs only PCD, DIA and size/ET
rules. ET outside the exact Wheel Size reference interval now returns
`unknown` with `et_outside_reference_range`; it cannot yield
`compatible_with_conditions`. Fastener and load-rating rule implementations
remain available outside the Standard execution path for future separately
approved scope.

The engine and rules metadata were bumped from `v1` to `v2`. The updated
offline benchmark remains 33 cases with `0 / 33` false-compatible results.

## Required authenticated staging E2E

Use a confirmed exact Wheel Size vehicle modification and a confirmed RimSpec. Verify at least:

1. exact compatible result;
2. larger-bore conditional result;
3. PCD mismatch as incompatible;
4. missing ET as safe `unknown` with an explanation;
5. Wheel Size outage as an operational failure, not `unknown`;
6. form validation, modification selection and session-restoration states described by the canonical contract.

Do not change `FITMENT_BETA_READY` to `YES` until this authenticated staging E2E succeeds and its evidence is recorded here.

## Frontend implementation slice

**Slice 6 — Frozen frontend state adapter and controls** is complete. It
renders authoritative overview/check fields through one adapter, keeps form,
catalogue, resolver and submit state transient, and never derives Fitment
readiness or compatibility locally.

### Historical Slice 4 checkpoint

```ini
SLICE_4_RIMSPEC_RIMSETUP_STATE = COMPLETE
RIMSPEC_FIELD_STATE = IMPLEMENTED
RIMSETUP_STATE = IMPLEMENTED
RIM_SOURCE_IDENTITY = IMPLEMENTED
RIM_SOURCE_INVALIDATION = ENFORCED
PARTIAL_RIMSPEC_STANDARD_CHECK = ENABLED
STAGGERED_RIMSETUP = IMPLEMENTED
IMPLEMENTATION = IN_PROGRESS
NEXT = Slice 6 — Frozen frontend state adapter and controls
FITMENT_BETA_READY = NO
```

Rim field state is derived server-side from value and provenance (`missing`,
`suggested`, `entered`, `confirmed`); PCD confirmation requires both
components. Resolver output remains unpersisted until save. Same source/SKU
proposals preserve confirmed values, while a new source or SKU invalidates
their confirmation relationship and increments the source/revision boundary.
Uniform setups retain one effective RimSpec; staggered setups persist
independent front and rear specs. Standard Check snapshots both axles and is
allowed for valid persisted partial input, with missing evidence evaluated as
`unknown`.

**Extended sweep:** remains future scope. First investigate one user-initiated Wheel Size `/search/by_model/` request and local processing; do not introduce per-modification fanout until a cap is chosen from accumulated Standard telemetry.

### Historical Slice 5 checkpoint

```ini
SLICE_5_CHECK_LIFECYCLE_CURRENTNESS = COMPLETE
CHECK_LIFECYCLE = IMPLEMENTED
CHECK_PENDING_STATES = IMPLEMENTED
CHECK_ERROR_TAXONOMY = IMPLEMENTED
CHECK_RETRY_METADATA = IMPLEMENTED
CHECK_CURRENTNESS = IMPLEMENTED
CHECK_HISTORY = IMPLEMENTED
NEXT = Slice 6 — Frozen frontend state adapter and controls
FITMENT_BETA_READY = NO
```

The existing Redis-backed worker now accepts `fitment_check` jobs and moves
rows through `queued → processing → completed|failed`; no-worker environments
retain a compatibility synchronous path with the same persisted contract.
Operational failures have stable machine codes and retry categories and never
become technical `unknown`. `GET /fitment/checks/{id}` and the history query
calculate `is_current` from immutable VehicleIdentity, modification, RimSetup
and per-axle RimSpec/source identity. Legacy snapshots without that identity
remain readable historical records and are conservatively not current.

### Slice 6 checkpoint

```ini
SLICE_6_FROZEN_FRONTEND = COMPLETE
FROZEN_FRONTEND_STATE_ADAPTER = IMPLEMENTED
FROZEN_FRONTEND_CONTROLS = IMPLEMENTED
FITMENT_FRONTEND_POLLING = IMPLEMENTED
IMPLEMENTATION = IN_PROGRESS
NEXT = Slice 7 — Cross-flow and session-restoration E2E
FITMENT_BETA_READY = NO
```

The web app now consumes `next_action`, vehicle/modification state,
per-field RimSpec evidence, setup mode and check currentness as server-owned
state. Provider-backed vehicle cascades, exact comma-decimal controls, source
variant/conflict presentation, uniform/staggered input, pending-check polling,
operational retry copy, stale-result indication and the 401 presentation
boundary are implemented. Check creation remains an explicit user action
after a save; a Fitment verdict never blocks visual try-on. Slice 7 retains
cross-flow persistence and authenticated staging E2E as its own scope.

### Slice 7 implementation checkpoint — staging validation pending

The web app stores only a versioned, job-scoped session draft for 30 minutes.
It includes entered Vehicle/Rim front/rear values, active step, source URL and
safe resolver/conflict metadata, but never credentials, raw provider payloads
or check results. On ordinary Fitment → Rendering → Fitment return it restores
silently after comparing the authoritative revision/source baseline. On Dream
Wheels 401 it stops Fitment requests and polling, reloads the authoritative
overview after Telegram login, restores only a compatible draft and then shows
`Данные восстановлены`; it never replays a save, lookup, resolver request or
Standard Check. A mismatched draft is not merged; it is exposed only through
an explicit review action with old modification/SKU decisions removed.

Fitment availability now depends on the persisted VehicleIdentity and RimSetup,
not the render job terminal state. Result-page Fitment CTAs load the current
overview and map `next_action`/`current_check` rather than relying on local
check state. Authenticated staging evidence remains required before the beta
gate can change.

## Open decisions

- The Extended modification fanout cap will be selected later from real-traffic
  Standard telemetry (`P50`/`P75`/`P90`/`P95` modification counts, coverage,
  request count, latency, quota/cost and pagination). It does not block
  Standard UI implementation.
- Vehicle Recognition needs a measured quality threshold before it can preselect a modification. Until then it may only recommend one.
