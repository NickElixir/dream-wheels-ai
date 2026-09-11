# 03B-B Release 1 Marketplace Support Decision

Decision date: 2026-09-05.

This is a decision slice. No marketplace implementation, parser change, production change, or canonical staging change is included.

## Decision

```text
WILDBERRIES_RELEASE_1 = DEFERRED
OZON_RELEASE_1 = DEFERRED
YANDEX_RELEASE_1 = CONDITIONAL_PARTIAL
MARKETPLACE_RELEASE_1_SCOPE = APPROVED
```

The frozen baseline remains authoritative:

```text
BASE_COMMIT = e5b93c1b49268e02f64a1ec8271055d9c8fc916b
DATASET_VERSION = 1
MARKETPLACE_AUDIT = COMPLETE
```

Evidence and the capability-layer analysis are in [capability_audit.md](capability_audit.md), [capability_matrix.yaml](capability_matrix.yaml), and the structured case records under [audit_cases](audit_cases/).

## Release 1 Matrix

| Marketplace | Release 1 decision | Reason | Release 1 behavior | Fallback |
|---|---|---|---|---|
| Wildberries | `DEFERRED` | Anonymous browser anti-bot; no verified direct wheel-card URL; backend capability remains `UNKNOWN`; complexity `HEAVY` | Do not promise or implement marketplace support | Manual rim parameters → user review → Fitment |
| Ozon | `DEFERRED` | Backend reached real direct product URLs but returned confirmed `403` challenge responses; complexity `HEAVY` | Do not add anti-bot/session infrastructure | Ozon URL → manual input → user confirmation → Fitment |
| Yandex Market | `CONDITIONAL_PARTIAL` | Useful alternate HTML exists, but current resolver receives a 15-byte shell and generic extraction has contamination/false-data risk; feasible path is limited to `SMALL`/`MEDIUM` | One Yandex-only deterministic implementation attempt, then the same frozen 15-card benchmark | Auto attempt → user review; partial/failure → manual completion |

## Wildberries Decision

```text
WILDBERRIES_RELEASE_1 = DEFERRED
```

Evidence supports browser `ANTI_BOT`, but not a backend capability conclusion: no real direct product URL was recovered safely, and no product ID was guessed. Release 1 must not add browser automation, CAPTCHA solving, rotating or residential proxies, persistent marketplace sessions, fingerprint spoofing, or private API emulation.

The safe product path is:

```text
automatic parse unavailable
        ↓
manual rim parameters
        ↓
user review
        ↓
Fitment
```

## Ozon Decision

```text
OZON_RELEASE_1 = DEFERRED
```

Two verified direct automotive wheel URLs were tested. The anonymous browser showed a no-connection page, while resolver-style backend requests reached Ozon and returned `403 text/html` challenge documents with no product ID, JSON-LD, or usable candidates. Browser presentation is therefore not treated as proof of network failure, but the backend evidence is sufficient to defer support.

Release 1 must not add a proxy layer, browser runtime, CAPTCHA solving, account/session automation, or fragile private API integration.

## Yandex Decision

```text
YANDEX_RELEASE_1 = CONDITIONAL_PARTIAL
```

This is not unconditional support. It authorizes one limited deterministic implementation attempt because:

- browser discovery is available for all 15 frozen cards;
- the current resolver receives `200` but only a 15-byte HTML shell for `15/15` cases;
- an alternate anonymous full HTML response exists;
- current-product and recommendation contamination is observable;
- generic full-HTML extraction produced at least one critical false value;
- no heavy browser, CAPTCHA, proxy, session, or signed-token infrastructure is approved.

The A0 `JS_ONLY` label remains a frozen baseline observation, not the final root-cause label. The implementation decision is based on the audited request-profile-sensitive fetch and the requirement for strict semantic isolation.

## Approved 03B-C Scope

```text
03B_C_SCOPE = YANDEX_ONLY
```

The next slice may cover only:

1. A safe Yandex-compatible fetch/request profile.
2. Useful-document detection separate from HTTP `200`.
3. Current-product anchoring using a validated product/canonical/offer identity.
4. Selected-variant isolation, with no silent first-variant choice.
5. A normalized extraction adapter ending at the existing `ExtractedPage`/resolver contract.
6. Unit, fixture, and frozen benchmark tests.

The adapter must not return a Fitment verdict, create a marketplace-specific `RimSpec` or Fitment model, bypass user confirmation, or change Fitment architecture.

Preferred boundary:

```text
SafeFetcher
 ↓
FetchedDocument
 ↓
SourceDetector
 ↓
GenericExtractor OR YandexMarketplaceAdapter
 ↓
ExtractedPage
 ↓
existing resolver / variant logic
 ↓
RimSourceResolveResponse
```

## Hard Invariants

The order is mandatory:

```text
prove current product identity
        ↓
prove selected variant identity
        ↓
extract only from that scope
```

Never merge the first or best-looking wheel values from the entire HTML/JSON. Values from recommendations, similar products, ads, other sellers, or other variants remain untrusted unless their relationship to the current product and selected variant is proven.

```text
FALSE DATA IS WORSE THAN MISSING DATA
precision > recall
```

Returning `None` for an unproven ET/DIA is acceptable. A guessed value is not.

## 03B-C Acceptance Gates

The following are preliminary gates for the next implementation slice; they are not claimed as passed by 03B-B:

```text
YANDEX_USEFUL_FETCH_RATE >= 90%  # at least 14/15 frozen cases
CRITICAL_FALSE_DATA = 0
WRONG_AUTO_SELECTED_VARIANT = 0
CROSS_VARIANT_CONTAMINATION = 0
EXISTING_STORE_REGRESSION = 0
MANUAL_FALLBACK = PASS
PRODUCTION = NOT_TOUCHED
```

Incomplete extraction is allowed. Any critical false value, silent wrong variant, cross-variant contamination, or existing-store regression is a blocker. If useful fetch is below 14/15, Yandex returns to `DEFERRED` or fallback-only.

After implementation, create `results_after.json` beside the frozen [results_before.json](results_before.json) and compare at minimum:

```text
HTTP_FETCH_SUCCESS
USEFUL_DOCUMENT_SUCCESS
per_field_availability
per_field_extraction_rate
per_field_precision
critical_false_positive_rate
variant_detection_rate
variant_selection_correctness
cross_variant_contamination_rate
```

`MARKETPLACE_REGRESSION = PASS` may be set only from that actual benchmark and existing-store regression run.

## Stop Conditions

Stop the Yandex attempt and change its decision to `DEFERRED` if any of the following is required or cannot be proven:

- browser execution, CAPTCHA, browser farm, or fingerprint spoofing;
- persistent marketplace session, account automation, rotating/residential proxy;
- fragile private API or signed client-token emulation;
- unbounded secondary fetching;
- reliable current-product anchoring;
- reliable selected-variant isolation;
- deterministic elimination of critical false data;
- complexity beyond `SMALL` or `MEDIUM`.

If a secondary request is investigated, it must use a known marketplace host, a deterministically constructed URL from a validated product identifier, and the existing HTTPS/public-destination/redirect/body-size/timeout/`trust_env=False` protections. No URL supplied by marketplace payload may be fetched arbitrarily.

## Product and UX Policy

Release 1 must not promise Wildberries, Ozon, or unconditional Yandex support. The common flow remains:

```text
URL parse attempt
        ↓
success  → user review
partial  → user completes missing fields
failure  → manual input
```

Manual fallback is required for all marketplaces. Suggested copy:

> Не удалось автоматически определить параметры диска. Проверьте или заполните их вручную.

Marketplace failure must not block the Fitment flow. Product-image observation may be retained later, but automatic image download is not a Release 1 blocker.

## Explicit Non-Scope

03B-B does not change:

```text
src/rim_url_extract.py
src/rim_url_resolver.py
webapp
Fitment
Auth v1.1
Generic Vercel Gateway
canonical staging runtime
production
```

No Wildberries/Ozon implementation is authorized by this decision.

## Gate 03B-B

```text
MARKETPLACE_AUDIT = COMPLETE
WILDBERRIES_RELEASE_1 = DEFERRED
OZON_RELEASE_1 = DEFERRED
YANDEX_RELEASE_1 = CONDITIONAL_PARTIAL
MANUAL_FALLBACK_REQUIRED = YES
03B_C_SCOPE = YANDEX_ONLY
MARKETPLACE_RELEASE_1_SCOPE = APPROVED
PARSER_RUNTIME_CHANGES = NONE
CANONICAL_STAGING_RUNTIME = NOT_MODIFIED
PRODUCTION = NOT_TOUCHED
```

The next task is the separate `03B-C — Yandex Minimal Marketplace Adapter`. Do not begin Wildberries/Ozon implementation after this decision.
