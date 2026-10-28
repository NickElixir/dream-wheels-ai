import asyncio
import base64
from io import BytesIO
from pathlib import Path

import aiohttp
import pytest
from PIL import Image

from src import config
from src.generation.base import GenerationProviderError, GenerationRequest
from src.generation.config import WanImageConfig
from src.generation.wan_image_provider import WanImageProvider


def image_bytes(*, size=(320, 240), image_format="PNG", color="navy"):
    buffer = BytesIO()
    Image.new("RGB", size, color).save(buffer, format=image_format)
    return buffer.getvalue()


class FakeContent:
    def __init__(self, body: bytes):
        self.body = body

    async def iter_chunked(self, chunk_size):
        del chunk_size
        yield self.body


class FakeResponse:
    def __init__(self, *, status=200, payload=None, body=b"", headers=None):
        self.status = status
        self.payload = payload if payload is not None else {}
        self.headers = headers or {}
        self.content = FakeContent(body)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return False

    async def json(self, *, content_type=None):
        del content_type
        return self.payload


class FakeSession:
    def __init__(self, *, posts=None, gets=None):
        self.posts = list(posts or [])
        self.gets = list(gets or [])
        self.post_calls = []
        self.get_calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return False

    def post(self, url, **kwargs):
        self.post_calls.append((url, kwargs))
        response = self.posts.pop(0)
        if isinstance(response, Exception):
            raise response
        return response

    def get(self, url, **kwargs):
        self.get_calls.append((url, kwargs))
        response = self.gets.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


def request(*, edit_regions=None):
    return GenerationRequest(
        vehicle_image=image_bytes(size=(800, 600), color="blue"),
        vehicle_content_type="image/png",
        rim_reference_image=image_bytes(size=(400, 400), image_format="JPEG", color="silver"),
        rim_reference_content_type="image/jpeg",
        instruction="Replace only the visible rims.",
        prompt_version="P0_API_SPIKE",
        output_width=887,
        output_height=665,
        edit_regions=edit_regions,
    )


def provider(session, *, config_overrides=None, clock=None):
    values = {
        "api_key": "secret-key",
        "workspace_id": "workspace",
        "poll_initial_sec": 0.01,
        "task_timeout_sec": 1,
        "max_poll_errors": 2,
    }
    values.update(config_overrides or {})

    async def sleep(_seconds):
        return None

    return WanImageProvider(
        WanImageConfig(**values),
        session_factory=lambda **_: session,
        sleep=sleep,
        clock=clock or __import__("time").monotonic,
    )


def successful_session(*, result_url="https://result.aliyuncs.com/result.png", result=None):
    result = result or image_bytes(size=(64, 48))
    return FakeSession(
        posts=[
            FakeResponse(
                payload={
                    "request_id": "submit-request",
                    "output": {"task_id": "task-1", "task_status": "PENDING"},
                }
            )
        ],
        gets=[
            FakeResponse(payload={"output": {"task_id": "task-1", "task_status": "RUNNING"}}),
            FakeResponse(
                payload={
                    "request_id": "result-request",
                    "output": {
                        "task_id": "task-1",
                        "task_status": "SUCCEEDED",
                        "choices": [{"message": {"content": [{"image": result_url}]}}],
                    },
                }
            ),
            FakeResponse(
                body=result,
                headers={"Content-Type": "image/png", "Content-Length": str(len(result))},
            ),
        ],
    )


def test_successful_edit_preserves_semantic_order_and_contract():
    expected_result = image_bytes(size=(64, 48))
    session = successful_session(result=expected_result)
    result = asyncio.run(provider(session).edit(request()))

    assert result.image_bytes == expected_result
    assert result.content_type == "image/png"
    assert result.provider == "alibaba_model_studio"
    assert result.generation_cost == 0.03
    assert result.model == "wan2.7-image"
    assert result.provider_request_id == "result-request"
    assert result.provider_task_id == "task-1"
    assert result.billed_image_count == 1
    assert (result.output_width, result.output_height) == (64, 48)
    assert result.diagnostics.status_transitions == ("RUNNING", "SUCCEEDED")
    payload = session.post_calls[0][1]["json"]
    content = payload["input"]["messages"][0]["content"]
    assert base64.b64decode(content[0]["image"].split(",", 1)[1]) == request().vehicle_image
    assert base64.b64decode(content[1]["image"].split(",", 1)[1]) == request().rim_reference_image
    assert content[2] == {"text": "Replace only the visible rims."}
    assert payload["parameters"] == {"size": "887*665", "n": 1, "watermark": False}
    assert "2K" not in str(payload)
    assert "bbox_list" not in payload["parameters"]
    assert session.post_calls[0][1]["headers"]["X-DashScope-Async"] == "enable"


def test_optional_edit_regions_are_forwarded_but_not_detected():
    session = successful_session()
    asyncio.run(provider(session).edit(request(edit_regions=((10, 20, 100, 120),))))
    assert session.post_calls[0][1]["json"]["parameters"]["bbox_list"] == [
        [[10, 20, 100, 120]],
        [],
    ]


def test_config_derives_workspace_endpoint_and_defaults(monkeypatch):
    monkeypatch.setattr(config, "WAN_API_KEY", "test-key")
    monkeypatch.setattr(config, "WAN_REGION", "ap-southeast-1")
    monkeypatch.setattr(config, "WAN_WORKSPACE_ID", "ws-123")
    monkeypatch.setattr(config, "WAN_MODEL", "wan2.7-image")
    cfg = WanImageConfig.from_env()
    assert cfg.api_base_url == "https://ws-123.ap-southeast-1.maas.aliyuncs.com/api/v1"
    assert cfg.model == "wan2.7-image"


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("api_key", "", "WAN_API_KEY"),
        ("workspace_id", "", "WAN_WORKSPACE_ID"),
        ("region", "us-east-1", "WAN_REGION"),
        ("model", "wan2.7-image-pro", "WAN_MODEL"),
        ("base_url", "https://example.com/api/v1", "Alibaba"),
    ],
)
def test_config_rejects_invalid_values(field, value, message):
    values = {"api_key": "key", "workspace_id": "workspace"}
    values[field] = value
    with pytest.raises(GenerationProviderError, match=message):
        WanImageConfig(**values)


def test_config_rejects_malformed_timing_from_env(monkeypatch):
    monkeypatch.setattr(config, "WAN_API_KEY", "key")
    monkeypatch.setattr(config, "WAN_WORKSPACE_ID", "workspace")
    monkeypatch.setattr(config, "WAN_TASK_TIMEOUT_SEC", "not-a-number")
    with pytest.raises(GenerationProviderError, match="WAN_TASK_TIMEOUT_SEC"):
        WanImageConfig.from_env()


@pytest.mark.parametrize(
    ("status", "code"),
    [(401, "provider_auth_error"), (429, "provider_rate_limited"), (503, "provider_unavailable")],
)
def test_submission_http_errors_are_normalized(status, code):
    session = FakeSession(
        posts=[FakeResponse(status=status, payload={"code": "ProviderCode", "message": "nope"})]
    )
    with pytest.raises(GenerationProviderError) as error:
        asyncio.run(provider(session).edit(request()))
    assert error.value.code == code
    assert len(session.post_calls) == 1


def test_ambiguous_submission_transport_is_not_retried():
    session = FakeSession(posts=[TimeoutError()])
    with pytest.raises(GenerationProviderError) as error:
        asyncio.run(provider(session).edit(request()))
    assert error.value.code == "provider_submission_uncertain"
    assert len(session.post_calls) == 1


@pytest.mark.parametrize("status", ["FAILED", "CANCELED", "UNKNOWN"])
def test_terminal_task_status_preserves_safe_provider_diagnostics(status):
    session = FakeSession(
        posts=[FakeResponse(payload={"request_id": "submit", "output": {"task_id": "task-x"}})],
        gets=[
            FakeResponse(
                payload={
                    "request_id": "poll-request",
                    "code": "InternalError",
                    "message": "secret-key https://signed.example/result?sig=secret",
                    "output": {
                        "task_id": "task-x",
                        "task_status": status,
                        "code": "TaskFailed",
                        "message": "secret-key https://signed.example/task",
                    },
                }
            )
        ],
    )
    with pytest.raises(GenerationProviderError) as error:
        asyncio.run(provider(session).edit(request()))
    assert error.value.code == "provider_task_failed"
    diagnostics = error.value.diagnostics
    assert diagnostics.task_id == "task-x"
    assert diagnostics.raw_task_status == status
    assert diagnostics.provider_error_code == "InternalError"
    assert "secret-key" not in str(diagnostics)
    assert "signed.example" not in str(diagnostics)
    assert "https://" not in str(error.value)


def test_malformed_task_status_is_not_success():
    session = FakeSession(
        posts=[FakeResponse(payload={"output": {"task_id": "task-x"}})],
        gets=[FakeResponse(payload={"output": {"task_status": "NOT_A_STATUS"}})],
    )
    with pytest.raises(GenerationProviderError) as error:
        asyncio.run(provider(session).edit(request()))
    assert error.value.code == "provider_response_error"


def test_polling_transient_errors_are_bounded():
    session = FakeSession(
        posts=[FakeResponse(payload={"output": {"task_id": "task-x"}})],
        gets=[aiohttp.ClientError(), aiohttp.ClientError(), aiohttp.ClientError()],
    )
    with pytest.raises(GenerationProviderError) as error:
        asyncio.run(provider(session, config_overrides={"max_poll_errors": 2}).edit(request()))
    assert error.value.code == "provider_unavailable"
    assert len(session.post_calls) == 1
    assert len(session.get_calls) == 3


def test_polling_timeout_is_normalized():
    class Clock:
        values = iter([0.0, 0.0, 2.0])

        def __call__(self):
            return next(self.values)

    session = FakeSession(
        posts=[FakeResponse(payload={"output": {"task_id": "task-x"}})],
        gets=[FakeResponse(payload={"output": {"task_status": "RUNNING"}})],
    )
    with pytest.raises(GenerationProviderError) as error:
        asyncio.run(
            provider(
                session,
                config_overrides={"task_timeout_sec": 1},
                clock=Clock(),
            ).edit(request())
        )
    assert error.value.code == "provider_task_timeout"


@pytest.mark.parametrize(
    ("url", "message"),
    [
        ("http://result.aliyuncs.com/result.png", "URL is unsafe"),
        ("https://evil.example/result.png", "host is not allowed"),
    ],
)
def test_result_url_security(url, message):
    session = successful_session(result_url=url)
    with pytest.raises(GenerationProviderError, match=message) as error:
        asyncio.run(provider(session).edit(request()))
    assert error.value.diagnostics is not None


def test_result_redirect_limit_is_enforced():
    session = successful_session()
    session.gets[-1] = FakeResponse(
        status=302,
        headers={"Location": "https://result.aliyuncs.com/redirected.png"},
    )
    with pytest.raises(GenerationProviderError, match="redirect"):
        asyncio.run(provider(session, config_overrides={"result_max_redirects": 0}).edit(request()))


@pytest.mark.parametrize(
    ("headers", "body", "message"),
    [
        ({"Content-Type": "text/plain"}, b"not image", "MIME"),
        ({"Content-Type": "image/png"}, b"not image", "valid image"),
        ({"Content-Type": "image/png", "Content-Length": "999999"}, image_bytes(), "size"),
    ],
)
def test_result_validation(headers, body, message):
    session = successful_session(result=body)
    session.gets[-1] = FakeResponse(body=body, headers=headers)
    with pytest.raises(GenerationProviderError, match=message):
        asyncio.run(provider(session, config_overrides={"max_output_bytes": 1_000}).edit(request()))


def test_production_provider_does_not_import_spike():
    source = Path("src/generation/wan_image_provider.py").read_text()
    assert "wan_api_spike" not in source
