"""Image validation and normalization for external vision providers."""

from __future__ import annotations

import hashlib
import io
import warnings
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError


@dataclass(frozen=True, slots=True)
class NormalizedImage:
    bytes: bytes
    content_type: str
    width: int
    height: int
    sha256: str
    original_size_bytes: int
    normalized_size_bytes: int


class ImageNormalizationError(ValueError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def normalize_image(
    data: bytes,
    *,
    max_image_edge: int,
    max_pixels: int,
    min_image_edge: int = 128,
) -> NormalizedImage:
    """Return a metadata-free RGB JPEG without changing the original asset."""
    if not data:
        raise ImageNormalizationError("image_decode_failed")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as verification_image:
                verification_image.verify()
            with Image.open(io.BytesIO(data)) as source_image:
                source_image.load()
                image = ImageOps.exif_transpose(source_image)
                width, height = image.size
                if width * height > max_pixels:
                    raise ImageNormalizationError("image_pixel_limit_exceeded")
                if min(width, height) < min_image_edge:
                    raise ImageNormalizationError("image_too_small")
                if max(width, height) > max_image_edge:
                    image.thumbnail((max_image_edge, max_image_edge), Image.Resampling.LANCZOS)
                normalized = image.convert("RGB")
    except ImageNormalizationError:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise ImageNormalizationError("image_pixel_limit_exceeded") from None
    except (OSError, SyntaxError, UnidentifiedImageError):
        raise ImageNormalizationError("image_decode_failed") from None

    output = io.BytesIO()
    normalized.save(output, format="JPEG", quality=88, optimize=True)
    normalized_bytes = output.getvalue()
    normalized_width, normalized_height = normalized.size
    if not normalized_bytes:
        raise ImageNormalizationError("image_decode_failed")
    return NormalizedImage(
        bytes=normalized_bytes,
        content_type="image/jpeg",
        width=normalized_width,
        height=normalized_height,
        sha256=hashlib.sha256(normalized_bytes).hexdigest(),
        original_size_bytes=len(data),
        normalized_size_bytes=len(normalized_bytes),
    )
