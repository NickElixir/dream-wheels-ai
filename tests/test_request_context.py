import asyncio
import json
import logging
import re
from types import SimpleNamespace
from typing import Any

import pytest

from src.request_context import (
    RequestContextMiddleware,
    RequestIdLogFilter,
    request_id_context,
)


def _scope(request_id: bytes | None = None) -> dict[str, Any]:
    headers = [(b"x-request-id", request_id)] if request_id is not None else []
    return {
        "type": "http",
        "method": "GET",
        "path": "/jobs/secret-job-id",
        "raw_path": b"/jobs/secret-job-id",
        "query_string": b"access_token=secret-query-token",
        "headers": headers,
        "route": SimpleNamespace(path="/jobs/{job_id}"),
    }


def _run_asgi(app, scope: dict[str, Any]) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    sent_request = False

    async def receive() -> dict[str, Any]:
        nonlocal sent_request
        if not sent_request:
            sent_request = True
            return {"type": "http.request", "body": b"", "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message: dict[str, Any]) -> None:
        messages.append(message)

    asyncio.run(app(scope, receive, send))
    return messages


def test_valid_request_id_is_returned_logged_and_available_to_app(caplog):
    caplog.set_level(logging.INFO, logger="src.http")
    caplog.handler.addFilter(RequestIdLogFilter())
    observed: list[str] = []

    async def app(scope, _receive, send):
        observed.append(scope["state"]["request_id"])
        logger = logging.getLogger("src.test.request-context")
        logger.info("inside endpoint")
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok", "more_body": False})

    messages = _run_asgi(RequestContextMiddleware(app), _scope(b"front-end:123"))
    response_headers = dict(messages[0]["headers"])
    assert response_headers[b"x-request-id"] == b"front-end:123"
    assert observed == ["front-end:123"]
    assert any(getattr(record, "request_id", None) == "front-end:123" for record in caplog.records)
    access_record = next(record for record in caplog.records if record.name == "src.http")
    data = json.loads(access_record.getMessage().removeprefix("http_request "))
    assert set(data) == {
        "request_id",
        "method",
        "route_template",
        "status",
        "duration_ms",
    }
    assert data["request_id"] == "front-end:123"
    assert data["method"] == "GET"
    assert data["route_template"] == "/jobs/{job_id}"
    assert data["status"] == 200
    assert isinstance(data["duration_ms"], int)
    assert "secret-job-id" not in access_record.getMessage()
    assert "secret-query-token" not in access_record.getMessage()
    assert request_id_context.get() == "-"


def test_invalid_request_id_is_replaced_with_uuid(caplog):
    caplog.set_level(logging.INFO, logger="src.http")

    async def app(scope, _receive, send):
        await send({"type": "http.response.start", "status": 204, "headers": []})
        await send({"type": "http.response.body", "body": b"", "more_body": False})

    messages = _run_asgi(RequestContextMiddleware(app), _scope(b"bad id"))
    response_id = dict(messages[0]["headers"])[b"x-request-id"].decode("ascii")
    assert re.fullmatch(r"[0-9a-f-]{36}", response_id)
    record = next(record for record in caplog.records if record.name == "src.http")
    assert response_id in record.getMessage()


def test_stream_is_forwarded_and_logs_after_final_body(caplog):
    caplog.set_level(logging.INFO, logger="src.http")
    sent: list[dict[str, Any]] = []

    async def app(_scope, _receive, send):
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"first", "more_body": True})
        assert not any(record.name == "src.http" for record in caplog.records)
        await send({"type": "http.response.body", "body": b"last", "more_body": False})

    async def receive():
        return {"type": "http.disconnect"}

    async def send(message):
        sent.append(message)

    asyncio.run(RequestContextMiddleware(app)(_scope(b"stream-id"), receive, send))
    assert [message.get("body") for message in sent[1:]] == [b"first", b"last"]
    assert sum(record.name == "src.http" for record in caplog.records) == 1


def test_exceptions_propagate_and_context_is_reset(caplog):
    caplog.set_level(logging.INFO, logger="src.http")

    async def app(_scope, _receive, _send):
        raise RuntimeError("internal detail must not enter the access log")

    with pytest.raises(RuntimeError, match="internal detail"):
        _run_asgi(RequestContextMiddleware(app), _scope(b"exception-id"))

    record = next(record for record in caplog.records if record.name == "src.http")
    data = json.loads(record.getMessage().removeprefix("http_request "))
    assert data["request_id"] == "exception-id"
    assert data["status"] == 500
    assert "internal detail" not in record.getMessage()
    assert request_id_context.get() == "-"
