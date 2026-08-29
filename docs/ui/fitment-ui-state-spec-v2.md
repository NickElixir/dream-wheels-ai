# Standard Fitment UI State Specification V2 — Candidate Handoff

## Status and authority

```text
STANDARD_FITMENT_V2_ARCHITECTURE = REVIEWED
STANDARD_FITMENT_V2_STATE_CTA_MATRIX = SYNCED
STANDARD_FITMENT_V2_COPY_ERROR_MATRIX = SYNCED
STANDARD_FITMENT_V2_REFERENCE = REVIEWED
STANDARD_FITMENT_V2_REFERENCE_STATUS = AWAITING_PRODUCT_APPROVAL
STANDARD_FITMENT_UI_V2 = CANDIDATE_NOT_FROZEN
```

This is the reviewed V2 candidate contract for the Standard Fitment screen. It
does not replace the canonical V1 domain/API contracts or the existing V1
specification until the product owner explicitly approves the V2 candidate.
The `STANDARD_FITMENT_UI = FROZEN` status in the V1 artifact applies to that
already-versioned V1 checkpoint; this document deliberately does not set a V2
freeze status.

Authority remains:

1. [Fitment Verdict V1](../fitment/fitment-verdict-v1.md) for product and
   domain meaning
2. [Fitment API Contract V1](../fitment-api-contract-v1.md) for API responses,
   snapshots, lifecycle and machine codes
3. [UI Design Code](../ui-design-code.md) for visual language, terminology and
   responsive boundaries
4. This document for the reviewed V2 interaction composition and handoff
5. The [V2 candidate prototype](../references/standard-fitment-v2-realistic-prototype.html)
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

`Вывод` is disabled until a current or historical check/result exists. Once a
check/result exists, direct navigation to Vehicle, Rim and Result is allowed.
A stale result remains readable and is presented as `Нужно проверить заново`.
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
- The next instruction is `Проверьте найденные данные и выберите комплектацию`
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

`Визуальная примерка не требует завершения проверки`

with the secondary CTA `Создать изображение`.

## Copy and error matrix

Approved V2 copy remains:

| Context | Copy |
| --- | --- |
| Vehicle proposal | `Автомобиль определён по фотографии` |
| Vehicle instruction | `Проверьте найденные данные и выберите комплектацию` |
| Rim partial | `Часть параметров необходимо проверить` |
| Resolver failure | `Не удалось определить параметры автоматически` |
| Resolver recovery | `Это не блокирует проверку — укажите параметры колесного диска вручную` |
| Resolver CTA | `Заполнить параметры вручную` / `Повторить` |
| Provider failure | `Сервис технической проверки совместимости временно недоступен` |
| Incompatible rendering | `Вы все еще можете создать изображение, чтобы оценить внешний вид дисков` |
| Render disclaimer | `Визуальная примерка не требует завершения проверки` |

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

## Freeze gate

The reviewed prototype is a candidate visual reference, not a frozen runtime
contract. A separate explicit product approval is required before setting:

```text
STANDARD_FITMENT_UI_V2 = FROZEN
UI_V2_FROZEN = YES
```

Until that approval:

```text
STANDARD_FITMENT_V2_REFERENCE = REVIEWED
STANDARD_FITMENT_V2_REFERENCE_STATUS = AWAITING_PRODUCT_APPROVAL
UI_V2_FROZEN = NO
```
