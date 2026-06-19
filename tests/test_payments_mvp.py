import asyncio
from datetime import datetime

from fastapi.testclient import TestClient

from src.main import app
from src.payments_service import get_starter_grant_for_user, serialize_payment_row
from src.payments_service import calculate_topup_credits, normalize_amount_rub

client = TestClient(app)


def test_calculate_topup_credits_matches_frontend_tiers():
    assert calculate_topup_credits(normalize_amount_rub("100.00")) == 3
    assert calculate_topup_credits(normalize_amount_rub("200.00")) == 7
    assert calculate_topup_credits(normalize_amount_rub("500.00")) == 20
    assert calculate_topup_credits(normalize_amount_rub("1000.00")) == 45


def test_create_topup_rejects_invalid_email_before_db():
    response = client.post(
        "/payments/topups",
        json={
            "amount_rub": "200.00",
            "pricing_version": "2026-06-balance-v1",
            "source_screen": "cabinet_quick_amount",
            "email": "not-an-email",
            "telegram_user_id": 123456789,
        },
    )
    assert response.status_code == 422


def test_cabinet_requires_identity_before_db():
    response = client.get("/payments/cabinet")
    assert response.status_code == 400


def test_robokassa_result_requires_required_params_before_db():
    response = client.get("/payments/robokassa/result")
    assert response.status_code == 400


def test_serialize_payment_row_includes_receipt_email():
    row = {
        "id": "11111111-1111-1111-1111-111111111111",
        "invoice_id": 42,
        "status": "paid",
        "amount_rub": 500,
        "credits_granted": 20,
        "receipt_email": "user@example.com",
        "pricing_version": "credits-v1",
        "created_at": datetime(2026, 6, 19, 9, 0, 0),
        "paid_at": datetime(2026, 6, 19, 9, 1, 0),
        "failed_at": None,
        "updated_at": datetime(2026, 6, 19, 9, 1, 0),
    }

    payload = serialize_payment_row(row)

    assert payload["receipt_email"] == "user@example.com"


def test_get_starter_grant_for_user_returns_trial_grant_payload():
    class FakeConn:
        async def fetchrow(self, *_args, **_kwargs):
            return {
                "credits_delta": 3,
                "created_at": datetime(2026, 6, 19, 9, 0, 0),
            }

    payload = asyncio.run(get_starter_grant_for_user(FakeConn(), user_id=123))

    assert payload == {"credits": 3, "created_at": "2026-06-19T09:00:00"}
