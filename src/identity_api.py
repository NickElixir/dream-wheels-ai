"""Sprint 2 assisted identity API."""

import logging
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel

from src import assets_service, db, identity_service, storage
from src.auth import resolve_telegram_auth
from src.config import VEHICLE_IDENTITY_MAX_IMAGE_EDGE, VEHICLE_IDENTITY_MAX_PIXELS
from src.identity.prompts import PROMPT_VERSION, RESOLVER_VERSION
from src.identity.providers.base import VehicleIdentityProviderError
from src.identity.schemas import (
    AbstentionReason,
    ResolutionStatus,
    VehicleIdentityResolution,
    VehicleResolutionMetadata,
)
from src.identity.service import get_vehicle_identity_resolver
from src.jobs_api import ALLOWED_UPLOAD_MIME, MAX_RAW_FILE_BYTES
from src.rate_limit import enforce_rate_limit
from src.users_service import ensure_user
from src.vision.image_normalization import ImageNormalizationError, normalize_image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/identity", tags=["identity"])

IDENTITY_RATE_LIMIT = 20
IDENTITY_RATE_WINDOW_SEC = 60 * 60


class IdentityResolveResponse(BaseModel):
    draft_id: str
    car_asset_id: str
    rim_asset_id: str
    vehicle: VehicleIdentityResolution
    rim: identity_service.RimIdentityProposal
    pcd_display: str | None = None
    resolver: str


async def _read_identity_upload(upload: UploadFile, label: str) -> bytes:
    if upload.content_type not in ALLOWED_UPLOAD_MIME:
        raise HTTPException(
            status_code=415,
            detail={"error_code": "unsupported_media_type", "field": label},
        )
    data = await upload.read()
    if len(data) > MAX_RAW_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail={"error_code": "image_too_large", "field": label},
        )
    if len(data) == 0:
        raise HTTPException(
            status_code=400, detail={"error_code": "image_decode_failed", "field": label}
        )
    return data


def _normalization_http_error(exc: ImageNormalizationError) -> HTTPException:
    status_code = 413 if exc.code in {"image_pixel_limit_exceeded", "image_too_large"} else 400
    return HTTPException(status_code=status_code, detail={"error_code": exc.code})


@router.post("/resolve", response_model=IdentityResolveResponse)
async def resolve_identity(
    car_image: Annotated[UploadFile, File()],
    wheel_image: Annotated[UploadFile, File()],
    init_data: Annotated[str, Form()] = "",
    telegram_user_id: Annotated[int | None, Form()] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> IdentityResolveResponse:
    """Persist source assets and return a non-canonical vehicle proposal."""
    auth = resolve_telegram_auth(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        auth_name="identity resolve",
    )
    await enforce_rate_limit(
        scope="identity_resolve",
        identifier=auth.telegram_user_id,
        limit=IDENTITY_RATE_LIMIT,
        window_sec=IDENTITY_RATE_WINDOW_SEC,
    )

    car_bytes = await _read_identity_upload(car_image, "car")
    rim_bytes = await _read_identity_upload(wheel_image, "wheel")
    try:
        normalized_car = normalize_image(
            car_bytes,
            max_image_edge=VEHICLE_IDENTITY_MAX_IMAGE_EDGE,
            max_pixels=VEHICLE_IDENTITY_MAX_PIXELS,
        )
    except ImageNormalizationError as exc:
        raise _normalization_http_error(exc) from exc

    pool = db.get_pool()
    async with pool.acquire() as conn:
        owner_user_id = await ensure_user(conn, auth.telegram_user_id, auth.username)
        draft_id = str(
            await conn.fetchval(
                """
                INSERT INTO render_input_drafts (owner_user_id, status)
                VALUES ($1, 'resolving')
                RETURNING id
                """,
                owner_user_id,
            )
        )

    uploaded_assets: list[assets_service.AssetUpload] = []
    try:
        car_asset = await assets_service.upload_render_asset(
            owner_user_id=owner_user_id,
            render_input_draft_id=draft_id,
            kind="car_original",
            data=car_bytes,
            content_type=car_image.content_type or "application/octet-stream",
        )
        uploaded_assets.append(car_asset)
        rim_asset = await assets_service.upload_render_asset(
            owner_user_id=owner_user_id,
            render_input_draft_id=draft_id,
            kind="rim_original",
            data=rim_bytes,
            content_type=wheel_image.content_type or "application/octet-stream",
        )
        uploaded_assets.append(rim_asset)
    except storage.StorageError as exc:
        for uploaded_asset in uploaded_assets:
            try:
                await assets_service.delete_uploaded_asset(uploaded_asset)
            except storage.StorageError as cleanup_exc:
                logger.exception(
                    "❌ Identity draft cleanup failed draft_id=%s asset_id=%s: %s",
                    draft_id,
                    uploaded_asset.id,
                    cleanup_exc,
                )
        logger.exception(
            "❌ Identity asset upload failed draft_id=%s user_id=%s: %s",
            draft_id,
            owner_user_id,
            exc,
        )
        raise HTTPException(status_code=502, detail="Storage upload failed") from exc

    async with pool.acquire() as conn:
        async with conn.transaction():
            await assets_service.insert_asset(conn, car_asset)
            await assets_service.insert_asset(conn, rim_asset)
            await conn.execute(
                """
                UPDATE render_input_drafts
                SET car_asset_id = $1::uuid,
                    rim_asset_id = $2::uuid,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3::uuid
                  AND owner_user_id = $4
                """,
                car_asset.id,
                rim_asset.id,
                draft_id,
                owner_user_id,
            )

    try:
        resolution = await get_vehicle_identity_resolver().resolve(normalized_car)
    except VehicleIdentityProviderError as exc:
        logger.exception(
            "❌ Vehicle identity provider failed draft_id=%s user_id=%s error_code=%s",
            draft_id,
            owner_user_id,
            exc.error_code,
        )
        failed_resolution = VehicleIdentityResolution(
            status=ResolutionStatus.unknown,
            abstention_reason=AbstentionReason.provider_returned_no_candidates,
            metadata=VehicleResolutionMetadata(
                provider="unavailable",
                model="unavailable",
                prompt_version=PROMPT_VERSION,
                resolver_version=RESOLVER_VERSION,
                input_asset_id=car_asset.id,
                input_asset_sha256=car_asset.sha256,
                normalized_input_sha256=normalized_car.sha256,
                captured_at=datetime.now(UTC),
            ),
        )
        failed_proposal = identity_service.identity_proposal_from_resolution(failed_resolution)
        failed_proposal.error = identity_service.IdentityResolutionError(
            error_code=exc.error_code,
            retryable=exc.retryable,
        )
        async with pool.acquire() as conn:
            await conn.execute(
                """
                UPDATE render_input_drafts
                SET identity_proposal = $1::jsonb,
                    status = 'resolved',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2::uuid
                  AND owner_user_id = $3
                """,
                failed_proposal.model_dump_json(),
                draft_id,
                owner_user_id,
            )
        raise HTTPException(
            status_code=502 if exc.error_code.endswith("invalid_response") else 503,
            detail={
                "error_code": exc.error_code,
                "retryable": exc.retryable,
                "draft_id": draft_id,
                "manual_fallback": True,
            },
        ) from exc

    metadata = resolution.metadata.model_copy(
        update={
            "input_asset_id": car_asset.id,
            "input_asset_sha256": car_asset.sha256,
        }
    )
    proposal = identity_service.identity_proposal_from_resolution(
        resolution.model_copy(update={"metadata": metadata})
    )
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE render_input_drafts
            SET identity_proposal = $1::jsonb,
                status = 'resolved',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2::uuid
              AND owner_user_id = $3
            """,
            proposal.model_dump_json(),
            draft_id,
            owner_user_id,
        )

    logger.info(
        "✅ Identity proposal resolved draft_id=%s user_id=%s resolver=%s",
        draft_id,
        owner_user_id,
        proposal.resolver,
    )
    return IdentityResolveResponse(
        draft_id=draft_id,
        car_asset_id=car_asset.id,
        rim_asset_id=rim_asset.id,
        vehicle=proposal.vehicle,
        rim=proposal.rim,
        resolver=proposal.resolver,
    )
