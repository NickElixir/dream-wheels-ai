"""Durable detailed Fitment Check API over staging's canonical identity tables."""

from __future__ import annotations

import hashlib
import json
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

from src import db
from src.auth import resolve_telegram_auth
from src.fitment import config as fitment_config
from src.fitment.providers.base import ProviderError
from src.fitment.providers.wheel_size import WheelSizeProvider
from src.fitment.rules.engine import run_checks
from src.fitment.rules.verdict import assemble_verdict, verdict_vehicle_not_resolved
from src.fitment.schemas import FieldValue, RimSetup, RimSpec, Source, VehicleIdentity
from src.users_service import ensure_user

router = APIRouter(prefix="/fitment", tags=["fitment"])


class CheckCreateRequest(BaseModel):
    vehicle_identity_id: UUID
    rim_setup_id: UUID
    render_job_id: UUID | None = None
    trigger: str = "user_requested"
    mode: str = "detailed"


class CheckResponse(BaseModel):
    id: str
    execution_status: str
    verdict: str | None = None
    is_preliminary: bool = True
    reasons: list[dict] = Field(default_factory=list)
    conditions: list[dict] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    versions: dict = Field(default_factory=dict)
    error: dict | None = None


def _auth(init_data, telegram_user_id, authorization):
    return resolve_telegram_auth(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        auth_name="fitment checks",
    )


def _field(value, provenance: object, name: str) -> FieldValue:
    """Build a field value while tolerating legacy JSON provenance shapes.

    New ``rim_specs.field_provenance`` values are objects keyed by field name.
    Some pre-fitment rows, however, contain a single JSON string such as
    ``\"user_confirmed\"``.  A detailed check must treat that as provenance for
    every rim field rather than raising an AttributeError.
    """
    if isinstance(provenance, dict):
        candidate = provenance.get(name)
        meta = candidate if isinstance(candidate, dict) else {}
    elif isinstance(provenance, str):
        meta = {"source": provenance}
    else:
        meta = {}
    source = meta.get("source", "user_input")
    try:
        parsed_source = Source(source)
    except ValueError:
        parsed_source = Source.user_input
    return FieldValue(
        value=float(value)
        if value is not None and name not in {"bolt_count", "fastener_system", "seat_type"}
        else value,
        source=parsed_source,
        confidence=float(meta.get("confidence") or 0),
        is_user_confirmed=bool(meta.get("is_user_confirmed")),
    )


async def _load(conn, user_id: int, request: CheckCreateRequest):
    return await conn.fetchrow(
        """
        SELECT
          vehicle.make, vehicle.model AS vehicle_model, vehicle.year, vehicle.body,
          vehicle.generation, vehicle.modification, vehicle.market, vehicle.is_user_confirmed,
          vehicle.provider_mappings, rs.is_staggered,
          rim.brand, rim.model AS rim_model, rim.sku, rim.product_url, rim.bolt_count,
          rim.pcd_mm, rim.center_bore_mm, rim.wheel_diameter_in, rim.wheel_width_j,
          rim.offset_et_mm, rim.load_rating_kg, rim.fastener_system, rim.seat_type,
          rim.field_provenance AS rim_field_provenance, jobs.id AS owned_job_id
        FROM vehicle_identities vehicle
        JOIN rim_setups rs ON rs.id = $2::uuid AND rs.owner_user_id = $1
        JOIN rim_specs rim ON rim.id = rs.front_rim_spec_id AND rim.owner_user_id = $1
        LEFT JOIN jobs ON jobs.id = $3::uuid AND jobs.user_id = $1
        WHERE vehicle.id = $4::uuid AND vehicle.owner_user_id = $1
        """,
        user_id,
        str(request.rim_setup_id),
        str(request.render_job_id) if request.render_job_id else None,
        str(request.vehicle_identity_id),
    )


def _snapshot(row) -> tuple[VehicleIdentity, RimSetup, dict]:
    rim_provenance = row["rim_field_provenance"] or {}
    vehicle = VehicleIdentity(
        make=row["make"],
        model=row["vehicle_model"],
        year=row["year"],
        body=row["body"],
        generation=row["generation"],
        modification=row["modification"],
        market=row["market"],
        is_user_confirmed=bool(row["is_user_confirmed"]),
        provider_mappings=row["provider_mappings"] or {},
    )
    rim = RimSpec(
        brand=row["brand"],
        model=row["rim_model"],
        sku=row["sku"],
        product_url=row["product_url"],
        bolt_count=_field(row["bolt_count"], rim_provenance, "bolt_count"),
        pcd_mm=_field(row["pcd_mm"], rim_provenance, "pcd_mm"),
        center_bore_mm=_field(row["center_bore_mm"], rim_provenance, "center_bore_mm"),
        wheel_diameter_in=_field(row["wheel_diameter_in"], rim_provenance, "wheel_diameter_in"),
        wheel_width_j=_field(row["wheel_width_j"], rim_provenance, "wheel_width_j"),
        offset_et_mm=_field(row["offset_et_mm"], rim_provenance, "offset_et_mm"),
        load_rating_kg=_field(row["load_rating_kg"], rim_provenance, "load_rating_kg"),
        fastener_system=_field(row["fastener_system"], rim_provenance, "fastener_system"),
        seat_type=_field(row["seat_type"], rim_provenance, "seat_type"),
    )
    setup = RimSetup(front=rim, rear=rim, is_staggered=bool(row["is_staggered"]))
    snapshot = {
        "vehicle": vehicle.model_dump(mode="json"),
        "rim_setup": setup.model_dump(mode="json"),
    }
    return vehicle, setup, snapshot


@router.post("/checks", response_model=CheckResponse)
async def create_check(
    request: CheckCreateRequest,
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key")],
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    if not fitment_config.FITMENT_VERDICT_ENABLED:
        raise HTTPException(status_code=503, detail="Fitment verdict is not enabled")
    if request.trigger != "user_requested" or request.mode != "detailed":
        raise HTTPException(
            status_code=422, detail="Only user_requested detailed checks are supported"
        )
    auth = _auth(init_data, telegram_user_id, authorization)
    pool = db.get_pool()
    async with pool.acquire() as conn:
        user_id = await ensure_user(conn, auth.telegram_user_id, auth.username)
        row = await _load(conn, user_id, request)
        if not row:
            raise HTTPException(status_code=404, detail="Fitment inputs not found")
        vehicle, setup, snapshot = _snapshot(row)
        input_hash = hashlib.sha256(json.dumps(snapshot, sort_keys=True).encode()).hexdigest()
        existing = await conn.fetchrow(
            "SELECT * FROM fitment_checks WHERE owner_user_id=$1 AND idempotency_key=$2",
            user_id,
            idempotency_key,
        )
        if existing:
            return _response(existing)
        try:
            provider = WheelSizeProvider()
            resolved = await provider.resolve_vehicle(vehicle)
            profile = (
                await provider.get_fitment_profile(resolved, user_initiated=True)
                if resolved
                else None
            )
            if not profile:
                verdict = verdict_vehicle_not_resolved(provider=provider.name, is_preliminary=True)
            else:
                if not setup.is_staggered and not profile.allowed_for_axle("rear"):
                    profile.allowed_wheels.extend(
                        item.model_copy(update={"axle": "rear"})
                        for item in profile.allowed_for_axle("front")
                    )
                verdict = assemble_verdict(
                    run_checks(profile, setup), provider=provider.name, is_preliminary=True
                )
            result = verdict.model_dump(mode="json")
            status, error = "completed", None
        except ProviderError:
            verdict, result, status, error = (
                None,
                None,
                "failed",
                {"code": "PROVIDER_UNAVAILABLE", "retryable": True},
            )
        record = await conn.fetchrow(
            """INSERT INTO fitment_checks (owner_user_id,vehicle_identity_id,rim_setup_id,render_job_id,idempotency_key,input_hash,execution_status,verdict,input_snapshot,result,error,provider_version,engine_version,rules_version,evaluated_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13,$14,$15) RETURNING *""",
            user_id,
            str(request.vehicle_identity_id),
            str(request.rim_setup_id),
            str(request.render_job_id) if request.render_job_id else None,
            idempotency_key,
            input_hash,
            status,
            verdict.status.value if verdict else None,
            json.dumps(snapshot),
            json.dumps(result) if result else None,
            json.dumps(error) if error else None,
            "wheel_size",
            result.get("engine_version") if result else "v1",
            result.get("tolerances_version") if result else "v1",
            datetime.now(UTC),
        )
    return _response(record)


def _response(row) -> CheckResponse:
    result = row["result"] or {}
    error = row["error"]
    rules = result.get("rule_results") or []
    return CheckResponse(
        id=str(row["id"]),
        execution_status=row["execution_status"],
        verdict=row["verdict"],
        is_preliminary=bool(row["is_preliminary"]),
        reasons=[rule for rule in rules if rule.get("status") in {"incompatible", "unknown"}],
        conditions=[rule for rule in rules if rule.get("status") == "compatible_with_conditions"],
        missing_fields=result.get("missing_fields") or [],
        versions={
            "provider": "wheel_size",
            "engine": row["engine_version"],
            "rules": row["rules_version"],
        },
        error=error,
    )


@router.get("/checks/{check_id}", response_model=CheckResponse)
async def get_check(
    check_id: UUID,
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    auth = _auth(init_data, telegram_user_id, authorization)
    async with db.get_pool().acquire() as conn:
        user_id = await ensure_user(conn, auth.telegram_user_id, auth.username)
        row = await conn.fetchrow(
            "SELECT * FROM fitment_checks WHERE id=$1::uuid AND owner_user_id=$2",
            str(check_id),
            user_id,
        )
    if not row:
        raise HTTPException(status_code=404, detail="Fitment check not found")
    return _response(row)
