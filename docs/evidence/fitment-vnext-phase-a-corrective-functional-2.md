# Fitment VNext — Phase A Corrective Functional Pass #2

Status: **PASS — READY FOR INDEPENDENT FOCUSED RE-REVIEW**
Merge gate: **DO NOT MERGE — INDEPENDENT FOCUSED RE-REVIEW REQUIRED**

Base: PR #243 head `512ebe311669ce446b6ac9ffcfadddb8bd5902ac`.
Branch: `fix/fitment-vnext-phase-a-corrections-2`.
Corrective implementation commit: `b3d2baab55c55840a045f16c64839925fc0829d2`.
PR: [#244](https://github.com/NickElixir/dream-wheels-ai/pull/244), base `fix/fitment-vnext-phase-a-corrections` (PR #243 head).
Scope: four corrective findings from the supplied Phase A review/repro archive. No production/main or staging mutation was made.

The supplied ZIP contained production-function test harnesses, browser scripts and fixtures, but no separate independent-review report. Its JavaScript harness paths were adapted in `/tmp` only; the archive itself was not modified. The findings and required behavior are taken from the user-provided corrective specification.

## Corrective findings

| Finding | Correction | Evidence |
|---|---|---|
| B3 — Accepted Wheel value outlived its source/SKU | Accepted status is valid only when both `sourceFingerprint` and `selectedVariantSku` match the current identity. Same-value SKU switches become pending proposals. A prior accepted value is cleared if the new SKU omits that field. | Repro archive `b3_h3.test.mjs`: 13/13 pass. In-repository transition suite adds same-value, missing-value, and changed-value cases. |
| H1 — Manual/source conflict disappeared on SKU selection | Manual conflicts carry their origin and are merged with canonical/parser conflicts after the production SKU-selection action. The real resolve → select path keeps the manual value and displays a conflict. | Repro archive `b3_h3.test.mjs` and browser controlled-transport run show manual ET 30 retained against source ET 35/45. |
| H2 — URL replacement retained old resolver state | URL edits use a shared invalidation path through both VNext bridge and legacy field handling. It clears old fingerprint, SKU, variants, proposal/acceptance context and source conflicts, plus unresolved source-derived values. Manual values, canonical values and rear draft remain. | In-repository bridge test and repro archive `extra.test.mjs` pass. Browser changed URL A→B, resolved the new URL, selected SKU B and saved. Captured PATCH included URL B and no old fingerprint/SKU. |
| H3 — Mutation stale summary was not applied to the detailed check | The mutation overview's explicit `current_check.is_current=false` is merged immediately into the prior detailed check. Its verdict and field evidence stay present. A later 503 or contradictory `true` detail cannot revert stale state. A revision change with no summary still preserves the stale fallback; no revision change does not create staleness. | Repro archive `b3_h3.test.mjs`: H3-a–d pass. New tests cover false + detail 503/true, null summary fallback, and unchanged revision. |

## Frozen contract checks

- Wheel-only Save remains independent of Vehicle completion and leaves Vehicle canonical data/revision untouched. Existing coverage: `WHEEL_ONLY_SAVE works while Vehicle is unconfirmed and keeps its revision`, plus explicit Wheel-only PATCH payload tests.
- `next_action` remains authoritative for Standard Fitment progression. With incomplete Vehicle, Wheel Save succeeds, `Проверить совместимость` stays disabled, and `Создать изображение` stays available.
- No Vehicle data is included in the Wheel-only PATCH.
- FITMENT_VERDICT does not grant or block Render permission.
- Numeric picker controls accept decimal values in the browser without console errors; the numeric focus/runtime regression remains green.

## Verification

- Adversarial B3/H3 harness from ZIP: **13 passed, 0 failed**.
- Additional B1/B2/B4/H1/H2/H4 and URL regression harnesses from ZIP: **34 passed, 0 failed**.
- `node --test tests/test_fitment_transition_behavior.mjs`: **73 passed, 0 failed**.
- Vehicle catalogue behavior: **10 passed, 0 failed**.
- Webapp boot behavior: **3 passed, 0 failed**.
- VNext focus behavior: **1 passed, 0 failed**.
- `pytest -q`: **612 passed, 5 skipped**; 14 existing httpx deprecation warnings.
- Targeted resolver/API/backend tests: **109 passed**.
- `node --test tests/vercel_gateway.test.js`: **3 passed**.
- Webapp auth harness: **183 passed, 0 failed**.
- `ruff check .`, `ruff format --check .`, Python `compileall`, webapp build and `git diff --check`: **passed**.

The additional, non-CI `tests/test_fitment_vnext_composition.mjs` currently has one existing contract mismatch: its second assertion requires the required Vehicle variant chooser to disappear while the Wheel editor is active. The renderer still shows the server-required chooser alongside the Wheel editor; Wheel Save and field controls remain operable. That file was unchanged in this corrective pass. This test was not part of the repository CI workflow and does not fail any CI gate listed above.

## Controlled-transport browser QA

Used the production WebApp on `127.0.0.1:8774` with a local mock API on `127.0.0.1:10000`; no staging account or live backend was contacted.

- Resolved a two-SKU source; selected SKU A; confirmed its values.
- Selected SKU B with DIA absent. The old DIA value cleared, the field showed as missing, and Wheel Save stayed disabled.
- Entered manual ET 30, resolved/select SKU A and B, and observed the visible conflict copy (`Подтверждено: 30 — найдено: 35/45`). Keeping 30 preserved the manual value.
- Replaced the URL with `https://shop.example.test/other-wheel`; the prior source values/context were invalidated while manual ET remained. Re-resolved the new URL, selected SKU B, resolved the manual conflict, completed DIA, and saved.
- Captured PATCH summary: URL was `…/other-wheel`; `source_fingerprint` and `selected_variant_sku` were both `null` after the final manual DIA edit cleared resolver identity; no old URL-A provenance was mixed into the payload; no `vehicle` object was sent. The app showed “Параметры сохранены”.
- Wheel summary kept Vehicle unconfirmed and Standard Check disabled from `next_action`; Create Image stayed enabled.
- Browser viewports: **1440×1000** and **390×844**. At mobile size `documentElement.scrollWidth` was 354 px against `innerWidth` 354 px; no horizontal overflow.
- Browser console error log: **empty**. No `InvalidStateError` observed.

## Remaining gate

Full authenticated staging E2E remains **not run**. There is still no disposable staging Fitment context. This pass did not create a staging job, call a live resolver, launch a render, change credits, deploy, or alter staging data.

The change is ready for an independent focused re-review on PR #244. **Do not merge until that review is complete.**
