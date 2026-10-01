# Fitment VNext — Slice 1 composition evidence

Base: `staging` after PR #225. Implementation dependency: Slice 0 PR #226.

## UI composition

- Two Vehicle/Wheel source and summary cards precede one full-width active editor.
- The current result, when present, appears before the Standard Fitment block.
- The Standard block has one Check action and one Create Image action. Check availability still comes from the server `next_action` through the existing model.
- Each source card has its own Edit control. Recognition CTAs occupy the frozen v13 positions. Vehicle recognition stays disabled until Slice 3 connects the recognition proposal flow; Wheel resolver remains available through the existing editor and is enabled in the card only when its URL is ready.
- The v13 HTML remains a reference file and is not imported by runtime code.

## Verification

- `node --test tests/test_fitment_vnext_composition.mjs`: passed.
- Existing Fitment frontend contract tests: 63 passed.
- `npm test` in `webapp/`: 175 passed after updating legacy layout assertions to the frozen v13 composition.
- Browser fixture: `tests/browser-fixtures/fitment-vnext-slice1.html`, using the production VNext view module and CSS.
- Chromium layout checks at 1440, 1024, 768, and 390 target widths: no page horizontal overflow; two cards at desktop widths, stacked at narrow widths. Wheel editor opens through branch selection; result is above Standard Fitment; Create Image appears once; no browser console errors.
- The browser fixture uses synthetic data. Authenticated staging E2E remains unverified without a disposable Fitment context.

## UI_CHANGE_MANIFEST

- User-visible changes: parallel source/summary cards, single full-width editor region, Standard Fitment block after the result, source-specific Edit controls.
- New elements: source metadata rows, recognition CTA placement, readiness summaries in the Standard block.
- Removed elements: nested summary tables in source cards and the old free-floating action footer.
- Interaction-pattern changes: Edit controls switch the active branch. Existing save, resolver and check handlers remain in place. Authority: spec §§5, 11, 12, 16, 17 and v13 reference.
- Unspecified design decisions: NONE.
