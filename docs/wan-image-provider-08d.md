# Phase 08D — Production GenerationProvider / WanImageProvider

Phase 08D implements the isolated production provider boundary. It does not
connect the adapter to the application worker.

## Implemented

```text
GenerationRequest
  -> GenerationProvider.edit()
  -> WanImageProvider
  -> Alibaba Cloud Model Studio / Wan 2.7
  -> GenerationResult
```

`GenerationRequest` has explicit semantic fields for the vehicle image and rim
reference image. The adapter always sends the vehicle as input image 1 and the
rim as input image 2. The request carries the instruction and prompt version;
Alibaba transport does not own prompt experimentation or render planning.

The Wan baseline uses:

```text
WAN_MODEL=wan2.7-image
n=1
watermark=false
bbox=off by default
```

Output dimensions are explicit `WIDTH*HEIGHT` values supplied by the caller.
Use `src.generation.sizing.vehicle_output_size()` to derive a size from the
vehicle dimensions; the provider never substitutes `2K`.

The async lifecycle is:

```text
submit -> task_id -> bounded polling -> terminal status
       -> HTTPS result URL validation -> immediate download -> image validation
       -> GenerationResult
```

Transport failures during submission raise `provider_submission_uncertain`
and never retry the POST. Polling retries are bounded. `FAILED`, `CANCELED`
and `UNKNOWN` are failures, never successes. Safe diagnostics retain HTTP
status, request/task identifiers, raw task status, provider code/message,
poll count and status transitions without retaining credentials, Base64 input
payloads or signed result URLs.

Configuration derives the normal endpoint from:

```text
https://{WAN_WORKSPACE_ID}.{WAN_REGION}.maas.aliyuncs.com/api/v1
```

An injectable endpoint remains available only for fake transport tests.

## Not implemented in Phase 08D

- worker or `process_jobs_loop` integration;
- jobs lifecycle or durable generation metadata;
- credits, Redis, Supabase or assets storage integration;
- frontend or Telegram changes;
- Fitment changes or cross-flow validation;
- provider routing, fallback or Reve calls;
- live Alibaba calls.

The selected model decision is recorded separately in
`docs/evidence/phase-08c-model-selection.md`. Full-dataset quality evaluation
is a follow-up activity.
