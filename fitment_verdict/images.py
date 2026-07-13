"""Image intake helpers for the fitment pipeline."""

from __future__ import annotations

import hashlib
import logging
from io import BytesIO
from pathlib import Path

from fitment_verdict.config import FitmentConfig

logger = logging.getLogger(__name__)


def normalize_image_bytes(raw: bytes, config: FitmentConfig) -> tuple[bytes, dict]:
    from PIL import Image, ImageOps

    img = Image.open(BytesIO(raw))
    img = ImageOps.exif_transpose(img)
    img = img.convert("RGB")
    long_side = max(img.size)
    if long_side > config.cv_long_side_px:
        scale = config.cv_long_side_px / long_side
        new_size = (max(1, int(img.size[0] * scale)), max(1, int(img.size[1] * scale)))
        img = img.resize(new_size, Image.Resampling.LANCZOS)
    out = BytesIO()
    img.save(out, format="JPEG", quality=90, optimize=True)
    normalized = out.getvalue()
    meta = {
        "sha256": hashlib.sha256(normalized).hexdigest(),
        "width": img.size[0],
        "height": img.size[1],
        "format": "jpeg",
    }
    return normalized, meta


def load_normalized_image(path: str | Path, config: FitmentConfig) -> tuple[bytes, dict]:
    raw = Path(path).read_bytes()
    return normalize_image_bytes(raw, config)
