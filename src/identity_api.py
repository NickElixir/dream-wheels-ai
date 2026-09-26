"""Sprint 2 assisted identity API."""

import json
import logging
from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, File, Form, Header, HTTPException, Query, Response, UploadFile
from pydantic import BaseModel, ValidationError

from src import assets_service, db, identity_service, storage
from src.auth_principal import preflight_auth_credentials, require_auth_principal
from src.config import (
    RIM_URL_RESOLVER_ENABLED,
    RIM_URL_RESOLVER_MAX_BODY_BYTES,
    RIM_URL_RESOLVER_MAX_REDIRECTS,
    RIM_URL_RESOLVER_TIMEOUT_SEC,
    VEHICLE_IDENTITY_ENABLED,
    VEHICLE_IDENTITY_MAX_IMAGE_EDGE,
    VEHICLE_IDENTITY_MAX_PIXELS,
    VEHICLE_IDENTITY_MODEL,
    VEHICLE_IDENTITY_PROVIDER,
)
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
from src.rim_url_resolver import (
    FetchLimits,
    PublicHttpsPolicy,
    RimUrlError,
    fetch_public_rim_image,
    resolve_rim_product_url,
)
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
    confirmed_vehicle: identity_service.VehicleCandidate | None = None
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


def _wheel_refresh_error(
    status_code: int,
    error_code: str,
    *,
    retryable: bool = False,
) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"error_code": error_code, "retryable": retryable, "manual_fallback": True},
    )


async def _resolve_wheel_url_for_draft(
    *,
    draft_id: str,
    product_url: str,
    owner_user_id: int,
    selected_vehicle: str | None,
    vehicle_user_confirmed: bool,
) -> IdentityResolveResponse:
    if not RIM_URL_RESOLVER_ENABLED:
        raise _wheel_refresh_error(503, "rim_source_resolver_disabled", retryable=True)
    try:
        UUID(draft_id)
    except ValueError as exc:
        raise _wheel_refresh_error(404, "identity_draft_unavailable") from exc

    try:
        identity_service.RimIdentityProposal(product_url=product_url)
    except ValidationError as exc:
        raise _wheel_refresh_error(422, "invalid_rim_product_url") from exc

    pool = db.get_pool()
    async with pool.acquire() as conn:
        draft = await conn.fetchrow(
            """
            SELECT id::text AS draft_id,
                   car_asset_id::text AS car_asset_id,
                   rim_asset_id::text AS rim_asset_id,
                   identity_proposal
            FROM render_input_drafts
            WHERE id = $1::uuid
              AND owner_user_id = $2
              AND status = 'resolved'
              AND expires_at > CURRENT_TIMESTAMP
            """,
            draft_id,
            owner_user_id,
        )
    if not draft:
        raise _wheel_refresh_error(404, "identity_draft_unavailable")
    proposal = identity_service.parse_identity_proposal(draft["identity_proposal"])
    if proposal is None or not draft.get("car_asset_id") or not draft.get("rim_asset_id"):
        raise _wheel_refresh_error(409, "identity_draft_unavailable")
    expected_rim_revision = proposal.rim.revision
    confirmed_vehicle = proposal.confirmed_vehicle
    if selected_vehicle is not None:
        if not vehicle_user_confirmed:
            raise _wheel_refresh_error(422, "vehicle_confirmation_required")
        try:
            confirmed_vehicle = identity_service.VehicleCandidate.model_validate(
                json.loads(selected_vehicle)
            )
        except (json.JSONDecodeError, ValueError, TypeError) as exc:
            raise _wheel_refresh_error(422, "invalid_confirmed_vehicle") from exc
        if (
            proposal.confirmed_vehicle is not None
            and proposal.confirmed_vehicle != confirmed_vehicle
        ):
            raise _wheel_refresh_error(409, "identity_draft_vehicle_conflict")

    limits = FetchLimits(
        max_redirects=RIM_URL_RESOLVER_MAX_REDIRECTS,
        max_body_bytes=RIM_URL_RESOLVER_MAX_BODY_BYTES,
        total_timeout_seconds=RIM_URL_RESOLVER_TIMEOUT_SEC,
    )
    try:
        resolution = await resolve_rim_product_url(
            product_url,
            policy=PublicHttpsPolicy(),
            limits=limits,
        )
    except RimUrlError as exc:
        logger.warning("identity_wheel_source_failed reason_code=%s", exc.reason_code)
        status_code = 503 if exc.reason_code.endswith("fetch_failed") else 422
        raise _wheel_refresh_error(
            status_code,
            exc.reason_code,
            retryable=status_code == 503,
        ) from exc

    if not resolution.image_urls:
        raise _wheel_refresh_error(422, "rim_source_image_unavailable")

    resolved_image = None
    image_error = "rim_source_image_unavailable"
    for image_url in resolution.image_urls:
        try:
            fetched_image = await fetch_public_rim_image(
                image_url,
                policy=PublicHttpsPolicy(),
                limits=limits,
            )
            normalized_image = normalize_image(
                fetched_image.data,
                max_image_edge=VEHICLE_IDENTITY_MAX_IMAGE_EDGE,
                max_pixels=VEHICLE_IDENTITY_MAX_PIXELS,
            )
            resolved_image = normalized_image
            break
        except RimUrlError as exc:
            image_error = exc.reason_code
        except ImageNormalizationError as exc:
            image_error = exc.code
    if resolved_image is None:
        retryable = image_error.endswith(("fetch_failed", "redirect_failed"))
        raise _wheel_refresh_error(503 if retryable else 422, image_error, retryable=retryable)

    try:
        rim_asset = await assets_service.upload_render_asset(
            owner_user_id=owner_user_id,
            render_input_draft_id=draft_id,
            kind="rim_original",
            data=resolved_image.bytes,
            content_type=resolved_image.content_type,
        )
    except storage.StorageError as exc:
        logger.exception("identity_wheel_asset_upload_failed draft_id=%s", draft_id)
        raise _wheel_refresh_error(502, "rim_source_asset_upload_failed", retryable=True) from exc

    allowed_fields = {
        "brand",
        "model",
        "sku",
        "wheel_diameter_in",
        "wheel_width_j",
        "bolt_count",
        "pcd_mm",
        "center_bore_mm",
        "offset_et_mm",
    }
    field_candidates: dict[str, list[dict[str, object]]] = {}
    for candidate in resolution.candidates:
        if candidate.field not in allowed_fields:
            continue
        field_candidates.setdefault(candidate.field, []).append(
            {
                "value": candidate.value,
                "source": candidate.source,
                "confidence": candidate.confidence,
                "resolver": "rim_url_resolver_v1",
            }
        )
    confidence = max(
        (
            candidate.confidence
            for candidate in resolution.candidates
            if candidate.field in resolution.values
        ),
        default=0.0,
    )
    rim_values = {key: value for key, value in resolution.values.items() if key in allowed_fields}
    if not resolution.variants:
        variant_state = "none"
        selected_variant_sku = None
    elif resolution.selection_required:
        variant_state = "selection_required"
        selected_variant_sku = None
    else:
        variant_state = "selected"
        selected_variant_sku = resolution.selected_variant_sku
    replacement_rim = identity_service.RimIdentityProposal(
        status="resolved",
        product_url=resolution.requested_url,
        confidence=confidence,
        source="provider",
        revision=expected_rim_revision + 1,
        source_fingerprint=resolution.source_fingerprint,
        variant_state=variant_state,
        selected_variant_sku=selected_variant_sku,
        field_candidates=field_candidates,
        conflicts=[
            {
                "field": conflict.field,
                "candidates": [
                    {
                        "value": candidate.value,
                        "source": candidate.source,
                        "confidence": candidate.confidence,
                    }
                    for candidate in conflict.candidates
                ],
            }
            for conflict in resolution.conflicts
        ],
        **rim_values,
    )
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                current = await conn.fetchrow(
                    """
                    SELECT id::text AS draft_id,
                           car_asset_id::text AS car_asset_id,
                           rim_asset_id::text AS rim_asset_id,
                           identity_proposal
                    FROM render_input_drafts
                    WHERE id = $1::uuid
                      AND owner_user_id = $2
                      AND status = 'resolved'
                      AND expires_at > CURRENT_TIMESTAMP
                    FOR UPDATE
                    """,
                    draft_id,
                    owner_user_id,
                )
                if not current:
                    raise _wheel_refresh_error(404, "identity_draft_unavailable")
                current_proposal = identity_service.parse_identity_proposal(
                    current["identity_proposal"]
                )
                if current_proposal is None:
                    raise _wheel_refresh_error(409, "identity_draft_unavailable")
                if current_proposal.rim.revision != expected_rim_revision:
                    raise HTTPException(
                        status_code=409,
                        detail={
                            "error_code": "identity_draft_rim_revision_conflict",
                            "retryable": True,
                            "manual_fallback": True,
                            "current_draft": IdentityResolveResponse(
                                draft_id=draft_id,
                                car_asset_id=current["car_asset_id"],
                                rim_asset_id=current["rim_asset_id"],
                                vehicle=current_proposal.vehicle,
                                confirmed_vehicle=current_proposal.confirmed_vehicle,
                                rim=current_proposal.rim,
                                resolver=current_proposal.resolver,
                            ).model_dump(mode="json"),
                        },
                    )
                if (
                    selected_vehicle is not None
                    and current_proposal.confirmed_vehicle is not None
                    and current_proposal.confirmed_vehicle != confirmed_vehicle
                ):
                    raise _wheel_refresh_error(409, "identity_draft_vehicle_conflict")
                proposal_updates = {"rim": replacement_rim}
                if selected_vehicle is not None:
                    proposal_updates["confirmed_vehicle"] = confirmed_vehicle
                current_updated_proposal = current_proposal.model_copy(update=proposal_updates)
                await assets_service.insert_asset(conn, rim_asset)
                updated = await conn.fetchval(
                    """
                    UPDATE render_input_drafts
                    SET rim_asset_id = $1::uuid,
                        identity_proposal = $2::jsonb,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $3::uuid
                      AND owner_user_id = $4
                      AND status = 'resolved'
                      AND expires_at > CURRENT_TIMESTAMP
                    RETURNING id::text
                    """,
                    rim_asset.id,
                    current_updated_proposal.model_dump_json(),
                    draft_id,
                    owner_user_id,
                )
                if not updated:
                    raise _wheel_refresh_error(409, "identity_draft_unavailable")
    except Exception:
        try:
            await assets_service.delete_uploaded_asset(rim_asset)
        except storage.StorageError:
            logger.exception("identity_wheel_asset_cleanup_failed draft_id=%s", draft_id)
        raise

    return IdentityResolveResponse(
        draft_id=draft_id,
        car_asset_id=current["car_asset_id"],
        confirmed_vehicle=confirmed_vehicle,
        rim_asset_id=rim_asset.id,
        vehicle=current_proposal.vehicle,
        rim=replacement_rim,
        resolver=current_proposal.resolver,
    )


def _normalization_http_error(exc: ImageNormalizationError) -> HTTPException:
    status_code = 413 if exc.code in {"image_pixel_limit_exceeded", "image_too_large"} else 400
    return HTTPException(status_code=status_code, detail={"error_code": exc.code})


@router.get("/drafts/{draft_id}/assets/{asset_id}")
async def download_identity_rim_asset(
    draft_id: UUID,
    asset_id: UUID,
    init_data: Annotated[str, Query()] = "",
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> Response:
    """Read only the current rim asset of an owned, usable identity draft."""
    preflight_auth_credentials(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        auth_name="identity asset",
    )
    pool = db.get_pool()
    async with pool.acquire() as conn:
        principal = await require_auth_principal(
            conn,
            init_data=init_data,
            telegram_user_id=telegram_user_id,
            authorization=authorization,
            auth_name="identity asset",
        )
        row = await conn.fetchrow(
            """
            SELECT assets.bucket, assets.storage_key, assets.content_type
            FROM render_input_drafts AS draft
            JOIN assets ON assets.id = draft.rim_asset_id
                       AND assets.owner_user_id = draft.owner_user_id
                       AND assets.render_input_draft_id = draft.id
                       AND assets.kind = 'rim_original'
            WHERE draft.id = $1::uuid
              AND draft.owner_user_id = $2
              AND draft.status = 'resolved'
              AND draft.expires_at > CURRENT_TIMESTAMP
              AND draft.rim_asset_id = $3::uuid
            """,
            str(draft_id),
            principal.user_id,
            str(asset_id),
        )
    if not row:
        raise _wheel_refresh_error(404, "identity_draft_unavailable")
    try:
        content = await storage.download_bytes(bucket=row["bucket"], path=row["storage_key"])
    except storage.StorageError as exc:
        logger.exception(
            "identity_asset_download_failed draft_id=%s asset_id=%s", draft_id, asset_id
        )
        raise _wheel_refresh_error(502, "rim_source_image_fetch_failed", retryable=True) from exc
    return Response(
        content=content,
        media_type=row["content_type"] or "application/octet-stream",
        headers={"Cache-Control": "private, no-store"},
    )


@router.post("/resolve", response_model=IdentityResolveResponse)
async def resolve_identity(
    car_image: Annotated[UploadFile | None, File()] = None,
    wheel_image: Annotated[UploadFile | None, File()] = None,
    rim_product_url: Annotated[str | None, Form()] = None,
    draft_id: Annotated[str | None, Form()] = None,
    vehicle: Annotated[str | None, Form()] = None,
    vehicle_user_confirmed: Annotated[bool, Form()] = False,
    init_data: Annotated[str, Form()] = "",
    telegram_user_id: Annotated[int | None, Form()] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> IdentityResolveResponse:
    """Persist source assets and return a non-canonical vehicle proposal."""
    if draft_id is None and (car_image is None or wheel_image is None):
        raise HTTPException(
            status_code=422,
            detail={"error_code": "car_and_wheel_images_required"},
        )
    if draft_id is not None and (
        car_image is not None or wheel_image is not None or not rim_product_url
    ):
        raise _wheel_refresh_error(422, "invalid_identity_resolve_mode")

    preflight_auth_credentials(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        auth_name="identity resolve",
    )
    pool = db.get_pool()
    async with pool.acquire() as conn:
        principal = await require_auth_principal(
            conn,
            init_data=init_data,
            telegram_user_id=telegram_user_id,
            authorization=authorization,
            auth_name="identity resolve",
        )
    owner_user_id = principal.user_id
    await enforce_rate_limit(
        scope="identity_resolve",
        identifier=owner_user_id,
        limit=IDENTITY_RATE_LIMIT,
        window_sec=IDENTITY_RATE_WINDOW_SEC,
    )

    if draft_id is not None:
        return await _resolve_wheel_url_for_draft(
            draft_id=draft_id,
            product_url=rim_product_url,
            owner_user_id=owner_user_id,
            selected_vehicle=vehicle,
            vehicle_user_confirmed=vehicle_user_confirmed,
        )
    try:
        source_rim = identity_service.RimIdentityProposal(product_url=rim_product_url)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail="Invalid rim product URL") from exc

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

    async with pool.acquire() as conn:
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

    logger.info(
        "🔥 Vehicle identity resolve started draft_id=%s user_id=%s enabled=%s provider=%s model=%s source_url=%s",
        draft_id,
        owner_user_id,
        VEHICLE_IDENTITY_ENABLED,
        VEHICLE_IDENTITY_PROVIDER,
        VEHICLE_IDENTITY_MODEL,
        bool(source_rim.product_url),
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
            "❌ Vehicle identity provider failed draft_id=%s user_id=%s enabled=%s provider=%s model=%s error_code=%s retryable=%s",
            draft_id,
            owner_user_id,
            VEHICLE_IDENTITY_ENABLED,
            VEHICLE_IDENTITY_PROVIDER,
            VEHICLE_IDENTITY_MODEL,
            exc.error_code,
            exc.retryable,
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
        failed_proposal.rim = source_rim
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
    proposal.rim = source_rim
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
        "✅ Identity proposal resolved draft_id=%s user_id=%s provider=%s model=%s status=%s latency_ms=%s source_url=%s",
        draft_id,
        owner_user_id,
        resolution.metadata.provider,
        resolution.metadata.model,
        resolution.status,
        resolution.metadata.latency_ms,
        bool(source_rim.product_url),
    )
    return IdentityResolveResponse(
        draft_id=draft_id,
        car_asset_id=car_asset.id,
        rim_asset_id=rim_asset.id,
        vehicle=proposal.vehicle,
        rim=proposal.rim,
        resolver=proposal.resolver,
    )
