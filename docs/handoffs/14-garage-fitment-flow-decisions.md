# Garage Data Model & Pre-Render Fitment Flow — Product Decisions

## Purpose

Not a Codex ticket — a product/flow decision record from a design
conversation, so the reasoning behind each call survives the session
boundary instead of living only in chat scrollback. Covers three linked
topics: letting users check fitment before spending a render, how wheel
data gets into the system, and a data-model reframe ("Dream Wheels is
itself the garage"). Read this before implementing any of it — several
items correct an earlier, simpler proposal that turned out to be
over-scoped once checked against the real product intent.

## 1. Fitment check before render — one wheel slot, not a shortlist

**Decision:** a single wheel candidate at a time, with a replace-and-retry
loop, not a multi-candidate shortlist users check in parallel.

An earlier draft of this proposed letting users add 2–5 wheel candidates
and filter them by fitment before rendering any of them. Rejected —
that's aggregator/marketplace UX, not this product. The actual flow:

1. Seller gives a link + photo for **one** wheel (or uploads photo
   manually — see §2).
2. Vehicle + wheel data confirmed → technical fitment check runs,
   **before** any paid render exists (decoupled from `job_id` — fitment
   currently keys off a completed render job; it needs to key off a
   `(vehicle, wheel)` pair instead, independent of whether a render was
   ever requested).
3. **Fits** → proceed to the existing paid visual-render flow.
4. **Doesn't fit** → user provides a different link/photo, loop back to
   step 1. Capped at **10 attempts per vehicle** (confirmed: checks
   themselves are free/unlimited in principle, but a cap is wanted
   anyway to bound abuse).

Partner-recommendation cross-sell on a failed check ("this doesn't fit,
here's a similar wheel from a partner that does") was floated during this
conversation but is **explicitly a hypothesis only** — no supplier data or
commitment exists yet. Do not build toward it. Same for showing partner
alternatives as an upsell after a *successful* render — wanted eventually,
explicitly deferred, not in scope now. Catalog/aggregator integration in
general is not planned for this release — the release ships with the
existing single-wheel-check functionality; catalog was buyer/seller
feedback for later, not a launch blocker.

## 2. Wheel input: link and manual photo are equal, parallel entry points

**Decision:** a product link and a manually-uploaded photo are both
available from the start — manual upload is not a fallback shown only
after the link path fails.

- The link matters for more than photo retrieval: a parser (in progress)
  fetches the photo automatically from the link, **and** the link is
  intended as the source of confirmed technical characteristics
  (PCD/ET/DIA), not just photo retrieval or bookkeeping.
- **Confidence, not a hard gate.** Earlier the link was mandatory; that's
  reversed to avoid blocking the flow, but characteristics still need
  *some* source. Resolution: characteristics from a confirmed link are
  high-confidence; characteristics from photo recognition / manual entry
  alone are lower-confidence and should surface as such (this maps
  directly onto the existing `unknown`/`warning` status semantics already
  defined for fitment verdicts elsewhere in the design system — reuse
  that vocabulary, don't invent a new one).
- **Parser wait state is required.** Fetching the photo by link is
  asynchronous and needs its own visible loading state (spinner + status
  text: "забираем фото по ссылке"), not a silent gap.
- **Parser failure needs both recoveries, not one.** If the link fetch
  fails, offer *both* "try a different link" and "upload the photo
  manually" on the same screen — not a choice between them.
- **The link is not required to proceed at all**, and — separately —
  serves attribution/history purposes: purchase always happens outside
  the app at the seller, so the link is not gating any in-app checkout.
  Given that, ask for it softly and after the fact: an optional field on
  the check-result screen (skippable in one tap) that stays editable
  later from history, for anyone who skipped it. No pre-checkout moment
  exists to attach the ask to, because there is no in-app checkout.

## 3. Verdicts are immutable snapshots, not "can't edit" rules

**Decision:** a `Check`/`Render` record stores a **snapshot** of the
vehicle/wheel data it used at the time it ran, rather than a live
reference that would need to be frozen by forbidding edits.

The problem this replaces: an earlier idea was "once a wheel is uploaded
you can't change it, so the verdict doesn't break." That solves the
symptom by adding a restriction users will dislike (typo in a spec field
becomes permanent). The actual fix is standard: `Vehicle` and `Wheel` are
editable, independent entities; `Check` and `Render` rows reference them
by id **and** carry a denormalized copy of the specs used, so editing a
`Wheel` later never retroactively invalidates a past verdict — the old
row simply continues to reflect what was true when it ran.

## 4. "Dream Wheels is the garage" — data model reframe

**Decision:** extend the existing "landing is the garage journal" framing
— the webapp itself becomes the garage: a persistent collection of a
user's vehicles and wheels, with checks and renders as separate job
records that reference them, rather than everything living inside a
one-off render job.

This isn't a new concept bolted on — it's the natural consequence of §3:
once `Vehicle` and `Wheel` are independent entities, "history of
verdicts / history of cars / history of wheels" (a real, immediate need —
buyers and sellers have already asked for exactly this) falls out for
free instead of needing three separately-designed history features.

**Entity/relationship shape** (attachment points for the three histories):

```text
USER ||--o{ VEHICLE : "владеет (гараж)"
USER ||--o{ WHEEL   : владеет
VEHICLE ||--o{ CHECK  : проверяется
WHEEL   ||--o{ CHECK  : проверяется
VEHICLE ||--o{ RENDER : примеряется
WHEEL   ||--o{ RENDER : примеряется

VEHICLE { id, photo_url, make_model, specs_confidence }
WHEEL   { id, photo_url, source_link (optional), specs_confidence }
CHECK   { id, vehicle_id, wheel_id, verdict, specs_snapshot }
RENDER  { id, vehicle_id, wheel_id, image_url }
```

### Keeping this from complicating the UI

The explicit risk raised in this conversation: turning "any car photo +
any wheel photo → instant try-on" into an upfront "register your vehicle"
wizard would undo the thing that currently works. Mitigations, all
agreed:

- **Entities are created implicitly**, as a side effect of an ordinary
  check/render action — no "add your vehicle" screen or form. The first
  time someone uploads a car photo, that silently becomes their first
  `Vehicle` row.
- **The garage is a showcase, not an entry form.** It surfaces *after*
  a user has accumulated some history (dashboard/history view), never as
  a gate before first use.
- **Multiple vehicles need no new UI concept** — a second, different car
  is just a second row. The garage only visually becomes a list of cards
  once there's more than one; nothing changes before that point.
- **No new required fields.** `Vehicle`/`Wheel` store exactly the data
  already being collected today (photo + recognized/entered specs) —
  the entity is a place to keep that data, not a reason to ask for more
  of it.

## 5. Deduplication: wheels vs. vehicles need different answers

**Decision:** dedupe wheels by source link/SKU when available; do not
attempt photo-based vehicle matching — use one explicit yes/no
confirmation instead.

- **Wheels:** when a check came from a product link, that link/SKU is
  already a reliable exact key — two checks against the same URL are the
  same `Wheel`, a normalization problem, not a recognition problem. No
  link (manual photo) → don't try to photo-match; treat as a new `Wheel`
  each time. A duplicate wheel row is low-stakes.
- **Vehicles:** automatic photo/VLM matching was considered and rejected
  for now — two different users' identical-model, identical-color cars
  look the same to a model, and the same user's own car can fail to match
  itself across lighting/angle changes. Wrong auto-merges are worse than
  no merging. Instead: on a repeat check, show a small thumbnail of the
  user's existing `Vehicle` and ask "это та же машина?" (one tap,
  yes/no). Yes → link to the existing row. No, or first use → new row.
  This is one UI decision, not a matching pipeline. An automatic
  suggestion layered on top of this same yes/no mechanism (e.g. "похоже,
  это ваш Zeekr 001 — верно?") is a plausible future improvement, not a
  precondition for shipping the garage concept.

## Open items carried forward (not resolved here)

- Partner-recommendation cross-sell (§1) — hypothesis only, no supplier
  commitment; do not scope work around it yet.
- Post-successful-render partner upsell (§1) — wanted eventually,
  explicitly deferred.
- Catalog/aggregator integration — not planned for this release.
- Automatic vehicle-recognition assist on top of the yes/no confirm
  (§5) — future improvement, not required for the initial garage
  implementation.

## What this document is not

- Not an implementation plan, API design, or migration spec — it records
  product decisions and the reasoning behind them, for whoever writes
  those next.
- Not a claim that the current single-render-job data model is broken
  today — it works for the shipped functionality; this document is about
  what changes once pre-render checking and persistent garage entities
  are built.
