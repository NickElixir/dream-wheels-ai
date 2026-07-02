# ADR — Fitment–Render Integration

## Status

Accepted.

## Decision

Dream Wheels AI contains two independent pipelines:

- **Rendering Pipeline** answers: “How will these wheels look on this car?”
- **Fitment Pipeline** answers: “What is known about preliminary technical compatibility?”

A visual render is never proof of technical compatibility. Fitment never blocks, delays, invalidates, or retries rendering.

## Ownership model

Use shared domain entities. Neither pipeline owns the other.

```text
RenderJob
├── vehicle_identity_id
├── rim_setup_id
└── immutable render_input_snapshot

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

A detailed fitment check may exist without a render. A render may exist without a fitment check.

## Sprint 2 boundary

Sprint 2 creates and confirms data required by the rendering flow and stores it through the shared `VehicleIdentity`, `RimSpec`, and `RimSetup` boundary.

Quick confirmation contains only:

- vehicle: make, model, year or year range;
- rim: diameter, width, and PCD displayed as `NxPCD`.

PCD is stored canonically as `bolt_count` plus `pcd_mm`.

The first create flow does not expose a full vehicle catalogue selector. It shows one primary AI proposal and at most two alternatives. It does not show wheel brand/model, SKU, ET, DIA, or fitment verdict.

## Trigger model

```text
Upload photos
→ visual-support inference
→ user confirms quick identity
→ render starts
→ user may later request Detailed Fitment Check
```

Visual-support inference may use photo analysis, OCR, VLM, and user input to assist rendering. It is not a fitment verdict and must not return `compatible`, `unknown`, or similar technical labels.

A Detailed Fitment Check is user initiated only. It does not run automatically with a render.

## Immutable snapshots

`RenderJob` and `FitmentCheck` persist exact input snapshots. Enriching canonical entities later must not alter a historic render or verdict.

## Provenance

Fields must remain extensible for `source`, `confidence`, and `is_user_confirmed`. Sprint 2 can initially record primarily `user_input` and `user_confirmed`; later provider/OCR/VLM enrichment must not require replacing the data model.

## Consequences

- Rendering and fitment teams can implement independently against one shared data boundary.
- Staggered front/rear setups are supported structurally.
- Fitment UI can be approved later without changing the rules engine or render pipeline.
- No implementation may present automatic image inference as a technical installation guarantee.

## Canonical related documents

- `docs/adr/0002-fitment-render-integration.md`
- `docs/fitment-schema.md`
- `docs/fitment-api-contract-v1.md`
- `docs/fitment-verdict-evidence-rules.md`
