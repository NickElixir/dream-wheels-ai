# P0-B IMPLEMENTATION REPORT

## Delivery

- Base: `staging`, `db8dc3e72729abef8ba7def9393d8e37a4139e2c` (P0-A PR #252 merged).
- Branch: `feature/p0b-fitment-ui-correctness`.
- Worktree: `p0b-fitment-ui-correctness`, created independently from staging.
- PR: separate P0-B PR targeting `staging`; see the branch's open PR for final HEAD/CI.
- Scope: F-01, F-02, F-03, F-05, W-01. No backend runtime, migration, credit, payment or verdict engine changes.
- READY FOR INDEPENDENT REVIEW: **YES**. No automatic merge.
- P0-A live staging E2E: **WAIVED BY OWNER / NOT EXECUTED**.
- P0-B browser verification: local current application with controlled API responses, **not live staging E2E**. No real jobs, accounts, credits or renders used.

## F-01 — dirty Wheel / canonical Check

Previous defect: Check used saved canonical IDs while the visible Wheel draft had changed. The availability guard and Standard Check summary did not represent this draft.

`fitmentComparableWheel` compares the existing form against its saved baseline using domain values. It includes front/rear editable RimSpec values and setup mode. Decimal comma/dot and numeric/string equivalents compare equal; missing/null/empty are equivalent; ET=0 remains a value. Brand/model/SKU/product URL remain text fields. Dirty state does not change the server's `next_action` or falsely make an unchanged saved result stale.

Both the runtime start handler and view availability reject a Check with a dirty Wheel. Vehicle dirty, Save, resolver, variant application and active Check guards also apply. Dirty summary offers **Сохранить параметры** and says to save before checking updated data. Create Image remains independent of Fitment status.

For a valid draft, Save uses the existing independent Wheel PATCH. No Vehicle payload is added. The response becomes the canonical baseline. For missing/invalid/unconfirmed/conflicting values, Save opens the Wheel workspace, displays field errors and focuses/scrolls the first blocking field (or workspace/chooser when no numeric field applies); no PATCH or Check is sent.

Race handling compares the submitted Wheel domain with the latest local draft at PATCH response time. A later draft is preserved against the newly saved canonical baseline. That baseline is set before the asynchronous currentness refresh, preventing a subsequent edit from becoming falsely clean. If later changes remain, the Wheel editor stays open and the message explicitly distinguishes submitted saved details from new unsaved changes. Existing context/revision conflict checks remain in place.

Evidence:

- Domain tests: numeric formatting, null/empty, zero ET, front ET, brand, rear PCD, setup mode, blocked POST.
- Race tests: edit A → PATCH → edit B → response A; edit during currentness refresh. New B remains dirty and Check disabled.
- Wheel PATCH excludes Vehicle; canonical Vehicle and its revision remain unchanged.
- Browser: clean, dirty, successful Save, invalid field focus, PATCH race; desktop/mobile screenshots.

## F-02 — failed Check / recovery

Backend `execution_status=failed` remains distinct from `completed` with verdict `incompatible`. Failed execution shows **Проверку выполнить не удалось**, **Попробуйте ещё раз**, and primary **Повторить проверку**. Editing remains a secondary optional action; render actions stay independent.

HTTP/network start failure uses a separate local `fitmentCheckStartFailed` flag, without inventing a failed backend execution or exposing raw provider codes/statuses. Retry creates a new POST and idempotency key using the current canonical VehicleIdentity/RimSetup IDs. Queued/processing lock mutation and prevent double starts. No job or Render mutation is added.

Evidence: launch failure leaves Check null; retry sends a new request; double start suppressed; queued/processing view tests and browser captures; incompatible completion renders its verdict rather than execution-failure copy.

## F-03 — source truth

The source card now reads saved canonical RimSpec plus the current job's wheel asset:

1. Real safe HTTP/HTTPS `product_url`: product link, hostname only.
2. Uploaded `rim_original` / available wheel preview without URL: wheel photo.
3. Manual technical provenance (`user_input`, `user_edited`, `manual`) without image/URL: entered manually.
4. Unknown/legacy source: neutral source not specified.

Photo/URL source has priority over individual field provenance. An unsaved URL does not relabel the canonical source. No link is created; credentials, path and query are omitted, labels are escaped, and non-HTTP schemes do not become product-link sources.

Evidence: URL with credentials/query displays only `shop.test`; photo without URL; manual fields; unknown legacy; invalid scheme. Browser verifies photo source on actual local application.

## F-05 — grouped explanations

Completed results map backend arrays separately:

- `blocking_issues` → **Почему не подходит**;
- `missing_fields` and existing `evidence_summary.missing_fields` → **Что нужно уточнить**;
- `conditions` → **Условия установки**;
- `advisories` → **Дополнительная информация**, last in reading order.

Empty groups are omitted and identical display lines are deduplicated across groups in the above order. Blockers plus conditions include the statement that installation conditions do not override incompatibility reasons. No verdict calculation or API status is changed. Failed/start-failed checks do not display completed explanation groups. New headings/copy use the existing RU/EN presentation map.

Evidence: all four backend verdicts, two blockers + condition + advisory, unknown with missing fields, condition-only result, compatible with empty arrays, cross-group duplicate, English copy. Browser captures all four verdicts at 1440 and 390.

## W-01 — balance / expiry

Source-of-truth audit:

- `src/payments_api.py:get_payment_cabinet` obtains balance and packages on its existing transaction/connection.
- `src/credits_service.py:get_balance` expires packages and reconciles cached balance to `SUM(remaining_credits)` for positive unexpired packages.
- `list_credit_packages` selects the same positive/unexpired package set, ordered by expiry/creation.
- `migrations/0024_credit_packages_fifo.sql` defines non-null expiration dates. The current migrated contract therefore has balance equal to the active package sum; no frontend correction arithmetic is introduced.

Both dashboard paths now display **all** active expiry rows, rather than truncating with `.slice(0, 2)`. They share the wallet's existing cohorts. Zero/expired rows are filtered, nearest expiration comes first. A provided no-expiry row is supported defensively at the end with RU/EN label; current backend schema does not generate permanent packages and was not altered.

Tests: four active rows, sorted input, zero/expired exclusion, provided permanent row at end, visible sum equals supplied balance. Browser checks one/two/four rows at both widths, including last permanent row. Existing backend reconciliation tests pass.

Limit: legacy compatibility when the `credit_packages` table is absent intentionally returns a cached balance and no packages. Equality is not guaranteed for that unmigrated schema; this pass makes no frontend arithmetic or migration change to conceal it. This is a conditional backend/data limitation, not an observed staging mismatch. No live DB/data audit is claimed.

## Files

Runtime:

- `webapp/app.js`: domain dirty model, start guard, Save race/focus, Check-start failure, source model, grouped arrays, full expiry rows.
- `webapp/vnext/views/fitment.js`: dirty Save/disabled Check, failure/retry copy, source labels, grouped explanations, RU/EN strings.

Tests/tooling:

- `tests/test_fitment_transition_behavior.mjs`: behavioral coverage including independent Wheel, failed launch/retry, both Save races, source safety and expiry rows.
- `webapp/auth/vnext-fitment.test.js`: presentation groups, states, localization; updated isolated snapshot stubs and old error-copy expectation.
- `scripts/qa/fitment_p0b_browser.cjs`: repeatable local browser QA. It refuses non-local server URLs and uses synthetic auth/API responses; no runtime imports of fixtures/prototypes.
- This report and `p0b-fitment-ui-correctness/`: screenshots, network transcript and verification logs.

## Automated verification

| Gate | Result |
| --- | --- |
| `python3 -m pytest -q` | 668 PASS / 6 skipped; existing 20 deprecation warnings |
| `npm --prefix webapp test` | 208 PASS |
| `node --test tests/test_fitment_transition_behavior.mjs tests/test_webapp_boot_behavior.mjs` | 122 PASS |
| `npm --prefix webapp run build` | PASS |
| Ruff changed Python | N/A — no Python changes |
| `git diff --check` | PASS |

Logs: [backend](p0b-fitment-ui-correctness/backend-tests.txt), [frontend](p0b-fitment-ui-correctness/frontend-tests.txt), [transition/boot](p0b-fitment-ui-correctness/transition-boot-tests.txt), [build](p0b-fitment-ui-correctness/build.txt).

## Browser QA

Chromium/Playwright against local unmodified application files; only test instrumentation/API responses are intercepted by the QA runner. Browser skill connector was unavailable; bundled Playwright was used. This does not verify Telegram native WebView behavior or authenticated staging.

31 captured scenarios, widths **1440** and **390**, zero JavaScript console/page errors, no document horizontal overflow:

- clean/dirty/saved/invalid focused Wheel;
- failed execution, queued, processing, HTTP launch failure;
- completed compatible / conditions / unknown / incompatible;
- one/two/four expiry rows;
- delayed Wheel PATCH with a newer edit.

The runner checks Retry produces exactly one POST despite a second start invocation, invalid Save focuses the blocking control, and Save race leaves the new draft dirty. Mobile screenshots scroll the relevant section into view because the application has an internal scrolling container.

Evidence: [network and assertions](p0b-fitment-ui-correctness/browser-network.json), [screenshots](p0b-fitment-ui-correctness/screenshots/).

Repeat with a local server serving `webapp` on `127.0.0.1:8781` and a Playwright installation available:

```sh
python3 -m http.server 8781 --bind 127.0.0.1 --directory webapp
# In another terminal:
PLAYWRIGHT_MODULE=/absolute/path/to/playwright node scripts/qa/fitment_p0b_browser.cjs
```

Optional runner variables: `P0B_QA_BASE_URL` (local only), `P0B_QA_OUTPUT`.

## P0-A regressions / boundaries

Existing frontend/backend/boot suites pass. Wheel-only Save remains independent of incomplete Vehicle and uses no Vehicle canonical/revision mutation. Server `next_action` is not overridden. Save/Check have no Render permission gate; all verdicts retain Create Image. Create assets/jobs/automatic resolver/auth/idempotency implementations were not changed.

P0-A live staging E2E: **WAIVED BY OWNER / NOT EXECUTED**. P0-B full live E2E: **NOT EXECUTED**.

## Out-of-scope findings

- BLOCKER/HIGH: none newly observed within this local pass.
- MEDIUM: conditional unmigrated credit-packages fallback described above; no claim that staging is affected.
- LOW: none added as implementation scope. Existing P0-A LOWs, N-06/F-06/F-17/W-02, full i18n, History cleanup, payment/credit/verdict redesign remain outside this PR.

Next gate: independent P0-B review, corrective pass/re-review if needed, then owner-authorized staging merge.
