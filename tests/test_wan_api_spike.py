import asyncio
import json
from io import BytesIO

import pytest
from PIL import Image

from scripts.wan_api_spike import (
    BASELINE_PROMPT,
    SpikeConfig,
    SpikeError,
    WanApiSpike,
    build_payload,
    inspect_image,
    vehicle_output_size,
)


def image_bytes(size=(320, 240), fmt="PNG"):
    buffer = BytesIO()
    Image.new("RGB", size, "navy").save(buffer, format=fmt)
    return buffer.getvalue()


class FakeResponse:
    def __init__(self, *, status=200, payload=None, body=b"", headers=None, error=None):
        self.status = status
        self.payload = payload
        self.body = body
        self.headers = headers or {}
        self.error = error

    async def __aenter__(self):
        if self.error:
            raise self.error
        return self

    async def __aexit__(self, *_):
        return False

    async def json(self, **_):
        if isinstance(self.payload, Exception):
            raise self.payload
        return self.payload

    async def read(self):
        return self.body


class FakeSession:
    def __init__(self, posts=None, gets=None):
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
        return response

    def get(self, url, **kwargs):
        self.get_calls.append((url, kwargs))
        return self.gets.pop(0)


def provider(session, *, timeout=30):
    return WanApiSpike(
        SpikeConfig(
            "secret-key",
            "ap-southeast-1",
            "workspace",
            task_timeout_sec=timeout,
            poll_initial_sec=0,
        ),
        session_factory=lambda **_: session,
        sleep=lambda _: asyncio.sleep(0),
    )


def success_session():
    return FakeSession(
        posts=[FakeResponse(payload={"request_id": "req-1", "output": {"task_id": "task-1"}})],
        gets=[
            FakeResponse(payload={"output": {"task_id": "task-1", "task_status": "RUNNING"}}),
            FakeResponse(
                payload={
                    "output": {
                        "task_id": "task-1",
                        "task_status": "SUCCEEDED",
                        "choices": [
                            {
                                "message": {
                                    "content": [{"image": "https://result.aliyuncs.com/r.png"}]
                                }
                            }
                        ],
                    }
                }
            ),
            FakeResponse(body=image_bytes(), headers={"Content-Type": "image/png"}),
        ],
    )


@pytest.mark.parametrize("size", [(1600, 900), (900, 1600), (1000, 1000), (1733, 721)])
def test_vehicle_output_size_preserves_aspect_and_is_explicit(size):
    result = vehicle_output_size(*size)
    assert abs(result.width / result.height - size[0] / size[1]) < 0.01
    assert MIN_PIXELS <= result.width * result.height <= 2048 * 2048


MIN_PIXELS = 768 * 768


def test_rounding_is_deterministic_and_payload_never_falls_back_to_2k():
    vehicle = inspect_image(image_bytes((1001, 777)), role="vehicle")
    rim = inspect_image(image_bytes((500, 500), "JPEG"), role="rim reference")
    size = vehicle_output_size(vehicle.width, vehicle.height)
    payload = build_payload(vehicle, rim, size)
    assert payload["parameters"] == {"size": size.value, "n": 1, "watermark": False}
    assert payload["parameters"]["size"] != "2K"


def test_payload_order_and_prompt():
    payload = build_payload(
        inspect_image(image_bytes(), role="vehicle"),
        inspect_image(image_bytes(), role="rim"),
        vehicle_output_size(320, 240),
    )
    content = payload["input"]["messages"][0]["content"]
    assert content[0]["image"].startswith("data:image/png;base64,")
    assert content[1]["image"].startswith("data:image/png;base64,")
    assert content[2]["text"] == BASELINE_PROMPT
    assert "bbox_list" not in payload["parameters"]


def test_successful_async_flow_writes_sanitized_evidence(tmp_path):
    session = success_session()
    vehicle = tmp_path / "vehicle.png"
    rim = tmp_path / "rim.png"
    vehicle.write_bytes(image_bytes((800, 600)))
    rim.write_bytes(image_bytes((400, 400)))
    report = asyncio.run(provider(session).run(vehicle, rim, tmp_path / "out"))
    assert report["provider_task_id"] == "task-1"
    assert report["provider_request_id"] == "req-1"
    assert report["task_status"] == "SUCCEEDED"
    saved = json.loads((tmp_path / "out" / "wan-evidence.json").read_text())
    assert "secret-key" not in json.dumps(saved)
    assert "Authorization" not in json.dumps(saved)
    assert (tmp_path / "out" / "wan-result.png").exists()
    assert session.post_calls[0][1]["headers"]["X-DashScope-Async"] == "enable"


def test_ambiguous_submit_transport_has_no_second_post(tmp_path):
    vehicle = tmp_path / "vehicle.png"
    rim = tmp_path / "rim.png"
    vehicle.write_bytes(image_bytes())
    rim.write_bytes(image_bytes())
    session = FakeSession(posts=[FakeResponse(error=TimeoutError())])
    with pytest.raises(SpikeError) as error:
        asyncio.run(provider(session).run(vehicle, rim, tmp_path / "out"))
    assert error.value.code == "provider_submission_uncertain"
    assert len(session.post_calls) == 1


@pytest.mark.parametrize(
    ("response", "code"),
    [
        (FakeResponse(status=401, payload={"message": "bad key"}), "provider_auth_error"),
        (FakeResponse(status=429, payload={"message": "slow down"}), "provider_rate_limited"),
        (FakeResponse(status=400, payload={"message": "bad content"}), "provider_content_rejected"),
        (FakeResponse(payload={"bad": "shape"}), "provider_response_error"),
    ],
)
def test_submission_error_taxonomy(tmp_path, response, code):
    vehicle = tmp_path / "vehicle.png"
    rim = tmp_path / "rim.png"
    vehicle.write_bytes(image_bytes())
    rim.write_bytes(image_bytes())
    with pytest.raises(SpikeError) as error:
        asyncio.run(provider(FakeSession(posts=[response])).run(vehicle, rim, tmp_path / "out"))
    assert error.value.code == code


def test_failed_task_is_not_success(tmp_path):
    vehicle_path = tmp_path / "vehicle.png"
    rim_path = tmp_path / "rim.png"
    vehicle_path.write_bytes(image_bytes())
    rim_path.write_bytes(image_bytes())
    session = FakeSession(
        posts=[FakeResponse(payload={"output": {"task_id": "task-fail"}})],
        gets=[FakeResponse(payload={"output": {"task_status": "FAILED"}})],
    )
    with pytest.raises(SpikeError) as error:
        asyncio.run(provider(session).run(vehicle_path, rim_path, tmp_path / "out"))
    assert error.value.code == "provider_task_failed"


def test_task_timeout(tmp_path):
    vehicle = tmp_path / "vehicle.png"
    rim = tmp_path / "rim.png"
    vehicle.write_bytes(image_bytes())
    rim.write_bytes(image_bytes())
    session = FakeSession(
        posts=[FakeResponse(payload={"output": {"task_id": "task-timeout"}})],
        gets=[FakeResponse(payload={"output": {"task_status": "RUNNING"}})],
    )
    with pytest.raises(SpikeError) as error:
        asyncio.run(provider(session, timeout=0).run(vehicle, rim, tmp_path / "out"))
    assert error.value.code == "provider_task_timeout"


@pytest.mark.parametrize(
    ("headers", "body", "code"),
    [
        ({"Content-Type": "text/plain"}, b"not-image", "provider_result_download_error"),
        ({"Content-Type": "image/png"}, b"not-image", "provider_result_download_error"),
    ],
)
def test_result_validation(tmp_path, headers, body, code):
    vehicle = tmp_path / "vehicle.png"
    rim = tmp_path / "rim.png"
    vehicle.write_bytes(image_bytes())
    rim.write_bytes(image_bytes())
    session = FakeSession(
        posts=[FakeResponse(payload={"output": {"task_id": "task-result"}})],
        gets=[
            FakeResponse(
                payload={
                    "output": {
                        "task_status": "SUCCEEDED",
                        "choices": [
                            {"message": {"content": [{"image": "https://result.aliyuncs.com/r"}]}}
                        ],
                    }
                }
            ),
            FakeResponse(body=body, headers=headers),
        ],
    )
    with pytest.raises(SpikeError) as error:
        asyncio.run(provider(session).run(vehicle, rim, tmp_path / "out"))
    assert error.value.code == code


def test_config_derives_workspace_endpoint(monkeypatch):
    monkeypatch.setenv("WAN_API_KEY", "secret")
    monkeypatch.setenv("WAN_WORKSPACE_ID", "ws-123")
    monkeypatch.setenv("WAN_REGION", "ap-southeast-1")
    monkeypatch.setenv("WAN_MODEL", "wan2.7-image")
    config = SpikeConfig.from_env()
    assert config.base_url == "https://ws-123.ap-southeast-1.maas.aliyuncs.com/api/v1"
