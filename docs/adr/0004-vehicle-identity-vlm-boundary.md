# ADR 0004 — Vehicle identity VLM boundary

## Status

Accepted for staged implementation.

## Decision

`identity_api` normalizes the car image and calls `VehicleIdentityResolver`; routes do
not call a provider SDK or construct prompts. Implementations include a safe mock
abstention resolver and a provider-specific OpenAI Responses adapter. The selected
provider, model, timeout and retry count are configuration, with identity disabled by
default.

Every provider response is parsed through Pydantic models with `extra=forbid`. Prompts
are versioned (`vehicle_identity_v1`). A provider result contains no raw response and
records only validated candidates and audit metadata.

The production adapter is the official OpenAI Responses API. It uses
`VEHICLE_IDENTITY_OPENAI_API_KEY` and remains disabled until the explicit staging
feature-flag rollout. `gpt-4o-mini` is the initial configured model; this is a
recognition (image input, structured text output) use case, not image generation.
The consented benchmark remains required to validate quality, latency and cost before
enabling production traffic, but it is not a provider-selection exercise.

## Consequences

The existing `/identity/resolve` and `vehicle.primary/alternatives` response path stay
compatible. `unknown` is a normal product result. Provider failure exposes a retryable
error and manual fallback instead of inventing a default car. Rim recognition is
explicitly out of scope and returns `manual_required`.
