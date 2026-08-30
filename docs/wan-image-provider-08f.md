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

## Future optimization watch item

After staging validation, monitor result sizes and delivery latency. If Wan
outputs frequently approach 20 MiB, add a separate post-generation
normalization policy with a tested quality and dimension budget. That future
change must preserve the durable asset contract, record the normalized MIME
type and dimensions, and never persist the temporary Alibaba URL.
