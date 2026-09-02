# Standard Fitment UI State Specification V2 — Frozen Contract

## Status and authority

```text
STANDARD_FITMENT_V2_ARCHITECTURE = FROZEN
STANDARD_FITMENT_V2_STATE_CTA_MATRIX = FROZEN
STANDARD_FITMENT_V2_COPY_ERROR_MATRIX = FROZEN
STANDARD_FITMENT_V2_REFERENCE = FROZEN
STANDARD_FITMENT_V2_REFERENCE_STATUS = APPROVED
STANDARD_FITMENT_UI_V2 = FROZEN
UI_V2_FROZEN = YES
```

This is the frozen V2 UI contract for the Standard Fitment screen. It records
explicit product approval for the UI/UX contract and prototype reference. It
does not replace the canonical V1 domain/API contracts or create a new backend
domain contract.
The `STANDARD_FITMENT_UI = FROZEN` status in the V1 artifact applies to that
already-versioned V1 checkpoint; this V2 document records the separate V2
freeze approved above.

Authority remains:

1. [Fitment Verdict V1](../fitment/fitment-verdict-v1.md) for product and
   domain meaning
2. [Fitment API Contract V1](../fitment-api-contract-v1.md) for API responses,
   snapshots, lifecycle and machine codes
3. [UI Design Code](../ui-design-code.md) for visual language, terminology and
   responsive boundaries
4. This document for the frozen V2 interaction composition and handoff
5. The [frozen V2 prototype](../references/standard-fitment-v2-realistic-prototype.html)
   for rendered visual reference

## Scope

V2 is one Standard Fitment screen composed as:

```text
Context + Focus
  → Vehicle / Rim preview pair
  → free Section Navigator
  → one active workspace
  → independent secondary Render action
```

The prototype is a self-contained review harness. `Demo`, the scenario
controller and synthetic preview artwork are review-only metadata/assets; they
are not production UI or a runtime source of truth.

## Architecture contract

- Keep one Standard Fitment screen with the current vehicle and rim context
- Keep large vehicle and rim previews; on mobile they remain side by side
- Use one Section Navigator with `Автомобиль`, `Колесный диск`, `Вывод`
- Treat the navigator as free focus navigation, not a stepper
- Render one active workspace at a time; an editor replaces its summary or
  warning state rather than nesting a second workspace
- Keep technical details behind progressive disclosure
- Keep rendering independent from technical fitment; no verdict blocks
  `Создать изображение`
- Let backend `next_action` remain authoritative; the frontend must not create
  a parallel readiness model

## Navigation and availability

Section clicks change UI focus only. They do not save values, confirm data,
mutate domain state, start Standard Check or replace `next_action`.

`Вывод` is always navigable. Before a current or historical check/result exists,
it renders readiness or recovery guidance derived from the server
`next_action`; it must not invent a verdict or a check. Once a check/result
exists, the same section renders the current, queued, processing, failed or
stale technical result. A stale result remains readable and is presented as
`Нужно проверить заново`.
Changing authoritative Vehicle/Rim/modification/source data invalidates the
current verdict while preserving the historical snapshot.

## State and CTA matrix

The user-facing action is a rendering of the authoritative backend action. The
prototype scenarios simulate the returned action for review; runtime must use
the server response directly.

| Backend `next_action.kind` | User-facing action | V2 behaviour |
| --- | --- | --- |
| `complete_vehicle_details` | `Сохранить автомобиль` / `Подтвердить данные` | Save the current authoritative vehicle values before requesting modification data |
| `select_vehicle_variant` | `Подтвердить комплектацию` | Show readable alternatives; selection is explicit and is not probability ranking |
| `complete_rim_specs` | `Сохранить параметры` | Save the rim editor state explicitly; do not start Standard Check automatically |
| `run_standard_check` | `Проверить совместимость` | Separate explicit user action; create the check from the persisted snapshot |

### Vehicle

- Proposal state says `Автомобиль определён по фотографии`
- The next instruction is rendered as separate lines: `Проверьте найденные
  данные` and `Если всё верно, подтвердите их`
- A proposal is not authoritative confirmation
- Edit mode replaces the summary with one form and one primary save CTA
- Draft make, model and year values survive section navigation without becoming
  confirmed data

### Modification

- One candidate may be auto-confirmed only by the backend rule for an exact
  single result
- Multiple candidates are explicit selectable cards, never a probability
  ranking
- A confirmed modification is bound to the saved Vehicle revision

### Rim

- Read mode shows the saved summary and one source/technical-data disclosure
- Edit mode replaces the summary with one rim editor
- The editor exposes diameter, width, PCD, ET and DIA without a nested second
  workspace
- Resolver output remains a suggestion until explicit save/confirmation
- Resolver failure uses `Не удалось определить параметры автоматически` and
  `Это не блокирует проверку — укажите параметры колесного диска вручную`
- Recovery actions are `Заполнить параметры вручную` and `Повторить`
- Manual fallback replaces the warning workspace with one editor, one primary
  `Сохранить параметры` CTA and one source/technical-data disclosure

### Save and check lifecycle

```text
local draft
  → explicit Сохранить параметры
  → Ready state / backend next_action
  → explicit Проверить совместимость
  → submitting / queued / processing
  → completed or failed result
```

Draft autosave never confirms a section, calls a provider, starts a check or
opens a confirmation modal. Processing has no verdict, no disabled duplicate
CTA and no placeholder verdict.

## Draft contract

The reviewed prototype preserves these unsaved values in bounded browser draft
storage:

- Vehicle: make, model, year
- Rim: ET, DIA

Draft restoration is UI convenience only. It must not mutate authoritative
VehicleIdentity, RimSpec, RimSetup, modification, provenance or check state.
Runtime persistence and restoration must be keyed to the Fitment context and
current revision, with no automatic replay after session restoration.

## Verdict and rendering presentation

Supported result families are `compatible`, `compatible_with_conditions`,
`unknown`, `incompatible` and stale/currentness presentation. The hierarchy is:

```text
verdict
  → short reason
  → decision-relevant evidence
  → technical-details disclosure
  → disclaimer or recovery
```

The main level does not become a large technical table. Operational provider
failure remains distinct from technical `unknown`. Incompatible fitment does
not block visual rendering and keeps this contextual explanation:

`Вы все еще можете создать изображение, чтобы оценить внешний вид дисков`

The independent Render block uses:

`Визуальная примерка`

with the helper `Посмотрите, как выбранный диск выглядит на вашем автомобиле`.

with the secondary CTA `Создать изображение`.

## Copy and error matrix

Approved V2 copy remains:

| Context | Copy |
| --- | --- |
| Vehicle proposal | `Автомобиль определён по фотографии` |
| Vehicle instruction | `Проверьте найденные данные` / `Если всё верно, подтвердите их` |
| Rim partial | `Часть параметров необходимо проверить` |
| Resolver failure | `Не удалось определить параметры автоматически` |
| Resolver recovery | `Это не блокирует проверку — укажите параметры колесного диска вручную` |
| Resolver CTA | `Заполнить параметры вручную` / `Повторить` |
| Provider failure | `Сервис технической проверки совместимости временно недоступен` |
| Incompatible rendering | `Вы все еще можете создать изображение, чтобы оценить внешний вид дисков` |
| Render helper | `Посмотрите, как выбранный диск выглядит на вашем автомобиле` |

Copy follows the canonical no-terminal-full-stop rule. Technical series use
Russian decimal commas and slash-separated metadata.

## Responsive reference

- `390 px`: the preview pair remains readable side by side; navigator labels
  remain fully readable; Vehicle and Rim editors use one column; primary CTA,
  disclosure and bottom navigation remain reachable; no horizontal overflow
- `1280 px`: desktop sidebar/content relationship, large preview pair and
  workspace density remain balanced
- `1440 px`: additional space does not create a competing hierarchy; verdict,
  evidence and Render action retain their relative weight
- The prototype controller is collapsible review harness only and must not be
  used to judge production layout density

## Runtime validation handoff

The following are implementation validations, not new V2 design decisions:

1. Bind each UI primary action to the server `next_action.kind`, persisted
   revisions and authoritative field provenance; do not replace it with local
   readiness inference. Implement provider-backed Vehicle controls and exact
   Rim preset/custom parsing according to the V1 API/control contracts.
2. Complete authenticated E2E for queued/processing/completed/failed checks,
   stale/currentness, Fitment ↔ Rendering return, bounded draft restoration
   and session expiry without automatic replay.

No production runtime file is changed by this handoff.

## Approved corrective amendment — 2026-08-31

The Phase 07B-G2 runtime correction preserves the frozen V2 composition while
making the server-owned state boundaries explicit:

- `complete_vehicle_details` is the Vehicle confirmation state;
  `select_vehicle_variant` is the separate catalogue-selection state; and
  `confirmed_ready` is reached only after the authoritative vehicle details
  and exact variant are confirmed.
- The UI does not show `Выберите комплектацию` during
  `complete_vehicle_details`, and it does not render an empty modification
  picker when the catalogue has no candidates. A no-match outcome provides a
  recovery action to edit the vehicle data.
- Recognized vehicle copy is rendered as three separate lines:
  `Автомобиль определён по фотографии`, `Проверьте найденные данные`, and
  `Если всё верно, подтвердите их`. Internal suggested/proposed provenance is
  not exposed as a user-facing state.
- Explicit vehicle confirmation sends the vehicle payload even when the user
  has not edited a prefilled proposal. The response remains authoritative;
  `Сохранить параметры` never starts a Standard Check, and
  `Проверить совместимость` remains the only explicit check action.
- A stale result is recoverable through the next server action: vehicle
  confirmation, vehicle-version selection, or rim-parameter clarification.
  Recovery leads to a new explicit check and does not silently mutate data.
- The Render island is a DOM sibling of the Fitment island. Its normal copy is
  `Визуальная примерка` with
  `Посмотрите, как выбранный диск выглядит на вашем автомобиле`; its CTA is a
  secondary outlined `Создать изображение`. Incompatible fitment keeps the
  approved render explanation and does not block rendering.

The existing neutral info surface is reused for the technical disclaimer;
there is no dedicated canonical info token in the current cabinet stylesheet:

`CANONICAL_INFO_TOKEN = NOT_FOUND`

## Approved corrective amendment — 2026-08-31 (G2.1)

This amendment supersedes the earlier pre-check Result gate. The current
authority is `Result always navigable`; before the first Check, Result is a
readiness/recovery surface derived from `overview.next_action`, not a verdict
placeholder. The frozen prototype reference may still show the older gate;
this runtime amendment supersedes that prototype behaviour for pre-check
navigation.

- Variant CTA copy is `Выбрать комплектацию`. Variant cards place secondary
  technical context first and the selected variant name on its own final bold
  line without duplicating that name in metadata.
- Explicit variant confirmation rereads the authoritative overview, keeps the
  Vehicle section active, and exposes the selected `Комплектация / <name>` in
  the confirmed Vehicle summary. It does not auto-advance to Rim.
- Explicit Save and variant confirmation preserve the current valid section;
  section tabs remain focus navigation only. Result actions that lead to
  Vehicle or Rim only change focus. Only `Проверить совместимость` starts a
  Standard Check.
- With no Check, Result maps `complete_vehicle_details` to
  `Проверка ещё не выполнена` / `Сначала подтвердите данные автомобиля`,
  `select_vehicle_variant` to `Проверка ещё не выполнена` /
  `Сначала выберите комплектацию автомобиля`, `complete_rim_specs` to
  `Проверка ещё не выполнена` / `Сначала уточните параметры колесного диска`,
  and `run_standard_check` to `Данные готовы для проверки` /
  `Автомобиль и параметры колесного диска подтверждены`.
- Source and technical data remain a lightweight disclosure with an unchanged
  label, no visual arrows, native keyboard access, `aria-expanded` and
  `aria-controls`.
- Preview text remains left-aligned while preview images remain contained and
  centered. Render remains an independent neutral secondary sibling with the
  outlined `Создать изображение` CTA and no second lime primary action.

```text
G2_1_PRODUCT_APPROVAL = PENDING
READY_FOR_PRODUCT_REVIEW = YES
UI_V2_FROZEN = NOT_RECONFIRMED_FOR_G2_1
```

## Clarifying invariant — 2026-08-31 (G2.2)

`Источник и технические данные` is progressive disclosure for secondary Rim
information. If the disclosure is rendered, opening it must reveal at least
one meaningful source, provenance, editable-control, resolver-status, or
technical-summary row. If no such content exists in the current state, the
disclosure is omitted. Absence of `product_url` is not by itself evidence of
manual provenance; when provenance is not established, the source label is
`Не указан` alongside any known technical values.

## Approved Result simplification amendment — 2026-08-31

Phase 07B-G2.3 is a corrective content pass within the frozen V2 composition.
It does not change Fitment domain semantics, verdict semantics, the backend
`next_action` contract, resolver behaviour, Vehicle/Rim flows or Render
architecture.

The completed current Result hierarchy is:

```text
verdict
  → short human-readable explanation
  → one compact decision-relevant evidence group
  → one condition/problem group only when backend evidence requires it
  → subdued warning/disclaimer footer
  → secondary bottom re-check action
```

The Result eyebrow `РЕЗУЛЬТАТ`, the old main Result `Технические детали`
disclosure and the standalone generic advisory `Обратите внимание` layer are
removed. The verdict is the first Result heading and uses the existing cabinet
typography scale. Conditional evidence uses a single accented condition
island at most; multiple backend conditions remain inside that one group.

The presentation adapter may map a known backend evidence code to a
human-readable explanation, such as a centering-ring condition. It must not
infer a technical cause from the verdict class alone, calculate Fitment
semantics, change the verdict class or create a condition. Unknown recovery
shows only backend-provided missing evidence and the authoritative recovery
action. Stale and operationally failed checks remain distinct from current
completed Result states.

The mandatory warning/disclaimer copy may move from above the evidence into a
single subdued Result footer-zone. Its exact canonical warning, legal and
commercial wording remains governed by the higher-priority commercial warning
authority in [`05-commercial-ux-warnings.md`](../handoffs/05-commercial-ux-warnings.md)
and any authority it references; this V2 specification does not freeze a
conflicting duplicate wording.

`Проверить ещё раз` remains the existing explicit Check path, is shown only
when the server action permits it, and is a secondary outlined action at the
bottom of the current Result. The Render island remains an independent DOM
sibling outside the Fitment Result island.

## Approved Vehicle UI clarification amendment — 2026-09-01

The Vehicle workspace keeps base vehicle identity and catalogue modification
as two independent presentation groups. `Основные данные` contains only the
make, model, year and market summary and uses the explicit `Изменить
автомобиль` action. `Комплектация` contains the server-selected catalogue
variant and uses the explicit `Изменить комплектацию` action. Generic
`Изменить` and `Изменить данные` labels are not used for these controls.

The basic Vehicle editor exposes only make, model, year and market. Body,
generation and modification remain server-owned catalogue context; they are
not editable base fields and are not reserialized by the basic Vehicle
payload. Changing base vehicle identity continues to follow the existing
server-owned invalidation and `next_action` semantics.

The variant list may remove duplicate presentation entries using canonical
provider identity, with a display-only fallback for legacy entries. This does
not merge distinct canonical variants, alter variant payloads or decide
Fitment semantics. The confirmed modification reselection flow, Rim state,
Render sibling and all backend contracts remain unchanged.

## Approved Result disclaimer info-card amendment — 2026-08-31 (G2.3.1)

The Result disclaimer is presented after the decision-relevant Result content
as one calm blue informational surface and before the bottom secondary
`Проверить ещё раз` action. It is not a warning, error, success state or CTA.
The surface uses background, restrained padding and radius; thin separator
lines before or after the disclaimer are not used, and no standalone advisory
heading is added. The disclaimer remains a single presentation with no
duplicate copy elsewhere in the completed Result.

This amendment changes only visual treatment and placement. Exact canonical
warning, legal and commercial wording remains governed by the higher-priority
commercial warning authority in
[`05-commercial-ux-warnings.md`](../handoffs/05-commercial-ux-warnings.md)
and any authority it references. The warning wording and Fitment semantics are
unchanged.

## Freeze record

The product owner explicitly approved this V2 UI/UX contract on 2026-08-29.
The approval covers the design contract and prototype reference only; runtime
implementation remains a separate phase.

```text
STANDARD_FITMENT_V2_REFERENCE = FROZEN
STANDARD_FITMENT_V2_REFERENCE_STATUS = APPROVED
STANDARD_FITMENT_UI_V2 = FROZEN
UI_V2_FROZEN = YES
```

## Approved corrective slice — 2026-09-01

The confirmed Vehicle modification can be changed through one inline
reselection control. The current authoritative modification is shown in the
Vehicle summary; `Изменить` opens a read-only candidate list and marks the
current candidate as selected. Opening and closing the list never changes
persisted state, revisions, currentness or `next_action`.

Selecting a different candidate is the explicit replacement action. The
backend performs a confirmed-to-confirmed atomic replacement using canonical
provider identity and revision/current-selection preconditions. A same-value
selection closes the list without a meaningful mutation. The Vehicle section
remains active after a successful replacement; the base Vehicle fields, Rim
data and Render state are preserved, while Check currentness is determined by
the existing backend snapshot identity. There is no additional confirmed
reselection confirmation or cancel action. The initial suggested-variant flow
and its existing confirmation semantics remain unchanged.

Synthetic guest/demo identifiers are local presentation context and must not
be sent to real `/jobs/{job_id}/fitment` routes. Fitment route lookup validates
the path identifier before a database UUID cast and returns the documented
controlled `422 invalid_job_id` response for malformed IDs.

This slice changes presentation and safe modification transport only. It does
not change verdict semantics, Fitment domain semantics, Rim semantics,
Rendering semantics or the backend `next_action` contract.

Warning, legal and commercial copy may be repositioned by the Result layout,
but its exact wording remains governed by the higher-priority commercial
warning authority in [`05-commercial-ux-warnings.md`](../handoffs/05-commercial-ux-warnings.md)
and any authority it references. This specification must not freeze a
conflicting duplicate disclaimer.

## Vehicle UI final corrective amendment — 2026-09-02

Vehicle market presentation keeps the user-facing label separate from the
provider value. Catalogue labels are authoritative when available; known
legacy values such as `CN` are resolved to the canonical catalogue option for
display and request construction, so the editor shows `Китай` while the API
continues to receive the provider value (for example, `chdm`). No market
label is used as a catalogue query value.

The Vehicle catalogue cascade remains server/provider-owned:
`Рынок → Марка → Модель → Год`. Changing a parent selection clears and
aborts stale downstream lookups before loading the next child catalogue.
Persisted values not present in a loaded response are not retained as valid
options. An empty provider response is represented as neutral `no_data` with
an empty disabled year control; a provider failure remains a technical
failure state and is not relabelled as `no_data`. Duplicate year records are
deduplicated at the catalogue presentation boundary without inventing years
or changing provider semantics.

Dropdown changes remain an unsaved local draft and do not issue a Vehicle
PATCH; the existing explicit save action remains the mutation boundary. The
mobile page uses the shared safe-bottom spacing so the Vehicle save action and
Result/Render content remain above the fixed bottom navigation.

This amendment is presentation/state hygiene only. It does not change Vehicle
or Fitment domain semantics, verdict semantics, provider meaning or the
`next_action` contract. Warning, legal and commercial copy may be repositioned
by the UI, but its exact canonical wording remains governed by the
higher-priority commercial warning authority in
[`05-commercial-ux-warnings.md`](../handoffs/05-commercial-ux-warnings.md)
and any authority it references.
