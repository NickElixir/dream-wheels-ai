import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = (ROOT / "webapp" / "app.js").read_text(encoding="utf-8")
VERCEL_JSON = json.loads((ROOT / "webapp" / "vercel.json").read_text(encoding="utf-8"))
PROXY_JS = (ROOT / "webapp" / "api" / "backend" / "[...path].js").read_text(encoding="utf-8")
PROXY_HELPER_JS = (ROOT / "webapp" / "lib" / "backend-proxy.js").read_text(encoding="utf-8")
FITMENT_PROXY_JS = (ROOT / "webapp" / "api" / "fitment-proxy.js").read_text(encoding="utf-8")
RIM_SOURCE_RESOLVE_PROXY_JS = (ROOT / "webapp" / "api" / "rim-source-resolve-proxy.js").read_text(
    encoding="utf-8"
)
FITMENT_CATALOGUE_PROXY_JS = (ROOT / "webapp" / "api" / "fitment-catalogue-proxy.js").read_text(
    encoding="utf-8"
)
FITMENT_VARIANTS_PROXY_JS = (
    ROOT / "webapp" / "api" / "fitment-vehicle-variants-proxy.js"
).read_text(encoding="utf-8")
FITMENT_VARIANTS_APPLY_PROXY_JS = (
    ROOT / "webapp" / "api" / "fitment-vehicle-variants-apply-proxy.js"
).read_text(encoding="utf-8")


def test_ci_covers_staging_release_workflow() -> None:
    ci = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    assert "branches: [main, staging]" in ci
    assert "branches: [staging]" in ci
    assert "branches: [dev]" not in ci


def test_deployed_webapp_uses_runtime_backend_proxy_only() -> None:
    assert "onrender.com" not in APP_JS
    assert "onrender.com" not in json.dumps(VERCEL_JSON)
    assert 'const WEBSITE_PROXY_BASE_URL = "/api/backend";' in APP_JS
    assert "if (!isLocalBrowser()) return WEBSITE_PROXY_BASE_URL;" in APP_JS
    assert 'fetch(apiUrl("/identity/resolve")' in APP_JS


def test_proxy_reads_backend_url_only_at_runtime() -> None:
    assert "process.env.BACKEND_URL" in PROXY_HELPER_JS
    assert "onrender.com" not in PROXY_HELPER_JS
    assert "https:" in PROXY_HELPER_JS
    assert "authorization" not in PROXY_HELPER_JS.lower() or "forwardHeaders" in PROXY_HELPER_JS


def test_fitment_and_rim_source_resolver_rewrite_to_non_conflicting_vercel_proxy_routes() -> None:
    rewrites = VERCEL_JSON["rewrites"]
    assert {
        "source": "/api/backend/jobs/:jobId/fitment",
        "destination": "/api/fitment-proxy?jobId=:jobId",
    } in rewrites
    assert {
        "source": "/api/backend/jobs/:jobId/fitment/rim-source/resolve",
        "destination": "/api/rim-source-resolve-proxy?jobId=:jobId",
    } in rewrites
    assert 'require("../lib/backend-proxy")' in FITMENT_PROXY_JS
    assert 'require("../lib/backend-proxy")' in RIM_SOURCE_RESOLVE_PROXY_JS
    assert "backendPath" in FITMENT_PROXY_JS
    assert "backendPath" in RIM_SOURCE_RESOLVE_PROXY_JS
    assert not list((ROOT / "webapp" / "api" / "backend" / "jobs" / "[jobId]").glob("**/*.js"))


def test_nested_fitment_catalogue_and_variant_routes_use_explicit_proxies() -> None:
    rewrites = VERCEL_JSON["rewrites"]
    assert {
        "source": "/api/backend/jobs/:jobId/fitment/catalogue/:kind",
        "destination": "/api/fitment-catalogue-proxy?jobId=:jobId&kind=:kind",
    } in rewrites
    assert {
        "source": "/api/backend/jobs/:jobId/fitment/vehicle-variants",
        "destination": "/api/fitment-vehicle-variants-proxy?jobId=:jobId",
    } in rewrites
    assert {
        "source": "/api/backend/jobs/:jobId/fitment/vehicle-variants/apply",
        "destination": "/api/fitment-vehicle-variants-apply-proxy?jobId=:jobId",
    } in rewrites
    for source in (
        FITMENT_CATALOGUE_PROXY_JS,
        FITMENT_VARIANTS_PROXY_JS,
        FITMENT_VARIANTS_APPLY_PROXY_JS,
    ):
        assert 'require("../lib/backend-proxy")' in source
        assert "backendPath" in source


def test_vercel_project_binding_is_not_tracked() -> None:
    assert not (ROOT / ".vercel" / "project.json").exists()
