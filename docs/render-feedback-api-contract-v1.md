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

```json
{ "sentiment": "disliked", "reason": "wheel_differs" }
```

Validation:

- `liked` requires `reason: null` or omitted;
- `disliked` accepts an optional allowed reason and persists immediately even when reason is omitted;
- unknown fields and unknown reason codes are rejected;
- completed render job is required.

### DELETE `/jobs/{job_id}/feedback`

Clears the current user’s feedback. It is idempotent.

## Comparison assets

The render-detail response exposes authorized references for original car image, generated result image, durable job id, and status. The frontend uses server-provided references and must not reconstruct URLs or use localStorage as the source of truth.

## Create contexts

The endpoint/path can reuse existing job/create conventions, but must preserve these two distinct behaviours.

### Retry a failed result

`Повторить` returns a create context with prior car/rim assets and confirmed identity data. It does not create a job, enqueue work, or debit a render. The user explicitly confirms the new render after review.

### Try different wheels from a completed result

`Примерить другие диски` returns a create context with only:

- prior car asset;
- confirmed vehicle identity where available.

It must not preselect the prior rim asset or RimSetup. The user uploads another wheel image and explicitly confirms a new render. Navigation alone does not create a job or debit a render.

## Retention

Sprint 3 provides no user-initiated deletion endpoint for render jobs, source assets, result assets, or feedback.