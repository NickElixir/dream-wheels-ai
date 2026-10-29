import asyncio
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
                                    "primary": None,
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


def _aitunnel_resolver():
    from src.identity.providers.aitunnel import AITunnelVehicleIdentityResolver

    return AITunnelVehicleIdentityResolver(
        api_key="test-aitunnel", model="qwen3.8-flash", timeout_sec=1, max_retries=0
    )


def test_aitunnel_payload_uses_chat_vision_and_strict_schema() -> None:
    resolver = _aitunnel_resolver()
    image = normalize_image(_png_bytes(), max_image_edge=500, max_pixels=1_000_000)
    payload = resolver._payload(image)
    assert resolver.endpoint == "https://api.aitunnel.ru/v1/chat/completions"
    assert payload["model"] == "qwen3.8-flash"
    assert "input" not in payload
    assert payload["response_format"]["json_schema"]["strict"] is True
    assert payload["messages"][1]["content"][1]["image_url"]["url"].startswith(
        "data:image/jpeg;base64,"
    )


def test_aitunnel_parses_valid_identity_without_mislabeling_cost() -> None:
    resolver = _aitunnel_resolver()
    image = normalize_image(_png_bytes(), max_image_edge=500, max_pixels=1_000_000)
    body = json.dumps(
        {
            "id": "chat-123",
            "choices": [
                {
                    "finish_reason": "stop",
                    "message": {
                        "content": json.dumps(
                            {
                                "status": "resolved",
                                "primary": {
                                    "make": "BMW",
                                    "model": "5 Series",
                                    "year": 2020,
                                    "year_start": None,
                                    "year_end": None,
                                    "source": "vlm_visual",
                                    "confidence": 0.9,
                                },
                                "alternatives": [],
                                "abstention_reason": None,
                            }
                        )
                    },
                }
            ],
            "usage": {"prompt_tokens": 1000, "completion_tokens": 100},
        }
    )
    result = resolver._parse_response(body, image=image, provider_request_id=None, latency_ms=5)
    assert result.primary.make == "BMW"
    assert result.metadata.provider == "aitunnel"
    assert result.metadata.model == "qwen3.8-flash"
    assert result.metadata.provider_request_id == "chat-123"
    assert result.metadata.estimated_cost is None


@pytest.mark.parametrize(
    "response",
    [
        {"choices": []},
        {"choices": [{"finish_reason": "length", "message": {"content": "{}"}}]},
        {"choices": [{"finish_reason": "stop", "message": {"content": "not JSON"}}]},
        {"choices": [{"finish_reason": "stop", "message": {"content": None}}]},
        {"choices": [{"finish_reason": "stop", "message": {"content": "{}", "refusal": "no"}}]},
        {"choices": [{"finish_reason": "stop", "message": {"content": '{"status":"resolved"}'}}]},
        [],
    ],
)
def test_aitunnel_rejects_incomplete_refused_and_invalid_identity(response) -> None:
    from src.identity.providers.base import VehicleIdentityProviderInvalidResponseError

    image = normalize_image(_png_bytes(), max_image_edge=500, max_pixels=1_000_000)
    with pytest.raises(VehicleIdentityProviderInvalidResponseError):
        _aitunnel_resolver()._parse_response(
            json.dumps(response), image=image, provider_request_id=None, latency_ms=1
        )


def test_aitunnel_selection_uses_dedicated_key_and_respects_disabled_flag(monkeypatch) -> None:
    import src.identity.service as service
    from src.identity.providers.aitunnel import AITunnelVehicleIdentityResolver
    from src.identity.providers.mock import MockVehicleIdentityResolver

    monkeypatch.setattr(service, "VEHICLE_IDENTITY_ENABLED", True)
    monkeypatch.setattr(service, "VEHICLE_IDENTITY_PROVIDER", "aitunnel")
    monkeypatch.setattr(service, "VEHICLE_IDENTITY_MODEL", "qwen3.8-flash")
    monkeypatch.setattr(service, "VEHICLE_IDENTITY_AITUNNEL_API_KEY", "dedicated")
    resolver = service.get_vehicle_identity_resolver()
    assert isinstance(resolver, AITunnelVehicleIdentityResolver)
    assert resolver.api_key == "dedicated"
    assert resolver.model == "qwen3.8-flash"
    monkeypatch.setattr(service, "VEHICLE_IDENTITY_ENABLED", False)
    assert isinstance(service.get_vehicle_identity_resolver(), MockVehicleIdentityResolver)


@pytest.mark.parametrize(
    "status, expected",
    [(200, None), (401, "configuration"), (403, "configuration"), (429, "provider")],
)
def test_aitunnel_transport_and_auth_errors(monkeypatch, status, expected) -> None:
    import src.identity.providers.openai as adapter
    from src.identity.providers.base import (
        VehicleIdentityProviderConfigurationError,
        VehicleIdentityProviderError,
    )

    calls = []

    class Response:
        def __init__(self):
            self.headers = {"x-request-id": "req-safe"}

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def text(self):
            return json.dumps(
                {
                    "choices": [
                        {
                            "finish_reason": "stop",
                            "message": {
                                "content": json.dumps(
                                    {
                                        "status": "unknown",
                                        "primary": None,
                                        "alternatives": [],
                                        "abstention_reason": "model_uncertain",
                                    }
                                )
                            },
                        }
                    ]
                }
            )

    Response.status = status

    class Session:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        def post(self, url, **kwargs):
            calls.append((url, kwargs))
            return Response()

    monkeypatch.setattr(adapter.aiohttp, "ClientSession", Session)
    image = normalize_image(_png_bytes(), max_image_edge=500, max_pixels=1_000_000)
    if expected:
        error = (
            VehicleIdentityProviderConfigurationError
            if expected == "configuration"
            else VehicleIdentityProviderError
        )
        with pytest.raises(error):
            asyncio.run(_aitunnel_resolver().resolve(image))
    else:
        result = asyncio.run(_aitunnel_resolver().resolve(image))
        assert result.metadata.provider == "aitunnel"
    assert len(calls) == 1
    assert calls[0][0] == "https://api.aitunnel.ru/v1/chat/completions"
    assert calls[0][1]["headers"]["Authorization"] == "Bearer test-aitunnel"
