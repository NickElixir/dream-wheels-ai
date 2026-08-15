"""HTTP-эндпоинты для jobs.

Создание задачи (через бот по URL или из webapp через multipart) +
polling статуса. Воркер (process_jobs_loop) живёт отдельно в src/main.py,
потому что стартует/останавливается в lifespan приложения.
Здесь — только тонкий HTTP-слой.
"""

import json
import logging
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal

import httpx
from fastapi import APIRouter, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from src import assets_service, db, identity_service, redis_client, storage
from src.assets_service import AssetKind
from src.auth import AuthContext, resolve_telegram_auth
from src.config import (
    API_INTERNAL_TOKEN,
    REDIS_JOB_QUEUE,
    RIM_URL_RESOLVER_ENABLED,
    RIM_URL_RESOLVER_MAX_BODY_BYTES,
    RIM_URL_RESOLVER_MAX_REDIRECTS,
    RIM_URL_RESOLVER_TIMEOUT_SEC,
    WORKER_ENABLED,
)
from src.credits_service import InsufficientCreditsError, refund_job_credit, reserve_job_credit
from src.fitment.providers.base import ProviderError
from src.fitment.providers.wheel_size import WheelSizeProvider
from src.fitment.schemas import VehicleIdentity as ProviderVehicleIdentity
from src.rate_limit import enforce_rate_limit
from src.rim_url_resolver import (
    FetchLimits,
    PublicHttpsPolicy,
    RimUrlError,
    resolve_rim_product_url,
)
from src.share_api import share_url_for_job
from src.users_service import ensure_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["jobs"])

TELEGRAM_FILE_PREFIX = "https://api.telegram.org/file/"

# Лимит для бота (POST /jobs c URL): защита от спама от одного юзера.
JOBS_RATE_LIMIT = 5
JOBS_RATE_WINDOW_SEC = 60

# Лимит для webapp (POST /jobs/upload): Reve API стоит денег, ставим жёстче.
UPLOAD_RATE_LIMIT = 10
UPLOAD_RATE_WINDOW_SEC = 60 * 60  # 10/час
RIM_SOURCE_RESOLVE_RATE_LIMIT = 10
RIM_SOURCE_RESOLVE_RATE_WINDOW_SEC = 60 * 60

MAX_RAW_FILE_BYTES = 10 * 1024 * 1024  # 10 MB — синхронно с лимитом raw bucket
ALLOWED_UPLOAD_MIME = {"image/jpeg", "image/jpg", "image/png", "image/webp"}

# Идемпотентность: ключ живёт 1 час. Юзер с ретраем (плохой коннект)
# получит тот же job_id вместо дубля рендера.
IDEMPOTENCY_TTL_SEC = 60 * 60

FEEDBACK_SENTIMENTS = frozenset({"liked", "disliked"})
FEEDBACK_REASONS = frozenset(
    {"wheel_differs", "car_changed", "angle_or_scale", "image_quality", "other"}
)


def _get_render_queue_client(endpoint: str, telegram_user_id: int):
    if not WORKER_ENABLED:
        logger.warning(
            "⛔ Render queue disabled: endpoint=%s tg_user=%s", endpoint, telegram_user_id
        )
        raise HTTPException(status_code=503, detail="Render worker disabled")
    try:
        return redis_client.get_client()
    except RuntimeError as exc:
        logger.exception(
            "❌ Render queue unavailable: endpoint=%s tg_user=%s: %s",
            endpoint,
            telegram_user_id,
            exc,
        )
        raise HTTPException(status_code=503, detail="Render queue unavailable") from exc


class JobCreateRequest(BaseModel):
    telegram_user_id: int
    username: str | None = None
    car_url: str
    wheel_url: str

    @field_validator("username")
    @classmethod
    def normalize_username(cls, v: str | None) -> str | None:
        if v is None:
            return None
        username = v.strip().lstrip("@")
        return username or None

    @field_validator("car_url", "wheel_url")
    @classmethod
    def validate_telegram_url(cls, v: str) -> str:
        # Защита от arbitrary URL: воркер скачивает контент по этому URL и шлёт
        # в Reve API. Без проверки можно подставить любой http-эндпоинт.
        if not v.startswith(TELEGRAM_FILE_PREFIX):
            raise ValueError(f"URL должен начинаться с {TELEGRAM_FILE_PREFIX}")
        return v


class JobCreateResponse(BaseModel):
    job_id: str
    status: str


class JobFromAssetsRequest(BaseModel):
    draft_id: str
    idempotency_key: str
    vehicle: identity_service.VehicleCandidate
    rim: identity_service.RimProposal
    rim_user_confirmed: bool = True
    init_data: str | None = None
    telegram_user_id: int | None = None


class JobFeedbackSummary(BaseModel):
    sentiment: str
    reason: str | None = None
    created_at: datetime
    updated_at: datetime


class JobFeedbackRecord(JobFeedbackSummary):
    render_job_id: str


class JobFeedbackEnvelope(BaseModel):
    feedback: JobFeedbackRecord | None


class JobStatusResponse(BaseModel):
    job_id: str | None = None
    status: str
    output_image_url: str | None = None
    created_at: datetime | None = None
    completed_at: datetime | None = None
    error_code: str | None = None
    error_message: str | None = None
    feedback: JobFeedbackSummary | None = None
    assets: dict[str, "JobAssetResponse"] | None = None
    render_input_snapshot: dict[str, object] | None = None


class JobStatusDetailedResponse(BaseModel):
    """Расширенный ответ для webapp polling: + url рендера + текст ошибки."""

    job_id: str
    status: str
    result_url: str | None = None
    share_url: str | None = None
    error: str | None = None
    error_code: str | None = None
    fitment_available: bool = False
    feedback: JobFeedbackSummary | None = None
    assets: dict[str, "JobAssetResponse"] | None = None
    render_input_snapshot: dict[str, object] | None = None


class JobAssetResponse(BaseModel):
    id: str
    kind: str
    content_type: str | None = None
    size_bytes: int | None = None
    width: int | None = None
    height: int | None = None
    created_at: datetime | None = None
    url: str | None = None
    download_url: str | None = None


class JobHistoryItem(BaseModel):
    job_id: str
    status: str
    created_at: datetime
    completed_at: datetime | None = None
    result_url: str | None = None
    error_code: str | None = None
    error_message: str | None = None
    generation_provider: str | None = None
    provider_request_id: str | None = None
    fitment_available: bool = False
    feedback: JobFeedbackSummary | None = None
    assets: dict[str, JobAssetResponse] = Field(default_factory=dict)
    render_input_snapshot: dict[str, object] | None = None


class JobHistoryResponse(BaseModel):
    jobs: list[JobHistoryItem]
    limit: int
    offset: int


class FitmentVehicleResponse(BaseModel):
    make: str | None = None
    model: str | None = None
    year: int | None = None
    body: str | None = None
    generation: str | None = None
    modification: str | None = None
    market: str | None = None
    is_user_confirmed: bool
    title: str


class FitmentRimResponse(BaseModel):
    brand: str | None = None
    model: str | None = None
    sku: str | None = None
    product_url: str | None = None
    bolt_count: int | None = None
    pcd_mm: float | None = None
    pcd_display: str | None = None
    center_bore_mm: float | None = None
    wheel_diameter_in: float | None = None
    wheel_width_j: float | None = None
    offset_et_mm: float | None = None
    has_product_url: bool
    title: str


class FitmentReadinessResponse(BaseModel):
    ready: bool
    missing_fields: list[str] = Field(default_factory=list)
    blocking_fields: list[str] = Field(default_factory=list)
    unconfirmed_fields: list[str] = Field(default_factory=list)


class FitmentProviderReadinessResponse(BaseModel):
    status: str
    blocking_issues: list[dict[str, str]] = Field(default_factory=list)


class FitmentNextActionResponse(BaseModel):
    """The single product action that advances the Standard Check workflow."""

    kind: Literal[
        "complete_vehicle_details",
        "complete_rim_specs",
        "select_vehicle_variant",
        "run_standard_check",
    ]


class FitmentOverviewResponse(BaseModel):
    job_id: str
    vehicle_identity_id: str
    rim_setup_id: str
    vehicle_identity_id: str
    rim_setup_id: str
    status: str
    result_url: str | None = None
    completed_at: datetime | None = None
    fitment_available: bool
    is_staggered: bool
    snapshot_locked: bool = True
    vehicle_revision: int
    rim_revision: int
    vehicle_candidates: dict[str, list[dict[str, object]]] = Field(default_factory=dict)
    rim_candidates: dict[str, list[dict[str, object]]] = Field(default_factory=dict)
    vehicle_provenance: dict[str, object] = Field(default_factory=dict)
    rim_provenance: dict[str, object] = Field(default_factory=dict)
    readiness: FitmentReadinessResponse
    input_readiness: FitmentReadinessResponse
    provider_readiness: FitmentProviderReadinessResponse
    next_action: FitmentNextActionResponse
    vehicle: FitmentVehicleResponse
    rim: FitmentRimResponse


class FitmentHistoryItemResponse(BaseModel):
    event_type: str
    actor_type: str
    actor_user_id: int | None = None
    vehicle_revision_before: int | None = None
    vehicle_revision_after: int | None = None
    rim_revision_before: int | None = None
    rim_revision_after: int | None = None
    changes: dict[str, object] = Field(default_factory=dict)
    created_at: datetime


class FitmentHistoryResponse(BaseModel):
    job_id: str
    events: list[FitmentHistoryItemResponse] = Field(default_factory=list)


class RimSourceResolveRequest(BaseModel):
    product_url: str = Field(min_length=1, max_length=2048)

    @field_validator("product_url")
    @classmethod
    def normalize_url(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("product_url must not be empty")
        return normalized


class RimSourceCandidateResponse(BaseModel):
    field: str
    value: str | int | float
    source: str
    confidence: float


class RimSourceConflictResponse(BaseModel):
    field: str
    candidates: list[RimSourceCandidateResponse]


class RimSourceResolveResponse(BaseModel):
    requested_url: str
    final_url: str
    values: dict[str, str | int | float]
    candidates: list[RimSourceCandidateResponse]
    conflicts: list[RimSourceConflictResponse]


class VehicleVariantResponse(BaseModel):
    generation: str
    modification: str
    body: str = ""
    market: str


class VehicleVariantsResponse(BaseModel):
    variants: list[VehicleVariantResponse]


class VehicleVariantApplyRequest(BaseModel):
    expected_vehicle_revision: int = Field(ge=1)
    generation: str
    modification: str
    body: str = ""
    market: str


class FeedbackAuthRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    init_data: str | None = None
    telegram_user_id: int | None = None


class FeedbackLegacyRequest(FeedbackAuthRequest):
    vote: str

    @field_validator("vote")
    @classmethod
    def validate_vote(cls, v: str) -> str:
        if v not in ("like", "dislike"):
            raise ValueError("vote must be 'like' or 'dislike'")
        return v


class FeedbackPutRequest(FeedbackAuthRequest):
    sentiment: str
    reason: str | None = None

    @field_validator("sentiment")
    @classmethod
    def validate_sentiment(cls, v: str) -> str:
        if v not in FEEDBACK_SENTIMENTS:
            raise ValueError("sentiment must be 'liked' or 'disliked'")
        return v

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if v not in FEEDBACK_REASONS:
            raise ValueError("reason must be an approved feedback code")
        return v

    @field_validator("reason")
    @classmethod
    def validate_reason_for_sentiment(cls, v: str | None, info) -> str | None:
        if info.data.get("sentiment") == "liked" and v is not None:
            raise ValueError("liked feedback does not accept a reason")
        return v


def _telegram_user_id_from_feedback_request(
    request: FeedbackAuthRequest,
    internal_token: str | None,
    authorization: str | None = None,
) -> int:
    if request.init_data:
        auth = resolve_telegram_auth(
            init_data=request.init_data,
            telegram_user_id=request.telegram_user_id,
            authorization=authorization,
            auth_name="feedback",
        )
        return auth.telegram_user_id

    if authorization:
        auth = resolve_telegram_auth(
            init_data=None,
            telegram_user_id=request.telegram_user_id,
            authorization=authorization,
            auth_name="feedback",
        )
        return auth.telegram_user_id

    if not API_INTERNAL_TOKEN:
        logger.error("API_INTERNAL_TOKEN не сконфигурирован: bot feedback отключён")
        raise HTTPException(status_code=503, detail="Feedback auth is not configured")
    if not internal_token or internal_token != API_INTERNAL_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid internal token")
    if request.telegram_user_id is None:
        raise HTTPException(status_code=400, detail="telegram_user_id required")
    return request.telegram_user_id


def _download_filename(job_id: str, content_type: str | None) -> str:
    ext = {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }.get((content_type or "").split(";")[0].strip().lower(), "jpg")
    return f"dream-wheels-{job_id}.{ext}"


def _has_auth_inputs(
    *,
    init_data: str | None,
    telegram_user_id: int | None,
    authorization: str | None,
) -> bool:
    return bool(init_data or authorization or telegram_user_id is not None)


def _resolve_jobs_auth(
    *,
    init_data: str | None,
    telegram_user_id: int | None,
    authorization: str | None,
    required: bool,
) -> AuthContext | None:
    if not required and not _has_auth_inputs(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
    ):
        return None
    return resolve_telegram_auth(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        auth_name="jobs history",
    )


def _asset_from_row(row, prefix: str, *, job_id: str) -> JobAssetResponse | None:
    asset_id = row[f"{prefix}_asset_id"]
    if not asset_id:
        return None
    kind = row[f"{prefix}_asset_kind"]
    bucket = row[f"{prefix}_asset_bucket"]
    storage_key = row[f"{prefix}_asset_storage_key"]
    is_result = kind == "result" and bucket == storage.RESULTS_BUCKET
    return JobAssetResponse(
        id=str(asset_id),
        kind=kind,
        content_type=row[f"{prefix}_asset_content_type"],
        size_bytes=row[f"{prefix}_asset_size_bytes"],
        width=row[f"{prefix}_asset_width"],
        height=row[f"{prefix}_asset_height"],
        created_at=row[f"{prefix}_asset_created_at"],
        url=storage.public_url(bucket, storage_key) if is_result else None,
        download_url=assets_service.asset_download_path(job_id, kind),
    )


def _assets_from_row(row, *, job_id: str) -> dict[str, JobAssetResponse]:
    assets: dict[str, JobAssetResponse] = {}
    for prefix in ("car", "rim", "result"):
        asset = _asset_from_row(row, prefix, job_id=job_id)
        if asset:
            assets[asset.kind] = asset
    return assets


def _feedback_select_clause(alias: str = "render_feedback") -> str:
    return f"""
        {alias}.sentiment AS feedback_sentiment,
        {alias}.reason AS feedback_reason,
        {alias}.created_at AS feedback_created_at,
        {alias}.updated_at AS feedback_updated_at
    """


def _job_feedback_join_clause(alias: str = "render_feedback") -> str:
    return f"""
        LEFT JOIN render_feedback AS {alias}
          ON {alias}.render_job_id = jobs.id
         AND {alias}.owner_user_id = jobs.user_id
    """


def _feedback_from_row(
    row,
    *,
    job_id: str,
    include_job_id: bool = False,
) -> JobFeedbackSummary | JobFeedbackRecord | None:
    if row["feedback_sentiment"] is None:
        return None

    payload = {
        "sentiment": row["feedback_sentiment"],
        "reason": row["feedback_reason"],
        "created_at": row["feedback_created_at"],
        "updated_at": row["feedback_updated_at"],
    }
    if include_job_id:
        return JobFeedbackRecord(render_job_id=job_id, **payload)
    return JobFeedbackSummary(**payload)


def _preserve_feedback_reason(payload: dict) -> dict:
    feedback = payload.get("feedback")
    if feedback is not None and "reason" not in feedback:
        feedback["reason"] = None
    return payload


def _snapshot_from_row(row, *, job_id: str) -> dict[str, object] | None:
    raw_snapshot = row["render_input_snapshot"]
    if raw_snapshot is None:
        return None
    if isinstance(raw_snapshot, dict):
        return raw_snapshot
    if isinstance(raw_snapshot, str):
        try:
            parsed_snapshot = json.loads(raw_snapshot)
        except json.JSONDecodeError:
            logger.warning(
                "⚠️ Invalid render_input_snapshot JSON for job_id=%s snapshot=%r",
                job_id,
                raw_snapshot[:200],
            )
            return None
        if isinstance(parsed_snapshot, dict):
            return parsed_snapshot
        logger.warning(
            "⚠️ Non-object render_input_snapshot for job_id=%s parsed_type=%s",
            job_id,
            type(parsed_snapshot).__name__,
        )
        return None
    logger.warning(
        "⚠️ Unsupported render_input_snapshot type for job_id=%s snapshot_type=%s",
        job_id,
        type(raw_snapshot).__name__,
    )
    return None


def _job_assets_select_clause() -> str:
    return """
        car_asset.id AS car_asset_id,
        car_asset.kind AS car_asset_kind,
        car_asset.bucket AS car_asset_bucket,
        car_asset.storage_key AS car_asset_storage_key,
        car_asset.content_type AS car_asset_content_type,
        car_asset.size_bytes AS car_asset_size_bytes,
        car_asset.width AS car_asset_width,
        car_asset.height AS car_asset_height,
        car_asset.created_at AS car_asset_created_at,
        rim_asset.id AS rim_asset_id,
        rim_asset.kind AS rim_asset_kind,
        rim_asset.bucket AS rim_asset_bucket,
        rim_asset.storage_key AS rim_asset_storage_key,
        rim_asset.content_type AS rim_asset_content_type,
        rim_asset.size_bytes AS rim_asset_size_bytes,
        rim_asset.width AS rim_asset_width,
        rim_asset.height AS rim_asset_height,
        rim_asset.created_at AS rim_asset_created_at,
        result_asset.id AS result_asset_id,
        result_asset.kind AS result_asset_kind,
        result_asset.bucket AS result_asset_bucket,
        result_asset.storage_key AS result_asset_storage_key,
        result_asset.content_type AS result_asset_content_type,
        result_asset.size_bytes AS result_asset_size_bytes,
        result_asset.width AS result_asset_width,
        result_asset.height AS result_asset_height,
        result_asset.created_at AS result_asset_created_at
    """


def _fitment_available_clause() -> str:
    return (
        "CASE "
        "WHEN jobs.status = 'completed' "
        "AND jobs.vehicle_identity_id IS NOT NULL "
        "AND jobs.rim_setup_id IS NOT NULL "
        "THEN true ELSE false END AS fitment_available"
    )


def _job_assets_join_clause() -> str:
    return """
        LEFT JOIN assets AS car_asset ON car_asset.id = jobs.car_asset_id
        LEFT JOIN assets AS rim_asset ON rim_asset.id = jobs.rim_asset_id
        LEFT JOIN assets AS result_asset ON result_asset.id = jobs.result_asset_id
    """


def _fitment_provenance_meta(*, source: str) -> dict[str, object]:
    return {
        "source": source,
        "confidence": 1.0,
        "is_user_confirmed": True,
    }


def _normalized_identity_source(source: str) -> str:
    return "vlm_visual" if source == "vlm" else source


def _merge_field_provenance(
    current: dict | None,
    payload: dict[str, object],
    *,
    source: str,
) -> dict[str, object]:
    merged = dict(current or {})
    for field_name, value in payload.items():
        if value is None:
            merged.pop(field_name, None)
            continue
        merged[field_name] = _fitment_provenance_meta(source=source)
    return merged


def _field_provenance_value(current: dict | None, field_name: str) -> dict[str, object]:
    raw = (current or {}).get(field_name)
    return raw if isinstance(raw, dict) else {}


def _json_object_field(
    raw: object,
    *,
    job_id: str,
    field_name: str,
) -> dict[str, object]:
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            logger.warning(
                "⚠️ Invalid %s JSON for job_id=%s raw=%r",
                field_name,
                job_id,
                raw[:200],
            )
            return {}
        if isinstance(parsed, dict):
            return parsed
        logger.warning(
            "⚠️ Non-object %s for job_id=%s parsed_type=%s",
            field_name,
            job_id,
            type(parsed).__name__,
        )
        return {}
    logger.warning(
        "⚠️ Unsupported %s type for job_id=%s raw_type=%s",
        field_name,
        job_id,
        type(raw).__name__,
    )
    return {}


def _is_user_confirmed_provenance(meta: dict[str, object] | None) -> bool:
    return bool((meta or {}).get("is_user_confirmed"))


def _rim_decimal(value: float | None) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value))


def _fitment_values_equal(current: object, incoming: object) -> bool:
    if current is None or incoming is None:
        return current is None and incoming is None
    if isinstance(current, Decimal | int | float) or isinstance(incoming, Decimal | int | float):
        try:
            return Decimal(str(current)) == Decimal(str(incoming))
        except Exception:
            return current == incoming
    return current == incoming


def _changed_payload(
    row,
    payload: dict[str, object],
    row_keys: dict[str, str],
) -> dict[str, object]:
    changed: dict[str, object] = {}
    for field_name, value in payload.items():
        row_key = row_keys.get(field_name)
        if row_key and not _fitment_values_equal(row[row_key], value):
            changed[field_name] = value
    return changed


def _confirmation_payload(
    row,
    payload: dict[str, object],
    row_keys: dict[str, str],
    current_provenance: dict | None,
) -> dict[str, object]:
    confirmed: dict[str, object] = {}
    for field_name, value in payload.items():
        row_key = row_keys.get(field_name)
        if row_key is None or value is None:
            continue
        if not _fitment_values_equal(row[row_key], value):
            continue
        if row[row_key] is None:
            continue
        if _is_user_confirmed_provenance(_field_provenance_value(current_provenance, field_name)):
            continue
        confirmed[field_name] = value
    return confirmed


def _jsonable_fitment_value(value: object) -> object:
    if isinstance(value, Decimal):
        numeric = float(value)
        return int(numeric) if numeric.is_integer() else numeric
    return value


def _build_fitment_changes(
    *,
    section: str,
    before_values: dict[str, object],
    after_values: dict[str, object],
    before_provenance: dict | None,
    after_provenance: dict | None,
) -> dict[str, object]:
    changes: dict[str, object] = {}
    for field_name, new_value in after_values.items():
        old_value = before_values.get(field_name)
        old_meta = _field_provenance_value(before_provenance, field_name)
        new_meta = _field_provenance_value(after_provenance, field_name)
        if _fitment_values_equal(old_value, new_value) and old_meta == new_meta:
            continue
        changes.setdefault(section, {})[field_name] = {
            "old": _jsonable_fitment_value(old_value),
            "new": _jsonable_fitment_value(new_value),
            "old_provenance": old_meta,
            "new_provenance": new_meta,
        }
    return changes


async def _insert_fitment_change_event(
    conn,
    *,
    job_id: str,
    vehicle_identity_id: str | None,
    rim_spec_id: str | None,
    event_type: str,
    actor_type: str,
    actor_user_id: int | None,
    vehicle_revision_before: int | None,
    vehicle_revision_after: int | None,
    rim_revision_before: int | None,
    rim_revision_after: int | None,
    changes: dict[str, object],
) -> None:
    await conn.execute(
        """
        INSERT INTO fitment_change_events (
            job_id,
            vehicle_identity_id,
            rim_spec_id,
            event_type,
            actor_type,
            actor_user_id,
            vehicle_revision_before,
            vehicle_revision_after,
            rim_revision_before,
            rim_revision_after,
            changes
        )
        VALUES (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11::jsonb
        )
        """,
        job_id,
        vehicle_identity_id,
        rim_spec_id,
        event_type,
        actor_type,
        actor_user_id,
        vehicle_revision_before,
        vehicle_revision_after,
        rim_revision_before,
        rim_revision_after,
        json.dumps(changes),
    )


def _parse_update_count(result: str) -> int:
    try:
        return int(result.rsplit(" ", 1)[1])
    except (IndexError, ValueError):
        return 0


def _fitment_readiness_from_row(row) -> FitmentReadinessResponse:
    required_fields = {
        "vehicle.make": row["vehicle_make"],
        "vehicle.model": row["vehicle_model"],
        "vehicle.year": row["vehicle_year"],
        "rim.bolt_count": row["rim_bolt_count"],
        "rim.pcd_mm": row["rim_pcd_mm"],
        "rim.center_bore_mm": row["rim_center_bore_mm"],
        "rim.wheel_diameter_in": row["rim_wheel_diameter_in"],
        "rim.wheel_width_j": row["rim_wheel_width_j"],
        "rim.offset_et_mm": row["rim_offset_et_mm"],
    }
    missing = [field for field, value in required_fields.items() if value is None or value == ""]
    provenance_map = {
        "vehicle.make": _field_provenance_value(row["vehicle_field_provenance"], "make"),
        "vehicle.model": _field_provenance_value(row["vehicle_field_provenance"], "model"),
        "vehicle.year": _field_provenance_value(row["vehicle_field_provenance"], "year"),
        "rim.bolt_count": _field_provenance_value(row["rim_field_provenance"], "bolt_count"),
        "rim.pcd_mm": _field_provenance_value(row["rim_field_provenance"], "pcd_mm"),
        "rim.center_bore_mm": _field_provenance_value(
            row["rim_field_provenance"],
            "center_bore_mm",
        ),
        "rim.wheel_diameter_in": _field_provenance_value(
            row["rim_field_provenance"],
            "wheel_diameter_in",
        ),
        "rim.wheel_width_j": _field_provenance_value(
            row["rim_field_provenance"],
            "wheel_width_j",
        ),
        "rim.offset_et_mm": _field_provenance_value(
            row["rim_field_provenance"],
            "offset_et_mm",
        ),
    }
    unconfirmed = [
        field
        for field, value in required_fields.items()
        if value is not None
        and value != ""
        and not _is_user_confirmed_provenance(provenance_map[field])
    ]
    return FitmentReadinessResponse(
        ready=not missing,
        missing_fields=missing,
        blocking_fields=missing,
        unconfirmed_fields=unconfirmed,
    )


def _provider_readiness_from_row(row) -> FitmentProviderReadinessResponse:
    mapping = row.get("vehicle_provider_mappings") or {}
    wheel_size = mapping.get("wheel_size") if isinstance(mapping, dict) else None
    required = {"make_slug", "model_slug", "region", "generation_slug", "modification_slug"}
    if not isinstance(wheel_size, dict) or not required.issubset(wheel_size):
        return FitmentProviderReadinessResponse(
            status="variant_required",
            blocking_issues=[{"code": "vehicle_variant_required"}],
        )
    return FitmentProviderReadinessResponse(status="ready")


def _fitment_next_action_from_row(row) -> FitmentNextActionResponse:
    """Keep the Standard Check progression authoritative on the server."""
    readiness = _fitment_readiness_from_row(row)
    vehicle_missing = [field for field in readiness.missing_fields if field.startswith("vehicle.")]
    if vehicle_missing:
        return FitmentNextActionResponse(kind="complete_vehicle_details")
    rim_missing = [field for field in readiness.missing_fields if field.startswith("rim.")]
    if rim_missing:
        return FitmentNextActionResponse(kind="complete_rim_specs")
    if _provider_readiness_from_row(row).status != "ready":
        return FitmentNextActionResponse(kind="select_vehicle_variant")
    return FitmentNextActionResponse(kind="run_standard_check")


def _fitment_overview_from_row(row) -> FitmentOverviewResponse:
    pcd_display = None
    if row["rim_bolt_count"] is not None and row["rim_pcd_mm"] is not None:
        pcd_display = identity_service.pcd_display_value(
            bolt_count=int(row["rim_bolt_count"]),
            pcd_mm=row["rim_pcd_mm"],
        )
    vehicle_title = identity_service.vehicle_fitment_summary(
        {
            "make": row["vehicle_make"],
            "model": row["vehicle_model"],
            "year": row["vehicle_year"],
            "generation": row["vehicle_generation"],
        }
    )
    rim_title = identity_service.rim_fitment_summary(
        {
            "wheel_diameter_in": row["rim_wheel_diameter_in"],
            "wheel_width_j": row["rim_wheel_width_j"],
            "bolt_count": row["rim_bolt_count"],
            "pcd_mm": row["rim_pcd_mm"],
        }
    )
    return FitmentOverviewResponse(
        job_id=row["job_id"],
        vehicle_identity_id=row["vehicle_identity_id"],
        rim_setup_id=row["rim_setup_id"],
        status=row["status"],
        result_url=row["output_image_url"],
        completed_at=row["completed_at"],
        fitment_available=bool(row["fitment_available"]),
        is_staggered=bool(row["is_staggered"]),
        vehicle_revision=int(row["vehicle_revision"]),
        rim_revision=int(row["rim_revision"]),
        vehicle_candidates=row["vehicle_field_candidates"] or {},
        rim_candidates=row["rim_field_candidates"] or {},
        vehicle_provenance=row["vehicle_field_provenance"] or {},
        rim_provenance=row["rim_field_provenance"] or {},
        readiness=_fitment_readiness_from_row(row),
        input_readiness=_fitment_readiness_from_row(row),
        provider_readiness=_provider_readiness_from_row(row),
        next_action=_fitment_next_action_from_row(row),
        vehicle=FitmentVehicleResponse(
            make=row["vehicle_make"],
            model=row["vehicle_model"],
            year=row["vehicle_year"],
            body=row["vehicle_body"],
            generation=row["vehicle_generation"],
            modification=row["vehicle_modification"],
            market=row["vehicle_market"],
            is_user_confirmed=bool(row["vehicle_is_user_confirmed"]),
            title=vehicle_title,
        ),
        rim=FitmentRimResponse(
            brand=row["rim_brand"],
            model=row["rim_model"],
            sku=row["rim_sku"],
            product_url=row["rim_product_url"],
            bolt_count=row["rim_bolt_count"],
            pcd_mm=float(row["rim_pcd_mm"]) if row["rim_pcd_mm"] is not None else None,
            pcd_display=pcd_display,
            center_bore_mm=float(row["rim_center_bore_mm"])
            if row["rim_center_bore_mm"] is not None
            else None,
            wheel_diameter_in=float(row["rim_wheel_diameter_in"])
            if row["rim_wheel_diameter_in"] is not None
            else None,
            wheel_width_j=float(row["rim_wheel_width_j"])
            if row["rim_wheel_width_j"] is not None
            else None,
            offset_et_mm=float(row["rim_offset_et_mm"])
            if row["rim_offset_et_mm"] is not None
            else None,
            has_product_url=bool(row["rim_product_url"]),
            title=rim_title,
        ),
    )


async def _fetch_fitment_job_row(
    conn,
    *,
    job_id: str,
    user_id: int,
):
    row = await conn.fetchrow(
        f"""
        SELECT
            jobs.id::text AS job_id,
            jobs.status,
            jobs.completed_at,
            jobs.output_image_url,
            jobs.render_input_snapshot,
            {_fitment_available_clause()},
            jobs.vehicle_identity_id::text AS vehicle_identity_id,
            jobs.rim_setup_id::text AS rim_setup_id,
            vehicle.owner_user_id AS owner_user_id,
            vehicle.make AS vehicle_make,
            vehicle.model AS vehicle_model,
            vehicle.year AS vehicle_year,
            vehicle.body AS vehicle_body,
            vehicle.generation AS vehicle_generation,
            vehicle.modification AS vehicle_modification,
            vehicle.market AS vehicle_market,
            vehicle.is_user_confirmed AS vehicle_is_user_confirmed,
            vehicle.provider_mappings AS vehicle_provider_mappings,
            vehicle.provider_mapping_revision AS vehicle_provider_mapping_revision,
            vehicle.field_provenance AS vehicle_field_provenance,
            vehicle.field_candidates AS vehicle_field_candidates,
            vehicle.revision AS vehicle_revision,
            rim_setup.front_rim_spec_id::text AS front_rim_spec_id,
            rim_setup.rear_rim_spec_id::text AS rear_rim_spec_id,
            rim_setup.is_staggered,
            rim.owner_user_id AS rim_owner_user_id,
            rim.brand AS rim_brand,
            rim.model AS rim_model,
            rim.sku AS rim_sku,
            rim.product_url AS rim_product_url,
            rim.bolt_count AS rim_bolt_count,
            rim.pcd_mm AS rim_pcd_mm,
            rim.center_bore_mm AS rim_center_bore_mm,
            rim.wheel_diameter_in AS rim_wheel_diameter_in,
            rim.wheel_width_j AS rim_wheel_width_j,
            rim.offset_et_mm AS rim_offset_et_mm,
            rim.field_provenance AS rim_field_provenance,
            rim.field_candidates AS rim_field_candidates,
            rim.revision AS rim_revision
        FROM jobs
        LEFT JOIN vehicle_identities AS vehicle
          ON vehicle.id = jobs.vehicle_identity_id
        LEFT JOIN rim_setups AS rim_setup
          ON rim_setup.id = jobs.rim_setup_id
        LEFT JOIN rim_specs AS rim
          ON rim.id = rim_setup.front_rim_spec_id
        WHERE jobs.id = $1::uuid
          AND jobs.user_id = $2
        """,
        job_id,
        user_id,
    )
    if not row:
        return None
    normalized_row = dict(row)
    normalized_job_id = str(normalized_row["job_id"])
    for field_name in (
        "vehicle_field_provenance",
        "vehicle_field_candidates",
        "vehicle_provider_mappings",
        "rim_field_provenance",
        "rim_field_candidates",
    ):
        normalized_row[field_name] = _json_object_field(
            normalized_row.get(field_name),
            job_id=normalized_job_id,
            field_name=field_name,
        )
    return normalized_row


async def _fetch_fitment_history_rows(
    conn,
    *,
    job_id: str,
    user_id: int,
):
    return await conn.fetch(
        """
        SELECT
            evt.event_type,
            evt.actor_type,
            evt.actor_user_id,
            evt.vehicle_revision_before,
            evt.vehicle_revision_after,
            evt.rim_revision_before,
            evt.rim_revision_after,
            evt.changes,
            evt.created_at
        FROM fitment_change_events AS evt
        JOIN jobs
          ON jobs.id = evt.job_id
        WHERE evt.job_id = $1::uuid
          AND jobs.user_id = $2
        ORDER BY evt.created_at DESC, evt.id DESC
        """,
        job_id,
        user_id,
    )


def _sentiment_from_vote(vote: str) -> str:
    return {"like": "liked", "dislike": "disliked"}[vote]


async def _require_feedback_job_access(conn, *, job_id: str, user_id: int) -> dict:
    job = await conn.fetchrow(
        """
        SELECT user_id, status
        FROM jobs
        WHERE id = $1::uuid
        """,
        job_id,
    )
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Job does not belong to current user")
    if job["status"] != "completed":
        raise HTTPException(status_code=409, detail="Feedback is available only for completed jobs")
    return dict(job)


async def _upsert_feedback(
    conn,
    *,
    job_id: str,
    user_id: int,
    sentiment: str,
    reason: str | None,
) -> JobFeedbackRecord:
    row = await conn.fetchrow(
        """
        INSERT INTO render_feedback (
            render_job_id,
            owner_user_id,
            sentiment,
            reason
        )
        VALUES ($1::uuid, $2, $3, $4)
        ON CONFLICT (owner_user_id, render_job_id) DO UPDATE
        SET sentiment = EXCLUDED.sentiment,
            reason = EXCLUDED.reason,
            updated_at = CURRENT_TIMESTAMP
        RETURNING
            render_job_id::text AS render_job_id,
            sentiment AS feedback_sentiment,
            reason AS feedback_reason,
            created_at AS feedback_created_at,
            updated_at AS feedback_updated_at
        """,
        job_id,
        user_id,
        sentiment,
        reason,
    )
    assert row is not None
    feedback = _feedback_from_row(row, job_id=row["render_job_id"], include_job_id=True)
    assert isinstance(feedback, JobFeedbackRecord)
    return feedback


async def _compensate_queue_publish_failure(
    *,
    pool,
    user_id: int,
    job_id: str,
    error_message: str,
) -> None:
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                await refund_job_credit(conn, user_id=user_id, job_id=job_id)
                await conn.execute(
                    "UPDATE jobs SET status = 'failed', error_code = $1, error_message = $2, "
                    "updated_at = CURRENT_TIMESTAMP WHERE id = $3::uuid",
                    "QUEUE_PUBLISH_FAILED",
                    error_message,
                    job_id,
                )
    except Exception as exc:
        logger.exception(
            "❌ Queue publish compensation failed for job_id=%s user_id=%s: %s",
            job_id,
            user_id,
            exc,
        )


@router.post("", response_model=JobCreateResponse)
async def create_job(request: JobCreateRequest):
    """Создание задачи из бота — приходят Telegram file URL'ы."""
    rds = _get_render_queue_client("/jobs", request.telegram_user_id)
    await enforce_rate_limit(
        scope="jobs",
        identifier=request.telegram_user_id,
        limit=JOBS_RATE_LIMIT,
        window_sec=JOBS_RATE_WINDOW_SEC,
    )

    logger.info(
        f"📥 Получен запрос на создание задачи. Авто: {request.car_url}, Диск: {request.wheel_url}"
    )
    job_id = str(uuid.uuid4())
    pool = db.get_pool()

    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                user_id = await ensure_user(conn, request.telegram_user_id, request.username)
                await conn.execute(
                    """
                    INSERT INTO jobs (id, user_id, status, car_image_url, wheel_image_url)
                    VALUES ($1::uuid, $2, 'queued', $3, $4)
                    """,
                    job_id,
                    user_id,
                    request.car_url,
                    request.wheel_url,
                )
                await reserve_job_credit(conn, user_id=user_id, job_id=job_id)
            logger.info(f"✅ Задача {job_id} успешно записана в БД со статусом queued")
    except InsufficientCreditsError as exc:
        logger.warning(
            f"❌ Недостаточно credits для telegram_user_id={request.telegram_user_id}: {exc}"
        )
        raise HTTPException(status_code=402, detail="Insufficient credits") from exc

    except Exception as db_err:
        logger.exception(
            f"❌ ОШИБКА ЗАПИСИ В БД (INSERT) для "
            f"telegram_user_id={request.telegram_user_id}: {db_err}"
        )
        raise HTTPException(status_code=500, detail="Database insert failed") from db_err

    try:
        await rds.rpush(
            redis_client.key(REDIS_JOB_QUEUE),
            json.dumps(
                {
                    "job_id": job_id,
                    "user_id": user_id,
                    "telegram_user_id": request.telegram_user_id,
                    "car_url": request.car_url,
                    "wheel_url": request.wheel_url,
                }
            ),
        )
    except Exception as queue_err:
        logger.exception(
            "❌ Queue publish failed for job_id=%s user_id=%s telegram_user_id=%s: %s",
            job_id,
            user_id,
            request.telegram_user_id,
            queue_err,
        )
        await _compensate_queue_publish_failure(
            pool=pool,
            user_id=user_id,
            job_id=job_id,
            error_message="Queue publish failed",
        )
        raise HTTPException(
            status_code=503, detail="Job queue is temporarily unavailable"
        ) from queue_err
    return JobCreateResponse(job_id=job_id, status="queued")


@router.post("/upload", response_model=JobCreateResponse)
async def upload_job(
    car_image: Annotated[UploadFile, File()],
    wheel_image: Annotated[UploadFile, File()],
    idempotency_key: Annotated[str, Form()],
    init_data: Annotated[str, Form()] = "",
    telegram_user_id: Annotated[int | None, Form()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    """Создание задачи из webapp — приходят бинарники car/wheel + Telegram initData.

    Flow:
    1. Валидируем initData (HMAC) → достаём telegram_user_id.
    2. Rate limit (10/час на юзера).
    3. Идемпотентность: если ключ уже видели — возвращаем тот же job_id.
    4. Льём оба файла в Storage `raw`.
    5. Создаём job в БД, кидаем в Redis-очередь воркеру.
    """
    auth = resolve_telegram_auth(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        auth_name="jobs upload",
    )

    rds = _get_render_queue_client("/jobs/upload", auth.telegram_user_id)
    await enforce_rate_limit(
        scope="jobs_upload",
        identifier=auth.telegram_user_id,
        limit=UPLOAD_RATE_LIMIT,
        window_sec=UPLOAD_RATE_WINDOW_SEC,
    )

    for upload, label in ((car_image, "car"), (wheel_image, "wheel")):
        if upload.content_type not in ALLOWED_UPLOAD_MIME:
            raise HTTPException(
                status_code=415,
                detail=f"{label}: неподдерживаемый MIME {upload.content_type}",
            )

    car_bytes = await car_image.read()
    wheel_bytes = await wheel_image.read()
    for data, label in ((car_bytes, "car"), (wheel_bytes, "wheel")):
        if len(data) > MAX_RAW_FILE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"{label}: файл больше {MAX_RAW_FILE_BYTES // 1024 // 1024} MB",
            )
        if len(data) == 0:
            raise HTTPException(status_code=400, detail=f"{label}: пустой файл")

    idem_redis_key = redis_client.key(f"idem:jobs_upload:{auth.telegram_user_id}:{idempotency_key}")
    job_id = str(uuid.uuid4())
    reserved = await rds.set(idem_redis_key, job_id, ex=IDEMPOTENCY_TTL_SEC, nx=True)
    if not reserved:
        existing_job_id = await rds.get(idem_redis_key)
        if not existing_job_id:
            raise HTTPException(status_code=409, detail="Upload retry in progress")
        logger.info(
            f"♻️  Idempotent replay: tg_user={auth.telegram_user_id} "
            f"key={idempotency_key} → job={existing_job_id}"
        )
        return JobCreateResponse(job_id=existing_job_id, status="queued")

    logger.info(
        f"📥 /jobs/upload tg_user={auth.telegram_user_id} job={job_id} "
        f"car={len(car_bytes)}B wheel={len(wheel_bytes)}B"
    )

    pool = db.get_pool()
    async with pool.acquire() as conn:
        user_id = await ensure_user(conn, auth.telegram_user_id, auth.username)

    uploaded_assets: list[assets_service.AssetUpload] = []
    try:
        car_asset = await assets_service.upload_render_asset(
            owner_user_id=user_id,
            job_id=job_id,
            kind="car_original",
            data=car_bytes,
            content_type=car_image.content_type or "application/octet-stream",
        )
        uploaded_assets.append(car_asset)
        rim_asset = await assets_service.upload_render_asset(
            owner_user_id=user_id,
            job_id=job_id,
            kind="rim_original",
            data=wheel_bytes,
            content_type=wheel_image.content_type or "application/octet-stream",
        )
        uploaded_assets.append(rim_asset)
    except storage.StorageError as exc:
        await rds.delete(idem_redis_key)
        for uploaded_asset in uploaded_assets:
            try:
                await assets_service.delete_uploaded_asset(uploaded_asset)
            except storage.StorageError as cleanup_exc:
                logger.exception(
                    "❌ Storage cleanup failed для job_id=%s asset_id=%s: %s",
                    job_id,
                    uploaded_asset.id,
                    cleanup_exc,
                )
        logger.exception(f"❌ Storage upload failed для job_id={job_id}: {exc}")
        raise HTTPException(status_code=502, detail="Storage upload failed") from exc

    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    """
                    INSERT INTO jobs (
                        id, user_id, status, car_image_url, wheel_image_url
                    )
                    VALUES ($1::uuid, $2, 'queued', $3, $4)
                    """,
                    job_id,
                    user_id,
                    car_asset.storage_key,
                    rim_asset.storage_key,
                )
                await assets_service.insert_asset(conn, car_asset)
                await assets_service.insert_asset(conn, rim_asset)
                await conn.execute(
                    """
                    UPDATE jobs
                    SET car_asset_id = $1::uuid,
                        rim_asset_id = $2::uuid,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $3::uuid
                    """,
                    car_asset.id,
                    rim_asset.id,
                    job_id,
                )
                await reserve_job_credit(conn, user_id=user_id, job_id=job_id)
        logger.info(f"✅ Job {job_id} создан в БД (queued)")
    except InsufficientCreditsError as exc:
        await rds.delete(idem_redis_key)
        for uploaded_asset in uploaded_assets:
            try:
                await assets_service.delete_uploaded_asset(uploaded_asset)
            except storage.StorageError as cleanup_exc:
                logger.exception(
                    "❌ Storage cleanup failed для job_id=%s asset_id=%s: %s",
                    job_id,
                    uploaded_asset.id,
                    cleanup_exc,
                )
        logger.warning(f"❌ Недостаточно credits для tg_user={auth.telegram_user_id}: {exc}")
        raise HTTPException(status_code=402, detail="Insufficient credits") from exc
    except Exception as db_err:
        await rds.delete(idem_redis_key)
        for uploaded_asset in uploaded_assets:
            try:
                await assets_service.delete_uploaded_asset(uploaded_asset)
            except storage.StorageError as cleanup_exc:
                logger.exception(
                    "❌ Storage cleanup failed для job_id=%s asset_id=%s: %s",
                    job_id,
                    uploaded_asset.id,
                    cleanup_exc,
                )
        logger.exception(f"❌ DB INSERT failed для job_id={job_id}: {db_err}")
        raise HTTPException(status_code=500, detail="Database insert failed") from db_err

    try:
        await rds.rpush(
            redis_client.key(REDIS_JOB_QUEUE),
            json.dumps(
                {
                    "job_id": job_id,
                    "user_id": user_id,
                    "telegram_user_id": auth.telegram_user_id,
                    "source": "webapp",
                    "car_storage_path": car_asset.storage_key,
                    "wheel_storage_path": rim_asset.storage_key,
                    "car_asset_id": car_asset.id,
                    "rim_asset_id": rim_asset.id,
                }
            ),
        )
    except Exception as queue_err:
        logger.exception(
            "❌ Queue publish failed for job_id=%s user_id=%s telegram_user_id=%s: %s",
            job_id,
            user_id,
            auth.telegram_user_id,
            queue_err,
        )
        await _compensate_queue_publish_failure(
            pool=pool,
            user_id=user_id,
            job_id=job_id,
            error_message="Queue publish failed",
        )
        await rds.delete(idem_redis_key)
        raise HTTPException(
            status_code=503, detail="Job queue is temporarily unavailable"
        ) from queue_err

    return JobCreateResponse(job_id=job_id, status="queued")


@router.post("/from-assets", response_model=JobCreateResponse)
async def create_job_from_assets(
    request: JobFromAssetsRequest,
    authorization: Annotated[str | None, Header()] = None,
):
    """Create a render job from confirmed Sprint 2 identity draft assets."""
    auth = resolve_telegram_auth(
        init_data=request.init_data or "",
        telegram_user_id=request.telegram_user_id,
        authorization=authorization,
        auth_name="jobs from assets",
    )

    rds = _get_render_queue_client("/jobs/from-assets", auth.telegram_user_id)
    await enforce_rate_limit(
        scope="jobs_upload",
        identifier=auth.telegram_user_id,
        limit=UPLOAD_RATE_LIMIT,
        window_sec=UPLOAD_RATE_WINDOW_SEC,
    )

    idem_redis_key = redis_client.key(
        f"idem:jobs_from_assets:{auth.telegram_user_id}:{request.idempotency_key}"
    )
    job_id = str(uuid.uuid4())
    reserved = await rds.set(idem_redis_key, job_id, ex=IDEMPOTENCY_TTL_SEC, nx=True)
    if not reserved:
        existing_job_id = await rds.get(idem_redis_key)
        if not existing_job_id:
            raise HTTPException(status_code=409, detail="Create retry in progress")
        logger.info(
            "♻️  Idempotent replay: tg_user=%s key=%s → job=%s",
            auth.telegram_user_id,
            request.idempotency_key,
            existing_job_id,
        )
        return JobCreateResponse(job_id=existing_job_id, status="queued")

    pool = db.get_pool()
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                user_id = await ensure_user(conn, auth.telegram_user_id, auth.username)
                draft = await conn.fetchrow(
                    """
                    SELECT
                        draft.id::text AS draft_id,
                        draft.car_asset_id::text AS car_asset_id,
                        draft.rim_asset_id::text AS rim_asset_id,
                        draft.identity_proposal AS identity_proposal,
                        car_asset.storage_key AS car_storage_key,
                        rim_asset.storage_key AS rim_storage_key
                    FROM render_input_drafts AS draft
                    JOIN assets AS car_asset
                      ON car_asset.id = draft.car_asset_id
                     AND car_asset.owner_user_id = draft.owner_user_id
                    JOIN assets AS rim_asset
                      ON rim_asset.id = draft.rim_asset_id
                     AND rim_asset.owner_user_id = draft.owner_user_id
                    WHERE draft.id = $1::uuid
                      AND draft.owner_user_id = $2
                      AND draft.status = 'resolved'
                      AND draft.expires_at > CURRENT_TIMESTAMP
                    FOR UPDATE OF draft
                    """,
                    request.draft_id,
                    user_id,
                )
                if not draft:
                    raise HTTPException(status_code=404, detail="Identity draft not found")

                proposal = identity_service.parse_identity_proposal(draft["identity_proposal"])
                vehicle_candidates, rim_candidates = (
                    identity_service.field_candidates_from_identity_proposal(proposal)
                )
                canonical_vehicle = identity_service.prefill_vehicle_from_proposal(
                    request.vehicle,
                    proposal,
                )
                canonical_rim = identity_service.prefill_rim_from_proposal(request.rim, proposal)
                if proposal is not None:
                    proposal.rim = proposal.rim.model_copy(
                        update={"product_url": canonical_rim.product_url}
                    )
                vehicle_identity_id = await identity_service.insert_vehicle_identity(
                    conn,
                    owner_user_id=user_id,
                    vehicle=canonical_vehicle,
                    field_candidates=vehicle_candidates,
                )
                rim_spec_id = await identity_service.insert_rim_spec(
                    conn,
                    owner_user_id=user_id,
                    rim=canonical_rim,
                    is_user_confirmed=request.rim_user_confirmed,
                    field_candidates=rim_candidates,
                )
                rim_setup_id = await identity_service.insert_rim_setup(
                    conn,
                    owner_user_id=user_id,
                    rim_spec_id=rim_spec_id,
                )
                snapshot = identity_service.render_input_snapshot(
                    vehicle_identity_id=vehicle_identity_id,
                    rim_setup_id=rim_setup_id,
                    vehicle=request.vehicle,
                    rim=request.rim,
                    rim_user_confirmed=request.rim_user_confirmed,
                    car_asset_id=draft["car_asset_id"],
                    rim_asset_id=draft["rim_asset_id"],
                )

                await conn.execute(
                    """
                    INSERT INTO jobs (
                        id, user_id, status, car_image_url, wheel_image_url,
                        car_asset_id, rim_asset_id, vehicle_identity_id,
                        rim_setup_id, render_input_snapshot
                    )
                    VALUES (
                        $1::uuid, $2, 'queued', $3, $4,
                        $5::uuid, $6::uuid, $7::uuid, $8::uuid, $9::jsonb
                    )
                    """,
                    job_id,
                    user_id,
                    draft["car_storage_key"],
                    draft["rim_storage_key"],
                    draft["car_asset_id"],
                    draft["rim_asset_id"],
                    vehicle_identity_id,
                    rim_setup_id,
                    json.dumps(snapshot),
                )
                initial_vehicle_confirmed = identity_service.is_user_source(
                    canonical_vehicle.source
                )
                initial_vehicle_meta = {
                    "source": _normalized_identity_source(canonical_vehicle.source),
                    "confidence": canonical_vehicle.confidence,
                    "is_user_confirmed": initial_vehicle_confirmed,
                }
                initial_vehicle_provenance = {
                    field_name: initial_vehicle_meta
                    for field_name in ("make", "model", "year", "year_start", "year_end")
                    if getattr(canonical_vehicle, field_name, None) is not None
                }
                initial_rim_provenance = {
                    field_name: {
                        "source": "user_confirmed"
                        if request.rim_user_confirmed
                        else _normalized_identity_source(canonical_rim.source),
                        "confidence": canonical_rim.confidence,
                        "is_user_confirmed": request.rim_user_confirmed,
                    }
                    for field_name in (
                        "brand",
                        "model",
                        "sku",
                        "product_url",
                        "wheel_diameter_in",
                        "wheel_width_j",
                        "bolt_count",
                        "pcd_mm",
                        "center_bore_mm",
                        "offset_et_mm",
                    )
                    if getattr(canonical_rim, field_name) is not None
                }
                initial_changes: dict[str, object] = {}
                initial_changes.update(
                    _build_fitment_changes(
                        section="vehicle",
                        before_values={},
                        after_values={
                            "make": canonical_vehicle.make,
                            "model": canonical_vehicle.model,
                            "year": canonical_vehicle.year,
                            "year_start": canonical_vehicle.year_start,
                            "year_end": canonical_vehicle.year_end,
                        },
                        before_provenance={},
                        after_provenance=initial_vehicle_provenance,
                    )
                )
                initial_changes.update(
                    _build_fitment_changes(
                        section="rim",
                        before_values={},
                        after_values={
                            "brand": canonical_rim.brand,
                            "model": canonical_rim.model,
                            "sku": canonical_rim.sku,
                            "product_url": canonical_rim.product_url,
                            "wheel_diameter_in": canonical_rim.wheel_diameter_in,
                            "wheel_width_j": canonical_rim.wheel_width_j,
                            "bolt_count": canonical_rim.bolt_count,
                            "pcd_mm": canonical_rim.pcd_mm,
                            "center_bore_mm": canonical_rim.center_bore_mm,
                            "offset_et_mm": canonical_rim.offset_et_mm,
                        },
                        before_provenance={},
                        after_provenance=initial_rim_provenance,
                    )
                )
                await _insert_fitment_change_event(
                    conn,
                    job_id=job_id,
                    vehicle_identity_id=vehicle_identity_id,
                    rim_spec_id=rim_spec_id,
                    event_type="initial_prefill",
                    actor_type="system",
                    actor_user_id=None,
                    vehicle_revision_before=None,
                    vehicle_revision_after=1,
                    rim_revision_before=None,
                    rim_revision_after=1,
                    changes=initial_changes,
                )
                await conn.execute(
                    """
                    UPDATE assets
                    SET job_id = $1::uuid
                    WHERE id IN ($2::uuid, $3::uuid)
                      AND owner_user_id = $4
                    """,
                    job_id,
                    draft["car_asset_id"],
                    draft["rim_asset_id"],
                    user_id,
                )
                if proposal is not None:
                    await conn.execute(
                        """
                        UPDATE render_input_drafts
                        SET identity_proposal = $1::jsonb,
                            status = 'consumed',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = $2::uuid
                          AND owner_user_id = $3
                        """,
                        proposal.model_dump_json(),
                        request.draft_id,
                        user_id,
                    )
                else:
                    await conn.execute(
                        """
                        UPDATE render_input_drafts
                        SET status = 'consumed',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = $1::uuid
                          AND owner_user_id = $2
                        """,
                        request.draft_id,
                        user_id,
                    )
                await reserve_job_credit(conn, user_id=user_id, job_id=job_id)
    except InsufficientCreditsError as exc:
        await rds.delete(idem_redis_key)
        logger.warning("❌ Недостаточно credits для tg_user=%s: %s", auth.telegram_user_id, exc)
        raise HTTPException(status_code=402, detail="Insufficient credits") from exc
    except HTTPException:
        await rds.delete(idem_redis_key)
        raise
    except Exception as db_err:
        await rds.delete(idem_redis_key)
        logger.exception("❌ DB INSERT failed для Sprint 2 job_id=%s: %s", job_id, db_err)
        raise HTTPException(status_code=500, detail="Database insert failed") from db_err

    try:
        await rds.rpush(
            redis_client.key(REDIS_JOB_QUEUE),
            json.dumps(
                {
                    "job_id": job_id,
                    "user_id": user_id,
                    "telegram_user_id": auth.telegram_user_id,
                    "source": "webapp",
                    "car_storage_path": draft["car_storage_key"],
                    "wheel_storage_path": draft["rim_storage_key"],
                    "car_asset_id": draft["car_asset_id"],
                    "rim_asset_id": draft["rim_asset_id"],
                    "vehicle_identity_id": vehicle_identity_id,
                    "rim_setup_id": rim_setup_id,
                }
            ),
        )
    except Exception as queue_err:
        logger.exception(
            "❌ Queue publish failed for job_id=%s user_id=%s telegram_user_id=%s: %s",
            job_id,
            user_id,
            auth.telegram_user_id,
            queue_err,
        )
        await _compensate_queue_publish_failure(
            pool=pool,
            user_id=user_id,
            job_id=job_id,
            error_message="Queue publish failed",
        )
        await rds.delete(idem_redis_key)
        raise HTTPException(
            status_code=503, detail="Job queue is temporarily unavailable"
        ) from queue_err

    logger.info("✅ Sprint 2 job %s создан из draft_id=%s", job_id, request.draft_id)
    return JobCreateResponse(job_id=job_id, status="queued")


@router.get("", response_model=JobHistoryResponse)
async def list_jobs(
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    """История последних jobs текущего авторизованного пользователя."""
    auth = _resolve_jobs_auth(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        required=True,
    )
    assert auth is not None

    pool = db.get_pool()
    async with pool.acquire() as conn:
        user_id = await ensure_user(conn, auth.telegram_user_id, auth.username)
        rows = await conn.fetch(
            f"""
            SELECT
                jobs.id::text AS job_id,
                jobs.status,
                jobs.created_at,
                jobs.completed_at,
                jobs.output_image_url,
                jobs.error_code,
                jobs.error_message,
                jobs.generation_provider,
                jobs.provider_request_id,
                {_fitment_available_clause()},
                jobs.render_input_snapshot,
                {_feedback_select_clause()},
                {_job_assets_select_clause()}
            FROM jobs
            {_job_feedback_join_clause()}
            {_job_assets_join_clause()}
            WHERE jobs.user_id = $1
            ORDER BY jobs.created_at DESC, jobs.id DESC
            LIMIT $2 OFFSET $3
            """,
            user_id,
            limit,
            offset,
        )

    history = [
        JobHistoryItem(
            job_id=row["job_id"],
            status=row["status"],
            created_at=row["created_at"],
            completed_at=row["completed_at"],
            result_url=row["output_image_url"],
            error_code=row["error_code"],
            error_message=row["error_message"],
            generation_provider=row["generation_provider"],
            provider_request_id=row["provider_request_id"],
            fitment_available=bool(row["fitment_available"]),
            feedback=_feedback_from_row(row, job_id=row["job_id"]),
            assets=_assets_from_row(row, job_id=row["job_id"]),
            render_input_snapshot=_snapshot_from_row(row, job_id=row["job_id"]),
        )
        for row in rows
    ]
    return JobHistoryResponse(jobs=history, limit=limit, offset=offset)


@router.get("/{job_id}")
async def get_job_status(
    job_id: str,
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    """Polling статуса задачи.

    Без auth возвращает legacy contract для бота. С auth проверяет владельца
    и добавляет durable asset metadata.
    """
    auth = _resolve_jobs_auth(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        required=False,
    )
    pool = db.get_pool()
    async with pool.acquire() as conn:
        if auth is None:
            row = await conn.fetchrow(
                "SELECT status, output_image_url FROM jobs WHERE id = $1::uuid",
                job_id,
            )
            if not row:
                raise HTTPException(status_code=404, detail="Job not found")
            return {"status": row["status"], "output_image_url": row["output_image_url"]}

        user_id = await ensure_user(conn, auth.telegram_user_id, auth.username)
        row = await conn.fetchrow(
            f"""
            SELECT
                jobs.id::text AS job_id,
                jobs.status,
                jobs.created_at,
                jobs.completed_at,
                jobs.output_image_url,
                jobs.error_code,
                jobs.error_message,
                jobs.render_input_snapshot,
                {_feedback_select_clause()},
                {_job_assets_select_clause()}
            FROM jobs
            {_job_feedback_join_clause()}
            {_job_assets_join_clause()}
            WHERE jobs.id = $1::uuid
              AND jobs.user_id = $2
            """,
            job_id,
            user_id,
        )
    if not row:
        raise HTTPException(status_code=404, detail="Job not found")
    return _preserve_feedback_reason(
        JobStatusResponse(
            job_id=row["job_id"],
            status=row["status"],
            output_image_url=row["output_image_url"],
            created_at=row["created_at"],
            completed_at=row["completed_at"],
            error_code=row["error_code"],
            error_message=row["error_message"],
            feedback=_feedback_from_row(row, job_id=row["job_id"]),
            assets=_assets_from_row(row, job_id=row["job_id"]),
            render_input_snapshot=_snapshot_from_row(row, job_id=row["job_id"]),
        ).model_dump(mode="json", exclude_none=True)
    )


@router.get("/{job_id}/status")
async def get_job_status_detailed(
    job_id: str,
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    """Расширенный статус для webapp polling: status + result_url + error."""
    auth = _resolve_jobs_auth(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        required=True,
    )
    assert auth is not None
    pool = db.get_pool()
    async with pool.acquire() as conn:
        user_id = await ensure_user(conn, auth.telegram_user_id, auth.username)
        row = await conn.fetchrow(
            f"""
            SELECT
                jobs.id::text AS job_id,
                jobs.status,
                jobs.output_image_url,
                jobs.error_code,
                jobs.error_message,
                {_fitment_available_clause()},
                jobs.render_input_snapshot,
                {_feedback_select_clause()},
                {_job_assets_select_clause()}
            FROM jobs
            {_job_feedback_join_clause()}
            {_job_assets_join_clause()}
            WHERE jobs.id = $1::uuid
              AND jobs.user_id = $2
            """,
            job_id,
            user_id,
        )
    if not row:
        raise HTTPException(status_code=404, detail="Job not found")
    return _preserve_feedback_reason(
        JobStatusDetailedResponse(
            job_id=job_id,
            status=row["status"],
            result_url=row["output_image_url"],
            share_url=share_url_for_job(job_id, bust_preview_cache=True)
            if row["output_image_url"]
            else None,
            error=row["error_message"],
            error_code=row["error_code"],
            fitment_available=bool(row["fitment_available"]),
            feedback=_feedback_from_row(row, job_id=row["job_id"]),
            assets=_assets_from_row(row, job_id=row["job_id"]),
            render_input_snapshot=_snapshot_from_row(row, job_id=row["job_id"]),
        ).model_dump(mode="json", exclude_none=True)
    )


@router.get("/{job_id}/fitment", response_model=FitmentOverviewResponse)
async def get_fitment_overview(
    job_id: str,
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    auth = _resolve_jobs_auth(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        required=True,
    )
    assert auth is not None

    pool = db.get_pool()
    async with pool.acquire() as conn:
        user_id = await ensure_user(conn, auth.telegram_user_id, auth.username)
        row = await _fetch_fitment_job_row(conn, job_id=job_id, user_id=user_id)

    if not row:
        raise HTTPException(status_code=404, detail="Fitment overview not found")
    if row["status"] != "completed":
        raise HTTPException(
            status_code=409,
            detail="Fitment overview is available only for completed jobs",
        )
    if not row["fitment_available"]:
        raise HTTPException(status_code=409, detail="Fitment overview is unavailable for this job")

    return _fitment_overview_from_row(row)


@router.get("/{job_id}/fitment/history", response_model=FitmentHistoryResponse)
async def get_fitment_history(
    job_id: str,
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    auth = _resolve_jobs_auth(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        required=True,
    )
    assert auth is not None

    pool = db.get_pool()
    async with pool.acquire() as conn:
        user_id = await ensure_user(conn, auth.telegram_user_id, auth.username)
        row = await _fetch_fitment_job_row(conn, job_id=job_id, user_id=user_id)
        if not row:
            raise HTTPException(status_code=404, detail="Fitment overview not found")
        events = await _fetch_fitment_history_rows(conn, job_id=job_id, user_id=user_id)

    return FitmentHistoryResponse(
        job_id=job_id,
        events=[
            FitmentHistoryItemResponse(
                event_type=event["event_type"],
                actor_type=event["actor_type"],
                actor_user_id=event["actor_user_id"],
                vehicle_revision_before=event["vehicle_revision_before"],
                vehicle_revision_after=event["vehicle_revision_after"],
                rim_revision_before=event["rim_revision_before"],
                rim_revision_after=event["rim_revision_after"],
                changes=_json_object_field(
                    event["changes"],
                    job_id=job_id,
                    field_name="fitment_change_events.changes",
                ),
                created_at=event["created_at"],
            )
            for event in events
        ],
    )


@router.post("/{job_id}/fitment/rim-source/resolve", response_model=RimSourceResolveResponse)
async def resolve_fitment_rim_source(
    job_id: str,
    request: RimSourceResolveRequest,
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    """Return an unpersisted, user-confirmable draft from a public product page."""
    if not RIM_URL_RESOLVER_ENABLED:
        raise HTTPException(status_code=503, detail="Rim URL resolver is disabled")

    auth = _resolve_jobs_auth(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        required=True,
    )
    assert auth is not None
    pool = db.get_pool()
    async with pool.acquire() as conn:
        user_id = await ensure_user(conn, auth.telegram_user_id, auth.username)
        await enforce_rate_limit(
            "fitment_rim_source",
            user_id,
            RIM_SOURCE_RESOLVE_RATE_LIMIT,
            RIM_SOURCE_RESOLVE_RATE_WINDOW_SEC,
        )
        row = await _fetch_fitment_job_row(conn, job_id=job_id, user_id=user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Fitment overview not found")
    if row["status"] != "completed" or not row["fitment_available"]:
        raise HTTPException(status_code=409, detail="Fitment overview is unavailable for this job")

    try:
        resolution = await resolve_rim_product_url(
            request.product_url,
            policy=PublicHttpsPolicy(),
            limits=FetchLimits(
                max_redirects=RIM_URL_RESOLVER_MAX_REDIRECTS,
                max_body_bytes=RIM_URL_RESOLVER_MAX_BODY_BYTES,
                total_timeout_seconds=RIM_URL_RESOLVER_TIMEOUT_SEC,
            ),
        )
    except RimUrlError as exc:
        logger.exception(
            "❌ Не удалось извлечь параметры диска job_id=%s user_id=%s",
            job_id,
            user_id,
        )
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    return RimSourceResolveResponse(
        requested_url=resolution.requested_url,
        final_url=resolution.final_url,
        values=resolution.values,
        candidates=[
            RimSourceCandidateResponse(
                field=candidate.field,
                value=candidate.value,
                source=candidate.source,
                confidence=candidate.confidence,
            )
            for candidate in resolution.candidates
        ],
        conflicts=[
            RimSourceConflictResponse(
                field=conflict.field,
                candidates=[
                    RimSourceCandidateResponse(
                        field=candidate.field,
                        value=candidate.value,
                        source=candidate.source,
                        confidence=candidate.confidence,
                    )
                    for candidate in conflict.candidates
                ],
            )
            for conflict in resolution.conflicts
        ],
    )


@router.post("/{job_id}/fitment/vehicle-variants", response_model=VehicleVariantsResponse)
async def find_fitment_vehicle_variants(
    job_id: str,
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    """List exact Wheel-Size variants for an already saved vehicle identity."""
    auth = _resolve_jobs_auth(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        required=True,
    )
    assert auth is not None
    pool = db.get_pool()
    async with pool.acquire() as conn:
        user_id = await ensure_user(conn, auth.telegram_user_id, auth.username)
        row = await _fetch_fitment_job_row(conn, job_id=job_id, user_id=user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Fitment overview not found")
    if row["status"] != "completed" or not row["fitment_available"]:
        raise HTTPException(status_code=409, detail="Fitment overview is unavailable for this job")

    identity = ProviderVehicleIdentity(
        make=row["vehicle_make"],
        model=row["vehicle_model"],
        year=row["vehicle_year"],
        body=row["vehicle_body"],
        generation=row["vehicle_generation"],
        modification=row["vehicle_modification"],
        market=row["vehicle_market"],
    )
    try:
        variants = await WheelSizeProvider().find_vehicle_variants(identity)
    except ProviderError as exc:
        raise HTTPException(status_code=503, detail="Vehicle catalogue is unavailable") from exc

    return VehicleVariantsResponse(
        variants=[VehicleVariantResponse(**variant) for variant in variants[:3]]
    )


@router.post("/{job_id}/fitment/vehicle-variants/apply", response_model=FitmentOverviewResponse)
async def apply_fitment_vehicle_variant(
    job_id: str,
    request: VehicleVariantApplyRequest,
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    auth = _resolve_jobs_auth(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        required=True,
    )
    assert auth is not None
    async with db.get_pool().acquire() as conn:
        async with conn.transaction():
            user_id = await ensure_user(conn, auth.telegram_user_id, auth.username)
            row = await _fetch_fitment_job_row(conn, job_id=job_id, user_id=user_id)
            if not row:
                raise HTTPException(status_code=404, detail="Fitment overview not found")
            if int(row["vehicle_revision"]) != request.expected_vehicle_revision:
                raise HTTPException(
                    status_code=409,
                    detail="Fitment vehicle was updated elsewhere. Reload and try again.",
                )
            identity = ProviderVehicleIdentity(
                make=row["vehicle_make"],
                model=row["vehicle_model"],
                year=row["vehicle_year"],
                market=row["vehicle_market"],
            )
            try:
                variants = await WheelSizeProvider().find_vehicle_variants(identity)
            except ProviderError as exc:
                raise HTTPException(
                    status_code=503, detail="Vehicle catalogue is unavailable"
                ) from exc
            selected = next(
                (
                    variant
                    for variant in variants
                    if all(
                        str(variant.get(key) or "") == str(getattr(request, key))
                        for key in ("generation", "modification", "body", "market")
                    )
                ),
                None,
            )
            if selected is None:
                raise HTTPException(
                    status_code=422, detail="Selected vehicle variant is no longer available"
                )
            mapping = dict(row["vehicle_provider_mappings"] or {})
            exact_mapping = {
                key: selected[key]
                for key in (
                    "make_slug",
                    "model_slug",
                    "region",
                    "generation_slug",
                    "modification_slug",
                )
            }
            if not {
                "make_slug",
                "model_slug",
                "region",
                "generation_slug",
                "modification_slug",
            }.issubset(exact_mapping):
                raise HTTPException(
                    status_code=422, detail="Selected vehicle variant could not be resolved"
                )
            mapping["wheel_size"] = exact_mapping
            await conn.execute(
                "UPDATE vehicle_identities SET generation=$1, modification=$2, body=$3, market=$4, provider_mappings=$5::jsonb, provider_mapping_revision=provider_mapping_revision+1, revision=revision+1, updated_at=CURRENT_TIMESTAMP WHERE id=$6::uuid AND owner_user_id=$7 AND revision=$8",
                request.generation,
                request.modification,
                request.body or None,
                request.market,
                json.dumps(mapping),
                row["vehicle_identity_id"],
                user_id,
                request.expected_vehicle_revision,
            )
            updated = await _fetch_fitment_job_row(conn, job_id=job_id, user_id=user_id)
    assert updated is not None
    return _fitment_overview_from_row(updated)


@router.patch("/{job_id}/fitment", response_model=FitmentOverviewResponse)
async def save_fitment_details(
    job_id: str,
    request: identity_service.FitmentDetailsUpdateRequest,
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    auth = _resolve_jobs_auth(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        required=True,
    )
    assert auth is not None

    vehicle_updates = request.vehicle.model_dump(exclude_unset=True)
    rim_updates = request.rim.model_dump(exclude_unset=True)

    pool = db.get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            user_id = await ensure_user(conn, auth.telegram_user_id, auth.username)
            row = await _fetch_fitment_job_row(conn, job_id=job_id, user_id=user_id)
            if not row:
                raise HTTPException(status_code=404, detail="Fitment overview not found")
            if row["status"] != "completed":
                raise HTTPException(
                    status_code=409,
                    detail="Fitment overview is available only for completed jobs",
                )
            if not row["fitment_available"]:
                raise HTTPException(
                    status_code=409,
                    detail="Fitment overview is unavailable for this job",
                )
            if row["is_staggered"] and row["front_rim_spec_id"] != row["rear_rim_spec_id"]:
                raise HTTPException(
                    status_code=409,
                    detail="Staggered rim setup is not supported in Sprint 4",
                )
            if (
                request.expected_vehicle_revision != row["vehicle_revision"]
                or request.expected_rim_revision != row["rim_revision"]
            ):
                raise HTTPException(
                    status_code=409,
                    detail="Fitment details were updated elsewhere. Reload and try again.",
                )

            vehicle_row_keys = {
                "make": "vehicle_make",
                "model": "vehicle_model",
                "year": "vehicle_year",
                "body": "vehicle_body",
                "generation": "vehicle_generation",
                "modification": "vehicle_modification",
                "market": "vehicle_market",
            }
            rim_row_keys = {
                "brand": "rim_brand",
                "model": "rim_model",
                "sku": "rim_sku",
                "product_url": "rim_product_url",
                "bolt_count": "rim_bolt_count",
                "pcd_mm": "rim_pcd_mm",
                "center_bore_mm": "rim_center_bore_mm",
                "wheel_diameter_in": "rim_wheel_diameter_in",
                "wheel_width_j": "rim_wheel_width_j",
                "offset_et_mm": "rim_offset_et_mm",
            }

            if vehicle_updates:
                vehicle_values = {
                    field_name: vehicle_updates.get(field_name, row[row_key])
                    for field_name, row_key in vehicle_row_keys.items()
                }
                vehicle_make = vehicle_values["make"]
                vehicle_model = vehicle_values["model"]
                if not vehicle_make or not vehicle_model:
                    raise HTTPException(
                        status_code=422,
                        detail="Vehicle make and model are required",
                    )
                vehicle_changed = _changed_payload(row, vehicle_values, vehicle_row_keys)
                vehicle_confirmed = _confirmation_payload(
                    row,
                    vehicle_values,
                    vehicle_row_keys,
                    row["vehicle_field_provenance"],
                )
            else:
                vehicle_values = {}
                vehicle_changed = {}
                vehicle_confirmed = {}

            vehicle_provenance = row["vehicle_field_provenance"] or {}
            vehicle_write_needed = bool(vehicle_changed or vehicle_confirmed)
            provider_mappings = dict(row["vehicle_provider_mappings"] or {})
            mapping_invalidated = bool(vehicle_changed) and "wheel_size" in provider_mappings
            if mapping_invalidated:
                provider_mappings.pop("wheel_size", None)
            if vehicle_write_needed:
                vehicle_provenance = _merge_field_provenance(
                    row["vehicle_field_provenance"],
                    vehicle_changed,
                    source="user_edited",
                )
                vehicle_provenance = _merge_field_provenance(
                    vehicle_provenance,
                    vehicle_confirmed,
                    source="user_confirmed",
                )
                result = await conn.execute(
                    """
                    UPDATE vehicle_identities
                    SET make = $1,
                        model = $2,
                        year = $3,
                        body = $4,
                        generation = $5,
                        modification = $6,
                        market = $7,
                        is_user_confirmed = true,
                        field_provenance = $8::jsonb,
                        provider_mappings = $9::jsonb,
                        provider_mapping_revision = provider_mapping_revision + $10,
                        revision = revision + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $11::uuid
                      AND owner_user_id = $12
                      AND revision = $13
                    """,
                    vehicle_values["make"],
                    vehicle_values["model"],
                    vehicle_values["year"],
                    vehicle_values["body"],
                    vehicle_values["generation"],
                    vehicle_values["modification"],
                    vehicle_values["market"],
                    json.dumps(vehicle_provenance),
                    json.dumps(provider_mappings),
                    1 if mapping_invalidated else 0,
                    row["vehicle_identity_id"],
                    user_id,
                    request.expected_vehicle_revision,
                )
                if _parse_update_count(result) != 1:
                    raise HTTPException(
                        status_code=409,
                        detail="Fitment vehicle was updated elsewhere. Reload and try again.",
                    )

            if rim_updates:
                rim_values = {
                    field_name: rim_updates.get(field_name, row[row_key])
                    for field_name, row_key in rim_row_keys.items()
                }
                rim_changed = _changed_payload(row, rim_values, rim_row_keys)
                rim_confirmed = _confirmation_payload(
                    row,
                    rim_values,
                    rim_row_keys,
                    row["rim_field_provenance"],
                )
            else:
                rim_values = {}
                rim_changed = {}
                rim_confirmed = {}

            rim_provenance = row["rim_field_provenance"] or {}
            rim_write_needed = bool(rim_changed or rim_confirmed)
            if rim_write_needed:
                rim_provenance = _merge_field_provenance(
                    row["rim_field_provenance"],
                    rim_changed,
                    source="user_edited",
                )
                rim_provenance = _merge_field_provenance(
                    rim_provenance,
                    rim_confirmed,
                    source="user_confirmed",
                )
                result = await conn.execute(
                    """
                    UPDATE rim_specs
                    SET brand = $1,
                        model = $2,
                        sku = $3,
                        product_url = $4,
                        bolt_count = $5,
                        pcd_mm = $6,
                        center_bore_mm = $7,
                        wheel_diameter_in = $8,
                        wheel_width_j = $9,
                        offset_et_mm = $10,
                        field_provenance = $11::jsonb,
                        revision = revision + 1,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $12::uuid
                      AND owner_user_id = $13
                      AND revision = $14
                    """,
                    rim_values["brand"],
                    rim_values["model"],
                    rim_values["sku"],
                    rim_values["product_url"],
                    rim_values["bolt_count"],
                    _rim_decimal(rim_values["pcd_mm"]),
                    _rim_decimal(rim_values["center_bore_mm"]),
                    _rim_decimal(rim_values["wheel_diameter_in"]),
                    _rim_decimal(rim_values["wheel_width_j"]),
                    _rim_decimal(rim_values["offset_et_mm"]),
                    json.dumps(rim_provenance),
                    row["front_rim_spec_id"],
                    user_id,
                    request.expected_rim_revision,
                )
                if _parse_update_count(result) != 1:
                    raise HTTPException(
                        status_code=409,
                        detail="Fitment rim was updated elsewhere. Reload and try again.",
                    )

            fitment_changes: dict[str, object] = {}
            fitment_changes.update(
                _build_fitment_changes(
                    section="vehicle",
                    before_values={
                        field_name: row[row_key] for field_name, row_key in vehicle_row_keys.items()
                    },
                    after_values=vehicle_values if vehicle_write_needed else {},
                    before_provenance=row["vehicle_field_provenance"],
                    after_provenance=vehicle_provenance if vehicle_write_needed else {},
                )
            )
            fitment_changes.update(
                _build_fitment_changes(
                    section="rim",
                    before_values={
                        field_name: row[row_key] for field_name, row_key in rim_row_keys.items()
                    },
                    after_values=rim_values if rim_write_needed else {},
                    before_provenance=row["rim_field_provenance"],
                    after_provenance=rim_provenance if rim_write_needed else {},
                )
            )
            if fitment_changes:
                if mapping_invalidated:
                    fitment_changes["vehicle.provider_mapping"] = {
                        "before": {
                            "wheel_size": row["vehicle_provider_mappings"].get("wheel_size")
                        },
                        "after": None,
                        "reason": "canonical_vehicle_identity_changed",
                    }
                await _insert_fitment_change_event(
                    conn,
                    job_id=job_id,
                    vehicle_identity_id=row["vehicle_identity_id"],
                    rim_spec_id=row["front_rim_spec_id"],
                    event_type="user_save" if vehicle_changed or rim_changed else "user_confirm",
                    actor_type="user",
                    actor_user_id=user_id,
                    vehicle_revision_before=row["vehicle_revision"],
                    vehicle_revision_after=row["vehicle_revision"]
                    + (1 if vehicle_write_needed else 0),
                    rim_revision_before=row["rim_revision"],
                    rim_revision_after=row["rim_revision"] + (1 if rim_write_needed else 0),
                    changes=fitment_changes,
                )

            updated_row = await _fetch_fitment_job_row(conn, job_id=job_id, user_id=user_id)

    assert updated_row is not None
    return _fitment_overview_from_row(updated_row)


@router.get("/{job_id}/assets/{kind}/download")
async def download_job_asset(
    job_id: str,
    kind: AssetKind,
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    """Proxy download for an authorized user's durable job asset."""
    auth = _resolve_jobs_auth(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        required=True,
    )
    assert auth is not None

    pool = db.get_pool()
    async with pool.acquire() as conn:
        user_id = await ensure_user(conn, auth.telegram_user_id, auth.username)
        row = await conn.fetchrow(
            """
            SELECT assets.bucket, assets.storage_key, assets.content_type
            FROM jobs
            JOIN assets
              ON assets.job_id = jobs.id
             AND assets.owner_user_id = jobs.user_id
            WHERE jobs.id = $1::uuid
              AND jobs.user_id = $2
              AND assets.kind = $3
            """,
            job_id,
            user_id,
            kind,
        )

    if not row:
        raise HTTPException(status_code=404, detail="Asset not found")

    try:
        content = await storage.download_bytes(bucket=row["bucket"], path=row["storage_key"])
    except storage.StorageError as exc:
        logger.exception(
            "❌ Asset download failed для job_id=%s user_id=%s kind=%s: %s",
            job_id,
            user_id,
            kind,
            exc,
        )
        raise HTTPException(status_code=502, detail="Asset fetch failed") from exc

    return Response(
        content=content,
        media_type=row["content_type"] or "application/octet-stream",
        headers={"Cache-Control": "private, max-age=300"},
    )


@router.get("/{job_id}/feedback", response_model=JobFeedbackEnvelope)
async def get_job_feedback(
    job_id: str,
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    auth = _resolve_jobs_auth(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        required=True,
    )
    assert auth is not None
    pool = db.get_pool()
    async with pool.acquire() as conn:
        user_id = await ensure_user(conn, auth.telegram_user_id, auth.username)
        await _require_feedback_job_access(conn, job_id=job_id, user_id=user_id)
        row = await conn.fetchrow(
            f"""
            SELECT
                jobs.id::text AS job_id,
                {_feedback_select_clause()}
            FROM jobs
            {_job_feedback_join_clause()}
            WHERE jobs.id = $1::uuid
              AND jobs.user_id = $2
            """,
            job_id,
            user_id,
        )
    assert row is not None
    return JobFeedbackEnvelope(
        feedback=_feedback_from_row(row, job_id=row["job_id"], include_job_id=True)
    ).model_dump(mode="json", exclude_none=False)


@router.put("/{job_id}/feedback", response_model=JobFeedbackEnvelope)
async def put_feedback(
    job_id: str,
    request: FeedbackPutRequest,
    authorization: Annotated[str | None, Header()] = None,
    x_internal_token: Annotated[str | None, Header(alias="X-Internal-Token")] = None,
):
    telegram_user_id = _telegram_user_id_from_feedback_request(
        request,
        x_internal_token,
        authorization,
    )
    pool = db.get_pool()
    async with pool.acquire() as conn:
        user_id = await ensure_user(conn, telegram_user_id)
        await _require_feedback_job_access(conn, job_id=job_id, user_id=user_id)
        feedback = await _upsert_feedback(
            conn,
            job_id=job_id,
            user_id=user_id,
            sentiment=request.sentiment,
            reason=request.reason,
        )
    logger.info(
        "👍 Feedback saved sentiment=%s reason=%s для job_id=%s tg_user=%s",
        feedback.sentiment,
        feedback.reason,
        job_id,
        telegram_user_id,
    )
    return JobFeedbackEnvelope(feedback=feedback).model_dump(mode="json", exclude_none=False)


@router.post("/{job_id}/feedback", status_code=204)
async def submit_feedback_legacy(
    job_id: str,
    request: FeedbackLegacyRequest,
    authorization: Annotated[str | None, Header()] = None,
    x_internal_token: Annotated[str | None, Header(alias="X-Internal-Token")] = None,
):
    telegram_user_id = _telegram_user_id_from_feedback_request(
        request,
        x_internal_token,
        authorization,
    )
    pool = db.get_pool()
    async with pool.acquire() as conn:
        user_id = await ensure_user(conn, telegram_user_id)
        await _require_feedback_job_access(conn, job_id=job_id, user_id=user_id)
        feedback = await _upsert_feedback(
            conn,
            job_id=job_id,
            user_id=user_id,
            sentiment=_sentiment_from_vote(request.vote),
            reason=None,
        )
    logger.info(
        "👍 Legacy feedback alias saved sentiment=%s для job_id=%s tg_user=%s",
        feedback.sentiment,
        job_id,
        telegram_user_id,
    )


@router.delete("/{job_id}/feedback", status_code=204)
async def delete_feedback(
    job_id: str,
    request: FeedbackAuthRequest,
    authorization: Annotated[str | None, Header()] = None,
    x_internal_token: Annotated[str | None, Header(alias="X-Internal-Token")] = None,
):
    """Удалить feedback на результат для владельца job."""
    telegram_user_id = _telegram_user_id_from_feedback_request(
        request,
        x_internal_token,
        authorization,
    )
    pool = db.get_pool()
    async with pool.acquire() as conn:
        user_id = await ensure_user(conn, telegram_user_id)
        await _require_feedback_job_access(conn, job_id=job_id, user_id=user_id)
        await conn.execute(
            """
            DELETE FROM render_feedback
            WHERE render_job_id = $1::uuid
              AND owner_user_id = $2
            """,
            job_id,
            user_id,
        )
    logger.info("👍 Feedback deleted для job_id=%s tg_user=%s", job_id, telegram_user_id)


@router.get("/{job_id}/download")
async def download_job_result(
    job_id: str,
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    """Отдать результат как attachment для Telegram.WebApp.downloadFile."""
    auth = _resolve_jobs_auth(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        required=True,
    )
    assert auth is not None
    pool = db.get_pool()
    async with pool.acquire() as conn:
        user_id = await ensure_user(conn, auth.telegram_user_id, auth.username)
        row = await conn.fetchrow(
            """
            SELECT status, output_image_url
            FROM jobs
            WHERE id = $1::uuid
              AND user_id = $2
            """,
            job_id,
            user_id,
        )

    if not row:
        raise HTTPException(status_code=404, detail="Job not found")
    if row["status"] != "completed" or not row["output_image_url"]:
        raise HTTPException(status_code=409, detail="Job result is not ready")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            result_resp = await client.get(row["output_image_url"])
    except httpx.HTTPError as exc:
        logger.exception(f"❌ Result download proxy failed для job_id={job_id}: {exc}")
        raise HTTPException(status_code=502, detail="Result fetch failed") from exc

    if result_resp.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Result fetch failed: HTTP {result_resp.status_code}",
        )

    content_type = result_resp.headers.get("content-type", "image/jpeg")
    filename = _download_filename(job_id, content_type)
    return Response(
        content=result_resp.content,
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, max-age=300",
        },
    )
