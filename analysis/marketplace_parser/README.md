# Marketplace parser benchmark and closeout (03B)

This directory contains the frozen browser-discovered reference dataset, capability audit, Release 1 decision, Yandex adapter benchmark, and closeout evidence for `03B — Marketplace Parser Compatibility`. Live marketplace fetches are manual research runs; they are not part of CI.

## Current status

```text
YANDEX_RELEASE = BEST_EFFORT
WILDBERRIES_RELEASE = DEFERRED
OZON_RELEASE = DEFERRED
CRITICAL_FALSE_DATA = 0
MANUAL_FALLBACK = REQUIRED
LIVE_CI_BENCHMARK = NO
PRODUCTION = NOT_TOUCHED
```

Yandex Market uses `src/yandex_market_adapter.py` for ID-anchored JSON-LD extraction after a fixed request profile. Empty shells and captcha fail closed. Wildberries/Ozon hosts are detected and rejected without generic extract. Ordinary stores keep the generic resolver.

The original Release 1 closeout recorded `YANDEX_RELEASE_1 = DEFERRED` because useful fetch was `10/15` against a `>=14/15` gate. Best-effort runtime no longer uses that gate.

## Versioning and freeze

`manifest.yaml` is the frozen product-card identity list. `ground_truth.yaml` is an independent manual transcription of facts visible on the current product card. Unknown or unconfirmed values are `null`. `results_before.json` contains the raw and normalized baseline observations.

The dataset is version `1`, discovered at `2026-09-05T16:24:04Z`, against:

```text
03B_DATASET_BASE_COMMIT=e5b93c1b49268e02f64a1ec8271055d9c8fc916b
BENCHMARK_RESOLVER_COMMIT=e5b93c1b49268e02f64a1ec8271055d9c8fc916b
```

`03B_A0_DATASET_FROZEN = YES`. Do not modify the dataset after freeze without incrementing `dataset_version` and documenting the change.

## Discovery method

Discovery used an anonymous desktop `agent-browser` session through `npx --yes agent-browser`. No marketplace account, saved cookies, session state, credentials, proxy, CAPTCHA solving, or anti-bot bypass was used. Yandex cards were opened on its public business storefront because the consumer storefront returned 403 from this environment. The page default displayed the Novoyivanovskoye delivery location; no personal address was entered.

Only direct product-card pages were included. Search/category pages, recommendations, ads, other sellers, reviews, questions, and similar products were not used as ground truth. Canonical URLs keep the product-card path and marketplace product ID and remove observed tracking/query metadata.

Wildberries and Ozon could not provide anonymous product cards in this environment. The reproducible blockers and screenshots are recorded in `discovery_report.md` and `evidence/`; this is an honest non-PASS for those marketplace targets, not parser failure data.

## Benchmark execution

The runner loads `manifest.yaml` and `ground_truth.yaml`, imports `src.rim_url_resolver.resolve_rim_product_url` from a clean checkout whose `HEAD` must equal `manifest.resolver_commit`, and writes `results_before.json`. The runner verifies both the commit and clean checkout before any live fetch. The resolver is run directly with its existing HTTP contract; browser cookies and state are not passed to it.

From this directory's repository root:

```bash
git worktree add --detach /tmp/dream-wheels-a0-base e5b93c1b49268e02f64a1ec8271055d9c8fc916b
python analysis/marketplace_parser/run_benchmark.py \
  --resolver-root /tmp/dream-wheels-a0-base
```

`PyYAML` is a development-only dependency used to read the YAML reference files. The live run is separate from the tooling tests:

```bash
PYTHONPATH=analysis/marketplace_parser pytest -q analysis/marketplace_parser/test_metrics.py analysis/marketplace_parser/test_runner.py
```

## Metrics and taxonomy

Metrics are unweighted and reported overall, per marketplace, and per field. Availability counts a non-null manual ground-truth value. Extraction rate counts a non-null resolver value only when the field is available. Precision counts exact normalized matches among extracted available values. `critical_false_data` counts an incorrect or unexpected value for diameter, width, PCD, ET, or DIA; it must not be hidden by aggregate scores.

Variant metrics are `null` when no multi-variant card is present. Cross-variant contamination is calculated only when selected-variant ground truth and resolver values make the comparison representable. Manual fallback is marked applicable for extraction/selection failures where the user could still enter the verified parameters.

The baseline failure classes are:

```text
SUPPORTED
FETCH_BLOCKED
PARSER_UNSUPPORTED
DATA_MISSING
JS_ONLY
ANTI_BOT
SESSION_OR_REGION_DEPENDENT
VARIANT_AMBIGUITY
RATE_LIMITED
```

The runner records fetch HTTP/status/content-size diagnostics as `null` when the unchanged resolver contract does not expose them. This preserves the contract rather than adding runtime instrumentation.

## Known limitations

The accessible Yandex cards were all single visible SKU cards, so variant-selection coverage is 0 applicable cases. Marketplace responses are dynamic and may change by region, availability, seller, or session. The benchmark does not download product images. Wildberries, Ozon, and the consumer Yandex storefront need a future anonymous discovery run from an environment where ordinary browser access is available.

No marketplace parser, fitment, frontend, auth, gateway, or production behavior is changed by this closeout. `results_before.json` and `results_after.json` remain historical evidence and are not rewritten to present the rejected attempt as a pass. See `closeout.md` for the final gates, staging evidence, and `PRE_AUTH_BASELINE`.
