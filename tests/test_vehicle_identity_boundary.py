"""Provider boundary regressions shared by OpenAI and AI Tunnel."""

import asyncio
import json
import logging
from io import BytesIO

import aiohttp
import pytest
from PIL import Image

from src.identity.providers.aitunnel import AITunnelVehicleIdentityResolver
from src.identity.providers.base import (
    VehicleIdentityProviderError,
    VehicleIdentityProviderInvalidResponseError,
)
from src.identity.providers.openai import OpenAIVehicleIdentityResolver
from src.vision.image_normalization import normalize_image


@pytest.fixture(params=[OpenAIVehicleIdentityResolver, AITunnelVehicleIdentityResolver])
def resolver(request):
    return request.param(api_key="fake-key", model="test-model", timeout_sec=1, max_retries=2)


@pytest.fixture
def image():
    output = BytesIO()
    Image.new("RGB", (320, 240)).save(output, format="PNG")
    return normalize_image(output.getvalue(), max_image_edge=500, max_pixels=1_000_000)


def candidate():
    return {
        "make": "BMW",
        "model": "5 Series",
        "year": 2020,
        "year_start": None,
        "year_end": None,
        "confidence": 0.9,
        "source": "vlm_visual",
    }


def resolution():
    return {
        "status": "resolved",
        "primary": candidate(),
        "alternatives": [],
        "abstention_reason": None,
    }


def envelope(resolver, content):
    if resolver.provider_name == "aitunnel":
        return json.dumps({"choices": [{"finish_reason": "stop", "message": {"content": content}}]})
    return json.dumps({"output": [{"content": [{"type": "output_text", "text": content}]}]})


@pytest.mark.parametrize("field", ["status", "primary", "alternatives", "abstention_reason"])
def test_missing_required_root_field_is_rejected(resolver, image, field):
    payload = resolution()
    del payload[field]
    with pytest.raises(VehicleIdentityProviderInvalidResponseError):
        resolver._parse_response(
            envelope(resolver, json.dumps(payload)),
            image=image,
            provider_request_id=None,
            latency_ms=1,
        )


@pytest.mark.parametrize("field", list(candidate()))
def test_missing_required_candidate_field_is_rejected(resolver, image, field):
    payload = resolution()
    del payload["primary"][field]
    with pytest.raises(VehicleIdentityProviderInvalidResponseError):
        resolver._parse_response(
            envelope(resolver, json.dumps(payload)),
            image=image,
            provider_request_id=None,
            latency_ms=1,
        )


@pytest.mark.parametrize(
    "field,value",
    [
        ("year", "2020"),
        ("year", True),
        ("confidence", True),
        ("confidence", "0.9"),
        ("make", 123),
        ("year_start", 2010),
        ("source", "catalog"),
        ("extra", "unexpected"),
    ],
)
def test_schema_violation_is_not_coerced(resolver, image, field, value):
    payload = resolution()
    payload["primary"][field] = value
    with pytest.raises(VehicleIdentityProviderInvalidResponseError):
        resolver._parse_response(
            envelope(resolver, json.dumps(payload)),
            image=image,
            provider_request_id=None,
            latency_ms=1,
        )


@pytest.mark.parametrize("status", ["resolved", "ambiguous", "unknown"])
def test_complete_schema_and_semantics_are_accepted(resolver, image, status):
    payload = resolution()
    payload["status"] = status
    if status == "ambiguous":
        payload["primary"].update(year=None, year_start=2018, year_end=2023)
        payload["alternatives"] = [candidate()]
    if status == "unknown":
        payload.update(primary=None, abstention_reason="model_uncertain")
    result = resolver._parse_response(
        envelope(resolver, json.dumps(payload)), image=image, provider_request_id=None, latency_ms=1
    )
    assert result.status == status


@pytest.mark.parametrize("nonempty", [False, True])
def test_root_arrays_are_never_unwrapped_or_applied(resolver, image, nonempty):
    root = [resolution()] if nonempty else []
    with pytest.raises(VehicleIdentityProviderInvalidResponseError) as error:
        resolver._parse_response(
            envelope(resolver, json.dumps(root)),
            image=image,
            provider_request_id=None,
            latency_ms=1,
        )
    assert error.value.retryable is False
    assert '"path": [], "rule": "type", "actual_type": "list"' in str(error.value)


@pytest.mark.parametrize("case", ["extra_key", "semantic", "json", "metadata"])
def test_logger_exception_never_contains_provider_payload(resolver, image, caplog, case):
    marker = "PRIVATE_RESPONSE_MARKER_938"
    payload = resolution()
    if case == "extra_key":
        payload[marker] = marker
    if case == "semantic":
        payload["primary"].update(model=marker, year=None, year_start=2024, year_end=2018)
    body = envelope(resolver, json.dumps(payload) if case != "json" else marker)
    if case == "metadata":
        raw = json.loads(body)
        raw["id"] = {marker: marker}
        body = json.dumps(raw)
    with caplog.at_level(logging.ERROR):
        try:
            resolver._parse_response(body, image=image, provider_request_id=None, latency_ms=1)
        except VehicleIdentityProviderInvalidResponseError:
            logging.getLogger(__name__).exception("Vehicle recognition failed user_id=24")
        else:
            pytest.fail("invalid provider response accepted")
    assert marker not in caplog.text
    assert "input_value" not in caplog.text
    assert "VehicleIdentityProviderInvalidResponseError" in caplog.text


@pytest.mark.parametrize(
    "failure,retryable",
    [
        (400, False),
        (401, False),
        (403, False),
        (404, False),
        (422, False),
        (429, True),
        (500, True),
        (502, True),
        (503, True),
        (504, True),
        ("timeout", True),
        ("network", True),
        ("invalid", False),
        ("missing_key", False),
    ],
)
def test_request_attempts_and_retryable_classification(
    resolver, image, monkeypatch, failure, retryable
):
    import src.identity.providers.openai as adapter

    calls = []

    class Response:
        def __init__(self):
            self.headers = {}
            self.status = failure if isinstance(failure, int) else 200

        async def __aenter__(self):
            if failure == "timeout":
                raise TimeoutError("sensitive transport details")
            if failure == "network":
                raise aiohttp.ClientConnectionError("sensitive transport details")
            return self

        async def __aexit__(self, *args):
            return False

        async def text(self):
            return envelope(resolver, "not-json")

    class Session:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        def post(self, url, **kwargs):
            calls.append(url)
            return Response()

    async def no_sleep(_):
        pass

    monkeypatch.setattr(adapter.aiohttp, "ClientSession", Session)
    monkeypatch.setattr(adapter.asyncio, "sleep", no_sleep)
    if failure == "missing_key":
        resolver.api_key = ""
    with pytest.raises(VehicleIdentityProviderError) as error:
        asyncio.run(resolver.resolve(image))
    assert error.value.retryable is retryable
    assert len(calls) == (0 if failure == "missing_key" else 3 if retryable else 1)
    if failure in {"timeout", "network"}:
        message = str(error.value)
        assert f"failure_kind={'timeout' if failure == 'timeout' else 'connection'}" in message
        assert "phase=connecting" in message
        assert "attempt=3 max_retries=2" in message
        assert "sensitive transport details" not in message


@pytest.mark.parametrize("send_headers", [False, True])
def test_real_http_timeout_records_phase_without_sensitive_data(resolver, image, send_headers):
    async def run():
        release = asyncio.Event()
        done = asyncio.Event()

        async def handle(reader, writer):
            try:
                header = await reader.readuntil(b"\r\n\r\n")
                length = next(
                    int(line.split(b":", 1)[1])
                    for line in header.split(b"\r\n")
                    if line.lower().startswith(b"content-length:")
                )
                await reader.readexactly(length)
                if send_headers:
                    writer.write(b"HTTP/1.1 200 OK\r\nContent-Length: 1000\r\n\r\nPRIVATE")
                    await writer.drain()
                await release.wait()
            finally:
                writer.close()
                await writer.wait_closed()
                done.set()

        server = await asyncio.start_server(handle, "127.0.0.1", 0)
        resolver.endpoint = f"http://127.0.0.1:{server.sockets[0].getsockname()[1]}/PRIVATE"
        resolver.timeout_sec = 0.1
        resolver.max_retries = 0
        try:
            with pytest.raises(VehicleIdentityProviderError) as error:
                await resolver.resolve(image)
            message = str(error.value)
            assert "failure_kind=timeout" in message
            phase = "reading_body" if send_headers else "awaiting_headers"
            assert f"phase={phase}" in message
            assert "attempt=1 max_retries=0" in message
            assert "PRIVATE" not in message
            assert "http" not in message
            assert error.value.retryable is True
        finally:
            release.set()
            await asyncio.wait_for(done.wait(), 2)
            server.close()
            await server.wait_closed()

    asyncio.run(run())


@pytest.mark.parametrize("status", [200, 400, 401, 403, 429, 503])
def test_truncated_http_body_preserves_status_classification(resolver, image, status):
    from src.identity.providers.base import VehicleIdentityProviderConfigurationError

    async def run():
        calls = []

        async def handle(reader, writer):
            try:
                header = await reader.readuntil(b"\r\n\r\n")
                length = next(
                    int(line.split(b":", 1)[1])
                    for line in header.split(b"\r\n")
                    if line.lower().startswith(b"content-length:")
                )
                await reader.readexactly(length)
                calls.append(status)
                writer.write(
                    f"HTTP/1.1 {status} Test\r\nContent-Length: 1000\r\n"
                    "Connection: close\r\n\r\n{".encode()
                )
                await writer.drain()
            finally:
                writer.close()
                await writer.wait_closed()

        server = await asyncio.start_server(handle, "127.0.0.1", 0)
        port = server.sockets[0].getsockname()[1]
        resolver.endpoint = f"http://127.0.0.1:{port}/test"
        try:
            async with server:
                with pytest.raises(VehicleIdentityProviderError) as error:
                    await resolver.resolve(image)
        finally:
            server.close()
            await server.wait_closed()
        retryable = status in {200, 429, 503}
        assert len(calls) == (3 if retryable else 1)
        assert error.value.retryable is retryable
        if status in {401, 403}:
            assert isinstance(error.value, VehicleIdentityProviderConfigurationError)
        elif status == 400:
            assert error.value.error_code == "vehicle_identity_provider_request_rejected"

    asyncio.run(run())


def test_schema_diagnostics_only_exposes_schema_fields(resolver, image, caplog):
    marker = "PRIVATE_RESPONSE_MARKER_938"
    payload = resolution()
    del payload["primary"]["year"]
    payload["primary"]["confidence"] = marker
    payload[marker] = marker
    raw = json.loads(envelope(resolver, json.dumps(payload)))
    raw["id"] = marker
    with caplog.at_level(logging.ERROR):
        try:
            resolver._parse_response(
                json.dumps(raw), image=image, provider_request_id=marker, latency_ms=1
            )
        except VehicleIdentityProviderInvalidResponseError:
            logging.getLogger(__name__).exception("Recognition failed")
    assert marker not in caplog.text
    assert '"missing": ["year"]' in caplog.text
    assert '"confidence"' in caplog.text
    assert '"rule": "type"' in caplog.text
    assert "request_id_hash=" in caplog.text


def test_schema_diagnostics_is_bounded():
    from src.identity.providers.openai import _schema_diagnostics

    payload = resolution()
    payload["alternatives"] = [{} for _ in range(100)]
    assert len(_schema_diagnostics(payload)) == 8


def test_transport_failure_categories_never_use_exception_text():
    import socket
    import ssl
    from types import SimpleNamespace

    from src.identity.providers.openai import _transport_failure_kind

    key = SimpleNamespace(host="PRIVATE", port=443, ssl=True)
    for error, expected in [
        (aiohttp.ClientConnectorError(key, socket.gaierror("PRIVATE")), "dns"),
        (aiohttp.ClientConnectorCertificateError(key, ssl.CertificateError("PRIVATE")), "tls"),
        (aiohttp.ClientPayloadError("PRIVATE"), "response_body"),
        (aiohttp.ClientConnectionError("PRIVATE"), "connection"),
        (aiohttp.ClientError("PRIVATE"), "client_error"),
        (TimeoutError("PRIVATE"), "timeout"),
    ]:
        assert _transport_failure_kind(error) == expected
