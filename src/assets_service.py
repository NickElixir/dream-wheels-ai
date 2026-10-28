"""Durable render asset persistence helpers."""

import asyncio
import hashlib
import logging
from dataclasses import dataclass
from io import BytesIO
from typing import Literal
from uuid import uuid4

import asyncpg
import httpx
from PIL import Image, ImageOps

from src import storage

logger = logging.getLogger(__name__)

AssetKind = Literal["car_original", "car_display", "rim_original", "result"]

RAW_ASSET_KINDS: set[AssetKind] = {"car_original", "car_display", "rim_original"}
ALL_ASSET_KINDS: set[AssetKind] = {"car_original", "car_display", "rim_original", "result"}


def _image_dimensions(data: bytes, content_type: str) -> tuple[int | None, int | None]:
    """Read dimensions for telemetry without changing the uploaded bytes."""
    if not content_type.lower().startswith("image/"):
        return None, None
    try:
        with Image.open(BytesIO(data)) as image:
            return image.width, image.height
    except (Image.DecompressionBombError, OSError, ValueError):
        return None, None


@dataclass(frozen=True, slots=True)
class AssetUpload:
    id: str
    owner_user_id: int
    job_id: str | None
    kind: AssetKind
    bucket: str
    storage_key: str
    content_type: str
    size_bytes: int
    sha256: str
    render_input_draft_id: str | None = None
    public_url: str | None = None
    width: int | None = None
    height: int | None = None


def _ext_for_content_type(content_type: str) -> str:
    return {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }.get(content_type.split(";")[0].strip().lower(), "bin")


def build_storage_key(
    *,
    owner_user_id: int,
    kind: AssetKind,
    asset_id: str,
    content_type: str,
    job_id: str | None = None,
    render_input_draft_id: str | None = None,
) -> str:
    ext = _ext_for_content_type(content_type)
    if job_id:
        return f"users/{owner_user_id}/jobs/{job_id}/{kind}/{asset_id}.{ext}"
    if render_input_draft_id:
        return f"users/{owner_user_id}/drafts/{render_input_draft_id}/{kind}/{asset_id}.{ext}"
    raise ValueError("job_id or render_input_draft_id is required")


async def upload_render_asset(
    *,
    owner_user_id: int,
    kind: AssetKind,
    data: bytes,
    content_type: str,
    job_id: str | None = None,
    render_input_draft_id: str | None = None,
) -> AssetUpload:
    if kind not in ALL_ASSET_KINDS:
        raise ValueError(f"Unsupported asset kind: {kind}")
    if not job_id and not render_input_draft_id:
        raise ValueError("job_id or render_input_draft_id is required")

    asset_id = str(uuid4())
    bucket = storage.RAW_BUCKET if kind in RAW_ASSET_KINDS else storage.RESULTS_BUCKET
    storage_key = build_storage_key(
        owner_user_id=owner_user_id,
        kind=kind,
        asset_id=asset_id,
        content_type=content_type,
        job_id=job_id,
        render_input_draft_id=render_input_draft_id,
    )
    width, height = _image_dimensions(data, content_type)
    logger.info(
        "Pre-upload asset: target_bucket=%s content_type=%s size_bytes=%d width=%s height=%s",
        bucket,
        content_type,
        len(data),
        width,
        height,
    )
    try:
        await storage.upload_bytes(
            bucket=bucket, path=storage_key, data=data, content_type=content_type
        )
    except (storage.StorageError, httpx.HTTPError):
        if kind == "car_display":
            # A timed-out upload may have created the uniquely named object.
            try:
                await storage.delete_object(bucket=bucket, path=storage_key)
            except (storage.StorageError, httpx.HTTPError):
                logger.warning(
                    "car_display_upload_cleanup_failed asset_id=%s user_id=%s",
                    asset_id,
                    owner_user_id,
                )
        raise

    public_url = (
        storage.public_url(bucket, storage_key) if bucket == storage.RESULTS_BUCKET else None
    )
    return AssetUpload(
        id=asset_id,
        owner_user_id=owner_user_id,
        job_id=job_id,
        kind=kind,
        bucket=bucket,
        storage_key=storage_key,
        content_type=content_type,
        size_bytes=len(data),
        sha256=hashlib.sha256(data).hexdigest(),
        render_input_draft_id=render_input_draft_id,
        public_url=public_url,
        width=width,
        height=height,
    )


async def insert_asset(conn: asyncpg.Connection, asset: AssetUpload) -> None:
    await conn.execute(
        """
        INSERT INTO assets (
            id, owner_user_id, job_id, kind, bucket, storage_key,
            content_type, size_bytes, sha256, render_input_draft_id, width, height
        )
        VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10::uuid, $11, $12)
        ON CONFLICT (id) DO NOTHING
        """,
        asset.id,
        asset.owner_user_id,
        asset.job_id,
        asset.kind,
        asset.bucket,
        asset.storage_key,
        asset.content_type,
        asset.size_bytes,
        asset.sha256,
        asset.render_input_draft_id,
        asset.width,
        asset.height,
    )


async def delete_uploaded_asset(asset: AssetUpload) -> None:
    await storage.delete_object(bucket=asset.bucket, path=asset.storage_key)


def asset_download_path(job_id: str, kind: AssetKind) -> str:
    return f"/jobs/{job_id}/assets/{kind}/download"


CAR_DISPLAY_MAX_EDGE = 1600
CAR_DISPLAY_WEBP_QUALITY = 80


def create_car_display(data: bytes) -> bytes:
    """Presentation only: transpose, downsize, strip metadata, preserve original bytes."""
    with Image.open(BytesIO(data)) as source:
        image = ImageOps.exif_transpose(source)
        image.thumbnail((CAR_DISPLAY_MAX_EDGE, CAR_DISPLAY_MAX_EDGE), Image.Resampling.LANCZOS)
        mode = "RGBA" if "A" in image.getbands() or "transparency" in image.info else "RGB"
        clean = Image.new(mode, image.size)
        clean.paste(image.convert(mode))
        output = BytesIO()
        clean.save(output, format="WEBP", quality=CAR_DISPLAY_WEBP_QUALITY)
        return output.getvalue()


async def upload_car_display(*, original: AssetUpload, data: bytes) -> AssetUpload | None:
    """A failed presentation optimization must not block canonical upload."""
    try:
        display = await asyncio.to_thread(create_car_display, data)
        return await upload_render_asset(
            owner_user_id=original.owner_user_id,
            job_id=original.job_id,
            render_input_draft_id=original.render_input_draft_id,
            kind="car_display",
            data=display,
            content_type="image/webp",
        )
    except (
        OSError,
        ValueError,
        Image.DecompressionBombError,
        storage.StorageError,
        httpx.HTTPError,
    ):
        logger.warning(
            "car_display_generation_failed job_id=%s draft_id=%s user_id=%s",
            original.job_id,
            original.render_input_draft_id,
            original.owner_user_id,
        )
        return None


async def insert_optional_car_display(conn: asyncpg.Connection, asset: AssetUpload | None) -> None:
    if asset is None:
        return
    try:
        # Savepoint keeps optional derivative DB failures out of the canonical transaction.
        async with conn.transaction():
            await insert_asset(conn, asset)
    except asyncpg.PostgresError:
        logger.warning(
            "car_display_persist_failed asset_id=%s user_id=%s", asset.id, asset.owner_user_id
        )
        try:
            await delete_uploaded_asset(asset)
        except (storage.StorageError, httpx.HTTPError):
            logger.warning(
                "car_display_cleanup_failed asset_id=%s user_id=%s", asset.id, asset.owner_user_id
            )
