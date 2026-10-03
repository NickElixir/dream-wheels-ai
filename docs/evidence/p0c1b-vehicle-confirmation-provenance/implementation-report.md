# P0-C1b VEHICLE CONFIRMATION PROVENANCE REPORT

## 1. Base staging SHA

`6224349af76a5f3ce5385c4f9b52c51de124cd9a`, verified against fetched staging before creating the implementation branch.

## 2. Branch

`feature/p0c1b-vehicle-confirmation-provenance`.

## 3. PR

Separate implementation PR targeting staging. The delivery response supplies its URL. No automatic merge.

## 4. HEAD

The delivery response supplies the verified GitHub PR HEAD. This report is committed with the implementation, so it does not embed its own commit hash.

## 5. Existing audit architecture found

`fitment_change_events` supplies event ID/type, job/Vehicle/Rim relations, actor, created_at, before/after revisions and JSON changes. `_insert_fitment_change_event` writes using the caller's connection inside its canonical transaction. The existing mutation audit only recorded effective changes; accepted no-ops could leave no persistent intent evidence. The existing history query reads these persisted rows. No parallel audit subsystem is introduced.

## 6. New event contract

`vehicle_confirmation_intent`: `actor_type=user`, actor from server-authenticated principal, job and VehicleIdentity from the owner-filtered canonical row, database timestamp, before/after Vehicle revisions equal to the revision at acceptance. Rim columns null. JSON: `intent=explicit_confirm`, `surface=technical_fitment`, action `save_vehicle`, `apply_vehicle_variant`, or `replace_vehicle_variant`. No client actor ID or sensitive request data.

## 7. Trigger semantics

One intent per accepted explicit Vehicle PATCH or variant apply/replace. First save attaches a new identity and records intent; changed saves preserve mutation events plus intent; identical confirmed values produce intent without mutation. Variant same-selection paths recheck the locked row before accepting and writing intent. Final configuration confirmation is auditable independently of prior Vehicle entry. Intent proves an accepted action, not complete readiness or render permission.

## 8. Non-trigger cases

Create, recognition/proposals, candidate selection without Save, catalogue browsing, GET/refresh, variant lookup/reselect, Wheel-only Save: no intent writer. Invalid catalogue/validation, stale revision and wrong owner fail before intent. Source search confines writer calls to the three canonical Fitment actions.

## 9. Revision semantics

Real local PostgreSQL: confirmed identical save revision `2 -> 2`; the complete Vehicle row, including provenance, provider mappings and timestamps, stays equal. Existing current Check remains current and unchanged. Changed save follows existing revision semantics to revision 3. First entry followed by domain confirmation retains the existing domain revision transition; intent itself never advances revision.

## 10. Transactionality / idempotency

Canonical writes, attachment, mutation audit and intent use the same transaction. Forced intent-insert rejection rolls back first identity creation and job attachment, with no persisted event. Two accepted concurrent no-ops yield two intents at one revision. Competing changed saves yield one success and one revision conflict with no losing event. There is no request-level idempotency key; response-loss replay of a no-op cannot be distinguished from another user action. Existing frontend submission guards remain. No revision uniqueness constraint or general replay redesign.

## 11. Schema/migration

`0038_vehicle_confirmation_intent.sql` widens the existing CHECK event-type allowlist, preserving all eight earlier types. No historical DML/backfill. Applied twice successfully on isolated PostgreSQL. Apply before deploying the writer; old code is compatible with the widened constraint. No staging/production migration was executed. Code rollback can retain the widened constraint and existing events.

## 12. Tests added

Real local PostgreSQL persistence/readback, owner filtering, first/changed/identical saves, failed validation, stale conflicts, Wheel-only isolation, current Check preservation, concurrent acceptance/conflict, and forced atomic rollback. Unit variant apply/replacement tests cover same-selection intent and locked revision races. Frontend regression ensures clean Vehicle Save sends Vehicle without Wheel; migration allowlist test prevents loss of old types. CI runs the durable database test against its existing PostgreSQL service.

## 13. Read-only audit evidence

`confirmation-readback.sql` joins job -> VehicleIdentity -> intent and verifies actor against both owners, Technical Fitment surface, intent and revision columns. The actual delivered SELECT executes in a read-only local transaction: six accepted intents, zero failed-job intents. Existing history query also reads six intents. Presence proves confirmation at the recorded revision; historical absence is not proof of no confirmation. See `database-evidence.json` and `database-readback.log`.

## 14. Full verification

- Full backend with both optional local PostgreSQL integration targets: **673 PASS / 5 skipped**, 20 existing deprecation warnings.
- Ordinary backend without optional database targets: **671 PASS / 7 skipped**.
- Frontend: **208 PASS**.
- Fitment transitions / boot: **132 PASS**.
- Production build: **PASS**.
- Ruff check / format: **PASS**.
- Diff whitespace check: **PASS** before delivery.
- Dedicated local DB test rerun after adding execution of the delivered read-only query: **1 PASS**.

Logs are adjacent. Browser smoke uses production controller/view with deterministic API doubles, not live staging. Same-value Save sends canonical Vehicle spelling only; changed year survives even with clean dirty bookkeeping; invalid missing year sends no PATCH. Browser error/warning console empty. Screenshots and transcript saved. Persistence claims come from PostgreSQL, not browser doubles.

## 15. Regressions

Create and recognition routes do not call the new writer. Catalogue and provisional variant operations do not call it. Wheel-only requests preserve Vehicle independence. Existing Fitment authoritative states, Check currentness, verdict, render permission, Result and History presentation retain their implementations. Source-only frontend correction is necessary because a clean explicit Vehicle Save previously omitted Vehicle; canonical equivalent spelling prevents slug hydration from fabricating a mutation. No new frontend confirmation boolean.

## 16. Historical N-06 status

**NO-GO / NOT EXECUTED**. Safe historical downgrade set = 0. No ambiguous identities, revisions, old audit events or staging rows were changed. Future instrumentation cannot reconstruct historical missing intent.

## 17. New findings

- BLOCKER: none found in local verification.
- HIGH: none found.
- MEDIUM: existing absence of request-level replay identity, documented above; an accepted no-op replay records another intent. No new attribution claim that distinguishes independent clicks from retry.
- LOW: none requiring implementation changes.

Release prerequisite: apply migration 0038 before the writer. Authenticated staging E2E and independent review remain separate gates; neither is claimed complete.

## 18. READY FOR INDEPENDENT REVIEW

**YES** — bounded future-provenance implementation with durable database evidence and browser smoke. Merge/deploy are not performed by this task.
