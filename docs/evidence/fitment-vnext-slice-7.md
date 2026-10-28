# Fitment VNext — Slice 7 Responsive/accessibility/polish

Dependency: Slice 6 PR #240. Final target: staging.
Staging base verified: `5a30a65059e21da79f3d58f8c9eb2c53ee812fc6`.

## Changes

- Explicit input labels and error associations; picker dialog outside an inert
  workspace, with existing focus trap, Escape and opener focus restoration.
- Full canonical summaries in Standard Fitment, slash-separated metadata,
  exact ET, independent front/rear summaries. Unsaved Wheel edits stay outside
  the canonical summary.
- Flat variant/SKU rows, neutral proposal status/focus, mobile touch targets,
  paired Save/choose-another-SKU actions, divider cleanup and reduced motion.
- Wheel source recognition opens its editor from the source card. Manual
  fallback preserves explicit proposal acceptance requirements and cancels
  resolver work. Late responses after manual fallback, URL change or context
  change cannot restore obsolete proposals or trigger obsolete auth recovery.

## Verification

- Frontend: 182 passed. Combined runtime/catalogue/composition/focus: 69 passed.
- Full backend pytest: 612 passed, 5 skipped (14 existing warnings).
- Ruff check and format check passed; diff whitespace check passed.
- Browser path: Codex CUA in-app browser, production view/CSS fixtures and
  real frontend guest preview (`/?preview=fitment`), served locally.
- Responsive QA at 1440/1024/768/390: document width equals viewport width.
  Mobile screenshots inspected; meaningful content, no error overlay.
- Picker keyboard: search initially focused; Tab wraps; Escape returns focus
  to opener; background is inert. Console errors/warnings: none.
- Actual local runtime flow: unfinished Vehicle -> confirm Wheel diameter,
  width, PCD and DIA -> enter manual ET `35,125` -> Save. Success message and
  Wheel confirmed state visible; canonical summary shows ET `35.125` without
  rounding. Standard still requests Vehicle details and Check remains disabled;
  Create Image remains available. No render was started.
- Canonical Vehicle/revision isolation is verified by automated API/runtime
  coverage; the guest preview is not authenticated staging evidence.

## Reference comparison

- v13 compound controls, flat SKU choices, paired final actions and compact
  slash-separated Standard summaries retained.
- Runtime uses actual canonical data and localized copy; v13 remains a docs
  reference and is not imported into runtime.
- Reduced motion is enforced by CSS. Native Telegram/WebView lifecycle and
  authenticated staging E2E remain unverified release gates.

## UI_CHANGE_MANIFEST

- User-visible changes: source action entry, manual fallback copy, full Standard
  summaries, flat variant rows, responsive spacing and paired final actions.
- New elements: explicit labels/error IDs, inert workspace, optional SKU action.
- Authority: implementation spec Slice 7, v13 reference and Visual System 2.0.
- Unspecified choice: choose-another-SKU refreshes the resolver for the current
  URL, rather than retaining possibly obsolete provider variants.

`FITMENT_VNEXT_FULL_STAGING_E2E = BLOCKED`

Reason: no supported disposable staging context; implementation PR stack is
not yet merged/deployed. Existing completed-render contexts were not mutated.
