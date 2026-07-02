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

- the **Rendering Pipeline** answers: “How will these wheels look on this car?”;
- the **Fitment Pipeline** answers: “What is known about the technical possibility of installation?”;
- a visual result must never be presented as proof of technical compatibility.

## Goal

Dream Wheels AI combines two independent user outcomes:

1. **Visual fitment** — a generated image of the user's car with selected wheels.
2. **Technical compatibility** — a preliminary fitment verdict derived from confirmed vehicle data, wheel specifications and a structured fitment provider.

A visual result must never be presented as proof of technical compatibility.

## Delivery sequence

### Sprint 0 — durable render foundation

**Backend and database**

- Treat the existing `jobs` record as the canonical render job; evolve it instead of creating a second competing job entity.
- Store source images and result images in durable object storage.
- Persist storage object identifiers/URLs, provider request metadata, timestamps, status and error code.
- Keep idempotency for upload/create requests.
- Add a history endpoint backed by Postgres rather than browser state.

**Exit criteria**

- A completed or failed render remains visible after reload and deploy.
- Original car image, original rim image and final image can be retrieved for an authorized user.

### Parallel F0 — fitment provider discovery

- Evaluate candidate fitment data sources against a representative vehicle set.
- Record coverage, supported parameters, latency, terms, cache policy, price and gaps.
- Select a provider only through an ADR; domain code must remain provider-agnostic.

### Sprint 1 — cabinet dashboard

- Dashboard with balance, latest render, CTA and navigation to history/wallet.
- Read from durable render history and existing payment endpoints.
- Use the approved UI reference: `docs/ui-design-code.md` and `docs/references/sprint-1-dashboard.html`.
- Dashboard includes desktop sidebar, mobile bottom navigation, a real latest-result preview and the approved history interaction: a completed render expands inside its card, shows its image at full width without crop, and only one history item is open at once.
- **Sprint 1 feedback UI only:** show `👍 Понравилось` / `👎 Не похоже` for completed renders on the latest-result card and expanded history item. Negative selection reveals inline reason chips. The state is in-memory/mock only: no API, database table, analytics event, localStorage persistence or training-data side effect.
- Fitment verdicts are out of scope. They are introduced only in Parallel F2.
- **Deferred profile enhancement:** after the dashboard and auth flows are stable, enrich the account header with the Telegram display name and profile photo when available. Do not add custom avatar uploads. Use a deterministic initials fallback when no Telegram photo is available. Keep `avatar_url` and its refresh timestamp in the backend user profile only when the authenticated Telegram flow provides a validated URL.
- **Expiry UI condition:** the approved expiry island may be implemented only after immutable grant/ledger expiry data is explicitly approved and available. Before then, it must be hidden rather than populated from mock or browser-local data.

### Sprint 2 — quick create flow and identity confirmation

Flow: upload car → upload rim → AI/VLM/OCR quick identity proposal → user confirmation → review → generate.

- Vehicle quick identity: make, model and year or year range. Show at most two alternative AI candidates; do not expose a full vehicle catalogue selector in the first iteration.
- Rim quick identity for rendering: wheel diameter, wheel width and PCD. Store PCD as `bolt_count` + `pcd_mm`; display it as `NxPCD`, for example `5×114.3`.
- Wheel width is part of the quick identity because it affects visual proportions; do not omit it even if confidence is medium.
- Brand, model, SKU/article, product URL, ET and DIA are not part of the default quick confirmation UI. They belong to the later Detailed Fitment Wizard or an optional advanced section after the render.
- Use `VehicleIdentity`, `RimSpec` and `RimSetup` as the shared data boundary with the Fitment Pipeline, but do not run Fitment Verdict in this sprint.
- Input technical validation and self-check warnings only; no automatic AI rejection.

### Parallel F1 — fitment domain and rules engine

- Normalize vehicle identity, vehicle fitment profile, rim specifications and verdict.
- Implement deterministic checks for PCD, DIA, ET, width, diameter, fasteners and axle differences when available.
- Return `compatible`, `compatible_with_conditions`, `unknown` or `incompatible`.
- Add golden tests and source/version audit data.

### Sprint 3 — comparison, history and feedback

- Original/result toggle in render detail.
- Persist render history with states and repeat scenario.
- Add real visual feedback persistence tied to durable render/job ids: positive/negative selection, optional reason, consent/privacy boundary, aggregation and evaluation use.
- Do not treat a feedback click itself as a training signal. Any dataset use requires explicit product, consent and evaluation rules.

### Parallel F2 — fitment UX integration

- Trigger a fitment check after vehicle and rim inputs are available.
- Do not block image generation.
- Show verdict, reasons, missing data and specialist disclaimer on result detail and history.

**Customer-development gate**

Run customer development after Sprint 3 + F2. The tested product is the complete value proposition: visual fitment + preliminary compatibility, not a standalone image generator.

### Sprint 4 — Detailed Fitment Wizard and wallet alignment

- Add the optional detailed form after render or from result detail: generation/modification/market, SKU/product URL, diameter, width, PCD, ET, DIA and staggered setup.
- Prepare the detailed-check entry point without turning automatic visual-support inference into a technical verdict.
- Wallet changes remain limited to balance, packages, invoice summary, receipt email and payment CTA.
- Do not advertise credit expiration until the backend implements it.
- Keep payment provider behavior out of this scope.

### Parallel F3 — catalog and partner recommendations

Requires a structured owned catalog or partner feed.

- Filter products by technical fitment.
- Rank by fit score, availability, visual similarity, price and commercial priority.
- Track impressions, clicks and leads.

### Sprint 5 — evaluation baseline

- Build a labelled evaluation dataset from consented/test cases.
- Benchmark generation providers by cost, latency, visual quality, wheel similarity and vehicle preservation.
- Keep expert labels separate from user feedback.

### Sprint 6 — soft input quality gate

- Add CV/VLM checks for blur, brightness, resolution, car/wheel visibility and rim front-face visibility.
- Show warnings; do not automatically reject uploads until measured evidence supports it.

### Sprint 7 — controlled rendering pipeline

- Wheel detection and segmentation.
- Mask/crop artifacts and render plan.
- Post-generation validation, one internal retry and provider fallback.
- Internal retries never consume additional user credits.

## Backlog after Fitment Verdict MVP

- AI recognition showcase for likely wheel brand/model candidates. This is not part of Sprint 2 because it does not improve render geometry or fitment evidence and can create false confidence.
- Paid Detailed Fitment Check pricing, retry and credit semantics.
- Catalog recommendations backed by audited product feeds.

## Non-goals in the current block

- Email/phone login changes.
- Payment provider switching.
- Credit expiration implementation without separate approval.
- Hard fitment guarantees.
- Catalog recommendations without an auditable product feed.