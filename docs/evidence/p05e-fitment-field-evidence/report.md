# P0.5-E — Fitment Field-Level Evidence Semantics

Base: `staging @ 5eaa33df3a3afad421becb865347d3637bd9f89e`. Branch: `fix/p05e-fitment-field-evidence`. PR / exact delivery HEAD / CI URL are recorded in the delivery response and PR to avoid a self-referential commit hash.

M-1: **FIXED** — Diameter, Width and ET no longer copy the persisted `size_offset` status. M-2: **FIXED** — numeric PCD and bolt count have separate rows/statuses/reasons. Overall verdict semantics changed: **NO**. Engine/rules version changed: **NO** (`v2` / `v3`). Migration: **NO**.

## Implementation and boundaries

- [`field_evidence.py`](../../../src/fitment/field_evidence.py) compares each saved field against the applicable saved provider reference. Discrete diameter/width comparisons reuse `DIAMETER_TOL_IN` / `WIDTH_TOL_IN`; PCD reuses `PCD_TOL_MM`. No tolerance values change.
- [`_comparison_fields`](../../../src/fitment_checks_api.py) returns six rows per axle, twelve for front/rear evidence. Each field requires its own trusted `FieldValue`; legacy bare/missing/untrusted/malformed values stay unknown, even if an old persisted combined rule was positive. The normalized provider snapshot remains the trusted reference. ET reference selection matches `offset_reference_for` semantics: exact axle + submitted Diameter + submitted Width, stock evidence preferred. No interval means unknown; ET outside it means unknown, never conditional/fail from physical-clearance inference.
- DIA retains the persisted independent `center_bore` result, guarded against missing/untrusted historical evidence. Smaller/equal/larger regressions pass.
- Diameter detail uses the same saved field trust/discrete tolerance comparison as the row. Exact-match is true only for a passing row, false for a trustworthy non-match, null when evidence is insufficient. A match within the existing normalization tolerance is presented within bounds, preventing a passing row from being labelled outside the reference. Mere min/max coverage is never a pass.
- [`fitment.js`](../../../webapp/vnext/views/fitment.js) renders per-row status regardless of overall unknown; axle-table deduplication also compares those statuses. The six result labels/headers are RU/EN. Combined PCD input UX is unchanged. A small mobile column-width adjustment accommodates the new bolt-count label.
- [`app.js`](../../../webapp/app.js) retains overall blocking issues and explicitly describes an absent Diameter+Width combination; missing ET copy describes missing reference for the selected size. No overall verdict is inferred from green field rows.
- Both canonical contracts updated: [fitment-verdict-v1.md](../../fitment/fitment-verdict-v1.md), [fitment-verdict-evidence-rules.md](../../fitment-verdict-evidence-rules.md).

Diff verification against the exact base confirms no edits to CompatibilityEngine, run_checks, assemble_verdict, persisted rule evaluation, provider/normalization, tolerances/versions, schemas/persistence or migrations. The changed response helpers only use saved input_snapshot/evaluation_snapshot/result; they do not fetch current canonical inputs or live provider data.

## Backend and frontend evidence

[`test_fitment_field_evidence.py`](../../../tests/test_fitment_field_evidence.py): **53 passed**. A–J cover independent Diameter/Width, discrete bounds gap, contextual ET inside/outside/missing, same-PCD/wrong-count, same-count/wrong-PCD and both conflicts. Tests run the unchanged overall engine, then project saved evidence and assert expected overall outcomes and no mutations to snapshots/result/versions. Combination `19×9` against `19×8.5` + `20×9` retains overall unknown and its `size_not_in_reference` blocker while the two size rows pass. Tests also cover trust/malformed/missing data, existing tolerances (including diameter bounds), independent trust, historical JSON snapshots, staggered axes and unchanged DIA cases. Historical projection test forbids provider construction and rerunning rules.

Existing saved-axle/exact-decimal and legacy missing-evidence tests retain useful assertions, updated from 10 to 12 fields. Frontend regression tests preserve unknown overall with four pass/two unknown rows, separate numeric PCD/bolt count, independent axle statuses, and RU/EN combination/ET copy. Existing form tests retain five controls.

- Full backend: **760 passed, 22 skipped**. Skips are optional integrations without their explicitly isolated DSNs; exact-HEAD CI additionally runs configured PostgreSQL integration jobs.
- Frontend/auth: **213 passed**.
- Affected Node gateway/catalogue/navigation/composition/focus/boot/render: **194 passed**, including **23 composition tests**.
- Ruff lint/format, diff whitespace: PASS. Frontend build: PASS, no tracked bundle changes.

## Browser QA

[Fixture](../../../tests/browser-fixtures/p05e-fitment-field-evidence.html) uses the production `vnextFitmentSnapshot` adapter, view and i18n over [representative saved API responses](representative-api.json), generated through the actual backend response projection. External network is isolated; no live provider, Telegram WebView or deployed account flow is claimed.

Bundled Playwright Chromium exercised 390×900 / 1440×900, RU/EN and A, B, J, fully compatible, DIA conditional: **20 PASS**. [browser-checks.json](browser-checks.json) records six rows and their field statuses, overall verdict, diameter detail, nonblank page, no overlay/console errors and no horizontal overflow. Mobile/desktop screenshots inspected; long bolt-count label fits with natural wrapping after the column adjustment.

Selected screenshots: [390 RU A](browser-390-ru-A.png), [390 EN B](browser-390-en-B.png), [390 RU J](browser-390-ru-J.png), [1440 EN J](browser-1440-en-J.png), [1440 RU compatible](browser-1440-ru-compatible.png), [1440 EN DIA conditional](browser-1440-en-dia-conditional.png).

## Handoff

Fasteners, load rating, physical clearance, C MEDIUM-1 and other post-release findings remain deferred. No extra overall-positive inference, live-provider change or historical mutation introduced. Merge not performed. Ready for focused independent review of A–J, frontend unknown masking, PCD/bolt-count separation and unchanged overall engine/versions after exact-HEAD CI passes.

## Result copy corrective pass

Independent review requested presentation cleanup after `973b9c5`. The [copy corrective report](copy-corrective/report.md) and fresh browser evidence supersede the earlier Result screenshots/copy: unknown is separate from incompatibility, both PCD/bolt fail reasons are shown, Diameter duplicate removed, ET missing-reference copy clarified, empty metadata hidden and disclaimer shortened. The technical P0.5-E backend diff and saved representative API responses are unchanged. Focused copy re-review is required before merge.
