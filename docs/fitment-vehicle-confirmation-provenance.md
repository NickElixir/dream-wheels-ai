# Explicit Vehicle confirmation provenance

Vehicle confirmation is evidenced by an explicit audit intent, rather than inferred solely from `is_user_confirmed`, field source, or revision changes.

## Contract

`fitment_change_events` remains the audit store. `_insert_fitment_change_event` is the transaction-bound writer. A new `vehicle_confirmation_intent` event records an authenticated owner's accepted Technical Fitment action.

Columns supply `job_id`, `vehicle_identity_id`, server-derived `actor_user_id`, `actor_type=user`, and database `created_at`. Both Vehicle revision columns contain the canonical revision **at confirmation**, so they may be equal. Rim IDs/revisions are null for this Vehicle-only event. Its JSON payload is:

```json
{"intent":"explicit_vehicle_action","surface":"technical_fitment","action":"save_vehicle","outcome":"saved"}
```

Actions are `save_vehicle`, `apply_vehicle_variant`, or `replace_vehicle_variant`, selected by the backend endpoint. The payload contains no auth data, client actor ID, email, or raw request headers.

The backend derives `outcome` from the final canonical row using `_vehicle_state_from_row`: `confirmed_ready` yields `confirmed`; other states yield `saved`. Variant actions additionally require `_modification_from_row(row)[0] == "confirmed"`. No request outcome is trusted.

Event presence alone is not proof of genuine confirmation. `outcome=saved` records an accepted explicit save whose final fields still require confirmation; `outcome=confirmed` records an accepted explicit action leaving genuinely confirmed canonical fields (and configuration for variant actions). The genuine-confirmation evidence predicate is `event_type=vehicle_confirmation_intent AND changes.outcome=confirmed`.

This event proves an accepted explicit save/confirmation action. It does not assert that every field is confirmed, that a catalogue variant is ready, that a Check passed, or that rendering is permitted. Existing staged entry/confirmation semantics remain authoritative.

## Boundaries

- PATCH `/jobs/{id}/fitment` with a nonempty Vehicle section means explicit Vehicle Save. First attachment, changed values, and accepted identical values each emit one intent, after validation/conflict resolution, inside the canonical transaction. Existing mutation events remain.
- Wheel-only PATCH omits Vehicle and emits no Vehicle intent. Legacy combined requests containing Vehicle remain canonical Vehicle submissions, as before; the API has no separate UI-button attribution for old clients.
- POST `vehicle-variants/apply` and `vehicle-variants/replace` are explicit configuration confirmation boundaries. Accepted changed and same-selection calls emit one intent. Same-selection paths re-read under the existing job lock before accepting; failed races emit none.
- GETs, recognition/proposal retrieval, client candidate selection, catalogue browsing, variant lookup/reselect and automatic provider selection emit no intent.
- Validation, auth/owner failure and stale revisions emit none. An intent insertion failure aborts the canonical transaction, including first identity creation/attachment and mutation history.

## Revision and frontend behavior

A same-value explicit confirmation creates durable intent without incrementing Vehicle revision, rewriting field provenance, changing timestamps, invalidating a current Check, or changing Result/History. Real domain changes follow existing rules.

The frontend already separates Vehicle/Wheel actions and prevents immediate double-submit using `fitmentSaving` / `fitmentVehicleVariantApplying`. Vehicle Save now always submits Vehicle. When the actual values match the saved Vehicle, catalogue slug/label hydration is translated back to the saved canonical spelling for the request; changed values keep their existing submission path. No new trusted confirmation boolean is introduced.

## Replay limitation

These endpoints do not have request-level idempotency keys. Each independently accepted request produces an intent. Concurrent same-value requests may both succeed and produce two events on the same revision; changed saves serialize and stale competitors conflict. Response-loss retry of an identical no-op cannot be distinguished from a second explicit action. Do not deduplicate by `(vehicle_identity_id, revision)`. A request-key redesign is outside this change.

## Schema and rollout

Apply additive migration `0038_vehicle_confirmation_intent.sql` **before** deploying this writer. It widens the existing event allowlist, preserves all previous event types, and performs no data backfill. Applying it twice is covered on isolated PostgreSQL. Old code remains compatible with the widened allowlist. Rolling code back does not require narrowing the constraint; narrowing after new events exist would reject preserved intent rows.

No staging/production migration or data mutation is part of this implementation delivery. Database deployment requires a separate release action.

## Historical N-06

Historical N-06 downgrade: **NO-GO / NOT EXECUTED**. Historical provenance is insufficient; the proven safe downgrade candidate set is zero. New instrumentation cannot reconstruct old no-op confirmations and does not make the 24 ambiguous audit rows automatically migratable.

## Verification

`tests/test_vehicle_confirmation_provenance.py` uses a uniquely named schema on an explicitly configured **local-only** PostgreSQL target. It applies real model migrations, invokes the canonical endpoint function, reads persisted events via SQL and the existing history query, tests concurrency, and forces an audit insert failure to prove rollback. Provider/auth doubles avoid external services; ownership is still enforced by the real owner-filtered database query.

`docs/evidence/p0c1b-vehicle-confirmation-provenance/confirmation-readback.sql` is the read-only future provenance example. Only rows with `outcome=confirmed` are positive confirmation evidence at the recorded revision; absence never proves absence of a historical user action.

The browser fixture executes production controller/view modules with deterministic local API doubles. Its screenshots/transcript verify UI behavior; the PostgreSQL test supplies persistence/transaction evidence. These checks are not authenticated staging E2E.
