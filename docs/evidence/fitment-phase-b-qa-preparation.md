# QA Phase A — Staging E2E Infrastructure & Test Data Preparation

## Result and scope

Infrastructure and real-provider inputs prepared. No Phase B mutations, Standard Check, paid render or final E2E verdict were executed. Existing Functional Phase A, UI, integration and deployment gates remain closed. Release readiness remains **BLOCKED BY STAGING E2E**.

## Runtime baseline

Verified 2026-10-01 22:07 UTC; [machine-readable runtime evidence](fitment-phase-b-runtime-baseline.json).

- Git `staging`: `d5c9d7e786a8d8abdcf12ac59e7d3c211b8dfaf1` (docs-only #242).
- Frontend and backend deployed SHA: `7ac81e2171cff69bd0ea02372a6ae920ff27a444`.
- Reviewed #245 head: `5000465cfc14bb24939c1aa70099774806bf9bc1`; runtime tree `031c04abdc9f9656627caa33e7c9f93b63f7251f`.
- CI `36927901802`: completed / SUCCESS at that exact runtime SHA.
- Frontend deployment: `dpl_BhEALDwj5vpBrmSS8DGPnadUxENu` (previous delivery identity); public `version.json` independently verified again.
- Backend deployment: `dep-davcsov9nhgc73fu80j0`, LIVE; backend and gateway health healthy. Initial backend request timed out, subsequent direct and gateway requests succeeded.
- `FITMENT_VERDICT_ENABLED`, `RIM_URL_RESOLVER_ENABLED`, `VEHICLE_IDENTITY_ENABLED`, `WORKER_ENABLED`: true; recognition provider: openai.
- No flag, runtime, auth, queue, production or schema changes.

## Disposable design

No existing safe public API constructs a Fitment job without render admission. Supported operator helper: `scripts/qa/fitment_context.py` (`create`, `inspect`, `reset`). It reuses canonical identity inserts and authoritative Fitment overview/currentness builders.

Creation inserts a dedicated **QA carrier job row** with terminal `failed`, `error_code=qa_context_no_render`, cost 0, `not_charged`, no completion/result/assets/provider task. This is not a completed-render stub. Vehicle is proposed Toyota Camry with no year or confirmation; Wheel is empty uniform with a fresh spec. All entities are newly owned and isolated. Marker: `render_input_snapshot.purpose=fitment_phase_b_qa`, versioned QA metadata and exact entity bindings.

Important accounting distinction: `jobs` is the existing carrier aggregate. Creation adds one row to this table, while adding **zero real image-render operations**. JSON reports both `total_job_envelopes` and `render_job_count` so this is visible rather than hidden. Real render count excludes only marked, terminal, zero-cost carriers with no render outputs/tasks. No worker/queue submission or credits service is invoked.

Reset model: **RECREATE**. Preserve old QA canonical values, checks and revisions; mark old metadata archived with replacement ID and create fresh isolated entities. No revision rewind or deletion. The marker is operator metadata, not a product-wide archival access lock: old IDs remain readable and technically editable. Always use the returned replacement ID. Repeating create with the same run UUID or reset on the same old context returns the existing target; reset the newest replacement for another fresh run. Refuse reset while its Check is queued/processing.

Guards: explicit staging; exact project/host/user/database/port allowlist; all DSN query/fragment overrides rejected; TLS verifies CA and hostname; prepared statements disabled for pooler. Only an existing identity can resolve an owner. Validate exact owner/marker/job state/entity binding and sharing (including front/rear rim specs); refuse arbitrary completed history. Mutations are transactional with owner advisory lock and balance-row lock; abort/rollback on credit, ledger, render or reservation drift. Inspect runs a PostgreSQL read-only repeatable-read transaction.

### Browser entry constraint and supported QA launch

Current VNext history only offers a render retry for failed jobs. Neither a normal history button nor `/app/fitment?job=...` opens these QA carriers. A naked `/app/fitment` also does not select the new ID. This constraint was observed in the browser, not inferred as working.

Use the existing deployed `dreamwheelsRenderBridge.action('fitment', contextId)` from the browser developer console after manual authentication. This is the same application controller used by the normal Fitment button. It navigates normally and sends the owned GET; it does not modify canonical values, bypass authentication, simulate provider data or change runtime files. Helper JSON supplies the guarded `browser_launch.console_command`. This is an **operator QA entry**, not a new public route. Re-run it after reload/context reset, since authenticated boot does not restore this selection reliably.

Verified launch for the final context in the existing owner's browser: real gateway `GET /jobs/cf66d1a9-0643-5ba6-9264-f8677c8718d2/fitment` returned **200**; UI showed Toyota Camry, required confirmation and empty Wheel. Only reachability/baseline was checked. No Save/Check was executed.

## Create / reset / inspect

From repository root, with existing operator credentials supplied outside git. `--from-render` reads connection settings only from fixed staging service `srv-d83e9duk1jcs73boeqa0`; it never prints credentials. Alternatively set `FITMENT_QA_DATABASE_URL` in the process environment; no general `DATABASE_URL` fallback.

Download the public Supabase CA to a local operator file. Its URL is the `prod` expansion of the official [Studio SSL certificate template](https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json). This shared root CA's `prod` filename is not a production database target. Keep certificate/hostname verification enabled, as described in [Supabase SSL documentation](https://supabase.com/docs/guides/platform/ssl-enforcement).

```bash
curl --fail --location \
  https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt \
  --output /tmp/fitment-qa-supabase-ca.crt

python3 scripts/qa/fitment_context.py create \
  --environment staging --owner-provider user_id --owner-subject 26 \
  --run-id "$(python3 -c 'from uuid import uuid4; print(uuid4())')" \
  --from-render --ca-file /tmp/fitment-qa-supabase-ca.crt

python3 scripts/qa/fitment_context.py inspect \
  --environment staging --owner-provider user_id --owner-subject 26 \
  --context cf66d1a9-0643-5ba6-9264-f8677c8718d2 \
  --from-render --ca-file /tmp/fitment-qa-supabase-ca.crt

python3 scripts/qa/fitment_context.py reset \
  --environment staging --owner-provider user_id --owner-subject 26 \
  --context cf66d1a9-0643-5ba6-9264-f8677c8718d2 \
  --from-render --ca-file /tmp/fitment-qa-supabase-ca.crt
```

Record/reuse the create run UUID for retry instead of generating another. Reset above consumes the recorded final baseline and returns new IDs; do not execute merely to inspect. Operators may also select an existing `telegram` or `supabase` provider subject; never put those subjects/session credentials into public evidence.

Browser launch for the current baseline, on the authenticated [Fitment page](https://dream-wheels-ai-webapp-staging.vercel.app/app/fitment):

```javascript
if (location.origin !== 'https://dream-wheels-ai-webapp-staging.vercel.app') throw new Error('Staging only');
window.dreamwheelsRenderBridge.action('fitment', 'cf66d1a9-0643-5ba6-9264-f8677c8718d2');
```

## Final baseline and side-effect proof

[Full sanitized server snapshot](fitment-phase-b-qa-baseline.json).

| Item | Value |
|---|---|
| Owner | Existing authenticated canonical user 26; resolved by read-only lookup of the refreshed Dashboard's owned job and matching balance; no account created |
| Context | `cf66d1a9-0643-5ba6-9264-f8677c8718d2` |
| Vehicle | `bb596dcf-420f-4689-891a-9d1f16053222`, revision 1; Toyota/Camry proposed; year/market null; unconfirmed |
| RimSetup | `0fc96de7-f5bb-4623-adc1-0af45c0b0dfd`, revision 1; uniform |
| Rim spec | `794f101d-63ae-4020-b0d7-e478573f155e`, revision 1; critical fields empty |
| Check | None; `is_current=false` |
| next_action | Server-derived `complete_vehicle_details` |
| Created | `2026-10-01T22:07:25.573479+00:00` |

| Step | Credits | Ledger records | Real render jobs | Reservations | Total job envelopes |
|---|---|---|---|---|---|
| Before create | 31 | 101 | 44 | 0 | 44 |
| Create first QA carrier | 31 | 101 | 44 | 0 | 45 |
| Inspect | 31 | 101 | 44 | 0 | 45 |
| Recreate replacement | 31 | 101 | 44 | 0 | 46 |
| Final inspect | 31 | 101 | 44 | 0 | 46 |

Old QA carrier `83379c21-d1bc-5eff-a7e9-96eb14a647b6` is archived in metadata and retained. Credit delta 0; real-render delta 0; reservation delta 0. Queue calls: zero by code path, with Redis access traps in tests; this is not a claim of a global queue audit across other users. Both carriers remain visible as failed rows in this test account's history.

## Real inputs

[Registry, licenses, actual market IDs/labels, SKU details, decimal value and failure classifications](fitment-phase-b-test-inputs.md). V1/V2/W1/W2/W3 use real provider data. W1/W3 lack automatic diameter/width extraction; W2 emits brand/SKU without technical values. These limitations must remain visible to the reviewer; do not invent provider values. Catalogue/provider qualification does not prove authenticated staging resolver or recognition behavior.

## Independent Phase B runbook

Use an existing manually authenticated test-account session; never paste tokens/cookies into reports. Website requests use existing application bearer authentication through the gateway `/api/backend`; Telegram uses normal Mini App auth. No new auth flow is supplied. Before starting, recheck runtime SHA and inspect the current replacement. Do not mutate any historical completed context.

### A — Baseline

Launch the exact context with the QA entry command. In browser Network confirm `GET /api/backend/jobs/<context>/fitment` returns this ID and compare with helper JSON. Assert Vehicle unconfirmed/incomplete; Wheel empty; revisions 1/1/1 **for this recorded baseline only**; no Check; authoritative next_action. Capture sanitized request/response/screenshots without auth headers. After recreate read fresh revisions, never assume them.

### B — Wheel-only Save

Use W1/W3 while Vehicle remains incomplete. Add URL through UI (`POST /jobs/<context>/fitment/rim-source/resolve`, body `{ "product_url": "<registry URL>" }`), inspect actual proposals. Fill missing diameter 20 and width 8.5 manually; confirm all five critical fields. Enter ET as `35,5` and then `35.5` on a fresh run; verify JSON numeric 35.5 without rounding. Save only Wheel through UI (`PATCH /jobs/<context>/fitment`). Compare Vehicle canonical values/provenance/provider mappings and revision before/after exactly; Wheel/setup revisions advance; no Check auto-created. next_action may still request Vehicle and must not block this Save. Also test W2 Cancel and A→B invalidation in a separate recreated run.

### C — Vehicle completion

Use V1 manual selection and separately V2 recognition/manual plus conditional Market. Change photo via existing Vehicle photo controls if testing recognition; the QA carrier has no original asset. Do not expect recognition to work until a photo is selected. Obtain fresh exact variants for the chosen region and explicitly confirm. Wheel canonical values/revisions remain unchanged. Both branches ready ⇒ server next_action `run_standard_check`. No label-based market deduplication in test setup.

### D — Standard Check

UI action admits `POST /api/backend/fitment/checks` with fresh `Idempotency-Key`, canonical Vehicle/RimSetup IDs, render_job_id equal to context, trigger `user_requested`, mode `standard`. Poll `GET /api/backend/fitment/checks/<check_id>`. Observe queued→processing→completed or explicit failed; fast execution may skip an observable intermediate state. Repeating the same admission key must not create another Check; concurrent/duplicate admission behavior must follow existing tests/server response, not assumed client disabling. History: `GET /api/backend/fitment/checks?vehicle_identity_id=<vehicle>&rim_setup_id=<setup>`.

### E — Dirty / stale / recheck and draft mismatch

After completed Check, change ET locally from 35.5 to 36.5: local dirty must not stale canonical current result. Save the changed value with fresh expected revisions and confirmation: old Check becomes historical/stale, old evidence stays readable. Recheck produces new current Check.

For mismatch: open same context in two authenticated tabs; create an unsaved draft in tab A; tab B saves canonical ET with its current expected revisions. Reload A and re-launch the same context; stored draft with mismatched revision must be discarded. Second-tab UI uses supported `PATCH /jobs/<context>/fitment`; no direct DB mutation, revision rewind or artificial client next_action. If editing raw requests, replay a freshly captured **Wheel-only** payload with only intended Wheel changes; request contract requires `expected_vehicle_revision` and `expected_rim_revision`. Never copy old revisions or add `vehicle` updates to a Wheel-only request.

### F — Render independence without spending

At incomplete inputs, dirty input, queued/processing Check, incompatible/unknown/conditional verdict and stale result, inspect `Create Image` availability and its navigation behavior. `FITMENT_VERDICT != RENDER_PERMISSION`: ordinary image requirements can still apply (photos, consent, balance). The QA carrier has no photos, so do not confuse image-input requirements with a Fitment verdict restriction. Inspect the normal Create form state after supplying test inputs only if needed; **never submit paid render admission**. Record raw credit/render counters before/after via inspect. No backend dry-run admission endpoint is claimed; do not call `/jobs`, `/jobs/upload` or `/jobs/from-assets` as a probe.

### Async/navigation preparation

Use two QA contexts and switch while a real request is in flight; check no late response mutates the new context. Real-provider manual race = BEST EFFORT. AUTOMATED/CONTROLLED COVERAGE EXISTS in catalogue/transition/composition/check/focus suites. No delays, provider keys or timeout behavior are modified for this purpose.

## Browser checklist for Phase B (not executed here)

Run all at desktop 1440×1000, tablet 768×1024 and mobile 390×844:

- Recognition/manual; photo replacement; conditional Market; exact variant.
- URL resolver; explicit multi-SKU; Cancel; A→B invalidation; conflict resolution.
- Five confirmations; comma/dot decimal ET; independent Save; uniform/staggered.
- Standard Check lifecycle/results; dirty versus stale; historical evidence; recheck.
- Failure/recovery; cross-tab draft mismatch; navigation races as best effort.
- No horizontal overflow, application console errors or `InvalidStateError`; meaningful focus restoration.
- Record precise runtime/context IDs and sanitized network evidence per case; report unsafely reproducible failure paths separately.

Browser reachability is ready through the documented QA bridge command. Ordinary no-console failed-job entry is unavailable. The owner browser was left on the disposable Fitment baseline; canonical values were not edited.

## Telegram preparation

READY configuration: `@dream_wheels_ai_staging_bot`, `getMe` successful; menu `Open Staging App` points to `https://dream-wheels-ai-webapp-staging.vercel.app/t/`; configured WEBAPP_URL is staging. No configuration changed. Native Telegram access/session and final Mini App QA remain unverified; Phase B owner must open that existing bot/menu manually. The QA bridge launch can be executed by reviewer tooling within an authenticated Mini App WebView; no direct query route is invented.

## Verification

- QA tooling: 21 PASS including real isolated local PostgreSQL schema, idempotency, ownership/sharing rejection, unrelated-history preservation, read-only enforcement, transaction rollback on injected credit side effect, create/inspect/recreate and positive revisions.
- Backend suite: 633 PASS / 5 skipped, including the local PostgreSQL test.
- Frontend: 194 PASS; catalogue/transition/composition/focus/boot subset: 107 PASS; build PASS.
- Ruff lint/format and diff check: PASS.
- CI adds isolated PostgreSQL service test so create/reset/inspect are not silently skipped in CI. No staging/production DSN is used in this test.
- Live create/inspect/recreate: measured in table above; actual owned browser GET 200 and baseline visible.
- No Phase B Save, Check, paid image generation or final E2E claimed.

## Remaining gates

Independent reviewer must execute authenticated A–F, responsive/browser/Telegram QA and revalidate real-provider responses. There is no ordinary UI entry button for the terminal QA carrier; use the supported operator launch above. Full release readiness remains **BLOCKED BY STAGING E2E**.
