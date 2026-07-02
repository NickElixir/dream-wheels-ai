"""Sprint 2 assisted identity API."""

import logging
from typing import Annotated

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel

from src import assets_service, db, identity_service, storage
from src.auth import resolve_telegram_auth
from src.jobs_api import ALLOWED_UPLOAD_MIME, MAX_RAW_FILE_BYTES
from src.rate_limit import enforce_rate_limit
from src.users_service import ensure_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/identity", tags=["identity"])

IDENTITY_RATE_LIMIT = 20
IDENTITY_RATE_WINDOW_SEC = 60 * 60


class IdentityResolveResponse(BaseModel):
    draft_id: str
    car_asset_id: str
    rim_asset_id: str
    vehicle: dict
    rim: identity_service.RimProposal
    pcd_display: str
    resolver: str


async def _read_identity_upload(upload: UploadFile, label: str) -> bytes:
    if upload.content_type not in ALLOWED_UPLOAD_MIME:
        raise HTTPException(
            status_code=415,
            detail=f"{label}: неподдерживаемый MIME {upload.content_type}",
        )
    data = await upload.read()
    if len(data) > MAX_RAW_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"{label}: файл больше {MAX_RAW_FILE_BYTES // 1024 // 1024} MB",
        )
    if len(data) == 0:
        raise HTTPException(status_code=400, detail=f"{label}: пустой файл")
    return data


@router.post("/resolve", response_model=IdentityResolveResponse)
async def resolve_identity(
    car_image: Annotated[UploadFile, File()],
    wheel_image: Annotated[UploadFile, File()],
    init_data: Annotated[str, Form()] = "",
    telegram_user_id: Annotated[int | None, Form()] = None,
    authorization: Annotated[str | None, Header()] = None,
):
    """Upload images and return render-oriented identity proposal.

    This endpoint deliberately does not create a render job, reserve credits,
    publish queue messages, or perform a detailed fitment check.
    """
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
        proposal = await identity_service.resolve_identity_mock(
            car_asset=car_asset,
            rim_asset=rim_asset,
        )
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
                    identity_proposal = $3::jsonb,
                    status = 'resolved',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $4::uuid
                  AND owner_user_id = $5
                """,
                car_asset.id,
                rim_asset.id,
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
        pcd_display=identity_service.pcd_display_value(
            bolt_count=proposal.rim.bolt_count,
            pcd_mm=proposal.rim.pcd_mm,
        ),
        resolver=proposal.resolver,
    )
