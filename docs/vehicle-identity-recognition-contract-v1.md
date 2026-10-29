# Vehicle Identity Recognition Contract v1

## Scope

Visual identity resolves only vehicle `make`, `model`, and one `year` or an inclusive
`year_start`/`year_end` range. It never resolves generation, modification, market,
engine, drivetrain, trim, wheel technical specifications, or fitment compatibility.

## Response

`vehicle` keeps the Sprint 2 shape and adds an envelope:

```json
{
  "status": "resolved | ambiguous | unknown",
  "primary": {"make": "Lexus", "model": "RX", "year": 2020, "confidence": 0.89, "source": "vlm_visual"},
  "alternatives": [],
  "abstention_reason": null,
  "metadata": {}
}
```

`primary` is required for `resolved` and `ambiguous`; `alternatives` has at most two
items. `unknown` has no candidates and must include an abstention reason. Confidence
is always in `[0, 1]`. A candidate uses either `year` or `year_start` plus `year_end`.

Supported abstention reasons: `vehicle_not_visible`, `multiple_vehicles`,
`image_too_blurry`, `vehicle_too_occluded`, `unsupported_view`, `make_uncertain`,
`model_uncertain`, `year_uncertain`, and `provider_returned_no_candidates`.

## Errors

An unknown result is HTTP 200. Provider temporary failure is HTTP 503 with
`vehicle_identity_provider_unavailable` and `retryable=true`; bad configuration is
HTTP 503 with `vehicle_identity_provider_configuration_error`; invalid provider JSON is
HTTP 502 with `vehicle_identity_provider_invalid_response`.

## Trust boundary

VLM output is a candidate, not canonical truth. A user selection or manual value is
stored as `user_confirmed`; the original VLM candidate remains in `field_candidates`.
Identity resolution never creates a render job, reserves credits, or runs a Fitment
Check. Unknown and provider failure offer manual input; visual rendering remains
available after user confirmation.

The rim response is `manual_required` in v1. It must not claim that diameter, width,
PCD, ET, or DIA were extracted from the photo. The pre-render flow may attach an
optional user-supplied product URL to this response. It is retained as source context
for the later Fitment editor, not evidence that technical values were extracted or
confirmed.

## Privacy and retention

The source asset remains unchanged. A metadata-stripped normalized copy is held only in
memory for the provider request. Raw provider responses are not persisted. Drafts keep
validated candidates and provider/model/prompt/request metadata plus hashes for audit.
User images are not evaluation or training data without separate consent.

## AI Tunnel / Qwen3.8 Flash pilot

The `aitunnel` provider uses `https://api.aitunnel.ru/v1/chat/completions`
with normalized inline image bytes and the existing strict vehicle identity schema.
It does not forward storage URLs, infer trim/market/fitment, or confirm catalog data.
Truncated, refused, malformed and contract-invalid responses fail closed; no fallback
request to another provider is made. Metadata identifies `aitunnel` and the configured
model. `estimated_cost` remains null because that field historically represents USD,
while AI Tunnel bills in RUB. Actual pilot charges must be checked in its dashboard.

Configure the backend only after publishing the adapter:

```dotenv
VEHICLE_IDENTITY_ENABLED=true
VEHICLE_IDENTITY_PROVIDER=aitunnel
VEHICLE_IDENTITY_MODEL=qwen3.8-flash
VEHICLE_IDENTITY_AITUNNEL_API_KEY=<secret in Render>
VEHICLE_IDENTITY_TIMEOUT_SEC=30
VEHICLE_IDENTITY_MAX_RETRIES=0
```

Start with retries disabled so a pilot action makes at most one provider request.
The existing OpenAI key is not used by this adapter. Adding the new secret alone does
not enable recognition. Keep production disabled until staging confirms the real
provider accepts this JSON schema and returns suggestions that can be manually
confirmed through the catalog. Local fake responses do not establish recognition
accuracy or live endpoint compatibility. Roll back recognition with
`VEHICLE_IDENTITY_ENABLED=false` and redeploy; generation settings stay unchanged.

Sources: https://aitunnel.ru/docs and https://aitunnel.ru/models/qwen3-8-flash.

### Local boundary validation and failures

Both adapters validate the decoded provider JSON against the exact outgoing schema
using pinned `jsonschema`, before applying the Pydantic semantic validators. Required
fields, candidate year representation, additional properties and JSON types are not
silently filled in or coerced at this boundary. Internal draft models retain their
existing defaults. Semantic constraints (status/candidates and year range ordering)
remain enforced after schema validation.

Provider failures expose only fixed diagnostic messages, without provider payload,
validation values or chained parser/validation exceptions in ordinary tracebacks.
Only 429, 500/502/503/504 and transport timeout/network failures are retryable.
Other HTTP errors fail immediately with `retryable=false`; 401/403 retain their
configuration-error classification. Test coverage is in
`tests/test_vehicle_identity_boundary.py` for both adapters.

Schema-rejection diagnostics contain at most eight violations: schema-owned field
paths, rule keywords, JSON value types and missing required field names. Request IDs
are correlated by a SHA-256 prefix instead of logging untrusted header/body values.
Provider response values, unknown property names and validator exception chains are
not included. These diagnostics do not relax validation or trigger retries.

Transport failures report a fixed category (`timeout`, `dns`, `tls`, `connection`,
`response_body`, `client_error`), phase (`connecting`, `dns`, `awaiting_headers`,
`reading_body`), elapsed milliseconds and attempt/retry counts. Exception strings
and chains are not retained. Awaiting headers means the request headers were sent;
it does not prove that the provider accepted or started inference.

Fitment recognition sends an opaque per-action `X-Vehicle-Recognition-Request-Id`.
The API logs only its SHA-256 prefix plus a new server call ID. Matching click hashes
on different server calls identify replay of one action; different hashes identify
separate client submissions. This is diagnostic correlation, not deduplication or
an idempotency guarantee. Existing clients without the header remain supported.

AI Tunnel envelope rejection reports a fixed reason: missing/invalid choices or
message, refusal, incomplete finish (`length`, content filter or tool call), or
missing/nontext/empty content. Unknown provider finish values are never echoed.
Completion/reasoning token counts are included only when bounded nonnegative JSON
integers; malformed counts become `unavailable`. Refusal text, content and other
response values remain excluded. An incomplete response is still nonretryable and
is never parsed or applied as a vehicle proposal.
