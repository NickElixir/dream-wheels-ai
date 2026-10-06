# UI_CHANGE_MANIFEST — P3-B

Base: staging f3825f6fec57a3150b8081f3834da8b18a1b055a, after PR267.

## USER_VISIBLE_CHANGES

- Result: remove heading/metadata/feedback dividers, fit viewer to loaded result photo proportions with mobile 60vh cap, retain contain (no crop/zoom). Primary full-width; Check-left and Download-right secondary row. Download-only row when canFitment false. ≤400px Check short label. Compare loading uses accessible spinner away from handle. SKU secondary row when available.
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
