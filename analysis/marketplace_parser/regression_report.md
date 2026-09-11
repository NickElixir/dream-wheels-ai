# Dream Wheels AI — 03B-C Yandex Minimal Marketplace Adapter

## Decision

`03B_C_ACCEPTANCE = FAIL`

`YANDEX_RELEASE_1 = DEFERRED`

The minimal Yandex adapter is implemented and the frozen benchmark was run, but the useful-document gate was not met. The result is deliberately kept fallback-first: incomplete data remains incomplete, and no unanchored recommendation or seller value is promoted to a rim draft.

## Reproducibility

- Dataset: frozen `DATASET_VERSION = 1`, `ym-001` through `ym-015`.
- Dataset base commit: `e5b93c1b49268e02f64a1ec8271055d9c8fc916b`.
- Implementation checkout: `0c889eaa66d1be46a4ea701d500639fdc978fa58`.
- Before result: `results_before.json` from the frozen base checkout.
- After result: `results_after.json` from the implementation checkout.
- Network mode: direct fixed-profile HTTP, no browser cookies, proxy, account state, or arbitrary endpoint.

## Implementation scope

`src/yandex_market_adapter.py` handles only the explicit hosts `business.market.yandex.ru` and `market.yandex.ru`. The generic resolver remains the path for other stores; Wildberries and Ozon were not implemented.

The adapter preserves HTTPS, public DNS/IP validation, credential and port checks, redirect limits, a 15-second timeout, `trust_env=False`, and a 2 MiB read bound. It accepts a product only when exactly one JSON-LD `Product` is anchored by the requested numeric card ID in its product or offer URL. Technical values are then extracted from that isolated product name using deterministic wheel-marking patterns. The 15-byte HTML shell is explicitly non-useful.

One secondary request is allowed only to the same known Yandex card, with a second fixed header profile. No cookie, token, session, or discovered URL is used. In this run it was used on five cases and did not turn those responses into useful product documents.

## Benchmark gates

| Gate | Before | After | Required | Result |
|---|---:|---:|---:|---|
| HTTP fetch success | 15/15 | 15/15 | — | pass |
| Useful current-product document | 0/15 | 10/15 | ≥14/15 | **fail** |
| Critical false data | 0 | 0 | 0 | pass |
| Wrong selected variant | N/A | N/A | 0 | N/A; frozen set has no multi-variant card |
| Cross-variant contamination | N/A | N/A | 0 | N/A |
| Recommendation contamination | generic control risk | 0 observed | 0 | pass for isolated adapter |
| Manual fallback | 15/15 applicable | 13/15 applicable | pass | pass |
| Existing-store regression | 0 new regressions | 0 new regressions | 0 | pass |

The five non-useful after cases were `ym-002`, `ym-004`, `ym-007`, `ym-008`, and `ym-009`; each remained an explicit unknown after the one permitted retry. The adapter therefore did not manufacture technical values for them.

## Field result

| Field | Before extracted/correct | After extracted/correct | After precision |
|---|---:|---:|---:|
| brand | 0/0 | 10/10 | 100% |
| model | 0/0 | 0/0 | N/A |
| SKU/article | 0/0 | 0/0 | N/A |
| diameter | 0/0 | 8/8 | 100% |
| width | 0/0 | 8/8 | 100% |
| PCD | 0/0 | 10/10 | 100% |
| ET | 0/0 | 9/9 | 100% |
| DIA | 0/0 | 5/5 | 100% |

The after metrics are availability-aware: a missing value is not counted as false data. The full machine-readable observation set is in [results_after.json](results_after.json).

## Security and regression verification

The new adapter tests cover explicit host detection, non-Yandex exclusion, the fixed request profile, bounded body reads, the 15-byte shell, current-product anchoring, conflicting anchors, recommendation isolation, and protection against interpreting width-by-diameter as PCD. The focused suite passed: 12 tests.

The full suite completed with `453 passed, 3 skipped, 1 failed`. The sole failure is the known pre-existing release-configuration assertion that `.vercel/project.json` exists; it is unrelated to the adapter and was not changed.

## Release recommendation

Keep Yandex in automatic-attempt plus user-review/manual-completion mode. Do not claim Release 1 marketplace support until useful fetch reaches at least 14/15 under a stable, approved request profile. Do not add browser automation, cookies, CAPTCHA handling, parallel parser paths, or a Yandex-specific fitment model in this slice.
