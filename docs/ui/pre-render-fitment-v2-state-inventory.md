# Pre-render Fitment V2 — State Inventory

## Status and authority

```text
PRE_RENDER_FITMENT_V2 = DRAFT
PRE_RENDER_FITMENT_V2_STATE_INVENTORY = DRAFT
PRE_RENDER_FITMENT_V2_UI = NOT_FROZEN
RUNTIME_IMPLEMENTATION = NOT_STARTED
```

This document is the next design-contract artifact for moving Standard Fitment
earlier in the Dream Wheels user flow, before the user decides whether to spend
a render.

It does **not** replace or rewrite the existing frozen V1 contracts in place.

Authority order while this V2 artifact is still draft:

1. `docs/fitment/fitment-verdict-v1.md` remains authoritative for current
   Standard Fitment verdict meaning and deterministic rule semantics.
2. `docs/ui/ui-development-process.md` remains authoritative for UI delivery
   order.
3. `docs/ui-design-code.md` remains the current application visual and
   terminology authority until a separately approved design-code revision.
4. `docs/ui/fitment-ui-state-spec-v1.md` remains the frozen V1 behavioural
   reference for the currently implemented Fitment UI.
5. `docs/handoffs/14-garage-fitment-flow-decisions.md` supplies the approved
   product decisions that motivate this V2 flow.
6. This document defines the **draft V2 state inventory and V1 delta** only.

No runtime implementation or UI freeze is authorized by this document.

---

## 1. Product invariant

### Fitment never gates Visual Try-on

This invariant is non-negotiable:

```text
FITMENT_VERDICT != RENDER_PERMISSION
FITMENT_EXECUTION != RENDER_PERMISSION
FITMENT_FAILURE != RENDER_PERMISSION
```

A paid visual try-on remains available whenever the independent visual-render
prerequisites are satisfied.

This remains true for:

- `compatible`;
- `compatible_with_conditions`;
- `unknown`;
- `incompatible`;
- Fitment `processing`;
- Fitment operational failure;
- missing or incomplete technical evidence.

An incompatible technical verdict may strongly recommend replacing the wheel,
but it never disables, removes or invalidates the visual-render action.

### What changes in V2

V2 changes **when technical information is shown**, not whether Dream Wheels
permits the visual try-on.

Conceptually:

```text
V1 product order in the current application

Vehicle + Wheel
  -> Visual Render
  -> Fitment available separately / later


V2 target order

Vehicle + Wheel
  -> Standard Fitment attempt / result shown before render decision
  -> user chooses:
       - Create image anyway
       - refine technical data
       - retry a failed check
       - replace the wheel
```

The purpose of moving Fitment before Render is decision support before the user
spends a render, not permission control.

---

## 2. Verdict semantics preserved from Standard Fitment V1

V2 does not redefine the deterministic verdict engine.

### `compatible`

The available trusted evidence contains no known conflict under the Standard V1
rule set.

It remains a preliminary technical assessment, not an installation guarantee.

### `compatible_with_conditions`

A positive technical result with an explicit, known installation condition.

For the current **Standard V1** rule set, the implemented condition is:

```text
wheel DIA > vehicle hub bore
  -> compatible_with_conditions
  -> hub_rings_required
```

In user terms: the wheel can be used with centering / hub-centric rings.

This state must not be used as a generic bucket for uncertainty.

In particular:

```text
ET outside provider-derived interval
  != compatible_with_conditions
  -> unknown
```

because Standard V1 does not calculate physical inner/outer clearance.

### `unknown`

The check completed far enough to determine that the available trustworthy
technical evidence is insufficient for a positive or negative conclusion.

Examples from V1 include:

- missing or untrusted critical RimSpec fields;
- unconfirmed vehicle modification;
- missing provider reference data;
- ET outside the provider-derived interval;
- size outside the provider reference set where physical clearance is not
  modeled.

`unknown` is a technical evidence state. It is not an operational error and
never means `incompatible`.

### `incompatible`

A trusted hard conflict exists under the current deterministic rules.

Examples include:

- confirmed PCD / bolt-pattern mismatch;
- wheel center bore smaller than the vehicle hub bore.

An `incompatible` verdict never removes Visual Try-on.

### Operational failure is not a verdict

Timeout, network/proxy failure, provider 5xx, quota/rate-limit failure,
provider authentication failure and malformed provider response remain
operational states.

They must not be converted to `unknown`.

---

## 3. V2 state dimensions

The V2 flow is modeled as independent state dimensions. States inside one
dimension are mutually exclusive unless explicitly stated otherwise.

The frontend must derive presentation from authoritative domain/backend state.
It must not create a parallel heuristic verdict or render-readiness state.

---

## 3.1 Vehicle visual context

This dimension answers whether the application has the vehicle media required
for Visual Try-on.

| State | Meaning |
| --- | --- |
| `visual_missing` | No usable vehicle image is available |
| `visual_ready` | A usable vehicle image is available for Visual Try-on |

This dimension is intentionally separate from technical vehicle identity.

A car image may be sufficient for visual rendering while vehicle technical
identity is still incomplete or unresolved.

Source of truth: durable/current Vehicle media state.

---

## 3.2 Vehicle technical identity

The existing V1 semantics are retained:

| State | Meaning |
| --- | --- |
| `empty` | No usable VehicleIdentity exists |
| `unconfirmed` | A proposal exists but is not authoritative |
| `confirmed_incomplete` | Identity is confirmed but required technical context is incomplete |
| `confirmed_ready` | Identity is confirmed and ready for authoritative Standard Fitment operations |

Vehicle make/model/year/region edits invalidate the current technical
reference and any current Fitment verdict, but they do not invalidate the
vehicle image itself as a Visual Try-on asset.

Source of truth: persisted VehicleIdentity / current authoritative vehicle
selection.

---

## 3.3 Vehicle modification

Retain V1 states:

| State | Meaning |
| --- | --- |
| `none` | No modification selected or suggested |
| `suggested` | Non-authoritative candidate is proposed |
| `confirmed` | Modification is authoritative for current Vehicle Fitment Reference |

Selection source remains:

```text
wheel_size_single
user
vehicle_recognition  # future-only until separately validated
```

Only `confirmed` supports a positive Standard verdict. Lack of confirmation
may produce `unknown`; it never disables Visual Try-on.

---

## 3.4 Wheel visual context

This dimension answers whether a wheel image is available for Visual Try-on.

| State | Meaning |
| --- | --- |
| `visual_missing` | No usable wheel image exists |
| `visual_ready` | A usable wheel image exists |

A wheel may be visually ready even when its technical RimSpec is partial.

Source of truth: durable/current Wheel media state.

---

## 3.5 Wheel source

Product link and manual photo are equal first-class entry paths.

| State | Meaning |
| --- | --- |
| `none` | No wheel source supplied |
| `product_link` | Current Wheel originates from a product URL / SKU-capable source |
| `manual_photo` | Current Wheel originates from manual image upload |

A product link is not required for Visual Try-on.

The Wheel entity may store `source_link` when available for provenance,
deduplication/history and later editing.

---

## 3.6 Wheel source resolver / parser

This dimension is separate from Fitment execution.

| State | Meaning |
| --- | --- |
| `idle` | No active resolver operation |
| `resolving` | Product-link image/spec retrieval is in progress |
| `resolved_complete` | Resolver returned the required available source data |
| `resolved_partial` | Resolver returned usable but incomplete data |
| `failed` | Link parsing/resolution failed operationally |

Resolver failure is not Fitment `unknown`.

Required V2 recovery for `failed` exposes both options in the same state:

- try another product link;
- upload a wheel photo manually.

If a usable wheel image already exists, resolver failure alone must not remove
Visual Try-on.

Source of truth: rim-source resolver result / safe machine-readable parser
state.

---

## 3.7 RimSpec technical state

Preserve the V1 setup distinction while making provenance explicit.

### Completeness / confirmation

| State | Meaning |
| --- | --- |
| `empty` | No usable technical wheel fields persisted |
| `partial` | Some usable fields are persisted, but critical evidence is incomplete |
| `complete_unconfirmed` | Critical fields are present but not yet authoritative |
| `confirmed_ready` | Required critical Standard V1 fields are present and confirmed |

Critical Standard V1 fields remain:

- PCD;
- DIA;
- diameter;
- width;
- ET.

A partial RimSpec may still be checked and can yield `unknown`.

### Provenance

Each field keeps its real provenance/evidence level rather than a screen-level
fiction of confidence.

Typical sources may include:

- confirmed product-link/parser data when the product contract accepts it as
  trusted;
- user-confirmed value;
- recognition/parser suggestion requiring confirmation.

A new parser value must not silently overwrite an already confirmed field.

Source of truth: canonical persisted RimSpec fields plus their provenance /
confirmation state.

---

## 3.8 Standard Fitment technical readiness

This dimension answers whether a meaningful Standard Fitment attempt can be
started from the current technical context.

| State | Meaning |
| --- | --- |
| `not_ready` | A check request cannot yet be meaningfully formed |
| `ready` | The current technical context can be submitted to Standard Fitment |

`not_ready` never implies Visual Try-on is unavailable.

Example:

```text
vehicle image ready
wheel image ready
technical identity incomplete

=> render_ready
=> fitment_not_ready
```

This is an expected V2 combination, not an error.

---

## 3.9 Standard Fitment execution

| State | Meaning |
| --- | --- |
| `not_started` | No check has been requested for the current Vehicle + Wheel snapshot |
| `submitting` | Current check request is being submitted |
| `queued` | Check is queued |
| `processing` | Check is executing |
| `completed` | Check completed and has a technical verdict |
| `operational_failure` | Check did not complete due to an operational problem |

There is no technical verdict while execution is `submitting`, `queued` or
`processing`.

A previous verdict may be retained in history as an immutable Check snapshot,
but must not be presented as current for edited authoritative inputs.

Visual Try-on remains independently available while Fitment is processing or
has operationally failed.

Source of truth: current Check entity / backend execution state.

---

## 3.10 Fitment verdict

This dimension exists only for a successfully completed current Check.

```text
compatible
compatible_with_conditions
unknown
incompatible
```

Overall aggregation priority remains the V1 engine behaviour:

```text
1. trusted hard conflict       -> incompatible
2. critical unknown evidence   -> unknown
3. explicit known condition    -> compatible_with_conditions
4. otherwise                   -> compatible
```

Source of truth: persisted FitmentVerdict for the current immutable Check
snapshot.

---

## 3.11 Visual Render readiness

This dimension is deliberately independent from all Fitment dimensions.

| State | Meaning |
| --- | --- |
| `not_ready` | Visual rendering prerequisites are incomplete |
| `ready` | Visual rendering prerequisites are satisfied |

V2 invariant:

```text
render_readiness = function(visual_render_prerequisites)

render_readiness != function(fitment_verdict)
render_readiness != function(fitment_execution)
```

Examples:

| Fitment state | Render readiness may be `ready`? |
| --- | --- |
| not started | yes |
| processing | yes |
| compatible | yes |
| compatible_with_conditions | yes |
| unknown | yes |
| incompatible | yes |
| operational failure | yes |

Fitment must never mutate `ready -> not_ready`.

Source of truth: the existing authoritative render/create-flow prerequisites,
not a Fitment-derived frontend flag.

---

## 3.12 Currentness / stale state

Checks and Renders are immutable snapshots.

A current Check is tied to the exact technical Vehicle + Wheel input used when
it was evaluated.

| State | Meaning |
| --- | --- |
| `current` | Check matches the current authoritative technical snapshot |
| `stale_vehicle` | Vehicle technical input changed after the Check |
| `stale_wheel` | RimSpec / Wheel technical input changed after the Check |
| `stale_both` | Both changed |

A stale verdict stays available in history as evidence of the old Check but is
not the current verdict for the edited Vehicle + Wheel pair.

Editing does not rewrite historical Check snapshots.

Changing only imagery for a new visual render must not be assumed to change
technical currentness unless the underlying authoritative technical entity
also changes.

---

## 3.13 Dream Wheels session state

Retain V1 session-restoration semantics:

| State | Meaning |
| --- | --- |
| `authenticated` | Current Dream Wheels session is valid |
| `expired` | Dream Wheels session expired during an authenticated operation |
| `restoring` | User is re-authenticating |
| `restored` | Same semantic draft/context is restored |

After restoration:

- do not replay the previous provider or render action automatically;
- restore entered values and semantic context;
- let the user trigger the action again explicitly.

Provider authentication failure remains infrastructure failure, not Dream
Wheels user-session expiry.

---

## 4. Canonical V2 combinations

The dimensions above intentionally allow combinations that V1 UI could make
look contradictory.

### Visual-ready, technical-incomplete

```text
vehicle.visual = visual_ready
wheel.visual = visual_ready
rim_spec = partial
fitment = unknown OR not_ready
render = ready
```

Expected behaviour: Visual Try-on remains available; technical UI explains what
is missing or uncertain.

### Fitment processing, render ready

```text
fitment.execution = processing
render = ready
```

Expected behaviour: the technical check may continue, but `Создать
изображение` must not be disabled merely because Fitment is still running.

### Incompatible, render ready

```text
fitment.verdict = incompatible
render = ready
```

Expected behaviour:

- show the hard conflict clearly;
- offer `Выбрать другой диск` as a Fitment-specific recovery/decision action;
- keep `Создать изображение` available.

### Compatible with condition, render ready

```text
fitment.verdict = compatible_with_conditions
condition = hub_rings_required
render = ready
```

Expected behaviour:

- explain that centering rings are required;
- do not style the state as generic uncertainty;
- keep `Создать изображение` available.

### Operational failure, render ready

```text
fitment.execution = operational_failure
render = ready
```

Expected behaviour:

- say that the technical check could not be completed;
- offer `Повторить проверку`;
- keep `Создать изображение` available;
- do not display `unknown` as though a technical conclusion was reached.

---

## 5. V2 transition model

### First-use path

```text
vehicle visual input
  -> Wheel input
       -> product link
          OR manual photo
  -> wheel media ready

technical enrichment may proceed in parallel:
  VehicleIdentity / modification
  RimSpec resolver / confirmation

when Standard Fitment can be attempted:
  -> submitting
  -> queued / processing
  -> completed(verdict)
     OR operational_failure

at every point where render_readiness == ready:
  -> Create image remains available
```

The preferred V2 UX presents the Fitment attempt/result before the user makes
the render decision, but the technical path never becomes a permission gate.

### Product-link resolver failure

```text
product_link
  -> resolving
  -> failed
       -> try another link
       OR upload photo manually
```

If visual inputs are otherwise ready, Visual Try-on remains available.

### Incompatible wheel

```text
completed(incompatible)
   -> Create image                     # still allowed
   OR
   -> Choose another wheel
        -> link OR photo
        -> new/current Wheel
        -> new Fitment Check snapshot
```

The V2 release does not require:

- multi-wheel shortlist;
- marketplace catalog;
- partner replacement recommendations;
- in-app wheel purchase.

### Unknown

```text
completed(unknown)
   -> Create image                     # still allowed
   OR
   -> clarify the concrete missing/untrusted technical input
   OR
   -> retry/recheck when the unknown can be resolved by a new authoritative input
```

Do not use a generic `Уточнить параметры` action when the system can name the
actual next action more precisely.

### Operational failure

```text
operational_failure
   -> Retry Fitment
   OR
   -> Create image
```

---

## 6. Draft CTA mapping

This is a behavioural draft, not final copy/layout.

### Global rule

Whenever `render_readiness == ready`, an explicit Visual Try-on action remains
available regardless of Fitment state.

Current approved recurring action label:

```text
Создать изображение
```

### By technical state

| Technical state | Visual action | Fitment-specific action |
| --- | --- | --- |
| Fitment not started | `Создать изображение` available if render-ready | `Проверить совместимость` when check-ready |
| Fitment processing | `Создать изображение` available if render-ready | show current check progress; no duplicate submit |
| `compatible` | `Создать изображение` | optional details/recheck only when useful |
| `compatible_with_conditions` | `Создать изображение` | explain required centering rings / condition details |
| `unknown` | `Создать изображение` | resolve the concrete missing/uncertain evidence |
| `incompatible` | `Создать изображение` | `Выбрать другой диск` |
| operational failure | `Создать изображение` | `Повторить проверку` |

The table intentionally does **not** label `Создать изображение` as forbidden
or disabled for any Fitment state.

Final CTA hierarchy, exact placement and RU/EN copy belong to the later
State/CTA and Copy/Error matrix stages.

---

## 7. Source-of-truth matrix

| UI concern | Authoritative source |
| --- | --- |
| vehicle image readiness | persisted/current Vehicle media |
| wheel image readiness | persisted/current Wheel media |
| VehicleIdentity | persisted confirmed vehicle state |
| modification | provider-backed selected/confirmed modification |
| Wheel source | Wheel entity source metadata |
| parser state | rim-source resolver backend state/result |
| RimSpec values | canonical persisted RimSpec |
| RimSpec confirmation/provenance | canonical field evidence / confirmation |
| Fitment execution | current Check backend state |
| Fitment verdict | persisted FitmentVerdict for that Check snapshot |
| Check currentness | authoritative snapshot/version/currentness logic |
| render readiness | existing visual-render prerequisites |
| render balance/payment | existing server-backed cabinet/payment state |
| session | Dream Wheels authentication state |

The frontend must not derive a second technical verdict from displayed values
and must not derive render permission from Fitment.

---

## 8. V1 -> V2 delta

### KEEP

| V1 rule | V2 status | Notes |
| --- | --- | --- |
| Visual Try-on != Technical Fitment | **KEEP** | Becomes an explicit render-independence invariant |
| Fitment verdict never proves physical installation | **KEEP** | No wording may imply installation guarantee |
| `compatible / compatible_with_conditions / unknown / incompatible` | **KEEP** | Existing deterministic verdict vocabulary |
| operational failure != `unknown` | **KEEP** | Remains a separate execution/error state |
| false positive worse than `unknown` | **KEEP** | Conservative engine semantics unchanged |
| PCD/DIA/diameter/width/ET Standard V1 scope | **KEEP** | No rule expansion in this UI artifact |
| ET outside reference interval -> `unknown` | **KEEP** | Do not upgrade to a condition or hard conflict |
| DIA larger than hub -> hub rings condition | **KEEP** | Current Standard V1 `compatible_with_conditions` case |
| immutable Check semantics | **KEEP / STRENGTHEN** | V2 explicitly treats Check as snapshot attached to Vehicle + Wheel |
| session restoration without automatic replay | **KEEP** | Same user safety behaviour |
| exact technical values / no silent rounding | **KEEP** | Existing control contract remains relevant |
| parser conflict must not silently overwrite confirmed values | **KEEP** | Provenance remains explicit |

### CHANGE

| V1 behaviour | V2 draft behaviour |
| --- | --- |
| Fitment primarily exists as a separate/later flow relative to visual rendering | Fitment attempt/result is surfaced before the user's render decision |
| current UI context is strongly job/render-oriented | target product model uses persistent Vehicle + Wheel with Check and Render as separate snapshots |
| wheel input is primarily current create-flow upload context | V2 explicitly treats product link and manual photo as equal wheel entry paths |
| parser wait/failure is incidental to a later technical path | V2 requires a visible parser wait state and dual recovery paths |
| Fitment currentness follows the current technical context | V2 preserves this but formalizes immutable historical Check snapshots versus current Vehicle/Wheel edits |
| render/Fitment adjacency can visually suggest independence without order | V2 intentionally shows technical decision support earlier while preserving full render independence |

### SUPERSEDED IN V2 UI

These V1 presentation assumptions should not be copied mechanically into the
new pre-render flow:

| V1 assumption | V2 reason for superseding |
| --- | --- |
| Fitment may be entered mainly from/after an existing render context | V2 supports Check before any paid Render exists |
| Check identity must be anchored to a completed render `job_id` | target flow requires Check over a Vehicle + Wheel pair independently of Render |
| Fitment screen composition can assume a prior visual result exists | V2 must support pre-render Vehicle + Wheel context |
| UI can treat Render as an adjacent separate block after Fitment without explicit pre-render sequencing | V2 makes the decision-support order explicit |

### NOT SUPERSEDED

The following must **not** be misread as V2 changes:

- `incompatible` does not block Render;
- `unknown` does not block Render;
- `compatible_with_conditions` does not block Render;
- operational failure does not block Render;
- Fitment is not a checkout gate;
- Fitment is not an installation approval system;
- technical status does not change the semantic truth of the visual result.

---

## 9. Design-process checkpoint

Per `docs/ui/ui-development-process.md`, this artifact covers the next
required step only:

```text
Product/domain contract delta
  -> State inventory          # THIS DOCUMENT
  -> Text wireframe           # NEXT
  -> State/CTA matrix
  -> Copy/error matrix
  -> Interactive HTML prototype
  -> mobile 390px + desktop visual QA
  -> UI contract freeze
  -> runtime mapping/implementation
  -> state-based staging E2E
```

This document deliberately does not freeze:

- visual layout;
- component geometry;
- CTA hierarchy;
- exact user copy;
- responsive composition;
- runtime API changes.

---

## 10. Next artifact

The next design artifact should be the first V2 text wireframe, beginning with
the most behaviorally distinctive case:

```text
Pre-render Fitment
verdict = incompatible
reason = trusted PCD mismatch
render_readiness = ready
```

The wireframe must visibly preserve both truths at the same time:

1. the selected wheel is technically incompatible for the checked evidence;
2. the user may still create a paid visual try-on with that wheel.

It should also expose `Выбрать другой диск` as the Fitment-specific alternate
action without turning Dream Wheels into a wheel catalog or aggregator.

After that wireframe is approved, build the remaining verdict and operational
states using the same information hierarchy before creating the interactive
HTML prototype.
