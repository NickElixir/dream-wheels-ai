# 03B-A Marketplace Capability Audit

Audit date: 2026-09-05. This is a diagnostic slice only. The frozen A0 dataset and `results_before.json` were not rewritten.

## Executive Summary

| Marketplace | Browser discovery | Backend fetch | Product data in tested backend response | Current parser extraction | Variant safety | Complexity | Primary root cause |
|---|---|---|---|---|---|---|---|
| Wildberries | NO | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | HEAVY | Browser anti-bot; no valid direct card URL recovered |
| Ozon | NO | NO | NO | NO | UNKNOWN | HEAVY | 403 challenge on two verified direct product URLs |
| Yandex Market | YES | PARTIAL | NO in resolver response; YES in an alternate full-HTML control | NO on resolver response | UNKNOWN | MEDIUM | Request-profile/redirect-sensitive fetch; empty HTML shell |

The important Yandex result is a layer split. The current resolver request received `200 text/html` but only `<!DOCTYPE html>` (15 bytes) for all 15 cases, producing zero candidates. An alternate anonymous request profile received full HTML with three JSON-LD blocks and the current product ID, proving that the marketplace can expose product data without login, but the generic extractor does not reliably isolate the current product from adjacent objects. The frozen A0 label `JS_ONLY` therefore remains historical and is reclassified here as `SESSION_OR_REGION_DEPENDENT` (request-profile/redirect-sensitive fetch).

Ozon was separated correctly: the anonymous browser showed a no-connection presentation, while the resolver-style backend request reached the marketplace and received `403 text/html` with challenge markers and no product ID or structured data. Wildberries could not be promoted to a backend case because no verified direct wheel-card URL was recovered; its backend capability is intentionally `UNKNOWN`.

## Audit Baseline

```text
BASE_COMMIT = e5b93c1b49268e02f64a1ec8271055d9c8fc916b
DATASET_VERSION = 1
RESOLVER_COMMIT = e5b93c1b49268e02f64a1ec8271055d9c8fc916b
03B_A0_DATASET_FROZEN = YES
RESULTS_BEFORE_REWRITTEN = NO
```

The backend diagnostic used the existing `PublicHttpsPolicy`, `FetchLimits`, and `extract_rim_document` from the exact frozen resolver tree. IPv4-only transport was used only to bypass this host's local IPv6 `No route to host`; no resolver or parser file was changed. No cookies, account state, proxy, token, CAPTCHA solving, or browser state was used.

## Yandex

### Fetch and response structure

All 15 frozen cards returned the same resolver-profile response shape:

```text
status_code = 200
content_type = text/html; charset=utf-8
response_bytes = 15
body_prefix = <!DOCTYPE html>
resolver candidates = 0
resolver variants = 0
```

The body hash was identical for the 15-byte response. It contained no product title, product ID, JSON-LD, embedded application state, recommendation data, image data, or critical wheel value. This explains the observed `fetch success = 15/15` versus `extraction = 0/15`: the resolver's fetch contract treated a minimal HTML response as a successful document, but it was not a useful product document.

The alternate anonymous full-HTML control request was retained only as metadata, not as raw HTML. It returned a 1.8–2.2 MB document for all 15 cases, with three JSON-LD blocks, the current product ID somewhere in every response, and recommendation/related-product markers in every response. The current ID occurred 92–461 times, so occurrence alone is not an anchor. The canonical product URL occurred either once or five times. The current ID appeared in the primary JSON-LD `sku` for only 9/15 controls; several pages use another offer/seller SKU in structured data.

### Data presence and extraction

Critical values are physically present in the alternate full response for the current card or its page metadata, but not in the response seen by the current resolver request profile. Running the unchanged generic extractor against the full-HTML control produced 6–18 candidates per page, but it is not a safe support path:

- `ym-004` exposed the current brand/SKU but none of the critical fields through the generic structured extraction, although ET/DIA were visible in the manually verified expanded card.
- `ym-005` selected another SKU (`102020173272`) rather than the frozen card ID (`102555834550`).
- `ym-008` selected width `4.0` in the resolver-shaped result while the frozen current product is `5.5`; this is an observed critical false value on the control path.
- Multiple controls produced missing or alternate seller/article values even when the response contained many nearby technical values.

Therefore the audited extraction result is:

```text
baseline_classification = JS_ONLY (frozen A0)
audited_classification = SESSION_OR_REGION_DEPENDENT
current_resolver_extraction = NO
full_html_generic_extraction = UNSAFE / not supported
critical_false_data_in_frozen_baseline = 0
observed_control_false_critical_value = 1 case (ym-008 width)
```

### Current-product anchoring

Potential anchors exist in the full response: the numeric ID in the requested URL, canonical metadata, JSON-LD `url`/offer URL, page title metadata, and sometimes a structured `sku`. They are not uniform enough to accept a first `Product`, first matching wheel marking, first SKU, or text-nearest object. A future adapter must require a match against the requested Yandex product ID and a known canonical/offer URL, then scope technical fields to that object. Any object without that relationship must remain untrusted.

### Recommendation contamination

Recommendation markers appeared in all 15 full-HTML controls (82–92 markers per document). The response also contained many image markers, other product IDs, related products, advertisements, and seller/offer context. `RECOMMENDATION_CONTAMINATION_RISK = HIGH` for an unscoped generic extractor. A high extraction rate without object anchoring would not satisfy the zero-false-data invariant.

### Variants and images

The frozen set contains 0 visible multi-variant cards; all 15 cases expose one visible SKU. Variant correctness is therefore not proven for Yandex in this slice: `VARIANT_CAPABILITY = UNKNOWN`, not `YES`. Selected-variant-specific technical fields and variant-specific images were not testable without a multi-variant card. Product images were observable in A0 and in full-page controls, but no image was downloaded and no stable or variant-specific image URL was assumed.

### Secondary requests, stability, and security

The full HTML contains generic API/endpoint hints, but no stable, product-ID-anchored secondary endpoint was proven. No secondary request was issued from marketplace-controlled payload URLs. Any future request must be limited to public HTTPS and known marketplace hosts/identifiers; it must reject localhost, RFC1918, link-local/metadata IPs, credentials, auth-header leakage, cookies, and arbitrary URLs from response content.

Yandex does not show a CAPTCHA/anti-bot page in this audit. It does show request-profile and redirect sensitivity: `business.market.yandex.ru` can return a full document to one anonymous client profile and a 15-byte node response to the resolver profile, with redirects to `market.yandex.ru` observed on some control runs. This makes a deterministic adapter/request normalization path `MEDIUM` complexity until stability is proven.

## Wildberries

### Browser versus backend

The anonymous browser search remained on the explicit suspicious-activity challenge. A public catalog API attempt also returned an anti-bot challenge. Public indexed/category sources did not yield a verified direct automotive wheel-card URL, and no product ID was guessed. Consequently:

```text
browser_discovery = NO
backend_fetch = UNKNOWN
product_data_present = UNKNOWN
parser_extraction = UNKNOWN
primary_root_cause = ANTI_BOT for discovery; backend unproven
```

This is intentionally not a claim that every Wildberries backend path is blocked. Supporting it would likely require heavy anti-bot/browser/session infrastructure; that boundary is deferred.

## Ozon

Two publicly indexed direct URLs were verified as automotive wheel product pages before backend testing:

- `ozon-audit-001`: Jetour T2 wheel, product ID `2301996318`.
- `ozon-audit-002`: CHERY Tiggo 7 wheel, product ID `2979907544`.

The browser showed `Похоже, нет соединения` for both direct pages. The resolver-style backend saw:

```text
ozon-audit-001: 307 → 403 text/html, 11,565 bytes, challenge markers, 0 candidates
ozon-audit-002: 403 text/html, 11,741 bytes, challenge markers, 0 candidates
```

The final response contained no product ID, JSON-LD, or usable technical data. Browser `CONNECTION_ERROR_PAGE` is therefore not equivalent to backend network failure; in this sample the backend reached Ozon but was blocked at the HTTP/challenge layer. `PRIMARY_ROOT_CAUSE = ANTI_BOT / FETCH_BLOCKED`, `IMPLEMENTATION_COMPLEXITY = HEAVY`.

## Evidence Table

`Backend` for Yandex is the existing resolver request profile. `Full HTML` is a separate anonymous control used only to establish the root cause and semantic risk; it is not a replacement benchmark.

| Case | Browser | Backend | Full HTML control | Parser on backend response | Classification |
|---|---|---|---|---:|---|
| ym-001…ym-015 | ACTIVE | 200 / 15 B / HTML | 15/15 full HTML + JSON-LD | 0 each | SESSION_OR_REGION_DEPENDENT |
| wb-recovery-search-001 | ANTI_BOT | not testable: no verified card URL | none | n/a | UNKNOWN backend |
| ozon-audit-001 | CONNECTION_ERROR_PAGE | 307 → 403 / 11,565 B / challenge | none | 0 | ANTI_BOT / FETCH_BLOCKED |
| ozon-audit-002 | CONNECTION_ERROR_PAGE | 403 / 11,741 B / challenge | none | 0 | ANTI_BOT / FETCH_BLOCKED |

Per-case metadata, response hashes, sizes, redirects, elapsed times, current-ID occurrences, and structural indicators are in `audit_cases/yandex.json`, `audit_cases/wildberries.json`, and `audit_cases/ozon.json`.

## Cross-Marketplace Findings

1. Browser discovery, HTTP fetch, useful-document availability, extraction, and semantic ownership are separate capabilities. Ozon demonstrates browser/backend divergence; Yandex demonstrates useful-document divergence inside the same public URL.
2. Generic extraction is not enough for marketplace pages with recommendations and seller offers. Product identity must be resolved before technical fields are accepted.
3. A0's `JS_ONLY` label was operationally useful for an empty resolver result, but A1 shows it was too coarse for Yandex: the dominant failure is request-profile-sensitive response acquisition, followed by an anchoring problem on full HTML.
4. The zero-false-data invariant is satisfied by the frozen baseline because it returned no critical values. It is not satisfied by blindly consuming the full HTML control.
5. Manual entry remains safe and usable as a fallback for missing automatic extraction; it does not require marketplace-specific fitment logic.

## Candidate Release 1 Implementation

No implementation is part of 03B-A. The only candidate shape is:

```text
SafeFetcher
  ↓
FetchedDocument
  ↓
SourceDetector
  ↓
generic extractor OR marketplace adapter
  ↓
ExtractedPage with current-product ownership proven
  ↓
existing resolver / variant logic
  ↓
RimSourceResolveResponse
```

For Yandex, a potential `MEDIUM` path is a deterministic public request-profile normalization plus an adapter that selects the product object by the requested market ID/canonical URL before mapping critical fields. It must return `None` for unanchored values and preserve `CRITICAL_FALSE_DATA = ZERO`. It must not introduce `YandexFitment`, secondary arbitrary URL fetching, browser cookies, or session emulation.

Ozon and Wildberries have no safe small/medium path proven here. They remain deferred pending an approved architecture and evidence.

## Deferred / Heavy Infrastructure

The following are outside 03B-A and would imply `HEAVY` complexity: headless browser execution in the backend, CAPTCHA handling, rotating or residential proxies, browser fingerprint spoofing, persistent marketplace sessions, signed private client tokens, or fragile private APIs. No such infrastructure was added.

## Tests and Gates

The audit artifacts are metadata-only and do not add live-network CI tests. Existing parser/runtime tests remain the source of regression evidence.

```text
03B_A_RUNTIME_REGRESSION = NONE
KNOWN_PRE_EXISTING_TEST_FAILURE = tests/test_release_configuration.py::test_vercel_project_binding_is_not_tracked (.vercel/project.json)
PARSER_RUNTIME_CHANGES = NONE
CANONICAL_STAGING_RUNTIME = NOT_MODIFIED
PRODUCTION = NOT_TOUCHED
MARKETPLACE_AUDIT = COMPLETE
```

The next slice is 03B-B — Release 1 Marketplace Support Decision. Parser implementation must not begin until `MARKETPLACE_RELEASE_1_SCOPE = APPROVED`.
