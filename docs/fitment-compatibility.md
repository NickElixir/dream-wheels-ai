# Fitment Compatibility Engine

> Part of **Project Dual Track**. This document defines the Fitment Pipeline only; it does not generate the visual wheel-on-car image. See `docs/ai-rendering-pipeline.md` for the independent Rendering Pipeline and `docs/product-roadmap.md` for the shared delivery plan.

## Product promise

The product returns two separate outcomes:

- **Visual fitment**: generated image of the chosen wheel on the car.
- **Technical compatibility**: preliminary, structured assessment of whether known wheel specifications match the confirmed vehicle profile.

A successful visual render is never evidence that the wheel fits physically.
Visual try-on deliberately does not infer or display RimSpec details such as PCD, ET or DIA; those values belong to the separate technical fitment assessment.

The Fitment Pipeline answers one question: **“What is known about the technical possibility of installation?”** It uses structured vehicle and wheel data plus deterministic rules. Image analysis, OCR or an LLM may help extract or explain data, but must not decide compatibility.

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
- diameter;
- width;
- bolt count;
- PCD;
- ET/offset;
- DIA/centre bore;
- post-release/future fields when supported: fastener hardware and load rating.

If critical data is unknown, the engine must return `unknown`, not infer certainty from a photo.

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

## Release 1 Standard Fitment boundary

Release 1 evaluates these wheel parameters as separate technical dimensions:

- bolt count;
- PCD;
- DIA / centre bore;
- diameter;
- width;
- ET / offset.

One parameter must not become an implicit prerequisite for evaluating another. In particular, diameter and width are not one combined size check for the target Release 1 contract, and ET is its own field-level check. Provider, selected-modification and axle context may choose the relevant reference evidence, but cross-parameter coupling requires a separately approved physical-fitment rule.

Fastener hardware (bolt/nut type, thread size and tightening torque) and load-rating logic are outside the Release 1 verdict and remain post-release scope.

## Deterministic rule set v0

Checks are performed on normalized structured values and return field-level results that are then combined conservatively:

- bolt-count match;
- PCD match;
- centre-bore / DIA compatibility;
- diameter reference check;
- width reference check;
- ET / offset reference check;
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