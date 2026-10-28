"""HTTP API для пополнения баланса через Robokassa."""

import logging
import re
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse, RedirectResponse
from pydantic import BaseModel, field_validator, model_validator

from src import analytics_api, db
from src.auth_principal import preflight_auth_credentials, require_auth_principal
from src.config import PAYMENTS_ENABLED, ROBOKASSA_IS_TEST, WEBAPP_URL
from src.credits_service import get_balance, list_credit_packages
from src.payment_return import (
    PaymentReturnValidationError,
    build_payment_return_url,
    normalize_client_channel,
    normalize_return_to,
)
from src.payments_service import (
    PaymentConfigError,
    PaymentNotFoundError,
    PaymentValidationError,
    TopUpIntent,
    create_topup_payment,
    get_payment_return_context,
    get_payment_status_by_invoice,
    get_starter_grant_for_user,
    list_payments_for_user,
    mark_payment_failed,
    mark_payment_paid,
    normalize_amount_rub,
    verify_result_signature,
)
from src.payments_service import (
    calculate_topup_credits as _calculate_topup_credits,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["payments"])
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
calculate_topup_credits = _calculate_topup_credits


class TopUpCreateRequest(BaseModel):
    amount_rub: str
    pricing_version: str = "credits-v1"
    source_screen: str = "cabinet"
    email: str
    client_channel: str
    return_to: str
    init_data: str | None = None
    telegram_user_id: int | None = None

    @field_validator("pricing_version", "source_screen")
    @classmethod
    def validate_text_fields(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("must not be empty")
        return normalized[:128]

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not EMAIL_RE.fullmatch(normalized):
            raise ValueError("invalid email")
        return normalized

    @field_validator("client_channel")
    @classmethod
    def validate_client_channel(cls, value: str) -> str:
        try:
            return normalize_client_channel(value)
        except PaymentReturnValidationError as exc:
            raise ValueError(str(exc)) from exc

    @model_validator(mode="after")
    def validate_return_to(self):
        try:
            self.return_to = normalize_return_to(
                self.return_to,
                client_channel=self.client_channel,
            )
        except PaymentReturnValidationError as exc:
            raise ValueError(str(exc)) from exc
        return self

    @property
    def amount_decimal(self) -> Decimal:
        return normalize_amount_rub(self.amount_rub)


@router.get("/cabinet")
async def get_payment_cabinet(
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    preflight_auth_credentials(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        auth_name="payments",
    )
    pool = db.get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            principal = await require_auth_principal(
                conn,
                init_data=init_data,
                telegram_user_id=telegram_user_id,
                authorization=authorization,
                auth_name="payments",
            )
            user_id = principal.user_id
            balance = await get_balance(conn, user_id)
            payments = await list_payments_for_user(conn, user_id=user_id)
            starter_grant = await get_starter_grant_for_user(conn, user_id=user_id)
            credit_packages = await list_credit_packages(conn, user_id=user_id)
    return {
        "balance": balance,
        "payments": payments,
        "starter_grant": starter_grant,
        "credit_packages": credit_packages,
    }


@router.get("/{invoice_id}/status")
async def get_payment_status(
    invoice_id: int,
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    preflight_auth_credentials(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        auth_name="payments",
    )
    pool = db.get_pool()
    async with pool.acquire() as conn:
        try:
            async with conn.transaction():
                principal = await require_auth_principal(
                    conn,
                    init_data=init_data,
                    telegram_user_id=telegram_user_id,
                    authorization=authorization,
                    auth_name="payments",
                )
                user_id = principal.user_id
                return await get_payment_status_by_invoice(
                    conn,
                    invoice_id=invoice_id,
                    user_id=user_id,
                )
        except PaymentNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Payment not found") from exc


@router.post("/topups")
async def create_topup(
    request: TopUpCreateRequest,
    authorization: Annotated[str | None, Header()] = None,
):
    if not PAYMENTS_ENABLED:
        raise HTTPException(status_code=503, detail="Payments are temporarily disabled")

    preflight_auth_credentials(
        init_data=request.init_data,
        telegram_user_id=request.telegram_user_id,
        authorization=authorization,
        auth_name="payments",
    )

    intent = TopUpIntent(
        amount_rub=request.amount_decimal,
        pricing_version=request.pricing_version,
        source_screen=request.source_screen,
        receipt_email=request.email.lower(),
        client_channel=request.client_channel,
        return_to=request.return_to,
    )
    pool = db.get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            principal = await require_auth_principal(
                conn,
                init_data=request.init_data,
                telegram_user_id=request.telegram_user_id,
                authorization=authorization,
                auth_name="payments",
            )
            user_id = principal.user_id
            await get_balance(conn, user_id)
            try:
                payload = await create_topup_payment(conn, user_id=user_id, intent=intent)
            except PaymentConfigError as exc:
                logger.exception("❌ Robokassa create topup failed user_id=%s: %s", user_id, exc)
                raise HTTPException(
                    status_code=503, detail="Payment provider is not configured"
                ) from exc
    return payload


@router.api_route("/robokassa/result", methods=["GET", "POST"])
async def robokassa_result(request: Request):
    if request.method == "POST":
        payload = dict(await request.form())
    else:
        payload = dict(request.query_params)

    out_sum = str(payload.get("OutSum") or payload.get("out_summ") or "")
    inv_id_raw = payload.get("InvId") or payload.get("inv_id")
    signature_value = str(payload.get("SignatureValue") or payload.get("signature_value") or "")
    payment_id = str(payload.get("Shp_payment_id") or "")
    is_test_raw = payload.get("IsTest")
    is_test = None if is_test_raw is None else str(is_test_raw) == "1"

    if not out_sum or not inv_id_raw or not signature_value or not payment_id:
        raise HTTPException(status_code=400, detail="Missing Robokassa params")

    try:
        invoice_id = int(inv_id_raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="InvId must be integer") from exc

    if not verify_result_signature(
        out_sum=out_sum,
        invoice_id=invoice_id,
        signature_value=signature_value,
        payment_id=payment_id,
        is_test=is_test,
    ):
        logger.warning(
            f"❌ Robokassa signature mismatch invoice_id={invoice_id} payment_id={payment_id}"
        )
        raise HTTPException(status_code=401, detail="Invalid signature")

    pool = db.get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            try:
                payment = await mark_payment_paid(
                    conn,
                    invoice_id=invoice_id,
                    provider_payment_id=payment_id,
                    out_sum=out_sum,
                    is_test=ROBOKASSA_IS_TEST if is_test is None else is_test,
                )
                if payment.get("status") == "paid":
                    payment_user_id = await conn.fetchval(
                        "SELECT user_id FROM payments WHERE invoice_id = $1", invoice_id
                    )
                    if payment_user_id is not None:
                        await analytics_api.record_system_event(
                            conn,
                            user_id=int(payment_user_id),
                            event_name="payment_completed",
                            properties={"invoice_id": invoice_id, "is_test": bool(is_test)},
                        )
            except PaymentValidationError as exc:
                raise HTTPException(status_code=400, detail="Payment payload mismatch") from exc
            except PaymentNotFoundError as exc:
                raise HTTPException(status_code=404, detail="Payment not found") from exc

    logger.info(f"✅ Robokassa callback invoice_id={invoice_id} payment_id={payment_id}")
    return PlainTextResponse(f"OK{invoice_id}")


async def _robokassa_browser_payload(request: Request) -> dict[str, str]:
    if request.method == "POST":
        return {str(key): str(value) for key, value in (await request.form()).items()}
    return {str(key): str(value) for key, value in request.query_params.items()}


def _robokassa_invoice_id(payload: dict[str, str]) -> int:
    inv_id_raw = payload.get("InvId") or payload.get("inv_id")
    if not inv_id_raw:
        raise HTTPException(status_code=400, detail="Missing Robokassa params")
    try:
        return int(inv_id_raw)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="InvId must be integer") from exc


def _payment_browser_redirect(
    *,
    return_context: dict[str, object],
    payment_state: str,
) -> RedirectResponse:
    redirect_url, _used_fallback = build_payment_return_url(
        base_origin=WEBAPP_URL,
        client_channel=str(return_context["client_channel"]),
        return_to=str(return_context["return_to"]),
        payment_state=payment_state,
        invoice_id=int(return_context["invoice_id"]),
    )
    return RedirectResponse(redirect_url, status_code=303)


@router.api_route("/robokassa/fail", methods=["GET", "POST"])
async def robokassa_fail(request: Request):
    payload = await _robokassa_browser_payload(request)
    invoice_id = _robokassa_invoice_id(payload)
    payment_id = payload.get("Shp_payment_id") or ""
    out_sum = payload.get("OutSum") or payload.get("out_summ") or None
    if not payment_id:
        raise HTTPException(status_code=400, detail="Missing Robokassa params")

    # FailURL is a browser return, not proof of settlement. It can only move
    # pending -> failed; a valid ResultURL remains authoritative and may later
    # move failed -> paid.
    pool = db.get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            try:
                payment = await mark_payment_failed(
                    conn,
                    invoice_id=invoice_id,
                    provider_payment_id=payment_id,
                    out_sum=out_sum,
                )
                return_context = await get_payment_return_context(
                    conn,
                    invoice_id=invoice_id,
                    provider_payment_id=payment_id,
                    out_sum=out_sum,
                )
            except PaymentValidationError as exc:
                raise HTTPException(status_code=400, detail="Payment payload mismatch") from exc
            except PaymentNotFoundError as exc:
                raise HTTPException(status_code=404, detail="Payment not found") from exc

    payment_state = "success" if payment.get("status") == "paid" else "fail"
    logger.info(
        "✅ Robokassa failure return invoice_id=%s payment_id=%s status=%s",
        invoice_id,
        payment_id,
        payment.get("status"),
    )
    return _payment_browser_redirect(
        return_context=return_context,
        payment_state=payment_state,
    )


@router.api_route("/robokassa/success", methods=["GET", "POST"])
async def robokassa_success(request: Request):
    """Return the browser to the stored route without settling the payment."""
    payload = await _robokassa_browser_payload(request)
    invoice_id = _robokassa_invoice_id(payload)
    payment_id = payload.get("Shp_payment_id") or ""
    out_sum = payload.get("OutSum") or payload.get("out_summ") or None
    if not payment_id:
        raise HTTPException(status_code=400, detail="Missing Robokassa params")

    pool = db.get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            try:
                return_context = await get_payment_return_context(
                    conn,
                    invoice_id=invoice_id,
                    provider_payment_id=payment_id,
                    out_sum=out_sum,
                )
            except PaymentValidationError as exc:
                raise HTTPException(status_code=400, detail="Payment payload mismatch") from exc
            except PaymentNotFoundError as exc:
                raise HTTPException(status_code=404, detail="Payment not found") from exc

    logger.info(
        "✅ Robokassa success return invoice_id=%s status=%s",
        invoice_id,
        return_context["status"],
    )
    return _payment_browser_redirect(
        return_context=return_context,
        payment_state="success",
    )
