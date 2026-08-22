import asyncio
import random
from io import BytesIO
from typing import Any

import pytest
from PIL import Image

from src import config
from src.rendering.base import GeneratedImage, ImageEditRequest, ImageProviderError
from src.rendering.factory import create_image_generation_provider
from src.rendering.storage_image import prepare_image_for_storage
from src.rendering.wan import WanImageConfig, WanImageProvider


def _image_bytes(*, size: tuple[int, int] = (320, 320), image_format: str = "PNG") -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, "navy").save(buffer, format=image_format)
    return buffer.getvalue()


class _FakeContent:
    def __init__(self, body: bytes) -> None:
        self._body = body

    async def iter_chunked(self, chunk_size: int):
        del chunk_size
        yield self._body


class _FakeResponse:
    def __init__(
        self,
        *,
        status: int = 200,
        payload: dict[str, Any] | None = None,
        body: bytes = b"",
        headers: dict[str, str] | None = None,
    ) -> None:
        self.status = status
        self._payload = payload or {}
        self.headers = headers or {}
        self.content = _FakeContent(body)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return False

    async def json(self, *, content_type=None):
        del content_type
        return self._payload


class _FakeSession:
    def __init__(
        self,
        *,
        post_responses: list[_FakeResponse | Exception],
        get_responses: list[_FakeResponse | Exception],
    ) -> None:
        self._post_responses = iter(post_responses)
        self._get_responses = iter(get_responses)
        self.posts: list[tuple[str, dict[str, Any]]] = []
        self.gets: list[tuple[str, dict[str, Any]]] = []
        self.init_kwargs: dict[str, Any] = {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return False

    def post(self, url: str, **kwargs):
        self.posts.append((url, kwargs))
        response = next(self._post_responses)
        if isinstance(response, Exception):
            raise response
        return response

    def get(self, url: str, **kwargs):
        self.gets.append((url, kwargs))
        response = next(self._get_responses)
        if isinstance(response, Exception):
            raise response
        return response


def _provider(
    session: _FakeSession,
    *,
    model: str = "wan2.7-image",
    sleep_calls: list[float] | None = None,
) -> WanImageProvider:
    async def fake_sleep(seconds: float) -> None:
        if sleep_calls is not None:
            sleep_calls.append(seconds)

    def session_factory(**kwargs):
        session.init_kwargs = kwargs
        return session

    return WanImageProvider(
        WanImageConfig(
            api_key="test-key",
            base_url="https://workspace.ap-southeast-1.maas.aliyuncs.com/api/v1",
            model=model,
            poll_interval_seconds=0.01,
        ),
        session_factory=session_factory,
        sleep=fake_sleep,
    )


def test_wan_async_edit_preserves_image_order_and_downloads_result() -> None:
    result_url = "https://result.oss-ap-southeast-1.aliyuncs.com/generated.png"
    result_bytes = _image_bytes(size=(64, 64))
    session = _FakeSession(
        post_responses=[
            _FakeResponse(
                payload={
                    "request_id": "submit-request",
                    "output": {"task_id": "task-1", "task_status": "PENDING"},
                }
            )
        ],
        get_responses=[
            _FakeResponse(payload={"output": {"task_id": "task-1", "task_status": "RUNNING"}}),
            _FakeResponse(
                payload={
                    "request_id": "result-request",
                    "output": {
                        "task_id": "task-1",
                        "task_status": "SUCCEEDED",
                        "choices": [
                            {"message": {"content": [{"type": "image", "image": result_url}]}}
                        ],
                    },
                    "usage": {"image_count": 1, "size": "2048*2048"},
                }
            ),
            _FakeResponse(
                body=result_bytes,
                headers={
                    "Content-Type": "image/png",
                    "Content-Length": str(len(result_bytes)),
                },
            ),
        ],
    )
    sleep_calls: list[float] = []
    provider = _provider(session, sleep_calls=sleep_calls)
    request = ImageEditRequest(
        prompt="Use image 2 wheels on image 1",
        images=(_image_bytes(), _image_bytes(image_format="JPEG")),
    )

    result = asyncio.run(provider.edit(request))

    assert len(result) == 1
    assert result[0].data == result_bytes
    assert result[0].content_type == "image/png"
    assert result[0].provider == "wan"
    assert result[0].model == "wan2.7-image"
    assert result[0].request_id == "result-request"
    assert result[0].task_id == "task-1"
    assert sleep_calls == [0.01]
    post_url, post_kwargs = session.posts[0]
    assert post_url.endswith("/services/aigc/image-generation/generation")
    assert post_kwargs["headers"]["X-DashScope-Async"] == "enable"
    content = post_kwargs["json"]["input"]["messages"][0]["content"]
    assert content[0]["image"].startswith("data:image/jpeg;base64,")
    assert content[1]["image"].startswith("data:image/jpeg;base64,")
    assert content[2] == {"text": request.prompt}
    assert post_kwargs["json"]["parameters"] == {
        "size": "2K",
        "n": 1,
        "watermark": False,
    }
    assert session.init_kwargs["trust_env"] is False


def test_wan26_uses_edit_mode_and_disables_prompt_rewrite() -> None:
    result_url = "https://result.aliyuncs.com/generated.png"
    result_bytes = _image_bytes(size=(64, 64))
    session = _FakeSession(
        post_responses=[
            _FakeResponse(payload={"output": {"task_id": "task-26", "task_status": "PENDING"}})
        ],
        get_responses=[
            _FakeResponse(
                payload={
                    "output": {
                        "task_id": "task-26",
                        "task_status": "SUCCEEDED",
                        "choices": [
                            {"message": {"content": [{"type": "image", "image": result_url}]}}
                        ],
                    }
                }
            ),
            _FakeResponse(body=result_bytes, headers={"Content-Type": "image/png"}),
        ],
    )

    asyncio.run(
        _provider(session, model="wan2.6-image").edit(
            ImageEditRequest(prompt="edit", images=(_image_bytes(),))
        )
    )

    parameters = session.posts[0][1]["json"]["parameters"]
    assert parameters["enable_interleave"] is False
    assert parameters["prompt_extend"] is False


def test_wan_scales_interactive_boxes_with_normalized_input() -> None:
    result_url = "https://result.aliyuncs.com/generated.png"
    result_bytes = _image_bytes(size=(64, 64))
    session = _FakeSession(
        post_responses=[
            _FakeResponse(payload={"output": {"task_id": "task-box", "task_status": "PENDING"}})
        ],
        get_responses=[
            _FakeResponse(
                payload={
                    "output": {
                        "task_id": "task-box",
                        "task_status": "SUCCEEDED",
                        "choices": [
                            {"message": {"content": [{"type": "image", "image": result_url}]}}
                        ],
                    }
                }
            ),
            _FakeResponse(body=result_bytes, headers={"Content-Type": "image/png"}),
        ],
    )

    asyncio.run(
        _provider(session).edit(
            ImageEditRequest(
                prompt="edit selected region",
                images=(_image_bytes(size=(120, 120)),),
                bbox_list=(((10, 10, 100, 100),),),
            )
        )
    )

    assert session.posts[0][1]["json"]["parameters"]["bbox_list"] == [[[20, 20, 200, 200]]]


def test_wan_does_not_retry_ambiguous_submission_failure() -> None:
    session = _FakeSession(post_responses=[TimeoutError()], get_responses=[])

    with pytest.raises(ImageProviderError, match="submission transport"):
        asyncio.run(
            _provider(session).edit(ImageEditRequest(prompt="edit", images=(_image_bytes(),)))
        )

    assert len(session.posts) == 1


def test_wan_retries_transient_poll_only() -> None:
    result_url = "https://result.aliyuncs.com/generated.png"
    result_bytes = _image_bytes(size=(64, 64))
    session = _FakeSession(
        post_responses=[
            _FakeResponse(payload={"output": {"task_id": "task-retry", "task_status": "PENDING"}})
        ],
        get_responses=[
            _FakeResponse(
                status=503,
                payload={"code": "ServiceUnavailable", "message": "retry later"},
            ),
            _FakeResponse(
                payload={
                    "output": {
                        "task_id": "task-retry",
                        "task_status": "SUCCEEDED",
                        "choices": [
                            {"message": {"content": [{"type": "image", "image": result_url}]}}
                        ],
                    }
                }
            ),
            _FakeResponse(body=result_bytes, headers={"Content-Type": "image/png"}),
        ],
    )
    sleep_calls: list[float] = []

    result = asyncio.run(
        _provider(session, sleep_calls=sleep_calls).edit(
            ImageEditRequest(prompt="edit", images=(_image_bytes(),))
        )
    )

    assert len(result) == 1
    assert sleep_calls == [0.01]
    assert len(session.posts) == 1


def test_wan_surfaces_terminal_task_failure() -> None:
    session = _FakeSession(
        post_responses=[
            _FakeResponse(payload={"output": {"task_id": "task-failed", "task_status": "PENDING"}})
        ],
        get_responses=[
            _FakeResponse(
                payload={
                    "code": "InternalError",
                    "message": "generation failed",
                    "output": {"task_id": "task-failed", "task_status": "FAILED"},
                }
            )
        ],
    )

    with pytest.raises(ImageProviderError, match="InternalError"):
        asyncio.run(
            _provider(session).edit(ImageEditRequest(prompt="edit", images=(_image_bytes(),)))
        )


def test_wan_rejects_untrusted_result_host() -> None:
    session = _FakeSession(
        post_responses=[
            _FakeResponse(payload={"output": {"task_id": "task-bad", "task_status": "PENDING"}})
        ],
        get_responses=[
            _FakeResponse(
                payload={
                    "output": {
                        "task_id": "task-bad",
                        "task_status": "SUCCEEDED",
                        "choices": [
                            {
                                "message": {
                                    "content": [
                                        {
                                            "type": "image",
                                            "image": "https://evil.example/result.png",
                                        }
                                    ]
                                }
                            }
                        ],
                    }
                }
            )
        ],
    )

    with pytest.raises(ImageProviderError, match="host is not allowed"):
        asyncio.run(
            _provider(session).edit(ImageEditRequest(prompt="edit", images=(_image_bytes(),)))
        )


def test_wan_revalidates_result_redirect_host() -> None:
    first_url = "https://result.aliyuncs.com/generated.png"
    session = _FakeSession(
        post_responses=[
            _FakeResponse(
                payload={"output": {"task_id": "task-redirect", "task_status": "PENDING"}}
            )
        ],
        get_responses=[
            _FakeResponse(
                payload={
                    "output": {
                        "task_id": "task-redirect",
                        "task_status": "SUCCEEDED",
                        "choices": [
                            {"message": {"content": [{"type": "image", "image": first_url}]}}
                        ],
                    }
                }
            ),
            _FakeResponse(status=302, headers={"Location": "https://evil.example/result.png"}),
        ],
    )

    with pytest.raises(ImageProviderError, match="host is not allowed"):
        asyncio.run(
            _provider(session).edit(ImageEditRequest(prompt="edit", images=(_image_bytes(),)))
        )

    assert session.gets[-1][1]["allow_redirects"] is False


def test_provider_factory_selects_wan(monkeypatch) -> None:
    monkeypatch.setattr(config, "IMAGE_GENERATION_PROVIDER", "wan")
    monkeypatch.setattr(config, "WAN_API_KEY", "test-key")
    monkeypatch.setattr(
        config,
        "WAN_BASE_URL",
        "https://workspace.ap-southeast-1.maas.aliyuncs.com/api/v1",
    )

    provider = create_image_generation_provider()

    assert provider.name == "wan"


def test_oversized_provider_png_is_bounded_for_storage() -> None:
    source = Image.frombytes("RGB", (512, 512), random.Random(7).randbytes(512 * 512 * 3))
    buffer = BytesIO()
    source.save(buffer, format="PNG")
    generated = GeneratedImage(
        data=buffer.getvalue(),
        content_type="image/png",
        provider="wan",
        model="wan2.7-image",
    )

    prepared = prepare_image_for_storage(generated, max_bytes=50_000)

    assert prepared.content_type == "image/jpeg"
    assert len(prepared.data) <= 50_000
    assert prepared.provider == "wan"
