import asyncio

import pytest

from src import payments_service
from src.payment_return import (
    PaymentReturnValidationError,
    build_payment_return_url,
    normalize_return_to,
    safe_payment_return_context,
)
from src.payments_api import TopUpCreateRequest
from src.payments_service import (
    PaymentValidationError,
    TopUpIntent,
    create_topup_payment,
    get_payment_return_context,
    normalize_amount_rub,
)


@pytest.mark.parametrize(
    ("channel", "route", "expected"),
    [
        ("web", "/app", "/app"),
        ("web", "/app/", "/app"),
        ("web", "/app/new?market=ru&utm_source=test", "/app/new?market=ru&utm_source=test"),
        ("web", "/app/history?utm_campaign=summer", "/app/history?utm_campaign=summer"),
        ("telegram", "/t", "/t/"),
        ("telegram", "/t/", "/t/"),
    ],
)
def test_normalize_return_to_allows_only_approved_channel_routes(channel, route, expected):
    assert normalize_return_to(route, client_channel=channel) == expected


@pytest.mark.parametrize(
    ("channel", "route"),
    [
        ("web", "/t"),
        ("telegram", "/app"),
        ("web", "https://evil.example/app"),
        ("web", "//evil.example/app"),
        ("web", r"\\evil.example\app"),
        ("web", "javascript:alert(1)"),
        ("web", "data:text/html,owned"),
        ("web", "ftp://evil.example/file"),
        ("web", "/api/payments"),
        ("web", "/auth/callback"),
        ("web", "/app/%6eew"),
        ("web", "/app/../admin"),
        ("web", ""),
    ],
)
def test_normalize_return_to_rejects_mismatch_open_redirect_and_confusion(channel, route):
    with pytest.raises(PaymentReturnValidationError):
        normalize_return_to(route, client_channel=channel)


def test_topup_request_requires_and_normalizes_routing_context():
    request = TopUpCreateRequest(
        amount_rub="200.00",
        email="user@example.com",
        client_channel="WEB",
        return_to="/app/new?utm_source=test&market=ru",
    )

    assert request.client_channel == "web"
    assert request.return_to == "/app/new?market=ru&utm_source=test"


def test_topup_request_rejects_unknown_channel():
    with pytest.raises(ValueError, match="client_channel"):
        TopUpCreateRequest(
            amount_rub="200.00",
            email="user@example.com",
            client_channel="website",
            return_to="/app",
        )


def test_corrupted_stored_route_uses_channel_safe_fallback():
    assert safe_payment_return_context(
        client_channel="telegram",
        return_to="https://evil.example",
    ) == ("/t/", "telegram", True)
    assert safe_payment_return_context(
        client_channel="corrupted",
        return_to="/app",
    ) == ("/app", "web", True)


def test_service_reads_and_defensively_validates_persisted_context():
    class FakeConn:
        async def fetchrow(self, _query, _invoice_id):
            return {
                "invoice_id": 42,
                "status": "failed",
                "amount_rub": 200,
                "provider_payment_id": "payment-42",
                "client_channel": "web",
                "return_to": "/app/new",
            }

    context = asyncio.run(
        get_payment_return_context(
            FakeConn(),
            invoice_id=42,
            provider_payment_id="payment-42",
            out_sum="200.00",
        )
    )

    assert context == {
        "invoice_id": 42,
        "status": "failed",
        "client_channel": "web",
        "return_to": "/app/new",
    }


def test_service_rejects_provider_identifier_mismatch_before_redirect():
    class FakeConn:
        async def fetchrow(self, _query, _invoice_id):
            return {
                "invoice_id": 42,
                "status": "pending",
                "amount_rub": 200,
                "provider_payment_id": "payment-42",
                "client_channel": "telegram",
                "return_to": "/t/",
            }

    with pytest.raises(PaymentValidationError):
        asyncio.run(
            get_payment_return_context(
                FakeConn(),
                invoice_id=42,
                provider_payment_id="other-payment",
            )
        )


def test_create_topup_persists_telegram_return_context(monkeypatch):
    class FakeConn:
        def __init__(self):
            self.args = None

        async def fetchrow(self, _query, *args):
            self.args = args
            return {
                "id": "11111111-1111-1111-1111-111111111111",
                "invoice_id": 42,
                "amount_rub": normalize_amount_rub("200.00"),
                "credits_granted": 7,
                "pricing_version": "credits-v1",
            }

    monkeypatch.setattr(
        payments_service,
        "build_payment_url",
        lambda **_kwargs: "https://provider.example/invoice",
    )
    conn = FakeConn()
    asyncio.run(
        create_topup_payment(
            conn,
            user_id=77,
            intent=TopUpIntent(
                amount_rub=normalize_amount_rub("200.00"),
                pricing_version="credits-v1",
                source_screen="cabinet",
                receipt_email="user@example.com",
                client_channel="telegram",
                return_to="/t/",
            ),
        )
    )

    assert conn.args[-2:] == ("telegram", "/t/")


def test_redirect_contains_only_internal_route_and_payment_state():
    url, used_fallback = build_payment_return_url(
        base_origin="https://staging.example",
        client_channel="web",
        return_to="/app/new?market=ru",
        payment_state="success",
        invoice_id=42,
    )

    assert used_fallback is False
    assert url == "https://staging.example/app/new?market=ru&payment=success&invoice_id=42"
    assert "Shp_payment_id" not in url
    assert "receipt" not in url
