# Generation evidence

The worker records `render_input_snapshot.generation.request` once, after claiming a
job and before provider submission. This is the executed worker's request, not the
API server's version when a job was queued. Existing intents are never overwritten:
if intent persistence fails, no paid provider call is made. Old jobs are not backfilled.

The allowlist contains prompt version/hash (never prompt text), runtime
`RENDER_GIT_COMMIT` (40 hex characters, otherwise null), model, input dimensions,
MIME/byte counts/SHA-256, explicit requested dimensions, seed and bbox-enabled flag.
Input asset IDs already live in the enclosing snapshot. No new environment settings,
tables or migrations are required.

After successful publication, a separate write-once `generation.result` records
provider and stored dimensions, MIME, byte counts and SHA-256. A dimension mismatch
emits a warning; it does not trigger a paid retry. Result diagnostics are best-effort
and cannot undo a completed render or its billing finality. Provider IDs and latency
remain in the existing scalar job columns and completion log.

`generation_request` / `generation_result` application logs use the same explicit
allowlist. Never log request/config dataclasses, raw prompt, base64, provider response
bodies or signed URLs. Job API snapshot readers exclude the internal `generation`
key; publications already select only public vehicle/rim facts. Legacy snapshots
without the key continue to work.

Before staging acceptance, verify the deployed SHA and worker startup. For an
explicitly authorized test render compare input/request/provider/stored dimensions
and hashes. This instrumentation changes neither image bytes nor sizing policy.
