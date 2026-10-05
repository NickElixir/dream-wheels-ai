# P3-A — known UI findings / narrow polish

Base: staging 874d8ba3d37742a89af7f8b844a412269233065a. Finding ledger created before production edits. Reviewed 5, fixed 1, obsolete 3, deferred 1, owner decisions 0.

Result Download minimum height increased 42 → 44px; Result feedback actions 40 → 44px. Two CSS declaration changes only. Existing auth-suite exact CSS assertion updated to the new requirement; no tests removed. No Fitment CSS, runtime JS, copy, layout order, API, backend, database or assets changed.

## UI_CHANGE_MANIFEST

- USER_VISIBLE_CHANGES: Result Download and two feedback buttons have minimum 44px height at all widths.
- NEW_USER_VISIBLE_ELEMENTS: NONE.
- REMOVED_ELEMENTS: NONE.
- INTERACTION_PATTERN_CHANGES: NONE.
- SOURCE_FOR_EACH_CHANGE: historical full-screen QA-004 mobile target finding plus current P3-A §20 ≥44px contract; baseline browser measurements reproduced 42px/40px.
- UNSPECIFIED_DESIGN_DECISIONS: NONE.

## Verification

Browser plugin/skill not available; regular Playwright using existing deterministic e01 fixture and production views/styles. 104 RU/EN rendered states at 1440/1024/768/390: Create, Processing, Result, History, refunded, missing asset, compatible, conditional, unknown, incompatible, stale, failed and wheel editor. Zero horizontal overflow, page errors or broken images in this isolated matrix. Existing Create fixture references nonexistent demo-rim-xtrike.jpg; QA-only request substitution uses existing demo-rim-xtrike.png. This is a harness limitation, not a runtime asset correction or evidence of authenticated upload behavior.

Result-specific checks: all three affected targets ≥44px, long vehicle metadata wraps, keyboard slider moves 50 → 51%, Download retains keyboard focus. Desktop/mobile screenshots before and after use production Result fixture in RU. Rendered screenshots inspected. Original sections, image-first order and CTA hierarchy retained. No redesign or new references.

Existing Node behavioral regressions cover Create/render and Fitment transitions (269 passed); auth 213 passed; Python 762 passed, 22 database-dependent tests skipped locally. Ruff check/format PASS (154 files); frontend build PASS with tracked bundle parity; diff check PASS. Flow coverage combines deterministic states with existing behavioral suites; no live authenticated generation/provider/payment operation claimed. Fitment presentation is untouched; this is not a new comprehensive Fitment audit.

Before/after: before-result-1440.jpg, after-result-1440.jpg, before-result-390.jpg, after-result-390.jpg. Four-width metrics: browser-results.json.

Exact HEAD CI must be verified after push; PR is for focused independent visual review, merge not authorized by this task.
