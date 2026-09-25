# Dream Wheels AI — VNext runtime implementation map

**Audit date:** 2026-09-25  
**Scope:** documentation only; no runtime code was changed.  
**Runtime implementation target:** `staging` at `29415ac318cda1f45a5981d082a220575e9ff66b`.

## Decision and authority

`staging` is the implementation baseline.  It contains `origin/main` (`75b0490`) plus the current application runtime: Auth V1.1/account linking, wallet polish and payment-return routing, confirmed-vehicle Fitment state machine, renderer/provider work, and the latest dashboard fixes.  `origin/main` must not be used as the implementation source without first merging/rebasing those changes.  The local checkout has no local `main` branch; comparisons in this document mean `origin/main..staging`.

The requested VNext design authority is frozen, and this map treats it as immutable.  The named VNext design/reference/QA files and freeze commit objects were not present in this runtime checkout during the audit; the VNext state names below are therefore the supplied frozen contract, not recreated fixtures.  Before implementation, add/access those artifacts in the implementation worktree and validate screen wording/geometry against them.  This is a **documentation availability gap**, not a reason to change any domain contract.

Non-negotiable boundary:

```text
Fitment verdict != render permission
Fitment execution failure != unknown verdict != render permission
```

`/jobs/from-assets` may create a render from a resolved/confirmed identity draft; neither the client nor `jobs_api.py` requires a successful Fitment check.  VNext must preserve that independence.

## Actual runtime architecture

```text
index.html + style.css
        |
webapp/app.js single mutable `state` + DOM render functions
        |-- Telegram initData OR browser JWT (webapp/auth/app-auth.js)
        |-- IndexedDB draft files; local/session storage UI draft/context
        |-- /identity/resolve -> identity draft/proposal
        |-- /jobs/from-assets -> render job -> Redis worker -> storage/result
        |-- /jobs/{id}/fitment + /fitment/checks -> Wheel-Size/rules
        `-- /payments/* -> Robokassa + credit ledger
                         |
 FastAPI: main.py routers -> PostgreSQL/Supabase, Redis, object storage,
                         generation provider, Wheel-Size and Robokassa
```

| Runtime module | Owns / responsibility | API and consumers | VNext classification |
|---|---|---|---|
| `webapp/index.html`, `webapp/style.css` | Current static surfaces and CSS visual system | all browser screens | **REPLACE** presentation, retain semantic hooks only if useful |
| `webapp/app.js` | All app state, navigation, DOM rendering, request orchestration | every frontend API | **ADAPT**; currently heavily coupled, split feature controllers/view renderers incrementally |
| `webapp/auth/app-auth.js`, `webapp/auth/supabase-client.js` | Website JWT/session bootstrap and OTP UI support | `/auth/telegram/*`, Supabase | **KEEP/ADAPT** logic; replace auth presentation |
| `webapp/api/backend-gateway.js`, `webapp/lib/backend-proxy.js` | website-to-backend gateway and origin/auth boundary | all browser API calls | **KEEP** |
| `src/identity_api.py`, `src/identity_service.py` | upload normalization, VLM identity draft and confirmed vehicle/rim identity | `/identity/resolve`; `/jobs/from-assets` | **KEEP** |
| `src/jobs_api.py`, `src/main.py` | render-job persistence, queue, status/history/assets; worker lifecycle | `/jobs/*` | **KEEP** |
| `src/fitment_checks_api.py`, `src/fitment/*` | confirmed snapshots, execution state, verdict/evidence | `/fitment/checks`, `/jobs/{id}/fitment*` | **KEEP** |
| `src/credits_service.py`, `src/payments_*.py`, `src/robokassa_client.py` | ledger, packages, invoices, provider callbacks | `/payments/*` | **KEEP** |
| `src/assets_service.py`, `src/storage.py` | durable source/result assets and access URLs | jobs/history/download consumers | **KEEP** |

### State ownership and persistence

The browser owner is one `state` object in `webapp/app.js:1127-1262`; it includes view/menu, Create files and identity proposal, render/history/detail, Fitment form/overview/check/polling/catalogue, wallet/payment, and feedback maps.  This is not a domain store: authoritative entities are server-side.  Persisted client-only data is deliberately limited:

- raw Create files: IndexedDB `dream-wheels-upload-draft` (`saveDraftFile`/`hydrateFilesFromDraft`);
- photo consent and website session: local storage;
- Fitment navigation/transient form/catalogue memory: session/local storage with version/TTL;
- backend: users, identity drafts/snapshots, jobs/assets, fitment checks/evidence, payment/credit ledger.

Do not make a VNext UI cache authoritative.  In particular, preserve `render_input_snapshot` and Fitment check snapshots as historical records, while current editable identity/rim state remains server-owned.

## Contract map by frozen surface

All entries replace the old visual composition. “Tests” names existing coverage; migration tests are required additions or rewrites at the VNext boundary.

| VNext state | Current entry / exact sources | Preserve | Replace/adapt and required tests | Risk |
|---|---|---|---|---|
| Dashboard | `setView`, `renderDashboard`, `loadDashboardData` (`app.js:6567,7696,7924`); `index.html:57` | auth-aware balance and recent data requests | VNext shell/dashboard. Test initial loading, unauthenticated CTA, authenticated refresh. | M |
| Create: vehicle/wheel edit, previews | `showCreateScreen`, `handleFileSelected`, IndexedDB helpers, `renderIdentityFlow` (`app.js:8402,8125,8308,9125`) | File/Blob handling, consent, preview geometry, recoverable drafts | VNext vehicle/wheel preview and fields. Test reload draft recovery and file clear/reselect. | H |
| Create: source URL / parser load-success-error-manual recovery | `state.rimProductUrl`, `resolveIdentity` (`app.js:8570`); source resolver for Fitment `resolveFitmentRimSource` (`5925`); `src/rim_url_resolver.py` | Product URL carried in identity request; Fitment resolver variants/conflicts and manual fields | VNext source input/status/recovery; do not imply that Create has a separate public parser endpoint today. Test timeout, conflict, manual continuation. | H |
| Create: identity resolution / create readiness | `resolveIdentity`, `selectedVehicleCandidate`, `selectedRimProposal`, `refreshButtonsForCurrentView`; `identity_api.py:resolve_identity` | Explicit vehicle selection; `draft_id`; resolved identity and confirmation boundary | VNext form presentation and CTA hierarchy. Test missing consent/files, provider error, proposal selection, manual vehicle. | H |
| Processing | `submitJob` polling loop (`app.js:8819`), `process_render_job` (`main.py:335`) | idempotency key, queued/processing/completed/failed semantics and credit reservation | VNext processing view/progress copy; test queued→processing→completed and cancel/navigation/reload behavior. | H |
| Result + positive/negative feedback | `openRenderDetail`, `renderRenderDetail`, `submitHistoryFeedback` (`7524,7490,7347`); `jobs_api.py:4417-4519` | result/original assets, download/share, feedback sentiment/reason persistence | VNext result/media/feedback. Test asset 404, like, dislike+reason, retry failure. | M |
| Generation error | `classifyGenerationError`, `refreshExistingJobStatus` (`app.js:8950`); `main.py:_mark_render_failed` | server error code/message and refund behavior | VNext error state; test insufficient credits, queue error, provider failure and no fake “unknown”. | H |
| History: empty/completed/processing/failed | `requestRenderHistory`, `renderRenders`, detail polling (`7889,7590,7640`); `jobs_api.py:2577,2646` | chronological job data, snapshot, assets, feedback, status | VNext archive rows/details. Test empty, status refresh, failed row, protected assets. | M |
| Fitment: entry/edit/snapshot | `openFitmentView`, `loadFitmentOverview`, `saveFitment` (`5771,5685,6400`); `jobs_api.py:2775,3727` | vehicle/rim revisions, confirmed variant requirement, independent rim/vehicle mutation boundaries | VNext Fitment composition. Test stale drafts, vehicle variant reselection and re-open. | H |
| Fitment: parser/candidates/manual | `resolveFitmentRimSource`, `renderFitmentCandidates`, variant APIs (`5925,2702,6010-6365`) | resolved variants, provenance, conflicts, manual recovery | VNext source/evidence UI. Test resolver error/retry and field provenance. | H |
| Fitment: processing/compatible/conditions/unknown/incompatible | `runFitmentCheck`, `pollFitmentCheck`, `renderFitmentV2Result` (`6307,6277,4597`); `fitment_checks_api.py:332-742`; `fitment/rules/verdict.py` | `queued/processing/completed/failed`; four verdict taxonomy, checks/evidence/currentness | VNext verdict and technical-evidence patterns. Test every verdict plus operational failed separately. | H |
| Balance / balance error | `loadCabinet`, `renderWallet` (`7932,6763`); `payments_api.py:71` | balance, FIFO credit packages/expiry, starter grant | VNext balance and error/loading surfaces. Test empty package, expired credits, unauthorized/read failure. | M |
| Payment pending/paid/failed | `createPayment`, `handlePaymentReturn`, timer (`8051`); `payments_api.py:99,126,164,229`; `payments_service.py` | package/amount/email validation, Robokassa URL, status and ledger application | VNext checkout/status/history. Test return success/fail, pending refresh, provider configuration failure. | H |
| Login / OTP / restoring / expired | `loginWithTelegram`, `loadWebsiteAuth`, `clearWebsiteAuthSession`, auth bundle (`2269,2110-2168`, `webapp/auth/app-auth.js`); `auth_api.py` | Telegram and browser/JWT modes; gateway authorization header | VNext auth shell, OTP states and expiry prompt. Test email OTP restore, Telegram cancel/timeout, expired session. | H |
| Support / Photo Guide / Documents / legal | static views `index.html:889,951,982`, `setView`; `tests/test_webapp_legal_links.py` | destinations and legal/support copy | VNext static layouts/navigation. Test all links and mobile accessibility. | L |

### Required semantic details

- Fitment's executable taxonomy is `compatible`, `compatible_with_conditions`, `unknown`, `incompatible` (`src/fitment/schemas.py:81-85`). The VNext compatible and conditional screens can map directly, but must never turn `unknown` or an execution failure into either positive state.
- A Fitment operational failure is `execution_status=failed` with `error`/`retry_mode` (`fitment_checks_api.py:569-742`), never a verdict. Preserve the distinct VNext failure state.
- The active Create path is `POST /identity/resolve` then `POST /jobs/from-assets` (`app.js:8726,8819`), not legacy `/jobs/upload`. The legacy endpoints remain supported and must not be deleted as part of VNext without a separate deprecation decision.
- Session restoration bootstraps credentials/UI and can restore a Fitment navigation context, but does not automatically replay identity resolve, product parser, Fitment execution, payment creation, or render creation (`app.js:9750-9805`). Keep that behavior.

## API and lifecycle preservation map

| Flow | Client request(s) | Server owner | Invariant |
|---|---|---|---|
| Auth | `GET /auth/telegram/nonce`, `POST /auth/telegram/verify-id-token` | `src/auth_api.py`; browser auth modules | preserve Telegram/JWT identity boundary |
| Identity | `POST /identity/resolve` multipart | `src/identity_api.py:75`, `identity_service.py` | selection/confirmation produces a draft; no UI-derived identity mutation |
| Render | `POST /jobs/from-assets`; `GET /jobs/{id}`; `GET /jobs`; downloads | `jobs_api.py:2266,2577,2646`; `main.py:335` | reserve at create, finalize on success, refund failed/queue-publish failure |
| Fitment | `GET/PUT /jobs/{id}/fitment`; resolver/catalogue/variant routes; `POST/GET /fitment/checks` | `jobs_api.py:2775-3727`; `fitment_checks_api.py` | snapshots/revisions/currentness and verdict vs execution distinction |
| Feedback | `PUT /jobs/{id}/feedback` | `jobs_api.py:4455` | feedback belongs to owned render job, sentiment/reason persist |
| Wallet | `GET /payments/cabinet`; `POST /payments/topups`; `GET /payments/{invoice}/status` | `payments_api.py`, `payments_service.py` | balance and package expiry come from ledger, not fixtures |

## Coupling audit and minimal extraction boundaries

`webapp/app.js` is a ~10k-line imperative application: many functions simultaneously select DOM, mutate `state`, issue `fetch`, encode navigation, and format business output.  The highest-risk examples are `submitJob`, `saveFitment`, `openFitmentView`, `requestCabinet`, `renderRenders`, and the Fitment renderer/controller region.  Do not perform a general rewrite first.

For VNext, introduce only these boundaries while retaining API payloads:

1. **API client/auth boundary:** centralize the existing `apiUrl`/`withAuthHeaders` behavior and typed response adapters; gateway semantics stay unchanged.
2. **Feature controllers:** Create/identity, render lifecycle/history, Fitment, wallet, and auth own async effects and expose explicit UI states.
3. **Presentation components:** receive view models/callbacks only; they do not construct authorization, call endpoints, or infer verdicts.
4. **Lifecycle adapters:** preserve polling timers/idempotency keys and cleanup behavior outside components.

## Shared VNext foundation, before screen migration

| Foundation piece | Treatment | Current source / constraint |
|---|---|---|
| Design tokens | **NEW** VNext token layer mapped to canvas, surfaces, text/subtle, CTA, semantic statuses, radius, border, focus, typography, safe areas, breakpoints | replace ad-hoc visual declarations in `style.css`; do not alter semantic status meanings |
| Shell | **REPLACE** desktop sidebar, mobile bottom navigation, topbar/page frame, auth shell | current `setView`/`data-nav` routing semantics can be adapted; Telegram safe area stays supported |
| Primitives | **NEW** minimal `Button`, `TextAction`, `Field`, `MediaStage`, `PageHeader`, `Island`, `StatusText`, `EvidenceList`, `ArchiveRow`, `Spinner`, `EmptyState`, `ErrorState` | views must remain data-driven and accessible |
| Create adapter | **ADAPT** | wrap existing file/identity/controller functions before replacing screen |
| Fitment adapter | **ADAPT** | map `FitmentOverviewResponse` and `CheckResponse`; no verdict recalculation in UI |
| Result/history adapter | **ADAPT** | map jobs/assets/feedback and preserve protected blob fetch |
| Wallet/auth adapter | **ADAPT** | map cabinet/session data; payment provider redirects remain outside components |

## Post-migration frontend architecture checkpoint

The VNext migration should **not** be used as a framework migration.  The current implementation strategy is to keep the existing browser technology generation (vanilla JavaScript/DOM and the current gateway/runtime) while introducing clearer ES-module/feature-controller/view-model/presentation boundaries.

After VNext reaches runtime/E2E parity and has gone through several subsequent releases, explicitly re-evaluate whether this approach is still scaling well.  The review should examine component dependency complexity, duplication versus effective reuse of UI primitives, cross-feature state synchronization, DOM/lifecycle cleanup complexity, testing friction, and the rate of UI regressions caused by coupling.

If those signals remain manageable, continuing with vanilla JavaScript is a valid outcome.  If they materially worsen, open a **separate architecture decision** for React or another component framework.  Such a migration is not pre-approved, is not required by the VNext contract, and must not be bundled into the current VNext UI migration.  It should happen only against a stable VNext behavior/runtime contract with its own migration, test and rollback plan.

## Gaps and decisions needed

| VNext requirement | Runtime support | Gap | Blocks screen implementation? | Treatment |
|---|---|---|---|---|
| Frozen Fitment state names | backend has the four named verdicts, plus separate execution state | evidence/check wording may not match frozen screen copy | No | bind to `CheckResponse`; keep execution failure separate from verdict |
| Dedicated Create product parser status | URL is sent with identity resolve; rich resolver is Fitment-side | no confirmed separate Create parser lifecycle | No | show only actual identity lifecycle, or make a separately approved backend feature |
| Full auth session restore screen | session exists, no dedicated restoring route/state | presentation gap | No | derive a transient UI state from auth bootstrap |
| Result/History exact VNext fields | jobs expose snapshots/assets/status, not arbitrary prototype fields | design may request unavailable data | Possibly | bind only documented response fields; label missing data rather than fixture it |
| Payment “paid” realtime state | return query plus cabinet/status refresh; no push channel | presentation must poll/refresh | No | retain bounded refresh/pending treatment |
| Real-device Telegram behavior | static/browser code supports Telegram APIs | no audit evidence in this checkout | No for implementation, yes for release | staging E2E on iOS/Android after shell migration |

## Migration sequence and PR plan

1. **PR 1 — VNext foundation and read-only adapters:** tokens, shell, primitives, typed API/view-model adapters; retain current routing and mount one non-destructive static/support page.  Tests: navigation, desktop/mobile, auth headers, visual regression baseline.
2. **PR 2 — Auth + Dashboard + static pages:** replace presentation only; validate session restore/expired paths and legal links.
3. **PR 3 — Create + identity:** migrate files, consent, identity proposals and confirmed draft creation.  Gate on upload/idempotency/reload regression tests.
4. **PR 4 — Render Processing/Result/History/feedback:** preserve polling, asset authorization, download/share and credit outcomes.
5. **PR 5 — Fitment:** migrate only after the adapter is proven with all execution/verdict states, source/manual recovery and stale snapshot tests.  This is the highest-risk PR.
6. **PR 6 — Balance/payments and old UI deletion:** preserve Robokassa return routing, ledger/package expiry, pending/failed semantics; delete legacy presentation only after VNext E2E parity.

No `DELETE AFTER MIGRATION` item is authorized in PRs 1–5.  Delete legacy HTML/CSS/render functions only after a release checklist confirms equivalent routes, protected asset access, all error states, and staging/real-device coverage.

## Acceptance gate for implementation

**READY, with one documentation preflight:** use `staging` as the runtime baseline and make the frozen VNext artifacts available in that worktree before PR 1.  The domain/API contracts are sufficiently identified to start the foundation work.  PR 1 must not change Fitment semantics, credits/payment rules, render lifecycle, auth/session behavior, identity persistence, or request/response contracts.