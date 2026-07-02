# Dream Wheels Dual-Track Product Roadmap

> **Internal initiative:** Project Dual Track
>
> This is the delivery plan for two independent product pipelines and their shared foundation. It is not a third pipeline.

## Working model

```text
Shared Product Foundation
  ├── durable jobs, assets and history
  ├── authentication, payments and wallet
  └── common create/result user flow

Rendering Pipeline
  └── produces and improves the visual wheel-on-car result

Fitment Pipeline
  └── produces a preliminary technical compatibility verdict
```

The pipelines meet in one user scenario, but remain independent:

- **Rendering Pipeline:** “How will these wheels look on this car?”
- **Fitment Pipeline:** “What is known about the preliminary technical possibility of installation?”
- A visual result must never be presented as proof of technical compatibility.

## Canonical documents

- `docs/ui-design-code.md` — approved UI rules for Cabinet and Sprint 2 create flow
- `docs/adr/0002-fitment-render-integration.md` — existing architecture record
- `docs/fitment/adr-fitment-render-integration.md` — concise integration decision for teams
- `docs/fitment/adr-fitment-verdict-taxonomy.md` — accepted verdict semantics
- `docs/fitment-schema.md` — shared VehicleIdentity, RimSpec, RimSetup boundary
- `docs/fitment-api-contract-v1.md` — future Detailed Fitment Check boundary
- `docs/fitment-verdict-pipeline-handoff.md` — engineering handoff for the Fitment Pipeline

## Delivery sequence

### Sprint 0 — durable render foundation

**Backend and database**

- Treat the existing `jobs` record as the canonical render job; evolve it instead of creating a competing job entity.
- Store source and result assets durably.
- Persist storage identifiers/URLs, provider request metadata, timestamps, status, and error code.
- Keep idempotency for upload/create requests.
- Serve render history from Postgres rather than browser state.

**Exit criteria**

- Completed and failed renders survive reload and deploy.
- Authorized users can retrieve source car image, source rim image, and final image.

### Parallel F0 — fitment provider discovery

- Evaluate candidate data sources on representative vehicles.
- Record coverage, parameters, latency, terms, cache policy, price, and gaps.
- Select a provider only through an ADR; domain code remains provider agnostic.

### Sprint 1 — cabinet dashboard

- Dashboard, balance, latest render, CTA, history, and wallet navigation.
- Desktop sidebar, mobile bottom navigation, real latest-result preview, expandable history cards.
- UI-only visual feedback: `👍 Понравилось` / `👎 Не похоже`; no persistence, analytics, localStorage, or training-data side effect.
- Defer Telegram profile enrichment until dashboard/auth flows are stable.
- Show render-expiry island only when immutable grant/ledger expiry data exists.

### Sprint 2 — Assisted Vehicle & Rim Identification

**Goal:** improve visual-render accuracy while keeping the first create flow fast and distinct from technical fitment.

**Single-page flow:**

```text
Existing approved upload screen
→ Определить данные
→ AI/VLM/OCR quick proposal
→ user confirmation
→ review
→ Создать виртуальную примерку
```

**Quick vehicle identity**

- Make, model, and year or year range.
- One primary AI candidate and at most two alternatives.
- No full vehicle catalogue selector in the first iteration.

**Quick rim identity for visual proportions**

- Wheel diameter.
- Wheel width — mandatory because it affects visible rim depth/proportions and must not be silently omitted even at medium confidence.
- PCD, stored as `bolt_count` + `pcd_mm` and displayed as `NxPCD`, e.g. `5×114.3`.

**Explicitly excluded from default quick UI**

- Wheel brand/model.
- SKU/article and product URL.
- ET, DIA, fastener information.
- Provider lookup, Wheel Size integration, technical compatibility labels, or verdict.

**Shared architecture boundary**

- Use `VehicleIdentity`, `RimSpec`, and `RimSetup` according to `docs/fitment-schema.md`.
- RenderJob references `vehicle_identity_id` and `rim_setup_id` and stores immutable input snapshot.
- Sprint 2 does not implement `FitmentCheck` or Fitment Verdict.

**UX boundary**

- Keep the existing approved upload screen unchanged.
- Use progressive islands below upload; do not turn this into a multi-route wizard.
- Review explicitly states that the output is visual and compatibility is not checked.
- Show an informational non-clickable `Проверка совместимости — скоро` island after the render CTA.

### Parallel F1 — fitment domain and rules engine

- Normalize vehicle identity, vehicle fitment profile, rim specifications, and verdict evidence.
- Implement deterministic checks for PCD, DIA, ET, width, diameter, fasteners, tyre evidence, and axle differences when reliable data is available.
- Return `compatible`, `compatible_with_conditions`, `unknown`, or `incompatible` according to the accepted taxonomy.
- Add golden tests and source/version audit data.

### Sprint 3 — comparison, history, and persistent feedback

- Original/result toggle in render detail.
- Durable history states and repeat scenario.
- Persist feedback tied to durable job IDs, with consent/privacy boundary, aggregation, and evaluation use.
- A feedback click is not automatically a training signal.

### Parallel F2 — fitment UX integration

- User initiates Detailed Fitment Check separately from render.
- Render never waits for verdict.
- Show approved verdict UI, reasons, missing fields, conditions, and preliminary disclaimer on result detail/history.

**Customer-development gate**

Run customer development after Sprint 3 plus F2. The tested product is visual fitment plus preliminary compatibility, not a standalone image generator.

### Sprint 4 — Detailed Fitment Wizard and wallet alignment

- Optional detailed form after render/result detail: generation, modification, market, SKU/product URL, diameter, width, PCD, ET, DIA, and staggered setup.
- Prepare detailed check entry without presenting automatic visual-support inference as a verdict.
- Wallet work remains balance, packages, invoice summary, receipt email, and payment CTA.
- Do not advertise expiration before backend support.
- Keep payment-provider behavior out of scope.

### Parallel F3 — catalog and partner recommendations

Requires a structured owned catalog or partner feed.

- Filter by technical fitment.
- Rank by fit score, availability, visual similarity, price, and commercial priority.
- Track impressions, clicks, and leads.

### Sprint 5 — evaluation baseline

- Build a labelled dataset from consented/test cases.
- Benchmark generation providers by cost, latency, visual quality, wheel similarity, and vehicle preservation.
- Keep expert labels separate from user feedback.

### Sprint 6 — soft input quality gate

- Add CV/VLM checks for blur, brightness, resolution, vehicle/wheel visibility, and rim front-face visibility.
- Show warnings; do not automatically reject uploads until supported by measured evidence.

### Sprint 7 — controlled rendering pipeline

- Wheel detection and segmentation.
- Mask/crop artefacts and render plan.
- Post-generation validation, one internal retry, and provider fallback.
- Internal retries never consume additional user renders.

## Backlog after Fitment Verdict MVP

- AI-recognition showcase for likely wheel brand/model candidates. It is excluded from Sprint 2 because it does not improve visual geometry or fitment evidence and can create false confidence.
- Paid Detailed Fitment Check pricing, retry, and debit semantics.
- Catalog recommendations backed by audited product feeds.

## Non-goals in the current block

- Email/phone login changes.
- Payment-provider switching.
- Credit-expiration implementation without separate approval.
- Hard fitment guarantees.
- Catalog recommendations without an auditable product feed.
