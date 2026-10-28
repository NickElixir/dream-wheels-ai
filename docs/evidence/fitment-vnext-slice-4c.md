# Fitment VNext — Slice 4c compound control and picker evidence

Dependency: Slice 4b PR #232; stacked implementation originates from staging.

## Changes

- Five characteristics use the frozen split control: current/proposed value
  accepts locally; “Выбрать другое” opens the value picker. Order is Diameter,
  Width, PCD, DIA, ET on both axles. PCD selects both underlying API fields.
- Proposed geometry has neutral helper copy and a distinct accepted surface.
  An unresolved conflict cannot be accepted with the current-value button.
- ET offers recommended and all-value modes, exact matches first, bounded
  nearby matches, and a visible manual fallback even when matches exist.
  Exact decimal input, including comma spelling, is passed to runtime without
  integer rounding or 0.1 quantization. The finite value catalogue follows
  the v13 reference; runtime never imports the reference HTML.
- Picker is a mobile bottom sheet and centered desktop dialog. Search receives
  focus; Escape closes; Tab wraps inside the dialog; close returns focus to the
  originating compound control. Refresh only uses selection APIs supported by
  the active input type.
- Rear selection does not clear Front proposals. A manual Front replacement
  resolves that field's local source conflict and retains canonical data until
  final Save.

## Verification

- Frontend suite: 178 passed, including ET exact/manual/range/PCD checks.
- Runtime transition, composition and numeric focus tests: 50 passed.
- Frontend v2/catalogue state-machine pytest: 37 passed.
- Browser QA using production create/refresh view and CSS with fixture callbacks:
  1440, 768 and 390 px have no horizontal overflow. Desktop dialog is centered;
  tablet/mobile sheet spans the viewport and ends at its bottom.
- Browser actions: recommended → all → recommended; search 33,275 yields exact
  33.275 first; search 35 shows matches plus manual fallback; manual 35,125
  updates Rear to the exact value; Escape removes the dialog. No console errors.
- Slice 4b dependency CI passed. No authenticated staging mutation was performed.

## Remaining scope

Wheel proposal/save/picker scope is implemented locally. Slice 8 authenticated
staging E2E is **BLOCKED** until a disposable Fitment context exists. Vehicle
recognition and later result/lifecycle/a11y integration work remain; this does
not declare the full implementation complete.

## UI_CHANGE_MANIFEST

- User-visible changes: canonical compound controls and value picker.
- New elements: desktop dialog/mobile sheet, search, recommended/all toggle,
  exact match, manual fallback, keyboard dismissal.
- Removed elements: intermediate direct numeric inputs/confirmation buttons
  from Slice 4b geometry presentation.
- Interaction-pattern changes: accept the shown value or select another locally;
  canonical persistence remains the final Save.
- Authority: implementation spec §§7.4, 7.6, 8, 9, 17 and v13 prototype.
- Unspecified design decisions: none.
