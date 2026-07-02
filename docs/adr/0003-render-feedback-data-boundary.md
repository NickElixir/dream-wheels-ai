# ADR 0003 — Render Feedback Data Boundary

## Status

Accepted.

## Context

Sprint 3 introduces persistent feedback for completed virtual try-ons. A button click is useful product feedback but is not automatically a verified ML label or consent to train on the associated user assets.

## Decision

Store at most one current feedback record per `(owner_user_id, render_job_id)`.

The record is tied to the durable render job, never to a filename, storage URL, browser state, or frontend-generated id.

```text
render_job_id
owner_user_id
sentiment: liked | disliked
reason: null | wheel_differs | car_changed | angle_or_scale | image_quality | other
created_at
updated_at
```

Rules:

- `liked` requires `reason = null`.
- `disliked` may initially have `reason = null`; one selected reason replaces the prior reason.
- A user may change or clear their feedback; update the same record rather than creating a click stream.
- Feedback is available only for completed render jobs owned by the current user.
- Feedback does not alter render status, wallet balance, render assets, or fitment state.

## Consent and ML boundary

Feedback is product data first. It may support aggregation, quality investigation, and selecting cases for later review.

It is not, by itself:

- a supervised training label;
- consent to use the user’s images for model training;
- proof that a result is technically or visually correct.

Any dataset or model-evaluation use requires a separately approved consent, retention, access, and curation policy.

## Consequences

- Product analytics has stable, deduplicated feedback per result.
- UI can restore the user’s latest selection after reload.
- Future ML evaluation can use only reviewed and appropriately consented cases.
- No free-text feedback field is included in Sprint 3.
