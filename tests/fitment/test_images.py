from __future__ import annotations

from io import BytesIO

import pytest
from PIL import Image

from src.fitment.images import FitmentImageError, normalize_fitment_image


def _png(width: int, height: int) -> bytes:
    output = BytesIO()
    Image.new("RGBA", (width, height), (255, 0, 0, 128)).save(output, format="PNG")
    return output.getvalue()


def test_normalize_image_removes_alpha_and_limits_long_side() -> None:
    normalized, metadata = normalize_fitment_image(
        _png(2000, 1000),
        content_type="image/png",
    )

    with Image.open(BytesIO(normalized)) as image:
        assert image.mode == "RGB"
        assert image.format == "JPEG"
        assert max(image.size) == 1536
    assert metadata["width"] == 1536
    assert metadata["height"] == 768
    assert len(metadata["sha256"]) == 64


@pytest.mark.parametrize(
    ("payload", "content_type"),
    [
        (b"", "image/jpeg"),
        (b"not-an-image", "image/jpeg"),
        (_png(10, 10), "application/octet-stream"),
    ],
)
def test_normalize_image_rejects_invalid_input(
    payload: bytes,
    content_type: str,
) -> None:
    with pytest.raises(FitmentImageError):
        normalize_fitment_image(payload, content_type=content_type)
