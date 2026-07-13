from __future__ import annotations

import asyncio
from typing import Any

import pytest

from src.fitment.repository import InMemoryFitmentRepository, PostgresFitmentRepository
from src.fitment.schemas import (
    CheckStatus,
    FitmentCheck,
    PreliminaryRun,
    RimSetup,
    RimSpec,
    VehicleIdentity,
)


def _check(
    *,
    check_id: str = "00000000-0000-0000-0000-000000000003",
    owner: int = 101,
) -> FitmentCheck:
    return FitmentCheck(
        id=check_id,
        owner_telegram_user_id=owner,
        vehicle_identity_id="00000000-0000-0000-0000-000000000001",
        rim_setup_id="00000000-0000-0000-0000-000000000002",
        vehicle_snapshot=VehicleIdentity(make="BMW", model="X5", year=2022),
        rim_setup_snapshot=RimSetup(front=RimSpec(), rear=RimSpec()),
        created_at="2026-07-13T20:00:00+00:00",
    )


def test_in_memory_repository_isolates_owners_and_snapshots() -> None:
    async def run() -> None:
        repository = InMemoryFitmentRepository()
        identity = VehicleIdentity(make="BMW", model="X5", year=2022)
        identity_id = await repository.save_vehicle_identity(identity, owner_telegram_user_id=101)
        identity.make = "mutated"

        stored = await repository.get_vehicle_identity(identity_id, owner_telegram_user_id=101)
        assert stored is not None
        assert stored.make == "BMW"
        stored.make = "also-mutated"
        reread = await repository.get_vehicle_identity(identity_id, owner_telegram_user_id=101)
        assert reread is not None
        assert reread.make == "BMW"
        assert (
            await repository.get_vehicle_identity(identity_id, owner_telegram_user_id=202) is None
        )

        run_record = PreliminaryRun(
            id="00000000-0000-0000-0000-000000000010",
            owner_telegram_user_id=101,
        )
        await repository.create_preliminary_run(run_record)
        assert (
            await repository.get_preliminary_run(run_record.id, owner_telegram_user_id=202) is None
        )
        wrong_owner_update = run_record.model_copy(update={"owner_telegram_user_id": 202})
        with pytest.raises(LookupError):
            await repository.update_preliminary_run(wrong_owner_update)

    asyncio.run(run())


def test_in_memory_check_creation_is_owner_scoped_and_idempotent() -> None:
    async def run() -> None:
        repository = InMemoryFitmentRepository()
        first = _check()
        stored = await repository.create_check_idempotently(first, idempotency_key="request-1")

        first.vehicle_snapshot.make = "mutated"
        replay = await repository.create_check_idempotently(
            _check(check_id="00000000-0000-0000-0000-000000000004"),
            idempotency_key="request-1",
        )
        assert replay.id == stored.id
        assert replay.vehicle_snapshot is not None
        assert replay.vehicle_snapshot.make == "BMW"
        assert await repository.get_check(stored.id, owner_telegram_user_id=202) is None

        wrong_owner_update = stored.model_copy(update={"owner_telegram_user_id": 202})
        with pytest.raises(LookupError):
            await repository.update_check(wrong_owner_update)

        other_owner = await repository.create_check_idempotently(
            _check(
                check_id="00000000-0000-0000-0000-000000000005",
                owner=202,
            ),
            idempotency_key="request-1",
        )
        assert other_owner.id != stored.id

    asyncio.run(run())


class FakeConnection:
    def __init__(self, *, fetchrows: list[dict[str, Any] | None] | None = None) -> None:
        self.fetchrows = list(fetchrows or [])
        self.execute_calls: list[tuple[str, tuple[Any, ...]]] = []
        self.fetchrow_calls: list[tuple[str, tuple[Any, ...]]] = []
        self.transaction_entries = 0

    async def __aenter__(self) -> FakeConnection:
        return self

    async def __aexit__(self, *args: Any) -> None:
        return None

    def transaction(self) -> FakeConnection:
        return self

    async def execute(self, sql: str, *args: Any) -> str:
        self.execute_calls.append((sql, args))
        return "UPDATE 1"

    async def fetchrow(self, sql: str, *args: Any) -> dict[str, Any] | None:
        self.fetchrow_calls.append((sql, args))
        return self.fetchrows.pop(0)


class FakeTransactionConnection(FakeConnection):
    async def __aenter__(self) -> FakeTransactionConnection:
        self.transaction_entries += 1
        return self


class FakeAcquire:
    def __init__(self, connection: FakeConnection) -> None:
        self.connection = connection

    async def __aenter__(self) -> FakeConnection:
        return self.connection

    async def __aexit__(self, *args: Any) -> None:
        return None


class FakePool:
    def __init__(self, connection: FakeConnection) -> None:
        self.connection = connection

    def acquire(self) -> FakeAcquire:
        return FakeAcquire(self.connection)


def test_postgres_create_check_and_idempotency_share_transaction() -> None:
    async def run() -> None:
        check = _check()
        connection = FakeTransactionConnection(fetchrows=[None, {"check_id": check.id}])
        repository = PostgresFitmentRepository(FakePool(connection))

        stored = await repository.create_check_idempotently(check, idempotency_key="request-1")

        assert stored.id == check.id
        assert connection.transaction_entries == 1
        assert "INSERT INTO fitment_checks" in connection.execute_calls[0][0]
        idempotency_sql = connection.fetchrow_calls[1][0]
        assert "INSERT INTO fitment_check_idempotency" in idempotency_sql
        assert "ON CONFLICT (owner_telegram_user_id, idempotency_key)" in idempotency_sql

    asyncio.run(run())


def test_postgres_idempotency_race_removes_unclaimed_check() -> None:
    async def run() -> None:
        losing_check = _check()
        winning_check = _check(check_id="00000000-0000-0000-0000-000000000004")
        connection = FakeTransactionConnection(
            fetchrows=[
                None,
                {"check_id": winning_check.id},
                {"payload": winning_check.model_dump()},
            ]
        )
        repository = PostgresFitmentRepository(FakePool(connection))

        stored = await repository.create_check_idempotently(
            losing_check, idempotency_key="request-1"
        )

        assert stored.id == winning_check.id
        delete_sql, delete_args = connection.execute_calls[1]
        assert "DELETE FROM fitment_checks" in delete_sql
        assert delete_args == (losing_check.id, losing_check.owner_telegram_user_id)

    asyncio.run(run())


def test_postgres_updates_and_reads_are_owner_scoped() -> None:
    async def run() -> None:
        check = _check()
        connection = FakeConnection(fetchrows=[{"payload": check.model_dump()}])
        repository = PostgresFitmentRepository(FakePool(connection))

        check.status = CheckStatus.completed
        await repository.update_check(check)
        stored = await repository.get_check(
            check.id, owner_telegram_user_id=check.owner_telegram_user_id
        )

        assert stored is not None
        update_sql, update_args = connection.execute_calls[0]
        assert "owner_telegram_user_id = $10" in update_sql
        assert update_args[-1] == check.owner_telegram_user_id
        read_sql, read_args = connection.fetchrow_calls[0]
        assert "owner_telegram_user_id = $2" in read_sql
        assert read_args[-1] == check.owner_telegram_user_id

    asyncio.run(run())


def test_postgres_preliminary_run_calls_use_payload_and_owner() -> None:
    async def run() -> None:
        run_record = PreliminaryRun(
            id="00000000-0000-0000-0000-000000000010",
            owner_telegram_user_id=101,
        )
        connection = FakeConnection(fetchrows=[{"payload": run_record.model_dump()}])
        repository = PostgresFitmentRepository(FakePool(connection))

        await repository.create_preliminary_run(run_record)
        await repository.update_preliminary_run(run_record)
        stored = await repository.get_preliminary_run(
            run_record.id, owner_telegram_user_id=run_record.owner_telegram_user_id
        )

        assert stored == run_record
        assert "INSERT INTO fitment_preliminary_runs" in connection.execute_calls[0][0]
        update_sql, update_args = connection.execute_calls[1]
        assert "owner_telegram_user_id = $5" in update_sql
        assert update_args[-1] == run_record.owner_telegram_user_id
        assert "owner_telegram_user_id = $2" in connection.fetchrow_calls[0][0]

    asyncio.run(run())
