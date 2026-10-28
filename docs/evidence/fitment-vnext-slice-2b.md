# Fitment VNext — Slice 2b Vehicle save isolation

Dependency: Slice 4c PR #233. This completes a discovered reciprocal branch
isolation gap from Slice 2.

## Changes

- Vehicle Save excludes `rim`, `front_rim`, `rear_rim` and `setup_mode` from
  PATCH. Wheel-only Save continues to exclude Vehicle.
- Vehicle saves and successful variant selection preserve the other branch's
  local Front/Rear values, setup mode, resolver state and acceptance flags.
  The form baseline remains the response's canonical Wheel values.
- Preservation is allowed only if Wheel setup identity/revisions, per-axle
  revisions, source fingerprints and selected SKUs match. A changed Wheel
  baseline discards the draft. Ordinary navigation revision checks remain.
- Vehicle variant lookup checks Vehicle dirty state independently of a dirty
  Wheel branch. Canonical Vehicle changes still invalidate check currentness.
- Source identity comparison reads the authoritative axle metadata rather than
  its nested geometry object.

## Verification

- Runtime transition tests: 49 passed, including Vehicle-only PATCH, retained
  Rear acceptance, variant refresh preservation and changed Wheel discard.
- Jobs Fitment/Standard API and frontend v2/catalogue pytest: 122 passed.
- Frontend suite: 178 passed.
- Presentation/CSS unchanged; Slice 4c browser QA and CI passed. The change's
  request/draft boundaries are exercised by runtime/API tests, not simulated
  browser fixture callbacks.
- Authenticated staging E2E remains BLOCKED on a disposable Fitment context.

## UI_CHANGE_MANIFEST

- User-visible changes: independent branch drafts survive Vehicle Save/selection.
- New/removed elements: none.
- Interaction-pattern changes: Vehicle save persists only Vehicle; successful
  Vehicle mutations preserve Wheel draft when its authoritative baseline matches.
- Authority: implementation spec §§3, 5, 10 and parallel branch contract.
- Unspecified design decisions: none.
