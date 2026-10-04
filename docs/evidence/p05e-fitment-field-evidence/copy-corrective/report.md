# P0.5-E COPY CORRECTIVE PASS

PR: [#261](https://github.com/NickElixir/dream-wheels-ai/pull/261). Reviewed HEAD: `973b9c521068fe45ab096bfb756d9645b7dd4d4a`. Base remains `staging @ 5eaa33df3a3afad421becb865347d3637bd9f89e`. New delivery HEAD / exact-HEAD CI are recorded in the PR and delivery response.

MEDIUM-1: **FIXED**. Unknown title is “Не можем подтвердить совместимость” / “Compatibility could not be confirmed”; its reasons heading is “Что не удалось подтвердить” / “What could not be confirmed”. Only incompatible uses “Почему не подходит” / “Why it does not fit”. The generic unknown paragraph describes inability to confirm the whole size without claiming all rows are unknown.

LOW-1: **FIXED**. `fitmentResultBlockingCopy` in [`app.js`](../../../../webapp/app.js) adds the backend's failing `pcd_mismatch` / `bolt_count_mismatch` field rows to incompatible summary copy, showing supplied vehicle/wheel values. It replaces matching primary reasons, deduplicates identical front/rear messages and preserves unrelated blockers. No values are compared to derive a status. A single supplied fail produces a single conflict; a pass with different supplied values does not produce a new conflict.

LOW-2: **FIXED**. The standalone Diameter reference block is removed from [`fitment.js`](../../../../webapp/vnext/views/fitment.js). Backend diameter_reference_details, projection and technical tests remain intact. The existing diameter presentation helper/data remains available; Result no longer renders the duplicate block.

LOW-3: **FIXED**. ET with backend `vehicle_reference_offset_missing`, null reference and known submitted Diameter/Width displays “Нет для этого размера” / “None for this size”. Unknown row display is “Нет данных” / “No data”. Missing submitted size retains neutral no-data copy. No new reason code or backend value introduced.

Other requested copy cleanup: size_not_in_reference names the supplied size from backend details; redundant provider_allowed_wheels missing-data copy is suppressed when that size blocker already explains it. Shared-axle caption is “Одинаково для обеих осей” / “Same for both axles”; empty/placeholder bottom metadata is hidden while supplied useful metadata/actions remain. One compact disclaimer paragraph replaces the two disclaimer blocks; RU/EN symmetry retained. Backend unknown/pass/fail/conditional statuses are unchanged.

## Verification

- Full backend: **760 passed, 22 skipped** (optional integrations without their explicit isolated DSNs). Existing P0.5-E field evidence and diameter/backend tests unchanged and passing.
- Frontend/auth: **213 passed**. Related Node suite: **199 passed**, including **28 composition/copy tests**. Node checks cover mixed statuses, unknown/incompatible headings, submitted-size explanation, both/single PCD/bolt conflicts, preserving other blockers, no inference from differing values, absent Diameter block, ET with/without supplied size, axle caption, empty/partial metadata, compact disclaimer and RU/EN.
- Build, Ruff lint/format and diff whitespace: PASS; no tracked bundle changes.
- `git diff --exit-code 973b9c5 -- src migrations tests/test_fitment_field_evidence.py tests/test_fitment_diameter_reference.py tests/test_fitment_checks_api.py`: PASS (empty diff). Fitment engine, overall semantics, backend field evidence/API, reason codes, tolerances, versions, provider and persistence changed: **NO**. Migration: **NO**.
- [browser-checks.json](browser-checks.json): **20 PASS**, A/B/J/compatible/DIA conditional × RU/EN × 390×900/1440×900. Real production adapter/view/i18n on the unchanged [saved API fixture](../representative-api.json), isolated network; no deployed provider/account or Telegram WebView claim. Verified actual row statuses, specific size, exactly one size explanation, both J reasons, no compatible error block, no Diameter/empty metadata block, shared caption, ET reference text, one disclaimer paragraph, no RU in EN, no overlay/errors/overflow.
- Selected screenshots inspected: [390 RU A](browser-390-ru-A.png), [390 EN B](browser-390-en-B.png), [390 RU J](browser-390-ru-J.png), [1440 EN J](browser-1440-en-J.png), [1440 RU compatible](browser-1440-ru-compatible.png), [1440 EN DIA conditional](browser-1440-en-dia-conditional.png).
- Exact corrective HEAD CI checked after push; result and URL recorded in PR/delivery response.

Merge not performed. Ready for focused copy re-review: unknown/incompatible wording, simultaneous PCD/Bolt reasons, ET missing-reference display, absent Diameter duplicate and unchanged technical P0.5-E diff. Existing deferred findings remain deferred.
