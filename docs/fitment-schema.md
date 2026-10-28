# VehicleIdentity, RimSpec and RimSetup Schema

## Purpose

This is the canonical data boundary between Sprint 2 create flow, the Rendering Pipeline and the Fitment Pipeline.

## VehicleIdentity

```text
id UUID
make
model
year
body nullable
generation nullable
modification nullable
market nullable
is_user_confirmed
provider_mappings JSONB nullable
field_provenance JSONB
field_candidates JSONB
revision integer
```

`provider_mappings` is populated by the Fitment Pipeline after vehicle resolution. It stores provider-specific IDs/slugs and must not replace canonical make/model/year fields.

## RimSpec

One RimSpec describes one physical wheel specification for one axle.

```text
id UUID
brand nullable
model nullable
sku nullable
product_url nullable

bolt_count nullable              -- e.g. 5
pcd_mm numeric nullable          -- e.g. 114.3
center_bore_mm numeric nullable  -- DIA
wheel_diameter_in numeric nullable
wheel_width_j numeric nullable
offset_et_mm numeric nullable
load_rating_kg nullable

fastener_system nullable         -- bolt | stud_and_nut | unknown
seat_type nullable               -- cone | ball | flat | unknown
thread_diameter_mm nullable
thread_pitch_mm nullable
bolt_length_mm nullable

field_provenance JSONB
field_candidates JSONB
revision integer
created_at
updated_at
```

### PCD normalisation

Do not store two independent string fields named `pcd` and `bolt_pattern`.

Canonical machine values are:

```text
bolt_count = 5
pcd_mm = 114.3
```

The API may derive a display value `5x114.3`. This avoids parsing errors while retaining the common user-facing notation.

## RimSetup

A RimSetup maps wheel specifications to axles.

```text
id UUID
front_rim_spec_id UUID
rear_rim_spec_id UUID
is_staggered boolean
```

For a square setup, front and rear references may point to the same RimSpec. For a staggered setup they are separate. The model supports future tyre specs per axle without changing the ownership model.

## Required data by mode

### Sprint 2 quick create flow

Collect and persist when available:

```text
Vehicle: make, model, year, body, generation, modification.
Rim quick identity: wheel_diameter_in, wheel_width_j, bolt_count, pcd_mm.
```

Sprint 2 default UI should confirm only the fields required for a fast render-oriented identity:

- vehicle make/model/year or year range;
- wheel diameter;
- wheel width;
- PCD displayed as `NxPCD`, for example `5×114.3`.

Wheel width is intentionally included in the quick confirmation step because it affects visual proportions and prevents the renderer from making the wheel appear too wide or too narrow.

Brand, model, SKU, product URL, ET and DIA are still supported by the schema but should not be part of the default Sprint 2 quick-confirmation UI. They are collected later in the Detailed Fitment Wizard or through an optional advanced section after the render.

All fields are nullable except the minimum vehicle identity required by the UI. Missing values do not block visual rendering.

### Detailed Fitment Check

A positive `compatible` result requires provider/rules evidence sufficient for the checked axle(s). At minimum, the engine must know the exact vehicle profile and wheel bolt pattern, center bore, diameter, width and offset; tyre, load, brake and fastener evidence may also be required depending on the vehicle/rule scope.

## Field provenance

`field_provenance` is a map keyed by canonical field name.

```json
{
  "offset_et_mm": {
    "source": "manufacturer_sku",
    "confidence": 0.98,
    "is_user_confirmed": false
  }
}
```

Why it matters:

- rules can reject weak OCR/VLM guesses as evidence for `compatible`;
- UI can ask for confirmation only where needed;
- conflicts are explainable and auditable;
- manufacturer data can outrank a low-confidence image extraction.

## Field candidates and revisions

Canonical columns store the current values that the user edits and that future
fitment checks snapshot. `field_candidates` stores VLM/OCR/provider suggestions
next to those values; candidates are explanatory and never override canonical
values automatically.

```json
{
  "model": [
    {
      "value": "RX",
      "source": "vlm_visual",
      "confidence": 0.92,
      "resolver": "mock_visual_identity_v1",
      "origin": "render_input_draft",
      "captured_at": "2026-07-06T00:00:00Z"
    }
  ]
}
```

`revision` increments when the canonical entity is edited. The Sprint 4 editor
uses it for optimistic locking, and future `FitmentCheck` snapshots should store
the revisions evaluated with the immutable vehicle/rim snapshots.

## Fitment change history

Canonical current values and AI candidates answer different questions, so edit
history must live separately in an append-only audit table.

```text
fitment_change_events
- job_id
- vehicle_identity_id
- rim_spec_id
- event_type           -- initial_prefill | user_save | user_confirm | candidate_applied
- actor_type           -- system | user | admin | provider
- actor_user_id nullable
- vehicle_revision_before / after
- rim_revision_before / after
- changes JSONB
- created_at
```

`initial_prefill` records the first VLM/OCR defaults written into canonical
columns. `user_confirm` records a meaningful state change where the value stays
the same but provenance changes from AI-guessed to user-confirmed.

## Indexing and scale

UUID primary-key lookups are inexpensive. Index normalised lookup keys, not every JSON field:

```text
VehicleIdentity: (make, model, year, generation, market)
RimSpec: (sku), (brand, model), (bolt_count, pcd_mm, wheel_diameter_in, wheel_width_j, offset_et_mm)
FitmentCheck: (vehicle_identity_id, rim_setup_id, engine_version, provider_version)
```

RenderJob and FitmentCheck must store immutable snapshots even when they reference canonical entities.
