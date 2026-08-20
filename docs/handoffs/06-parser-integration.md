# Workstream 06 — Parser Integration

**Status:** COMPLETE — READY_FOR_FITMENT
**Scope:** Dream Wheels AI Release 1 integration work  
**Branch policy:** start from current `origin/staging`; do **not** merge `codex/robust-rim-url-parser` wholesale.  
**Production policy:** no production rollout, deployment, or change to `main` in this workstream.

## Objective

Bring the validated rim URL parser core into the current staging application and complete the user flow:

```text
Rim product URL
  → resolved product / variants
  → SKU or variant selection
  → normalized RimSpec
  → user review and confirmation
  → existing fitment flow
```

The integration must preserve the current staging architecture and UX. Parser output is a helpful prefill, not an authority over user-entered data.

## Starting point and authority

1. Work from a **new branch and worktree created from freshly fetched `origin/staging`**.
2. Confirm the checked-out base commit and record it in the PR/handoff before implementation.
3. Treat the parser worktree/branch at `codex/robust-rim-url-parser` as the source of validated parser logic and regression evidence only.
4. Selectively port the needed components, adapting them to the current staging codebase. Prefer small, reviewable commits.
5. Do not use a wholesale merge, rebase, or cherry-pick sequence that imports the historical branch architecture, stale API/UI code, or unrelated commits.

Known context: the parser branch was maintained independently and is materially behind `staging`. It was frozen after parser-core validation; any deferred Render access behaviour for «Колёса Даром» remains an environment verification item, not a reason to expand parser core scope.

## In scope

- Selective port of validated resolver/extraction logic, parser models, source adapters, normalization, fixtures, and regression fixes that are still compatible with current staging.
- Reconciliation of the parser response with the **current** backend API contract and current frontend state/UI.
- URL submission, resolution, product/variant representation, SKU selection, RimSpec prefill, review, and explicit user confirmation.
- Single-variant and multi-variant UX:
  - one unambiguous compatible variant may be selected automatically;
  - multiple variants must be shown to the user for selection;
  - the application must not silently choose an arbitrary first variant.
- Manual entry/editing at every point where the product permits it.
- Clear, recoverable failure handling: a parser failure, timeout, unsupported URL, incomplete data, or source-access problem must leave the user able to enter/edit the wheel parameters manually and continue.
- Unit/integration tests plus staging-appropriate E2E coverage for the complete flow.
- Documentation of final endpoint/UI contract, supported-source behaviour, known limitations, and validation results.

## Explicitly out of scope

- Direct merge of `codex/robust-rim-url-parser` into `staging`.
- Replacing or redesigning unrelated current staging systems (auth, payments, cabinet, fitment, or general frontend architecture).
- New browser automation, OCR, LLM extraction, or unrestricted crawling as a fallback.
- Expanding supported sources without a separately agreed validation plan.
- Production deploy, merge to `main`, or production traffic changes.

## Required functional behaviour

### 1. URL resolution

- Accept a user-supplied rim product URL through the current app entrypoint or a compatible current endpoint.
- Validate and normalize input without discarding the original user-visible URL unnecessarily.
- Return a structured result suitable for the frontend: resolution status, product identity where available, variants/SKUs, normalized candidate RimSpec data, and actionable error/fallback information.
- Preserve safe missing values as `null`/`None`; never infer or fabricate unknown dimensions.

### 2. Variants and SKU selection

- A single clearly resolved variant may prefill the form.
- For multiple variants, display enough identifying data for a deliberate selection (for example SKU plus diameter, width, PCD, ET, DIA where known).
- Changing the selected variant must update only fields that remain parser-derived and have not been manually overridden by the user.

### 3. RimSpec and user confirmation

- Map parser output into the current canonical RimSpec/form state rather than introducing competing representations.
- Show all available values for review before treating them as input to downstream fitment operations.
- Manual edits are authoritative. A later parser result or variant selection must not overwrite a user-edited field without an explicit user choice to reapply parser data.
- Incomplete parsed results remain useful as a prefill, but must visibly request the missing required fields before confirmation.

### 4. Failure and manual fallback

- The user must be able to continue with manual parameters when parsing fails or yields no usable result.
- Failures must be user-comprehensible and must not strand the UI in loading/error state.
- Capture safe diagnostic detail in backend logs/telemetry if the current application supports it; do not expose internal fetch/parser traces to users.

## Implementation approach

1. **Reconnaissance**
   - Fetch `origin` and create the fresh worktree/branch from `origin/staging`.
   - Locate the present API, RimSpec model/state, URL entrypoint, variant UI, and fitment handoff in staging.
   - Compare them with the frozen parser core to identify the minimal import set and any contract mismatch.

2. **Port parser core selectively**
   - Copy/adapt only validated parser modules and their direct dependencies.
   - Retain the deterministic allowlisted approach used by the benchmark; do not add browser/OCR/LLM fallback.
   - Bring only relevant fixtures/tests, adjusting paths and imports to the new architecture.

3. **Integrate backend/API**
   - Add or adapt the current endpoint/service boundary, using the app's current conventions for validation, authentication, errors, and response envelopes.
   - Define and test a stable response contract for resolved variants, partial specs, and failures.

4. **Integrate frontend flow**
   - Connect URL input to the current API client and app state.
   - Implement selection/review/confirmation and manual fallback using the existing UI patterns.
   - Verify manual-overrides-authoritative behaviour.

5. **Validate end-to-end**
   - Run targeted unit and integration tests throughout.
   - Run the existing parser regressions/benchmark smoke where compatible.
   - Execute E2E scenarios against the staging-branch environment; use fixture/network-stub paths where external retailer availability would make tests flaky.

## Minimum test matrix

| Scenario | Expected result |
| --- | --- |
| Supported URL, one resolved variant | Correct SKU/RimSpec prefill; review is shown; user can edit and confirm. |
| Supported URL, several variants | No arbitrary auto-choice; user selects a variant; spec updates correctly. |
| Partial RimSpec | Known values prefill; unknown fields stay empty/null; user completes them manually. |
| Manual edit after parse | Manual value persists through UI/state transitions and is used for confirmation. |
| Change variant after a manual edit | Edited field is preserved unless the user explicitly elects to reapply parsed values. |
| Unsupported/malformed URL | Clear message and immediate manual-entry fallback. |
| Fetch/parser/source failure or timeout | Recoverable failure state; no blocked flow; manual fallback works. |
| Existing manual-only path | No regression. |
| Confirmed RimSpec → downstream fitment | Current fitment path receives the confirmed canonical spec, not an unreviewed parser payload. |

At least one automated E2E path must cover successful URL → variant/SKU → review → confirmation → fitment handoff, and at least one must cover parser failure → manual completion → fitment handoff.

## Acceptance criteria

- [ ] New branch/worktree is based on a recorded, current `origin/staging` commit.
- [ ] No wholesale merge of `codex/robust-rim-url-parser` occurred.
- [ ] Validated parser logic is selectively integrated and existing staging functionality remains intact.
- [ ] Backend/API has a tested structured contract for success, multiple variants, partial values, and failures.
- [ ] Multi-variant products require intentional user choice; no arbitrary first-SKU selection.
- [ ] Parser data pre-fills the canonical RimSpec state and is visibly reviewed before downstream use.
- [ ] Manual edits are authoritative and survive relevant state changes.
- [ ] All parse failures have a working manual fallback.
- [ ] Relevant parser regressions, application tests, lint/type checks, and E2E tests pass.
- [ ] No production deployment, `main` merge, or production configuration change was made.
- [ ] Final notes document supported sources, deferred limitations, test commands/results, and follow-up items.

## Completion record (fill before handoff/PR)

```text
WORKSTREAM_STATUS: READY_FOR_STAGING_REVIEW

INTEGRATION_BRANCH: feature/parser-integration
BASE_BRANCH: origin/staging
BASE_COMMIT: 8054194a12d0eb4907fc1441853f8df45dd1a2d3 (docs: finalize analytics UTM handoff (#85))
PARSER_SOURCE_BRANCH: codex/robust-rim-url-parser
SELECTIVELY_PORTED_COMPONENTS:
- deterministic structured-document extraction: JSON-LD Product/ProductGroup/variants,
  embedded JSON, microdata, labelled HTML fields, and bounded marking parsing
- variant/SKU reconciliation and conflict-safe response values
- existing SSRF-safe public HTTPS fetcher and current staging endpoint/UI were retained

API_ENDPOINT_OR_SERVICE: POST /jobs/{job_id}/fitment/rim-source/resolve
API_CONTRACT_DOCUMENTATION: RimSourceResolveResponse now includes variants[], selection_required,
  and selected_variant_sku; response remains an unpersisted review draft.
FRONTEND_ENTRYPOINT: webapp/index.html + webapp/app.js fitment rim-source flow
CANONICAL_RIMSPEC_STATE: state.fitmentForm.rim → existing PATCH /jobs/{job_id}/fitment

SUPPORTED_SOURCES_VALIDATED: deterministic fixture/unit coverage for JSON-LD ProductGroup variants,
  labelled partial specs, and prior public-URL resolver regression cases.
UNSUPPORTED_OR_DEFERRED_SOURCES: live retailer E2E and Render-origin Kolesa Darom fetch smoke.
KNOWN_LIMITATIONS:
- No production deploy or live retailer probe was run in this workstream.
- Multi-variant values are intentionally not persisted until the user selects a variant and confirms
  the normal fitment form.

TESTS_RUN:
- .venv/bin/python -m pytest -q
- .venv/bin/python -m ruff check .
- .venv/bin/python -m ruff format --check .
- node --check webapp/app.js
- git diff --check
TEST_RESULTS: 230 passed, 3 skipped (10 existing httpx deprecation warnings)
E2E_RESULTS: deterministic API/frontend-flow regressions are covered; live staging/Telegram E2E is deferred
  because this workstream must not deploy or change production infrastructure.
LINT_TYPECHECK_RESULTS: all checks passed

MANUAL_OVERRIDE_VERIFIED: YES (variant selection fills only fields not manually edited)
MANUAL_FALLBACK_VERIFIED: YES (existing recoverable resolver error and manual form path retained)
MULTI_VARIANT_SELECTION_VERIFIED: YES (API and resolver regression coverage; no arbitrary first-SKU selection)
PRODUCTION_CHANGES_MADE: NO

PR_URL: not opened
REVIEW_NOTES: ready for review into staging; confirm in a staging Mini App before release.
NEXT_OWNER / NEXT_ACTION: review diff, then execute staging-browser/Telegram E2E without production rollout.
```

## Stop condition

Stop when the acceptance criteria and completion record are complete and the changes are ready for review into `staging`. Do not broaden the workstream into source expansion or production rollout. If current staging architecture creates a material product/API decision that cannot be resolved from existing conventions, document the alternatives and request direction before making that product decision.

## Final verification audit — 2026-08-20

**Verification branch:** `feature/parser-integration-final-verification`
**Verification base:** `origin/staging` at `46a8133` (`fix: clarify selected vehicle choice (#88)`)
**Integrated parser commit in staging:** `c565ec0` (`feat: integrate rim URL parser variants (#87)`)

### Confirmed before live E2E

- The parser was selectively integrated; no wholesale merge of `codex/robust-rim-url-parser` was used.
- The current authenticated endpoint is `POST /jobs/{job_id}/fitment/rim-source/resolve`.
- Its response carries `values`, `variants`, `selection_required`, and `selected_variant_sku`; the response is an unpersisted review draft.
- The canonical persistence path remains `state.fitmentForm.rim` → `PATCH /jobs/{job_id}/fitment`.
- Automated resolver/API regressions cover structured multi-variant output, preserve `selected_variant_sku: null` when selection is required, and assert that no first SKU is selected arbitrarily.
- The frontend keeps a parser error recoverable: the manual fitment form remains available, and no recognised values leave the source entry open for manual completion.
- Local staging-branch verification completed before merge #87: `230 passed, 3 skipped`, Ruff checks, `node --check webapp/app.js`, and `git diff --check`.

### Browser verification completed

- Chrome staging smoke: public staging loaded and the create/fitment UI rendered.
- Computer Use confirmed the active Chrome staging surface.
- Guest/demo fitment flow: manual RimSpec editing was exercised; changing ET to `37` displayed the saved state. This is evidence for the manual editor only, not for parser persistence.
- Mobile check at `390px` completed with no observed horizontal overflow in the visible fitment flow.

### Still required for acceptance

- Authenticate in staging and open a completed non-demo job.
- Resolve a real supported product URL through the live endpoint and verify the single-variant path.
- Resolve a real multi-variant URL; select a SKU and verify the selected values in RimSpec.
- Change a parsed RimSpec field, confirm it, resolve/select again, and verify that the manual value remains authoritative and reaches downstream fitment.
- Exercise a live resolver failure and verify manual continuation.
- Classify the «Колёса Даром» result from the staging/render network as `FETCH ISSUE` or `PARSER ISSUE`; do not infer it from the historic local 401.

### Live staging blocker discovered

- A real authenticated Chrome session (`@nick_elixir`) opened completed job `582f34da-6836-4267-b26b-cba5ffea5af9` and then selected **«Проверить совместимость»**.
- Chrome DevTools captured `GET /api/backend/jobs/{job_id}/fitment` returning Vercel `404` with `x-vercel-error: NOT_FOUND`; the response body was Vercel's `The page could not be found`.
- This failed before the Render backend and before the parser resolver. It is a **Vercel jobs/fitment routing issue**, not a parser or retailer-fetch result.
- The initial PR #89 approach used dynamic proxy function paths below `api/backend/jobs/[jobId]`. Both Vercel projects rejected that build because it conflicts with the existing `api/backend/jobs/[...path].js` catch-all.
- PR [#89](https://github.com/NickElixir/dream-wheels-ai/pull/89) now uses two scoped Vercel rewrites to static proxy handlers (`/api/fitment-proxy` and `/api/rim-source-resolve-proxy`). Those handlers call the shared backend proxy with the validated job ID and an explicit backend path.
- The revised configuration passed local `vercel build`, the focused automated suite (`79 passed`), targeted Ruff checks, Node syntax checks, and `git diff --check`. It is awaiting the two Vercel preview builds and then staging deployment; no production rollout is included.

```text
STAGING_FLOW_VERIFIED: NO
FITMENT_ROUTE_PROXY_IN_STAGING: PENDING_PR_89
LIVE_VARIANT_SELECTION_VERIFIED: NO
CONFIRMED_RIMSPEC_VERIFIED: NO
LIVE_MANUAL_FALLBACK_VERIFIED: NO
KOLESA_DAROM_RENDER_SMOKE: DEFERRED
READY_FOR_FITMENT: NO
```

### Staging E2E after PR #89 — 2026-08-20

- `staging` now contains PR #89 at `bed5c4c`; its staging Vercel deployment is ready.
- An authenticated Chrome/Computer Use session (`@nick_elixir`) opened completed job `582f34da-6836-4267-b26b-cba5ffea5af9`. `GET /api/backend/jobs/{job_id}/fitment` returned `200` and `PATCH /api/backend/jobs/{job_id}/fitment` returned `200`; the former Vercel `404` is resolved.
- A real «Колёса Даром» URL reached `POST /api/backend/jobs/{job_id}/fitment/rim-source/resolve`. Vercel recorded backend response `422`, classifying the retailer outcome as a fetch/access failure rather than a Vercel route failure.
- The deployed UI remained in the resolving state after that `422`, leaving rim fields disabled. This violates the manual-fallback acceptance criterion. Local fix `2f0e4ee` adds a 20-second client-side abort and always restores manual fields in `finally`; it has not yet been deployed to staging.

```text
FITMENT_ROUTE_PROXY_IN_STAGING: YES
KOLESA_DAROM_RENDER_SMOKE: FETCH_ISSUE
LIVE_MANUAL_FALLBACK_VERIFIED: NO (awaiting deployment of 2f0e4ee)
READY_FOR_FITMENT: NO
```

### Phase closure — 2026-08-20

- PR [#90](https://github.com/NickElixir/dream-wheels-ai/pull/90) deployed the resolver-timeout recovery to `staging` as commit `47c5009` (`fix: restore manual rim entry after resolver timeout (#90)`). Its staging deployment `dpl_G8EvSqmfCDEcF9QZcdxpGCgUSYox` is `READY`.
- The merged client guard aborts an unresolved rim-source request after 20 seconds and, in all completion paths, restores the existing manual RimSpec form. It does not change parser extraction, fitment rules, or production configuration.
- A final authenticated Chrome/Computer Use staging pass reopened job `582f34da-6836-4267-b26b-cba5ffea5af9` after the real resolver failure. The UI showed the recoverable message *«Не удалось извлечь параметры автоматически. Проверьте ссылку или заполните поля вручную»*; brand, model, SKU, PCD, diameter, width, DIA, and ET inputs were all enabled. The user can therefore continue manually instead of being stranded in a loading state.
- Existing automated resolver/API/UI regression coverage remains the evidence for single- and multi-variant response handling, safe partial values, no arbitrary SKU choice, and authoritative manual values. The previous staging smoke confirmed the authenticated `GET`/`PATCH` fitment route, manual ET saving, and a 390px visible-flow check without horizontal overflow.
- The live «Колёса Даром» request returned backend `422`. This is recorded as a deferred **FETCH_ISSUE** (retailer access/fetch environment) and is explicitly excluded from phase closure. No adapter, scraping, browser/OCR/LLM fallback, or production rollout was added.

```text
PHASE_STATUS: COMPLETE
FINAL_STAGING_BRANCH: staging
FINAL_STAGING_COMMIT: 47c50094ee14c31b602291ccd0fd65bbf60acb38
FINAL_INTEGRATION_BRANCH: fix/rim-source-manual-fallback (merged by PR #90)
PARSER_SOURCE_BRANCH: codex/robust-rim-url-parser (selective port only; no wholesale merge)

API_USED: POST /jobs/{job_id}/fitment/rim-source/resolve
CANONICAL_CONFIRMED_RIMSPEC: state.fitmentForm.rim -> PATCH /jobs/{job_id}/fitment
VARIANT_POLICY: selection_required prevents arbitrary first-SKU selection

TARGETED_VALIDATION: 79 passed; targeted Ruff and format checks passed; node --check webapp/app.js passed; git diff --check passed
STAGING_ROUTE_PROXY_VERIFIED: YES
MANUAL_EDITOR_AND_OVERRIDE_VERIFIED: YES
LIVE_FAILURE_TO_MANUAL_FALLBACK_VERIFIED: YES
MOBILE_390_VISIBLE_FLOW_VERIFIED: YES
LIVE_KOLESA_DAROM_RESULT: DEFERRED_FETCH_ISSUE (HTTP 422; non-blocking)
PRODUCTION_CHANGES_MADE: NO

READY_FOR_FITMENT: YES
PARSER_INTEGRATION: READY
```

**Deferred follow-up (outside Workstream 06):** investigate Render/backend retrieval of «Колёса Даром» only if that retailer is needed for a later release. It is an environment/source-access investigation, not a parser-core change.
