# P0-A implementation report — Create / Fitment boundary

## 1. Base and delivery

- Base: `origin/staging` at `00e2db4aca9e9b5d19344b70b0418b69f176b2e4` (PR #251 merge).
- Branch: `feature/p0a-create-fitment-boundary`.
- Worktree: `p0a-create-fitment-boundary`.
- Scope: P0-A only. No merge or staging deployment is part of this change.

## 2. Architecture and API

Create accepts a car photo, a wheel photo, optional wheel product URL, and photo consent. `POST /identity/assets` stores the two canonical original assets, plus the existing car display derivative, and marks the existing short-lived draft `resolved` once assets are durable. This reuses the existing draft schema and `/jobs/from-assets` idempotency, reservation, and render queue path. The upload endpoint performs no identity or URL resolution and creates no job or credit reservation.

`POST /jobs/from-assets` now accepts a draft and wheel URL without Vehicle or `vehicle_user_confirmed`. The compatibility fields remain accepted for older callers but do not create VehicleIdentity. A new job has `vehicle_identity_id = NULL`, `render_input_snapshot.vehicle = null`, and Vehicle revision zero. The rim setup remains independent and ready for later Fitment editing. The render worker still consumes `car_original` and `rim_original`.

Fitment availability is `status = completed AND rim_setup_id IS NOT NULL`. Its overview represents an absent VehicleIdentity with empty vehicle fields and revision zero. The first explicit, complete vehicle save validates the catalogue selection and creates VehicleIdentity, then attaches it to the job in one database transaction under a job row lock. An incomplete first save returns `vehicle_details_required`; Fitment Check still requires an existing confirmed VehicleIdentity.

The Create URL is stored in RimSpec. On first Fitment entry the frontend calls the existing rim source resolver once. The server atomically claims that automatic attempt in RimSpec provenance, scoped to owner, completed job, front rim, and matching URL. The overview exposes the claim. A failed attempt does not automatically repeat; a subsequent user action may call the resolver explicitly. No new resolver or migration was added.

The database already permits `jobs.vehicle_identity_id = NULL`; `vehicle_identities.make/model` remain required. No migration or placeholder VehicleIdentity was introduced.

## 3. Frontend

The Create assisted identity flow and its state, handlers, candidates, vehicle confirmation, and Create URL resolution were removed. The primary action stays visible and enables when car photo, wheel photo, and consent are present. Disabled feedback shows the first missing prerequisite. Result and History use confirmed canonical VehicleIdentity for vehicle names; otherwise they show a neutral try-on title. Completed Result exposes the compatibility action. Fitment shows “Автомобиль не указан” and “Указать автомобиль” when VehicleIdentity is absent. Recognition alternatives are limited to the recognition workspace and cleared after a choice.

## 4. Files changed

Runtime: `src/identity_api.py`, `src/identity_service.py`, `src/jobs_api.py`, `webapp/app.js`, `webapp/index.html`, `webapp/vnext/bootstrap.js`, `webapp/vnext/views/create.js`, `webapp/vnext/views/fitment.js`, `webapp/vnext/views/render.js`.

Tests: `tests/test_identity_api.py`, `tests/test_jobs_fitment_api.py`, `tests/test_cabinet_dashboard_static.py`, `tests/test_fitment_frontend_slice7.py`, `tests/test_release_configuration.py`, `tests/test_fitment_transition_behavior.mjs`, `tests/test_webapp_boot_behavior.mjs`, `webapp/auth/app-ui-static.test.js`, `webapp/auth/vnext-create-runtime.test.js`, `webapp/auth/vnext-create-static.test.js`, `webapp/auth/vnext-create-view.test.js`, `webapp/auth/vnext-fitment.test.js`, `webapp/auth/vnext-render.test.js`.

This report and the browser screenshots/transcript are in `docs/evidence/p0a-create-fitment-boundary/`.

## 5. Verification

| Check | Result |
| --- | --- |
| `python3 -m pytest -q` | 665 passed, 6 skipped |
| `npm --prefix webapp test` | 189 passed |
| `node --test tests/test_fitment_transition_behavior.mjs tests/test_webapp_boot_behavior.mjs` | 114 passed |
| `npm --prefix webapp run build` | Passed |
| `python3 -m ruff check` on changed Python runtime and tests | Passed |
| `git diff --check` | Passed |
| Local Playwright QA at desktop 1440px and mobile 390px | Passed; no page or console errors |

Browser QA exercised empty, car-only, car-and-wheel, and consent-ready Create states; URL storage without Create resolution; render request without Vehicle; neutral Result and Fitment CTA; missing-vehicle Fitment; one failed automatic URL resolve with no repeat on overview reload; and recognition alternative clearing after selection. It used a local frontend with mocked API responses and a fake completed job. Screenshots and request transcript are test fixtures, not evidence of a live staging deployment.

## 6. Known limits and follow-up

- Live staging Create → render → first Fitment save and legacy job checks require deployment of this branch; they were not claimed by local browser QA.
- The automatic URL resolver continues to honor the existing `RIM_URL_RESOLVER_ENABLED` feature flag. If disabled, the attempted claim is recorded and the call returns 503; an explicit retry becomes available when the feature is enabled.
- Existing jobs and old forced vehicle confirmations were left intact. The separate N-06 provenance audit and migration remain outside P0-A.
- No P0-B/P1/P2/P3 work, payment changes, or verdict engine changes were made.
