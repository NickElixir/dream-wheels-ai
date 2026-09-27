# PR4 — VNext Processing / Result / History / Feedback

Base: `origin/staging`, `2ed4df7f827eaa06a09203b9912be32274e13e61` (includes #203, #204, #205; re-fetched before commit).
Branch: `feature/vnext-render-result-history`. Final commit/check identity is recorded in the PR and handoff, not self-referenced in this committed report.

## Architecture and scope

`window.dreamwheelsRenderBridge` projects the existing `state`, immutable job snapshots, asset maps and feedback maps. `webapp/vnext/views/render.js` receives snapshots and delegates commands; it has no API client, persistent store or timer. Existing `submitJob`, `loadRenderHistory`, history polling, `openRenderDetail`, `submitHistoryFeedback`, `downloadResult` and `openFitmentView` remain authoritative.

- Processing observes queued/processing/completed/failed from the existing submission/poll lifecycle. No percentage or simulated provider stages.
- Completed routes to the existing result-detail view. Navigating away does not cancel the server job or allow its completion to hijack another screen. Replacing/resetting Create invalidates late responses by existing draft/job IDs.
- Result and historical detail share one presentation. Historical selection only changes `renderDetailJobId`; current `jobId`/`createJobDraftId` are not overwritten. Returning to the retained Create result projects its current job, not the last historical selection.
- History preserves server ordering, deterministic date labels, historical `render_input_snapshot` and per-job assets. It uses the existing single history refresh timer.
- Both originals and results support the existing authenticated fetch/blob asset route. A failed asset remains an asset failure, not a failed render. Retry can recover through the protected route. Download accepts a job-specific context without mutating Create; a missing historical job never falls back to the current job.
- Feedback retains existing optimistic update/rollback, PUT/DELETE toggle behavior, supported reason codes, duplicate-submission guard and server persistence. Retry stores only the failed command in the runtime, not a parallel feedback record.
- Hidden legacy controller hooks remain. Scoped CSS suppresses corresponding visible legacy surfaces; unmount restores the legacy boundary. Result updates patch DOM in place, preserving media, slider, focus and scroll.
- Generation retry uses the existing Create error action; no job-ID reuse/retry endpoint is invented. Failed History retry returns to the existing Create upload/review surface, retaining files/draft/current job and without submitting a render automatically. Empty History's new-Create action uses the existing reset controller.
- Reload remains the existing boot/restore behavior: no new persistent client authority and no automatic generation/feedback/Fitment submission.

Backend, API payloads, DB, auth/session, credits/refunds, payments, Fitment presentation/semantics and production were not changed. PR5 was not started. The accepted PR3B no-store deviation remains unchanged.

## Automated verification

- `npm --prefix webapp test`: **122 passed**, including 23 new render tests.
- Gateway, vehicle catalogue, Fitment transitions and webapp boot Node suites: **52 passed**.
- `pytest -q`: **573 passed, 5 skipped**, 13 existing deprecation warnings.
- `npm --prefix webapp run build`: pass; generated auth bundles unchanged.
- `ruff check .`, `ruff format --check .`, Python compile, JS syntax and `git diff --check`: pass.
- CI must be checked on the final pushed HEAD; see the PR checks and final handoff.

Focused coverage includes all three result adapters (`result_url`, `output_image_url`, `assets.result.url`), actual queued→processing→completed polling, failed flow, navigation-away completion, stale Create/detail responses, immutable history snapshots/missing specs, current-vs-historical Fitment handoff, feedback positive/negative/reason/busy/retry/server state, protected originals/results, isolated thumbnail failure/retry, historical download, missing-history download guard and download auth/404/network failures. All existing Create PR3A/PR3B suites remain green.

## Browser QA evidence and boundaries

Chrome, local origin `http://127.0.0.1:4173`, **1440×1000** and **390×844**. Temporary harness files are outside the repository and are not included in production.

Two distinct checks were performed:

1. Presentation fixture importing the actual shell and render views: queued/processing, Result, History completed/processing/failed, empty/error and Generation Error; mobile feedback/reason/slider interactions.
2. Actual `index.html`, `app.js` controllers and VNext bootstrap, with controlled API responses and disabled unrelated startup integrations: Create Image → queued/processing → Result → positive feedback → History → older Result → negative/reason → download → legacy Fitment. This is **not** an authenticated staging provider run.

Observed controller requests: one `POST /jobs/from-assets`, existing `GET /jobs/A` polling, `GET /jobs`, original-asset download, `PUT /jobs/A/feedback`, older-job feedback and `GET /jobs/older/download`. The browser downloaded a valid JPEG (632099 bytes, 1800×1012). Legacy Fitment received `/jobs/older/fitment`, while current Create remained A; no new Fitment contract was implemented. The controlled harness intentionally does not supply a complete Fitment response, so only the handoff, not a successful Fitment verdict, is certified here.

DOM stability proof: same result image and slider nodes after feedback/reason; slider stayed at 51; zero additional image load events; focus remained on the selected reason. No duplicate IDs or nested mounted roots were observed; only one feedback request per action. At 390px `document.documentElement.scrollWidth = innerWidth = 390`; the focused reason stayed above the bottom nav (718.7px vs 780px). No relevant console errors or framework overlay; visible meaningful content and assets loaded.

Screenshots retained outside Git in `/tmp/dw-pr4-qa.V93XPE/`: Processing, Result, History, empty/error, Generation Error and feedback, desktop/mobile. Exact viewport screenshots use Chrome CDP capture after layout settles; full mobile captures also cover below-the-fold actions.

## Frozen-design fidelity ledger

Read canonical HTML and inspected frozen desktop evidence with `view_image`, then inspected current rendered screenshots with the same tool.

| Comparison | Reference / result | Disposition |
| --- | --- | --- |
| Typography/canvas | IBM Plex Sans, cold graphite, 24px Result identity and restrained radii | Matched computed font and screenshots |
| Processing composition | 1.4fr/.6fr pair, 16:10 car stage, selected wheel and real status | Matched; corrected aside border/container during QA |
| Result composition | Image-led 16:9 desktop, square 390px comparison, near-white primary CTA | Matched; restored mobile image-before-primary order |
| History | Compact 190px desktop/92px mobile thumbnails, chronological date groups, calm status rows | Matched; corrected row borders/container during QA |
| Feedback semantics | Green positive, amber negative, supported reason chips | Matched; image/slider/focus retained during refresh |
| System states | Centered restrained empty/error container, existing generation classification | Matched structure; no unsupported refund promise |

Intentional adaptations required by the task: real queued wording; secondary download/Fitment/history utilities; actual available metadata/dates and runtime error copy; supported backend reason labels; unchanged existing shell/account content. Actual uploaded wheel backgrounds are preserved rather than fabricating a transparent wheel asset. Canonical HTML defines result-left/original-right labels; older cached evidence contains the earlier label ordering. The canonical interactive reference wins. No redesign of frozen authority was made.

## Final gate still outstanding

`STAGING_AUTHENTICATED_SMOKE = BLOCKED` for **this PR4 UI**, because this branch is not deployed to the authorized staging frontend; preview Telegram auth has the already documented origin constraint. The existing staging deployment cannot prove these new screens. No merge or staging/production deployment was performed to bypass this boundary.

Required next verification on a deployment of the reviewed PR4 HEAD: authenticated real generation→Processing→Result, protected download, feedback persistence after reopening, correct current/historical IDs, and Result→existing Fitment. Until that is recorded, **`PR4_RENDER_RESULT_HISTORY = NOT READY`**; local/harness passes must not be presented as a real authenticated staging PASS.
