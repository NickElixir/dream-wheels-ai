# Premium Garage Identity — Context Primer for Next Design Chat

## Purpose

Not a Codex ticket — a state-transfer document, same role as
[docs/handoffs/12-redesign-context-primer.md](12-redesign-context-primer.md)
played for this one: this chat picked up from #12, did a lot more work,
corrected several of #12's claims, and is now handing off mid-thread to a
new chat session (model: Opus 5.5) so the visual-identity work can
continue without re-deriving everything. Read this instead of #12 alone —
#12 is superseded on its central claim (see below) but its raw token
comparison and the two confirmed defects are still accurate and not
repeated here.

**Session role, carried forward:** this chat's job is audit + design
(flow decisions, mockups, design-system gap analysis) — not
implementation. One exception happened: [PR #190](https://github.com/NickElixir/dream-wheels-ai/pull/190)
shipped an actual CSS change directly. That was flagged mid-session as
scope drift for this chat's role; the user chose to keep it rather than
revert. Default back to design-only unless told otherwise.

## Correction to #12: the landing is not a separate repository

#12 stated the landing lives in a different codebase. **That was wrong.**
Same GitHub remote (`NickElixir/dream-wheels-ai`), different, unmerged
branch: `feature/landing-v1-shell-catalog` (185 commits behind `staging`,
5 ahead on its own track). This means:

- "Cross-repo design tokens" (an #12 open question) is the wrong frame —
  it's a cross-*branch* merge/extraction problem, not a shared-npm-package
  problem.
- That branch's repo root has **`DESIGN.md`** (832 lines) — a real,
  partially-approved design-system draft, not a CSS-inspection guess. Read
  it before proposing any visual direction; it already answers most
  "is this generic AI slop" questions with an explicit anti-pattern list
  (§ "Dream Wheels UI anti-patterns": no large rounded SaaS cards, no
  excessive pills, no glassmorphism, no purple/blue AI gradients, no
  giant icon badges, no decorative technical diagrams with no value,
  etc.) and a brand-character section ("must not resemble generic AI
  SaaS / neon dashboard / glassmorphism demonstration").
- **DESIGN.md itself leaves webapp↔landing radius/materiality
  convergence as an open, unapproved decision** (its own line ~742, open
  decision #4) — do not assume either "full convergence to landing's
  0–4px system" or "keep the webapp's current 12–28px scale" is settled.
  Full audit of this, screen-by-screen, both scenarios: [docs/handoffs/13-webapp-design-convergence-audit.md](13-webapp-design-convergence-audit.md)
  (now merged, its 10-screen gap analysis is still accurate — nothing
  since contradicts it, it's just incomplete: doesn't cover screens that
  didn't exist yet when it was written, see below).
- Landing also has components #12 didn't name: `HowItWorks.astro` (a
  numbered "Photo + Wheel + AI Model = Result" equation section, separate
  register from the SYSTEM 01/02 pair) and a third garage-photo use in
  `Faq.tsx` (`faq-garage-wheel.webp` decorative background) — confirms
  the garage motif is load-bearing on the landing, not incidental.

## What actually shipped: PR #190, #191, #192 (all merged to `staging`)

- **#190** — garage-photo texture on `.fitment-verdict-card` (the app's
  own "SYSTEM 02" moment). CI failed once because a frozen test,
  `tests/test_fitment_frontend_v2.py::test_result_uses_progressive_evidence_and_recheck_presentation`,
  asserts `"border:" not in` that CSS block — the card is meant to sit
  borderless/flush against its parent panel. Fixed by dropping the
  `border` declaration; radius + `overflow: hidden` + the background
  image still read as contained without it. **If a card-with-visible-edge
  look is wanted again, use `box-shadow: 0 0 0 1px <color> inset`, never
  the literal `border` property, on this specific element** — the design
  canvas mockups below already do this.
- **#191** — the screen-by-screen convergence audit (13, above).
- **#192** — [docs/handoffs/14-garage-fitment-flow-decisions.md](14-garage-fitment-flow-decisions.md),
  a large product/flow decision set from the same conversation, summarized
  next because it changes what several screens need to look like.

## Product/flow decisions that affect design (full detail in #14)

These aren't visual decisions, but they define what needs mockups:

1. **Fitment check moves before the paid render**, one wheel at a time
   (not a multi-candidate shortlist — that was proposed and explicitly
   rejected as "aggregator/marketplace UX", not this product). Fail →
   replace the wheel and retry, capped at **10 attempts per vehicle**.
2. **Wheel input has two equal, parallel entry points**: a product link
   (a parser — in progress — fetches the photo and, more importantly,
   the confirmed technical specs) or a manual photo upload. Neither is a
   fallback of the other; both are visible from the start.
3. **A required async wait state** for the link-parsing step (confirmed
   needed: spinner + status text, not a silent gap), and **on failure,
   both recovery options together** (try another link, or upload the
   photo manually) — not a choice between them.
4. **Confidence tiers, not a hard gate**: link-sourced specs are
   confirmed/high-confidence; photo/manual-only specs are
   preliminary — reuse the fitment verdict's existing
   `unknown`/`warning` status vocabulary for this rather than inventing
   new language.
5. **The product link is not required to proceed**, and separately
   exists only for history/attribution (purchase always happens outside
   the app, at the seller — there is no in-app checkout to gate). Ask for
   it softly, after the result, skippable, and leave it editable later
   from history for anyone who skipped it.
6. **Verdicts are immutable snapshots**, not "you can't edit a wheel
   after checking it" — a `Check`/`Render` row stores the specs it used
   at the time, so editing `Vehicle`/`Wheel` later never invalidates a
   past verdict.
7. **"Dream Wheels is itself the garage"**: `Vehicle` and `Wheel` become
   persistent, independent entities (this is also how "history of
   verdicts / cars / wheels" — a real ask from both buyers and sellers —
   falls out for free instead of needing three separate features).
   Entity/relationship shape, agreed:
   ```
   USER ||--o{ VEHICLE : "владеет (гараж)"
   USER ||--o{ WHEEL   : владеет
   VEHICLE ||--o{ CHECK  : проверяется
   WHEEL   ||--o{ CHECK  : проверяется
   VEHICLE ||--o{ RENDER : примеряется
   WHEEL   ||--o{ RENDER : примеряется
   ```
   **Explicit UI guardrail, agreed as important**: entities are created
   *implicitly* as a side effect of an ordinary check/render — no "add
   your vehicle" registration screen. The garage is a showcase shown
   *after* history accumulates, never a gate before first use. No new
   required fields versus what's collected today.
8. **Dedup**: wheels — by product link/SKU when available, no photo
   matching attempted otherwise (low stakes if duplicated). Vehicles —
   **no automatic photo/VLM matching** (rejected: two different users'
   identical-model cars look the same to a model; the same user's own
   car can fail to match itself across lighting/angle). Instead, one
   explicit tap: show the existing `Vehicle` thumbnail, ask "это та же
   машина?" (yes/no). An automatic suggestion on top of this same
   mechanism is a future improvement, not a precondition.
9. **Explicit non-goals for this release** (don't design toward these):
   catalog/aggregator integration, partner-recommendation cross-sell on
   a failed check (hypothesis only, no supplier data), and a
   post-successful-render partner upsell (wanted eventually, deferred).

## Live design canvas — where the visual work actually lives

**<https://claude.ai/artifact/8ftgbJBFcG7xA2sMWG45AJ>** ("Dream Wheels —
редизайн вебаппа", a Design-type Artifact/canvas). Read it — literally
`action: "read"` on that URL — before proposing new visuals; it has the
full mockup history as artboards, and re-deriving it from this prose
description will drift. Two already-uploaded real product photos are
available as assets in that artifact for reuse (don't re-upload):
`/_blob/2ec0f02ec5b56b8bef73842e4c683b31` (the garage/workshop photo,
sourced from the landing's SYSTEM 02 block), `/_blob/3b4fbe245dec9085d270af4b9ad566c0`
(a car photo), `/_blob/ecab28e3f7077e2d8e29bda65979256a` (a wheel product
photo).

Current boards: a `Main` cover, Dashboard/Fitment/Create
before-vs-target pairs, a 4-screen Create sequence for the new pre-render
check flow (link-or-photo input → parser wait → check-fail-with-dual-recovery
→ check-pass-into-render), and a `Fitment-GarageIdentity` exploration
board.

### Style direction: two rejections, current target is a third

This is the part most likely to be re-litigated wrongly by a fresh model
guessing at "premium automotive" from priors — both earlier attempts were
explicitly rejected by the user, for different reasons:

1. **Rejected: literal convergence to the landing's minimal 0–4px
   editorial system.** Still read as generic — just a different flavor
   of generic (flat SaaS-minimal instead of rounded SaaS-pill), not
   anything belonging to Dream Wheels specifically.
2. **Rejected: workshop/service-ticket kitsch** (a "наряд-заказ" /
   work-order card with a rubber-stamp-style circular badge, dashed
   tear-lines, a bolt-pattern icon replacing the pass/fail checkmark for
   the PCD field). Two problems surfaced: (a) it read as "cheap tire
   shop," not premium — rubber stamps and paper tickets are blue-collar
   signifiers, not luxury ones; (b) the bolt-pattern icon concept
   **breaks for the fail/conditional verdict states** — PCD either
   matches as a whole pattern or it doesn't, so per-dot red/green
   coloring would misrepresent what's physically true. Don't resurrect
   the per-bolt-dot icon.
3. **Current target, agreed as the right general direction but explicitly
   wanted "even more premium"**: precision engineering / bespoke-fitting
   certificate aesthetic, not workshop, not motorsport-HUD either (that
   was raised and implicitly the user wants to go a level up from that
   too — the request was "ещё более премиальное" after blueprint/telemetry
   was accepted as directionally right). Reference points explicitly
   discussed and approved as inspiration (not to be copied literally —
   they're a different industry, not this brand):
   - Fine watchmaking certificates (Patek Philippe / Vacheron Constantin
     style): dense cream/dark stock, engraved-thin linework instead of
     bold ink, one restrained accent element (a medallion/seal), generous
     negative space.
   - Bespoke tailoring fit cards — genuinely on-theme, since "fitting" is
     literally the same word/concept in tailoring as in wheel fitment.
   - Museum/archival object plaques (e.g. how a car museum labels a
     piece) — engraved brass-plate typography, minimal text, lots of air.
   - Patent/engineering technical drawings for the data-as-diagram
     concept: thin dimension lines with arrowhead ticks and mm callouts
     — e.g. for a failed PCD check, draw two dimension-labeled circles
     (the wheel's PCD and the vehicle's required PCD) so the *magnitude*
     of the mismatch is visible, not just pass/fail — this is the
     corrected replacement for the rejected bolt-dot icon, and needs to
     be built out for pass/fail/conditional states before it's proven.

   Concrete changes agreed but **not yet built into a mockup**: replace
   the rubber-stamp badge with a thin engraved medallion; rename
   "наряд-заказ №" to something in the certificate/dossier register;
   thinner linework (0.5px) in a muted metallic or the existing status
   green, not lime (lime stays reserved for the single primary CTA per
   DESIGN.md's "scarce accent" rule); pull back from heavy/900-weight
   type almost everywhere — reserve boldness for one word per screen;
   make the garage/product photography smaller and more precisely
   composed rather than a bled full-card background — premium object
   photography (watches, cars) tends to show the object small and exact
   with air around it, not filling the frame.

## Immediate next step

Rebuild the `Fitment-GarageIdentity` board (or a new one alongside it)
applying the certificate/engraving direction above, including a real
attempt at the dimension-line diagram for a **failed** PCD check (the
part that was never actually designed — the rejected version only showed
the passing state). Confirm the direction with the user on that one
concrete screen before propagating it to the Create-flow sequence, the
Dashboard, or anywhere else — every wholesale style pass so far in this
thread turned out to need at least one correction after being shown.

## What this document is not

- Not a finished design system — it's a handoff of an in-progress,
  twice-corrected creative direction, mid-exploration.
- Not a claim that the certificate/engraving direction is approved —
  it's the current working hypothesis, one step past two rejected ones,
  itself not yet validated against an actual rebuilt mockup.
- Not a restatement of #12's live-inspected token table or the two
  confirmed defects (focus-ring, panel-color drift) — still accurate,
  just not repeated here; read #12 for those if implementing them.
