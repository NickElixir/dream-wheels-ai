# Render Feedback API Contract v1

## Scope

Sprint 3 persists comparison-ready result feedback. This contract does not cover Fitment, free-text comments, analytics dashboards, or ML training.

## Authorization

Every endpoint requires the existing authenticated user context. A user can access feedback only for their own durable render job.

## Data model

```json
{
  "render_job_id": "uuid",
  "sentiment": "liked | disliked",
  "reason": "wheel_differs | car_changed | angle_or_scale | image_quality | other | null",
  "created_at": "RFC3339 timestamp",
  "updated_at": "RFC3339 timestamp"
}
```

One current record exists per authenticated user and render job.

## Endpoints

### GET `/jobs/{job_id}/feedback`

Returns the current user’s feedback for a completed owned render job.

- `200`: record or `feedback: null`
- `403`: job belongs to another user
- `404`: job does not exist
- `409`: job is not completed

### PUT `/jobs/{job_id}/feedback`

Creates or replaces the current feedback record.

Request:

```json
{ "sentiment": "disliked", "reason": "wheel_differs" }
```

Validation:

- `liked` requires `reason: null` or omitted;
- `disliked` accepts an optional allowed reason;
- unknown fields and unknown reason codes are rejected;
- completed render job is required.

Response: current canonical record.

### DELETE `/jobs/{job_id}/feedback`

Clears the current user’s feedback. It is idempotent.

## Comparison assets

The render-detail response must expose the authorized URLs/asset references for:

- original car image;
- generated result image;
- durable render job id and status.

The frontend must use those server-provided references. It must not reconstruct URLs or use localStorage as the source of truth.

## Repeat scenario

`Создать ещё вариант` opens the existing create flow with a server-backed repeat context from the selected completed job:

- car/rim assets;
- confirmed identity/rim setup where available;
- no new job, queue item, or render debit until the user explicitly starts a new render.

The exact endpoint/path may reuse existing job/create conventions, but must preserve this behavior.
