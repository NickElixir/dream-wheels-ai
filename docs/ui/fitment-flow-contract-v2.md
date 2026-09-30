# Dream Wheels AI — Fitment Flow Contract v2

**Date:** 2026-09-29
**Status:** APPROVED FLOW DIRECTION — implementation pending
**Goal:** repair `FITMENT-POST-PR6-01` after Visual System 2.0 Phase 1

## Purpose

This contract records the user-facing Fitment progression that must be restored before production.

It is based on:

- the previously working Fitment business flow;
- the current server/runtime contract;
- the current VNext presentation rules;
- the post-PR6 staging issue `FITMENT-POST-PR6-01`.

This is not a new Fitment architecture. The repair should reuse the existing vehicle catalogue, vehicle-variant lookup/application, rim editor/resolver, check execution, revision/currentness and recovery runtime.

The server remains the source of truth.

## Product invariant

Visual Try-On and Technical Fitment are separate systems.

`FITMENT_VERDICT != RENDER_PERMISSION`

An incompatible, unknown, stale or failed technical Fitment state must never become a client-side permission gate for creating a visual render.

---

# Canonical user progression

```text
Load Fitment
  ↓
Уточните данные автомобиля
  ↓
Выберите комплектацию автомобиля
  ↓
Уточните параметры колесного диска
  ↓
Данные готовы к проверке
  ↓
Проверка выполняется
  ↓
Результат
```

Operational loading, no-match, conflict and error states are sub-states of these steps, not extra product sections.

---

## State 0 — Loading Fitment

### Source

Fitment overview / existing current-job context.

### User sees

- page title: `Проверка совместимости`;
- existing vehicle and wheel context when already available;
- blocking loading state: `Загружаем данные`.

Do not show false empty/readiness states while the authoritative overview is unknown.

### Failure

`Не удалось загрузить данные проверки`

Actions:

- `Повторить`;
- existing auth/recovery behavior where applicable.

---

## State 1 — Vehicle details required

### Server intent

`next_action.kind = complete_vehicle_details`

### User instruction

`Уточните данные автомобиля`

Do not use `Нужно уточнить данные`.

### Summary

Show current identity context, for example:

```text
АВТОМОБИЛЬ
ZEEKR 009 · 2025
Уточните данные автомобиля
```

Wheel remains contextual and inactive.

### Active fields

Use the existing catalogue/runtime fields.

Primary chain:

- Марка
- Модель
- Год
- Рынок

Additional fields may remain available when supported by the current runtime, but must not be presented as mandatory unless the server/runtime actually requires them.

### Primary action

`Продолжить`

Meaning:

```text
save vehicle details
→ receive authoritative overview
→ follow returned next_action
```

The client must not infer the next step independently.

### Recovery

`Не мой автомобиль — указать вручную`

or the approved manual vehicle recovery affordance.

---

## State 2 — Exact vehicle variant required

### Server intent

`next_action.kind = select_vehicle_variant`

### User instruction

`Выберите комплектацию автомобиля`

This is a technical Fitment choice. It must remain distinct from Create/VLM identity candidates.

Recognition identifies only vehicle identity such as make/model/year. It does not claim the exact vehicle variant.

### Variant loading

`Загружаем комплектации автомобиля`

The already confirmed base vehicle remains visible.

### Multiple variants

Show the returned current variants as whole selectable rows.

Examples are presentation-only:

```text
ZEEKR 009 AWD
2025 · Dual Motor · 544 л.с.

ZEEKR 009 WE
2025 · RWD · 421 л.с.

ZEEKR 009 ME
2025 · AWD · 612 л.с.
```

Actual labels and metadata must come from the provider/runtime response.

Selected state is communicated through surface/border hierarchy; decorative radio circles are not required.

Required choices stay visible until the user selects one.

### Primary action

`Подтвердить комплектацию`

Use the existing explicit variant-apply runtime and its revision boundary.

### Single variant

If the backend/provider returns a single authoritative variant and the existing runtime auto-confirms it, do not force the user to select one row from a one-item list.

Show the confirmed exact vehicle variant and progress according to the new overview.

### No match

This is not an operational error.

Show:

`Комплектации не найдены.`

Recovery:

- `Изменить данные автомобиля`;
- approved manual recovery if supported.

Do not fabricate a variant.

### Lookup failure

Operational failure is distinct from no match.

Show:

`Не удалось загрузить комплектации.`

Actions:

- `Повторить`;
- `Изменить данные автомобиля`.

### Reselection

A confirmed exact vehicle variant may be explicitly changed using the existing reselection runtime.

Do not clear the current confirmed selection merely because the picker was opened.

---

## State 3 — Wheel details required

### Server intent

`next_action.kind = complete_rim_specs`

### User instruction

`Уточните параметры колесного диска`

Do not use `Нужно уточнить параметры`.

### Vehicle summary

The vehicle / exact vehicle variant remains confirmed and compact.

### Active wheel workspace

Use the existing RimSpec/RimSetup fields and state ownership.

Core technical fields may include:

- diameter;
- width;
- PCD = bolt count + PCD;
- ET;
- DIA / centre bore;
- front/rear axle data when staggered.

ET-specific numeric precision, Wheel Size catalogue sourcing, recommendation/manual fallback behavior and the completed live catalogue audit are defined in:

- `docs/fitment/et-selection-contract-and-evidence.md`

That document supersedes integer-only and fixed-`0.1 mm` ET UI assumptions. Do not round fractional ET values.

Do not expose backend/parser candidate collections as a standalone section.

### Product URL resolver

The product URL remains inside the wheel context.

It is optional support for resolving commercial wheel data and does not replace manual entry.

Resolver states:

```text
idle
→ loading
→ resolved
→ variants / conflict when required
→ save/confirmation
```

Failure offers:

- retry;
- manual completion.

Existing user-entered values and URL context must be preserved.

### Conflict

Conflicts belong to their matching wheel field.

Example:

```text
ET
Текущее значение: 40
Найдено на странице товара: 45

Использовать 45
Оставить 40
```

Do not expose provider/raw parser payloads.

### Staggered

When `setup_mode = staggered`, front and rear remain independent axle specs.

Approved transition behavior:

- `uniform → staggered`: initialize Rear from the current Front draft. The copied Rear values are a starting draft, not a separate confirmation.
- While staggered, Front and Rear use the same allowed controls/options and may diverge independently.
- `staggered → uniform`: Front is the base axle; apply the current Front draft to both axles for the uniform draft.
- Do not immediately destroy the previous Rear draft when switching back to uniform. Preserve it locally until the user saves. If the user switches back to staggered before save, restore that previous Rear draft.
- After `Сохранить параметры` in uniform mode, the authoritative saved setup is uniform; the prior unsaved Rear divergence no longer defines canonical state.
- This mode switch is a local-draft operation. It must not change authoritative server state or stale an existing result until the final wheel save succeeds.
- A lightweight inline hint may explain that the Front values will be applied to both axles; do not require a modal choice.

Front candidates/values must never leak into rear fields outside these explicit draft-copy transitions.

---

## State 4 — Ready to check

### Server intent

`next_action.kind = run_standard_check`

### State copy

`Данные готовы к проверке`

### Presentation

Show compact confirmed summaries:

- exact vehicle variant;
- current wheel parameters.

Main state:

`Данные готовы к проверке`

Primary action:

`Проверить совместимость`

The readiness decision must come from `next_action`, not from client-side heuristics.

A visual render action may remain available independently.

---

## State 5 — Check execution

### Source

Existing Fitment Check execution status.

Pending:

- `queued`;
- `processing`.

### User sees

`Проверяем совместимость`

No fabricated percentage or countdown.

Do not convert execution failure into technical `unknown`.

---

## State 6 — Result

Server-owned verdicts remain authoritative.

### Compatible

`Подходит`

### Compatible with conditions

`Подходит с условиями`

Show the conditions and technical evidence.

### Unknown

`Недостаточно данных`

Recovery should lead to the owning vehicle or wheel data that requires clarification when the existing reason/evidence supports it.

### Incompatible

`Не подходит`

Explain the incompatible technical evidence.

The visual render action remains independent.

---

## State 6A — Stale result

When `is_current = false`:

`Результат больше не актуален`

Show the old verdict only as secondary historical context.

Primary action:

`Проверить ещё раз`

Do not silently treat a stale verdict as current.

---

## State 6B — Execution failure

Execution failure has its own state:

`Не удалось выполнить проверку`

Action:

`Повторить`

Invariant:

`FITMENT_EXECUTION_FAILURE != UNKNOWN_VERDICT`

---

# User-facing copy rule

Preserve existing user-facing terminology for exact vehicle selection in this repair contract: `комплектация автомобиля`. Use neutral `exact vehicle variant` for runtime architecture. Phase 1 does not approve changing the user-facing term to `модификация`.

The approved vehicle-details state is `Уточните данные автомобиля`; the existing wheel-details state is `Уточните параметры колесного диска`. Keep state copy distinct from action copy: `run_standard_check` shows `Данные готовы к проверке`, while its primary action remains `Проверить совместимость`. Do not convert every state label into an imperative.

---

# Image previews in exact vehicle variant selection

Vehicle imagery for variant rows is **not required for the pre-production Fitment repair**.

It is a deferred visual enhancement.

When implemented later:

- provider generation/reference images may be shown with variant choices;
- repeated images across multiple variants are acceptable;
- the image is presentation metadata only;
- the image must not become an identity key, selection key or Fitment evidence.

---

# Repair acceptance criteria

The Fitment repair is complete only when authenticated staging demonstrates:

```text
recognized / existing vehicle
→ base details
→ save
→ exact vehicle variant lookup
→ required multiple-choice selection when applicable
→ explicit confirmation
→ wheel parameters
→ check-ready state
→ run check
→ result
```

Also verify:

- single-variant automatic confirmation;
- no-match recovery;
- lookup failure/retry;
- exact vehicle variant reselection;
- resolver success/failure/conflict;
- stale check;
- execution failure;
- no render gating from verdict;
- no duplicate API/polling store introduced;
- responsive behavior on desktop and mobile.
