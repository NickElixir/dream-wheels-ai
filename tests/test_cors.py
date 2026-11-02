import ast
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from src.config import WEBAPP_URL

NEW_ORIGIN = "https://app.dream-wheels.ru"
REQUEST_HEADERS = "authorization,content-type,idempotency-key"


def _app_with_configured_cors() -> FastAPI:
    source = Path("src/main.py").read_text()
    module = ast.parse(source)
    middleware_call = next(
        node
        for node in ast.walk(module)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "add_middleware"
        and node.args
        and isinstance(node.args[0], ast.Name)
        and node.args[0].id == "CORSMiddleware"
    )

    def resolve(node: ast.expr):
        if isinstance(node, ast.Name) and node.id == "WEBAPP_URL":
            return WEBAPP_URL
        if isinstance(node, ast.List):
            return [resolve(item) for item in node.elts]
        return ast.literal_eval(node)

    settings = {keyword.arg: resolve(keyword.value) for keyword in middleware_call.keywords}

    app = FastAPI()
    app.add_middleware(CORSMiddleware, **settings)
    return app


client = TestClient(_app_with_configured_cors())


def _preflight(origin: str, method: str):
    return client.options(
        "/jobs",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": method,
            "Access-Control-Request-Headers": REQUEST_HEADERS,
        },
    )


def test_new_static_webapp_origin_allows_post_and_put_preflight():
    for method in ("POST", "PUT"):
        response = _preflight(NEW_ORIGIN, method)

        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == NEW_ORIGIN
        assert method in response.headers["access-control-allow-methods"]
        assert response.headers["access-control-allow-headers"].lower() == REQUEST_HEADERS
        assert "access-control-allow-credentials" not in response.headers


def test_existing_webapp_origin_remains_allowed():
    response = _preflight(WEBAPP_URL, "POST")

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == WEBAPP_URL


def test_untrusted_origin_is_not_allowed():
    response = _preflight("https://untrusted.example", "POST")

    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers
