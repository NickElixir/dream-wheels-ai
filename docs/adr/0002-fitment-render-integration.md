# ADR 0002 — Fitment–Render Integration Contract

## Status

Accepted for architecture; implementation is phased by the Dual-Track Roadmap.

## Context

Dream Wheels AI has two independent outcomes:

- **Rendering Pipeline**: visual wheel-on-car result.
- **Fitment Pipeline**: preliminary technical compatibility assessment.

A visual result is never evidence of technical compatibility. The render must not wait for, depend on, or be invalidated by a fitment check.

## Decision

Use shared domain entities rather than making one pipeline own the other.

```text
RenderJob
├── vehicle_identity_id
├── rim_setup_id
├── immutable render_input_snapshot
└── render assets / provider metadata

RimSetup
├── front_rim_spec_id
├── rear_rim_spec_id
└── is_staggered

FitmentCheck
├── vehicle_identity_id
├── rim_setup_id
├── render_job_id nullable
├── immutable vehicle_snapshot
├── immutable rim_setup_snapshot
└── verdict / evidence / versions
```

`render_job_id` is optional on `FitmentCheck`: a detailed check may exist without a render. A render may exist without a fitment check.

## Trigger model

### Visual-support inference

May run around the render flow and use photo-derived hints, OCR, VLM and basic user input. Its purpose is better visual rendering. It is **not** a fitment verdict and must not use compatibility labels.

### Detailed Fitment Check

Runs only after an explicit user action. The user confirms the vehicle and rim data, starts the visual render independently, then may request a detailed preliminary technical check. The render does not wait for the check.

## Immutable snapshots

The current VehicleIdentity and RimSetup records may be edited or enriched later. Every RenderJob and FitmentCheck stores the exact input snapshot used at creation/evaluation. Old verdicts must remain auditable and must not silently change when source data changes.

## Provenance model

Every field can carry:

```json
{
  "value": "5x114.3",
  "source": "user_input | user_confirmed | manufacturer_sku | provider | ocr | vlm | unknown",
  "confidence": 0.0,
  "is_user_confirmed": false
}
```

Sprint 2 may initially write only `user_input` / `user_confirmed`; the schema must support later enrichment without a breaking migration.

## Non-goals

- No fitment UI in Sprint 1 or Sprint 2.
- No automatic detailed provider search.
- No hard rejection of visual render creation.
- No guarantee of road legality, installation safety or insurance compliance.

## Consequences

- The Fitment Pipeline can be developed, retried and versioned independently.
- Staggered front/rear setups are supported structurally from the start.
- API consumers receive structured evidence codes rather than provider-specific UI strings.
- A later Fitment UI can change layout and copy without changing the rules engine.
