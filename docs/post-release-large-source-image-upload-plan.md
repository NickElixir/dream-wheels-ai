# Post-release plan — oversized source image upload and recognition path

**Status:** planned after Release 1  
**Release impact:** intentionally deferred; not a Release 1 blocker  
**Scope:** upload transport, source-image preservation, recognition derivative, and oversized-file UX

## Context

Real-user testing exposed a class of large source photographs for which improving the error handler alone is insufficient.

The current application may reject or struggle with a large upload before the user reaches the normal render flow. Retrying the same request does not change the input and therefore is not a useful recovery action.

This plan deliberately separates four concerns:

1. user-facing recovery for an oversized file;
2. transport and durable persistence of the canonical original;
3. reduced input used by vehicle recognition;
4. the already introduced `car_display` presentation derivative.

The work below is deferred until after Release 1 so the current release candidate does not absorb another upload/storage architecture change.

## Product behavior

### Oversized-file UI

When the application knows that the source image cannot be accepted by the current upload path, it should explain the condition directly.

Expected behavior:

- say that the photo is too large for the current upload path;
- ask the user to choose another photo;
- keep the rest of the form state intact where possible;
- do not present a generic retry action for the exact same file.

A retry remains appropriate for transient network/storage/provider failures, but not for a deterministic file-size rejection.

### Canonical original

The user's original vehicle photo remains the canonical render input.

Future upload architecture should send a large `car_original` directly to the private Storage bucket instead of proxying the full binary through the application backend.

Required invariants:

- private Storage only;
- preserve the original bytes;
- preserve/record the original SHA-256;
- do not recompress, resize, or normalize the canonical original;
- keep ownership checks and durable asset metadata;
- the render worker continues to consume `car_original`, never a presentation or recognition derivative.

The backend may issue upload authorization or signed upload metadata, but should not need to buffer the complete large source file merely to persist it.

## Separate recognition derivative

Vehicle recognition should not require the full-resolution canonical original.

After the original is accepted, create or provide a reduced recognition input separately from `car_original`.

Target properties:

- bounded dimensions appropriate for the recognition provider;
- correct EXIF orientation;
- no mutation of the canonical original;
- explicit lifecycle/ownership link to the same draft/job;
- recognition failures must not corrupt or replace the original asset.

This derivative is conceptually separate from both:

- `car_original` — immutable canonical input for rendering;
- `car_display` — presentation derivative for result/history UI.

The implementation may reuse a common image-normalization primitive, but the asset roles must remain distinct.

## Current `car_display` prerequisite

Migration `0037_car_display_assets.sql` adds the `car_display` asset kind and uniqueness constraints required by the result-viewer source-image delivery work.

For the current staging implementation, migration 0037 must be applied before relying on persisted `car_display` rows.

This migration is an operational prerequisite for the existing `car_display` path; it is not itself the deferred direct-upload architecture described in this document.

## Proposed post-release flow

```text
User selects large vehicle photo
        |
        v
Client validates supported type/basic limits
        |
        v
Backend authorizes owned private upload
        |
        v
car_original -> private Storage directly
        |
        +--> durable metadata + SHA-256
        |
        +--> recognition derivative -> vehicle recognition
        |
        +--> car_display -> result/history presentation
        |
        v
Render job consumes car_original
```

No derivative may silently replace `car_original` as the model/render input.

## Failure and recovery rules

### Deterministic oversized/unsupported input

- explain the reason;
- offer file replacement;
- do not suggest retrying the same unchanged request.

### Direct Storage upload failure

- keep the job/draft uncommitted until ownership and upload completion are verified;
- allow a normal retry when the failure is transient;
- avoid duplicate durable asset rows on replay.

### Derivative generation failure

- canonical original remains valid;
- presentation/recognition derivative failures are recoverable independently;
- do not delete or mutate a successfully stored original solely because a derivative failed.

### Recognition failure

- user can continue with manual vehicle identification where the product flow allows it;
- the original remains available for rendering.

## Security requirements

- RAW/source bucket remains private;
- upload authorization is scoped to the authenticated owner and expected object;
- clients cannot choose arbitrary Storage keys outside their allocated namespace;
- service-role credentials never reach the client;
- short-lived upload/signing credentials are not logged or persisted as product data;
- ownership must be revalidated when durable metadata is committed;
- uploaded bytes and recorded SHA must refer to the same canonical object.

## Acceptance criteria

### UX

- a deterministically oversized file produces a specific message;
- replacement is the primary recovery action;
- no misleading "retry the same upload" CTA.

### Original upload

For a representative large phone photo:

- browser uploads the original directly to private Storage;
- backend does not proxy the complete binary;
- stored bytes match the selected original;
- recorded SHA-256 matches the stored original;
- durable ownership metadata is correct.

### Recognition

- vehicle recognition receives a reduced derivative;
- recognition does not download/re-upload the full original unnecessarily;
- original bytes/SHA remain unchanged.

### Rendering

- worker/provider input remains `car_original`;
- no quality regression caused by using `car_display` or the recognition derivative as render input.

### Presentation

- existing `car_display` result/history path continues to work independently.

## Validation plan

Post-release implementation should include:

1. unit tests for original immutability and derivative separation;
2. ownership/security tests for direct upload authorization;
3. idempotency tests for interrupted/replayed uploads;
4. large-photo browser network evidence;
5. verification that backend-transferred original bytes are effectively zero for direct upload;
6. recognition input-size evidence;
7. render-worker assertion that the canonical original is still used;
8. mobile/Telegram WebView smoke for file selection and upload recovery.

## Risks to evaluate

- direct-upload completion/commit race;
- orphaned objects after interrupted uploads;
- client-side hashing cost for very large files if SHA is computed on-device;
- Storage upload retry/idempotency behavior;
- EXIF/orientation differences between recognition and render inputs;
- memory use if derivatives are still decoded at full resolution on backend;
- Telegram WebView behavior for large local files.

## Release decision

This work is intentionally deferred until after Release 1.

Release 1 should not be blocked solely on introducing direct large-file upload or a dedicated recognition derivative, provided the existing release gates are otherwise satisfied.

After release, treat this as a dedicated upload/media pipeline improvement rather than an error-message-only patch.
