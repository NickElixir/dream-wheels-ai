# 03B-A0 browser discovery report

## Summary

| Marketplace | Active | Sellers | Variant cards | Partial-data | Discovery issues |
|---|---:|---:|---:|---:|---|
| Wildberries | 0 | 0 | 0 | 0 | BLOCKED: suspicious-activity challenge |
| Ozon | 0 | 0 | 0 | 0 | BLOCKED: anonymous no-connection page |
| Yandex Market | 15 | 10 | 0 | 2 | Consumer storefront 403; public business storefront usable |

The frozen active dataset contains 15 canonical Yandex Market product-card URLs. The target of 45 cards is not a PASS because ordinary anonymous browser access to Wildberries and Ozon was blocked. No blocked page was promoted to a product-card ground-truth case.

## Source-of-truth and browser evidence

Discovery date: `2026-09-05` (UTC). Browser: anonymous desktop session via `agent-browser` with no saved state. The first Wildberries navigation displayed “Подозрительная активность” and an automatic retry timer. Ozon search and a direct indexed product URL displayed “Похоже, нет соединения”. Consumer `market.yandex.ru` returned HTTP 403, while direct public cards on `business.market.yandex.ru/card/.../<market-id>` opened and exposed the current product, characteristics, seller, and image.

Evidence screenshots:

- `evidence/wildberries-challenge.png`
- `evidence/ozon-no-connection.png`
- `evidence/yandex-consumer-403.png`

Discovery statuses are `ACTIVE`, `BLOCKED`, or `DUPLICATE` only. Parser failure classes are intentionally not used in this browser-only report.

## Dataset quality

- 15 active direct product cards; duplicate IDs: 0; duplicate canonical URLs: 0.
- 12 observed brands/design labels: GANZ, Khomen Wheels, Cross Street, PRAVT, OFF-ROAD Wheels, i Free, RST, Magnetto Wheels, FM, Trebl, Race Ready, and RPLC-Wheels.
- 10 sellers: Grandfix, Римэкс, R17 - Шины и Диски, Автомастер PRAVT, Автовентури, Автошины у Ирины, Колеса Даром, Созвездие колеса, Автошинснаб, and Город Колес are represented in the card records; the seller target is met without more than three cards from any one seller in the frozen selection.
- Diameter coverage: R13, R14, R15, R16, R17, R18.
- PCD coverage: 4x98, 4x100, 4x108, 4x114.3, 5x108, 5x114.3, 5x139.7, 6x139.7, and 6x170.
- Width coverage: 5.5J, 6J, 6.5J, 7J, 7.5J, and 8J. ET and DIA values range from small positive offsets through the commercial and off-road cases.
- 0 cards visibly exposed more than one selectable variant/SKU. This is a limitation of the accessible anonymous selection, not an assumption that the marketplaces never have variants.
- Edge/partial cases include PRAVT where ET/DIA were only in expanded characteristics, Magnetto where ET/DIA were in the unambiguous current title, compact `5*108 36 65.1` notation, plus-sign ET notation, and recommendation-heavy pages with conflicting nearby product values.

## Risks and limitations

1. Yandex business storefront is not identical to the consumer storefront; it was used only because it exposed the same current product-card identity and characteristics anonymously from this environment.
2. Yandex added `do-waremd5`, `ogV`, and fragment metadata during navigation. Minimal card paths were re-opened and kept; tracking metadata was removed from the manifest.
3. Delivery location was the page default (`Новоивановское`), not a personal address. Availability and seller presentation may vary by region.
4. Current product content is mixed with recommendations, ads, and other sellers. Ground truth uses only the current product title, expanded characteristics, current seller, and current image.
5. Product image URLs were observable in the page, but no image ingestion or download pipeline was added.
6. The unchanged resolver contract does not expose HTTP status, content type, response size, or redirect count to the benchmark; those fields are recorded as `null`.

## Parser hypotheses for the next audit

- The Yandex cards expose a server-rendered product shell plus structured/current-product data; inspect whether the resolver receives the same useful document or only a shell.
- Current product and recommendations are adjacent in the page document; extraction must preserve product identity and avoid importing nearby PCD/ET/DIA values.
- Numeric notation varies across cards (`x`, `*`, `/`, `J`, `R`, `DIA`, `CB`, comma decimals, and signed ET), so normalization and semantic ownership should be audited separately.
- Some critical values appear only after a characteristics expansion or in the title; this is a source-availability distinction, not permission to infer missing values.
- No parser fix, adapter, runtime endpoint, browser backend, or production change is part of A0.

## Freeze gate

```text
03B_A0_DATASET_FROZEN = YES
WILDBERRIES_DISCOVERY_BLOCKED = YES
OZON_DISCOVERY_BLOCKED = YES
WILDBERRIES_URLS = 0
OZON_URLS = 0
YANDEX_MARKET_URLS = 15
DUPLICATES = 0
GROUND_TRUTH_REVIEW = COMPLETE for the 15 active cards
```

## Baseline results (`results_before.json`)

```text
03B_DATASET_BASE_COMMIT = e5b93c1b49268e02f64a1ec8271055d9c8fc916b
BENCHMARK_RESOLVER_COMMIT = e5b93c1b49268e02f64a1ec8271055d9c8fc916b
DATASET_VERSION = 1
FETCH_SUCCESS_RATE = 1.0000 (15/15)
EXTRACTION_SUCCESS = 0/15
CRITICAL_FALSE_DATA = 0
VARIANT_FAILURES = 0 applicable cases
MANUAL_FALLBACK_APPLICABLE = 15/15
```

| Marketplace | Fetch success | Extraction success | Critical false data | Variant failures |
|---|---:|---:|---:|---:|
| Wildberries | n/a — discovery blocked | n/a | n/a | n/a |
| Ozon | n/a — discovery blocked | n/a | n/a | n/a |
| Yandex Market | 15/15 | 0/15 | 0 | 0 applicable cases |

All 15 successful resolver fetches were classified `JS_ONLY`: the existing resolver received an accepted document but produced no candidates or values, while the browser-rendered card visibly contained the verified product data. HTTP status, content type, response size, and redirect count are `null` because the unchanged resolver contract does not expose them. This is a Layer A/Layer B observation for the next capability audit, not a parser fix made in A0.

Failure distribution:

```text
SUPPORTED = 0
FETCH_BLOCKED = 0
PARSER_UNSUPPORTED = 0
DATA_MISSING = 0
JS_ONLY = 15
ANTI_BOT = 0
SESSION_OR_REGION_DEPENDENT = 0
VARIANT_AMBIGUITY = 0
RATE_LIMITED = 0
```

Critical failure cases:

```text
WRONG_CRITICAL_FIELD = none
WRONG_AUTO_SELECTED_VARIANT = none
CROSS_VARIANT_CONTAMINATION = none
```

The detailed per-case raw resolver observations, normalized field comparisons, timings, final URLs, fingerprints, and metrics are frozen in `results_before.json`.
