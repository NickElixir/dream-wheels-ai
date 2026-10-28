# UI_CHANGE_MANIFEST — VNext Visual System 2.0 Phase 1

## USER_VISIBLE_CHANGES

- Increased contrast and clarified the canvas, passive surface, interactive surface and selected-surface hierarchy across VNext screens.
- Applied a near-white primary action, neutral secondary actions, and restrained success/warning/error text colors.
- Clarified selected navigation, vehicle/variant choices, Wallet packages and Result feedback without relying on color or decorative markers.
- Changed the vehicle-details required state from `Нужно уточнить данные автомобиля` to `Уточните данные автомобиля`.
- Preserved existing exact-vehicle terminology and the distinction between Fitment state copy and action copy; runtime variant identifiers and behavior remain unchanged.
- Scoped Fitment desktop workspace to 920px, aligned it to the left, balanced the vehicle and wheel preview heights, and kept the active selector/editor directly below the object pair. Editing states use smaller previews.
- Removed decorative Fitment section dividers while retaining input, selected-choice and technical-data borders. Removed the duplicate desktop shell title and styled the desktop back action as a text link.
- Made the current Fitment action the only primary action: confirm/save while editing, check/retry before or after a stale/failed check, and Create Image after a current completed check. Create Image remains available independently of the Fitment verdict.

## NEW_USER_VISIBLE_ELEMENTS

NONE.

## REMOVED_ELEMENTS

- Decorative `●` / `○` glyphs in Create vehicle and Fitment modification choices. Accessible `role=radio`/`aria-checked` and `aria-pressed` state remain intact.

## INTERACTION_PATTERN_CHANGES

No runtime interaction change. The completed Fitment footer now exposes the existing edit-parameters action beside Create Image; selection, navigation, form handling, payment, render and Fitment behavior remain unchanged.

## SOURCE_FOR_EACH_CHANGE

- Color, typography, selected state, semantic text and CTA treatment: `docs/ui/vnext-visual-system-2.0-phase1.md` §§1–5.
- Navigation treatment: same document §6.
- Fitment vehicle-details copy and preserved state/action distinction: same document §7.
- Fitment exact-vehicle terminology: PR #221 narrow corrective brief, preserving the existing `комплектация` copy pending dedicated Fitment repair/design work.
- Fitment composition and action priority: the subsequent PR #221 Fitment desktop composition correction brief. It explicitly authorizes this scoped exception to the Phase 1 layout freeze without changing information architecture, runtime, API or mobile composition.
- Other surfaces and mobile behavior: Phase 1 document §§8–10.

## UNSPECIFIED_DESIGN_DECISIONS

NONE. The Fitment layout follows the later approved narrow brief; other surfaces retain their Phase 1 layout and spacing.

## QA SCOPE

`tests/browser-fixtures/vnext-visual-system-phase1.html` renders representative presentation states for Dashboard, Create, Result, History, Balance, Fitment and Auth without API calls. Fitment supports vehicle details, variant selection, wheel details, ready-to-check, completed conditional verdict, stale and failed checks for desktop/tablet/mobile composition QA. It is visual evidence only, not proof of authenticated runtime transitions.
