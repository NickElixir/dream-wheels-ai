# Dream Wheels AI — VNext Design Code Amendment

**Date:** 2026-09-27
**Status:** APPROVED

## Purpose and authority

This amendment records approved implementation rules discovered during the Create and Fitment runtime reconciliation. It supplements the frozen VNext Design Code without rewriting its history.

This amendment is the current implementation authority for the rules listed below and narrowly overrides frozen VNext v0.1 where those rules apply. All other provisions of v0.1 and the canonical VNext prototype remain unchanged.

The authority order for VNext implementation is:

1. Explicitly approved PR/design decision.
2. This 2026-09-27 amendment, for the rules in its scope.
3. Frozen VNext v0.1 Design Code and canonical prototype.
4. Legacy visual conventions, only where the higher authorities leave a choice open.

An implementation must not infer a new user-visible pattern from this document. Any pattern not specified by the applicable approved authority requires explicit approval before implementation.

## Approved rules

1. **Fitment is contextual, not global navigation.** Keep the Fitment route and entry points from Create, Result, and History → Result; do not expose Fitment as a persistent top-level navigation destination.
2. **Controls belong to the object they change.** Place an action beside or within its relevant vehicle, wheel, render, or other object context.
3. **Wheel product URLs belong to the wheel context.** The URL action and its disclosure are inside the wheel object and remain additional to manual wheel-photo upload.
4. **Raw filenames and file sizes are not primary user metadata.** Do not show them in the primary Create composition; retain only where needed for internal state, diagnostics, or accessibility.
5. **Blocking asynchronous states show status and a spinner.** Do not fabricate percentages or progress. Respect `prefers-reduced-motion`.
6. **Required choices stay visible until selection.** A choice required by runtime state cannot be hidden or collapsed before the user makes that selection.
7. **Recovery actions have an explicit interactive affordance.** Manual entry, URL retry, choosing a variant, and parameter recovery must be presented as controls, not plain body copy.
8. **Backend candidate collections are not standalone UI entities.** Do not expose internal candidate arrays as a separate “candidates” section.
9. **Candidate suggestions belong to their matching field or choice.** Selecting one updates that field through the existing runtime setter.
10. **Rounded choice surfaces are selective.** Use them for selectable variants/candidates, whole clickable choices, or object ownership where grouping needs a surface—not for every content block.
11. **Divider rows organize static information.** Use them for metadata, label/value pairs, technical evidence, dates, and static specifications.
12. **Fitment is summary-first with progressive disclosure.** Show the vehicle and wheel summaries, their statuses, the technical-check state, and the contextual action first. Open an editor only for the object requiring intervention or after an explicit edit action.
13. **Fitment readiness copy follows backend `next_action`.** Map `complete_vehicle_details`, `select_vehicle_variant`, `complete_rim_specs`, and `run_standard_check` to their approved user-facing instructions. Do not infer “ready” merely because no check exists.
14. **New user-visible patterns require explicit approval.** If implementation requires a pattern outside the governing approved specification, stop and request a decision.
15. **Every UI PR includes a `UI_CHANGE_MANIFEST`.** It records user-visible changes, new elements, removed elements, interaction-pattern changes, each change’s source authority, and any unspecified design decisions. If none, state `NONE`.

## Scope boundary

These rules govern presentation and interaction hierarchy only. They do not authorize changes to backend behavior, database schema, API contracts, Fitment verdict semantics, render permission, identity lifecycle, credits/payments, authentication, or production deployment. Existing domain and server-owned state remain authoritative.
