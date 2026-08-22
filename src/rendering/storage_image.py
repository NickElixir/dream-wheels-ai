"""Prepare provider output for the configured durable storage limit."""

from dataclasses import replace
from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

from src.rendering.base import GeneratedImage, ImageProviderError


def prepare_image_for_storage(image: GeneratedImage, *, max_bytes: int) -> GeneratedImage:
    if max_bytes <= 0:
        raise ValueError("Storage image limit must be positive")
    if len(image.data) <= max_bytes:
        return image

    try:
        with Image.open(BytesIO(image.data)) as opened:
            opened.load()
            prepared = ImageOps.exif_transpose(opened)
            if prepared.mode in {"RGBA", "LA"} or (
                prepared.mode == "P" and "transparency" in prepared.info
            ):
                rgba = prepared.convert("RGBA")
                background = Image.new("RGBA", rgba.size, "white")
                background.alpha_composite(rgba)
                prepared = background.convert("RGB")
            else:
                prepared = prepared.convert("RGB")
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError) as exc:
        raise ImageProviderError("Provider output is not a valid storage image") from exc

    for _ in range(8):
        for quality in (95, 90, 85, 80, 75):
            buffer = BytesIO()
            prepared.save(buffer, format="JPEG", quality=quality, optimize=True)
            data = buffer.getvalue()
            if len(data) <= max_bytes:
                return replace(image, data=data, content_type="image/jpeg")
        next_size = (
            max(256, round(prepared.width * 0.85)),
            max(256, round(prepared.height * 0.85)),
        )
        if next_size == prepared.size:
            break
        prepared = prepared.resize(next_size, Image.Resampling.LANCZOS)
    raise ImageProviderError("Provider output cannot fit the configured storage image limit")
