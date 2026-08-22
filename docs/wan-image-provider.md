# Wan image provider connector

## Decision

Dream Wheels uses a provider-neutral image editing contract in `src/rendering/`. The worker selects
the implementation through `IMAGE_GENERATION_PROVIDER`:

- `reve` — the current production-safe default;
- `wan` — Alibaba Cloud Model Studio Wan2.6/2.7 asynchronous image editing.

The Wan connector uses direct asynchronous HTTP with the existing `aiohttp` dependency. Alibaba
also maintains the official [`dashscope` Python SDK](https://github.com/dashscope/dashscope-sdk-python),
and Wan2.7 requires SDK version 1.25.15 or later. Direct HTTP is preferred in this service because it
keeps I/O async, avoids a process-global SDK base URL and makes region/error behavior deterministic
in tests.

Official references:

- [Wan2.7 image generation and editing API](https://www.alibabacloud.com/help/en/model-studio/wan-image-generation-and-editing-api-reference)
- [Wan2.6 image generation and editing API](https://www.alibabacloud.com/help/en/model-studio/wan-image-generation-api-reference)
- [Model availability and pricing](https://www.alibabacloud.com/help/en/model-studio/model-pricing)

## Runtime flow

```text
worker
  -> ImageEditRequest(prompt, ordered images, optional bbox_list)
  -> POST /services/aigc/image-generation/generation
  -> task_id
  -> GET /tasks/{task_id} until terminal status
  -> validate result host and image bytes
  -> immediately download the temporary Alibaba result
  -> upload permanently to Supabase results storage
```

Alibaba retains task data and result URLs for only 24 hours. The connector therefore never stores
the temporary result URL as the job result. If a PNG exceeds the current 5 MB Supabase `results`
bucket limit, the storage boundary converts and, only when needed, downsizes it to a bounded JPEG.

Submission POST requests are not retried after transport failure. A timeout can happen after the
provider accepted a billable task, and retrying without provider idempotency could create a duplicate
generation. Polling GET requests tolerate a bounded number of transient errors.

## Model choice

The default candidate is `wan2.7-image`: it supports image editing, up to nine ordered input images,
up to four outputs and up to 2K editing output. `wan2.7-image-pro` is configurable for benchmark
comparison. `wan2.6-image` is also supported and accepts up to four input images.

Always use `n=1` for production fitment unless an internal benchmark explicitly needs multiple
variants, because Alibaba bills each successful output image.

As of August 2026, the published Singapore list prices are $0.03 per output for `wan2.7-image` and
`wan2.6-image`, and $0.075 per output for `wan2.7-image-pro`. Verify the current regional console
price before rollout.

## Configuration

```dotenv
IMAGE_GENERATION_PROVIDER=wan
WAN_API_KEY=<regional Model Studio API key>
WAN_BASE_URL=https://<WorkspaceId>.ap-southeast-1.maas.aliyuncs.com/api/v1
WAN_MODEL=wan2.7-image
WAN_OUTPUT_SIZE=2K
WAN_WATERMARK=false
```

`WAN_API_KEY` falls back to the official `DASHSCOPE_API_KEY` environment variable when present. The
API key and base URL must be issued for the same region. The connector allows only Alibaba Cloud API
hosts and downloads generated images only from the configured result-host suffix allowlist.

After setting the staging variables, run one explicit billable smoke request:

```bash
python scripts/run_wan_live_smoke.py car.jpg wheel.png wan-result.png
```

The script prints request/task identifiers but never prints the API key or signed result URL.

## Input contract for wheel fitment

The current worker sends:

1. original car photograph;
2. exact catalog wheel reference;
3. a constrained wheel-replacement instruction.

The connector already accepts ordered multi-image requests and Wan2.7 `bbox_list`. When the planned
geometry pipeline is ready, extend the request without changing the provider transport:

1. exact catalog wheel;
2. wheel mask;
3. original car;
4. editable-region map;
5. technically correct geometric composite.

Wan should be responsible for photorealistic blending, lighting, reflection, shadow, edge and
occlusion correction. SKU geometry must remain in the deterministic composite and protected
post-processing stages.

## LoRA boundary

The hosted `wan2.7-image` and `wan2.7-image-pro` model information currently marks fine-tuning as
unsupported. This connector calls Alibaba's hosted base model and cannot attach a custom LoRA.

The planned Dream Wheels LoRA therefore needs a separate inference deployment, for example a
self-hosted Wan image-to-image worker or a managed custom endpoint that exposes the trained
checkpoint. Keep that implementation behind the same `ImageGenerationProvider` contract so the job,
payment, storage and Mini App layers do not change again.

## Rollout

1. Create a Model Studio workspace and API key in the selected staging region.
2. Configure the Wan variables in staging only.
3. Run one low-cost `n=1` smoke case and verify that the result is persisted in Supabase.
4. Benchmark hidden cases against Reve: SKU similarity, vehicle preservation, two-wheel consistency,
   first-pass acceptance, latency and accepted-result cost.
5. Switch production only after the benchmark threshold is accepted. Keep Reve configured as an
   explicit fallback candidate; do not silently retry every Wan failure through Reve because that
   obscures provider cost and quality metrics.
