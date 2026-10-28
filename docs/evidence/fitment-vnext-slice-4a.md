# Fitment VNext — Slice 4a Wheel decimal and SKU evidence

Base: stacked on Slice 3a PR #229, Slice 2 PR #228, Slice 1 PR #227, Slice 0 PR #226.

## Changes

- Wheel numeric controls use text inputs with decimal keyboard hints. The VNext adapter retains the user's raw decimal spelling during editing; the existing PATCH normalization converts comma or dot to a number only at the save boundary. This avoids `NaN` during intermediate edits and retains decimal ET precision.
- Multiple resolver SKU candidates display flat selectable rows. Each row has a name, SKU, and Diameter → Width → PCD → DIA → ET values in the frozen order. Missing values say “Не определено.” “Выбрать” remains product selection, with no canonical PATCH.
- The resolver API currently exposes no SKU or product image URL. The UI does not invent a product image or reuse the render input photo as a product preview.

## Verification

- `node --test webapp/auth/vnext-fitment.test.js`: 23 passed, including comma ET draft and numeric serialization.
- `node --test tests/test_fitment_transition_behavior.mjs tests/test_fitment_vnext_composition.mjs tests/test_fitment_vnext_focus.mjs`: 47 passed.
- `npm test` in `webapp/`: 177 passed.
- Relevant Fitment frontend/backend pytest suites: 44 passed.
- Browser fixture `tests/browser-fixtures/fitment-vnext-slice4-wheel.html` loads the production VNext view and CSS. At 1440, 768, and 390 px: two SKU rows, decimal ET as a text input, no horizontal page overflow, no browser console errors.

## Remaining Slice 4 work

- The frozen per-field proposal confirmation control, correct canonical-vs-resolver conflict mapping, ET picker modes, and reversible staggered draft toggle still need implementation and review. This PR is a narrow, reviewable part of Slice 4, not its completion.
- Authenticated staging E2E remains pending a disposable Fitment context.

## UI_CHANGE_MANIFEST

- User-visible changes: locale-safe decimal editing and detailed flat SKU rows.
- New elements: per-SKU technical series and “Выбрать” label.
- Removed elements: name-only SKU buttons; browser number-input behavior for Wheel decimals.
- Interaction-pattern changes: Wheel numeric values stay as local strings until the existing save boundary. SKU selection uses the same runtime handler.
- Authority: implementation spec §§7.3, 7.6, 8, 21 and v13 prototype.
- Unspecified design decisions: none.
