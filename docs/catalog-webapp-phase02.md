# Phase 02: Catalog → WebApp and shared wheel Storage

Base: `origin/staging` at `213d28952bb204cf90bf3368080f1791aa828756`.
Branch: `feature/catalog-webapp-handoff`.
Status: implementation prepared for feature PR review with approved staging Storage publication. Production, merge and frontend deploy remain untouched.

## Data reconciliation

`landing/src/data/catalog-reconciliation.json` records all 71 workbook rows, 68 unique SKU codes and 30 vehicle × design pairs. Every pair and execution matches `catalog.ts`, including width, diameter, PCD, ET and DIA. Barcode links resolve to 22 shared JPEG originals. SHA-256, MIME, byte count and dimensions were verified against local files and the earlier source matrix. Original files and workbook were not modified.

`catalog-asset-registry.json` is the shared image manifest: one original plus two existing optimized previews per design image (66 Storage objects, 6,100,683 bytes). Object paths contain the source hash and preview hash. Updates create new immutable paths; the publisher never overwrites an existing object.

Reproduce reconciliation with the supplied workbook, earlier source matrix and original image directory:

```sh
./landing/node_modules/.bin/tsx landing/scripts/reconcile-catalog.ts \
  --workbook /absolute/path/selected-wheel-articles.xlsx \
  --matrix /absolute/path/car-wheel-matrix.csv \
  --source-dir /absolute/path/originals
```

16 pairs have one execution; the other 14 now have explicit approved selections in `catalog-primary-skus.json`, based on source images, card parameters, supplier PDFs and owner decisions. All 30 pairs resolve one SKU; no visitor-facing picker or list is handed off. The barcode identifies a shared image, not an execution. Nine row-level DIA discrepancies remain documented as source differences; original parameters are preserved. Additional fitment revalidation is outside this mapping task; fitment remains `unknown`.

## Handoff and Auth Gate

`MiniCatalog.tsx` uses `landing/src/lib/catalog-handoff.ts` for both try-on CTAs. RU targets `https://app.dream-wheels.ru/new`, EN targets `https://app.dreamwheels.pro/new`. Missing-car opens ordinary blank Create. Existing design and B2B pilot form behavior are preserved.

The URL carries only canonical `catalog_variant`, `catalog_sku`, `catalog_locale`, `catalog_source` and bounded existing UTM/market fields. It does not carry arbitrary image URLs, photos, tokens or redirect destinations. WebApp resolves IDs against generated `catalog-data.mjs` and `catalog-assets.mjs`.

`initializeCatalogHandoff()` runs before URL canonicalization/Auth Gate. Valid context is saved in application-origin sessionStorage with a 24-hour TTL before handoff query cleanup. Normal same-tab OTP restores it. The intent binds to the first verified account; account changes invalidate pending work. Registration attribution is not implemented in this phase.

After verified auth and existing IndexedDB draft hydration:

- Empty wheel: fetch and verify the canonical original; commit wheel and metadata locally.
- Same pair/execution: consume without repeated download or prompt.
- Different wheel: approved confirmation above both photos on desktop, between car and wheel on mobile.
- Keep: durably consume intent and preserve photos.
- Replace: preserve car; atomically save new wheel, catalog identity and cleared product URL in the existing IndexedDB store.

The confirmation shows incoming thumbnail, design and a separate article line, without a dot separator. Manual wheel edits clear catalog metadata. Vehicle-only edits preserve it. A 12-second timeout, cancellation and generation/account/input guards prevent late results replacing newer input. Byte size, MIME and SHA-256 must match the registry before draft persistence. Errors retain current photos and offer retry.

## Supabase architecture and migration

`catalog-storage.json` pins project refs/origins separately for staging and production. `catalog-publications.json` starts with null receipts. `catalog-images.mjs` constructs only allowlisted immutable public URLs on the pinned Supabase origin. Image GETs omit credentials and reject redirects. No service-role key enters frontend bundles.

Read-only audit found existing private `raw` and public `results` buckets, and no catalog bucket. An existing permissive anon ALL policy allows operations on buckets other than `raw`; simply adding a permissive deny would not protect a new bucket. Therefore migration `0043_catalog_wheels_public_read.sql` creates public `catalog-wheels` with an 8 MiB/image MIME limit and adds a **restrictive** policy denying anon/authenticated object operations only for this bucket. Public URL GET works independently of object RLS. Listing, authenticated SDK download and client writes are not the application access path. Trusted server upload uses service_role.

The migration checks an existing bucket for exact public/limit/MIME compatibility and aborts on conflict. It does not make another existing bucket public or modify raw/results policies. The actual SQL was tested in an ephemeral local PostgreSQL cluster against the old permissive policy, including client mutations, service role, idempotency and conflict rollback. No production SQL has been applied; the approved staging application is recorded below.

Landing uses shared Storage previews after activation; existing local derived previews remain a safe pre-activation fallback. WebApp contains metadata/modules, not copied originals. Catalog CTAs remain disabled until the matching publication receipt is active, and additionally until that pair has a configured primary SKU. This branch is not ready to deploy as-is.

## Publisher and activation

Local dry-run (no credentials or network writes):

```sh
./landing/node_modules/.bin/tsx landing/scripts/publish-catalog.ts \
  --target staging --source-dir /absolute/path/originals \
  --report /absolute/path/dry-run.json
```

After explicit approval of staging live operations and SQL review:

1. Apply migration 0043 to the confirmed staging project using the standard migration process.
2. Provide `CATALOG_STORAGE_SERVICE_ROLE_KEY` only to the trusted local/CI publishing process, never to frontend environment variables or logs.
3. Publish with explicit target/ref/policy confirmations:

```sh
./landing/node_modules/.bin/tsx landing/scripts/publish-catalog.ts \
  --target staging --confirm-target staging \
  --expected-project-ref hnawojlnfoaccinlgjyn \
  --confirm-policy-migration 0043 --upload \
  --source-dir /absolute/path/originals \
  --receipt-out /absolute/path/staging-publication.json
```

The publisher verifies bucket settings, checks/reuses matching existing objects, uploads missing objects without upsert, then verifies public hashes/MIME/size for all 66 objects and CORS for RU/EN Landing and WebApp origins. A failed upload/hash/CORS check produces no activation receipt. Interrupted runs can be repeated; corrupted existing objects fail rather than being overwritten.

4. Reverify and activate the receipt locally:

```sh
./landing/node_modules/.bin/tsx landing/scripts/activate-catalog-publication.ts \
  --target staging --receipt /absolute/path/staging-publication.json
./landing/node_modules/.bin/tsx landing/scripts/build-handoff.ts --target staging
```

5. Add reviewed primary SKU IDs, regenerate and test. Publish compatible WebApp before enabling Landing links. Test real RU/EN routes/auth/images on staging, including Android networks.
6. Production repeats the same process only after separate approval, with target `production` and pinned ref `qmgyccghsbdpehiybjae`. Never reuse a staging receipt or generated target bundle. Roll back frontend publication/CTAs to previous SHA/receipt; keep immutable public objects for existing clients. Do not delete shared objects during rollback.

This rollout includes a migration and publishing tooling; the existing frontend-only release gate must not be weakened to admit it. Use a reviewed infrastructure/full release sequence or apply infrastructure separately before a qualified frontend release. Hosting, DNS, Deno and payments are unchanged.

## Existing backend reuse

Preparing an image is a public GET plus local IndexedDB write. It does not upload to the backend or launch render. Only ordinary user Create uploads both photos to `/identity/assets`, then submits `/jobs/from-assets` with existing idempotency. Brand/model/SKU/dimensions reuse current `RimProposal`, with `source=user_input`, `confidence=0`, `rim_user_confirmed=false`. No new backend data model/API is needed.

The canonical shared source does not eliminate the existing per-user wheel upload when a render is submitted. Private job inputs remain in the existing workflow. Reusing a public catalog object directly server-side is a separate future optimization.

## Verification and remaining acceptance

Node tests cover durable capture/cleanup, primary selection, conflict/decline/replay, timeout, stale operations, atomic draft metadata, Storage publication guards, hashes, URL restrictions, idempotent publishing and CORS failures. PostgreSQL tests execute the real migration with old policy behavior. Landing tests cover data parity, mapping and RU/EN links.

Local browser fixture uses actual app.js, Create bridge/renderer, original JPEGs with real SHA verification and isolated IndexedDB. Auth and external image transport are controlled locally; API writes are blocked/countable. It does not certify real OTP, Supabase CDN or cross-domain hosting behavior.

```sh
python3 scripts/catalog/serve_qa.py --source-dir /absolute/path/originals --port 4333
# Open http://127.0.0.1:4333/tests/browser-fixtures/catalog-handoff.html
node --test tests/*.mjs
(cd landing && npm test && npm run check && npm run build)
node --test deploy/timeweb-static/build.test.mjs
```

Remaining release work: code review/CI, real RU/EN auth and network staging acceptance, then separately approved production Storage migration/publication and exact-SHA frontend release. All 30 primary SKUs are resolved and staging Storage is published. Test new/existing users, OTP cancel/retry, reload, expired session, account switch, same/different incoming wheel, manual edits, denied storage/offline/timeout, draft retention, and no automatic upload/render. Phase 03 requires separate clarification and approval.

### Local verification result — 2026-11-08

- `node --test tests/*.mjs`: 402 passed, 0 skipped (includes seven actual PostgreSQL migration assertions/subtests).
- Landing: 24 tests passed; Astro check: 0 errors/warnings/hints; static build passed.
- Timeweb static build tests: 10 passed.
- `ruff check .`, `ruff format --check .`, relevant `node --check`, `git diff --check`: passed.
- Production-target publisher dry-run: 66 objects / 6,100,683 bytes; no network calls or writes.
- Browser fixture: RU desktop 1440px and EN mobile 390px; original JPEG replacement, keep, IndexedDB restore, car preservation and 0 API writes observed. No mobile horizontal overflow; all displayed images loaded.

## Production exit criteria for Phase 02

1. Completed: all 30 pairs resolve deterministically to one SKU, including explicit approved choices for 14 formerly ambiguous pairs. Preserve the approved mapping and original parameters; no visitor-facing SKU picker or additional fitment certification is part of this phase.
2. Review code, SQL and publisher changes; commit via feature PR, obtain clean CI. No merge or frontend deploy is implied by Storage upload approval.
3. Accept the entire flow on an explicitly isolated staging backend: RU/EN links, guest/new/existing account, OTP and reload, incoming wheel/SKU and original image, replace/keep, draft persistence, manual vehicle photo and explicit Create action. Real render generation requires its own test authorization; it is not triggered by a CTA or this publication.
4. Check Android and MacBook delivery without VPN, image/CORS failures and retries. Do not assume `app-test.dream-wheels.ru` is isolated: it currently shares production backend/data. No account creation/upload/render test against that profile without its explicit data boundary being accepted.
5. Verify insufficient-credit behavior retains the wheel/draft and does not silently start payment or render. Enabling or changing payments is not a dependency of the Catalog handoff. Paid top-up acceptance, if requested, is a separate scope and authorization.
6. Approve production migration and immutable-object upload, verify publication independently, generate production-target manifests, and release the exact accepted SHA with rollback evidence. Deploy compatible WebApp before enabling Landing links; verify no-token boundaries and real auth afterward.

B2B form integration and Phase 03 registration attribution remain separate deferred work. A CTA click is never a registration event.

## Approved staging Storage rollout — 2026-11-08

Owner explicitly approved migration and 66-file upload to staging only. Applied migration `20261108095100 / 0043_catalog_wheels_public_read` to `hnawojlnfoaccinlgjyn`. The new bucket has public GET, 8 MiB limit and restrictive anon/authenticated object policy. Existing raw/results bucket settings were verified unchanged. Read-only role probes returned zero visible catalog rows for both client roles. No client mutation probe was performed against live objects.

Published 22 JPEG originals + 44 WebP previews: 66 objects, 6,100,683 bytes. Registry digest `ef28544e5f3183fb8bd3a8ff90daf6a77d06a4a329333d358204198b9224144e`. Public MIME/size/SHA-256 and four production-origin CORS probes passed, followed by independent public re-verification during local receipt activation. Receipt verified at `2026-11-08T09:57:55.427Z`; recorded in `catalog-publications.json` for staging only. Production remains null, and the checked-in generated target remains production/unpublished to avoid implicitly enabling live CTAs. Generate the staging target explicitly for the reviewed staging build.

The initial attempt revealed hosted Storage returns HTTP400 with internal `404 / NoSuchKey` for a missing object; handling is now specific to that error, with regression tests. A later network timeout left 13 objects; the idempotent resumption uploaded the remaining 53, preserving matching existing files. Public verification retries only bounded transient failures, never checksum/MIME/CORS mismatches.

The local Supabase Management token returned401. Publishing used the existing staging service-role key from the identified Render staging service, verified against the approved Supabase project; no secret was written to source/artifacts or displayed. Render configuration was not changed.

Security advisors reported existing unrelated function search_path and password protection warnings plus backend-only RLS informational findings. This migration does not alter those functions, Auth settings or payments. Current verification: 404 Node tests passed, 24 Landing tests passed, Astro check clean. Full browser OTP/render and Android network acceptance are still pending.

## Final primary SKU decisions

The separate SKU review chat supplied the final mapping after supplier-PDF/image/parameter comparison and owner selection of indistinguishable codes. Registered all 14 choices in `catalog-primary-skus.json`; generated `catalog-data.mjs` now has no unresolved selections. The supplied report is `outputs/phase02-sku-review-luna/sku-image-parameter-matching.md` in the project documents folder. In particular, owner-selected codes are GLE/MR208 D07018, BMW X5/X-137 351187AZ and Li L7/X-137 351866AZ.

Neither catalog source parameters nor images nor fitment status were changed. The handoff continues to accept only the single configured SKU per pair, rejecting other executions even when they belong to that pair. Tests cover RU/EN and both CTA placements for all 30 cards.

## Review fixes — 2026-11-08

- Source editor ownership now uses an explicit wheelReplacementToken, incremented on actual wheel replacement/removal/reset/repeat/catalog application. Photo hydration and object-URL recreation do not reset typed/cleared URL text. Owner transitions do not carry unsaved editor input/focus intent.
- Failed durable capture retains the validated payload and canonical same-origin return URL through the actual guest bootstrap. Reload and explicit retry can persist the original choice before query cleanup. Explicit decline removes it only after the durable refusal succeeds.
- Shared read-only build guard validates generated target, pinned project, bucket, source registry digest, generated registry and matching publication receipt. It runs before Timeweb dependency installation/artifact creation, in the WebApp npm build and Vercel public-config CLI, and at Astro build:start (including both domain and Timeweb Landing builds). Production and preview profiles cannot override each other. Local build defaults to production; explicit CATALOG_BUILD_TARGET=staging is permitted only without a conflicting hosting profile. Generate the corresponding bundle first. RU WebApp ru-test deliberately requires production catalog, matching its existing production Auth/API boundary; Landing landing-ru-test requires staging. Vercel preview requires staging. A profile mismatch is a build failure, not an automatic switch. The Timeweb Landing entrypoint explicitly regenerates its bundle from reviewed source data for its resolved profile before Astro starts; the guard then validates that result. Other entrypoints require explicit preparation of the matching generated bundle.
- Catalog notice is a stable programmatic focus target during busy. On completion focus returns to the wheel control; after error it returns to retry. External focus and a changed owner are not stolen.

Regression tests cover hydration/clear/repeated redraw/explicit replacement, complete guest startup with quota refusal and legacy routes, real negative Timeweb/WebApp/Astro build commands, and keyboard focus through loading/success/error. Local browser verification uses controlled auth/network and does not certify live OTP or hosting.

The inherited shared photo draft database is still not fully owner-scoped: catalog metadata is filtered, but prior unscoped photos remain recoverable. These fixes do not claim otherwise. Do not clear or silently assign legacy photos to the next signed-in account. This requires a separate owner/migration/product decision before staging acceptance; no existing photo records were deleted or reassigned here.
