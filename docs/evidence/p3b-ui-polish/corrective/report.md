# PR268 corrective — M-1/M-2/M-3 + L-1/L-2/L-3/L-7

Base f97339a95307883810e6214612e40022fe97d658. One corrective commit on fix/p3b-ui-polish. Frontend presentation only; no backend/API/DB, status, readiness, confirmation, picker/admission or credit/payment changes. No merge.

- M-1: all-width ratio-preserving portrait cap and centering; desktop/tablet min(75vh,820px); mobile60vh preserved. At1440 original landscape geometry860.31×483.67 is unchanged within1px. At1024/768 default landscape geometry retained; additional4:3 desktop/tablet cases verify unchanged dimensions except when cap binds. Portrait height≤80% of viewport, ratio±2%, handle inside viewport.
- M-2: server-only reason when retryAvailable=false and model supplies text. No fallback or canRunCheck/local reason. New tests cover stale+dirty, local blockers, both server restrictions, active primary retry and missing text. Button disabled expression unchanged.
- M-3: container query based on Result aside width; measured full-label text188pxRU/133pxEN and existing padding/gap give420pxRU/312pxEN thresholds. Secondary labels one line, unclipped, equal height≥44px at1440/1280/1024/768/390/360/320 in both locales. Measurements use actual rendered label bounds rather than button scrollHeight, which includes44px hit area.
- L-1: Home desktop/tablet border/padding removed; topbar retained since login appears681–700px. Mobile≤680 unchanged.
- L-2: only dashboard.latestFailed changes (both locales remove final period); corrective/catalog-changes.json has one changed key.
- L-3: ET before DIA in technical summary (also legacy/shared and staggered), SKU legend/cards and editor DOM/tab order. Result/History formatter and comparison table unchanged, covered by order tests. Actual picker selection delegates same field/value and restores focus to same opener. Hidden legacy HTML form order is deliberately unchanged as explained in finding-ledger.md; no hidden-editor migration outside VNext scope.
- L-7: fixture camel-case mapping populated from existing snake-case values; compatible/conditional mock rim values aligned with the reference rows. No empty values next to passing/conditional verdicts. Production data unchanged.

Node269 PASS; auth225 PASS (three additional corrective behavior tests); Python762 PASS/22 local database skips; build and tracked bundle parity, Ruff check/format, diff check PASS. Focused browser204 RU/EN cases incl1280 and4:3 geometry, portrait, label height/clipping, field/tab order and picker focus restore. e01 full180 states PASS, no overflow/clipping. Deterministic harness used; no authenticated live/provider/payment run claimed.

Before/after pairs in this folder: portrait1440/1024RU; Result1440/1024/390RU+EN; Home1440/1024/390RU; compatible summary and editor1440/390RU. Redundant screenshots omitted. Baseline dimensions and final machine metrics provided. Full-page fixed-navigation positioning is a screenshot compositing artifact, not runtime overlap.

Accepted L-4 snapshot-only SKU, L-5 older-WebView :has compatibility, and L-6 not_applicable next-step policy remain unchanged. Exact HEAD CI to be verified after push and recorded in PR description. Short independent re-review should target this corrective commit only.
