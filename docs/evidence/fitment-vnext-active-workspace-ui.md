# Fitment VNext — Single Active Workspace UI evidence

## Executive status

IMPLEMENTATION READY FOR INDEPENDENT UI REVIEW

DO NOT MERGE — INDEPENDENT UI REVIEW REQUIRED

## Baseline and scope

- Date: 2026-10-02.
- Staging base: `758dd4e2f2ceb7e6d010409fcfceebae1f50ee3f` (after PR #248).
- Branch: `fix/fitment-vnext-ui-workspace-consistency`.
- Baseline defect: recognition rendered outside the active editor slot, could coexist with an editor, and an applied proposal left a floating notice.
- Authority: the supplied Single Active Workspace / Vehicle Identification Composition specification, frozen VNext state/flow/API documents, VNext Design Code + amendment + Visual System 2.0, and v13 composition B. v13 is reference only.
- Backend, provider, catalogue/revision/Save/Confirm/Check semantics, M1/M2/M4, other pages, credits/payments, and asset delivery: no changes.
- Result/comparison rendering functions and table separators: unchanged.

## Single workspace invariant

`[data-fitment-active-workspace]` contains zero or one direct `[data-fitment-workspace]` child. The derived resolver renders only one workspace; hidden islands are not concatenated into the DOM. `workspaceOpen` lives on the transient recognition proposal and records presentation intent only. Switching editors closes that presentation intent without discarding proposals, Wheel drafts, canonical values or revisions. A late recognition response preserves the new editor intent.

| Scenario | Actual workspace | Count |
| --- | --- | --- |
| Idle / confirmed summaries | NONE | 0 |
| Recognition loading / proposed / failed | VEHICLE_RECOGNITION | 1 |
| Proposal applied / catalogue edit | VEHICLE_EDITOR | 1 |
| Saved base awaiting Confirm details | VEHICLE_EDITOR | 1 |
| Exact variant required / reselection | VEHICLE_VARIANT | 1 |
| Manual fallback from variants | VEHICLE_EDITOR | 1 |
| Wheel edit / source / SKU chooser / staggered | RIM_EDITOR | 1 |
| Wheel open with retained recognition / required variant | RIM_EDITOR | 1 |

Automated synthetic conflicts and the real DOM browser matrix both enforce max count = 1. Persistent Vehicle/Wheel summary cards remain above the workspace. Technical Check remains outside it. There are no wizard controls.

## Composition and copy

- Recognition: existing `vnext-eyebrow`, heading “Распознано по фотографии”, full-row buttons with identity, year/range and decorative chevron. No “Использовать”. Loading/error use the same island; retry/manual recovery remain available.
- Applying a proposal removes recognition immediately. Catalogue guidance moves inside the Vehicle editor.
- Vehicle: eyebrow “Автомобиль” + “Укажите автомобиль”. Existing conditional Market, Save → Confirm details and explicit variant confirmation retained.
- Variant: eyebrow “Комплектация автомобиля”, primary semibold name and provider-derived technical metadata; explicit confirmation and cancellation/manual fallback retained.
- Vehicle summary: “Комплектация” eyebrow, primary variant value, technical metadata when provided, “Подтверждено”, existing reselection action. Duplicate status/value labels removed.
- Wheel: “Параметры колесного диска” eyebrow. SKU/source controls remain inside the one editor. Draft preservation is tested through Wheel → recognition → Vehicle → Wheel.
- Decorative horizontal borders removed from choice/SKU rows; spacing replaces them. No `<hr>` in workspace markup. Compatibility table row borders remain present in the browser.
- ET visible `ET 40`; accessible `Подтверждено ET 40` / `Подтвердить предложение ET 40`. No `ET ET`; decimal serialization remains unchanged.
- EN recognition, editor/variant eyebrows, recovery copy and image alt text verified.

## Focus and browser QA

Controlled fixture: `tests/browser-fixtures/fitment-vnext-active-workspace.html`, using production Fitment view/styles. Browser actions exercise a local deterministic model; provider/server mutations are covered by the existing controller/API tests, not simulated as live E2E.

Browser: Codex in-app browser. CSS viewports confirmed from `innerWidth/innerHeight`: 1440×1000 and 390×844. Existing browser zoom was compensated when setting viewport/capturing images; the temporary override was reset.

- 22 scenario/viewport frames: maximum count 1, no horizontal overflow, no BODY focus regression after a workspace redraw.
- Actual click sequence: summaries → Recognize → Audi Q8 → Vehicle editor → Save → Confirm details → variant chooser → 55 TFSI quattro → Confirm configuration → empty workspace → Wheel editor.
- Focus: recognition heading → Vehicle heading → variant heading; selection keeps the row; confirmation returns to summary reselection; Wheel opens at its heading. Loading → proposal retains heading focus, and fields/compound controls retain caret/focus during ordinary redraws.
- Console: no error/warn entries during the QA flow.
- First viewport and full-page screenshots inspected for heading hierarchy, island grouping, mobile wrapping and clipping.
- Difference from v13 flat list dividers: their removal is explicitly required by this corrective specification. Existing graphite surfaces, IBM Plex Sans, radii, tokens and technical table retained.

Transcripts:

- [Browser matrix](fitment-active-workspace/browser-matrix.json)
- [Click sequence and focus](fitment-active-workspace/browser-sequence.json)

Captures:

- [Recognition desktop](fitment-active-workspace/recognition-proposed-desktop.jpg)
- [Recognition 390](fitment-active-workspace/recognition-proposed-390.jpg)
- [Vehicle desktop](fitment-active-workspace/manual-vehicle-desktop.jpg)
- [Variant desktop](fitment-active-workspace/required-variant-desktop.jpg)
- [Variant 390](fitment-active-workspace/required-variant-390.jpg)
- [Wheel desktop](fitment-active-workspace/all-confirmed-desktop.jpg)
- [Confirmed summary desktop](fitment-active-workspace/confirmed-summary-desktop.jpg)
- [Recognition EN](fitment-active-workspace/recognition-en-desktop.jpg)

## Tests

- `npm --prefix webapp test`: **200 PASS**.
- Catalogue + transition + composition + focus + boot Node suites: **146 PASS**.
- Relevant Python frontend/catalogue/reselection suites: **85 PASS**.
- Full `pytest -q`: **634 PASS / 5 skipped**, 21 existing deprecation warnings.
- `npm --prefix webapp run build`: PASS; generated tracked bundles unchanged.
- Ruff lint/format: PASS (137 Python files).
- `git diff --check`: PASS.
- Initial full Python run used an incomplete old environment (missing `itsdangerous`). Final full run used a separate temporary virtual environment installed from the repository's pinned requirements.
- Two old presentation assertions were updated for the explicitly required recognition failure heading and configuration eyebrow/primary value. Domain assertions were retained.

## Changed files

- `webapp/vnext/views/fitment.js`
- `webapp/vnext/styles/fitment.css`
- `webapp/app.js` (presentation intent + provider-derived summary metadata only)
- `webapp/auth/vnext-fitment.test.js`
- `tests/test_fitment_vnext_composition.mjs`
- `tests/test_fitment_vnext_focus.mjs`
- `tests/test_fitment_transition_behavior.mjs`
- `tests/browser-fixtures/fitment-vnext-active-workspace.html`
- This evidence and captures/transcripts under `docs/evidence/fitment-active-workspace/`.

## Delivery and limits

Exact final PR HEAD and its CI results are recorded in the PR delivery description. Require green CI on that final SHA and independent UI review before merge. This evidence does not authorize merge/deploy or certify live staging/full E2E, real devices, Telegram WebView or external provider behavior. No disposable live Fitment context was used in this pass. No Render or credit-consuming request was sent.
