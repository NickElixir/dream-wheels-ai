# UI_CHANGE_MANIFEST — VNext Visual System 2.0 Phase 1

## USER_VISIBLE_CHANGES

- Increased contrast and clarified the canvas, passive surface, interactive surface and selected-surface hierarchy across VNext screens.
- Applied a near-white primary action, neutral secondary actions, and restrained success/warning/error text colors.
- Clarified selected navigation, vehicle/variant choices, Wallet packages and Result feedback without relying on color or decorative markers.
- Changed the vehicle-details required state from `Нужно уточнить данные автомобиля` to `Уточните данные автомобиля`.
- Preserved existing exact-vehicle terminology and the distinction between Fitment state copy and action copy; runtime variant identifiers and behavior remain unchanged.

## NEW_USER_VISIBLE_ELEMENTS

NONE.

## REMOVED_ELEMENTS

- Decorative `●` / `○` glyphs in Create vehicle and Fitment modification choices. Accessible `role=radio`/`aria-checked` and `aria-pressed` state remain intact.

## INTERACTION_PATTERN_CHANGES

NONE. Selection, navigation, form handling, payment, render and Fitment actions are unchanged.

## SOURCE_FOR_EACH_CHANGE

- Color, typography, selected state, semantic text and CTA treatment: `docs/ui/vnext-visual-system-2.0-phase1.md` §§1–5.
- Navigation treatment: same document §6.
- Fitment vehicle-details copy and preserved state/action distinction: same document §7.
- Fitment exact-vehicle terminology: PR #221 narrow corrective brief, preserving the existing `комплектация` copy pending dedicated Fitment repair/design work.
- Preserved layout, information architecture and mobile behavior: same document §§8–10.

## UNSPECIFIED_DESIGN_DECISIONS

NONE. Existing layout and spacing were retained; token values follow the approved reference hierarchy.

## QA SCOPE

`tests/browser-fixtures/vnext-visual-system-phase1.html` renders representative presentation states for Dashboard, Create, Result, History, Balance, Fitment and Auth without API calls. It is visual evidence only, not proof of authenticated runtime transitions.
