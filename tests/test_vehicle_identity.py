import json
from io import BytesIO

import pytest
from PIL import Image
from pydantic import ValidationError

from src.identity.providers.openai import OpenAIVehicleIdentityResolver
from src.identity.schemas import (
    AbstentionReason,
    ResolutionStatus,
    VehicleIdentityResolution,
    VehicleResolutionMetadata,
)
from src.vision.image_normalization import ImageNormalizationError, normalize_image


def _png_bytes(*, size: tuple[int, int] = (320, 240), mode: str = "RGB") -> bytes:
    color = (12, 24, 36, 255) if mode == "RGBA" else (12, 24, 36)
    image = Image.new(mode, size, color=color)
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


@pytest.mark.parametrize("format_name", ["JPEG", "PNG", "WEBP"])
def test_normalize_image_accepts_supported_image_formats(format_name: str) -> None:
    image = Image.new("RGB", (320, 240), color=(12, 24, 36))
    output = BytesIO()
    image.save(output, format=format_name)

    normalized = normalize_image(output.getvalue(), max_image_edge=500, max_pixels=1_000_000)

    assert normalized.width == 320
    assert normalized.height == 240


def test_normalize_image_converts_rgba_to_metadata_free_jpeg() -> None:
    normalized = normalize_image(_png_bytes(mode="RGBA"), max_image_edge=200, max_pixels=1_000_000)

    assert normalized.content_type == "image/jpeg"
    assert normalized.width == 200
    assert normalized.height == 150
    assert len(normalized.sha256) == 64
    with Image.open(BytesIO(normalized.bytes)) as image:
        assert image.mode == "RGB"


@pytest.mark.parametrize(
    ("payload", "code"),
    [(b"", "image_decode_failed"), (b"not-an-image", "image_decode_failed")],
)
def test_normalize_image_rejects_invalid_payload(payload: bytes, code: str) -> None:
    with pytest.raises(ImageNormalizationError, match=code):
        normalize_image(payload, max_image_edge=500, max_pixels=1_000_000)


def test_normalize_image_rejects_small_and_pixel_limited_images() -> None:
    with pytest.raises(ImageNormalizationError, match="image_too_small"):
        normalize_image(_png_bytes(size=(100, 100)), max_image_edge=500, max_pixels=1_000_000)
    with pytest.raises(ImageNormalizationError, match="image_pixel_limit_exceeded"):
        normalize_image(_png_bytes(size=(400, 400)), max_image_edge=500, max_pixels=100_000)


def test_normalize_image_applies_exif_rotation_and_bomb_protection(monkeypatch) -> None:
    image = Image.new("RGB", (320, 240), color=(12, 24, 36))
    exif = Image.Exif()
    exif[274] = 6
    output = BytesIO()
    image.save(output, format="JPEG", exif=exif)

    normalized = normalize_image(output.getvalue(), max_image_edge=500, max_pixels=1_000_000)
    assert (normalized.width, normalized.height) == (240, 320)

    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 10)
    with pytest.raises(ImageNormalizationError, match="image_pixel_limit_exceeded"):
        normalize_image(_png_bytes(), max_image_edge=500, max_pixels=1_000_000)


def test_unknown_cannot_contain_a_primary_or_extra_fields() -> None:
    metadata = VehicleResolutionMetadata(
        provider="test",
        model="test",
        prompt_version="test",
        resolver_version="test",
        normalized_input_sha256="0" * 64,
        captured_at="2026-01-01T00:00:00Z",
    )
    with pytest.raises(ValidationError):
        VehicleIdentityResolution.model_validate(
            {
                "status": "unknown",
                "primary": {"make": "Lexus", "model": "RX", "confidence": 0.9},
                "abstention_reason": "model_uncertain",
                "metadata": metadata.model_dump(),
            }
        )
    with pytest.raises(ValidationError):
        VehicleIdentityResolution.model_validate(
            {
                "status": "unknown",
                "abstention_reason": "model_uncertain",
                "metadata": metadata.model_dump(),
                "unexpected": True,
            }
        )


def test_openai_adapter_validates_structured_response() -> None:
    image = normalize_image(_png_bytes(), max_image_edge=500, max_pixels=1_000_000)
    resolver = OpenAIVehicleIdentityResolver(
        api_key="test", model="gpt-4o-mini", timeout_sec=1, max_retries=0
    )
    body = json.dumps(
        {
            "id": "resp_123",
            "usage": {
                "input_tokens": 1_000,
                "input_tokens_details": {"cached_tokens": 200},
                "output_tokens": 100,
            },
            "output": [
                {
                    "content": [
                        {
                            "type": "output_text",
                            "text": json.dumps(
                                {
                                    "status": "unknown",
                                    "alternatives": [],
                                    "abstention_reason": "model_uncertain",
                                }
                            ),
                        }
                    ]
                }
            ],
        }
    )

    result = resolver._parse_response(
        body, image=image, provider_request_id="req_123", latency_ms=5
    )

    assert result.status is ResolutionStatus.unknown
    assert result.abstention_reason is AbstentionReason.model_uncertain
    assert result.metadata.provider_request_id == "req_123"
    assert result.metadata.estimated_cost == pytest.approx(0.000195)
