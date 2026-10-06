# UI_CHANGE_MANIFEST — P3-B

Base: staging f3825f6fec57a3150b8081f3834da8b18a1b055a, after PR267.

## USER_VISIBLE_CHANGES

- Result: remove heading/metadata/feedback dividers, fit viewer to loaded result photo proportions with mobile 60vh cap, retain contain (no crop/zoom). Primary full-width; Check-left and Download-right secondary row. Download-only row when canFitment false. Container-width Check label (short only when the full label cannot fit). Compare loading uses accessible spinner away from handle. SKU secondary row when available.
- Fitment: remove only duplicated verdict edit action; show failure once with saved-details sentence; retry primary, render secondary, disable preserved with explicit reason. Summary heading Итог / Summary and separate completed status; keep vehicle summary unchanged. Move SKU from parameter line to wheel card; retain editor SKU. Hide duplicated mobile page H1 visually, retaining a11y H1 and Back; desktop shell duplicate title hidden. Empty picker Select; filled Select another. ET numeric display without repeated prefix, accessible ET retained. Normal table word wrapping and short Auto header ≤400px.
- History: group dates with Today/Yesterday; wheel · specs and separate 24h time; completed status removed, exceptions/billing preserved. Existing mobile 88px preview and two-column structure unchanged.
- Home: latest completed selected; newer failed entry produces compact History link; recent latest three unchanged; no-completed empty state retained. Desktop Home heading removed, hero promoted to H1; mobile topbar retained. Home/Fitment shell title uses a paragraph label, leaving one page H1 (visually hidden on mobile Fitment as required).
- Favicon: owner-approved monochrome text DW on existing canvas, SVG plus ICO.

## NEW_USER_VISIBLE_ELEMENTS

Existing SKU now displayed on Fitment card and Result metadata when present; compact failed/latest History notice and disabled-retry explanation; favicon. No new product actions.

## REMOVED_ELEMENTS

Result horizontal dividers; duplicate verdict edit action; repeated failed summary copy; SKU in wheel parameter line; completed History status and repeated row date; duplicate visible page headings as specified.

## INTERACTION_PATTERN_CHANGES

Existing Result actions regrouped into approved M6 order (repeat, check, download), with matching tab order. Existing picker action labels distinguish empty/filled. All callbacks, retry admission, saves, render availability, compare behavior and navigation destinations preserved. No new workflow.

## SOURCE_FOR_EACH_CHANGE

Owner P3-B attachment items 1–12 and 4a; R-01/M6 decision (Check left, Download right); F-14 conditional reproduction; F-07/F-26/F-27/F-28; H-03/05/06; D-01/02; owner 06.10 Result/ET/loading directions; explicit favicon reply 06.10. Latest explicit owner middle-dot formatting overrides historical UI-design-code separator prohibition ONLY for the approved wheel summary, History descriptor and compact Home notice; unrelated separator restrictions stay tested.

## UNSPECIFIED_DESIGN_DECISIONS

NONE. Actions NOT moved above metadata because Step A measurements already met required viewport gates. Short Check and Auto labels are permitted fallback choices. No fabricated retry duration; existing server restrictions/required details explained neutrally. Photo ratio is read from existing loaded media, not API fields. No backend, database, API, engine, auth, payment, credit or job-lifecycle change.

## Corrective on f97339a — review findings

M-1: portrait/media height capped at all widths; desktop/tablet cap min(75vh,820px), corresponding ratio-preserving width and horizontal centering. Mobile60vh unchanged; landscape geometry preserved unless cap binds. No crop/zoom, new background or image asset.
M-2: retry explanation only when retryAvailable is false, with nonempty authoritative retryUnavailableReason; no fallback or local-canRunCheck explanation. Disabled/admission expression unchanged.
M-3: named inline-size container on Result aside. RU full label at container≥420px, EN≥312px (based on IBM Plex Sans15px full-label measurements188px/133px plus existing padding/border/gap); shorter label otherwise, independently of viewport. Both actions remain one line, equal height and in existing order. No workflow change.
L-1: Home topbar border/padding removed at≥681px, but topbar retained because login appears up to700px. ≤680px topbar unchanged.
L-2: only dashboard.latestFailed RU/EN loses trailing period, per explicit owner decision.
L-3: rendered summary, SKU legend/card and wheel editor switch to diameter/width/PCD/ET/DIA. Editor DOM and keyboard order changed intentionally; picker field keys/focus restore unchanged. No value, serialization, readiness or confirmation change. Hidden legacy HTML form exception is documented in ledger; shared legacy summary uses corrected formatter.
L-7: harness maps existing snake-case values and aligns representative rim values with the compatible/conditional checks. No production data or engine change.

New elements: NONE. Removed elements: empty desktop Home divider, inappropriate local retry explanation, one notice period. Interaction change: approved editor field/tab order only. Sources: owner corrective M-1/M-2/M-3/L-1/L-2/L-3/L-7 and ET→DIA decision07.10. Unspecified design decisions: NONE. Accepted L-4/L-5/L-6 limitations retained.
