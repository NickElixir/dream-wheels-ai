"""Durable detailed Fitment Check API over staging's canonical identity tables."""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel, Field

from src import db, redis_client
from src.auth import resolve_telegram_auth
from src.config import WORKER_ENABLED
from src.fitment import config as fitment_config
from src.fitment.context import PROVIDER_REFERENCE_VERSION, context_hash, is_current_snapshot
from src.fitment.providers.base import ProviderError
from src.fitment.providers.wheel_size import WheelSizeProvider
from src.fitment.rules.engine import run_checks
from src.fitment.rules.tolerances import ENGINE_VERSION, TOLERANCES_VERSION
from src.fitment.rules.verdict import assemble_verdict, verdict_vehicle_not_resolved
from src.fitment.schemas import FieldValue, RimSetup, RimSpec, Source, VehicleIdentity
from src.users_service import ensure_user

router = APIRouter(prefix="/fitment", tags=["fitment"])
logger = logging.getLogger(__name__)
FITMENT_CHECK_QUEUE = "fitment_check_queue"
FITMENT_CHECK_LEASE_SEC = 15 * 60
FITMENT_CHECK_MAX_ATTEMPTS = 3


class CheckCreateRequest(BaseModel):
    vehicle_identity_id: UUID
    rim_setup_id: UUID
    render_job_id: UUID | None = None
    trigger: str = "user_requested"
    # `detailed` is retained only for clients released before the Standard /
    # Extended naming. It is normalized to `standard` below.
    mode: Literal["standard", "detailed"] = "standard"


class CheckResponse(BaseModel):
    id: str
    mode: Literal["standard"] = "standard"
    execution_status: str
    verdict: str | None = None
    is_preliminary: bool = True
    reasons: list[dict] = Field(default_factory=list)
    conditions: list[dict] = Field(default_factory=list)
    blocking_issues: list[dict] = Field(default_factory=list)
    advisories: list[dict] = Field(default_factory=list)
    diagnostics: list[dict] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    versions: dict = Field(default_factory=dict)
    error: dict | None = None
    is_current: bool = False
    input_hash: str | None = None
    created_at: datetime | None = None
    evaluated_at: datetime | None = None
    retry_mode: Literal["retryable", "retry_later", "not_applicable"] = "not_applicable"
    retry_at: datetime | None = None


def _auth(init_data, telegram_user_id, authorization):
    return resolve_telegram_auth(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        auth_name="fitment checks",
    )


def _json_object(value: object, *, field_name: str) -> dict:
    """Normalize asyncpg JSONB values to objects at the database boundary."""
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    if not isinstance(value, str):
        logger.warning("⚠️ Unsupported %s type=%s", field_name, type(value).__name__)
        return {}
    try:
        parsed = json.loads(value)
    except (TypeError, ValueError):
        logger.warning("⚠️ Invalid %s JSON", field_name)
        return {}
    if isinstance(parsed, dict):
        return parsed
    logger.warning("⚠️ Non-object %s JSON type=%s", field_name, type(parsed).__name__)
    return {}


def _float_or_zero(value: object) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def _field(value, provenance: object, name: str) -> FieldValue:
    """Build a field value while tolerating legacy JSON provenance shapes.

    New ``rim_specs.field_provenance`` values are objects keyed by field name.
    Some pre-fitment rows, however, contain a single JSON string such as
    ``\"user_confirmed\"``.  A detailed check must treat that as provenance for
    every rim field rather than raising an AttributeError.
    """
    decoded_provenance: object = provenance
    if isinstance(provenance, str):
        try:
            decoded_provenance = json.loads(provenance)
        except (TypeError, ValueError):
            decoded_provenance = provenance

    if isinstance(decoded_provenance, dict):
        candidate = decoded_provenance.get(name)
        meta = candidate if isinstance(candidate, dict) else {}
    elif isinstance(decoded_provenance, str):
        meta = {"source": decoded_provenance}
    else:
        meta = {}
    source = meta.get("source", "user_input")
    try:
        parsed_source = Source(source)
    except (TypeError, ValueError):
        parsed_source = Source.user_input
    return FieldValue(
        value=float(value)
        if value is not None and name not in {"bolt_count", "fastener_system", "seat_type"}
        else value,
        source=parsed_source,
        confidence=_float_or_zero(meta.get("confidence")),
        is_user_confirmed=bool(meta.get("is_user_confirmed")),
    )


async def _load(conn, user_id: int, request: CheckCreateRequest):
    return await conn.fetchrow(
        """
        SELECT
          vehicle.id::text AS vehicle_identity_id,
          rs.id::text AS rim_setup_id,
          vehicle.make, vehicle.model AS vehicle_model, vehicle.year, vehicle.body,
          vehicle.generation, vehicle.modification, vehicle.market, vehicle.is_user_confirmed,
          vehicle.provider_mappings, vehicle.revision AS vehicle_revision,
          vehicle.provider_mapping_revision, rs.is_staggered, rs.revision AS rim_setup_revision,
          front_rim.brand AS front_rim_brand, front_rim.model AS front_rim_model,
          front_rim.sku AS front_rim_sku, front_rim.product_url AS front_rim_product_url,
          front_rim.bolt_count AS front_rim_bolt_count, front_rim.pcd_mm AS front_rim_pcd_mm,
          front_rim.center_bore_mm AS front_rim_center_bore_mm,
          front_rim.wheel_diameter_in AS front_rim_wheel_diameter_in,
          front_rim.wheel_width_j AS front_rim_wheel_width_j,
          front_rim.offset_et_mm AS front_rim_offset_et_mm,
          front_rim.load_rating_kg AS front_rim_load_rating_kg,
          front_rim.fastener_system AS front_rim_fastener_system,
          front_rim.seat_type AS front_rim_seat_type,
          front_rim.field_provenance AS front_rim_field_provenance,
          front_rim.revision AS front_rim_revision,
          front_rim.source_fingerprint AS front_rim_source_fingerprint,
          front_rim.selected_variant_sku AS front_rim_selected_variant_sku,
          rear_rim.brand AS rear_rim_brand, rear_rim.model AS rear_rim_model,
          rear_rim.sku AS rear_rim_sku, rear_rim.product_url AS rear_rim_product_url,
          rear_rim.bolt_count AS rear_rim_bolt_count, rear_rim.pcd_mm AS rear_rim_pcd_mm,
          rear_rim.center_bore_mm AS rear_rim_center_bore_mm,
          rear_rim.wheel_diameter_in AS rear_rim_wheel_diameter_in,
          rear_rim.wheel_width_j AS rear_rim_wheel_width_j,
          rear_rim.offset_et_mm AS rear_rim_offset_et_mm,
          rear_rim.load_rating_kg AS rear_rim_load_rating_kg,
          rear_rim.fastener_system AS rear_rim_fastener_system,
          rear_rim.seat_type AS rear_rim_seat_type,
          rear_rim.field_provenance AS rear_rim_field_provenance,
          rear_rim.revision AS rear_rim_revision,
          rear_rim.source_fingerprint AS rear_rim_source_fingerprint,
          rear_rim.selected_variant_sku AS rear_rim_selected_variant_sku,
          jobs.id AS owned_job_id
        FROM vehicle_identities vehicle
        JOIN rim_setups rs ON rs.id = $2::uuid AND rs.owner_user_id = $1
        JOIN rim_specs front_rim ON front_rim.id = rs.front_rim_spec_id AND front_rim.owner_user_id = $1
        JOIN rim_specs rear_rim ON rear_rim.id = rs.rear_rim_spec_id AND rear_rim.owner_user_id = $1
        LEFT JOIN jobs ON jobs.id = $3::uuid AND jobs.user_id = $1
        WHERE vehicle.id = $4::uuid AND vehicle.owner_user_id = $1
        """,
        user_id,
        str(request.rim_setup_id),
        str(request.render_job_id) if request.render_job_id else None,
        str(request.vehicle_identity_id),
    )


def _rim_snapshot(row, prefix: str, *, fallback_prefix: str = "") -> RimSpec:
    """Read one canonical axle RimSpec without consulting parser candidates."""

    def value(name: str):
        key = f"{prefix}_{name}"
        if key in row:
            return row[key]
        if fallback_prefix:
            fallback_key = f"{fallback_prefix}_{name}"
            if fallback_key in row:
                return row[fallback_key]
        return row.get(name)

    provenance = value("field_provenance") or {}
    return RimSpec(
        brand=value("brand"),
        model=value("model"),
        sku=value("sku"),
        product_url=value("product_url"),
        source_fingerprint=value("source_fingerprint"),
        selected_variant_sku=value("selected_variant_sku"),
        revision=value("revision"),
        bolt_count=_field(value("bolt_count"), provenance, "bolt_count"),
        pcd_mm=_field(value("pcd_mm"), provenance, "pcd_mm"),
        center_bore_mm=_field(value("center_bore_mm"), provenance, "center_bore_mm"),
        wheel_diameter_in=_field(value("wheel_diameter_in"), provenance, "wheel_diameter_in"),
        wheel_width_j=_field(value("wheel_width_j"), provenance, "wheel_width_j"),
        offset_et_mm=_field(value("offset_et_mm"), provenance, "offset_et_mm"),
        load_rating_kg=_field(value("load_rating_kg"), provenance, "load_rating_kg"),
        fastener_system=_field(value("fastener_system"), provenance, "fastener_system"),
        seat_type=_field(value("seat_type"), provenance, "seat_type"),
    )


def _snapshot(row) -> tuple[VehicleIdentity, RimSetup, dict]:
    vehicle = VehicleIdentity(
        make=row["make"],
        model=row["vehicle_model"],
        year=row["year"],
        body=row["body"],
        generation=row["generation"],
        modification=row["modification"],
        market=row["market"],
        is_user_confirmed=bool(row["is_user_confirmed"]),
        provider_mappings=_json_object(
            row["provider_mappings"], field_name="vehicle provider_mappings"
        ),
    )
    # The fallback keeps old immutable snapshots/test doubles readable. New DB
    # reads always contain independently selected front and rear columns.
    front = _rim_snapshot(row, "front_rim", fallback_prefix="rim")
    rear = _rim_snapshot(row, "rear_rim", fallback_prefix="rim")
    setup = RimSetup(
        front=front,
        rear=rear,
        is_staggered=bool(row["is_staggered"]),
        revision=row.get("rim_setup_revision"),
    )
    snapshot = {
        "vehicle": vehicle.model_dump(mode="json"),
        "rim_setup": setup.model_dump(mode="json"),
        "context_identity": {
            "vehicle_identity_id": row.get("vehicle_identity_id"),
            "vehicle_revision": row.get("vehicle_revision"),
            "vehicle_provider_mapping_revision": row.get("provider_mapping_revision")
            or row.get("vehicle_provider_mapping_revision"),
            "vehicle_provider_mapping": vehicle.provider_mappings.get("wheel_size"),
            "modification_state": (vehicle.provider_mappings.get("wheel_size") or {}).get(
                "modification_state"
            ),
            "selection_source": (vehicle.provider_mappings.get("wheel_size") or {}).get(
                "selection_source"
            ),
            "selected_modification": (vehicle.provider_mappings.get("wheel_size") or {}).get(
                "selected_modification"
            ),
            "modification_vehicle_revision": (
                vehicle.provider_mappings.get("wheel_size") or {}
            ).get("modification_vehicle_revision"),
            "rim_setup_id": row.get("rim_setup_id"),
            "rim_setup_revision": row.get("rim_setup_revision") or row.get("rim_revision"),
            "setup_mode": "staggered" if bool(row["is_staggered"]) else "uniform",
            "front_rim_revision": row.get("front_rim_revision") or row.get("rim_revision"),
            "rear_rim_revision": row.get("rear_rim_revision") or row.get("rim_revision"),
            "front_source_fingerprint": row.get("front_rim_source_fingerprint"),
            "rear_source_fingerprint": row.get("rear_rim_source_fingerprint"),
            "front_selected_variant_sku": row.get("front_rim_selected_variant_sku"),
            "rear_selected_variant_sku": row.get("rear_rim_selected_variant_sku"),
            "engine_version": ENGINE_VERSION,
            "rules_version": TOLERANCES_VERSION,
            "provider_version": PROVIDER_REFERENCE_VERSION,
        },
    }
    return vehicle, setup, snapshot


def _has_current_confirmed_modification(
    provider_mapping: dict[str, object],
    *,
    vehicle_revision: int,
) -> bool:
    """Guard positive Standard evaluation with Slice 3 selection evidence."""
    try:
        bound_revision = int(provider_mapping.get("modification_vehicle_revision"))
    except (TypeError, ValueError):
        return False
    return (
        provider_mapping.get("modification_state") == "confirmed"
        and provider_mapping.get("selection_source") in {"wheel_size_single", "user"}
        and bound_revision == int(vehicle_revision)
    )


async def _check_is_current(conn, user_id: int, row) -> bool:
    """Compare immutable context identity with the current canonical rows."""
    snapshot = _json_object(row.get("input_snapshot"), field_name="fitment check input_snapshot")
    if not context_hash(snapshot):
        return False
    try:
        request = CheckCreateRequest(
            vehicle_identity_id=UUID(str(row["vehicle_identity_id"])),
            rim_setup_id=UUID(str(row["rim_setup_id"])),
        )
        current = await _load(conn, user_id, request)
        if not current:
            return False
        _, _, current_snapshot = _snapshot(current)
        current_snapshot["context_identity"].update(
            {
                "engine_version": ENGINE_VERSION,
                "rules_version": TOLERANCES_VERSION,
                "provider_version": PROVIDER_REFERENCE_VERSION,
            }
        )
        return is_current_snapshot(snapshot, current_snapshot)
    except (AssertionError, KeyError, NotImplementedError, TypeError, ValueError):
        return False


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
    if request.trigger != "user_requested":
        raise HTTPException(
            status_code=422, detail="Only user_requested standard checks are supported"
        )
    auth = _auth(init_data, telegram_user_id, authorization)
    pool = db.get_pool()
    async with pool.acquire() as conn:
        user_id = await ensure_user(conn, auth.telegram_user_id, auth.username)
        row = await _load(conn, user_id, request)
        if not row:
            raise HTTPException(status_code=404, detail="Fitment inputs not found")
        if request.render_job_id and row["owned_job_id"] is None:
            raise HTTPException(status_code=404, detail="Render job not found")
        vehicle, setup, snapshot = _snapshot(row)
        snapshot["check_mode"] = "standard"
        snapshot["context_identity"].update(
            {
                "engine_version": ENGINE_VERSION,
                "rules_version": TOLERANCES_VERSION,
                "provider_version": PROVIDER_REFERENCE_VERSION,
            }
        )
        provider_mapping = vehicle.provider_mappings.get("wheel_size") or {}
        required_mapping = {
            "make_slug",
            "model_slug",
            "region",
            "generation_slug",
            "modification_slug",
        }
        if not required_mapping.issubset(
            provider_mapping
        ) or not _has_current_confirmed_modification(
            provider_mapping,
            vehicle_revision=row["vehicle_revision"],
        ):
            raise HTTPException(
                status_code=409,
                detail="A confirmed Wheel-Size vehicle variant is required before this check",
            )
        input_hash = hashlib.sha256(json.dumps(snapshot, sort_keys=True).encode()).hexdigest()
        existing = await conn.fetchrow(
            "SELECT * FROM fitment_checks WHERE owner_user_id=$1 AND idempotency_key=$2",
            user_id,
            idempotency_key,
        )
        if existing:
            if existing["input_hash"] != input_hash:
                raise HTTPException(
                    status_code=409,
                    detail="Idempotency-Key was already used for different fitment inputs",
                )
            return _response(existing, is_current=await _check_is_current(conn, user_id, existing))
        # Equivalent active work is reused even when a client retried with a
        # fresh idempotency key. Terminal completed work is also reusable for
        # the exact same context and rules/provider versions.
        try:
            equivalent = await conn.fetchrow(
                """
                SELECT * FROM fitment_checks
                WHERE owner_user_id=$1 AND vehicle_identity_id=$2::uuid
                  AND rim_setup_id=$3::uuid AND input_hash=$4
                  AND execution_status IN ('queued', 'processing', 'completed')
                ORDER BY created_at DESC LIMIT 1
                """,
                user_id,
                str(request.vehicle_identity_id),
                str(request.rim_setup_id),
                input_hash,
            )
        except (AssertionError, NotImplementedError):
            # Lightweight test doubles from the pre-Slice-5 API only model
            # idempotency lookups; production connections always support it.
            equivalent = None
        if equivalent:
            return _response(
                equivalent, is_current=await _check_is_current(conn, user_id, equivalent)
            )

        if WORKER_ENABLED and redis_client.is_initialized():
            queued = await conn.fetchrow(
                """INSERT INTO fitment_checks
                   (owner_user_id,vehicle_identity_id,rim_setup_id,render_job_id,
                    idempotency_key,input_hash,execution_status,verdict,input_snapshot,
                    result,error,provider_version,engine_version,rules_version)
                   VALUES ($1,$2,$3,$4,$5,$6,'queued',NULL,$7::jsonb,NULL,NULL,
                           'wheel_size',$8,$9)
                   ON CONFLICT (owner_user_id, idempotency_key) DO NOTHING
                   RETURNING *""",
                user_id,
                str(request.vehicle_identity_id),
                str(request.rim_setup_id),
                str(request.render_job_id) if request.render_job_id else None,
                idempotency_key,
                input_hash,
                json.dumps(snapshot),
                ENGINE_VERSION,
                TOLERANCES_VERSION,
            )
            if queued is None:
                queued = await conn.fetchrow(
                    "SELECT * FROM fitment_checks WHERE owner_user_id=$1 AND idempotency_key=$2",
                    user_id,
                    idempotency_key,
                )
            if queued is None:
                raise HTTPException(status_code=503, detail="Fitment check could not be queued")
            await redis_client.get_client().rpush(
                redis_client.key(FITMENT_CHECK_QUEUE),
                json.dumps({"kind": "fitment_check", "check_id": str(queued["id"])}),
            )
            return _response(queued, is_current=await _check_is_current(conn, user_id, queued))
        try:
            provider = WheelSizeProvider()
            profile = await provider.get_fitment_profile(vehicle, user_initiated=True)
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
            evaluation_snapshot = {
                "vehicle_provider_mapping": provider_mapping,
                "provider_request": {
                    "make": provider_mapping["make_slug"],
                    "model": provider_mapping["model_slug"],
                    "year": vehicle.year,
                    "region": provider_mapping["region"],
                    "generation": provider_mapping["generation_slug"],
                    "modification": provider_mapping["modification_slug"],
                },
                "normalized_profile": profile.model_dump(mode="json") if profile else None,
                "provider_response_hash": hashlib.sha256(
                    json.dumps(
                        profile.model_dump(mode="json") if profile else {}, sort_keys=True
                    ).encode()
                ).hexdigest(),
                "provider": provider.name,
                "provider_version": profile.provider_version if profile else "v2",
                "fetched_at": profile.fetched_at if profile else datetime.now(UTC).isoformat(),
                "disclaimer_version": "stock_vehicle_only_v1",
                "vehicle_identity_revision": row["vehicle_revision"],
                "rim_setup_revision": row.get("rim_setup_revision") or row["rim_revision"],
                "rim_spec_revisions": {
                    "front": row.get("front_rim_revision") or row["rim_revision"],
                    "rear": row.get("rear_rim_revision") or row["rim_revision"],
                },
                "rim_source_fingerprints": {
                    "front": row.get("front_rim_source_fingerprint"),
                    "rear": row.get("rear_rim_source_fingerprint"),
                },
                "provider_mapping_revision": row["provider_mapping_revision"],
            }
            status, error = "completed", None
        except ProviderError as exc:
            logger.warning("⚠️ Fitment provider unavailable for user_id=%s: %s", user_id, exc)
            retryable = not any(code in str(exc) for code in ("HTTP 400", "HTTP 401", "HTTP 403"))
            verdict, result, evaluation_snapshot, status, error = (
                None,
                None,
                None,
                "failed",
                {
                    "code": "provider_unavailable" if retryable else "provider_configuration_error",
                    "retry_mode": "retryable" if retryable else "not_applicable",
                    "retryable": retryable,
                    "retry_at": None,
                },
            )
        except Exception as exc:
            logger.exception("⚠️ Fitment check execution failed during synchronous fallback")
            verdict, result, evaluation_snapshot, status, error = (
                None,
                None,
                None,
                "failed",
                _execution_error(exc),
            )
        record = await conn.fetchrow(
            """INSERT INTO fitment_checks (owner_user_id,vehicle_identity_id,rim_setup_id,render_job_id,idempotency_key,input_hash,execution_status,verdict,input_snapshot,result,error,provider_version,engine_version,rules_version,evaluated_at,evaluation_snapshot,resolution_status,disclaimer_version,provider_mapping_revision)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16::jsonb,$17,$18,$19)
               ON CONFLICT (owner_user_id, idempotency_key) DO NOTHING
               RETURNING *""",
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
            provider.name if result else "wheel_size",
            result.get("engine_version") if result else ENGINE_VERSION,
            result.get("tolerances_version") if result else TOLERANCES_VERSION,
            datetime.now(UTC),
            json.dumps(evaluation_snapshot) if evaluation_snapshot else None,
            "resolved" if result else "provider_failed",
            "stock_vehicle_only_v1",
            row["provider_mapping_revision"],
        )
        if record is None:
            existing = await conn.fetchrow(
                "SELECT * FROM fitment_checks WHERE owner_user_id=$1 AND idempotency_key=$2",
                user_id,
                idempotency_key,
            )
            if not existing:
                raise HTTPException(status_code=503, detail="Fitment check could not be persisted")
            if existing["input_hash"] != input_hash:
                raise HTTPException(
                    status_code=409,
                    detail="Idempotency-Key was already used for different fitment inputs",
                )
            record = existing
        response = _response(record, is_current=await _check_is_current(conn, user_id, record))
    return response


def _execution_error(exc: Exception) -> dict[str, object]:
    message = str(exc).lower()
    if isinstance(exc, TimeoutError) or "timeout" in message:
        code, retry_mode = "provider_timeout", "retryable"
    elif "401" in message or "403" in message or "auth" in message:
        code, retry_mode = "provider_authentication_failed", "not_applicable"
    elif "429" in message or "thrott" in message:
        code, retry_mode = "throttled", "retry_later"
    elif "quota" in message:
        code, retry_mode = "quota_exceeded", "retry_later"
    elif "proxy" in message:
        code, retry_mode = "proxy_error", "retryable"
    elif "network" in message:
        code, retry_mode = "network_error", "retryable"
    elif isinstance(exc, ProviderError) or "connection" in message:
        code, retry_mode = "provider_unavailable", "retryable"
    elif "json" in message or "malformed" in message:
        code, retry_mode = "malformed_response", "not_applicable"
    else:
        code, retry_mode = "internal_execution_error", "not_applicable"
    return {
        "code": code,
        "retry_mode": retry_mode,
        "retryable": retry_mode != "not_applicable",
        "retry_at": None,
    }


async def execute_fitment_check(check_id: str) -> None:
    """Claim and execute one queued Standard check from the existing worker."""
    pool = db.get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE fitment_checks
            SET execution_status='processing', started_at=CURRENT_TIMESTAMP,
                attempt_count=attempt_count + 1, updated_at=CURRENT_TIMESTAMP
            WHERE id=$1::uuid AND execution_status='queued'
            RETURNING *
            """,
            check_id,
        )

    if not row:
        return
    snapshot = _json_object(row.get("input_snapshot"), field_name="fitment check input_snapshot")
    try:
        vehicle = VehicleIdentity(**snapshot["vehicle"])
        setup = RimSetup(**snapshot["rim_setup"])
        provider = WheelSizeProvider()
        profile = await provider.get_fitment_profile(vehicle, user_initiated=True)
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
        evaluation_snapshot = {
            "context_identity": snapshot.get("context_identity"),
            "vehicle_provider_mapping": vehicle.provider_mappings.get("wheel_size"),
            "normalized_profile": profile.model_dump(mode="json") if profile else None,
            "provider_response_hash": hashlib.sha256(
                json.dumps(
                    profile.model_dump(mode="json") if profile else {}, sort_keys=True
                ).encode()
            ).hexdigest(),
            "provider": provider.name,
            "provider_version": profile.provider_version if profile else "v2",
            "fetched_at": profile.fetched_at if profile else datetime.now(UTC).isoformat(),
            "disclaimer_version": "stock_vehicle_only_v1",
        }
        error = None
    except Exception as exc:  # operational boundary; never turn failures into unknown
        logger.exception("fitment_check_execution_failed check_id=%s", check_id)
        result, verdict, evaluation_snapshot = None, None, None
        error = _execution_error(exc)
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE fitment_checks
            SET execution_status=$1, verdict=$2, result=$3::jsonb, error=$4::jsonb,
                provider_version=$5, engine_version=$6, rules_version=$7,
                evaluation_snapshot=$8::jsonb,
                evaluated_at=CASE WHEN $1='completed' THEN CURRENT_TIMESTAMP ELSE NULL END,
                updated_at=CURRENT_TIMESTAMP
            WHERE id=$9::uuid AND execution_status='processing'
            """,
            "completed" if result else "failed",
            verdict.status.value if verdict else None,
            json.dumps(result) if result else None,
            json.dumps(error) if error else None,
            "wheel_size",
            result.get("engine_version") if result else ENGINE_VERSION,
            result.get("tolerances_version") if result else TOLERANCES_VERSION,
            json.dumps(evaluation_snapshot) if evaluation_snapshot else None,
            check_id,
        )


def _response(row, *, is_current: bool | None = None) -> CheckResponse:
    result = _json_object(row["result"], field_name="fitment check result")
    error = _json_object(row["error"], field_name="fitment check error") or None
    rules = result.get("rule_results") or []
    legacy_reasons = [
        rule
        for rule in rules
        if isinstance(rule, dict) and rule.get("status") in {"incompatible", "unknown"}
    ]
    retry_mode = "not_applicable"
    if error:
        retry_mode = error.get("retry_mode") or (
            "retryable" if error.get("retryable") else "not_applicable"
        )
    return CheckResponse(
        id=str(row["id"]),
        mode="standard",
        execution_status=row["execution_status"],
        verdict=row["verdict"],
        is_preliminary=bool(row["is_preliminary"]),
        reasons=legacy_reasons,
        conditions=result.get("conditions")
        or [
            rule
            for rule in rules
            if isinstance(rule, dict) and rule.get("status") == "compatible_with_conditions"
        ],
        blocking_issues=result.get("blocking_issues") or legacy_reasons,
        advisories=result.get("advisories") or [],
        diagnostics=result.get("diagnostics") or [],
        missing_fields=result.get("missing_fields") or [],
        versions={
            "provider": "wheel_size",
            "engine": row["engine_version"],
            "rules": row["rules_version"],
        },
        error=error,
        is_current=bool(row.get("is_current", False) if is_current is None else is_current),
        input_hash=row.get("input_hash"),
        created_at=row.get("created_at"),
        evaluated_at=row.get("evaluated_at"),
        retry_mode=retry_mode,
        retry_at=row.get("retry_at"),
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
        current = await _check_is_current(conn, user_id, row) if row else False
    if not row:
        raise HTTPException(status_code=404, detail="Fitment check not found")
    return _response(row, is_current=current)


class CheckHistoryItem(BaseModel):
    id: str
    execution_status: str
    verdict: str | None = None
    created_at: datetime | None = None
    evaluated_at: datetime | None = None
    input_hash: str | None = None
    versions: dict[str, object] = Field(default_factory=dict)
    is_current: bool = False


class CheckHistoryResponse(BaseModel):
    checks: list[CheckHistoryItem] = Field(default_factory=list)


@router.get("/checks", response_model=CheckHistoryResponse)
async def list_checks(
    vehicle_identity_id: UUID,
    rim_setup_id: UUID,
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    auth = _auth(init_data, telegram_user_id, authorization)
    async with db.get_pool().acquire() as conn:
        user_id = await ensure_user(conn, auth.telegram_user_id, auth.username)
        rows = await conn.fetch(
            """
            SELECT * FROM fitment_checks
            WHERE owner_user_id=$1 AND vehicle_identity_id=$2::uuid AND rim_setup_id=$3::uuid
            ORDER BY created_at DESC
            """,
            user_id,
            str(vehicle_identity_id),
            str(rim_setup_id),
        )
        items = []
        for row in rows:
            current = await _check_is_current(conn, user_id, row)
            items.append(
                CheckHistoryItem(
                    id=str(row["id"]),
                    execution_status=row["execution_status"],
                    verdict=row.get("verdict"),
                    created_at=row.get("created_at"),
                    evaluated_at=row.get("evaluated_at"),
                    input_hash=row.get("input_hash"),
                    versions={
                        "provider": row.get("provider_version"),
                        "engine": row.get("engine_version"),
                        "rules": row.get("rules_version"),
                    },
                    is_current=current,
                )
            )
    return CheckHistoryResponse(checks=items)


async def recover_stale_fitment_checks() -> None:
    """Requeue abandoned claims after a worker restart, with a bounded retry."""
    pool = db.get_pool()
    async with pool.acquire() as conn:
        requeued = await conn.fetch(
            """
            UPDATE fitment_checks
            SET execution_status='queued', started_at=NULL,
                retry_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
            WHERE execution_status='processing'
              AND started_at < CURRENT_TIMESTAMP - ($1 * INTERVAL '1 second')
              AND attempt_count < $2
            RETURNING id
            """,
            FITMENT_CHECK_LEASE_SEC,
            FITMENT_CHECK_MAX_ATTEMPTS,
        )
        await conn.execute(
            """
            UPDATE fitment_checks
            SET execution_status='failed', verdict=NULL,
                error=jsonb_build_object(
                    'code', 'internal_execution_error',
                    'retry_mode', 'not_applicable',
                    'retryable', false
                ),
                updated_at=CURRENT_TIMESTAMP
            WHERE execution_status='processing'
              AND started_at < CURRENT_TIMESTAMP - ($1 * INTERVAL '1 second')
              AND attempt_count >= $2
            """,
            FITMENT_CHECK_LEASE_SEC,
            FITMENT_CHECK_MAX_ATTEMPTS,
        )
    for row in requeued:
        await redis_client.get_client().rpush(
            redis_client.key(FITMENT_CHECK_QUEUE),
            json.dumps({"kind": "fitment_check", "check_id": str(row["id"])}),
        )
