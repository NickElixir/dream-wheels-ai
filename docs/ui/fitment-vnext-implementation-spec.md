# Dream Wheels AI — Technical Fitment VNext Implementation Specification

**Status:** UX / state contract frozen; implementation pending  
**Target branch:** staging  
**Baseline:** staging after PR #224 (adef5ce8c98e8d0078556906ed70796dbd9beb0e)  
**Canonical visual reference:** [fitment-vnext-integrated-prototype-v13.html](../references/fitment-vnext-integrated-prototype-v13.html)

## 1. Purpose

Implement the frozen Technical Fitment VNext UX in the production/staging application without changing the approved product semantics.

The implementation must make Vehicle and Wheel independently editable/preparable, keep Standard Fitment server-authoritative, preserve revision/currentness guarantees, and keep Visual Try-On independent from Technical Fitment.

The canonical prototype is a visual and interaction reference only. Its demo data, prototype controls and local in-file state machine must not become production domain logic.

## 2. Source-of-truth hierarchy

When implementation details conflict, use this order:

1. docs/architecture/fitment-vnext-state-machine.md — frozen branch/state ownership.
2. docs/ui/fitment-flow-contract-v2.md — frozen product flow.
3. docs/ui/fitment-ui-state-spec-v2.md — UI state and recovery semantics.
4. docs/fitment-api-contract-v1.md — backend/API contract.
5. docs/ui/fitment-runtime-mapping-v1.md — current runtime mapping/gaps.
6. docs/ui/dream-wheels-application-design-code-vnext-v0.1.md and the 2026-09-27 amendment — frozen VNext design code.
7. docs/ui/vnext-visual-system-2.0-phase1.md — current visual-system tokens/rules.
8. docs/references/fitment-vnext-integrated-prototype-v13.html — canonical visual/interaction reference for this implementation.
9. Current staging code and tests for the exact deployed request/response shapes.

Do not revive superseded prototype behavior where it conflicts with the documents above.

## 3. Non-negotiable product invariants

- Vehicle and Wheel are independent readiness domains.
- vehicle_state and rim_setup_state describe the two canonical branches independently.
- next_action remains server-owned and is not recomputed from local form values.
- A single next_action must not prevent the user from editing or saving the other branch.
- Standard Fitment uses only persisted canonical data.
- Unsaved local draft data never enters a Standard Check.
- FITMENT_VERDICT != RENDER_PERMISSION.
- An incompatible, unknown, stale, failed or not-yet-run Fitment result never disables Visual Try-On.
- Vehicle recognition and Wheel resolver output are proposals until user confirmation/save.
- Saved/canonical values are never silently overwritten by a repeated resolver/recognition operation.
- dirty != stale.
- A result becomes stale only after a successful authoritative Vehicle/Wheel change.
- No production/main deployment is part of implementation PRs unless separately approved.

## 4. Scope

### In scope

- Replace the current Fitment presentation with the frozen VNext composition.
- Connect the VNext UI to the existing staging Fitment APIs and state model.
- Independent Vehicle and Wheel branch editing/saving.
- Vehicle recognition proposal -> catalogue -> exact variant confirmation.
- Manual Vehicle catalogue fallback.
- Wheel URL resolver, multi-SKU selection and manual fallback.
- Explicit confirmation of mandatory Wheel parameters.
- Uniform/staggered wheel setup.
- Exact decimal-safe ET interaction.
- Browser draft restore with revision safety.
- Standard Check lifecycle.
- Result/current/stale/failure states.
- Responsive desktop/mobile behavior.
- VNext Visual System 2.0 styling.
- Accessibility and keyboard/focus behavior.
- Automated frontend/backend integration coverage required by this specification.
- Authenticated staging E2E after implementation.

### Out of scope

- Screenshot/product-image Wheel recognition as a Release 1 source.
- New Fitment verdict semantics.
- New physical-clearance model.
- New Wheel Size provider selection.
- Vehicle-recognition model/provider changes.
- Render pipeline/provider changes.
- Credits/payments changes.
- Garage/B3 redesign.
- New public API solely for this UI unless a proven runtime gap requires a separate reviewed PR.
- Branch-aware stale-draft recovery; PR #224 intentionally freezes full stale-draft discard.
- Reopening the frozen visual language without a separate design review.

## 5. Target page composition

Desktop target:

~~~text
Application shell / sidebar

Page heading

Vehicle source / summary    Wheel source / summary

Active editor — full width

Current Fitment result — when one exists

Standard Fitment / readiness block
[ Проверить совместимость ] [ Создать изображение ]
~~~

The target is the “parallel summaries + full-width active editor” composition shown by the canonical v13 reference.

Do not implement the alternative permanent two-column editor as production behavior.

### Source cards

Vehicle card:

- compact vehicle preview;
- title hidden before successful recognition/resolution;
- source metadata: “Источник данных” + “Фото автомобиля”;
- compact secondary button “Изменить”;
- full-width primary button “Распознать автомобиль”.

Wheel card:

- compact wheel preview;
- title hidden before resolver/identity is available;
- source metadata: “Источник данных” + “Ссылка на товар”;
- domain shown as secondary metadata when URL exists;
- compact secondary button “Изменить”;
- full-width primary button “Распознать колесный диск”.

Do not place “Создать изображение” in the source cards.

## 6. Vehicle branch

### 6.1 Recognition boundary

Vehicle Recognition may propose only the supported visual identity scope (make/model/year or year range). It is not authoritative for generation, modification, market, trim or Fitment.

Recognition flow:

~~~text
vehicle photo
→ Распознать автомобиль
→ recognition proposal
→ Vehicle draft
→ catalogue validation / exact variant
→ Подтвердить комплектацию
→ canonical Vehicle
~~~

Failure:

~~~text
Не удалось распознать автомобиль по фото.
[ Попробовать ещё раз ]
[ Указать вручную ]
~~~

Recognition failure must never block manual catalogue selection or Visual Try-On.

### 6.2 Manual Vehicle catalogue

Exact sequence:

~~~text
Марка
→ Модель
→ Год
→ Версия для рынка (only when selection is required)
→ save validated base Vehicle
→ exact Wheel Size variants
→ select exact variant
→ Подтвердить комплектацию
→ canonical Vehicle
~~~

Rules:

- Options come from the existing provider-backed Vehicle Catalogue API.
- No arbitrary free-text identity when catalogue options exist.
- Market is hidden when the backend resolves one market unambiguously.
- Market is shown only when explicit selection is required.
- no_data and provider failure are different UI states.
- Parent changes must invalidate/revalidate dependent selections safely.
- Stale catalogue responses must not overwrite a newer selection context.
- The existing context-version/abort/revalidation safeguards must be retained.

Do not add separate free-form Body / Generation / Modification controls before exact variant selection. Those values remain provider variant context.

### 6.3 Exact Vehicle variants

- Show all current exact variants returned by the existing lookup.
- Variant content must be human-readable and include the technical series needed to distinguish candidates.
- Multiple candidates require explicit user choice.
- A single authoritative candidate may be visually preselected, but still requires “Подтвердить комплектацию”.
- Never auto-persist first-of-many.
- Technical-equivalence grouping is permitted only when every field of the canonical variant record matches.
- Applying a variant must remain revision-bound.
- A stale candidate/revision must be rejected rather than resurrected.

### 6.4 Re-recognition after confirmation

If Vehicle is already canonical:

- replacing the photo changes only the local source first;
- current canonical Vehicle and current Fitment result remain current;
- user explicitly runs recognition;
- recognition output is a proposal;
- canonical Vehicle changes only after the catalogue/variant confirmation boundary;
- only that successful confirmation can make the prior result stale.

## 7. Wheel branch

### 7.1 Release 1 source modes

Current supported paths:

1. Product URL -> resolver.
2. Manual parameter entry.

Screenshot/product-image recognition is deferred and must not be exposed as a working source.

Wheel user-facing CTA remains “Распознать колесный диск” even though the backend operation is resolver-based.

Failure:

~~~text
Не удалось определить параметры диска по ссылке.
[ Попробовать ещё раз ]
[ Указать параметры вручную ]
~~~

### 7.2 Resolver semantics

Resolver output is proposal data.

A resolver run must not silently overwrite saved/canonical Wheel values.

Repeated resolver behavior:

- same detected value as canonical -> no conflict;
- new value where canonical value exists -> explicit field conflict;
- previously empty value -> ordinary proposal.

Conflict resolution updates only local dirty draft until final “Сохранить параметры”.

### 7.3 Multiple SKU

When the product page contains multiple variants/SKUs:

- show SKU selection before the parameter-confirmation form;
- use flat selectable rows, not card-heavy tiles;
- include preview image when available;
- show product/wheel name;
- show SKU;
- show all five user-facing technical characteristics in the approved order:
  1. Диаметр
  2. Ширина
  3. PCD
  4. DIA
  5. ET
- missing values display “Не определено”;
- prefer SKU-specific image, otherwise generic product preview;
- action is “Выбрать”.

“Выбрать” selects a product/SKU. It does not confirm its technical parameters.

After SKU selection all extracted geometry remains system proposals requiring explicit confirmation.

### 7.4 Wheel field confirmation

Mandatory user-facing order everywhere:

1. Диаметр
2. Ширина
3. PCD
4. DIA
5. ET

System proposal and confirmed value must not look identical.

Use the frozen compound/split control:

~~~text
[ proposed/current value | Выбрать другое ]
~~~

The user must explicitly accept or choose each required value.

Do not use amber/warning semantics merely because a value is still a proposal.

After all required parameters are confirmed:

- helper: “Все параметры подтверждены.”
- final explicit action: “Сохранить параметры”.

“Сохранить параметры” is the canonical Wheel save boundary.

### 7.5 Wheel-only save independence — required defect fix

The current deployed legacy frontend incorrectly blocks Wheel save while Vehicle is unfinished.

The VNext implementation must allow:

~~~text
Vehicle = unconfirmed / incomplete
Wheel draft = complete + confirmed
→ Сохранить параметры succeeds
→ rim_setup_state may become confirmed_ready
→ Vehicle canonical values and vehicle_revision remain unchanged
→ next_action may still be complete_vehicle_details
~~~

Do not gate Wheel save on next_action being complete_rim_specs.

next_action is the Standard Fitment progression pointer, not an exclusive lock on branch editing.

This behavior is a release-blocking acceptance criterion.

### 7.6 Numeric controls — required defect fix

The current deployed frontend can raise InvalidStateError while editing numeric Wheel fields.

VNext must:

- never call unsupported selection APIs on input[type=number];
- or use text + inputmode=decimal where exact locale-safe decimal editing is required;
- accept both comma and dot for decimal manual entry;
- preserve exact provider/resolver numeric values;
- avoid accidental rounding;
- validate without throwing browser exceptions.

No numeric edit may produce InvalidStateError in supported desktop/mobile browsers.

This behavior is a release-blocking acceptance criterion.

## 8. ET contract

ET is decimal.

Rules:

- validation range: -150…+150 mm;
- preserve exact provider/resolver value;
- do not round to integer;
- do not force 0.1 mm quantization;
- manual input accepts comma and dot;
- canonical serialization remains numeric/exact according to existing API contract.

Picker behavior:

- collapsed control shows current/proposed ET + “Выбрать другое”;
- opened state centers search;
- recommended values shown by default;
- “Показать все значения” switches RECOMMENDED <-> ALL mode; it must not append an unbounded duplicate list;
- exact match first;
- manual fallback always visible, including when near matches exist;
- mobile uses a bottom sheet;
- desktop follows the canonical prototype interaction, while preserving keyboard accessibility.

## 9. Uniform / staggered Wheel setup

Control:

- “Одинаковые”
- “Разные”

uniform -> staggered:

- Rear starts as a copy of Front draft.
- The copy is only a starting draft, not independent confirmation.
- Rear exposes the same allowed controls/options as Front.

staggered -> uniform:

- Front becomes the base for both axles.
- Do not destroy previous Rear draft immediately.
- Until final “Сохранить параметры”, preserve the previous Rear draft locally.
- If the user returns to “Разные” before Save, restore that draft.
- No confirmation modal is required.
- A small neutral inline note is allowed.

For a persisted staggered setup, both effective axles must satisfy the frozen mandatory-confirmation contract before Standard Check admission.

## 10. Local draft, save boundaries and revisions

### 10.1 Canonical save boundaries

Vehicle canonical change:
- only after explicit Vehicle save/variant confirmation.

Wheel canonical change:
- only after “Сохранить параметры”.

Selecting/typing a candidate value alone is not an authoritative server mutation.

### 10.2 Draft persistence

Use the existing bounded browser-draft infrastructure unless a dedicated migration is separately approved.

Required behavior, independent of storage mechanism:

- ordinary navigation can preserve unsaved draft;
- matching server revision baseline -> restore draft automatically;
- mismatching baseline -> discard the obsolete draft in full;
- load current server canonical state;
- rewrite the stored baseline from the current overview;
- no modal;
- no automatic replay of authoritative actions.

A neutral notice such as “Данные были обновлены. Загружена актуальная версия.” is allowed if current copy conventions need it.

Do not reintroduce branch-aware stale-draft restore in this implementation; PR #224 explicitly deferred it.

### 10.3 Dirty vs stale

- local edit only -> dirty draft; existing result remains current;
- successful save/confirmation changing canonical revisions -> previous result becomes stale;
- stale state comes from server currentness/snapshot comparison, not a client guess.

“Сбросить” returns to the latest server canonical state.

## 11. Parallel readiness semantics

Render the two branch states independently from server data:

Vehicle:
- empty
- unconfirmed
- confirmed_incomplete
- confirmed_ready

Wheel:
- empty
- partial
- complete_unconfirmed
- confirmed_ready

Use next_action as the authoritative Standard Fitment workflow pointer:

- complete_vehicle_details
- select_vehicle_variant
- complete_rim_specs
- run_standard_check

Important:

- next_action may determine default focus / readiness messaging.
- next_action must not disable valid independent branch edit/save operations.
- frontend must not synthesize run_standard_check.
- “Проверить совместимость” becomes enabled only when the server returns run_standard_check.

User-facing readiness copy should use:
- “Готово к проверке”
- “Осталось подтвердить N параметров”
- “Требуется подтверждение”

Do not expose the technical word “readiness” to users.

## 12. Standard Fitment block

Location: after any current Result panel.

When both branches are canonical/ready, show full-width summaries:

~~~text
Автомобиль — <full confirmed vehicle>
Колесный диск — <full confirmed wheel>
~~~

Actions on desktop: two equal columns.
Actions on mobile: stacked.

Primary:
- “Проверить совместимость”

Independent secondary:
- “Создать изображение”

There must be only one “Создать изображение” action in the main Fitment flow.

It must remain available independently from Fitment readiness and verdict, subject only to the existing Render/auth/credits contract.

## 13. Standard Check lifecycle

### 13.1 Start

Check is an explicit action.

No save action starts a Standard Check automatically.

Check consumes persisted canonical Vehicle/Wheel snapshots only.

### 13.2 queued / processing

UI may merge queued + processing into one calm user-facing state:

“Проверяем совместимость…”

Vehicle/Wheel context remains visible.

Disable mutations that would invalidate the in-flight snapshot until the current request transition is safely resolved.

Do not block Visual Try-On.

### 13.3 failed

Show:

~~~text
Не удалось выполнить проверку
[ Повторить ]
[ Изменить параметры ]
~~~

Do not clear confirmed Vehicle/Wheel data.

“Создать изображение” remains independently available in the main Fitment block; do not duplicate it inside the failure/result card.

### 13.4 stale

Keep the previous result visible.

Show explicit stale messaging:

~~~text
Результат больше не актуален
Предыдущий результат — <verdict>
Параметры автомобиля или диска изменились.
[ Проверить ещё раз ]
~~~

Do not dim the entire previous table to the point of unreadability.

Old verdict must not visually masquerade as current.

## 14. Result presentation

Result panel is rendered before the Standard Fitment block.

All five comparison rows are required:

| Параметр | Автомобиль | Колесный диск | Результат |
| --- | --- | --- | --- |
| Диаметр | allowed/reference | selected | status |
| Ширина | allowed/reference | selected | status |
| PCD | vehicle | wheel | status |
| DIA | hub | wheel | status/condition |
| ET | allowed/reference | wheel | status |

### Compatible

Calm positive state. No oversized success banner.

### Compatible with conditions

Conditions appear before the table.

Example condition:
“Для DIA 72,6 → 66,6 потребуются центровочные кольца.”

### Incompatible

Show concrete blocking mismatches before the table.

Rendering remains independent.

### Unknown / insufficient data

Use global verdict:

~~~text
Недостаточно данных для проверки

В базе недостаточно технических данных,
чтобы определить совместимость этого диска с автомобилем.

[ Изменить параметры ]
~~~

If a comparison table remains, it is informational. Do not show local green success cells that imply “almost compatible” when the global verdict is unknown.

### Mobile result table — frozen

Keep the compact real table used in v13.

- one shared header row;
- no repeated label block per parameter;
- no horizontal scroll at target 390 px;
- table header has the same vertical rhythm as internal rows;
- rows receive a very subtle hover highlight on pointer devices;
- tap/focus provides restrained row focus on mobile/keyboard;
- do not turn rows into rounded cards.

## 15. Source replacement

### Vehicle photo replacement

After Vehicle is confirmed:

- new photo is local source first;
- current canonical Vehicle remains unchanged;
- current result remains current;
- user runs recognition;
- proposal/catalogue flow follows;
- result becomes stale only after successful new canonical Vehicle confirmation.

### Wheel URL replacement

After Wheel is confirmed:

- new URL is local/dirty source first;
- canonical Wheel remains unchanged;
- current result remains current;
- resolver produces proposals/conflicts;
- canonical Wheel changes only on final Save;
- only then does the prior result become stale.

## 16. Visual system

Use VNext Visual System 2.0 / frozen Design Code.

Core tokens:

- Canvas: #090D10
- Surface 1: #0D1317
- Surface 2: #12191F
- Surface selected: #1A232A
- Border subtle: #263039
- Border strong: #46525C
- Text primary: #F2F4F5
- Text secondary: #B7C0C6
- Text tertiary: #7E8A92
- Primary CTA: #F1F2F2
- Primary CTA text: #111518

Typography:
- IBM Plex Sans first;
- values dominate labels;
- restrained weights, mostly 400/500/600;
- tabular numerals where alignment matters.

Avoid:
- glow;
- decorative gradients;
- glassmorphism;
- neon/cyberpunk/HUD language;
- generic analytics dashboard;
- excessive cards;
- excessive rounding;
- decorative status dots/checks.

### Dividers

Inside ordinary islands use spacing + typography + surface before horizontal rules.

Keep dividers where they structurally separate:
- exact variant rows;
- SKU rows;
- technical result table rows;
- shell/navigation boundaries where required.

Do not reintroduce decorative horizontal lines between ordinary form subsections.

### Metadata separators

Do not use middle dot (·).

Use:
- en dash (–) between semantic metadata/identity groups;
- slash (/) for compact technical series.

Examples:

~~~text
BBS CI-R – Satin Black
2024 / 2.0T / AWD / X254
18″ / 8J / 5×112 / DIA 66,6 / ET 35
~~~

### Secondary paired actions

“Указать вручную” and “Выбрать другой SKU” use the same outlined secondary-control language.

- no chevron on “Выбрать другой SKU”;
- equal vertical sizing;
- 14 px paired-action gap in the frozen reference.

## 17. Responsive behavior

Acceptance viewports:

- 1440 desktop
- 1024 desktop/tablet
- 768 narrow/tablet
- 390 mobile

No horizontal page overflow.

Mobile workspace order:

~~~text
Vehicle
→ Wheel
→ state/readiness
→ Result when present
→ Standard Fitment actions
~~~

Editors are one column.

Vehicle/Wheel remain independent sections, not a wizard.

PCD/DIA/ET selection uses mobile-appropriate sheet/full-height picker patterns where defined.

“Проверить совместимость” is not sticky.

Navigation follows the existing VNext shell/mobile-navigation contract.

## 18. Accessibility and interaction

Required:

- real button elements for actions;
- associated labels for form controls;
- aria-live/status only for meaningful async transitions;
- aria-invalid and field-addressable errors where applicable;
- keyboard-operable SKU/variant/picker controls;
- visible neutral focus treatment;
- selected state not represented by color alone;
- semantic condition/error copy always present;
- row focus highlighting must not remove table semantics;
- reduced-motion preference honored;
- no hover-only critical action;
- touch targets consistent with current VNext minimums.

## 19. Runtime/API mapping

Reuse the existing runtime.

Primary sources include:

- GET /jobs/{job_id}/fitment
- PATCH /jobs/{job_id}/fitment
- provider-backed Vehicle Catalogue routes
- vehicle-variant lookup/apply/reselect routes
- rim-source resolver route
- Standard Check create/get/history routes

Do not duplicate backend business rules in the client.

The UI should consume:
- vehicle_state;
- rim_setup_state;
- field states/provenance already exposed;
- selected modification state;
- revisions;
- next_action;
- current_check / is_current;
- resolver outcomes.

If a missing API field makes the frozen UX impossible, document the exact gap and implement it in a separate narrowly scoped backend-contract PR unless the change is demonstrably non-semantic and required by the same slice.

## 20. Frontend migration strategy

Current runtime contains useful state/API logic in webapp/app.js and VNext presentation code in webapp/vnext/views/fitment.js + webapp/vnext/styles/fitment.css.

Implementation should:

1. Preserve existing authenticated API/auth/error plumbing.
2. Preserve server-owned revision/currentness behavior.
3. Reuse tested catalogue/resolver/check helpers where semantics match.
4. Replace sequential/global branch gating with independent Vehicle/Wheel action availability.
5. Keep next_action authoritative for Standard Fitment progression, not as an exclusive editor lock.
6. Build a clear VNext view-model/adapter boundary rather than scattering new DOM-condition logic across unrelated handlers.
7. Migrate screen states incrementally; do not ship a partial hybrid that can silently write old payload semantics.
8. Remove obsolete UI code only after parity tests cover the replacement.
9. Keep the canonical prototype out of runtime imports/build; it is docs/reference only.

## 21. Recommended implementation slices

### Slice 0 — Regression guards / foundation

Before visual replacement:

- add tests reproducing the deployed Wheel-save blocker;
- add test reproducing numeric InvalidStateError path;
- make independent branch action semantics explicit in frontend tests;
- verify #224 backend contract remains green.

Exit:
- tests fail against old behavior for the correct reason;
- no visual change required yet.

### Slice 1 — VNext shell and source/summary composition

- implement v13 composition;
- source cards;
- active full-width editor region;
- branch switching;
- no domain behavior changes yet.

Exit:
- static/responsive parity at 1440/1024/768/390.

### Slice 2 — Parallel branch state adapter + draft/revision

- bind vehicle_state and rim_setup_state independently;
- preserve next_action;
- independent editor/save availability;
- revision-safe draft restore/discard;
- fix Wheel-only save blocker.

Exit:
- Vehicle incomplete + Wheel save succeeds;
- Vehicle unchanged;
- stale draft discarded on mismatch.

### Slice 3 — Vehicle branch

- recognition proposal;
- manual catalogue;
- conditional Market;
- exact variants;
- explicit confirmation;
- replacement/re-recognition.

Exit:
- real backend catalogue flow works with no arbitrary free text.

### Slice 4 — Wheel branch

- URL source;
- resolver;
- multi-SKU;
- field proposals;
- PCD/DIA/ET controls;
- exact decimal normalization;
- conflict presentation;
- uniform/staggered;
- Save boundary;
- fix InvalidStateError.

Exit:
- all mandatory fields confirm/save independently of Vehicle.

### Slice 5 — Standard Check lifecycle

- server readiness presentation;
- check action;
- queued/processing;
- failed;
- retry;
- no automatic check on save.

Exit:
- check can start only on server run_standard_check.

### Slice 6 — Results/currentness

- compatible;
- compatible with conditions;
- incompatible;
- unknown;
- stale;
- compact desktop/mobile technical table;
- row focus behavior;
- result before Standard Fitment block.

### Slice 7 — Responsive/accessibility/polish

- 1440/1024/768/390;
- keyboard/focus;
- reduced motion;
- copy/metadata separators;
- divider cleanup;
- visual-system parity.

### Slice 8 — Staging integration / E2E

- authenticated staging contract smoke;
- full browser E2E;
- desktop/mobile;
- provider failure/no-data;
- stale/recheck;
- render independence.

## 22. Disposable staging Fitment context prerequisite

The authenticated API-only smoke after PR #224 is currently BLOCKED because staging has no safe disposable Fitment context independent of completed render history.

Before Slice 8 release-gate testing, provide a supported staging/dev-only way to create/reset a disposable Fitment context without:

- starting a paid render;
- consuming credits;
- mutating historical production-like render records.

This may be a test fixture/script/admin helper. It does not need to become a public product API.

Implementation work may proceed before this helper exists, but release E2E may not be declared complete without a safe mutable staging context.

## 23. Automated test requirements

At minimum cover:

### Branch independence
- Vehicle unconfirmed + Wheel save -> Wheel confirmed_ready; Vehicle unchanged.
- Wheel-only save does not increment vehicle_revision.
- Vehicle save does not unexpectedly rewrite Wheel revisions.

### next_action
- Vehicle not ready + Wheel ready -> complete_vehicle_details.
- Vehicle ready + Wheel partial -> complete_rim_specs.
- both ready -> run_standard_check.
- frontend does not synthesize run_standard_check.

### Numeric controls
- comma/dot decimal input;
- exact ET preservation;
- no rounding regressions;
- no InvalidStateError;
- PCD pair preserved exactly.

### Vehicle catalogue
- single market hidden/auto-resolved;
- multiple markets require selection;
- no_data vs provider failure;
- stale response/context discarded;
- exact variant revision binding;
- one variant still requires explicit final confirmation in UI.

### Resolver / SKU
- multiple SKU selection;
- no implicit confirmation;
- same resolver value no conflict;
- changed saved value creates explicit conflict;
- new empty value becomes proposal;
- final Save only persistence boundary.

### Draft/currentness
- matching baseline restores draft;
- mismatch discards full draft;
- local dirty edit does not stale current result;
- successful canonical save makes old check non-current.

### Check lifecycle
- incomplete Wheel check admission rejected;
- both ready admitted;
- queued/processing/failed/completed mapped correctly.

### Render independence
- Fitment incomplete does not gate Create Image.
- incompatible/unknown/stale/failed result does not gate Create Image.

## 24. Browser/staging QA

Before merge of the final integration slice:

Desktop:
- Chromium 1440×1000
- 1024 target

Mobile:
- 390×844
- 768 narrow/tablet

Verify:
- no page-level horizontal overflow;
- no blocking console error;
- no InvalidStateError;
- source/editor/result transitions;
- focus/keyboard;
- table readability;
- bottom sheets;
- branch-independent save.

After deployment, rerun:

1. API-only authenticated staging smoke A–F using disposable context.
2. Authenticated browser contract smoke.
3. Full end-to-end user flow.

## 25. Full E2E target

At minimum:

~~~text
real vehicle photo
→ recognition proposal
→ catalogue validation/manual fallback
→ exact vehicle variant confirmation

real wheel URL
→ resolver
→ SKU selection when needed
→ Diameter / Width / PCD / DIA / ET confirmation
→ Save Wheel

both branches confirmed_ready
→ Standard Check
→ verdict/result table

edit canonical data
→ old result stale
→ recheck

Visual Try-On remains available throughout according to its own existing contract
~~~

Test both successful and recovery paths.

## 26. Release-blocking acceptance criteria

The implementation is not complete unless all are true:

1. Canonical v13 composition is implemented without redesigning the frozen flow.
2. Vehicle and Wheel are independently editable/savable.
3. Wheel Save works while Vehicle is incomplete.
4. Wheel-only Save does not alter Vehicle canonical values/revision.
5. Numeric controls never throw InvalidStateError.
6. ET exact decimals survive edit/save round-trip without rounding.
7. Manual Vehicle catalogue follows Make -> Model -> Year -> conditional Market.
8. Exact variant requires explicit user confirmation.
9. Resolver/SKU values remain proposals until field confirmation + Save.
10. Repeated resolver never silently overwrites canonical values.
11. Uniform/staggered draft behavior matches the frozen contract.
12. Revision-mismatched browser draft is discarded in full.
13. Local dirty edits do not stale a result before save.
14. Server next_action is authoritative for Standard Fitment progression.
15. Check is enabled only on run_standard_check.
16. Save never automatically starts a Check.
17. All result states render correctly, including stale.
18. Mobile uses the approved compact technical table without horizontal scrolling.
19. “Создать изображение” exists once in the main Fitment flow and remains independent from Fitment verdict/readiness.
20. No decorative middle-dot separators.
21. No unnecessary horizontal dividers inside ordinary islands.
22. Desktop/mobile visual QA passes at target widths.
23. Automated suites and CI pass.
24. Authenticated staging contract smoke passes.
25. Full authenticated staging E2E passes before production rollout.

## 27. Rollout / rollback boundaries

- Implement on feature branches from staging.
- Prefer reviewable slices; do not combine unrelated backend/provider work.
- No production/main changes during implementation.
- Keep old implementation recoverable until the new VNext flow passes authenticated staging E2E.
- Rollback must restore the previous frontend without reverting #224 backend safety contracts unless a separate backend regression is proven.
- Do not weaken Standard Check admission or revision checks as a frontend rollback shortcut.

## 28. Definition of done

Technical Fitment VNext is done when the production frontend on staging follows this specification and the canonical v13 reference, all release-blocking acceptance criteria pass, and the full authenticated staging E2E demonstrates the complete Vehicle + Wheel + Standard Check lifecycle while Visual Try-On remains independently available.
