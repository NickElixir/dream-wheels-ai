"""Безопасная нормализация изображений preliminary fitment stage."""

from __future__ import annotations

import base64
import hashlib
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from src.fitment.config import (
    FITMENT_IMAGE_LONG_SIDE_PX,
    FITMENT_IMAGE_MAX_BYTES,
    FITMENT_IMAGE_MAX_PIXELS,
)

ALLOWED_IMAGE_MIME = {"image/jpeg", "image/jpg", "image/png", "image/webp"}


class FitmentImageError(ValueError):
    pass


def normalize_fitment_image(
    raw: bytes,
    *,
    content_type: str | None,
) -> tuple[bytes, dict[str, str | int]]:
    mime = (content_type or "").split(";", 1)[0].strip().lower()
    if mime not in ALLOWED_IMAGE_MIME:
        raise FitmentImageError("Unsupported image content type")
    if not raw:
        raise FitmentImageError("Image is empty")
    if len(raw) > FITMENT_IMAGE_MAX_BYTES:
        raise FitmentImageError("Image exceeds size limit")

    try:
        with Image.open(BytesIO(raw)) as opened:
            opened.verify()
        with Image.open(BytesIO(raw)) as opened:
            if opened.width * opened.height > FITMENT_IMAGE_MAX_PIXELS:
                raise FitmentImageError("Image dimensions exceed pixel limit")
            image = ImageOps.exif_transpose(opened).convert("RGB")
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError, ValueError) as exc:
        if isinstance(exc, FitmentImageError):
            raise
        raise FitmentImageError("Invalid image payload") from exc

    long_side = max(image.size)
    if long_side > FITMENT_IMAGE_LONG_SIDE_PX:
        scale = FITMENT_IMAGE_LONG_SIDE_PX / long_side
        image = image.resize(
            (
                max(1, round(image.width * scale)),
                max(1, round(image.height * scale)),
            ),
            Image.Resampling.LANCZOS,
        )

    output = BytesIO()
    image.save(output, format="JPEG", quality=90, optimize=True)
    normalized = output.getvalue()
    return normalized, {
        "sha256": hashlib.sha256(normalized).hexdigest(),
        "width": image.width,
        "height": image.height,
        "format": "jpeg",
    }


def image_as_base64(image_bytes: bytes) -> str:
    return base64.b64encode(image_bytes).decode("ascii")
