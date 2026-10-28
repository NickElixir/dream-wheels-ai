# Phase 08F — Wan staging storage rollout

## Storage decision

The staging `results` bucket is raised from 5 MiB to 20 MiB so the first
Wan-powered smoke render can persist the provider output without changing its
bytes or MIME type. The Supabase global Storage file-size limit must be at
least 20 MiB; the bucket limit cannot exceed the global limit.

Migration: `0030_results_bucket_20m.sql`.

No JPEG/WebP transformation is part of this rollout. The provider output is
uploaded as received. Before every Storage upload, the backend logs only:

- `target_bucket`;
- `content_type`;
- `size_bytes`;
- `width`;
- `height`.

The log contains no image bytes, base64 input, authorization data or signed
provider URL.

## Sanitized staging evidence

Validated after migration `0030_results_bucket_20m` was applied to staging and
commit `9249ab9` was live on Render.

- job id: `5f607abf-d503-4efb-aeb9-eea6f53c3961`;
- lifecycle: `queued` → `processing` → `completed`;
- model: `wan2.7-image`;
- generation provider: `alibaba_model_studio`;
- provider request id: `7f1b1213-bc29-9ce9-be4b-8c8aa919af72`;
- provider task id: `ec50d41c-817e-4d81-9e87-76933dcd8935`;
- generation latency: `19200 ms`;
- requested dimensions: car `4096×2304`, wheel `1200×1200`;
- actual output dimensions: `2730×1536`;
- result content type: `image/png`;
- result bytes: `7811661`;
- credit balance: `29` before, `28` after reservation and finalization;
- credit ledger: one `job_reserve`, one `job_finalize`, zero `job_refund`;
- provider task uniqueness: one job and one distinct provider task;
- durable result: asset kind `result` in bucket `results`, canonical output
  classified as Supabase Storage;
- temporary provider URL: not persisted;
- Reve runtime calls: `0`;
- frontend: result displayed, history entry present, last result reopened
  after reload;
- regression suite: `56 passed`, including provider failures, uncertain
  submission, storage failure compensation, single refund and no-fallback
  coverage.

The result detail view may issue its existing read-only Fitment hydration
request; the Slice 08G cross-flow was not executed and no Fitment files were
changed.

## Future optimization watch item

After staging validation, monitor result sizes and delivery latency. If Wan
outputs frequently approach 20 MiB, add a separate post-generation
normalization policy with a tested quality and dimension budget. That future
change must preserve the durable asset contract, record the normalized MIME
type and dimensions, and never persist the temporary Alibaba URL.
