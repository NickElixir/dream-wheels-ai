"""Real PostgreSQL readback/rollback tests; never connect to staging or production."""

import asyncio
import json
import os
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

import asyncpg
import pytest
from fastapi import HTTPException

from src import jobs_api
from src.auth_principal import AuthPrincipal
from src.identity_service import FitmentDetailsUpdateRequest


@pytest.mark.parametrize("staggered", [False, True])
def test_local_vehicle_confirmation_persistence_and_rollback(monkeypatch, staggered):
    dsn = os.environ.get("TEST_VEHICLE_CONFIRMATION_DATABASE_URL")
    if not dsn:
        pytest.skip("Set TEST_VEHICLE_CONFIRMATION_DATABASE_URL to isolated local PostgreSQL")
    target = urlsplit(dsn)
    assert target.hostname in {"127.0.0.1", "localhost", "::1"} and not target.query

    async def scenario():
        admin = await asyncpg.connect(dsn)
        schema = "vehicle_intent_test_" + uuid4().hex
        await admin.execute(f'CREATE SCHEMA "{schema}"')
        await admin.execute(f'SET search_path TO "{schema}"')
        pool = None
        try:
            await admin.execute(
                "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; END $$"
            )
            root = Path(__file__).resolve().parents[1]
            for number in (
                "0001",
                "0005",
                "0009",
                "0015",
                "0017",
                "0019",
                "0020",
                "0021",
                "0022",
                "0026",
                "0028",
                "0035",
                "0036",
                "0038",
                "0038",
            ):
                await admin.execute(next((root / "migrations").glob(number + "*.sql")).read_text())
            pool = await asyncpg.create_pool(
                dsn,
                min_size=1,
                max_size=3,
                server_settings={"search_path": schema},
                statement_cache_size=0,
            )
            monkeypatch.setattr(jobs_api.db, "get_pool", lambda: pool)
            owner = await admin.fetchval(
                "INSERT INTO users(telegram_user_id) VALUES(12345) RETURNING id"
            )
            other = await admin.fetchval(
                "INSERT INTO users(telegram_user_id) VALUES(12346) RETURNING id"
            )
            principal_user = owner

            async def auth(**kwargs):
                return AuthPrincipal(
                    user_id=principal_user,
                    authority="telegram",
                    subject="12345",
                    auth_channel="website",
                )

            async def catalogue(provider, *, make, model, region, year):
                if make == "invalid":
                    return None
                return {
                    "make": make,
                    "model": model,
                    "year": year,
                    "region": region,
                    "make_slug": make.casefold(),
                    "model_slug": model.casefold(),
                }

            monkeypatch.setattr(jobs_api, "_resolve_jobs_auth", auth)
            monkeypatch.setattr(jobs_api, "_resolve_exact_vehicle_catalogue_selection", catalogue)

            async def new_job():
                rim = await admin.fetchval(
                    "INSERT INTO rim_specs(owner_user_id) VALUES($1) RETURNING id", owner
                )
                rear = (
                    (
                        await admin.fetchval(
                            "INSERT INTO rim_specs(owner_user_id,offset_et_mm,wheel_width_j) VALUES($1,42.75,9.5) RETURNING id",
                            owner,
                        )
                    )
                    if staggered
                    else rim
                )
                setup = await admin.fetchval(
                    "INSERT INTO rim_setups(owner_user_id,front_rim_spec_id,rear_rim_spec_id,is_staggered) VALUES($1,$2,$3,$4) RETURNING id",
                    owner,
                    rim,
                    rear,
                    staggered,
                )
                return str(
                    await admin.fetchval(
                        "INSERT INTO jobs(user_id,status,rim_setup_id,render_input_snapshot) VALUES($1,'completed',$2,'{\"vehicle\":null,\"vehicle_identity_id\":null}') RETURNING id",
                        owner,
                        setup,
                    )
                )

            job = await new_job()

            async def save(values, revision, job_id=job):
                request = FitmentDetailsUpdateRequest(
                    vehicle=values, expected_vehicle_revision=revision, expected_rim_revision=1
                )
                return await jobs_api.save_fitment_details(job_id, request)

            async def events(job_id=job):
                return await admin.fetch(
                    "SELECT id,event_type,actor_user_id,vehicle_identity_id,vehicle_revision_before,vehicle_revision_after,changes FROM fitment_change_events WHERE job_id=$1::uuid ORDER BY created_at,id",
                    job_id,
                )

            async def intents(job_id=job):
                return [
                    e
                    for e in await events(job_id)
                    if e["event_type"] == "vehicle_confirmation_intent"
                ]

            async def wheel_snapshot():
                setup = dict(
                    await admin.fetchrow(
                        "SELECT s.* FROM rim_setups s JOIN jobs j ON j.rim_setup_id=s.id WHERE j.id=$1::uuid",
                        job,
                    )
                )
                rims = [
                    dict(r)
                    for r in await admin.fetch(
                        "SELECT * FROM rim_specs WHERE id=$1 OR id=$2 ORDER BY id",
                        setup["front_rim_spec_id"],
                        setup["rear_rim_spec_id"],
                    )
                ]
                return setup, rims

            wheel_before = await wheel_snapshot()
            values = {"make": "Audi", "model": "Q8", "year": 2024, "market": "eudm"}
            first = await save(values, 0)
            vi = await admin.fetchval("SELECT vehicle_identity_id FROM jobs WHERE id=$1::uuid", job)
            assert first.vehicle_revision == 1 and vi is not None
            assert first.vehicle_state == "unconfirmed"
            assert all(f.state == "proposed" for f in first.vehicle_field_states.values())
            assert sorted(e["event_type"] for e in await events()) == [
                "user_save",
                "vehicle_confirmation_intent",
            ]
            assert await wheel_snapshot() == wheel_before
            first_intent = (await intents())[0]
            assert (
                first_intent["actor_user_id"] == owner and first_intent["vehicle_identity_id"] == vi
            )
            assert (
                first_intent["vehicle_revision_before"]
                == first_intent["vehicle_revision_after"]
                == 1
            )

            assert json.loads(first_intent["changes"])["outcome"] == "saved"
            confirmed = await save(values, 1)
            assert confirmed.vehicle_revision == 2
            assert confirmed.vehicle_state == "confirmed_ready"
            assert all(f.is_user_confirmed for f in confirmed.vehicle_field_states.values())
            assert json.loads((await intents())[-1]["changes"])["outcome"] == "confirmed"
            before = dict(await admin.fetchrow("SELECT * FROM vehicle_identities WHERE id=$1", vi))
            current_row = await jobs_api._fetch_fitment_job_row(admin, job_id=job, user_id=owner)
            context = {
                "context_identity": {
                    **jobs_api._fitment_context_identity_from_job_row(current_row),
                    "engine_version": jobs_api.ENGINE_VERSION,
                    "rules_version": jobs_api.TOLERANCES_VERSION,
                    "provider_version": jobs_api.PROVIDER_REFERENCE_VERSION,
                }
            }
            check = await admin.fetchval(
                "INSERT INTO fitment_checks(owner_user_id,vehicle_identity_id,rim_setup_id,render_job_id,idempotency_key,input_hash,input_snapshot,execution_status,verdict) VALUES($1,$2,$3::uuid,$4::uuid,'c1b-check','c1b-context',$5::jsonb,'completed','unknown') RETURNING id",
                owner,
                vi,
                current_row["rim_setup_id"],
                job,
                json.dumps(context),
            )
            check_before = dict(
                await admin.fetchrow("SELECT * FROM fitment_checks WHERE id=$1", check)
            )
            assert (await jobs_api._current_check_for_job(admin, current_row)).id == str(check)
            noop = await save(values, 2)
            assert noop.vehicle_state == "confirmed_ready"
            assert json.loads((await intents())[-1]["changes"])["outcome"] == "confirmed"
            after = dict(await admin.fetchrow("SELECT * FROM vehicle_identities WHERE id=$1", vi))
            assert after == before  # Includes revision, timestamps, provenance and mappings.
            current_row = await jobs_api._fetch_fitment_job_row(admin, job_id=job, user_id=owner)
            assert (await jobs_api._current_check_for_job(admin, current_row)).id == str(check)
            assert (
                dict(await admin.fetchrow("SELECT * FROM fitment_checks WHERE id=$1", check))
                == check_before
            )
            assert await wheel_snapshot() == wheel_before
            assert len(await intents()) == 3
            assert len(await events()) == 5  # No fabricated mutation event for the no-op.

            # Concurrent identical explicit requests are both accepted; separate intent evidence.
            await asyncio.gather(save(values, 2), save(values, 2))
            assert len(await intents()) == 5
            assert (
                dict(await admin.fetchrow("SELECT * FROM vehicle_identities WHERE id=$1", vi))
                == before
            )

            # A changed save keeps mutation history; its competitor must conflict under the lock.
            changed = {**values, "year": 2025}
            outcomes = await asyncio.gather(
                save(changed, 2), save(changed, 2), return_exceptions=True
            )
            assert sum(isinstance(o, HTTPException) and o.status_code == 409 for o in outcomes) == 1
            assert len(await intents()) == 6
            accepted = next(o for o in outcomes if not isinstance(o, Exception))
            assert accepted.vehicle_state == "confirmed_incomplete"
            assert accepted.vehicle_field_states["year"].state == "proposed"
            assert json.loads((await intents())[-1]["changes"])["outcome"] == "saved"
            assert (
                await admin.fetchval("SELECT revision FROM vehicle_identities WHERE id=$1", vi) == 3
            )
            mutation = [
                e for e in await events() if e["event_type"] != "vehicle_confirmation_intent"
            ][-1]
            assert (
                mutation["vehicle_revision_before"] == 2 and mutation["vehicle_revision_after"] == 3
            )

            current_row = await jobs_api._fetch_fitment_job_row(admin, job_id=job, user_id=owner)
            stale_check = await jobs_api._current_check_for_job(admin, current_row)
            assert stale_check is None or stale_check.is_stale
            assert await wheel_snapshot() == wheel_before

            # Validation, stale revisions, wrong ownership and Wheel-only saves cannot emit intent.
            for bad_values, revision, status in (
                ({**changed, "make": "invalid"}, 3, 422),
                (changed, 2, 409),
            ):
                with pytest.raises(HTTPException) as failure:
                    await save(bad_values, revision)
                assert failure.value.status_code == status
            principal_user = other
            with pytest.raises(HTTPException) as failure:
                await save(changed, 3)
            assert failure.value.status_code == 404
            principal_user = owner
            assert await wheel_snapshot() == wheel_before
            if staggered:
                with pytest.raises(HTTPException) as missing_rear:
                    await jobs_api.save_fitment_details(
                        job,
                        FitmentDetailsUpdateRequest(
                            rim={"offset_et_mm": 35.25},
                            expected_vehicle_revision=3,
                            expected_rim_revision=1,
                        ),
                    )
                assert missing_rear.value.status_code == 422
                assert missing_rear.value.detail["field"] == "rear_rim"
                assert await wheel_snapshot() == wheel_before
            vehicle_before_wheel = dict(
                await admin.fetchrow("SELECT * FROM vehicle_identities WHERE id=$1", vi)
            )
            wheel = FitmentDetailsUpdateRequest(
                rear_rim={"offset_et_mm": 42.75} if staggered else None,
                rim={"offset_et_mm": 35.25},
                expected_vehicle_revision=3,
                expected_rim_revision=1,
            )
            await jobs_api.save_fitment_details(job, wheel)
            assert (
                dict(await admin.fetchrow("SELECT * FROM vehicle_identities WHERE id=$1", vi))
                == vehicle_before_wheel
            )
            assert len(await intents()) == 6

            # Failure of the intent insert must roll back first identity creation, attachment,
            # and the mutation event that was already inserted in this same transaction.
            failed_job = await new_job()
            identities_before = await admin.fetchval("SELECT count(*) FROM vehicle_identities")
            await admin.execute(
                "CREATE FUNCTION reject_intent() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='vehicle_confirmation_intent' THEN RAISE EXCEPTION 'test intent failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_intent BEFORE INSERT ON fitment_change_events FOR EACH ROW EXECUTE FUNCTION reject_intent()"
            )
            with pytest.raises(asyncpg.RaiseError, match="test intent failure"):
                await save(values, 0, failed_job)
            assert (
                await admin.fetchval(
                    "SELECT vehicle_identity_id FROM jobs WHERE id=$1::uuid", failed_job
                )
                is None
            )
            assert await events(failed_job) == []
            assert (
                await admin.fetchval("SELECT count(*) FROM vehicle_identities") == identities_before
            )
            await admin.execute("DROP TRIGGER reject_intent ON fitment_change_events")

            readback = await jobs_api._fetch_fitment_history_rows(admin, job_id=job, user_id=owner)
            assert sum(e["event_type"] == "vehicle_confirmation_intent" for e in readback) == 6
            assert all(
                json.loads(e["changes"])["surface"] == "technical_fitment" for e in await intents()
            )
            audit_sql = (
                root
                / "docs/evidence/p0c1b-vehicle-confirmation-provenance/confirmation-readback.sql"
            ).read_text()
            audit_select = audit_sql.split("BEGIN READ ONLY;", 1)[1].rsplit("ROLLBACK;", 1)[0]
            async with admin.transaction(readonly=True):
                audit_rows = await admin.fetch(audit_select)
                assert await admin.fetchval("SHOW transaction_read_only") == "on"
            all_outcomes = [json.loads(e["changes"])["outcome"] for e in await intents()]
            assert all_outcomes.count("saved") == 2
            assert all_outcomes.count("confirmed") == 4
            assert len(audit_rows) == 4
            assert first_intent["id"] not in {r["confirmation_event_id"] for r in audit_rows}
            assert all(row["actor_user_id"] == owner for row in audit_rows)
            print(
                "C1B_DB_EVIDENCE="
                + json.dumps(
                    {
                        "setup_mode": "staggered" if staggered else "uniform",
                        "vehicle_only_wheel_rows_unchanged": True,
                        "first_save_intents": 1,
                        "same_value_revision_before": before["revision"],
                        "same_value_revision_after": after["revision"],
                        "same_value_full_row_unchanged": True,
                        "changed_save_revision": 3,
                        "persisted_intents": 6,
                        "saved_intents": 2,
                        "confirmed_evidence_rows": 4,
                        "first_save_state": first.vehicle_state,
                        "confirmation_state": confirmed.vehicle_state,
                        "changed_save_state": accepted.vehicle_state,
                        "failed_job_intents": 0,
                        "rollback_preserved_identity_count": True,
                        "migration_applied_twice": True,
                        "same_value_check_still_current": True,
                    }
                )
            )
        finally:
            if pool is not None:
                await pool.close()
            await admin.execute("SET search_path TO public")
            await admin.execute(f'DROP SCHEMA "{schema}" CASCADE')
            await admin.close()

    asyncio.run(scenario())
