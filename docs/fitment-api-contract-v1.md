# Fitment API Contract v1

## Scope

API boundary for the current Standard Fitment Check. Product semantics and the
authoritative Standard V1 subset are defined in
[Fitment Verdict V1](fitment/fitment-verdict-v1.md); this document remains the
API contract and does not duplicate the UI/state specification. An Extended
Fitment Check is a separate future workflow: it must not reuse this endpoint
or present Standard-provider data as extended evidence.

## Preconditions

- The caller is authenticated and owns the referenced VehicleIdentity/RimSetup/RenderJob.
- The request is initiated by a user action.
- A render job is optional and is never awaited by the fitment flow. Once its
  VehicleIdentity and RimSetup exist, a render job's `queued`, `processing`,
  `completed` or `failed` state does not change Fitment availability.

## Vehicle catalogue and saved-identity flow

The interactive VehicleIdentity controls are backend-owned and authenticated.
The client must never call Wheel Size directly or receive its credentials.

```http
GET /jobs/{job_id}/fitment/catalogue/regions
GET /jobs/{job_id}/fitment/catalogue/makes?region=<provider-region>
GET /jobs/{job_id}/fitment/catalogue/models?make=<provider-make>&region=<provider-region>
GET /jobs/{job_id}/fitment/catalogue/years?make=<provider-make>&model=<provider-model>&region=<provider-region>
```

Every successful option response has this shape:

```json
{
  "outcome": "success",
  "items": [
    {"value": "russia", "label": "Россия+", "provider_id": "russia"}
  ]
}
```

`outcome: "no_data"` returns an empty `items` array and means the provider has
no matching catalogue values. It is not an operational error. Provider
failures return a structured 503 `detail.code` such as
`provider_unavailable`, `authentication_failed`, `throttled` or
`malformed_response`.

`PATCH /jobs/{job_id}/fitment` validates a complete make/model/year/region
selection against those exact provider catalogues before it saves. A successful
response returns the authoritative `vehicle_revision`, plus:

```json
{
  "vehicle_state": "confirmed_ready",
  "vehicle_field_states": {
    "make": {"value": "Porsche", "state": "confirmed", "source": "user_confirmed", "is_user_confirmed": true},
    "model": {"value": "Cayenne", "state": "confirmed", "source": "user_confirmed", "is_user_confirmed": true},
    "year": {"value": 2021, "state": "confirmed", "source": "user_confirmed", "is_user_confirmed": true},
    "region": {"value": "russia", "state": "confirmed", "source": "user_confirmed", "is_user_confirmed": true}
  }
}
```

The only aggregate values are `empty`, `unconfirmed`,
`confirmed_incomplete` and `confirmed_ready`. Field states are `missing`,
`proposed` and `confirmed`. Explicit per-field provenance takes priority over
the legacy aggregate confirmation flag.

Vehicle variant lookup is intentionally a separate request:

```http
POST /jobs/{job_id}/fitment/vehicle-variants
```

It operates only on the already persisted current VehicleIdentity. The client
must save a changed draft and use the returned revision before requesting it.
The response returns every current candidate and its saved-revision concurrency
boundary:

```json
{
  "outcome": "multiple",
  "vehicle_revision": 12,
  "variants": [],
  "total_count": 4,
  "has_more": false
}
```

`outcome` is `no_match`, `single` or `multiple`. The backend persists the
authoritative modification outcome against that exact current
`vehicle_revision`:

- `no_match` → `modification_state: "none"` and no current selection;
- exactly `single` → `confirmed` with
  `selection_source: "wheel_size_single"` automatically;
- `multiple` → `suggested`, with no `selection_source` and no selected item.

The first item of a multiple response is never authoritative. Candidate lists
remain transient; the subsequent explicit selection route revalidates the
submitted candidate against the current provider result.

```http
POST /jobs/{job_id}/fitment/vehicle-variants/apply
```

The request includes `expected_vehicle_revision` from the candidate response.
It is valid only while the current overview reports `modification_state:
"suggested"`. On success it writes `confirmed` with
`selection_source: "user"`. A changed make/model/year/region causes a
machine-addressable `409 {"detail":{"code":"vehicle_revision_conflict"}}`;
the client must reload and must not replay the old selection.

The overview exposes the current durable state:

```json
{
  "modification_state": "confirmed",
  "selection_source": "wheel_size_single",
  "selected_modification": {
    "provider": "wheel_size",
    "make_slug": "porsche",
    "model_slug": "cayenne",
    "region": "russia",
    "generation_slug": "e3",
    "modification_slug": "v6"
  },
  "modification_vehicle_revision": 12
}
```

For `none`, `selection_source`, `selected_modification` and
`modification_vehicle_revision` are `null`. For `suggested`, source and
selected modification are `null`, while the bound revision remains available.
`vehicle_recognition` is a reserved source value only: Standard V1 does not
create it. A legacy Wheel Size mapping without a source and revision binding
is presented conservatively as `none`, never fabricated as a user selection.

## Create a check

```http
POST /fitment/checks
Idempotency-Key: <uuid>
```

```json
{
  "vehicle_identity_id": "uuid",
  "rim_setup_id": "uuid",
  "render_job_id": "uuid-or-null",
  "trigger": "user_requested",
  "mode": "standard"
}
```

Validation:

- `trigger` is only `user_requested` in v1;
- `mode` is `standard`; the legacy value `detailed` is accepted and normalized to `standard` during the transition;
- validate object ownership server-side;
- snapshot VehicleIdentity and RimSetup at acceptance;
- reject duplicate active/equivalent requests through idempotency and input-version hash;
- do not debit paid units until the future pricing policy is explicitly approved.

When the existing Redis-backed worker is enabled, acceptance persists the row
as `queued` and enqueues a `fitment_check` work item. The worker claims it with
an atomic `queued → processing` transition and then writes exactly one
terminal state: `completed` or `failed`. The no-worker/test fallback may finish
the same request synchronously, but it uses the same persisted response shape.
`queued` and `processing` are pending states; neither contains a technical
verdict. Repeating an equivalent request reuses the active or completed row
for the exact same input hash and context.

On worker startup, processing rows older than the 15-minute lease are requeued
until three attempts have been reached; exhausted claims become a safe
`failed/internal_execution_error` row. This keeps a worker crash from leaving
an indefinitely pending check while preserving idempotency.

## Read a check

```http
GET /fitment/checks/{check_id}
```

### Processing response

```json
{
  "id": "uuid",
  "execution_status": "queued",
  "verdict": null,
  "is_current": true,
  "input_hash": "sha256:...",
  "created_at": "2026-07-01T00:00:00Z"
}
```

### Completed response

```json
{
  "id": "uuid",
  "execution_status": "completed",
  "verdict": "compatible_with_conditions",
  "is_current": true,
  "is_preliminary": true,
  "vehicle_identity_id": "uuid",
  "rim_setup_id": "uuid",
  "render_job_id": "uuid-or-null",
  "evaluated_at": "2026-07-01T00:00:00Z",
  "evidence_summary": {
    "overall_level": "E4",
    "missing_fields": [],
    "conflicting_fields": []
  },
  "reasons": [
    {
      "code": "CENTER_BORE_REQUIRES_RING",
      "severity": "warning",
      "axle": "front_and_rear",
      "fields": ["center_bore_mm"],
      "evidence_level": "E4"
    }
  ],
  "conditions": [
    {
      "code": "USE_SPECIFIED_CENTERING_RING",
      "axle": "front_and_rear"
    }
  ],
  "missing_fields": [],
  "versions": {
    "provider": "wheel_size",
    "provider_version": "2026-07-01",
    "engine_version": "v2",
    "rules_version": "v2"
  },
  "disclaimer_code": "PRELIMINARY_TECHNICAL_ASSESSMENT"
}
```

## Failed response

```json
{
  "id": "uuid",
  "execution_status": "failed",
  "verdict": null,
  "error": {
    "code": "provider_timeout",
    "retry_mode": "retryable",
    "retryable": true
  },
  "retry_mode": "retryable",
  "retry_at": null
}
```

`failed` is operational. It must not be mapped to `unknown`.

## Stable machine codes

The API returns machine codes, not final Russian UI prose.

### Active Standard V1 codes

```text
PCD_MISMATCH
CENTER_BORE_TOO_SMALL
CENTER_BORE_REQUIRES_RING
et_outside_reference_range
```

These codes support only the canonical Standard V1 subset: PCD, DIA, diameter, width and ET. In particular, an ET outside the provider-derived interval is `unknown`; Standard V1 does not issue a clearance-condition code.

### Reserved broader-evidence / future Extended codes

```text
OFFSET_CLEARANCE_UNVERIFIED
BRAKE_CLEARANCE_UNVERIFIED
FASTENER_SPEC_REQUIRED
LOAD_RATING_REQUIRED
TYRE_PACKAGE_REQUIRED
MODIFIED_VEHICLE_REQUIRES_REVIEW
```

These are not active Standard V1 implementation requirements. They remain reserved for the broader evidence model or future Extended scope. Frontend owns copy, placement and visual state after Fitment UX approval.

### Execution error taxonomy and retry metadata

Execution failures are operational and remain `failed`; they are never
converted into a technical `unknown`. The API emits stable lower-case codes
and a retry policy category:

| Code | `retry_mode` | Meaning |
| --- | --- | --- |
| `provider_timeout` | `retryable` | The provider request timed out |
| `provider_unavailable` | `retryable` | Network/provider availability failure |
| `proxy_error` | `retryable` | Proxy or transport boundary failed |
| `throttled` | `retry_later` | Provider rate limit; retry only after the supplied delay |
| `quota_exceeded` | `retry_later` | Provider quota is exhausted |
| `provider_authentication_failed` | `not_applicable` | Provider credentials/configuration are invalid |
| `malformed_response` | `not_applicable` | Provider response could not be decoded safely |
| `internal_execution_error` | `not_applicable` | Unexpected worker-side failure |

`retry_at` is nullable and is populated only when a provider or scheduler
supplies a concrete retry time. Clients must not invent a countdown. A
Dream Wheels authentication `401` exits before check creation and therefore
does not create a `failed` row.

## Fitment workflow next action

The render-job fitment overview returns one machine-readable `next_action.kind`.
The UI must use this field for its primary CTA rather than independently
deriving the next step from multiple readiness flags.

```text
complete_vehicle_details  → save missing vehicle data
complete_rim_specs        → save missing wheel data
select_vehicle_variant    → select exact Wheel-Size vehicle variant
run_standard_check        → create Standard Fitment Check
```

Recognising a make/model from the image does not make a vehicle variant exact:
the final choice confirms market, generation and modification used by
Wheel-Size. `select_vehicle_variant` must never ask the user to identify the
vehicle from the beginning again.

## Read history

```http
GET /fitment/checks?vehicle_identity_id=<uuid>&rim_setup_id=<uuid>
```

History must show the snapshot hash, execution state, verdict, evaluated time,
versions and `is_current`. Currentness is calculated by comparing the
immutable context identity captured in `input_snapshot` with the current
VehicleIdentity, confirmed Wheel-Size mapping, RimSetup revision, per-axle
RimSpec revisions/source fingerprints and selected SKUs. It never uses
timestamp recency. Legacy snapshots without a context identity are readable
history but conservatively `is_current=false`. A new check is required when
relevant input or rule/provider versions change.

## RimSpec / RimSetup state (Slice 4)

`GET /jobs/{id}/fitment` exposes authoritative `rim_setup_state`, `setup_mode`,
front/rear RimSpec data, field states, source identity, selected SKU and
revisions. Critical field states are `missing`, `suggested`, `entered` and
`confirmed`; a present value is not confirmation. PCD is stored as
`bolt_count` + `pcd_mm`, and its aggregate state is confirmed only when both
components are confirmed.

`RimSetup` states are `empty`, `partial`, `complete_unconfirmed` and
`confirmed_ready`. A valid persisted partial setup may run Standard Check;
missing or untrusted evidence produces technical `unknown`. Only an unusable
or invalid setup returns `next_action=complete_rim_specs`.

`setup_mode` is `uniform` or `staggered`. Uniform uses one effective RimSpec;
staggered binds independent front and rear specs. Resolver values remain
suggested until explicit save/confirmation. `source_fingerprint` and selected
SKU identify the product context. The same fingerprint and SKU never overwrite
confirmed values; a new fingerprint or SKU invalidates the prior confirmation
relationship and increments the source/revision boundary.

Check snapshots include both axle specs, provenance/confirmation, setup mode,
setup/spec revisions and source fingerprints. Snapshots are immutable. `GET
/fitment/checks/{id}` and the history endpoint expose `is_current` by context
comparison; no separate mutable stale flag is written.

The backward-compatible migration `0026_fitment_rim_source_state.sql` adds
nullable source identity/SKU fields and setup revision counters. Legacy rows
without those fields remain readable as legacy/unknown source evidence.

## Security and audit

- Do not accept user identity, provider IDs or ownership from client-provided metadata.
- Do not expose provider raw payloads or signed asset URLs in standard responses.
- Persist provider/rules versions, input snapshot hash and idempotency key.
- Log operational errors separately from user-visible verdict reasons.

## Open items deliberately deferred

- pricing and debit semantics;
- provider cache / ToS policy;
- API-level presentation details not already fixed by the canonical Standard
  V1 product specification;
- advanced retry/backoff policy and historical stale-check retention policy;
- multi-provider arbitration.
