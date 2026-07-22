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
PCD, ET, or DIA were extracted from the photo.

## Privacy and retention

The source asset remains unchanged. A metadata-stripped normalized copy is held only in
memory for the provider request. Raw provider responses are not persisted. Drafts keep
validated candidates and provider/model/prompt/request metadata plus hashes for audit.
User images are not evaluation or training data without separate consent.
