# ADR — Fitment Verdict Taxonomy

## Status

Accepted for the Detailed Fitment Check.

## Scope

This ADR applies only to a future **Detailed Fitment Check**. It does not apply to visual-support inference in Sprint 2.

## Execution status

Operational lifecycle and technical verdict are separate.

```text
Execution: queued | processing | completed | failed
Verdict: compatible | compatible_with_conditions | unknown | incompatible
```

A provider timeout, rate limit, parser failure, or other operational issue is `failed`, not `unknown`.

## Verdict precedence

```text
1. Confirmed hard conflict
   → incompatible

2. No hard conflict, but critical evidence is missing or conflicting
   → unknown

3. Sufficient evidence, but a specific adaptation or verification is required
   → compatible_with_conditions

4. Sufficient evidence and no conditions remain
   → compatible
```

## Definitions

### incompatible

A confirmed physical or safety-critical conflict exists for the exact checked vehicle, axle, and wheel/tyre configuration.

Examples include confirmed PCD mismatch, wheel bore smaller than hub bore, confirmed brake/suspension/body interference, unsafe load rating, or an axle-specific staggered conflict.

### unknown

The system cannot safely issue either a positive or negative conclusion from trusted evidence.

Examples include missing or conflicting critical PCD/DIA/ET data, ambiguous vehicle identity, unsupported modifications, absent clearance evidence, or low-confidence photo inference only.

### compatible_with_conditions

No confirmed hard conflict exists, but the result depends on explicit, evidence-backed conditions.

Examples include a specified centering ring for a larger wheel bore, an exact compatible hardware package, a provider-backed clearance check, or validated front/rear staggered configuration.

Conditions must not invite improvised adapters, generic spacers, wobble bolts, redrilling, or inferred fastener geometry.

### compatible

The exact checked configuration is preliminarily compatible using sufficient evidence for all required parameters. It is never an installation, legal, insurance, or safety guarantee.

## Evidence requirement

Photo-derived VLM/OCR hints may propose values or prompt for confirmation. They must not by themselves produce `compatible`.

A positive verdict requires trusted provider, manufacturer, or user-confirmed evidence appropriate to the parameter being evaluated.

## User-facing boundary

The backend returns stable machine codes, reasons, conditions, missing fields, versions, and `is_preliminary` state. Final wording, colour, placement, and disclosure behavior belong to the later Fitment UX work.

## Canonical related documents

- `docs/fitment-verdict-evidence-rules.md`
- `docs/fitment-api-contract-v1.md`
- `docs/fitment/adr-fitment-render-integration.md`
