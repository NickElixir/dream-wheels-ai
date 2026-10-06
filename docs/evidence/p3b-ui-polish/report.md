# P3-B UI polish — implementation and QA

Date: 2026-10-06. Base staging f3825f6fec57a3150b8081f3834da8b18a1b055a after PR267. Branch fix/p3b-ui-polish. All 13 owner items FIX; no pending owner decision. Finding ledger existed before edits; Result Step A preceded Step B and measurements are preserved. No action relocation above metadata was necessary.

Production scope: webapp/vnext views/styles/copy; app.js VNext projections only; index.html favicon link and favicon.svg/.ico explicitly required by item10 and owner-confirmed fallback. Backend, database, API, Fitment engine, providers, auth, payments, credits and render states untouched. Copy catalog contains 14 added RU/EN keys, no unrelated edits (catalog-changes.json). Vehicle canonical summary expression unchanged. SKU uses existing snapshot data; no request or API field added.

See finding-ledger.md and UI_CHANGE_MANIFEST.md for the item-level decisions, sources and before/after mappings. Before-focused images load exact base Git blobs via isolated browser request routes into the representative fixture; they do not alter the checkout or live state. The broad e01 measurement matrices are supplemental; redundant screenshots are omitted. Synthetic fixtures are not authenticated user evidence.

## QA

Regular Playwright used: Browser plugin/skill unavailable; existing deterministic fixture/runtime harness explicitly allowed. e01: 180 RU/EN states at 390/1440 with zero overflow/clipping or page errors. P3-B: 168 focused RU/EN states at 1440×1000,1024×900,768×900,390×844,360×740,320×625. Checked Result, no-Fitment, loading, portrait media, History, Home, failed and all verdicts/currentness, wheel editor/empty. Zero document horizontal overflow, broken images or console/page errors. SVG/ICO static assets both HTTP200. Existing e01 Create .jpg typo maps to .png only in supplemental baseline capture; no runtime source asset changed.

Focused behavioral/browser evidence: Result repeat → check → download DOM/tab order; equal secondary widths; delegated Download action; absent Check when canFitment false; no metadata/topbar/feedback dividers; 44px minimums; spinner away from handle; portrait frame keeps native ratio and mobile60vh limit. Failed Fitment title occurs once, retry stays disabled with explanation, primary styling; Summary and unchanged vehicle configuration; separate SKU; ET numeric only and accessible label retained; empty vs populated picker; Home completed selection and History-link delegation; completed History status absent.

Final Result RU fixture including SKU: at390 Repeat bottom563.03, Check/Download615.03, navTop780; at360 Repeat546.17, Check/Download598.17, navTop676; at320 Repeat523.67≤navTop561, secondary575.67 reachable by short scroll. All measured actions46px. Step A numbers recorded separately before action regrouping.

Node behavioral269 PASS. Auth suite222 PASS, including nine P3-B behavior tests. Python762 PASS/22 local DB skips; CI executes isolated PostgreSQL integration. Build and bundle parity, Ruff check/format, diff check PASS. Existing tests retained; assertions updated for explicit owner contracts. Historical P1 evidence not rewritten: failed verdict snapshot expectation is adapted in the test only for approved new failure sentence.

Mechanical design detector: one pre-existing warning for fitment.css line234 2px left border, unchanged from base and outside listed items; no unsolicited restyling. Rendered screenshots inspected for both wide/narrow layouts. Full-page fixed bottom-nav placement in tall Fitment captures is a screenshot compositing artifact; first-viewport Result shots are unstitched.

No live authenticated upload/generation, provider or payment flow claimed; deterministic production views and existing behavior suites used. No merge. Exact HEAD CI to be checked after push and linked in PR description. Ready for independent focused P3-B review after CI passes.
