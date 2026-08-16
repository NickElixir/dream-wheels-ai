# Fitment Compatibility Engine

## Product promise

The product returns two separate outcomes:

- **Visual fitment**: generated image of the chosen wheel on the car.
- **Technical compatibility**: preliminary, structured assessment of whether known wheel specifications match the confirmed vehicle profile.

A successful visual render is never evidence that the wheel fits physically.

## Inputs

### Vehicle

Vehicle recognition may suggest values, but the user confirms or corrects them:

- make;
- model;
- year;
- body;
- generation and modification when required by source data;
- front/rear axle distinction when applicable.

### Rim

Use structured data whenever available:

- brand, model, SKU/article, product URL;
- diameter and width;
- PCD;
- ET/offset;
- DIA/centre bore;
- fastener seat type;
- load rating.

If critical data is unknown, the engine must return `unknown`, not infer certainty from a photo.

## Product URL resolution

Product-page enrichment is user initiated and produces evidence-level E2 hints. It never turns
page data into a trusted compatibility fact without confirmation or a stronger catalog source.

The generic resolver uses this source order:

1. JSON API documents supplied as the product URL;
2. JSON-LD `Product` / `ProductGroup` / `hasVariant` data;
3. embedded application JSON such as `__NEXT_DATA__` and Nuxt payloads;
4. OpenGraph metadata;
5. visible HTML text.

`RimProductPageAdapter` is the extension point for deterministic host-specific adapters. A
headless browser is intentionally not part of the FastAPI request path. Sites that require
JavaScript/network interception must use an isolated adapter/worker with its own allowlist,
resource limits and recorded fixtures.

Variants are related semantically, not by URL shape alone. Explicit `hasVariant`, parent/group
identifiers, variant containers, matching brand/model and URL proximity contribute to a
membership score. Unrelated recommendations are rejected. Different dimensions of one model are
returned as separate variants; they are not treated as field conflicts. Conflicting values for the
same SKU remain ambiguous and the affected fields are not merged into `RimSpec`.

`POST /fitment/rim-url/resolve` returns the primary model, provenance candidates, accepted variants,
within-SKU conflicts and `selection_required`. A variant is selected automatically only when there
is one accepted variant or the supplied SKU/technical fields identify exactly one candidate.
`POST /fitment/rim-setups` uses the same logic and never chooses a random configuration.
The Mini App exposes this as an explicit “load from URL” action and requires the user to choose one
of several variants before the parsed values are copied into the confirmation form.

Outbound requests preserve the existing SSRF controls: HTTPS only, explicit host policy, public
DNS answers, redirect revalidation, response-size/content-type limits and no environment proxy.
They also use a stable user agent, bounded retries with exponential backoff and a bounded in-memory
TTL cache. The cache reduces duplicate front/rear lookups but is not a durable catalog.

## Domain model

```text
VehicleIdentity
  → FitmentProfile
RimSpecs
  → CompatibilityEngine
  → FitmentVerdict
```

Each value includes `source`, `confidence` and `is_user_confirmed` where applicable. Sources include `user_input`, `catalog`, `partner_feed`, `provider`, `ocr`, `vlm` and `unknown`.

## Verdict states

| Status | Meaning |
|---|---|
| `compatible` | Required known parameters pass configured rules. Still a preliminary assessment. |
| `compatible_with_conditions` | Installation may require rings, alternate fasteners, clearance check or other stated condition. |
| `unknown` | Critical data is absent, ambiguous or outside provider coverage. |
| `incompatible` | A known parameter conflicts, for example PCD mismatch or insufficient bore. |

## Deterministic rule set v0

Checks are performed on normalized structured values:

- PCD match;
- centre bore compatibility;
- offset range;
- allowed diameter/width range;
- fastener compatibility;
- load rating when source supports it;
- front/rear axle rules when present.

The rules engine must return reasons, warnings, missing data and source/version information. LLMs may explain results in natural language but must not decide compatibility.

## UX rules

Show a fitment card on the result screen and in history:

```text
Technical compatibility: requires verification
Reason: ET and DIA were not confirmed.
Before purchase, confirm installation with a wheel specialist.
```

Do not state “fits 100%” or any equivalent guarantee. Generation continues even if the verdict is `unknown` or `incompatible`; the visual render and technical assessment remain separate.

## Recommendations

Recommendations are a separate commercial layer:

```text
confirmed vehicle fitment profile
+ normalized catalog/partner feed
+ technical fit score
+ visual similarity
+ availability and commercial ranking
→ recommended products
```

Do not show specific compatible products until a structured, auditable catalog/feed exists. Before that, use a consultation or lead CTA.
