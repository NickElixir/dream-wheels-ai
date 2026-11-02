"""HTTP request correlation without recording client-controlled URL data."""

import json
import logging
import re
import time
import uuid
from contextvars import ContextVar
from typing import Any

REQUEST_ID_PATTERN = re.compile(r"[A-Za-z0-9._:-]{1,64}\Z", re.ASCII)
ROUTE_TEMPLATE_PATTERN = re.compile(r"/[A-Za-z0-9_{}:./-]{0,255}\Z", re.ASCII)
METHOD_PATTERN = re.compile(r"[A-Z]{1,16}\Z", re.ASCII)

request_id_context: ContextVar[str] = ContextVar("request_id", default="-")


class RequestIdLogFilter(logging.Filter):
    """Add the active request ID to regular application log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_context.get()
        return True


def install_request_id_log_context() -> None:
    """Attach request IDs to the root handlers without replacing logging setup."""
    request_filter = RequestIdLogFilter()
    root_logger = logging.getLogger()
    for handler in root_logger.handlers:
        if not any(isinstance(item, RequestIdLogFilter) for item in handler.filters):
            handler.addFilter(request_filter)


def _request_id(scope: dict[str, Any]) -> str:
    for name, value in scope.get("headers", []):
        if name.lower() == b"x-request-id":
            try:
                candidate = value.decode("ascii")
            except UnicodeDecodeError:
                break
            if REQUEST_ID_PATTERN.fullmatch(candidate):
                return candidate
            break
    return str(uuid.uuid4())


def _route_template(scope: dict[str, Any]) -> str:
    route = scope.get("route")
    template = getattr(route, "path", None)
    if isinstance(template, str) and ROUTE_TEMPLATE_PATTERN.fullmatch(template):
        return template
    return "unmatched"


def _method(scope: dict[str, Any]) -> str:
    method = scope.get("method", "")
    if isinstance(method, str) and METHOD_PATTERN.fullmatch(method):
        return method
    return "OTHER"


class RequestContextMiddleware:
    """Pure ASGI request correlation and safe request completion logging."""

    def __init__(self, app: Any) -> None:
        self.app = app
        self.logger = logging.getLogger("src.http")

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        request_id = _request_id(scope)
        scope.setdefault("state", {})["request_id"] = request_id
        token = request_id_context.set(request_id)
        started = time.perf_counter()
        response_status: int | None = None
        completion_logged = False

        def log_completion(status: int) -> None:
            nonlocal completion_logged
            if completion_logged:
                return
            completion_logged = True
            self.logger.info(
                "http_request %s",
                json.dumps(
                    {
                        "request_id": request_id,
                        "method": _method(scope),
                        "route_template": _route_template(scope),
                        "status": status,
                        "duration_ms": round((time.perf_counter() - started) * 1000),
                    },
                    separators=(",", ":"),
                ),
            )

        async def send_with_request_id(message: dict[str, Any]) -> None:
            nonlocal response_status
            message_type = message.get("type")
            if message_type == "http.response.start":
                response_status = int(message["status"])
                headers = [
                    (name, value)
                    for name, value in message.get("headers", [])
                    if name.lower() != b"x-request-id"
                ]
                headers.append((b"x-request-id", request_id.encode("ascii")))
                message = {**message, "headers": headers}
            await send(message)
            if message_type == "http.response.body" and not message.get("more_body", False):
                log_completion(response_status or 500)
            elif message_type == "http.response.pathsend":
                log_completion(response_status or 500)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            if not completion_logged:
                log_completion(response_status or 500)
            request_id_context.reset(token)
