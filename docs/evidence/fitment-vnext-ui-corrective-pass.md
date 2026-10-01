# Technical Fitment VNext — bounded UI corrective pass

**Date:** 2026-10-01 (Europe/Moscow)
**UI corrective status:** `PASS — READY FOR OWNER REVIEW`
**Merge status:** `DO NOT MERGE YET — OWNER UI REVIEW + INDEPENDENT RE-REVIEW REQUIRED`

## PR / tested HEAD

| Item | Value |
| --- | --- |
| PR | [Draft #245](https://github.com/NickElixir/dream-wheels-ai/pull/245) |
| Base | #244, `fix/fitment-vnext-phase-a-corrections-2` |
| Exact base SHA | `ac236e75c64b70800ba67964a3c12cd379ec7ffd` |
| New tested implementation HEAD | `5c01e8794265558541b8e2248f0fce9515ef3fb4` |
| Branch | `fix/fitment-vnext-ui-fidelity` |
| Runtime CI | [36894673781 — SUCCESS](https://github.com/NickElixir/dream-wheels-ai/actions/runs/36894673781), exact implementation HEAD above |
| Delivery HEAD | PR current `headRefOid`; the following evidence packaging commit changes only this report and its artifacts. Final delivery SHA/checks are also recorded in the PR description. |

This is one bounded corrective PR stacked on #244. No merge, deployment, production/main change, backend engine/schema/provider/payment/credits/Render/Garage change, or global navigation redesign was performed. v13 remains a reference; no reference HTML is imported into runtime.

## Authorities and review inputs

The owner's **UI Corrective Implementation Pass** specification was the execution request. The supplied **Dedicated UI Fidelity & Usability Review** and E1–E12 ZIP were review evidence. Their findings were evaluated against the frozen authorities; quoted recommendations did not supersede the owner's approved decisions.

Read authorities:

- [Implementation specification](../ui/fitment-vnext-implementation-spec.md).
- [Design Code](../ui/dream-wheels-application-design-code-vnext-v0.1.md) and [2026-09-27 amendment](../ui/dream-wheels-application-design-code-vnext-amendment-2026-09-27.md).
- [Visual System 2.0 Phase 1](../ui/vnext-visual-system-2.0-phase1.md).
- [UI state V2](../ui/fitment-ui-state-spec-v2.md), [flow contract V2](../ui/fitment-flow-contract-v2.md), [state machine](../architecture/fitment-vnext-state-machine.md).
- [API contract](../fitment-api-contract-v1.md), [runtime mapping](../ui/fitment-runtime-mapping-v1.md), [ET selection contract/evidence](../fitment/et-selection-contract-and-evidence.md), commercial warning handoff referenced by the implementation spec.
- Complete [frozen v13 prototype](../references/fitment-vnext-integrated-prototype-v13.html).

Authority order: frozen domain/state → new owner-approved corrective decisions → amendment → Design Code → implementation/UI state → VS2.0 → v13 → existing runtime.

## IMPLEMENTED UI CORRECTIONS

| Finding / requirement | Implemented correction | Verification | Status |
| --- | --- | --- | --- |
| C1 One active workspace | Explicit Wheel editing suppresses the required Vehicle chooser. A newly authoritative required Vehicle transition takes the workspace, preserves Wheel draft, and restores it after successful confirmation. Optional reselection restores the prior workspace on Cancel. | Original composition assertions; transition suite; E2 after | PASS |
| C2 Proposal / confirmed | Pending neutral surface/helper and regular value; confirmed selected surface, strong border, weight 600; accessible state in control names. | Renderer; real-app five accept actions; E4 after | PASS |
| Units | `20″`, `9J`, `5×112`, `66,6`, `ET 35,125`; mm in full comparison context. API values stay exact numeric values. | Renderer; ET tests; captured PATCH | PASS |
| Confirmation progress | Five compound parameters, with bolt count + PCD as one. Counter 5→4→3→2→1→0; separate progress for staggered axles. | Renderer + real app | PASS |
| C3 Compact Wheel Identity | Brand/model heading, SKU beneath; identity fields behind secondary edit action; selected resolver SKU visible. | Renderer; E1/E7 after | PASS |
| M4 Uniform / staggered hierarchy | Segmented mode before geometry. Uniform “Обе оси”; separate named axes, desktop columns/mobile stack; concise front-only SKU note. | Renderer + all four sizes | PASS |
| C4 / M2 Source density | Equal 176px desktop / 150px mobile preview stages; `contain` for both images; paired mobile actions. | Measured matrix; E3 after | PASS |
| C6 Card status copy | Vehicle confirmation/required variant status; Wheel authoritative state and confirmation progress. | Renderer + transition; E10 | PASS |
| C7 / M1 Manual actions | Outlined secondary controls, paired action family; no plain-text manual fallback. | Browser + CSS | PASS |
| C8 / M3 Picker polish | Header title/Close separated, radius 10, manual input without decorative divider; mobile bottom sheet. | E6/E12 + four sizes | PASS |
| C9 Result | One result panel, verdict/meaning → conditions or blocking issues → comparison → warning → Edit. Row semantic accent only where appropriate. Unknown is neutral. | Renderer + E5/E9 after | PASS |
| Conditional Staggered Result | Single shared table only if displayed values, row meanings and conditional/fail tones are equivalent; otherwise front/rear tables. Missing rear evidence never claims equivalence. | Renderer + supplemental browser captures | PASS |
| Current Result actions | Create Image primary; recheck and Edit secondary. Stale/failed recovery keeps contextual hierarchy. | Renderer + browser | PASS |
| Stale / failed | One stale headline; previous-result table caption; failed reassurance that confirmed data is preserved. | Renderer + E9 after | PASS |
| C10 / L1 Scroll / focus | Open editor scrolls to heading and focuses it; acceptance restores the same compound; Save focuses status notice; picker Escape/opener return and keyboard trap preserved. | Focus suite + real mobile app | PASS |
| C11 / L2 Decimals | Shared display-only formatter across app summary/renderer/editor/SKU/conflict/table/picker. RU comma / EN point; no rounding or serialization change. | Renderer + transition + PATCH | PASS |
| C5 Canonical Standard | Only confirmed canonical Vehicle + exact variant and confirmed canonical Wheel/setup; em dash while incomplete. Unsaved draft never appears as saved summary. | Actual adapter transition tests + renderer | PASS |
| Multi-SKU density | Flat rows; aligned shared desktop legend; repeated compact labels at narrow widths; selected cue; optional real thumbnail only. No URL form or geometry workspace inside chooser. | Renderer + E7 after | PASS |
| SKU chooser Cancel | Cached alternatives or readonly resolver lookup preserve accepted A, provenance and exact values. Cancel closes chooser without invalidation. Selecting B applies #244 invalidation/conflict behavior with fresh fingerprint. | Transition + real-app Cancel | PASS |
| Multi-SKU resolver outcome | Valid variants with no shared top-level geometry are a neutral choice, with focus on chooser; no false failure/retry/manual fallback. | Transition + browser | PASS |
| Warning punctuation | Warning and disclaimer read raw localized strings; terminal punctuation and sentence separation preserved. | Renderer + RU/EN browser | PASS |
| Locale | Fitment static text, table, picker, SKU legend and ARIA labels localized. Empty identity/conflict/candidate boundary cases covered. | 19 EN browser states: zero visible/ARIA Cyrillic residue; renderer tests | PASS |
| ZEEKR suggestion | Trim/case/space/underscore/hyphen normalization of slug/display spellings removes duplicate selected candidate. | Renderer | PASS |
| Guest demo variants | Guest Vehicle Save invokes actual required exact-variant lookup. | Real-function behavioral test | PASS |
| Legacy confirmation | Clear/success only after `result.applied`; failed/not-applied keeps selection and feedback. | Transition + backend regression | PASS |
| Generic Save | Owner required; obsolete bridge `save` action removed. No implicit mutation. | Transition + static | PASS |
| Manual provenance | Clear old fingerprint/SKU/source contexts/cache; transfer accepted values to explicit manual ownership; pending values remain pending. | Transition | PASS |
| History/context loading | History loading reset on navigation/context change; new chooser cache/identity cleared when opening another job. | Transition | PASS |
| Dead UI cleanup | Remove proven-unused visual summary helpers and Fitment CSS selectors. No broad refactor. | Search + static + full regression | PASS |
| Composition / focus CI | Explicit CI step runs both suites; original composition assertions unchanged (VM import loader updated for shared module). | Runtime CI success | PASS |

## PRODUCT DECISIONS IMPLEMENTED

1. **One active workspace:** branch editing stays independent; authoritative required Vehicle takeover preserves return context and Wheel draft. Required selection cannot be dismissed; optional reselection can.
2. **Compact Wheel Identity:** brand/model + SKU is the normal heading. Editable identity is a secondary recovery path.
3. **Conditional Staggered Result:** one table for genuinely equivalent displayed evidence; two for differences in value, row meaning, condition tone or missing rear evidence.
4. **Current-result action hierarchy:** Create Image primary; recheck and Edit secondary. No verdict-based Render gate.
5. **SKU chooser Cancel:** A remains accepted and saveable until B is actually selected. Opening/Cancel is not source replacement.

## BEFORE / AFTER FIDELITY

Before images below are **compressed derivatives of the supplied review evidence**, not new before-state browser claims. Original ZIP/PNGs remain untouched. [Source hashes and derivative metadata](fitment-vnext-ui-corrective-pass/before-provenance.json) record provenance. After images use the production `createFitmentView`/`refreshFitmentView` renderer and real styles; real-app captures additionally exercise the application bridge.

| Evidence | Before | After / corrected state |
| --- | --- | --- |
| E1 Wheel composition | [E1](fitment-vnext-ui-corrective-pass/before/E1_wheel_editor_1440_v13_vs_runtime.jpg) | [Compact confirmed Wheel](fitment-vnext-ui-corrective-pass/after/1440-all-confirmed.jpg) |
| E2 Concurrent workspaces | [E2](fitment-vnext-ui-corrective-pass/before/E2_one_active_workspace_regression_1440.jpg) | [Required Vehicle only](fitment-vnext-ui-corrective-pass/after/1440-required-variant.jpg); independent Wheel draft/return covered by transition/composition |
| E3 Mobile source density | [E3](fitment-vnext-ui-corrective-pass/before/E3_mobile_390_initial_v13_vs_runtime.jpg) | [390 sources](fitment-vnext-ui-corrective-pass/after/390-initial-sources.jpg) |
| E4 Proposal contrast | [E4](fitment-vnext-ui-corrective-pass/before/E4_proposal_vs_confirmed_runtime.jpg) | [All proposed](fitment-vnext-ui-corrective-pass/after/1440-all-proposals.jpg), [partial](fitment-vnext-ui-corrective-pass/after/1440-partial-acceptance.jpg), [all confirmed](fitment-vnext-ui-corrective-pass/after/1440-all-confirmed.jpg) |
| E5 Conditions / Result | [E5](fitment-vnext-ui-corrective-pass/before/E5_result_conditions_1440.jpg) | [Conditions](fitment-vnext-ui-corrective-pass/after/1440-compatible_with_conditions.jpg) |
| E6 Mobile picker header | [E6](fitment-vnext-ui-corrective-pass/before/E6_mobile_picker_header.jpg) | [390 DIA](fitment-vnext-ui-corrective-pass/after/390-picker-dia.jpg), [390 ET](fitment-vnext-ui-corrective-pass/after/390-picker-et.jpg) |
| E7 SKU density / decimals | [E7](fitment-vnext-ui-corrective-pass/before/E7_sku_selection_1440.jpg) | [1440 SKU](fitment-vnext-ui-corrective-pass/after/1440-multi-sku.jpg), [390 SKU](fitment-vnext-ui-corrective-pass/after/390-multi-sku.jpg) |
| E8 Staggered | [E8](fitment-vnext-ui-corrective-pass/before/E8_staggered_1440.jpg) | [Editor](fitment-vnext-ui-corrective-pass/after/1440-staggered.jpg), [same Result](fitment-vnext-ui-corrective-pass/after/1440-staggered-result-identical.jpg), [different Result](fitment-vnext-ui-corrective-pass/after/1440-staggered-result-different.jpg) |
| E9 Stale / failed | [E9](fitment-vnext-ui-corrective-pass/before/E9_stale_failed_runtime.jpg) | [Stale](fitment-vnext-ui-corrective-pass/after/1440-stale.jpg), [failed](fitment-vnext-ui-corrective-pass/after/1440-failed.jpg) |
| E10 Wheel-only Save | [E10](fitment-vnext-ui-corrective-pass/before/E10_after_wheel_save_1440.jpg) | [Real app save status](fitment-vnext-ui-corrective-pass/after/app-390-wheel-save.jpg), [captured PATCH](fitment-vnext-ui-corrective-pass/wheel-save-requests.json) |
| E11 Open-editor focus | [E11](fitment-vnext-ui-corrective-pass/before/E11_mobile_tap_manual_no_visible_change_390.jpg) | [Real app heading focus](fitment-vnext-ui-corrective-pass/after/app-390-manual-focus.jpg) |
| E12 Desktop picker | [E12](fitment-vnext-ui-corrective-pass/before/E12_desktop_picker_dialog.jpg) | [1440 ET](fitment-vnext-ui-corrective-pass/after/1440-picker-et.jpg) |

Reference comparisons: [Wheel](fitment-vnext-ui-corrective-pass/comparison/v13-runtime-wheel.jpg), [SKU](fitment-vnext-ui-corrective-pass/comparison/v13-runtime-sku.jpg), [staggered](fitment-vnext-ui-corrective-pass/comparison/v13-runtime-staggered.jpg), [conditions](fitment-vnext-ui-corrective-pass/comparison/v13-runtime-conditions.jpg), [stale](fitment-vnext-ui-corrective-pass/comparison/v13-runtime-stale.jpg). These label a v13 viewport beside a runtime full-page capture; fixture values and global shell differ. They are composition comparisons, not a same-data pixel-diff score.

## RESPONSIVE QA

**76 checked/captured states**, all at exact measured CSS viewport; [measurement file](fitment-vnext-ui-corrective-pass/qa-metrics.json). Screenshots use exact CSS width; modal screenshots are viewport-only, other screenshots extend to the document height. All screenshots were visually inspected directly or in contact sheets, with key controls/results inspected at full size.

### 1440

1440×1000: 19 PASS. Two source columns, compact active editor, aligned SKU rows, two staggered columns; centered picker. No horizontal page overflow; at most one workspace. Preview stage pair 176px.

### 1024

1024×768: 19 PASS. Two source columns, compact wrapped chooser/action layouts; geometry adapts to available width. No horizontal page overflow; at most one workspace. Preview stage pair 176px.

### 768

768×1024: 19 PASS. Source pair still readable in two columns; axle layout stacks; picker is a bottom sheet. No page overflow; at most one workspace. Preview stage pair 176px.

### 390

390×844: 19 PASS. Source cards stack with 150px equal stages and paired actions. Compound controls remain readable; staggered axes and footer actions stack. Opening an editor in the actual app scrolls/focuses the heading into view. Bottom navigation does not overlap the saved status. No horizontal page overflow; at most one workspace.

### Complete matrix

Each cell links to the saved after capture.

| State | 1440 | 1024 | 768 | 390 |
| --- | --- | --- | --- | --- |
| initial-sources | [PASS](fitment-vnext-ui-corrective-pass/after/1440-initial-sources.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/1024-initial-sources.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/768-initial-sources.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/390-initial-sources.jpg) |
| manual-vehicle | [PASS](fitment-vnext-ui-corrective-pass/after/1440-manual-vehicle.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/1024-manual-vehicle.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/768-manual-vehicle.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/390-manual-vehicle.jpg) |
| required-variant | [PASS](fitment-vnext-ui-corrective-pass/after/1440-required-variant.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/1024-required-variant.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/768-required-variant.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/390-required-variant.jpg) |
| multi-sku | [PASS](fitment-vnext-ui-corrective-pass/after/1440-multi-sku.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/1024-multi-sku.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/768-multi-sku.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/390-multi-sku.jpg) |
| all-proposals | [PASS](fitment-vnext-ui-corrective-pass/after/1440-all-proposals.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/1024-all-proposals.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/768-all-proposals.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/390-all-proposals.jpg) |
| partial-acceptance | [PASS](fitment-vnext-ui-corrective-pass/after/1440-partial-acceptance.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/1024-partial-acceptance.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/768-partial-acceptance.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/390-partial-acceptance.jpg) |
| all-confirmed | [PASS](fitment-vnext-ui-corrective-pass/after/1440-all-confirmed.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/1024-all-confirmed.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/768-all-confirmed.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/390-all-confirmed.jpg) |
| manual-conflict | [PASS](fitment-vnext-ui-corrective-pass/after/1440-manual-conflict.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/1024-manual-conflict.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/768-manual-conflict.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/390-manual-conflict.jpg) |
| uniform | [PASS](fitment-vnext-ui-corrective-pass/after/1440-uniform.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/1024-uniform.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/768-uniform.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/390-uniform.jpg) |
| staggered | [PASS](fitment-vnext-ui-corrective-pass/after/1440-staggered.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/1024-staggered.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/768-staggered.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/390-staggered.jpg) |
| picker-dia | [PASS](fitment-vnext-ui-corrective-pass/after/1440-picker-dia.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/1024-picker-dia.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/768-picker-dia.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/390-picker-dia.jpg) |
| picker-et | [PASS](fitment-vnext-ui-corrective-pass/after/1440-picker-et.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/1024-picker-et.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/768-picker-et.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/390-picker-et.jpg) |
| both-ready | [PASS](fitment-vnext-ui-corrective-pass/after/1440-both-ready.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/1024-both-ready.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/768-both-ready.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/390-both-ready.jpg) |
| compatible | [PASS](fitment-vnext-ui-corrective-pass/after/1440-compatible.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/1024-compatible.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/768-compatible.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/390-compatible.jpg) |
| compatible_with_conditions | [PASS](fitment-vnext-ui-corrective-pass/after/1440-compatible_with_conditions.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/1024-compatible_with_conditions.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/768-compatible_with_conditions.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/390-compatible_with_conditions.jpg) |
| incompatible | [PASS](fitment-vnext-ui-corrective-pass/after/1440-incompatible.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/1024-incompatible.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/768-incompatible.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/390-incompatible.jpg) |
| unknown | [PASS](fitment-vnext-ui-corrective-pass/after/1440-unknown.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/1024-unknown.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/768-unknown.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/390-unknown.jpg) |
| stale | [PASS](fitment-vnext-ui-corrective-pass/after/1440-stale.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/1024-stale.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/768-stale.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/390-stale.jpg) |
| failed | [PASS](fitment-vnext-ui-corrective-pass/after/1440-failed.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/1024-failed.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/768-failed.jpg) | [PASS](fitment-vnext-ui-corrective-pass/after/390-failed.jpg) |

Additional checks: [staggered Result 1 vs 2 tables](fitment-vnext-ui-corrective-pass/qa-staggered-results.json); [19 EN states, zero visible/ARIA Cyrillic residue](fitment-vnext-ui-corrective-pass/qa-locale.json); [EN conditions screenshot](fitment-vnext-ui-corrective-pass/after/1440-en-conditions.jpg).

## ACCESSIBILITY / FOCUS

- Production controls retain semantic labels, error relationships, live statuses, keyboard navigation and non-color confirmation cues. Picker background is inert; Escape closes picker and restores opener; keyboard loop remains inside dialog.
- Actual local app at 390: manual Vehicle action focused `fitment-vehicle-editor-title`, about 39px below the viewport top. No invisible “open below the fold” task.
- Resolver → SKU A → five accept actions retained each compound's focus and advanced counters 4/3/2/1/0. Opening alternatives and cancelling retained all five accepted values and enabled Save.
- ET search `33,275`, keyboard wrap and Escape/opener return worked. Manual `35,125` serialized as exact numeric `35.125`.
- Wheel-only Save with unfinished Vehicle focused the saved-status notice after refresh. [Real accepted-controls screenshot](fitment-vnext-ui-corrective-pass/after/app-390-confirmed-focus.jpg), [real picker screenshot](fitment-vnext-ui-corrective-pass/after/app-390-et-picker.jpg).
- Refresh selection APIs are used only for supported text-like input types. Numeric controls do not access unsupported selection properties. No `InvalidStateError`, uncaught app error or focus error was observed in the controlled app or renderer console.
- Editor scrolling uses immediate `auto` behavior, including reduced-motion preference. No motion was introduced.

This is implementation/browser QA, not a screen-reader usability certification or Telegram-device QA.

## FUNCTIONAL REGRESSION

| Frozen contract | Evidence | Result |
| --- | --- | --- |
| Independent Wheel-only Save with unfinished Vehicle | Actual local app + transition/backend tests; captured rim-only PATCH | PASS |
| Wheel Save leaves Vehicle canonical/revision unchanged | Owner-specific payload/transition tests and backend regression; PATCH has no `vehicle` object | PASS |
| Numeric selection safety | Focus suite, numeric-input guard and browser console | PASS |
| `next_action` authoritative for Standard progression | Existing API/transition contracts; no client recomputation introduced | PASS |
| Independent branches editable/saveable | Owner-specific save + one-workspace transition tests | PASS |
| `FITMENT_VERDICT != RENDER_PERMISSION` | Renderer/auth/transition/backend coverage; Create Image remains independent | PASS |
| `dirty != stale`, revisions/currentness/conflicts | Existing transition/backend regression remains green | PASS |
| Exact decimal ET, no rounding | ET picker/formatter tests + captured `35.125` PATCH | PASS |
| Staggered rear draft/provenance | Existing #244 behavior and new chooser/manual tests | PASS |
| Queued/processing check mutation lock | Existing behavior/renderer contracts | PASS |

The controlled local API proof uses disposable in-memory responses and records only request method/path/body. It does not call staging, mutate production history, spend credits or start a render. Its post-PATCH per-field fixture statuses are simplified; the browser save proof establishes action/payload/focus, while actual backend/state tests establish canonical/revision behavior.

Guest exact-variant flow is verified by a real-function behavioral test. A separate browser guest navigation attempt landed on Dashboard because guest restore navigation is intentionally ignored; no guest browser E2E completion is claimed.

## AUTOMATED TESTS

| Exact command | Result |
| --- | --- |
| `npm --prefix webapp test` | **190 PASS**, including 36 Fitment renderer/auth tests; [log](fitment-vnext-ui-corrective-pass/logs/frontend-unit.txt) |
| `node --test tests/test_fitment_transition_behavior.mjs tests/test_fitment_vehicle_catalogue_behavior.mjs tests/test_fitment_vnext_composition.mjs tests/test_fitment_vnext_focus.mjs tests/test_webapp_boot_behavior.mjs` | **98 PASS** = 81 transition + 10 catalogue + 2 composition + 2 focus + 3 boot; [log](fitment-vnext-ui-corrective-pass/logs/fitment-behavior.txt) |
| `node --test tests/vercel_gateway.test.js` | **3 PASS**; [log](fitment-vnext-ui-corrective-pass/logs/gateway.txt) |
| `pytest -q` | **612 PASS / 5 skip**, 14 existing httpx deprecation warnings; [log](fitment-vnext-ui-corrective-pass/logs/backend-pytest.txt) |
| `npm --prefix webapp run build` | PASS; generated auth bundle unchanged; [log](fitment-vnext-ui-corrective-pass/logs/frontend-build.txt) |
| `ruff check .` | PASS |
| `ruff format --check .` | PASS; 135 files already formatted |
| `node --check webapp/app.js` / `node --check webapp/vnext/views/fitment.js` | PASS |
| `git diff --check` | PASS |
| `pre-commit run` + commit hooks | PASS on scoped staged files; [log](fitment-vnext-ui-corrective-pass/logs/precommit.txt); no bypass |

The initial all-files pre-commit run also normalized unrelated historical files; all such automatic changes were restored. Frozen references and unrelated files therefore remain byte-for-byte unchanged. Final hooks ran on this PR's staged scope.

## CI STATUS

[Runtime CI 36894673781](https://github.com/NickElixir/dream-wheels-ai/actions/runs/36894673781) completed **SUCCESS** on `5c01e8794265558541b8e2248f0fce9515ef3fb4`. Composition and focus are an explicit normal CI step. CI also runs Ruff, Python syntax/pytest, gateway, catalogue, transition, boot, auth renderer tests and unchanged-bundle build.

Final evidence-only delivery commit is rechecked by CI. Its exact delivery HEAD/current check URL is recorded in the PR description and final handoff, avoiding a self-referential SHA embedded in its own commit.

## REMAINING DIFFERENCES FROM V13

| Visible difference | Classification | Reason / authority |
| --- | --- | --- |
| Real photo/product image, including white product-photo background, instead of prototype sketches | INTENTIONAL RUNTIME ADAPTATION | Use real source as-is with `contain`; Design Code source policy. No image background rewriting/cropping. |
| Live brand/model/SKU/value/variant/condition text differs from v13's BBS/Mercedes examples | INTENTIONAL RUNTIME ADAPTATION | Data from runtime/fixtures; frozen API and exact decimal contract. Finish/color appears only if actual identity supplies it. |
| Contextual recognition is secondary while editing/confirmed; required Vehicle state has manual/recovery action | INTENTIONAL RUNTIME ADAPTATION | Owner's corrective spec §§21/22/36/37 explicitly refines v13's static source CTA presets. |
| Secondary “Edit identity”, per-axle progress and front-only SKU note | INTENTIONAL RUNTIME ADAPTATION | Approved compact-identity/manual recovery and staggered-source requirements. |
| Current completed Result normally has no expanded editor; Create Image is primary | INTENTIONAL RUNTIME ADAPTATION | Approved current-result hierarchy and one-workspace decisions. |
| One or two Result tables depending on displayed axle evidence; missing rear remains separate | INTENTIONAL RUNTIME ADAPTATION | Approved Conditional Staggered Result decision; no false equivalence. |
| Native chained catalogue controls and conditional Market handling | INTENTIONAL RUNTIME ADAPTATION | Frozen catalogue/variant state semantics; no new catalogue widget redesign. |
| Application title/back/global shell/nav differ from prototype navigation/demo controls | INTENTIONAL RUNTIME ADAPTATION | Existing VNext application composition; global navigation explicitly outside corrective scope. |
| QA scenario/locale controls shown in renderer screenshots | INTENTIONAL RUNTIME ADAPTATION — QA harness only | Not in product runtime; fixture imports real production renderer/styles. Actual app screenshots establish product behavior. |
| Additional errors/conflicts/retry/async text, where the prototype has no corresponding live state | INTENTIONAL RUNTIME ADAPTATION | Frozen API/state contracts, owner-specific errors and accessibility requirements. |
| Uniform mislabel / post-geometry mode / repeated identity form / vertically heavy sources / picker radius / stale duplication / mixed decimals | ELIMINATED | Corrected in this pass and evidenced above. |

No known unclassified visual drift or unresolved HIGH corrective finding remains. Owner review is still the next decision gate; this report does not substitute for it.

## UI_CHANGE_MANIFEST

| Files | Change boundary |
| --- | --- |
| `webapp/vnext/views/fitment.js` | Presentation, compact identity/chooser, status/progress, canonical summary slots, current actions, conditional axle comparison, localization and focus preservation |
| `webapp/vnext/styles/fitment.css` | Fitment-only geometry/density, surfaces/radii, source stages, flat rows, mode/axles, compound state, picker and responsive rules |
| `webapp/vnext/fitment-display.mjs` | Shared pure decimal display formatter; no parsing/rounding/payload logic |
| `webapp/app.js` | Canonical adapter, explicit owner save, bounded workspace/focus/chooser/demo/provenance/history/legacy cleanup |
| `tests/browser-fixtures/fitment-vnext-ui-fidelity.html` | QA presets using actual production renderer/styles; no runtime HTML prototype import |
| `.github/workflows/ci.yml` | Composition + focus CI gate |
| Fitment/auth/boot VM harness tests | Shared module import loader + targeted behavior/locale regression; unrelated assertions preserved |
| `tests/test_fitment_frontend_g2.py` | Static expectation for the shared formatter |
| This report and sibling directory | Before/after, source hashes, exact browser metrics, local PATCH, locale and test evidence |

Existing VS2.0 color/focus tokens are used. Semantic color is confined to actual verdict/condition meaning. No global Design Code or frozen reference was edited.

## Completion gate

| Gate | Result |
| --- | --- |
| one active workspace | PASS |
| proposal vs confirmed | PASS |
| units | PASS |
| confirmation progress | PASS |
| compact Wheel identity | PASS |
| uniform/staggered hierarchy | PASS |
| source density | PASS |
| mobile task discovery | PASS |
| scroll/focus | PASS |
| CTA hierarchy | PASS |
| canonical Standard summaries | PASS |
| multi-SKU density | PASS |
| SKU chooser cancel semantics | PASS |
| picker polish | PASS |
| manual fallback style | PASS |
| decimal consistency | PASS |
| staggered Result semantics | PASS |
| result action hierarchy | PASS |
| warning punctuation | PASS |
| locale consistency | PASS |
| ZEEKR duplicate | PASS |
| guest demo variants | PASS — behavioral test, no guest browser E2E claim |
| legacy confirmation cleanup | PASS |
| generic save cleanup | PASS |
| manual provenance cleanup | PASS |
| history loading cleanup | PASS |
| composition CI | PASS |
| focus CI | PASS |

## Boundaries / next gate

`FITMENT_VNEXT_AUTHENTICATED_STAGING_FULL_E2E = BLOCKED — DISPOSABLE FITMENT CONTEXT REQUIRED`

Local browser QA and backend regression do not complete authenticated staging Phase B. Independent UI re-review, novice-user test, integration review, bottom-up staging merge, deployment and Telegram QA were not performed. Work stops at this bounded candidate as requested.

Owner can inspect the real renderer fixture locally, then review the actual application against this PR. All archived artifacts are indexed by [SHA-256 manifest](fitment-vnext-ui-corrective-pass/artifact-manifest.json).

**UI CORRECTIVE STATUS:** `PASS — READY FOR OWNER REVIEW`

**MERGE STATUS:** `DO NOT MERGE YET — OWNER UI REVIEW + INDEPENDENT RE-REVIEW REQUIRED`


## Owner polish pass — PR #245 (2026-10-01)

Bounded follow-up to delivery `ae605adf409337aa64003c8993a1ecebbbcededa`, per owner specification. Original fidelity evidence remains unchanged. No backend/API/domain changes.

| Item | Implementation / verification | Status |
|---|---|---|
| P1 Market | Existing provider flow retained: zero → no_data recovery; one → auto-resolved and hidden; multiple → provider select, explicit selection. Parent model change invalidates Market resolution until a new Year is selected and provider data revalidated. | PASS |
| P2 SKU | Shared 88px action column and same-width end-aligned action. Compact breakpoints explicitly place action at row 1 / column 2. Full values, missing DIA and ET 42.125123 exercised. | PASS |
| P3 Conflicts | Value-only chips, graphite current selection, neutral proposal, source in aria-label. Existing conflict-keep/use actions retained. Current styling does not resolve conflict. ET and DIA keep/use tested against real runtime without canonical mutation; Width renderer genericity tested. | PASS |
| P4 Staggered | Front/rear status in separate block spans with 4px gap; uniform remains one status. | PASS |
| P5 Titles | Source section labels font-weight 600; unchanged position, size and color. RU / EN verified. | PASS |
| P6 CTA | Check primary only at server run_standard_check and no current Result/editor; current Result makes Create Image primary. Render availability remains independent of verdict. | PASS |
| Local ready | Ready to save / Готово к сохранению when Wheel readiness is complete and unsaved; branch-local dirty projection supports editing already confirmed Wheel. Standard summaries remain canonical. | PASS |
| P7 Scope | No changes to approved composition, picker, Result, source dimensions, focus, or frozen semantics. | PASS |

### Automated verification

- Frontend: 193 PASS (`npm --prefix webapp test`).
- Functional Fitment + Catalogue + Composition/focus + Boot: 100 PASS (`node --test tests/test_fitment_transition_behavior.mjs tests/test_fitment_vehicle_catalogue_behavior.mjs tests/test_fitment_vnext_composition.mjs tests/test_fitment_vnext_focus.mjs tests/test_webapp_boot_behavior.mjs`). Includes ET/DIA keep/use and provider single → parent change → multi-market.
- Backend: 612 PASS, 5 skipped; 14 existing httpx deprecation warnings (`pytest -q`).
- Frontend build: PASS; generated bundles unchanged.
- Required commit hooks and CI: final results recorded in PR owner-polish section.

### Browser verification

Production renderer/styles fixture at http://127.0.0.1:8776/tests/browser-fixtures/fitment-vnext-ui-fidelity.html, in-app browser through CUA; no external Playwright fallback. Seven states at exact CSS viewports 1440×1000, 768×1024, 390×844: multi-SKU, manual conflict, staggered incomplete, both-ready, current compatible, all-confirmed unsaved, multi-market. Page identity/nonblank/no-overlay/console/interaction checks PASS.

All 21 measured cases have zero horizontal overflow. All SKU action x positions/widths match within each viewport; subtitles weight 600. Both-ready/current result class hierarchy verified. ET proposal click produces local 33.275; keep click produces 35.125; chips disappear and fixture Save enables only after explicit choice. Real-runtime tests separately verify actions/canonical preservation; fixture callbacks are limited presentation interactions, not backend E2E.

Existing browser zoom 110% was compensated for exact CSS viewport measurement and screenshot coordinates. Device overrides cleared afterwards; no persistent zoom change. EN titles/chips/statuses checked; multi-market fixture contains Russian provider option labels, which remain provider data, not translated runtime UI strings.

[Measured cases](fitment-vnext-owner-polish/qa-metrics.json), [locale checks](fitment-vnext-owner-polish/qa-locale.json), [artifact hashes](fitment-vnext-owner-polish/artifact-manifest.json).

| State | Desktop | Tablet | Mobile |
|---|---|---|---|
| Multi-SKU | [1440](fitment-vnext-owner-polish/1440-multi-sku.jpg) | [768](fitment-vnext-owner-polish/768-multi-sku.jpg) | [390](fitment-vnext-owner-polish/390-multi-sku.jpg) |
| Conflict | [1440](fitment-vnext-owner-polish/1440-manual-conflict.jpg) | [768](fitment-vnext-owner-polish/768-manual-conflict.jpg) | [390](fitment-vnext-owner-polish/390-manual-conflict.jpg) |
| Staggered | [1440](fitment-vnext-owner-polish/1440-staggered.jpg) | [768](fitment-vnext-owner-polish/768-staggered.jpg) | [390](fitment-vnext-owner-polish/390-staggered.jpg) |
| Both-ready | [1440](fitment-vnext-owner-polish/1440-both-ready.jpg) | [768](fitment-vnext-owner-polish/768-both-ready.jpg) | [390](fitment-vnext-owner-polish/390-both-ready.jpg) |
| Current Result | [1440](fitment-vnext-owner-polish/1440-compatible.jpg) | [768](fitment-vnext-owner-polish/768-compatible.jpg) | [390](fitment-vnext-owner-polish/390-compatible.jpg) |
| Unsaved confirmed Wheel | [1440](fitment-vnext-owner-polish/1440-all-confirmed.jpg) | [768](fitment-vnext-owner-polish/768-all-confirmed.jpg) | [390](fitment-vnext-owner-polish/390-all-confirmed.jpg) |
| Multiple Market | [1440](fitment-vnext-owner-polish/1440-vehicle-multi-market.jpg) | [768](fitment-vnext-owner-polish/768-vehicle-multi-market.jpg) | [390](fitment-vnext-owner-polish/390-vehicle-multi-market.jpg) |

### Owner-polish gate

PASS — READY FOR OWNER FINAL REVIEW (subject to green final CI recorded in PR).

DO NOT MERGE — OWNER FINAL REVIEW + INDEPENDENT UI RE-REVIEW REQUIRED

Authenticated staging full E2E remains BLOCKED: disposable Fitment context required. Telegram WebView / independent re-review are not claimed. No merge or deployment performed.


## Final focused UI gate correction

Previous independently reviewed HEAD: `078b8624b0b2199f725233080484fafecd4e4ae4`.
New delivery HEAD and final CI result: recorded in the **Final UI gate corrections** section of [PR #245](https://github.com/NickElixir/dream-wheels-ai/pull/245) and final delivery response; the commit containing this report cannot embed its own hash. One focused correction commit.

Read the focused review `/Users/nikolai/Downloads/fitment-vnext-final-ui-rereview-078b862.md` in full. P1–P7 and preceding approved design remain frozen. No backend, schema, provider semantics, payments, Render, staging or Telegram changes.

| Finding | Correction | Verification |
|---|---|---|
| N1 | Production readiness now explicitly returns conflict field names. Conflict has priority over zero-pending all-confirmed copy. One progress notice: **Выберите значение перед сохранением.** Source card: **Требуется выбрать значение**; Save disabled. Notice preserves its approved terminal period through the existing global copy normalization. | Actual app.js snapshot tests + real shell browser |
| M1 | SKU technical values use nowrap/keep-all/normal wrapping; ≤400px specs use two columns. The action container stays 88px and aligned. | 390×844 + 360×844, all 15 values one line and fit their cells, including Не определено / 42,125123 / 8,5J / 5×112 |
| L1 | Both unresolved choices aria-pressed=false; removed selected chip rule. Keyboard focus outline remains distinct from resolved selection. | Renderer and browser semantics |
| L2 | Conflict group uses ET / DIA / Ширина / Диаметр / PCD, with EN equivalents; English sources use Current ET value / ET value from product page. No internal key in labels. | All six runtime component fields; RU/EN |
| L3 | Chips carry the same parameter focus key. Existing refresh restores its compound with preventScroll. If another PCD sub-conflict still disables the value button, focus goes to the same compound opener. | Real mouse ET use, keyboard ET keep/DIA use; focus tests for ET/DIA/Width/PCD |
| L5 | Complete unsaved draft: open editor → Готово к сохранению; closed → Есть несохранённые изменения. Canonical Standard Wheel remains — until Save. | Actual runtime snapshots/open+closed browser |
| L4 demo cleanup | Five demo-only CN market identifiers now use the provider-style chdm slug already used by demo catalogue. No deduplication by visible label and no production alias/provider logic changes. | Default demo + catalogue regressions |
| Fixture parity | Shared production buildFitmentRimReadiness factory builds ready/missing/invalid/pending/conflicts for runtime and fixture. Fixture no longer hardcodes readiness objects/fictional fields. Runtime tests compare real vnextFitmentSnapshot shape to shared contract. | Explicit parity + N1 runtime regressions |

### N1 runtime state

Before: editor Все параметры подтверждены; source card Не хватает параметров; disabled Save without explanation.
After: pending=[]; conflicts=[offset_et_mm]; editor Выберите значение перед сохранением.; source card Требуется выбрать значение; Save disabled.
After explicit keep/use: conflict removed; selected local draft preserved; canonical unchanged; Все параметры подтверждены; Save enabled when other requirements hold. ET 35.125/33.275, DIA 66.6/72.6, Width 9/8.5 tested both ways.

### Focused browser evidence

In-app browser through CUA, no fallback. Real **app.js + VNext adapter + shell + renderer/styles** served locally at `http://127.0.0.1:8774/__seed.html` with the existing controlled local API. Test-only server appended a local state-seeding helper to the served app module, setting complete manually confirmed draft and source conflict; runtime readiness/snapshot/render/action/refresh were the production functions. This instrumentation was not committed and is not part of runtime. No staging/production calls or Save/PATCH were made. Controlled server stopped and runtime tab closed after QA.

Real runtime at 1440×1000: unresolved ET → mouse use → compound focus; ready editor open; closed unsaved. Real runtime at 390×844: unresolved ET; keyboard keep; keyboard DIA use; closed unsaved. Canonical snapshot before/after resolution identical. Source/Standard guidance remains separate. Mobile shell scrolls internally; mobile evidence captures affected viewport after normal control focus, not an invented document-height full-page view.

SKU production-renderer fixture at `http://127.0.0.1:8776/tests/browser-fixtures/fitment-vnext-ui-fidelity.html`: 390×844 and 360×844. Range measurements prove each value occupies one line and fits its cell; all action widths 88px and x positions equal within each viewport. No horizontal overflow. Readiness shape now shared; fixture remains preset data, not authenticated E2E.

Page identity, meaningful content, no framework overlay, relevant console errors=0, interaction proof and screenshots PASS. Existing browser zoom compensated for exact CSS sizes; all temporary device overrides cleared.

[Runtime QA](fitment-vnext-final-ui-gate/runtime-qa.json), [SKU QA](fitment-vnext-final-ui-gate/sku-qa.json), [EN chip labels](fitment-vnext-final-ui-gate/a11y-en.json), [artifact hashes](fitment-vnext-final-ui-gate/artifact-manifest.json).

| State | Evidence |
|---|---|
| Real runtime unresolved ET, desktop | [1440](fitment-vnext-final-ui-gate/1440-runtime-et-unresolved.jpg) |
| Real runtime ET use / ready-open | [1440](fitment-vnext-final-ui-gate/1440-runtime-ready-open-et-use.jpg) |
| Real runtime unsaved closed | [1440](fitment-vnext-final-ui-gate/1440-runtime-unsaved-closed.jpg), [390](fitment-vnext-final-ui-gate/390-runtime-unsaved-closed.jpg) |
| Real runtime unresolved ET, mobile | [390](fitment-vnext-final-ui-gate/390-runtime-et-unresolved.jpg) |
| Real runtime ET keep / compound focus | [390](fitment-vnext-final-ui-gate/390-runtime-et-keep-focus.jpg) |
| Real runtime DIA use / keyboard focus | [390](fitment-vnext-final-ui-gate/390-runtime-dia-use-keyboard.jpg) |
| Atomic SKU values | [390](fitment-vnext-final-ui-gate/390-sku-atomic-values.jpg), [360](fitment-vnext-final-ui-gate/360-sku-atomic-values.jpg) |

### Final local test counts

- Frontend (`npm --prefix webapp test`): **194 PASS**.
- Transition + Catalogue + Composition + Focus + Boot: **110 PASS** (90 + 11 + 2 + 4 + 3).
- Backend (`pytest -q`): **612 PASS, 5 skipped**, 14 existing httpx warnings.
- Frontend build: PASS; generated bundles unchanged.
- Ruff check: PASS; format: 135 files unchanged.
- Diff check: PASS. Required pre-commit and final CI results recorded in PR after commit.

Preserved regression coverage: one workspace, proposal/confirmed, picker, decimal precision, Market, staggered Result, canonical summaries, SKU Cancel, both-ready/current CTA, Render independence, async isolation/provenance, Wheel-only Save while Vehicle unfinished.

### Remaining external checks

- **Verify actual Wheel Size API market options do not produce duplicate semantic choices.** This is a staging QA item, not a local gate blocker.
- Authenticated staging full E2E remains BLOCKED pending disposable Fitment context; Telegram QA and cumulative integration review not claimed.
- One independent focused re-check of N1/M1/L1–L3/L5/parity still required. No further design pass or merge/deploy performed.

Local UI corrections: **PASS**. Delivery gate awaits successful publication and CI; final delivery status and exact HEAD are recorded in the PR/final response when reachable.

**DO NOT MERGE YET — ONE FOCUSED INDEPENDENT CHECK REQUIRED**
