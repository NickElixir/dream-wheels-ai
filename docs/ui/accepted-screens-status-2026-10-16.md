# UI review status — 16.10.2026

All changes remain local unless explicitly noted; navigation PR269 was merged separately. No visual rollout to staging is implied by acceptance.

- Home/Create: owner-approved baseline in home-ui worktree (UI-001–021). Retain transparent photo links, 18px arrows, no outer latest-result island; thin white outline only on photos on hover/focus. No browser-default button backgrounds/borders. Home/Create source work remains on its existing branch.
- Result: UI-022–024 accepted, local result-ui branch.
- History: UI-025–027 accepted, local result-ui branch.
- Balance: UI-028–033 accepted for current iteration with outstanding composition concern; revisit later.
- Photo guide: UI-034–038 accepted; supplied Kia and uncropped vertical Porsche, concise guidance and create action.
- Support: UI-039–042 accepted; contact icons, 350px rows, contacts/useful columns desktop, stacked mobile.
- Documents: UI-043–045 trial; document icons, max700px, no Open label/dividers/trailing periods. Owner review pending.
- Fitment: next design review phase, no new visual changes approved here.

UI-046 regression: preview mixed Home/Create view modules from home-ui with newer shared surfaces from result-ui. Extract accepted Home/Create rules into approved-home-create.css, scoped to those screens, and load after shared preview surfaces. No new visual design. Consolidation into one release branch must preserve this baseline and reconcile both worktrees before a PR.

Future work retained: stable per-account try-on numbers (server/API/storage), public sharing phase, custom icon design, Balance composition polish. See screen-specific owner-amendment documents for decisions and superseded trials.

UI-047: fixed local Dashboard→Result callback replacing the entire shell with bare result content. Navigate to result scenario through the shared shell instead: desktop menu, mobile menu, header and standard content padding retained. Result composition unchanged.
