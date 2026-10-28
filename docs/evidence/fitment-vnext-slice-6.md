# Fitment VNext — Slice 6 Results/currentness

Dependency: comparison evidence API PR #239. Final target: staging.

## Changes

- Semantic compact four-column tables with one shared header and five ordered
  rows per axle. Different axle evidence stays separate; identical evidence is
  collapsed. Missing historical evidence remains explicit, never invented.
- Global unknown uses neutral result cells and frozen insufficient-data copy.
  Conditions/blockers precede the table. Stale verdict is explicitly marked;
  previous values remain readable and un-dimmed.
- Completed results expose parameter editing; Create Image remains once in the
  Standard block and independent from every verdict/currentness state.
- History hydrates overview's compact current-check summary from the detail API.
  Late history/detail/currentness responses cannot overwrite another context.

## Verification

- Runtime transitions: 54 passed. Frontend: 181 passed.
- Relevant frontend v2 and Check API pytest: 59 passed.
- Browser QA 1440/1024/768/390: no overflow/errors; at 390 table width 358 px,
  four headers/five rows; exact ET 35,125 visible without rounding; unknown
  cells neutral; stale previous verdict and recheck visible. Keyboard row and
  subsequent action focus verified; mobile screenshot visually inspected.
- Presentation fixture simulates check data. Saved comparison snapshots and
  history/currentness response isolation are exercised by API/runtime tests.
- Authenticated staging E2E remains BLOCKED on disposable context.

## UI_CHANGE_MANIFEST

- User-visible changes: compact real table, unknown/stale copy, result editing.
- New elements: semantic table/caption/column and row headers; focusable rows.
- Authority: implementation spec §§13–14, v13 compact table/focus reference.
- Unspecified design decisions: identical Front/Rear evidence collapses; distinct
  axle evidence receives separate captions without changing field order.
