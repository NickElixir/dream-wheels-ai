# Focus contract — updated 25.10.2026

Current policy: explicit form openings focus the first required empty enabled control, or the first editable control when complete. Vehicle version opening focuses the selected or first enabled choice. Editor headings are fallbacks only while controls are unavailable. Page navigation, informational sections and the Summary retain heading focus.

See `docs/ui/form-focus-policy-2026-10-25.md` for the complete owner-approved policy. The historical verification notes below describe earlier iterations, not a requirement to stop at editor headings.

## Historical corrections — 18.10.2026

Corrections to PR270 after independent review of 66f68f0

- P2: Create URL feedback survives refresh; restoring input values no longer dispatches a synthetic input event; actual edits hide saved feedback, unsaved values survive subsequent refresh
- P3: saved Wheel no longer targets removed edit-rim; successful save targets Summary or required Vehicle/version input according to next_action
- Create consent/photo/source actions have stable focus identities across redraw
- Fitment records a pending action while its control is disabled; completion focuses errors/next step/current verdict only while the user still owns that interaction
- Moving to another control cancels completion focus; background workspace changes preserve the current field
- Opening/choosing/cancelling version and Wheel parameter picker keep their previous focus contracts
- Legacy focus callbacks no longer compete with VNext completion focus
- Explicit page navigation focuses its main heading; forced same-view shell updates try to restore the corresponding control
- Target scrolling only occurs when it is outside the usable viewport band, respecting reduced motion

Browser verification: actual component modules in Chrome/Playwright at 1440 and 390 px, controlled state transitions, no live API or payment calls
18 additional assertions passed: save → Summary/version/Vehicle, delayed completion after moving to URL, background workspace change, check → current verdict, saved URL notice and preservation of unsaved URL
26 earlier focus observations rerun; consent/photos/errors corrected, existing picker and catalogue behavior retained
Actual bootstrap with a test navigation adapter: Settings → Support focuses H1
Browser artifacts are in task outputs/focus-fixes-2026-10-18

New automated cases cover saved URL feedback, four Create focus identities and save completion destinations; background transitions now explicitly assert no unsolicited focus capture
Remaining scope: real network/OAuth/Telegram WebView and account modal focus are not certified by this component verification
No merge, deployment or production operation performed

## Second review corrections

Review base: fe1fc47d97fe59fdf755c4353722e9a62ac14891

- Removed completion intent inference from the focused control during refresh; only the actual action handler records completion intent
- Workspace transitions likewise distinguish synchronous explicit action handling from background redraw
- Error messages and verdict headings have repeatable semantic focus keys, preserved after their DOM nodes are replaced
- Added four unit cases for focus without activation, background workspace changes, and alert/verdict redraw retention; earlier completion tests now seed an explicit activation intent
- Added focus-regression.html using actual component modules and the browser DOM, without mocks or API calls; serve the repository root and open /docs/evidence/ui-owner-audit-2026-10-18/focus-regression.html
- At both 1440 and 390 px, compare old fe1fc47 against the corrected module: the old code fails the reported cases, the corrected code passes; completion, cancellation, picker Escape and late-response protection remain covered
- Each focused error/verdict is redrawn five times to verify retention beyond the first completion render

This page verifies component focus behavior, not real API integration or Telegram WebView

## Third review corrections

Review base: a80d0c71212d99f895f25b5a644fc85d295075a1

- Field alerts use the stable field path/ID; general alerts use explicit purpose keys, with distinct check execution/status/request identities
- Removed positional error keys entirely; insertion or removal of adjacent errors cannot reuse the focused message identity
- When an alert disappears, restore its enabled field/picker or owning block heading, without focusing another alert
- Expanded the real DOM regression page to 21 checks at each of 1440 and 390 px, including disappearing make error, inserted/removed adjacent errors, disabled field fallback and disappearing save error beside validation
- The previous HEAD fails four new checks at each width; the corrected module passes all 21, with no browser runtime errors

Real API, OAuth and Telegram WebView acceptance remains separate; no merge or deployment performed
