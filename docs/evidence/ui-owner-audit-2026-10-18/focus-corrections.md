# Review corrections and focus — 18.10.2026

Corrections to PR270 after independent review of 66f68f0

- P2: Create URL feedback survives refresh; restoring input values no longer dispatches a synthetic input event; actual edits hide saved feedback, unsaved values survive subsequent refresh
- P3: saved Wheel no longer targets removed edit-rim; successful save targets Summary or required Vehicle/version editor according to next_action
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
