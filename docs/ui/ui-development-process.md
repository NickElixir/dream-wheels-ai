# Dream Wheels AI — UI Development Process

## Status and authority

`UI_DEVELOPMENT_PROCESS = FROZEN`

This is the canonical delivery process for UI work. The canonical visual/design
contract is [UI Design Code](../ui-design-code.md). The UI state specification
for a feature is its behavioural authority; an interactive HTML prototype is
its visual reference. If they conflict, the state specification wins.

Existing repository design, code and documentation are constraints on this
process. Codex must not invent new UX states or a new visual language during
runtime implementation.

## Mandatory pipeline

```text
Product/domain contract
  → State inventory
  → Text wireframe
  → State/CTA matrix
  → Copy/error matrix
  → Interactive HTML prototype
  → mobile 390px + desktop visual QA
  → UI contract freeze
  → runtime mapping/implementation
  → state-based staging E2E
```

Implementation begins only after an explicit UI contract freeze for the
affected feature. A change to the underlying product/domain contract returns
the work to the appropriate earlier stage; it must not be patched only in the
frontend.

## Required design rules

### State inventory first

- Design the happy path together with loading, empty, partial, error,
  authentication and stale states.
- Incompatible states of one component must be mutually exclusive. A screen
  must not simultaneously claim, for example, loading and completed,
  authenticated and session-expired, or technical unknown and provider failure.
- Confirmation and readiness badges require an exact domain definition before
  their text, colour or placement is designed.
- Every action declares its data source of truth before the wireframe is
  created. The frontend uses authoritative backend/domain state and does not
  create a parallel heuristic state.

### CTA and copy before prototype

- Define CTA prerequisites, enabled/disabled behaviour and next action before
  HTML exists.
- Define each `machine/error code → UI category → user copy → CTA` mapping
  before runtime implementation. Users see mapped recovery guidance, not a
  generic `Сбой` or internal technical detail.
- Resolve Russian and English copy, warnings and disclaimer placement within
  the state/CTA matrix. Follow the terminology and punctuation rules in the
  UI Design Code.

### Prototype and visual QA

- An interactive HTML prototype is the visual reference, not a runtime source
  of truth.
- Test the prototype at mobile 390 px and desktop before the UI contract is
  frozen. Check hierarchy, mobile navigation, overflow, image composition,
  sticky CTA boundaries, safe area, keyboard reachability and adjacent flows.
- Reuse existing components and approved patterns where they fit. A prototype
  cannot silently override the product/domain contract.

### Runtime mapping and E2E

- Map the frozen UI states to authoritative runtime responses and machine
  codes. Do not add a state merely because an implementation path is
  convenient.
- Build staging E2E from the approved state matrix, not only from the happy
  path. It must exercise each relevant loading, empty, partial, error, auth
  and stale/recovery branch.

## Lessons enforced by process

The process prevents recurring classes of mistakes:

- duplicate hierarchy;
- excessive subtitles;
- sticky CTA overlap;
- mobile overflow;
- mixed terminology;
- duplicate navigation;
- generic AI aesthetics;
- technical/internal copy exposed to users;
- conflicting simultaneous states;
- stale source-of-truth actions;
- incorrect confirmation/readiness labels;
- generic `Сбой` instead of a mapped error state.

A review that detects any item above returns to the state inventory, matrix or
prototype stage rather than papering over it in runtime code.

## Fitment next artifact

Standard Fitment architecture is already frozen in
[Fitment Verdict V1](../fitment/fitment-verdict-v1.md). This process does not
alter it.

The next separate artifact is
`docs/ui/fitment-ui-state-spec-v1.md`. It will later contain:

- state inventory;
- text wireframes;
- CTA matrix;
- copy/error matrix;
- responsive behaviour;
- prototype reference;
- E2E state matrix.

This document intentionally does not define those Fitment UI states in advance.

## Entry condition for Standard Fitment state design

```text
UI_DESIGN_BASELINE = FROZEN
UI_DEVELOPMENT_PROCESS = FROZEN
UI_BLOCKERS_FOR_FITMENT_STATE_DESIGN = NONE
NEXT = Standard Fitment state inventory
```

