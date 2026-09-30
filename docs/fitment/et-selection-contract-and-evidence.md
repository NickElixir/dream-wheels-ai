# Dream Wheels AI — ET selection contract and evidence

**Date:** 2026-09-30  
**Status:** APPROVED UX / DATA DIRECTION — live catalogue audited; manual precision decision pending
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

## Original audit task — exact number of ET options

The exact number of values currently returned by:

`GET /v2/by_rim/of/`

was unverified in the original design session. The live audit below now records the authenticated result.

Do not invent the cardinality.

The original task below is retained for provenance; its results are recorded in the live audit section.

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

## Live catalogue audit — 2026-09-30

Read-only authenticated request through `WheelSizeProvider._request("by_rim/of", {})`, using the repository's `WHEEL_SIZE_API_KEY` configuration and `user_key` authentication pattern. The key was not included in the report. This is a snapshot of the live API, not a permanent count.

- HTTP status: `200`.
- Response shape: `{"data": [{"value": <number>, "total": <integer>}, ...], "meta": {"count": 310}}`. The per-row `total` field is separate from the number of offset rows.
- `X-Total-Count`: `310`; `meta.count`: `310`; rows received: `310`; distinct numeric ET values: `310`.
- Minimum: `-129 mm`; maximum: `142 mm`. No returned values lie outside `-150…+150 mm`.
- Integer ET: `120`; fractional ET: `190` (`61.2903%` of distinct values).
- Distinct positive fractional parts: `29` (see machine-readable summary). Fractional parts use the absolute value for negative ET.
- Pagination: not required for this endpoint. The unfiltered response contained all `310` rows, matching both count indicators; its OpenAPI operation exposes no `offset` or `limit` parameters.

### Full sorted distinct ET list (mm)

```text
-129, -37, -30, -25.4, -25, -20, -15.5, -15, -12, -10, -8, -6.4, -6.35, -6, -5
-3, -2.5, -2, -1, 0, 0.15, 0.34, 2, 3, 4, 5, 6, 6.35, 6.4, 7
7.5, 7.6, 8, 8.6, 8.64, 8.9, 9, 10, 10.6, 11, 11.2, 11.4, 12, 12.7, 13
13.5, 14, 14.2, 14.22, 14.3, 14.4, 15, 15.5, 16, 17, 18, 18.5, 19, 19.05, 19.1
19.5, 19.85, 20, 20.5, 20.6, 21, 21.5, 22, 22.1, 22.3, 22.35, 22.4, 22.5, 23, 23.3
23.5, 23.6, 24, 24.1, 24.25, 24.75, 25, 25.1, 25.2, 25.3, 25.4, 25.5, 26, 26.2, 26.3
27, 27.5, 27.6, 28, 28.4, 28.8, 29, 29.5, 30, 30.1, 30.5, 31, 31.5, 31.7, 31.75
31.8, 32, 32.1, 32.2, 32.25, 32.5, 32.7, 33, 33.2, 33.275, 33.5, 33.7, 34, 34.1, 34.5
35, 35.5, 35.9, 36, 36.1, 36.5, 37, 37.17, 37.2, 37.3, 37.5, 38, 38.1, 38.5, 38.8
39, 39.5, 40, 40.1, 40.475, 40.5, 40.65, 40.7, 41, 41.1, 41.15, 41.3, 41.5, 41.65, 42
42.1, 42.3, 42.4, 42.5, 42.55, 42.85, 43, 43.1, 43.2, 43.3, 43.5, 43.75, 44, 44.45, 44.5
44.7, 44.9, 45, 45.1, 45.5, 45.72, 46, 46.4, 46.5, 46.6, 46.67, 47, 47.3, 47.5, 47.9
48, 48.1, 48.2, 48.4, 48.5, 48.75, 49, 49.5, 49.75, 50, 50.08, 50.1, 50.3, 50.5, 50.8
51, 51.2, 51.5, 52, 52.2, 52.3, 52.5, 53, 53.3, 53.4, 53.5, 53.7, 54, 54.5, 54.6
54.65, 54.8, 55, 55.2, 55.5, 56, 56.1, 56.2, 56.4, 56.5, 57, 57.15, 57.4, 57.5, 58
58.1, 58.2, 58.5, 59, 59.1, 59.5, 60, 60.1, 60.2, 60.5, 60.6, 60.8, 61, 61.1, 61.4
61.5, 61.85, 62, 62.2, 62.5, 62.6, 63, 63.5, 63.8, 64, 65, 66, 66.7, 67, 67.1
68, 68.05, 68.5, 69, 70, 70.4, 71, 71.1, 71.5, 71.6, 72, 73, 75, 76, 77
78, 79, 80, 81, 82, 83, 87, 87.5, 88, 91, 94, 98, 100, 101, 102
105, 106, 107, 108, 109, 109.5, 110, 113, 115, 116.5, 117, 118.3, 120, 121.5, 122.17
122.5, 124, 125, 127, 129.5, 130.81, 131, 135.89, 136, 142
```

### Filter behavior and UX implication

The [official OpenAPI operation](https://api.wheel-size.com/v2/openapi.json) lists optional filters `rim_diameter` (8–26 in), `rim_width` (2–14 in), `bolt_pattern`, and repeatable `region` (market slug). `ordering` accepts `value` and controls ordering, not membership. No filter is required; the count above is the unfiltered global result. Live filtered requests returned:

| Request | HTTP | `X-Total-Count` | Rows / distinct ET |
| --- | ---: | ---: | ---: |
| `rim_diameter=18` | 200 | 111 | 111 / 111 |
| `rim_width=7.5` | 200 | 88 | 88 / 88 |
| `bolt_pattern=5x112` | 200 | 134 | 134 / 134 |
| `region=eudm` | 200 | 244 | 244 / 244 |
| All four filters combined | 200 | 37 | 37 / 37 |

A global catalogue is small enough (310 options) to support ET selection independently of other wheel fields, as the current UX contract requires. Contextual filtering can later prioritize relevant recommendations when vehicle or rim characteristics are known. The API catalogue remains a recommendation source, not a whitelist for aftermarket ET. Any backend cache policy must still be checked against the active Wheel Size plan and [Terms of Usage](https://developer.wheel-size.com/api-tos).

**Precision finding:** `35` of the `310` distinct values are not multiples of `0.1 mm`; examples include `-6.35`, `33.275`, `40.475`, and `130.81`. The maximum observed precision is three decimal places. A strict `0.1 mm` step or one-decimal rounding would reject or alter valid catalogue values. Before implementing manual entry, reconcile the earlier practical `0.1 mm` step with exact-value preservation; a permissive decimal input (for example `step="any"` with explicit range validation) would cover the observed values.

### Machine-readable summary

```json
{
  "endpoint": "/v2/by_rim/of/",
  "total_rows": 310,
  "distinct_values": 310,
  "integer_values": 120,
  "fractional_values": 190,
  "fractional_share": 0.612903,
  "min": -129.0,
  "max": 142.0,
  "fractional_parts": [
    0.05,
    0.08,
    0.1,
    0.15,
    0.17,
    0.2,
    0.22,
    0.25,
    0.275,
    0.3,
    0.34,
    0.35,
    0.4,
    0.45,
    0.475,
    0.5,
    0.55,
    0.6,
    0.64,
    0.65,
    0.67,
    0.7,
    0.72,
    0.75,
    0.8,
    0.81,
    0.85,
    0.89,
    0.9
  ]
}
```
