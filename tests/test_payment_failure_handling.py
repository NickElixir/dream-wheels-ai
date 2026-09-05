import asyncio
from datetime import datetime
from pathlib import Path

from fastapi.testclient import TestClient

from src import payments_api, payments_service
from src.main import app
from src.payments_service import (
    TopUpIntent,
    create_topup_payment,
    mark_payment_failed,
    mark_payment_paid,
    normalize_amount_rub,
)

client = TestClient(app)


class StatefulPaymentConn:
    def __init__(self, *, status: str = "pending", balance: int = 4) -> None:
        self.balance = balance
        self.ledger_keys: set[str] = set()
        self.package_keys: set[str] = set()
        self.payment = {
            "id": "11111111-1111-1111-1111-111111111111",
            "user_id": 77,
            "invoice_id": 42,
            "status": status,
            "amount_rub": normalize_amount_rub("200.00"),
            "credits_granted": 7,
            "provider_payment_id": "payment-42",
            "receipt_email": "user@example.com",
            "pricing_version": "credits-v1",
            "created_at": datetime(2026, 8, 30, 20, 0, 0),
            "updated_at": datetime(2026, 8, 30, 20, 0, 0),
            "paid_at": datetime(2026, 8, 30, 20, 1, 0) if status == "paid" else None,
            "failed_at": None,
        }

    async def fetchrow(self, query: str, *_args):
        if "SELECT p.*, a.balance" in query:
            return {**self.payment, "balance": self.balance}
        if "FROM payments p" in query and "JOIN user_credit_accounts" in query:
            return {**self.payment, "balance": self.balance}
        if "FROM payments" in query and "FOR UPDATE" in query:
            return dict(self.payment)
        raise AssertionError(f"Unexpected fetchrow query: {query}")

    async def execute(self, query: str, *args):
        if "INSERT INTO user_credit_accounts" in query:
            return "INSERT 0 0"
        if "UPDATE user_credit_accounts" in query:
            self.balance = int(args[1])
            return "UPDATE 1"
        if "INSERT INTO credit_ledger" in query:
            self.ledger_keys.add(str(args[4]))
            return "INSERT 0 1"
        if "SET status = 'failed'" in query:
            if self.payment["status"] == "pending":
                self.payment["status"] = "failed"
                self.payment["failed_at"] = datetime(2026, 8, 30, 20, 2, 0)
                self.payment["updated_at"] = self.payment["failed_at"]
            return "UPDATE 1"
        if "SET status = 'paid'" in query:
            self.payment["status"] = "paid"
            self.payment["paid_at"] = datetime(2026, 8, 30, 20, 3, 0)
            self.payment["failed_at"] = None
            self.payment["updated_at"] = self.payment["paid_at"]
            return "UPDATE 1"
        raise AssertionError(f"Unexpected execute query: {query}")


async def _fake_get_balance(conn: StatefulPaymentConn, _user_id: int) -> int:
    return conn.balance


async def _fake_create_credit_package(
    conn: StatefulPaymentConn,
    *,
    idempotency_key: str,
    **_kwargs,
):
    conn.package_keys.add(idempotency_key)
    return None


def test_pending_to_failed_sets_failed_at_without_credits(monkeypatch):
    conn = StatefulPaymentConn(status="pending", balance=4)
    monkeypatch.setattr(payments_service, "get_balance", _fake_get_balance)
    monkeypatch.setattr(payments_service, "create_credit_package", _fake_create_credit_package)

    first = asyncio.run(
        mark_payment_failed(
            conn,
            invoice_id=42,
            provider_payment_id="payment-42",
            out_sum="200.00",
        )
    )
    failed_at = first["failed_at"]

    assert first["status"] == "failed"
    assert failed_at is not None
    assert conn.balance == 4
    assert conn.ledger_keys == set()
    assert conn.package_keys == set()

    second = asyncio.run(
        mark_payment_failed(
            conn,
            invoice_id=42,
            provider_payment_id="payment-42",
            out_sum="200.00",
        )
    )

    assert second["status"] == "failed"
    assert second["failed_at"] == failed_at
    assert conn.balance == 4
    assert conn.ledger_keys == set()
    assert conn.package_keys == set()


def test_paid_payment_cannot_become_failed():
    conn = StatefulPaymentConn(status="paid", balance=11)

    payment = asyncio.run(
        mark_payment_failed(
            conn,
            invoice_id=42,
            provider_payment_id="payment-42",
            out_sum="200.00",
        )
    )

    assert payment["status"] == "paid"
    assert payment["failed_at"] is None
    assert conn.balance == 11
    assert conn.ledger_keys == set()


def test_authoritative_late_success_moves_failed_to_paid_once(monkeypatch):
    conn = StatefulPaymentConn(status="pending", balance=4)
    monkeypatch.setattr(payments_service, "get_balance", _fake_get_balance)
    monkeypatch.setattr(payments_service, "create_credit_package", _fake_create_credit_package)

    failed = asyncio.run(
        mark_payment_failed(
            conn,
            invoice_id=42,
            provider_payment_id="payment-42",
            out_sum="200.00",
        )
    )
    assert failed["status"] == "failed"

    paid = asyncio.run(
        mark_payment_paid(
            conn,
            invoice_id=42,
            provider_payment_id="payment-42",
            out_sum="200.00",
            is_test=True,
        )
    )

    assert paid["status"] == "paid"
    assert paid["failed_at"] is None
    assert conn.balance == 11
    assert conn.ledger_keys == {"payment_paid:42"}
    assert conn.package_keys == {"payment_package:42"}

    duplicate = asyncio.run(
        mark_payment_paid(
            conn,
            invoice_id=42,
            provider_payment_id="payment-42",
            out_sum="200.00",
            is_test=True,
        )
    )

    assert duplicate["status"] == "paid"
    assert conn.balance == 11
    assert conn.ledger_keys == {"payment_paid:42"}
    assert conn.package_keys == {"payment_package:42"}


def test_retry_creates_a_new_payment_and_invoice(monkeypatch):
    payment_ids = iter(
        [
            "00000000-0000-0000-0000-000000000001",
            "00000000-0000-0000-0000-000000000002",
        ]
    )
    monkeypatch.setattr(payments_service.uuid, "uuid4", lambda: next(payment_ids))
    monkeypatch.setattr(
        payments_service,
        "build_payment_url",
        lambda *, invoice_id, payment_id, intent: f"https://pay.test/{invoice_id}/{payment_id}",
    )

    class CreateConn:
        def __init__(self) -> None:
            self.invoice_id = 100
            self.provider_payment_ids: list[str] = []

        async def fetchrow(self, _query: str, *args):
            self.provider_payment_ids.append(str(args[2]))
            invoice_id = self.invoice_id
            self.invoice_id += 1
            return {
                "id": f"11111111-1111-1111-1111-{invoice_id:012d}",
                "invoice_id": invoice_id,
                "amount_rub": normalize_amount_rub("200.00"),
                "credits_granted": 7,
                "pricing_version": "credits-v1",
            }

    conn = CreateConn()
    intent = TopUpIntent(
        amount_rub=normalize_amount_rub("200.00"),
        pricing_version="credits-v1",
        source_screen="cabinet",
        receipt_email="user@example.com",
    )

    first = asyncio.run(create_topup_payment(conn, user_id=77, intent=intent))
    second = asyncio.run(create_topup_payment(conn, user_id=77, intent=intent))

    assert first["invoice_id"] == 100
    assert second["invoice_id"] == 101
    assert conn.provider_payment_ids == [
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
    ]
    assert first["payment_url"] != second["payment_url"]


def test_robokassa_fail_redirect_marks_payment_and_returns_to_webapp(monkeypatch):
    class FakeTransaction:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

    class FakeConn:
        def transaction(self):
            return FakeTransaction()

    class FakeAcquire:
        async def __aenter__(self):
            return FakeConn()

        async def __aexit__(self, exc_type, exc, tb):
            return False

    class FakePool:
        def acquire(self):
            return FakeAcquire()

    async def fake_mark_failed(
        _conn,
        *,
        invoice_id: int,
        provider_payment_id: str,
        out_sum: str | None,
    ):
        assert invoice_id == 42
        assert provider_payment_id == "payment-42"
        assert out_sum == "200.00"
        return {"invoice_id": 42, "status": "failed"}

    monkeypatch.setattr(payments_api.db, "get_pool", lambda: FakePool())
    monkeypatch.setattr(payments_api, "mark_payment_failed", fake_mark_failed)
    monkeypatch.setattr(
        payments_api,
        "WEBAPP_URL",
        "https://dream-wheels-ai-webapp-staging.vercel.app",
    )

    response = client.get(
        "/payments/robokassa/fail",
        params={"InvId": "42", "OutSum": "200.00", "Shp_payment_id": "payment-42"},
        follow_redirects=False,
    )

    assert response.status_code == 303
    location = response.headers["location"]
    assert location == (
        "https://dream-wheels-ai-webapp-staging.vercel.app/t/?payment=fail&invoice_id=42"
    )
    assert "/t/t/" not in location


def test_failed_payment_has_terminal_wallet_mapping():
    app_js = Path("webapp/app.js").read_text(encoding="utf-8")

    assert 'if (status === "failed" || status === "cancelled" || status === "expired")' in app_js
    assert 'paymentFail: "Платеж не завершен"' in app_js
