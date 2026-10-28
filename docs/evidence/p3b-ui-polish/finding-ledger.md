# P3-B finding ledger — pre-implementation

Base f3825f6fec57a3150b8081f3834da8b18a1b055a (PR267 merged). Baseline 1440/390 RU and selected EN screenshots: before-focused-{scenario}-{width}-{locale}.jpg; initial fixture measurement matrix: baseline-results.json. Redundant broad screenshots omitted; focused pairs are authoritative. Sources: owner P3-B items and named historical findings. No backend/DB writes.

|Item|1440 RU baseline|390 RU baseline|Decision|
|---|---|---|---|
|1 R-01/M6|Three stacked actions; metadata dividers|Square viewer letterboxes, Download below fold|FIX A first, measure three mobile sizes, then B|
|2 F-14|Wheel card and result-panel both render edit-rim in incompatible/unknown/conditions/failed/stale|Same duplicate|FIX verdict duplicate only|
|3 failed|Failure copy repeated in summary; retry_mode not_applicable disables retry|Same|FIX copy/action hierarchy and explicit unavailable explanation; preserve logic|
|4 F-07/27|Summary H2 repeats page title or check-completed; wheel summary includes SKU|Topbar and H1 repeat|FIX summary label, title presentation, wheel formatting; vehicle untouched|
|4a SKU|Editor already shows SKU; card missing|Same|FIX card and Result: existing render_input_snapshot.rim.sku can project without API change|
|5 History|Date repeated in spec line, completed status shown|Same|FIX grouping/time/spec/status presentation|
|6 Home|snapshot selects first job regardless of status|Same snapshot|FIX completed selection plus compact failed notice|
|7 Home H1|Shell Home title plus hero H2|Mobile topbar must remain|FIX desktop heading visibility, hero H1|
|8 picker|Empty fields still say choose another|Same|FIX empty/filled labels and aria|
|9 table|Broad wrapping rules|Header mid-word at narrow widths|FIX normal word wrapping, mobile short Auto header if needed|
|10 favicon|No existing logo/favicon asset found|Same|NEEDS OWNER — contradictory fallback/asset instruction; question pending|
|11 ET|Display prefixes ET under ET label|Same|FIX display only; other fields already omit repeated labels|
|12 loading|Centered label under compare handle|Same at small widths|FIX spinner-only compare loading presentation|

Retry authority: app.js vnextFitmentSnapshot uses check.retry_mode != not_applicable AND server next_action == run_standard_check (failed); otherwise server next_action only. src/fitment_checks_api.py maps provider authentication/malformed/internal errors to not_applicable, throttle/quota to retry_later. No N-minute duration supplied; do not fabricate a cooldown. Explain server restriction or required confirmation using localized display copy.

Step A button bottom metrics will be appended before Step B. Conditional action placement will be decided only from those measurements.

## Step A measurements before Step B

Result baseline fixture, button bottom edges in px (repeat / check / download), nav top:

|Viewport|Repeat|Check|Download|Nav top|
|---|---|---|---|---|
|390×844|540.19|592.19|642.19|780|
|360×740|523.33|575.33|625.33|676|
|320×625|500.83|552.83|602.83|561|

Source: step-a-metrics.json, step-a-result-{390,360,320}.jpg. The permitted metadata/actions relocation was NOT needed and NOT performed. Step B retains image → metadata → actions, primary full-width, equal Check-left / Download-right secondary row. Short Check label is used at ≤400px. SKU added afterward; the richer final model still passes viewport gates (focused-browser-results.json).

## Final decisions

All 13 items (1–12 plus 4a): FIX. Conditional F-14 reproduced in all five specified states; only verdict duplicate removed. Item 10 resolved by owner on 2026-10-06: approved text DW on current background; favicon.svg plus favicon.ico added. No pending owner decision. No backend/API change was needed for Result SKU: frontend projection reads existing render_input_snapshot.rim.sku / selected_variant_sku.

Before-focused captures route production files from exact base Git blobs into the same controlled representative scenario; no base checkout edits. Fitment canonical summary fixture is intentionally old SKU-in-summary for before, separate-SKU for after. Historical broad before/after fixture captures complement these focused pairs; neither represents an authenticated live session.

|Item|Before / after evidence (1440 and 390 RU unless noted)|
|---|---|
|1 actions/dividers/photo|before-focused-result-* / after-focused-result-*; EN pairs; before-result-320-ru, after-focused-result-320-ru, after-focused-result-360-ru|
|2 duplicate action|before-focused-{incompatible,unknown,conditions,failed,stale}-* / after-focused-{same}-*|
|3 failed/retry|before-focused-failed-* / after-focused-failed-*; EN pairs|
|4 summary/title/vehicle|before-focused-compatible-* / after-focused-compatible-*; EN pairs|
|4a SKU|before-focused-{compatible,editor,result}-* / after-focused-{same}-*|
|5 History|before-focused-history-* / after-focused-history-*|
|6/7 Home|before-focused-dashboard-* / after-focused-dashboard-*|
|8/11 picker / ET|before-focused-{editor,editor-empty}-* / after-focused-{same}-*|
|9 table|before-focused-compatible-* / after-focused-compatible-*|
|10 favicon|favicon.svg / favicon.ico; root static assets HTTP checks; owner authorization above|
|12 loading|before-focused-loading-* / after-focused-loading-*; after-focused-loading-320-ru|

## Corrective review on f97339a — pre-edit decisions

|Finding|Confirmed cause|Decision / before evidence|
|---|---|---|
|M-1|Portrait ratio applied at desktop without height cap|FIX; corrective/before-portrait-{1440,1024}-*.jpg|
|M-2|Local canRunCheck blockers trigger fallback retry-unavailable text|FIX display condition/text only; no admission change|
|M-3|Viewport query ignores narrow desktop action column|FIX container-width labels; corrective/before-result-{1440,1024}-*.jpg|
|L-1|Hidden Home title leaves border/padding|FIX border/padding ≥681 only; login button appears up to700px, retain topbar to preserve681–700 login|
|L-2|Notice template ends with period|FIX exactly dashboard.latestFailed RU/EN; no other copy|
|L-3|Summary, SKU legend/cards and editor use DIA-before-ET|FIX display order only; corrective/before-{compatible,editor,result}-*.jpg|
|L-7|Fixture raw snake-case field values not mapped to camel-case presentation|FIX harness only; before-compatible screenshots|

L-3 additional audit: fitmentRimTechnicalSummary serves legacy fallback as well as canonical/staggered summaries, so its display order changes there too. vnextRimSpecs already uses ET/DIA and serves Result/History. Dashboard vnextDashboardJobViewModel shows size/PCD only; no ET/DIA pair to reorder. Comparison table already puts ET before DIA. Raw identity maps, numeric-field sets, serialization arrays and confirmation/readiness loops are not visual order and remain unchanged. Editor legend/card labels and DOM/tab order will follow diameter/width/PCD/ET/DIA; picker identifiers/focus keys remain intact.

Accepted limitations unchanged: L-4 Result SKU depends on existing snapshot; L-5 :has support on old WebViews; L-6 not_applicable next-step policy needs a separate product decision.

Legacy HTML exception (L-3): index.html legacy wheel input forms still put DIA before ET (front551/556, rear569/570). These are hidden by the active VNext Fitment surface and are outside this VNext-only corrective; no legacy form/editor migration or input-handling change is introduced. Shared legacy summary formatting is corrected through fitmentRimTechnicalSummary. Plain maps/serialization/confirmation arrays and immutable demo/reference strings retain source order because they are not rendered parameter sequences. No changes to readiness or confirmation order.

Corrective result: all seven listed findings addressed; tests and before/after mapping in corrective/report.md. Container queries replace the earlier viewport-label rule. Default1440 landscape dimensions are unchanged;4:3 cap cases and portrait bounds are separately tested. Existing snapshot-only SKU, older-WebView :has and not_applicable recovery policy remain accepted limitations. No merge.
