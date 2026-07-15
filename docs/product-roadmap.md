# Dream Wheels Dual-Track Product Roadmap

> **Internal initiative:** Project Dual Track
>
> This is the delivery plan for two independent product pipelines and their shared foundation.

## Working model

```text
Shared Product Foundation
  ├── durable jobs, assets and history
  ├── authentication, payments and wallet
  └── common create/result user flow

Rendering Pipeline
  └── visual wheel-on-car result

Fitment Pipeline
  └── preliminary technical compatibility verdict
```

Rendering answers how wheels look. Fitment answers preliminary technical possibility. A visual render is never proof of technical compatibility.

## Canonical documents

- `docs/ui-design-code.md` — approved UI rules through Sprint 3
- `docs/sprint-3-ui.md` — approved Sprint 3 layout and interaction reference
- `docs/adr/0003-render-feedback-data-boundary.md` — feedback persistence and ML boundary
- `docs/render-feedback-api-contract-v1.md` — Sprint 3 API/data contract
- `docs/fitment-schema.md`, `docs/fitment-api-contract-v1.md`, and Fitment ADRs — future Fitment work

## Delivery sequence

### Sprint 0 — durable render foundation

Durable jobs, assets, render statuses, idempotency, and Postgres-backed history.

### Sprint 1 — cabinet dashboard

Dashboard, balance, history, navigation, wallet, and UI-only feedback.

### Sprint 2 — Assisted Vehicle & Rim Identification

Existing upload screen stays unchanged. One page: upload → AI proposal → confirmation → review → render.

Quick vehicle identity: make, model, year/range, primary proposal plus at most two alternatives.

Quick rim identity: diameter, mandatory width, PCD stored as `bolt_count` + `pcd_mm` and displayed as `NxPCD`.

No full vehicle catalogue, rim brand/model, SKU, ET/DIA, provider lookup, FitmentCheck, or verdict.

### Sprint 3 — comparison, durable history, and persistent feedback

**Approved result detail**

- Open a completed result inside the existing history context.
- Single viewer with full-width equal segments: `Результат | Оригинал`.
- Default to Result; switch the same image in place with a short fade.
- Preserve full source/result composition: `width:100%`, `height:auto`, `object-fit:contain`.
- History thumbnails use `object-fit:contain` in compact fixed frames; dark letterboxing is allowed.

**History states**

- Completed: `Готово`, `Открыть`.
- Processing: `Создаём виртуальную примерку`, `В обработке`.
- Failed: clear error, `Рендеры не списаны`, `Повторить`.
- Comparison and feedback are only available for completed jobs.

**Repeat scenario**

`Создать ещё вариант` restores server-backed car/rim assets and confirmed identity context. It does not create a job or debit until the user explicitly starts a new render.

**Persistent feedback**

- One current record per user and completed `render_job_id`.
- Like/dislike can be replaced or cleared.
- Dislike uses exactly one code: `wheel_differs`, `car_changed`, `angle_or_scale`, `image_quality`, or `other`.
- No modal, free-text comment, submit button, localStorage source of truth, or clickstream duplication.
- Feedback is product data, not automatically a training label or consent to train on user media.

### Parallel F1 — fitment domain and rules engine

Normalize fitment data and evidence; deterministic rules return accepted taxonomy.

### Parallel F2 — fitment UX integration

User-initiated Detailed Fitment Check, independent from rendering.

### Sprint 4 — Detailed Fitment Wizard and wallet alignment

Optional detailed fields after result detail: generation, modification, market, SKU/product URL, diameter, width, PCD, ET, DIA, staggered setup.

### Follow-up — rim source enrichment before rendering

An optional rim product URL may be collected in the pre-render flow.  After the
user confirms the URL, the client shows a loading state, temporarily locks rim
parameter inputs, and applies a reviewable extraction draft.  The URL, extracted
values and their provenance travel with the render input draft and remain
available in the Fitment editor.  Confirmed brand/model/SKU/specification data
may later be used as context for diffusion generation and render-quality
evaluation; unconfirmed page data must never be treated as ground truth.

### Sprint 5 onward

Evaluation baseline, input-quality gate, controlled rendering, and catalog work with audited feeds.

## Current non-goals

- Fitment verdict in Sprint 3.
- Comparison slider or side-by-side comparison.
- Free-text feedback, analytics dashboard, export, or automatic ML dataset ingestion.
- Payment-provider switching, hard fitment guarantees, or catalog recommendations without audited data.
