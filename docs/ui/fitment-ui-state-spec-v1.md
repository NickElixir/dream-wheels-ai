# Standard Fitment UI State Specification V1

## Status and authority

```text
STANDARD_FITMENT_ARCHITECTURE = FROZEN
UI_DESIGN_BASELINE = FROZEN
UI_DEVELOPMENT_PROCESS = FROZEN
STANDARD_FITMENT_STATE_CTA_MATRIX = APPROVED
STANDARD_FITMENT_COPY_ERROR_MATRIX = APPROVED
INTERACTIVE_FITMENT_PROTOTYPE = CREATED
FITMENT_CONTROL_CONTRACT = IMPLEMENTED_IN_PROTOTYPE
FITMENT_PROTOTYPE_DESKTOP_QA = PASSED
FITMENT_PROTOTYPE_390_QA = PASSED
FITMENT_PROTOTYPE_FINAL_CORRECTIVE_QA = PASSED
FITMENT_PROTOTYPE_PRE_FREEZE_QA = PASSED
STANDARD_FITMENT_UI = FROZEN
```

This is the frozen behavioural reference for Standard Fitment UI runtime
implementation.

Authority order for this artifact:

1. [Fitment Verdict V1](../fitment/fitment-verdict-v1.md) defines Fitment
   product/domain meaning and remains authoritative.
2. [UI Design Code](../ui-design-code.md) defines visual language and
   terminology.
3. [UI Development Process](ui-development-process.md) defines the delivery
   process.
4. This specification defines the approved Vehicle/Modification UI states and
   wireframe decisions.
5. The frontend follows authoritative backend/domain state and `next_action`;
   it must not manufacture parallel readiness or selection states.

## Scope of this checkpoint

Approved here:

- Vehicle and modification state inventory;
- Vehicle/Modification text-wireframe decisions;
- RimSpec, Standard Check and verdict prototype-state presentation;
- State/CTA and Copy/Error matrices for prototype review;
- responsive prototype reference and desktop/390 px visual QA;
- Fitment–Render navigation contract;
- draft-preservation behaviour;
- quota retry-time presentation.

Explicitly not designed here:

- generation-provider, queue, debit/refund, retry or provider-failure UI from
  Phase 08;
- runtime data loading, persistence and implementation detail;
- an automatic UI contract freeze.

## APPROVED state inventory

State dimensions are independent only where stated below. States within one
dimension are mutually exclusive.

### Vehicle identity

| State | Meaning |
| --- | --- |
| `empty` | No usable vehicle identity is present in the Fitment context |
| `unconfirmed` | A proposal exists but the user has not confirmed VehicleIdentity |
| `confirmed_incomplete` | VehicleIdentity is confirmed but the current fitment operation lacks required confirmed vehicle data |
| `confirmed_ready` | VehicleIdentity is confirmed and ready for the next authoritative vehicle/modification operation |

A VLM proposal is never a confirmed VehicleIdentity. A confirmed
VehicleIdentity is not, by itself, a confirmed modification.

### Vehicle form transient state

| State | Meaning |
| --- | --- |
| `clean` | Form values equal the currently saved values |
| `dirty` | Valid or invalid edits exist locally and have not been saved |
| `saving` | The current values are being saved |
| `save_failed` | The attempted save did not complete; the user can correct or retry |

These are transient UI states, not durable domain entities. Before Wheel Size
modifications are loaded, the current make, model, year and region form values
must validate and save successfully.

`dirty` means only that unsaved local edits exist. It never by itself turns a
field red or exposes validation copy. Validation presentation is a separate
`valid | invalid` state: a red border and inline error appear only after an
explicit validation attempt or when a required value is actually absent.

### Modification state

| State | Meaning |
| --- | --- |
| `none` | No modification has been selected or suggested |
| `suggested` | A non-authoritative candidate is visibly proposed |
| `confirmed` | The selected modification is authoritative for the current Vehicle Fitment Reference |

A suggested modification is never authoritative. Only `confirmed` may be
used as the Vehicle Fitment Reference for a positive Standard verdict.

### Modification lookup state

| State | Meaning |
| --- | --- |
| `idle` | No active modification lookup |
| `loading` | The modifications request is in progress |
| `loaded` | Candidates have been received |
| `no_match` | The provider has no record for the selected vehicle |
| `failed` | The lookup operationally failed |

`loading`, `no_match`, `failed` and session-expired are mutually
exclusive UI states for the lookup area. Provider `failed`, `no_match` and
technical fitment `unknown` are distinct: they must not use each other's
presentation or meaning.

### Selection source

```text
wheel_size_single
user
vehicle_recognition  # future
```

- Exactly one Wheel Size candidate becomes
  `modification_state = confirmed` with
  `selection_source = wheel_size_single`. The automatically selected value is
  always shown explicitly and can be changed or rechecked.
- With multiple candidates, the first may be visually presented first, but
  Wheel Size ordering is not a probability ranking. Its initial state is
  `suggested`.
- An explicit user choice changes the state to `confirmed` with
  `selection_source = user`.
- `selection_source = vehicle_recognition` is future-only. Before its
  separate quality gate, it can only produce a suggestion and can never
  silently confirm a modification.

Changing make, model, year or region invalidates the selected modification,
Vehicle Fitment Reference and current verdict, while preserving RimSpec.

## APPROVED control contract

```text
VEHICLE_REGION_CONTROL = PROVIDER_BACKED_SELECT
VEHICLE_YEAR_CONTROL = PROVIDER_BACKED_SELECT
RIM_DIAMETER_CONTROL = PRESET_SELECT_WITH_CUSTOM
RIM_WIDTH_CONTROL = PRESET_SELECT_WITH_CUSTOM
RIM_DIA_CONTROL = SEARCHABLE_PRESETS_WITH_CUSTOM
RIM_ET_CONTROL = EXACT_NUMERIC_INPUT
RIM_PCD_CONTROL = CONSTRAINED_PRESETS_WITH_CUSTOM
PRESET_OPTIONS_ARE_NOT_DOMAIN_VALIDATION_WHITELISTS
```

- Vehicle region is a constrained, localised select backed by Wheel Size
  `/regions/`. The supported provider regions are Russia+, Europe, USA+,
  Canada, Mexico, Central & South America, Japan, China, South Korea,
  Southeast Asia, Middle East, North Africa, South Africa and Oceania. The
  presentation begins Russia+, Europe, USA+, Japan and China; Russia+ is the
  default.
- Vehicle year is a cascading select backed by Wheel Size `/years/` for the
  selected make, model and region. A Fitment lookup never accepts an arbitrary
  year. For the Porsche Cayenne E3 / Russia+ prototype scenario the available
  years end at 2023; the prototype does not present 2024–2026 as that exact
  scenario's provider-backed choices. The prototype deliberately has no
  synthetic `/years/` data for the other regions: it shows a neutral
  unavailable-demo state, leaves year empty and cannot save or start a lookup
  until provider-backed year data exists.
- Diameter and width use market-common V1 presets plus `Другое значение` and
  an exact numeric input. PCD uses constrained bolt-count and PCD-mm presets
  with an exact custom pair. A parser or manual value outside a preset is kept
  exactly and must never be rounded or replaced by a closest option.
- DIA is a searchable combobox with the approved common exact presets and an
  always-available exact entry. `63,3`, `63,35`, `63,4`, `66,45`, `66,5` and
  `66,6` are different values and are never rounded.
- ET remains an exact numeric input. Decimal values such as `45,5` and `47,5`
  are allowed. Russian display uses comma decimals while the canonical value
  retains its exact precision.
- Presets improve input speed only. They are neither a RimSpec domain
  whitelist nor a technical compatibility verdict.

The preliminary Standard Fitment disclaimer remains an INFO island with the
existing restrained blue translucent pattern. It is not a warning or error.

## APPROVED text-wireframe decisions

`WIREFRAME_VEHICLE_MODIFICATION = APPROVED`

Standard Fitment is one progressive screen:

```text
Автомобиль
  VehicleIdentity
  modification selection / lookup state

Колесный диск
  visible progression context

Совместимость
  visible progression context
```

- VehicleIdentity and modification belong to the same `Автомобиль` section.
- Later sections remain visible as progression context; this checkpoint does
  not define their internal UI.
- Multiple modifications appear as vertically arranged readable cards, never a
  dropdown.
- When provider data is present, a candidate card may show modification/trim,
  engine, fuel, power, years/generation and market.
- `suggested` and `confirmed` have visually distinct state treatment.
- A single auto-confirmed candidate stays visible and includes a way to change
  or recheck it.
- After confirmation, the vehicle/modification block may become a compact
  summary.
- Loading, no-match, provider failure and session-expired are mutually
  exclusive. This does not define final CTA placement or full copy.

## APPROVED prototype state, CTA and copy/error matrices

`STANDARD_FITMENT_STATE_CTA_MATRIX = APPROVED`

`STANDARD_FITMENT_COPY_ERROR_MATRIX = APPROVED`

The complete visual reference is
[Standard Fitment V1 interactive prototype](../references/standard-fitment-v1.html).
It is synthetic demo data, not a frontend source of truth. This section is the
behavioural summary; the frozen Fitment domain contract remains authoritative
where a product rule is involved.

| Area | Mutually exclusive UI states | Main available action / guard |
| --- | --- | --- |
| Vehicle | `empty`, `unconfirmed`, `confirmed_incomplete`, `confirmed_ready`; form `clean`, `dirty`, `saving`, `save_failed` | Save precedes lookup; missing year/region stays local validation; VLM is never confirmed by appearance |
| Modification | lookup `idle`, `loading`, `loaded`, `no_match`, `failed`; selection `none`, `suggested`, `confirmed` | One Wheel Size candidate is visibly auto-confirmed; several candidates require an explicit card choice |
| RimSpec | resolver `idle`, `resolving`, `resolved`, `failed`; variant `not_applicable`, `none`, `selection_required`, `selected`; setup `empty`, `partial`, `complete_unconfirmed`, `confirmed_ready` | Manual entry starts as a local draft and must be saved first; persisted partial input can run Standard Check, while complete suggested/entered fields require confirmation |
| Standard Check | `idle`, `submitting`, `queued`, `processing`, `completed`, `failed` | Submit/queue/process never show a verdict and do not permit a duplicate submit; `Создать изображение` remains independent |
| Verdict | `compatible`, `compatible_with_conditions`, `unknown`, `incompatible` | Every verdict exposes field-level evidence; a positive result requires confirmed vehicle modification and confirmed RimSpec where required by the domain contract |
| Session and stale | session-expired; vehicle changed; RimSpec changed; new URL/SKU | Restore the same semantic Fitment state without automatic replay; old verdict is non-current after authoritative input changes |

### RimSpec and verdict presentation

While manual wheel entry is open, `Сохранить параметры` is its primary action
and Standard Check is unavailable. Saving transitions to either `partial`
(Check may be started) or `complete_unconfirmed` (confirmation is required
before Check). Only a persisted `confirmed_ready` setup shows the ordinary
Check action.

- Manual RimSpec fields are diameter, width, structured PCD (bolt count plus
  millimetres), ET and DIA. Russian decimals use commas. Technical series use
  `20" / 8,5J / 5×130`.
- A resolver result is a suggestion, not confirmation. Resolver failure is:
  `Не удалось определить параметры автоматически` with the approved recovery
  actions `Заполнить параметры вручную` and `Повторить`.
- A new parser value never silently overwrites a confirmed field. A parser/user
  conflict presents the current confirmed value and an explicit keep/use
  choice; choosing the new value returns it to confirmation-required state.
- Uniform and staggered configurations are distinct. Staggered presentation
  exposes front and rear RimSpec separately; overall confirmation requires all
  relevant axles to be confirmed.
- Field statuses are `Подходит`, `Требуется условие`, `Недостаточно данных`
  and `Конфликт`. PCD comparison, DIA exact/larger/smaller, ET inside/outside
  reference range and size outside reference are all demonstrated.
- ET outside the provider interval remains `unknown`, never a conditional
  positive verdict. The UI asks for a separate inner and outer clearance
  check; it does not imply that clearance was calculated.

### Copy and recovery mapping

| UI category | User copy | Recovery |
| --- | --- | --- |
| Provider unavailable | `Сервис технической проверки совместимости временно недоступен` | `Попробуйте ещё раз` |
| Network/timeout/proxy | `Не удалось связаться с сервисом технической проверки совместимости` | `Повторить` |
| General operational fallback | `Не удалось выполнить техническую проверку совместимости` | `Попробуйте ещё раз` |
| Rate limit with `retry_at` | `Лимит запросов обновится примерно через 7 часов` | Relative time only |
| Rate limit without reliable time | `Сервис технической проверки совместимости временно недоступен` | `Попробуйте позже` |
| Dream Wheels session expiry | `Сессия истекла` | `Войти через Telegram`, then restore draft without replay |

No mapping uses generic `Сбой`, raw provider diagnostics or an invented
countdown. The prototype applies the UI Design Code punctuation and separator
rules: a standalone block has no terminal full stop; technical series use a
slash, natural-language metadata lists use commas, and explanatory comparison
uses an en dash rather than `·`.

## Interactive prototype and visual QA

`INTERACTIVE_FITMENT_PROTOTYPE = CREATED`

The self-contained review artifact is
[standard-fitment-v1.html](../references/standard-fitment-v1.html). Its
separate demo controller is not production UI.

Desktop QA covered the happy path, multiple modification cards, resolver
failure, partial RimSpec, multiple SKU selection, each verdict, provider
failure, session restoration, stale context and return from Rendering.

390 px QA covered vehicle selection, multiple modifications, manual RimSpec
entry, partial state, verdict detail, session, operational error and Render
CTA. It passed without horizontal overflow, clipped copy, navigation overlap
or safe-area conflict.

`Prototype V1`, `Demo controls`, `Standard Fitment – demo state` and the
unavailable-demo year helper belong only to the review harness. They are not
runtime copy.

## APPROVED Fitment–Render navigation contract

1. Standard Fitment is optional for visual try-on.
2. Render readiness is independent of Fitment readiness.
3. `Создать изображение` does not start Standard Fitment automatically.
4. Leaving for Rendering preserves the current Fitment context.
5. The user may continue Fitment while an image is being created.
6. Processing and result return to the same Standard Fitment context.
7. The contextual Fitment action is:

   ```text
   not_started → Проверить совместимость
   incomplete  → Продолжить проверку
   completed   → Открыть проверку
   ```

8. Any Fitment verdict does not block visual try-on.
9. One VehicleIdentity and RimSetup correspond to one current Fitment context.
10. Changing authoritative vehicle or rim input makes the prior verdict
    non-current.
11. Provider-specific generation states, queue, debit/refund, retry and
    provider failures remain Phase 08.

## APPROVED draft preservation

A valid entered Fitment draft that is not yet confirmed is not lost when the
user leaves for Rendering and returns.

Restoring a draft does not raise confirmation or provenance. The storage
mechanism is intentionally unspecified until the domain contract requires one.
Transient UI state—such as loading, `dirty`, or an open selector—is not a
durable domain entity.

## APPROVED quota UI behaviour

When the backend supplies a reliable `retry_at`, the frontend computes and
shows relative time, for example:

```text
Лимит запросов обновится примерно через 7 часов
Лимит запросов обновится примерно через 40 минут
```

When retry time is unknown, the UI must not invent a deadline. User-visible
copy follows the terminal-full-stop rule in the UI Design Code.

## Runtime implementation checkpoint

The UI contract is frozen. The next step is Slice 2 runtime work on the
provider-backed Vehicle catalogue and state API. It must not change the frozen
Fitment architecture or silently alter this approved behavioural reference.

```text
VEHICLE_MODIFICATION_STATE_INVENTORY = APPROVED
VEHICLE_MODIFICATION_WIREFRAME = APPROVED
FITMENT_RENDER_CROSS_FLOW = APPROVED
STANDARD_FITMENT_STATE_CTA_MATRIX = APPROVED
STANDARD_FITMENT_COPY_ERROR_MATRIX = APPROVED
INTERACTIVE_FITMENT_PROTOTYPE = CREATED
FITMENT_CONTROL_CONTRACT = IMPLEMENTED_IN_PROTOTYPE
FITMENT_PROTOTYPE_DESKTOP_QA = PASSED
FITMENT_PROTOTYPE_390_QA = PASSED
FITMENT_PROTOTYPE_FINAL_CORRECTIVE_QA = PASSED
FITMENT_PROTOTYPE_PRE_FREEZE_QA = PASSED
STANDARD_FITMENT_UI = FROZEN
NEXT = Slice 2 — Vehicle catalogue and state API
```
