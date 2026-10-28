# P0-C1b MEDIUM-1 CORRECTIVE REPORT

PR #254; existing branch `feature/p0c1b-vehicle-confirmation-provenance`, base staging `6224349af76a5f3ce5385c4f9b52c51de124cd9a`.

## 1. Starting HEAD

`f16b2857996e96c2bdc87c85ef52ca6dc999ea4a`.

## 2. New HEAD

The delivery response supplies the verified pushed commit hash. This report is part of that commit and cannot embed its own hash.

## 3. Commit

One focused commit: `fix: distinguish Vehicle save from confirmation provenance`.

## 4. Root cause

Every accepted Vehicle action used the same `explicit_confirm` payload, including H1 first entry with proposed fields. Presence of intent alone could be misread as genuine confirmation evidence.

## 5. Final event contract

Event type remains `vehicle_confirmation_intent`. JSON: `intent=explicit_vehicle_action`, `surface=technical_fitment`, existing action enum and `outcome=saved|confirmed`. Actor, identifiers, timestamp and revision remain server-derived columns. Failed operations emit no event.

## 6. Backend outcome derivation

The helper reads the final canonical row inside the existing transaction. Existing `_vehicle_state_from_row(row)` uses authoritative per-field confirmation provenance (legacy aggregate fallback only where provenance absent). `confirmed_ready` yields `confirmed`; all other states yield `saved`. Variant actions additionally require `_modification_from_row(row)[0] == confirmed`, including its revision-bound mapping validation. No outcome argument is accepted from callers or frontend; endpoint names alone cannot produce confirmed outcome.

## 7. H1 two-step semantics

Real local PostgreSQL, canonical endpoint:

| Action | Revision | Resulting Vehicle state | Outcome |
| --- | --- | --- | --- |
| First Save | 0 -> 1 | unconfirmed; all fields proposed | saved |
| Explicit confirmation of same values | 1 -> 2 | confirmed_ready; fields confirmed | confirmed |
| Confirmed no-op | 2 -> 2 | confirmed_ready | confirmed |

No-op full Vehicle row is equal, including timestamp, field provenance and mappings. Current Check remains current, and its full row is unchanged.

## 8. Changed Vehicle semantics

Changing year on the confirmed Vehicle advances revision `2 -> 3`; changed year becomes proposed while unchanged fields stay confirmed, producing `confirmed_incomplete`. Therefore outcome is **saved**. This follows real H1 domain behavior, not an endpoint-name assumption; the real DB test asserts field and state outcomes.

## 9. Variant apply / replace outcomes

Accepted apply, actual replace and same-selection apply/replace assert `outcome=confirmed` from resulting canonical confirmed fields and revision-bound confirmed modification. Same-selection tests retain no canonical updates/revision changes. Provider/revision/selection failures retain no accepted intent. Existing mutation events stay intact.

## 10. Readback semantics

Genuine confirmation requires `event_type='vehicle_confirmation_intent' AND changes->>'outcome'='confirmed'`, with owner/actor, job/identity and Technical Fitment origin checks. `confirmation-readback.sql` now uses neutral intent and filters confirmed outcome. Its confirmation-revision alias is valid because saved rows cannot enter this result.

The delivered SQL actually executes in a read-only local transaction: six total intents, two saved, four confirmed evidence rows. First proposed Save is explicitly excluded by event ID. Generic history still reads all six accepted actions. No UI mapping turns this internal event into unconditional “Vehicle confirmed”; repo-wide runtime search found no such mapping.

## 11. Transactionality

No transaction boundaries changed. Forced audit-insert failure still rolls back identity creation, attachment and mutation event. Concurrent no-ops remain accepted; changed-save competitor conflicts. Validation/catalogue failure, stale revisions and wrong ownership create no event.

## 12. Migration impact

No new migration. Migration 0038 is unchanged, additive and without backfill. No staging migration or writes. Release ordering remains focused review -> apply 0038 staging -> verify constraint -> merge writer.

## 13. Tests added/updated

Real PostgreSQL test now asserts proposed first-save fields, confirmed second-save fields, confirmed no-op, changed proposed year, all-event outcome counts and genuine readback exclusion/inclusion. Unit tests assert outcomes for accepted apply, changed replace and identical apply/replace. Existing failure, owner, Wheel-only and atomic rollback tests remain active. The same real PostgreSQL test remains wired into CI.

## 14. Full verification

- Backend with both local PG targets: **673 PASS / 5 skipped**, 20 existing deprecation warnings.
- Dedicated real PostgreSQL provenance/readback test: **1 PASS**.
- Frontend: **208 PASS**.
- Transition/boot: **132 PASS**.
- Production build: **PASS**.
- Ruff check / format: **PASS**.
- Diff check: **PASS**.
- Commit hooks: run during delivery.

Adjacent logs and JSON provide evidence. CI on the new pushed HEAD is asynchronous; the original green CI is not claimed as new-HEAD CI evidence.

## 15. Browser smoke

Production controller/view modules with local API doubles: first Save shows confirmation required; explicit “Подтвердить данные” enters configuration picker; confirmed no-op preserves revision. Console warnings/errors empty. No outcome is sent by the frontend. Fixture transcript/screenshot are saved here. This is not live staging E2E; audit durability is proven by PostgreSQL.

## 16. Historical N-06

**NO-GO / NOT EXECUTED**. No historical events/identities or ambiguous rows changed; absence remains non-evidence.

## 17. Deferred findings

Request replay/idempotency, LOW-1 canonical catalogue spelling mutation test, and staggered Vehicle-only 422 are unchanged/out of scope. Event count does not prove independent physical clicks.

## 18. New findings

BLOCKER: 0. HIGH: 0. MEDIUM: 0 new. LOW: 0 new. Existing deferred limitations remain documented. MEDIUM-1 is addressed by server-derived outcome and confirmed-only readback.

## 19. READY FOR FOCUSED INDEPENDENT RE-REVIEW

**YES**. No merge, migration deployment or staging data mutation performed. Stop after pushing the corrective HEAD for focused independent re-review.
