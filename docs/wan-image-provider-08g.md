# Phase 08G — Wan staging rendering ↔ Fitment cross-flow

## Scope and guardrails

Validated on staging only. No production deploy was performed. The two
authorized billable generations below are the only live Wan generations used
for this cross-flow. No Fitment implementation, parser, UI, prompt, bbox,
provider-routing, payment, or storage-normalization code was changed.

The staging `results` bucket was configured to 20 MiB, the global Storage
limit is 50 MiB on the Free plan, and image transformations remain disabled.
Wan output is stored as received; no JPEG/WebP conversion was used.

## Release and infrastructure preflight

- Render service: `dream-wheels-ai-staging`;
- staging service URL: `https://dream-wheels-ai-robokassa-staging.onrender.com`;
- staging branch: `staging`;
- preflight runtime commit: `864fd68`;
- deployment: successful and healthy on the merged staging line;
- Supabase: staging project only;
- migrations `0029_wan_provider_task_metadata` and
  `0030_results_bucket_20m` are applied to staging only; `jobs.provider_task_id`
  is available in the live schema;
- Storage: `raw` 10 MiB, `results` 20 MiB, global limit 50 MiB;
- required Wan environment variables: present and validated without
  revealing secret values;
- frontend/Vercel: no Wan secret or provider configuration;
- frontend result retrieval: successful in the staging WebApp;
- Render logs contain zero `Reve` matches across both smoke windows.

## Mandatory cross-flow evidence

### Rendering 1

- job id: `e06a8c41-2bc7-46f8-97ab-20889386e8ba`;
- lifecycle: `queued` → `processing` → `completed`;
- model: `wan2.7-image`;
- generation provider: `alibaba_model_studio`;
- provider request id: `1aa7413b-050b-99ea-a17a-06133a59b55c`;
- provider task id: `91e22a28-b6e3-4dbf-837f-e6320969ce86`;
- generation latency: `20193 ms`;
- source dimensions: car `4096×2304`, wheel `1200×1200`;
- actual result dimensions: `2730×1536`;
- result content type: `image/png`;
- result bytes: `7797553`;
- durable result asset: `e37fc6b8-9c45-4063-8de1-3213e20faf41`, kind
  `result`, bucket `results`;
- credit state: `28` before, `27` after one reservation, `27` final;
- credit ledger: one `job_reserve`, one `job_finalize`, zero refunds;
- temporary Alibaba result URL: not persisted as canonical output;
- result was displayed in the WebApp and reopened from job history.

### Fitment 1

- fitment check id: `6f2e7c53-8a26-4be3-a16b-68d41f01145c`;
- execution: `completed`;
- verdict: `compatible`;
- confirmed vehicle: LADA Largus, 2019, Russia, B0 Facelift, 1.6i;
- confirmed wheel: 15 inch, 6J, 4×100, center bore 60.1, ET50;
- technical state was persisted and reloaded; no Fitment code changed.

### Rendering 2

- job id: `d14af4fc-5b78-4acf-8161-e29fc85f142e`;
- lifecycle: `queued` → `processing` → `completed`;
- model: `wan2.7-image`;
- generation provider: `alibaba_model_studio`;
- provider request id: `b829d345-78a1-9795-94ec-fd16cafc50fd`;
- provider task id: `f037fc7d-24d3-4fce-8a49-901d85c81cf5`;
- generation latency: `18999 ms`;
- source dimensions: car `4096×2304`, wheel `1200×1200`;
- actual result dimensions: `2730×1536`;
- result content type: `image/png`;
- result bytes: `7746055`;
- durable result asset: `268370b7-1381-46f6-bcf5-30177c17b87b`, kind
  `result`, bucket `results`;
- credit state: `27` before, `26` after one reservation, `26` final;
- credit ledger: one `job_reserve`, one `job_finalize`, zero refunds;
- temporary Alibaba result URL: not persisted as canonical output;
- result was displayed in the WebApp and reopened from job history.

### Fitment 2

- fitment check id: `00070c4b-9604-4fec-99a9-95b7e67cfd0d`;
- execution: `completed`;
- verdict: `compatible`;
- confirmed vehicle: LADA Largus, 2019, Russia, B0 Facelift, 1.6i;
- confirmed wheel: 15 inch, 6J, 4×100, center bore 60.1, ET50;
- technical state was persisted, reopened from history, and rehydrated after
  reload; no Fitment code changed.

## Durable metadata and provider-task checks

Both jobs have durable values for:

- `generation_provider` = `alibaba_model_studio`;
- `provider_request_id`;
- `provider_task_id`;
- `generation_latency_ms`;
- `generation_cost` = `0.03`.

The live query returned two jobs with task IDs, two distinct task IDs, and two
distinct request IDs. Each job has exactly one durable `result` asset. Both
result assets are PNGs below the 20 MiB bucket limit. The canonical asset
storage keys are internal Storage paths and do not contain an HTTP URL; the
temporary Alibaba URL was therefore not persisted as canonical output.

## Pre-upload observability

Render logs recorded only safe metadata before upload:

- `target_bucket`;
- `content_type`;
- `size_bytes`;
- `width`;
- `height`.

For both generated outputs, the log recorded `target_bucket=results`,
`content_type=image/png`, dimensions `2730×1536`, and the byte sizes listed
above. No image bytes, base64 input, Authorization data, or signed provider
URL was recorded in the evidence.

The identity resolver returned a non-billable failure before Rendering 2 was
created. The existing user flow was retried, and the manually confirmed
catalogue path produced the successful second job. This did not create an
extra job, provider task, charge, or Reve fallback.

## Regression and repository verification

Existing tests and fixtures cover the required Fitment verdict matrix:
`compatible`, `compatible_with_conditions`, `incompatible`, and `unknown`.
The targeted runtime suite also covers provider configuration failure,
normalized provider failure, uncertain submission, storage failure after
generated output, exactly-once refund compensation, duplicate-task
protection, and absence of Reve fallback.

Validated on the staging worktree:

- full pytest: `355 passed, 3 skipped`;
- targeted Wan/credits/queue/assets suite: `56 passed`;
- `ruff check .`: passed;
- `ruff format --check .`: passed (`110 files already formatted`);
- `git diff --check`: passed;
- Fitment source files changed: no.

## Future normalization watch item

No JPEG/WebP transformation is part of Slice 08G. Continue monitoring result
size and delivery latency. If outputs approach the 20 MiB bucket limit,
introduce normalization in a separate change with explicit quality and
dimension budgets, durable MIME/dimension metadata, and tests that preserve
the internal canonical asset path and never persist the temporary provider
URL.

## Gate result

All required Slice 08G checks passed on staging. No production release was
performed.

SLICE_08G = COMPLETE
PHASE_08_GENERATION_PROVIDER = COMPLETE
WAN_PRODUCTION_MODEL = wan2.7-image
WAN_STAGING_READY = YES
WAN_PRODUCTION_READY = YES
REVE_PROVIDER = RETIRED / UNSUPPORTED
REVE_RUNTIME_FALLBACK = ABSENT
PHASE_07_FITMENT = COMPLETE
FITMENT_IMPLEMENTATION_READY = YES
FITMENT_BETA_READY = YES
RENDERING_FITMENT_CROSS_FLOW = PASS
