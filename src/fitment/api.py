"""HTTP-эндпоинты Detailed Fitment Check (контракт handoff §API contract).

Тонкий слой: auth → ownership → service. Наружу — машинные коды, не UI-тексты
(display-блок помечен draft). Feature-flag FITMENT_VERDICT_ENABLED (default
false) закрывает все эндпоинты 503, поэтому существующие потоки не затронуты.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Annotated, Literal
from urllib.parse import urlsplit
from uuid import UUID

from fastapi import APIRouter, File, Form, Header, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field, field_validator

from src import db, redis_client
from src.auth import resolve_telegram_auth
from src.fitment import config as fitment_config
from src.fitment.identification.rim_url import RimProductUrlResolver, RimUrlResolution
from src.fitment.identification.rim_url_fetch import (
    FetchLimits,
    RimUrlFetchError,
    RimUrlSecurityError,
    UrlAllowlistPolicy,
)
from src.fitment.images import FitmentImageError, normalize_fitment_image
from src.fitment.presentation import confirmed_display, preliminary_display, verdict_display
from src.fitment.providers.cache import RedisProviderCache
from src.fitment.providers.wheel_size import WheelSizeProvider
from src.fitment.repository import (
    FitmentRepository,
    InMemoryFitmentRepository,
    PostgresFitmentRepository,
)
from src.fitment.schemas import (
    CheckStatus,
    FieldValue,
    FitmentCheck,
    PreliminaryRun,
    RimSetup,
    RimSpec,
    Source,
    VehicleIdentity,
)
from src.fitment.service import FitmentService
from src.rate_limit import enforce_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/fitment", tags=["fitment"])

_service: FitmentService | None = None

FITMENT_PRELIMINARY_RATE_LIMIT = 10
FITMENT_PRELIMINARY_RATE_WINDOW_SEC = 60 * 60
FITMENT_ENRICHMENT_RATE_LIMIT = 30
FITMENT_ENRICHMENT_RATE_WINDOW_SEC = 60 * 60
FITMENT_CHECK_RATE_LIMIT = 30
FITMENT_CHECK_RATE_WINDOW_SEC = 60 * 60


def set_service(service: FitmentService | None) -> None:
    """DI-переопределение для тестов."""
    global _service
    _service = service


def get_service() -> FitmentService:
    global _service
    if _service is None:
        repository: FitmentRepository
        if fitment_config.FITMENT_DB_PERSISTENCE:
            repository = PostgresFitmentRepository(db.get_pool())
        else:
            repository = InMemoryFitmentRepository()
        rim_url_resolver = None
        if fitment_config.FITMENT_RIM_URL_RESOLVER_ENABLED:
            allowed_hosts = fitment_config.FITMENT_RIM_URL_ALLOWED_HOSTS
            if allowed_hosts or fitment_config.FITMENT_RIM_URL_ALLOW_ALL_PUBLIC:
                rim_url_resolver = RimProductUrlResolver(
                    UrlAllowlistPolicy.from_values(
                        allowed_hosts=allowed_hosts,
                        allow_all_public=fitment_config.FITMENT_RIM_URL_ALLOW_ALL_PUBLIC,
                    ),
                    limits=FetchLimits(
                        max_redirects=fitment_config.FITMENT_RIM_URL_MAX_REDIRECTS,
                        max_body_bytes=fitment_config.FITMENT_RIM_URL_MAX_BYTES,
                        connect_timeout_seconds=fitment_config.FITMENT_RIM_URL_TIMEOUT_CONNECT_SEC,
                        read_timeout_seconds=fitment_config.FITMENT_RIM_URL_TIMEOUT_READ_SEC,
                        total_timeout_seconds=fitment_config.FITMENT_RIM_URL_TIMEOUT_TOTAL_SEC,
                        max_retries=fitment_config.FITMENT_RIM_URL_MAX_RETRIES,
                        retry_backoff_seconds=(fitment_config.FITMENT_RIM_URL_RETRY_BACKOFF_SEC),
                        user_agent=fitment_config.FITMENT_RIM_URL_USER_AGENT,
                    ),
                    cache_ttl_seconds=fitment_config.FITMENT_RIM_URL_CACHE_TTL_SEC,
                    cache_max_entries=fitment_config.FITMENT_RIM_URL_CACHE_MAX_ENTRIES,
                )
            else:
                logger.warning(
                    "Fitment rim URL resolver disabled: configure allowed hosts "
                    "or explicitly enable all public hosts"
                )
        provider_cache = (
            RedisProviderCache(
                redis_client.get_client(),
                key_prefix=redis_client.key("fitment:provider:"),
            )
            if redis_client.is_initialized()
            else None
        )
        _service = FitmentService(
            repository=repository,
            provider=WheelSizeProvider(cache=provider_cache),
            rim_url_resolver=rim_url_resolver,
        )
    return _service


def _ensure_enabled() -> None:
    if not fitment_config.FITMENT_VERDICT_ENABLED:
        raise HTTPException(status_code=503, detail="Fitment verdict is disabled")


async def _enforce_fitment_rate_limit(
    *,
    scope: str,
    telegram_user_id: int,
    limit: int,
    window_sec: int,
) -> None:
    if not redis_client.is_initialized():
        return
    await enforce_rate_limit(
        scope=scope,
        identifier=telegram_user_id,
        limit=limit,
        window_sec=window_sec,
    )


async def _ensure_render_job_owned(*, render_job_id: UUID, telegram_user_id: int) -> None:
    pool = db.get_pool()
    async with pool.acquire() as conn:
        owned = await conn.fetchval(
            """
            SELECT EXISTS (
                SELECT 1
                FROM jobs
                JOIN users ON users.id = jobs.user_id
                WHERE jobs.id = $1::uuid
                  AND users.telegram_user_id = $2
            )
            """,
            str(render_job_id),
            telegram_user_id,
        )
    if not owned:
        raise HTTPException(status_code=404, detail="Render job not found")


# -- Input models --------------------------------------------------------------


class AuthFields(BaseModel):
    init_data: str | None = None
    telegram_user_id: int | None = None


class VehicleIdentityRequest(AuthFields):
    make: str
    model: str
    year: int = Field(ge=1950, le=2100)
    body: str | None = None
    generation: str | None = None
    modification: str | None = None
    market: str | None = None
    is_confirmed: bool = False


class RimSpecInput(BaseModel):
    """Плоский пользовательский ввод спеки одного диска."""

    brand: str | None = None
    model: str | None = None
    sku: str | None = None
    product_url: str | None = Field(default=None, max_length=2048)
    bolt_count: int | None = Field(default=None, ge=3, le=10)
    pcd_mm: float | None = Field(default=None, gt=0)
    center_bore_mm: float | None = Field(default=None, gt=0)
    wheel_diameter_in: float | None = Field(default=None, gt=0)
    wheel_width_j: float | None = Field(default=None, gt=0)
    offset_et_mm: float | None = None
    load_rating_kg: float | None = Field(default=None, gt=0)
    fastener_system: str | None = None
    seat_type: str | None = None
    thread_diameter_mm: float | None = Field(default=None, gt=0)
    thread_pitch_mm: float | None = Field(default=None, gt=0)
    bolt_length_mm: float | None = Field(default=None, gt=0)

    @field_validator("product_url")
    @classmethod
    def validate_product_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            parsed = urlsplit(value)
            _ = parsed.port
        except ValueError as exc:
            raise ValueError("product_url is malformed") from exc
        if (
            parsed.scheme.lower() != "https"
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
        ):
            raise ValueError("product_url must be an absolute HTTPS URL")
        return value

    def to_spec(self, *, is_confirmed: bool) -> RimSpec:
        source = Source.user_confirmed if is_confirmed else Source.user_input
        confidence = 0.9 if is_confirmed else 0.7

        def fv(value):
            if value is None:
                return FieldValue()
            return FieldValue(
                value=value,
                source=source,
                confidence=confidence,
                is_user_confirmed=is_confirmed,
            )

        return RimSpec(
            brand=self.brand,
            model=self.model,
            sku=self.sku,
            product_url=self.product_url,
            bolt_count=fv(self.bolt_count),
            pcd_mm=fv(self.pcd_mm),
            center_bore_mm=fv(self.center_bore_mm),
            wheel_diameter_in=fv(self.wheel_diameter_in),
            wheel_width_j=fv(self.wheel_width_j),
            offset_et_mm=fv(self.offset_et_mm),
            load_rating_kg=fv(self.load_rating_kg),
            fastener_system=fv(self.fastener_system),
            seat_type=fv(self.seat_type),
            thread_diameter_mm=fv(self.thread_diameter_mm),
            thread_pitch_mm=fv(self.thread_pitch_mm),
            bolt_length_mm=fv(self.bolt_length_mm),
        )


class RimSetupRequest(AuthFields):
    front: RimSpecInput
    rear: RimSpecInput | None = None
    is_confirmed: bool = False


class RimUrlResolveRequest(AuthFields):
    rim: RimSpecInput


class CheckCreateRequest(AuthFields):
    vehicle_identity_id: UUID
    rim_setup_id: UUID
    render_job_id: UUID | None = None
    trigger: Literal["user_requested"] = "user_requested"
    mode: Literal["detailed"] = "detailed"
    preliminary_run_id: UUID | None = None


# -- Response models ------------------------------------------------------------


class CreatedResponse(BaseModel):
    id: str


class RimUrlCandidateResponse(BaseModel):
    field: str
    value: str | int | float
    source: str
    confidence: float
    raw_value: str | None = None
    source_url: str | None = None


class RimUrlConflictResponse(BaseModel):
    field: str
    candidates: list[RimUrlCandidateResponse]


class RimUrlVariantResponse(BaseModel):
    rim: RimSpec
    source_url: str | None = None
    membership_score: int
    confidence: float
    relation_sources: list[str]
    conflict_fields: list[str]


class RimUrlResolveResponse(BaseModel):
    requested_url: str
    final_url: str
    selected: RimSpec
    selected_variant_sku: str | None = None
    selection_required: bool
    candidates: list[RimUrlCandidateResponse]
    conflicts: list[RimUrlConflictResponse]
    variants: list[RimUrlVariantResponse]

    @classmethod
    def from_resolution(cls, resolution: RimUrlResolution) -> RimUrlResolveResponse:
        def candidate_payload(candidate) -> RimUrlCandidateResponse:
            return RimUrlCandidateResponse(
                field=candidate.field,
                value=candidate.value,
                source=candidate.source,
                confidence=candidate.confidence,
                raw_value=candidate.raw_value,
                source_url=candidate.source_url,
            )

        return cls(
            requested_url=resolution.requested_url,
            final_url=resolution.final_url,
            selected=resolution.rim,
            selected_variant_sku=resolution.selected_variant_sku,
            selection_required=resolution.selection_required,
            candidates=[candidate_payload(item) for item in resolution.candidates],
            conflicts=[
                RimUrlConflictResponse(
                    field=conflict.field,
                    candidates=[candidate_payload(item) for item in conflict.candidates],
                )
                for conflict in resolution.conflicts
            ],
            variants=[
                RimUrlVariantResponse(
                    rim=variant.rim,
                    source_url=variant.source_url,
                    membership_score=variant.score,
                    confidence=variant.confidence,
                    relation_sources=list(variant.relation_sources),
                    conflict_fields=[conflict.field for conflict in variant.conflicts],
                )
                for variant in resolution.variants
            ],
        )


class CheckResponse(BaseModel):
    check_id: str
    status: str
    verdict: dict | None = None
    risk: dict | None = None
    display: dict | None = None
    error_code: str | None = None

    @classmethod
    def from_check(cls, check: FitmentCheck) -> CheckResponse:
        verdict_payload = None
        display = None
        if check.verdict is not None:
            verdict_payload = check.verdict.model_dump(exclude={"rule_results"})
            display = (
                confirmed_display(check.verdict, check.risk)
                if check.risk is not None
                else verdict_display(check.verdict)
            )
        return cls(
            check_id=check.id,
            status=check.status.value,
            verdict=verdict_payload,
            risk=check.risk.model_dump() if check.risk else None,
            display=display,
            error_code=check.error_code,
        )


class PreliminaryResponse(BaseModel):
    run_id: str
    status: str
    prediction: dict | None = None
    verdict: dict | None = None
    fit_likelihood: float | None = None
    display: dict | None = None
    error_code: str | None = None

    @classmethod
    def from_run(cls, run: PreliminaryRun) -> PreliminaryResponse:
        display = None
        if run.verdict is not None and run.fit_likelihood is not None:
            display = preliminary_display(run.verdict, run.fit_likelihood)
        return cls(
            run_id=run.id,
            status=run.status.value,
            prediction=run.prediction.model_dump() if run.prediction else None,
            verdict=(run.verdict.model_dump(exclude={"rule_results"}) if run.verdict else None),
            fit_likelihood=run.fit_likelihood,
            display=display,
            error_code=run.error_code,
        )


# -- Endpoints -------------------------------------------------------------------


@router.post("/preliminary", response_model=PreliminaryResponse)
async def create_preliminary(
    car_image: Annotated[UploadFile, File()],
    rim_image: Annotated[UploadFile, File()],
    init_data: Annotated[str | None, Form()] = None,
    telegram_user_id: Annotated[int | None, Form()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    _ensure_enabled()
    auth = resolve_telegram_auth(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        auth_name="fitment preliminary",
    )
    await _enforce_fitment_rate_limit(
        scope="fitment_preliminary",
        telegram_user_id=auth.telegram_user_id,
        limit=FITMENT_PRELIMINARY_RATE_LIMIT,
        window_sec=FITMENT_PRELIMINARY_RATE_WINDOW_SEC,
    )
    max_bytes = fitment_config.FITMENT_IMAGE_MAX_BYTES
    car_raw, rim_raw = await asyncio.gather(
        car_image.read(max_bytes + 1),
        rim_image.read(max_bytes + 1),
    )
    try:
        normalized_car, car_meta = normalize_fitment_image(
            car_raw,
            content_type=car_image.content_type,
        )
        normalized_rim, rim_meta = normalize_fitment_image(
            rim_raw,
            content_type=rim_image.content_type,
        )
    except FitmentImageError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    run = await get_service().run_preliminary(
        owner_telegram_user_id=auth.telegram_user_id,
        car_image_bytes=normalized_car,
        rim_image_bytes=normalized_rim,
        car_image_sha256=str(car_meta["sha256"]),
        rim_image_sha256=str(rim_meta["sha256"]),
    )
    return PreliminaryResponse.from_run(run)


@router.get("/preliminary/{run_id}", response_model=PreliminaryResponse)
async def get_preliminary(
    run_id: UUID,
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    _ensure_enabled()
    auth = resolve_telegram_auth(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        auth_name="fitment preliminary status",
    )
    run = await get_service().repository.get_preliminary_run(
        str(run_id),
        owner_telegram_user_id=auth.telegram_user_id,
    )
    if run is None:
        raise HTTPException(status_code=404, detail="Preliminary run not found")
    return PreliminaryResponse.from_run(run)


@router.post("/vehicle-identities", response_model=CreatedResponse)
async def create_vehicle_identity(
    request: VehicleIdentityRequest,
    authorization: Annotated[str | None, Header()] = None,
):
    _ensure_enabled()
    auth = resolve_telegram_auth(
        init_data=request.init_data,
        telegram_user_id=request.telegram_user_id,
        authorization=authorization,
        auth_name="fitment identity",
    )
    identity = VehicleIdentity(
        make=request.make.strip(),
        model=request.model.strip(),
        year=request.year,
        body=request.body,
        generation=request.generation,
        modification=request.modification,
        market=request.market,
        is_user_confirmed=request.is_confirmed,
        source=Source.user_confirmed if request.is_confirmed else Source.user_input,
        confidence=0.9 if request.is_confirmed else 0.7,
    )
    service = get_service()
    identity_id = await service.repository.save_vehicle_identity(
        identity, owner_telegram_user_id=auth.telegram_user_id
    )
    return CreatedResponse(id=identity_id)


@router.post("/rim-setups", response_model=CreatedResponse)
async def create_rim_setup(
    request: RimSetupRequest,
    authorization: Annotated[str | None, Header()] = None,
):
    _ensure_enabled()
    auth = resolve_telegram_auth(
        init_data=request.init_data,
        telegram_user_id=request.telegram_user_id,
        authorization=authorization,
        auth_name="fitment rim setup",
    )
    await _enforce_fitment_rate_limit(
        scope="fitment_rim_setup",
        telegram_user_id=auth.telegram_user_id,
        limit=FITMENT_ENRICHMENT_RATE_LIMIT,
        window_sec=FITMENT_ENRICHMENT_RATE_WINDOW_SEC,
    )
    service = get_service()
    try:
        front = await service.enrich_rim_spec(
            request.front.to_spec(is_confirmed=request.is_confirmed)
        )
        rear = (
            await service.enrich_rim_spec(request.rear.to_spec(is_confirmed=request.is_confirmed))
            if request.rear is not None
            else front.model_copy(deep=True)
        )
    except RimUrlSecurityError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RimUrlFetchError as exc:
        raise HTTPException(status_code=502, detail="Rim product page is unavailable") from exc

    setup = RimSetup(front=front, rear=rear, is_staggered=request.rear is not None)
    setup_id = await service.repository.save_rim_setup(
        setup, owner_telegram_user_id=auth.telegram_user_id
    )
    return CreatedResponse(id=setup_id)


@router.post("/rim-url/resolve", response_model=RimUrlResolveResponse)
async def resolve_rim_url(
    request: RimUrlResolveRequest,
    authorization: Annotated[str | None, Header()] = None,
) -> RimUrlResolveResponse:
    """Resolve a user-supplied product page without silently choosing a variant."""
    _ensure_enabled()
    auth = resolve_telegram_auth(
        init_data=request.init_data,
        telegram_user_id=request.telegram_user_id,
        authorization=authorization,
        auth_name="fitment rim URL",
    )
    await _enforce_fitment_rate_limit(
        scope="fitment_rim_url",
        telegram_user_id=auth.telegram_user_id,
        limit=FITMENT_ENRICHMENT_RATE_LIMIT,
        window_sec=FITMENT_ENRICHMENT_RATE_WINDOW_SEC,
    )
    if not request.rim.product_url:
        raise HTTPException(status_code=422, detail="Rim product URL is required")

    service = get_service()
    try:
        resolution = await service.resolve_rim_product(request.rim.to_spec(is_confirmed=False))
    except RimUrlSecurityError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RimUrlFetchError as exc:
        raise HTTPException(status_code=502, detail="Rim product page is unavailable") from exc
    if resolution is None:
        raise HTTPException(status_code=503, detail="Rim product URL resolver is disabled")
    return RimUrlResolveResponse.from_resolution(resolution)


@router.post("/checks", response_model=CheckResponse)
async def create_check(
    request: CheckCreateRequest,
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key")],
    authorization: Annotated[str | None, Header()] = None,
):
    """Создать и выполнить Detailed Fitment Check (user-initiated only).

    Search-запрос к провайдеру уходит только отсюда — по явному действию
    пользователя (ToS Wheel-Size). Идемпотентность по Idempotency-Key.
    """
    _ensure_enabled()
    if not idempotency_key.strip() or len(idempotency_key) > 255:
        raise HTTPException(status_code=422, detail="Invalid Idempotency-Key")
    auth = resolve_telegram_auth(
        init_data=request.init_data,
        telegram_user_id=request.telegram_user_id,
        authorization=authorization,
        auth_name="fitment check",
    )
    await _enforce_fitment_rate_limit(
        scope="fitment_check",
        telegram_user_id=auth.telegram_user_id,
        limit=FITMENT_CHECK_RATE_LIMIT,
        window_sec=FITMENT_CHECK_RATE_WINDOW_SEC,
    )
    if request.render_job_id is not None:
        await _ensure_render_job_owned(
            render_job_id=request.render_job_id,
            telegram_user_id=auth.telegram_user_id,
        )
    service = get_service()
    try:
        check = await service.create_check(
            owner_telegram_user_id=auth.telegram_user_id,
            vehicle_identity_id=str(request.vehicle_identity_id),
            rim_setup_id=str(request.rim_setup_id),
            render_job_id=str(request.render_job_id) if request.render_job_id else None,
            idempotency_key=idempotency_key,
            trigger=request.trigger,
            mode=request.mode,
            preliminary_run_id=(
                str(request.preliminary_run_id) if request.preliminary_run_id else None
            ),
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if check.status == CheckStatus.queued:
        check = await service.execute_check(check)
    return CheckResponse.from_check(check)


@router.get("/checks/{check_id}", response_model=CheckResponse)
async def get_check(
    check_id: UUID,
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    _ensure_enabled()
    auth = resolve_telegram_auth(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        auth_name="fitment check status",
    )
    service = get_service()
    check = await service.repository.get_check(
        str(check_id), owner_telegram_user_id=auth.telegram_user_id
    )
    if check is None:
        raise HTTPException(status_code=404, detail="Check not found")
    return CheckResponse.from_check(check)
