"""Owner-created immutable publications, accessible only through opaque URLs."""

import asyncio
import hashlib
import html
import json
import logging
import re
import secrets
from io import BytesIO
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Header, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse, Response
from PIL import Image, ImageOps

from src import db, storage
from src.auth_principal import preflight_auth_credentials, require_auth_principal
from src.config import PUBLIC_BASE_URL, WEBAPP_URL
from src.rate_limit import enforce_rate_limit
from src.share_api import _fetch_original_bytes, _fetch_result_bytes

logger = logging.getLogger(__name__)
router = APIRouter(tags=["publications"])
ID_RE = re.compile(r"^[A-Za-z0-9_-]{32}$")
TEMPLATE = Path(__file__).parent / "templates" / "shared_result.html"


def publication_snapshot(row: dict) -> dict:
    """Expose only explicit vehicle/wheel facts, never provenance or account data."""
    snapshot = row.get("render_input_snapshot") or {}
    if isinstance(snapshot, str):
        snapshot = json.loads(snapshot)
    vehicle = snapshot.get("vehicle") or {}
    rim = snapshot.get("rim") or {}
    car = {
        key: row.get("vehicle_" + key) or vehicle.get(key)
        for key in ("make", "model", "year", "generation", "modification")
    }
    wheel = {
        key: row.get("rim_" + key) if row.get("rim_" + key) is not None else rim.get(key)
        for key in (
            "brand",
            "model",
            "sku",
            "wheel_diameter_in",
            "wheel_width_j",
            "bolt_count",
            "pcd_mm",
            "center_bore_mm",
            "offset_et_mm",
        )
    }
    return json.loads(json.dumps({"vehicle": car, "rim": wheel}, default=str))


def snapshot_fingerprint(snapshot: dict) -> str:
    return hashlib.sha256(
        json.dumps(snapshot, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()


def _public_jpeg(data: bytes) -> bytes:
    # Re-encoding strips EXIF and other source metadata from the public copy.
    with Image.open(BytesIO(data)) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        image.thumbnail((2400, 2400))
        output = BytesIO()
        image.save(output, format="JPEG", quality=92)
        return output.getvalue()


@router.post("/jobs/{job_id}/publications")
async def create_publication(
    job_id: UUID,
    init_data: Annotated[str | None, Query()] = None,
    telegram_user_id: Annotated[int | None, Query()] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> JSONResponse:
    from src.jobs_api import _fetch_fitment_job_row

    preflight_auth_credentials(
        init_data=init_data,
        telegram_user_id=telegram_user_id,
        authorization=authorization,
        auth_name="publish result",
    )
    async with db.get_pool().acquire() as conn:
        auth = await require_auth_principal(
            conn,
            init_data=init_data,
            telegram_user_id=telegram_user_id,
            authorization=authorization,
            auth_name="publish result",
        )
        await enforce_rate_limit("publications", auth.user_id, limit=20, window_sec=60)
        async with conn.transaction():
            # Serialize a job's publications and edits across concurrent requests.
            row = await _fetch_fitment_job_row(
                conn, job_id=str(job_id), user_id=auth.user_id, for_update=True
            )
            if not row:
                raise HTTPException(404, "Job not found")
            if row["status"] != "completed" or not row["output_image_url"]:
                raise HTTPException(409, "Result not ready")
            snapshot = publication_snapshot(row)
            fingerprint = snapshot_fingerprint(snapshot)
            ident = await conn.fetchval(
                "SELECT id FROM shared_result_publications WHERE owner_user_id=$1 AND job_id=$2::uuid AND fingerprint=$3",
                auth.user_id,
                str(job_id),
                fingerprint,
            )
            if not ident:
                source = await conn.fetchrow(
                    """SELECT jobs.car_image_url, display.storage_key AS display_path
                    FROM jobs LEFT JOIN assets display ON display.job_id=jobs.id
                      AND display.owner_user_id=jobs.user_id AND display.kind='car_display'
                      AND display.bucket=$3
                    WHERE jobs.id=$1::uuid AND jobs.user_id=$2""",
                    str(job_id),
                    auth.user_id,
                    storage.RAW_BUCKET,
                )
                try:
                    original = await _fetch_original_bytes(
                        source["display_path"] or source["car_image_url"]
                    )
                    if not original:
                        raise HTTPException(502, "Original unavailable")
                    result = await _fetch_result_bytes(row["output_image_url"])
                    original, result = await asyncio.gather(
                        asyncio.to_thread(_public_jpeg, original),
                        asyncio.to_thread(_public_jpeg, result),
                    )
                    ident = secrets.token_urlsafe(24)
                    original_path = f"publications/{ident}/original.jpg"
                    result_path = f"publications/{ident}/result.jpg"
                    for path, data in ((original_path, original), (result_path, result)):
                        await storage.upload_bytes(
                            bucket=storage.RAW_BUCKET,
                            path=path,
                            data=data,
                            content_type="image/jpeg",
                        )
                    await conn.execute(
                        """INSERT INTO shared_result_publications
                        (id,owner_user_id,job_id,fingerprint,snapshot,original_path,result_path)
                        VALUES ($1,$2,$3::uuid,$4,$5::jsonb,$6,$7)""",
                        ident,
                        auth.user_id,
                        str(job_id),
                        fingerprint,
                        json.dumps(snapshot),
                        original_path,
                        result_path,
                    )
                except (storage.StorageError, OSError, ValueError) as exc:
                    logger.exception(
                        "Publication failed job_id=%s user_id=%s", job_id, auth.user_id
                    )
                    raise HTTPException(502, "Publication unavailable") from exc
    return JSONResponse(
        {"url": f"{PUBLIC_BASE_URL}/p/{ident}"}, headers={"Cache-Control": "private, no-store"}
    )


async def _publication(ident: str) -> dict:
    if not ID_RE.fullmatch(ident):
        raise HTTPException(404, "Publication not found")
    async with db.get_pool().acquire() as conn:
        row = await conn.fetchrow("SELECT * FROM shared_result_publications WHERE id=$1", ident)
    if not row:
        raise HTTPException(404, "Publication not found")
    return dict(row)


def _labels(snapshot: dict) -> tuple[str, str]:
    car = " ".join(str(v) for v in snapshot["vehicle"].values() if v)
    rim = snapshot["rim"]
    wheel = " ".join(str(rim.get(k)) for k in ("brand", "model") if rim.get(k))
    specs = []
    for key, label in (
        ("wheel_diameter_in", "″"),
        ("wheel_width_j", "J"),
        ("offset_et_mm", " ET"),
        ("center_bore_mm", " DIA"),
    ):
        if rim.get(key) is not None:
            specs.append(str(rim[key]).replace(".", ",") + label)
    if rim.get("bolt_count") and rim.get("pcd_mm"):
        specs.append(f"{rim['bolt_count']}×{rim['pcd_mm']}".replace(".", ","))
    return car or "Автомобиль не указан", " / ".join(
        filter(None, [wheel, *specs])
    ) or "Диск не указан"


@router.get("/p/{ident}", response_class=HTMLResponse)
async def publication_page(ident: str) -> HTMLResponse:
    row = await _publication(ident)
    snapshot = row["snapshot"]
    if isinstance(snapshot, str):
        snapshot = json.loads(snapshot)
    car, wheel = _labels(snapshot)
    page_url = f"{PUBLIC_BASE_URL}/p/{ident}"
    data = {
        "car": car,
        "wheel": wheel,
        "beforeUrl": f"/p/{ident}/original.jpg",
        "afterUrl": f"/p/{ident}/result.jpg",
        "downloadUrl": f"/p/{ident}/download",
        "downloadFilename": "dream-wheels-result.jpg",
        "isAuthenticated": False,
        "loginUrl": f"{WEBAPP_URL}/app/",
        "accountUrl": f"{WEBAPP_URL}/app/",
    }
    source = TEMPLATE.read_text()
    source = source.replace(
        "__PUBLICATION_DATA__", json.dumps(data, ensure_ascii=False).replace("<", "\\u003c")
    )
    source = source.replace("__PAGE_URL__", html.escape(page_url, quote=True))
    return HTMLResponse(
        source,
        headers={
            "X-Robots-Tag": "noindex, nofollow",
            "Referrer-Policy": "no-referrer",
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/p/{ident}/{asset}")
async def publication_asset(ident: str, asset: str) -> Response:
    if asset not in {"original.jpg", "result.jpg", "download"}:
        raise HTTPException(404, "Asset not found")
    row = await _publication(ident)
    path = row["original_path"] if asset == "original.jpg" else row["result_path"]
    try:
        data = await storage.download_bytes(bucket=storage.RAW_BUCKET, path=path)
    except storage.StorageError as exc:
        logger.exception("Publication image unavailable publication_id=%s", ident)
        raise HTTPException(502, "Image unavailable") from exc
    headers = {"Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff"}
    if asset == "download":
        headers["Content-Disposition"] = 'attachment; filename="dream-wheels-result.jpg"'
    return Response(data, media_type="image/jpeg", headers=headers)
