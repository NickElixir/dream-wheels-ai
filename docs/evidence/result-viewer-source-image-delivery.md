# Result viewer source image delivery — implementation evidence

## Baseline

Base: post-#247 staging `5ee9b862be78f919384f479e1da3bb7ab40c6b28`.
Branch: `fix/result-viewer-source-image-delivery`.

The baseline `webapp/app.js::ensureAssetBlobUrl` waits for `response.blob()` and
creates an object URL. `src/jobs_api.py::download_job_asset` invokes
`src/storage.py::download_bytes`, buffering the full private source object in
backend memory. The old Before path is Storage → backend → Blob → object URL.
The generated result already uses its public results URL.

## New architecture

Both `/jobs/upload` and `/identity/resolve` retain original bytes and create an
optional `car_display` from bytes already in memory. `assets` stores the private
RAW object and safe metadata. `/jobs/from-assets` promotes the owned draft's
unique display asset in the same transaction as canonical originals.

`GET /jobs/{job_id}/assets/{kind}/signed-url` resolves an owned durable job asset,
allows only `car_display` and `car_original`, signs server-side with TTL 600 seconds,
and returns `kind`, `url`, `expires_at` with `Cache-Control: private, no-store`.
No image bytes are downloaded by this route.

The production Before viewer prefers display metadata, otherwise original
metadata. It requests a signed URL using existing frontend auth and immediately
sets direct HTTPS `<img src>`. Cache is memory only, tied to application auth
session generation/identity. The 60-second expiry margin triggers fresh metadata.
An image error permits one automatic forced refresh; a second error is unavailable.
Concurrent requests for a job are deduplicated. Stale auth responses are discarded.
Public result, technical download, Fitment previews and guest paths retain their
existing delivery contracts. Fitment preview optimization is deferred.

## Privacy

RAW remains private; no bucket policies or public grants are changed. Endpoint
checks `jobs.user_id`, `assets.owner_user_id`, linked `job_id`, known kind and RAW
bucket before signing; original additionally matches `jobs.car_asset_id`.
Foreign/missing jobs or assets return ownership-safe 404, unsupported kinds 422.
Clients cannot provide Storage keys. Service-role auth remains server-side.
Returned URLs/tokens are neither persisted nor logged. Signing failures expose a
constant safe error; HTTP transport error details are suppressed. URL memory is
cleared with application session state. Query credentials for the existing
Telegram/dev auth path are preserved; website credentials use Bearer headers.

Storage REST request/response matches the official
[Supabase implementation](https://github.com/supabase/storage-js/blob/master/src/packages/StorageFileApi.ts)
and [signed URL documentation](https://supabase.com/docs/reference/python/storage-from-createsignedurl).
The current changelog was checked; no relevant signing breaking change applies.

## Derivative

WebP quality **80**, maximum long edge **1600**, aspect ratio retained, no upscale.
Pillow `ImageOps.exif_transpose` precedes sizing. A fresh RGB/RGBA image strips
EXIF/GPS/other source metadata while preserving transparency. CPU work runs off the
async request thread. Original bytes, metadata and SHA are not transformed.

Representative source: [2020 Lexus RX photograph](https://commons.wikimedia.org/wiki/File:2020_Lexus_RX_450h_Takumi_CVT_3.5_Front.jpg)
by **Vauxford**, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
The committed derivative is a resized WebP adaptation under the same license.
The large original stays outside the repository.

| Measurement | Original | Display |
| --- | ---: | ---: |
| Bytes | 6,258,237 | 288,350 |
| Dimensions | 3957×2344 | 1600×948 |
| Format | JPEG | WebP |

Reduction: **95.39%**. Production upload helpers were run against a local Storage
upload sink. SHA256 before generation and bytes passed to original persistence:
`4bd4c8e4d13b19fedeb578f6cd5fbd9b14a03f1f5aafbe98bde4c96abf1acb77`.
[Machine-readable measurements](result-viewer-source-image-delivery/derivative-metrics.json).
This is deterministic local evidence; no live Storage write occurred.

## Database / migration / lifecycle

New migration: `migrations/0037_car_display_assets.sql`. It extends the kind check
and creates partial unique indexes for one display per job and one per draft.
No new asset pointer, public policy, backfill or historical row rewrite is needed.
Migration is transactional and repeatable; existing kinds/null metadata stay valid.
It must be applied in staging after review and before application deployment.
It has been inspected locally, **not applied to staging or production**.

Generation/upload failure warns and keeps the canonical job/draft path available.
Ambiguous display upload timeout attempts deletion of its unique object. Optional
DB insertion uses a savepoint; failure rolls back the display row and attempts
object cleanup without poisoning canonical transaction. Direct upload's existing
cleanup list now includes display on rim upload, transaction or insufficient-credit
failure. Identity draft transaction failure now cleans its uploaded asset list.

Queue publish failure retains the failed durable job and its originals/display
under the existing compensation/history contract. `/jobs/from-assets` rollback
leaves display with its reusable draft; promotion occurs only on successful commit.
Wheel draft replacement affects only Rim and does not replace the source vehicle
or display. There is no implemented raw-asset job deletion or expired-draft object
purge in this baseline; this PR does not invent a new retention system. Any future
purge must operate on all owned job/draft assets, including display. Storage outage
cleanup attempts are logged for operations follow-up, as with existing originals.

## Network

Before: protected multi-megabyte source download → backend proxy bytes → Blob.
After: tiny authenticated signed-url JSON → browser HTTPS Storage image request.
[Sanitized network transcript](result-viewer-source-image-delivery/network-transcript.json)
records both new and historical jobs, reload and expiry refresh.

Browser transport evidence uses a localhost API double and CDP interception of
Image requests only to `https://storage-fixture.invalid`. The image bodies are the
measured derivative and the actual 6.26 MB original. This proves production
controller/view source selection and network structure with no paid operation.
It is **not a live Supabase/CDN latency or staging network measurement**.

- Backend source image bytes in fixture: **0**.
- Source `/download` requests in fixture: **0**.
- Direct HTTPS Storage image request: **YES, Storage double**.
- Repeated slider movement: one signing request; no additional download/sign storm.
- Near expiry: one additional metadata request.
- Reload: one fresh metadata request, no Blob source.
- Public After source remains on the public results path.

## Legacy fallback

Historical fixture has no `car_display`; frontend explicitly requests
`car_original/signed-url`. Browser loads the original directly, with natural
size 3957×2344. The endpoint never silently changes kinds or accepts arbitrary
keys. No bulk backfill is required.

## Render isolation

Queue payload still contains `car_asset.storage_key` as `car_storage_path`.
`src/main.py::_load_generation_inputs` uses queued original path or
`jobs.car_asset_id`; neither path references `car_display`. Worker/provider code
is unchanged. Original SHA immutability, original queue path and identity draft
promotion are covered by tests. No credits/reservations/accounting code changed.

## Tests

- Full backend: **634 PASS / 5 skipped**, 20 httpx deprecation warnings.
- Frontend auth/VNext: **200 PASS**.
- Fitment/catalogue/composition/focus/boot: **125 PASS**.
- Production frontend build: **PASS**, generated bundles unchanged.
- Ruff check/format and diff: **PASS**.
- Scoped commit hooks and exact final HEAD CI: recorded in the PR delivery receipt.

Backend coverage includes geometry, EXIF portrait, no upscale, valid WebP,
metadata removal/PNG alpha, original SHA, both upload paths and optional failure,
draft promotion, ownership/unsupported/missing assets, finite TTL, safe Storage
failure, savepoint rollback and timeout cleanup. Frontend covers display priority,
legacy original, direct `<img>`, no Blob, deduplication, expiry, one-shot retry,
public result, auth isolation and stale signing response after identity change.

## Browser evidence

Production `webapp/app.js` plus production VNext render view, local transports:
**desktop 1440×1000 PASS**, **390×844 smoke PASS**, no horizontal overflow,
console warn/error logs empty. Both image elements decoded; display 1600×948,
historical original 3957×2344. Reload and repeated compare controls work.

- [Desktop](result-viewer-source-image-delivery/desktop.png)
- [Mobile](result-viewer-source-image-delivery/mobile.png)
- [Historical mobile](result-viewer-source-image-delivery/historical-mobile.png)
- [Final desktop DOM sequence](result-viewer-source-image-delivery/browser-sequence.txt)

Reproduction: run `python3 scripts/qa/source_image_delivery_fixture.py` from repo,
open `/tests/browser-fixtures/result-viewer-source-delivery.html` on localhost:8775,
and intercept only Image requests to the documented Storage-double origin using
CDP `Fetch.enable` with explicit `resourceType: Image`. Fulfill display/public
result with committed WebP and historical original with the separately downloaded
attributed source. Clear interception with empty patterns afterwards. This helper
has no DB, queue, Storage credentials, account creation or render operation.

## UI_CHANGE_MANIFEST

Source loading uses signing metadata and browser image delivery; one automatic
refresh recovers a failed signed image. Existing controls, layout, labels, styles
and generated-result flow are retained. No Fitment visual/semantic change.

## Review and staging gates

**IMPLEMENTATION READY FOR INDEPENDENT REVIEW**.
**DO NOT MERGE — INDEPENDENT REVIEW REQUIRED**.

Review focus: original immutability, ownership, URL safety, derivative lifecycle,
legacy fallback, absence of backend viewer image bytes, original render input,
migration compatibility. Exact published PR HEAD/CI live in the delivery receipt.
After independent PASS: staging migration/deploy, real large-photo network test,
public result regression check. Asset Delivery release gate remains open until
that live test passes. Fitment Phase B gate is not reopened by this change.
