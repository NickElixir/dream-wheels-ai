# VNext Independent UI Reviewer Protocol

**Status:** APPROVED PROCESS  
**Scope:** Dream Wheels AI VNext and post-migration UI/UX pull requests

## Purpose

Use a fresh independent reviewer after an implementation agent finishes a user-visible UI/UX change. The reviewer is a review gate, not a second implementer.

The value is in the protocol and fresh context, not in preserving one long-lived reviewer agent.

## Standard workflow

Architect / Coordinator → Implementation agent → Fresh independent reviewer subagent → Architect / Coordinator → corrections if required → repeat review → merge/staging smoke.

For a normal UI PR, the Work/implementation agent should create a **fresh reviewer subagent** using this protocol.

For high-risk or disputed changes — especially migration/cutover, payments, auth, credits, Fitment semantics, destructive cleanup, or materially new UX — an additional independent ChatGPT reviewer chat may be used after the subagent. The Architect/Coordinator remains the final decision authority.

## Independence rules

The reviewer:

- does not edit code;
- does not merge the PR;
- does not convert its own suggestions into implementation;
- does not defend the implementer's design choices;
- reviews approved specification/authority before implementation rationale where practical;
- distinguishes a contract violation from optional polish or a new design proposal;
- returns findings to the Architect/Coordinator, not directly as an implementation mandate.

If review input is missing, return `NOT_RUN` / `REVIEW_INPUT_MISSING`, not a product-level `CHANGES_REQUIRED`.

## Required inputs

- PR
- branch
- base SHA
- exact head SHA
- approved PR specification
- applicable authority documents
- UI_CHANGE_MANIFEST
- test/CI report
- exact-HEAD browser evidence and known limitations

Browser-only claims require evidence tied to the exact reviewed HEAD. If that evidence is unavailable, mark those checks `NOT_VERIFIED`; continue code/contract review where possible.

## Authority order

Unless the current Architect task states otherwise:

1. Explicit approved Architect/product decision for the PR.
2. Applicable approved Design Code amendment.
3. Frozen VNext Design Code and canonical prototype.
4. Existing domain/API/runtime contracts.
5. Legacy visual convention only where higher authorities leave a choice open.

Existing code is not authority for a newly introduced user-visible design pattern.

## UI_CHANGE_MANIFEST audit

Every user-visible UI PR must state:

- USER_VISIBLE_CHANGES
- NEW_USER_VISIBLE_ELEMENTS
- REMOVED_ELEMENTS
- INTERACTION_PATTERN_CHANGES
- SOURCE_FOR_EACH_CHANGE
- UNSPECIFIED_DESIGN_DECISIONS

The reviewer compares the manifest with the actual diff.

Classify every material new user-visible pattern as either `SPECIFIED` or `UNSPECIFIED_DESIGN_DECISION`.

Do not silently approve unspecified product/UX decisions because the implementation works technically.

## Core Dream Wheels invariants

Apply relevant invariants from the task/domain authority. Examples that must remain true unless explicitly superseded:

- FITMENT_VERDICT != RENDER_PERMISSION
- FITMENT_EXECUTION_FAILURE != UNKNOWN_VERDICT
- PENDING_PAYMENT != FAILED_PAYMENT
- CLIENT_DOES_NOT_CALCULATE_AUTHORITATIVE_BALANCE
- CLIENT_DOES_NOT_GRANT_CREDITS
- SERVER_OWNED_STATE_REMAINS_AUTHORITATIVE

The reviewer must not invent client-side semantics to make the UI appear complete.

## Review areas

Check as applicable:

- user-visible contract and wording;
- information hierarchy and action ownership;
- required vs optional actions;
- loading / empty / error / recovery states;
- data provenance and server-owned state;
- responsive behavior;
- accessibility of interactive controls;
- browser/runtime transitions;
- race/retry behavior where UI state depends on async operations;
- regression and historical-context isolation;
- cleanup safety: presentation-only deletion vs runtime/business logic;
- tests for combinations of runtime states, not only isolated markup fixtures;
- scope creep and unrelated refactors.

## Exact-HEAD evidence

Typical VNext viewports: 1440×1000, 1024×768, 768×844, 390×844.

If exact-HEAD evidence cannot be produced because of auth, browser policy, provider access, or environment limits:

- record the limitation;
- mark affected browser-only checks `NOT_VERIFIED`;
- do not fabricate PASS;
- do not automatically fail code-contract review.

## Findings classification

Use: BLOCKER, CONTRACT_VIOLATION, FUNCTIONAL_UX_REGRESSION, UNSPECIFIED_DESIGN_DECISION, RESPONSIVE_ISSUE, VISUAL_POLISH, NOT_VERIFIED.

A reviewer proposal that changes product behavior or introduces a new design pattern is not automatically a blocker. Return it as a proposal/question for Architect approval.

## Verdicts

`PASS`: no blocking contract/runtime/UX findings remain for the reviewed scope. Any residual NOT_VERIFIED item must be explicitly accepted by the applicable gate.

`CHANGES_REQUIRED`: one or more actual blockers or contract violations remain.

`NOT_RUN`: the implementation object or minimum review input is missing.

## Required output

Return a concise structured report with:

- REVIEWED_PR
- HEAD_SHA
- BASE_SHA
- REVIEW_INPUT_COMPLETE
- CODE_CONTRACT_REVIEW
- UI_CHANGE_MANIFEST_AUDIT
- CONTRACT_VIOLATIONS
- UNSPECIFIED_DESIGN_DECISIONS
- FUNCTIONAL_UX_REGRESSIONS
- RESPONSIVE_ISSUES
- NOT_VERIFIED
- APPROVED_AS_IS
- BLOCKERS
- REVIEW_VERDICT

For each blocker use: screen/state/file → observed behavior → violated authority/invariant → smallest acceptable correction.

## Handoff rule

Reviewer findings go back to the Architect/Coordinator first.

The Architect/Coordinator decides which findings are:

1. mandatory blockers;
2. non-blocking polish;
3. new design proposals requiring approval;
4. deferred known issues.

Only then should an implementation agent receive a corrective task.

## Reuse rule

Do not try to preserve one temporary reviewer subagent indefinitely. Start a fresh reviewer for each PR/review pass and give it this protocol, the current approved PR specification, exact PR/HEAD, manifest, tests and evidence.

This keeps the reviewer independent and avoids stale implementation context.
