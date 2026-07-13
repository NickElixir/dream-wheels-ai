"""Хранилище fitment-сущностей и immutable snapshots.

Два бэкенда за одним контрактом:
- InMemoryFitmentRepository — дефолт: работает без миграций/Redis, покрыт тестами;
- PostgresFitmentRepository — durable-хранение (migrations/0017_fitment_verdict.sql),
  включается FITMENT_DB_PERSISTENCE=true после применения миграции.

Snapshots immutable: check хранит копии identity/setup/profile на момент запуска.
"""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Any, Protocol

from src.fitment.schemas import (
    FitmentCheck,
    PreliminaryRun,
    RimSetup,
    VehicleIdentity,
)


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def _dump(value: Any) -> str:
    if hasattr(value, "model_dump"):
        value = value.model_dump(mode="json")
    return json.dumps(value)


def _dump_optional(value: Any | None) -> str | None:
    return None if value is None else _dump(value)


def _load_payload(value: Any) -> Any:
    return json.loads(value) if isinstance(value, str | bytes | bytearray) else value


class FitmentRepository(Protocol):
    async def create_preliminary_run(self, run: PreliminaryRun) -> None: ...

    async def update_preliminary_run(self, run: PreliminaryRun) -> None: ...

    async def get_preliminary_run(
        self, run_id: str, *, owner_telegram_user_id: int
    ) -> PreliminaryRun | None: ...

    async def save_vehicle_identity(
        self, identity: VehicleIdentity, *, owner_telegram_user_id: int
    ) -> str: ...

    async def get_vehicle_identity(
        self, identity_id: str, *, owner_telegram_user_id: int
    ) -> VehicleIdentity | None: ...

    async def save_rim_setup(self, setup: RimSetup, *, owner_telegram_user_id: int) -> str: ...

    async def get_rim_setup(
        self, setup_id: str, *, owner_telegram_user_id: int
    ) -> RimSetup | None: ...

    async def create_check(self, check: FitmentCheck) -> None: ...

    async def create_check_idempotently(
        self, check: FitmentCheck, *, idempotency_key: str
    ) -> FitmentCheck: ...

    async def update_check(self, check: FitmentCheck) -> None: ...

    async def get_check(
        self, check_id: str, *, owner_telegram_user_id: int
    ) -> FitmentCheck | None: ...

    async def find_check_by_idempotency_key(
        self, *, owner_telegram_user_id: int, idempotency_key: str
    ) -> FitmentCheck | None: ...

    async def remember_idempotency_key(
        self, *, owner_telegram_user_id: int, idempotency_key: str, check_id: str
    ) -> None: ...


class InMemoryFitmentRepository:
    """Процесс-локальное хранилище. Для прод-durability — Postgres-бэкенд."""

    def __init__(self) -> None:
        self._preliminary_runs: dict[str, PreliminaryRun] = {}
        self._identities: dict[str, tuple[int, VehicleIdentity]] = {}
        self._setups: dict[str, tuple[int, RimSetup]] = {}
        self._checks: dict[str, FitmentCheck] = {}
        self._idempotency: dict[tuple[int, str], str] = {}

    async def create_preliminary_run(self, run: PreliminaryRun) -> None:
        if run.id in self._preliminary_runs:
            raise ValueError(f"preliminary run already exists: {run.id}")
        self._preliminary_runs[run.id] = run.model_copy(deep=True)

    async def update_preliminary_run(self, run: PreliminaryRun) -> None:
        stored = self._preliminary_runs.get(run.id)
        if stored is None or stored.owner_telegram_user_id != run.owner_telegram_user_id:
            raise LookupError("preliminary run not found")
        self._preliminary_runs[run.id] = run.model_copy(deep=True)

    async def get_preliminary_run(
        self, run_id: str, *, owner_telegram_user_id: int
    ) -> PreliminaryRun | None:
        run = self._preliminary_runs.get(run_id)
        if run is None or run.owner_telegram_user_id != owner_telegram_user_id:
            return None
        return run.model_copy(deep=True)

    async def save_vehicle_identity(
        self, identity: VehicleIdentity, *, owner_telegram_user_id: int
    ) -> str:
        identity_id = new_id()
        self._identities[identity_id] = (owner_telegram_user_id, identity.model_copy(deep=True))
        return identity_id

    async def get_vehicle_identity(
        self, identity_id: str, *, owner_telegram_user_id: int
    ) -> VehicleIdentity | None:
        entry = self._identities.get(identity_id)
        if entry is None or entry[0] != owner_telegram_user_id:
            return None
        return entry[1].model_copy(deep=True)

    async def save_rim_setup(self, setup: RimSetup, *, owner_telegram_user_id: int) -> str:
        setup_id = new_id()
        self._setups[setup_id] = (owner_telegram_user_id, setup.model_copy(deep=True))
        return setup_id

    async def get_rim_setup(self, setup_id: str, *, owner_telegram_user_id: int) -> RimSetup | None:
        entry = self._setups.get(setup_id)
        if entry is None or entry[0] != owner_telegram_user_id:
            return None
        return entry[1].model_copy(deep=True)

    async def create_check(self, check: FitmentCheck) -> None:
        if check.id in self._checks:
            raise ValueError(f"fitment check already exists: {check.id}")
        self._checks[check.id] = check.model_copy(deep=True)

    async def create_check_idempotently(
        self, check: FitmentCheck, *, idempotency_key: str
    ) -> FitmentCheck:
        key = (check.owner_telegram_user_id, idempotency_key)
        existing_id = self._idempotency.get(key)
        if existing_id is not None:
            return self._checks[existing_id].model_copy(deep=True)
        await self.create_check(check)
        self._idempotency[key] = check.id
        return check.model_copy(deep=True)

    async def update_check(self, check: FitmentCheck) -> None:
        stored = self._checks.get(check.id)
        if stored is None or stored.owner_telegram_user_id != check.owner_telegram_user_id:
            raise LookupError("fitment check not found")
        self._checks[check.id] = check.model_copy(deep=True)

    async def get_check(self, check_id: str, *, owner_telegram_user_id: int) -> FitmentCheck | None:
        check = self._checks.get(check_id)
        if check is None or check.owner_telegram_user_id != owner_telegram_user_id:
            return None
        return check.model_copy(deep=True)

    async def find_check_by_idempotency_key(
        self, *, owner_telegram_user_id: int, idempotency_key: str
    ) -> FitmentCheck | None:
        check_id = self._idempotency.get((owner_telegram_user_id, idempotency_key))
        if check_id is None:
            return None
        return await self.get_check(check_id, owner_telegram_user_id=owner_telegram_user_id)

    async def remember_idempotency_key(
        self, *, owner_telegram_user_id: int, idempotency_key: str, check_id: str
    ) -> None:
        check = self._checks.get(check_id)
        if check is None or check.owner_telegram_user_id != owner_telegram_user_id:
            raise LookupError("fitment check not found")
        self._idempotency.setdefault((owner_telegram_user_id, idempotency_key), check_id)


class PostgresFitmentRepository:
    """Durable-хранилище поверх migrations/0017_fitment_verdict.sql (JSONB snapshots)."""

    def __init__(self, pool: Any) -> None:
        self._pool = pool

    async def create_preliminary_run(self, run: PreliminaryRun) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO fitment_preliminary_runs (
                    id, owner_telegram_user_id, status, stage,
                    car_image_sha256, rim_image_sha256, payload,
                    created_at, completed_at
                )
                VALUES (
                    $1::uuid, $2, $3, $4, $5, $6, $7::jsonb,
                    COALESCE($8::timestamptz, CURRENT_TIMESTAMP), $9::timestamptz
                )
                """,
                run.id,
                run.owner_telegram_user_id,
                run.status.value,
                run.stage.value,
                run.car_image_sha256,
                run.rim_image_sha256,
                _dump(run),
                run.created_at or None,
                run.completed_at,
            )

    async def update_preliminary_run(self, run: PreliminaryRun) -> None:
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                """
                UPDATE fitment_preliminary_runs
                SET status = $1,
                    payload = $2::jsonb,
                    completed_at = $3::timestamptz,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $4::uuid AND owner_telegram_user_id = $5
                """,
                run.status.value,
                _dump(run),
                run.completed_at,
                run.id,
                run.owner_telegram_user_id,
            )
        if result == "UPDATE 0":
            raise LookupError("preliminary run not found")

    async def get_preliminary_run(
        self, run_id: str, *, owner_telegram_user_id: int
    ) -> PreliminaryRun | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT payload
                FROM fitment_preliminary_runs
                WHERE id = $1::uuid AND owner_telegram_user_id = $2
                """,
                run_id,
                owner_telegram_user_id,
            )
        if row is None:
            return None
        return PreliminaryRun.model_validate(_load_payload(row["payload"]))

    async def save_vehicle_identity(
        self, identity: VehicleIdentity, *, owner_telegram_user_id: int
    ) -> str:
        identity_id = new_id()
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO fitment_vehicle_identities (id, owner_telegram_user_id, payload)
                VALUES ($1::uuid, $2, $3::jsonb)
                """,
                identity_id,
                owner_telegram_user_id,
                _dump(identity),
            )
        return identity_id

    async def get_vehicle_identity(
        self, identity_id: str, *, owner_telegram_user_id: int
    ) -> VehicleIdentity | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT payload FROM fitment_vehicle_identities
                WHERE id = $1::uuid AND owner_telegram_user_id = $2
                """,
                identity_id,
                owner_telegram_user_id,
            )
        if row is None:
            return None
        return VehicleIdentity.model_validate(_load_payload(row["payload"]))

    async def save_rim_setup(self, setup: RimSetup, *, owner_telegram_user_id: int) -> str:
        setup_id = new_id()
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO fitment_rim_setups (id, owner_telegram_user_id, payload)
                VALUES ($1::uuid, $2, $3::jsonb)
                """,
                setup_id,
                owner_telegram_user_id,
                _dump(setup),
            )
        return setup_id

    async def get_rim_setup(self, setup_id: str, *, owner_telegram_user_id: int) -> RimSetup | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT payload FROM fitment_rim_setups
                WHERE id = $1::uuid AND owner_telegram_user_id = $2
                """,
                setup_id,
                owner_telegram_user_id,
            )
        if row is None:
            return None
        return RimSetup.model_validate(_load_payload(row["payload"]))

    async def create_check(self, check: FitmentCheck) -> None:
        async with self._pool.acquire() as conn:
            await self._insert_check(conn, check)

    async def create_check_idempotently(
        self, check: FitmentCheck, *, idempotency_key: str
    ) -> FitmentCheck:
        async with self._pool.acquire() as conn:
            async with conn.transaction():
                existing = await self._find_check_by_idempotency_key(
                    conn,
                    owner_telegram_user_id=check.owner_telegram_user_id,
                    idempotency_key=idempotency_key,
                )
                if existing is not None:
                    return existing

                await self._insert_check(conn, check)
                claimed = await conn.fetchrow(
                    """
                    INSERT INTO fitment_check_idempotency (
                        owner_telegram_user_id, idempotency_key, check_id
                    )
                    VALUES ($1, $2, $3::uuid)
                    ON CONFLICT (owner_telegram_user_id, idempotency_key)
                    DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
                    RETURNING check_id::text
                    """,
                    check.owner_telegram_user_id,
                    idempotency_key,
                    check.id,
                )
                claimed_check_id = claimed["check_id"]
                if claimed_check_id == check.id:
                    return check.model_copy(deep=True)

                await conn.execute(
                    """
                    DELETE FROM fitment_checks
                    WHERE id = $1::uuid AND owner_telegram_user_id = $2
                    """,
                    check.id,
                    check.owner_telegram_user_id,
                )
                row = await conn.fetchrow(
                    """
                    SELECT payload
                    FROM fitment_checks
                    WHERE id = $1::uuid AND owner_telegram_user_id = $2
                    """,
                    claimed_check_id,
                    check.owner_telegram_user_id,
                )
                if row is None:
                    raise RuntimeError("idempotency row references a missing fitment check")
                return FitmentCheck.model_validate(_load_payload(row["payload"]))

    async def update_check(self, check: FitmentCheck) -> None:
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                """
                UPDATE fitment_checks
                SET status = $1,
                    vehicle_snapshot = $2::jsonb,
                    rim_setup_snapshot = $3::jsonb,
                    profile_snapshot = $4::jsonb,
                    verdict_snapshot = $5::jsonb,
                    risk_snapshot = $6::jsonb,
                    payload = $7::jsonb,
                    completed_at = $8::timestamptz,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $9::uuid AND owner_telegram_user_id = $10
                """,
                check.status.value,
                _dump_optional(check.vehicle_snapshot),
                _dump_optional(check.rim_setup_snapshot),
                _dump_optional(check.profile_snapshot),
                _dump_optional(check.verdict),
                _dump_optional(check.risk),
                _dump(check),
                check.completed_at,
                check.id,
                check.owner_telegram_user_id,
            )
        if result == "UPDATE 0":
            raise LookupError("fitment check not found")

    async def get_check(self, check_id: str, *, owner_telegram_user_id: int) -> FitmentCheck | None:
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT payload FROM fitment_checks
                WHERE id = $1::uuid AND owner_telegram_user_id = $2
                """,
                check_id,
                owner_telegram_user_id,
            )
        if row is None:
            return None
        return FitmentCheck.model_validate(_load_payload(row["payload"]))

    async def find_check_by_idempotency_key(
        self, *, owner_telegram_user_id: int, idempotency_key: str
    ) -> FitmentCheck | None:
        async with self._pool.acquire() as conn:
            return await self._find_check_by_idempotency_key(
                conn,
                owner_telegram_user_id,
                idempotency_key,
            )

    async def remember_idempotency_key(
        self, *, owner_telegram_user_id: int, idempotency_key: str, check_id: str
    ) -> None:
        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO fitment_check_idempotency
                    (owner_telegram_user_id, idempotency_key, check_id)
                VALUES ($1, $2, $3::uuid)
                ON CONFLICT (owner_telegram_user_id, idempotency_key) DO NOTHING
                """,
                owner_telegram_user_id,
                idempotency_key,
                check_id,
            )

    async def _insert_check(self, conn: Any, check: FitmentCheck) -> None:
        await conn.execute(
            """
            INSERT INTO fitment_checks (
                id, owner_telegram_user_id, status, stage,
                vehicle_identity_id, rim_setup_id, preliminary_run_id, render_job_id,
                vehicle_snapshot, rim_setup_snapshot, profile_snapshot,
                verdict_snapshot, risk_snapshot, payload, created_at, completed_at
            )
            VALUES (
                $1::uuid, $2, $3, $4,
                $5::uuid, $6::uuid, $7::uuid, $8::uuid,
                $9::jsonb, $10::jsonb, $11::jsonb,
                $12::jsonb, $13::jsonb, $14::jsonb,
                COALESCE($15::timestamptz, CURRENT_TIMESTAMP), $16::timestamptz
            )
            """,
            check.id,
            check.owner_telegram_user_id,
            check.status.value,
            check.stage.value,
            check.vehicle_identity_id,
            check.rim_setup_id,
            check.preliminary_run_id,
            check.render_job_id,
            _dump_optional(check.vehicle_snapshot),
            _dump_optional(check.rim_setup_snapshot),
            _dump_optional(check.profile_snapshot),
            _dump_optional(check.verdict),
            _dump_optional(check.risk),
            _dump(check),
            check.created_at or None,
            check.completed_at,
        )

    async def _find_check_by_idempotency_key(
        self,
        conn: Any,
        owner_telegram_user_id: int,
        idempotency_key: str,
    ) -> FitmentCheck | None:
        row = await conn.fetchrow(
            """
            SELECT c.payload
            FROM fitment_check_idempotency i
            JOIN fitment_checks c
              ON c.id = i.check_id
             AND c.owner_telegram_user_id = i.owner_telegram_user_id
            WHERE i.owner_telegram_user_id = $1 AND i.idempotency_key = $2
            """,
            owner_telegram_user_id,
            idempotency_key,
        )
        if row is None:
            return None
        return FitmentCheck.model_validate(_load_payload(row["payload"]))
