# Immutable shared-result publications

Approved flow, 23 October 2026. Implemented on `feature/shared-result-snapshots`.

- Completed Result: export group Download / Share; continuation group Check compatibility / Create another variant. Mobile export pair stays in one row, continuation stacks; narrow screens may stack export controls.
- Share posts authenticated `/jobs/{job_id}/publications`, then navigates directly to the returned `/p/{opaque_id}`. No separate status, open-link or copy-link UI on Result. During the request the button is disabled; failed requests can be retried.
- Publication: compact header with landing logo link, app sign-in link and structural horizontal header boundary. No sidebar, bottom navigation, footer branding or decorative content dividers.
- Public page: before/after slider, Copy link with in-button confirmation, Download generated image, vehicle and wheel facts. No compatibility verdict, seller contacts, prices or user/account fields.
- Same job and canonical snapshot returns the existing publication. Changed vehicle/rim facts produce a new random 192-bit ID. Old publication rows and independent private image copies remain intact. There is no delete/revoke UI or endpoint.
- Only the owning authenticated principal can publish a completed job. Public lookup is exact opaque ID, never a prefix of the job ID. Original and generated images are exposed only through publication asset endpoints; JSON, internal storage paths and account details are not exposed.
- Snapshot images are copied to private `raw/publications/{id}` objects, re-encoded as JPEG without EXIF, maximum 2400 px side. Download serves the publication's generated JPEG. Failed creations may leave unreferenced storage objects; no public row exists until both copies have uploaded.
- Existing `/s/{job-prefix}` links are preserved for backward compatibility. This change does not broaden the legacy route or automatically create new publications from status polling.

## Rollout

1. Apply additive migration `0041_shared_result_publications.sql` to staging **before** deploying the new backend writer. The number 0040 is reserved by parallel account-numbering work; do not renumber an applied migration.
2. Deploy backend including `src/templates/shared_result.html`. No schema or deployment was applied by this implementation task.
3. Verify PUBLIC_BASE_URL points to the externally accessible backend HTTPS origin, WEBAPP_URL to the application origin. Existing environment variables are reused. Public `/p` HTML and image routes are served by FastAPI; they require no app authorization gateway or frontend rewrite.
4. Deploy frontend. Use an owned staging job to publish, revisit twice, edit characteristics, publish again; old URL must retain its old metadata/images. Check desktop, mobile and a signed-out browser.
5. Verify link preview fetch from a messenger and physical-device download behavior before production release. Local API/browser evidence cannot validate Telegram WebView or external preview caches.

The public backend origin cannot inspect a separate application origin's session. Its header shows Sign in and links into the app, where the existing session decides whether the user enters the cabinet or sees the auth gate. No tokens are copied to the public page.

## Design-code reconciliation

Application-wide: remove decorative horizontal dividers below headings and between metadata, actions, sections and feedback. Preserve structural navigation boundaries (desktop sidebar account divider, mobile bottom navigation upper border), real table separators, card/control outlines, focus rings and comparison-slider boundary. Do not repeat the brand at the bottom. Public pages use only their compact header boundary, without cabinet navigation.

## Validation evidence

- Backend suite: 787 passed / 22 skipped before the final account-link ownership assertion; targeted publication/account-link suite rerun after ownership change
- Frontend suite: 260 passed; build, Ruff and diff checks passed
- Disposable PostgreSQL on localhost: additive migration applied twice, RLS/grants checked, five concurrent publication POSTs returned the same URL
- Actual publication router + local PostgreSQL + fixture auth and local-file image adapters: browser Result → Share → public page, copy link and download checked; no production credentials or provider calls
- 390 px mobile screenshots and desktop public-page screenshot in `docs/evidence/shared-publications/`. Result shell/account values are fixtures, not a live authenticated account
- Staging auth/storage, external link previews and physical-device Telegram/download checks remain rollout validation
