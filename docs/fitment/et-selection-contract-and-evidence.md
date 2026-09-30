# Dream Wheels AI — ET selection contract and evidence

**Date:** 2026-09-30  
**Status:** APPROVED UX / DATA DIRECTION — exact catalogue cardinality audit pending  
**Scope:** Technical Fitment wheel parameter `ET` / `offset_et_mm`

## Decision

Dream Wheels AI must treat ET as a decimal numeric value, not as an integer-only field.

Approved behavior:

- ET is stored without rounding as a numeric value in millimetres.
- Manual entry supports decimal values with a practical input step of `0.1 mm`.
- Defensive validation range is `-150…+150 mm`.
- The preferred UX is selection from known/recommended ET values rather than forcing free-form numeric entry.
- A searchable combobox should expose known ET values sourced from Wheel Size API through the Dream Wheels backend.
- The combobox must retain a manual fallback such as `Другое значение`, because a commercial aftermarket wheel may contain a real ET that is absent from the current Wheel Size option catalogue.
- Resolver-detected ET values, including fractional values, may be presented directly as system proposals and require the same explicit user confirmation as the other wheel fields.
- ET must never be rounded to an integer during resolver normalization, draft persistence, save, Fitment execution, or result rendering.

## Why ET is not integer-only

Wheel Size officially changed the OpenAPI type of:

- `rim_offset`
- `rim_offset_min`
- `rim_offset_max`

from `integer` to `number` on 2026-03-05.

Source:
https://developer.wheel-size.com/api-updates

The same release notes document realistic validation for `rim_offset` as:

`-150…+150 mm`

Source:
https://developer.wheel-size.com/api-updates

Fractional ET values occur in real OE fitment data. Examples found in Wheel-Size data include:

- Mercedes-Benz S-Class W223/V223: ET37.5, ET31.5, ET48.1
- Mercedes-AMG C-Class BR206: ET43.1, ET48.1, ET61.1
- Mercedes-Benz GLC X254/C254: ET32.5, ET34.5, ET35.5
- Ford Maverick: ET37.5
- Fiat Multipla: ET31.5
- SsangYong Tivoli / Tivoli Grand and Mahindra XUV300: ET45.5

Representative source:
https://www.wheel-size.com/size/mercedes/s-class/w223-v223-2020-now/eudm/

These examples are evidence that fractional ET is part of the real data model and should not be treated as an isolated malformed-data case.

## Relevant Wheel Size API capability

Wheel Size API exposes:

`GET /v2/by_rim/of/` — **List rim offsets**

Official API documentation:
https://api.wheel-size.com/v2/swagger/

The endpoint should be treated as the source of known/recommended ET options for the UI, rather than maintaining a manually curated frontend array.

Target architecture:

```text
Wheel Size API
GET /v2/by_rim/of/
        ↓
Dream Wheels backend
        ↓
normalization / cache
        ↓
ET searchable combobox
```

Frontend code must not hardcode a canonical ET array.

## Target UX

### Resolver proposal

If the wheel resolver finds ET:

```text
ET
[ 43,1 ]    [ Выбрать другое ▾ ]
```

The detected value is still only a proposal until the user confirms it.

No rounding is allowed.

### Choose another value

`Выбрать другое` opens a searchable combobox based on values returned by the Dream Wheels backend.

Conceptual example:

```text
ET
Поиск...

42
42,5
43
43,1
43,5
44
...

Другое значение
```

The user should usually be able to choose a recommendation instead of typing a technical number manually.

### Manual fallback

`Другое значение` exposes a controlled numeric field:

```text
ET, мм
[ 47,5 ]
```

Contract:

- numeric decimal input;
- input step: `0.1 mm`;
- defensive range: `-150…+150 mm`;
- Russian UI uses decimal comma for display;
- transport/storage may use normal JSON decimal notation;
- preserve the exact numeric value.

## Why recommendations and manual input both exist

The product has two different needs:

1. **Convenience:** many users do not know or do not want to type ET manually, so known values should be selectable.
2. **Coverage:** Dream Wheels accepts concrete commercial wheels, including aftermarket products. A real commercial ET should not become invalid only because it is absent from the current Wheel Size option list.

Therefore the Wheel Size offset list is a recommendation/catalogue source, not an absolute whitelist for commercial wheel data.

## Caching and loading direction

Do not make ET dependent on the user completing Diameter, Width, PCD and DIA first.

Preferred behavior:

- Dream Wheels backend fetches/normalizes known ET values from Wheel Size;
- frontend receives the option set from Dream Wheels;
- ET can be selected independently;
- already selected wheel characteristics may later be used as optional filtering if that materially improves the list, but this is not required for the base UX.

The exact cache policy must respect the Wheel Size API plan and Terms of Usage. Do not assume that every API endpoint may be persistently mirrored.

Wheel Size Terms of Usage:
https://developer.wheel-size.com/api-tos

## Repository consistency note

Current staging parser sanity bounds are broader:

`src/rim_url_extract.py`

```python
"offset_et_mm": (-150, 200)
```

This is an extraction sanity range, not the approved ET UX range.

The target UX / catalogue validation is `-150…+150 mm`, based on the currently documented Wheel Size API rim-offset validation.

Implementation work should explicitly reconcile this difference instead of silently reusing the parser bound as the user-facing contract.

Current Fitment schema already permits numeric offsets and does not impose an integer-only ET model:

`src/fitment/schemas.py`

The Fitment engine also states that ET is evaluated against provider-supplied intervals rather than a local hardcoded ET safety band:

`src/fitment/rules/tolerances.py`

This supports keeping ET precision from the provider rather than coercing it into an integer preset model.

## Pending audit — exact number of ET options

The exact number of values currently returned by:

`GET /v2/by_rim/of/`

has **not yet been verified** in this design session because an authenticated API call was not available.

Do not invent the cardinality.

Before implementation freeze, run the audit below and append the result to this document.

### Codex task

Use the existing Dream Wheels Wheel Size API configuration/credentials. Do not print or commit API keys.

1. Identify the existing Wheel Size API client/configuration in the repository and the environment variable used for authentication.
2. Call the production-equivalent v2 endpoint:
   `GET /v2/by_rim/of/`
   using the existing client/auth pattern.
3. Capture:
   - HTTP status;
   - response shape;
   - `X-Total-Count` if returned;
   - number of rows returned;
   - number of distinct ET numeric values;
   - minimum and maximum ET;
   - sorted distinct ET list;
   - integer-value count;
   - fractional-value count;
   - percentage of distinct values that are fractional;
   - distinct fractional parts observed, e.g. `.1`, `.5`;
   - whether pagination is required.
4. If the endpoint supports filters that materially change the returned offset set, record:
   - unfiltered/global result;
   - what filters are accepted;
   - whether Dream Wheels should use the global list or contextual filtering.
5. Compare the live values with the approved range `-150…+150 mm`.
6. Do not modify product code.
7. Write the audit result into a new section named:
   `## Live catalogue audit — <YYYY-MM-DD>`
   in this file.
8. Include a compact machine-readable appendix, for example:

```json
{
  "endpoint": "/v2/by_rim/of/",
  "total_rows": 0,
  "distinct_values": 0,
  "integer_values": 0,
  "fractional_values": 0,
  "fractional_share": 0.0,
  "min": null,
  "max": null,
  "fractional_parts": []
}
```

9. If credentials are unavailable, stop and report the missing configuration without substituting scraped Wheel-Size website data for the API audit.

## Implementation acceptance criteria

ET implementation is correct only if:

- ET37.5 / ET31.5 / ET48.1-style values survive end-to-end without rounding;
- resolver proposals can contain decimals;
- recommended values are selectable;
- manual decimal fallback exists;
- saved canonical ET preserves precision;
- staggered front/rear ET values preserve precision independently;
- conflict UI compares exact values;
- Standard Fitment receives the exact saved ET;
- result UI renders the exact value using locale-appropriate formatting;
- no frontend hardcoded integer-only ET array becomes the source of truth.
