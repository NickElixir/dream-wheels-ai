import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = (ROOT / "webapp" / "app.js").read_text(encoding="utf-8")
VERCEL_JSON = json.loads((ROOT / "webapp" / "vercel.json").read_text(encoding="utf-8"))
ADMIN_VERCEL_JSON = json.loads((ROOT / "admin" / "vercel.json").read_text(encoding="utf-8"))
PROXY_JS = (ROOT / "webapp" / "api" / "backend" / "[...path].js").read_text(encoding="utf-8")
PROXY_HELPER_JS = (ROOT / "webapp" / "lib" / "backend-proxy.js").read_text(encoding="utf-8")
FITMENT_PROXY_JS = (ROOT / "webapp" / "api" / "fitment-proxy.js").read_text(encoding="utf-8")
RIM_SOURCE_RESOLVE_PROXY_JS = (ROOT / "webapp" / "api" / "rim-source-resolve-proxy.js").read_text(
    encoding="utf-8"
)


def test_ci_covers_release_branches() -> None:
    ci = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
    assert "branches: [main, staging]" in ci
    for branch_pattern in ("'feature/**'", "'fix/**'", "'e2e/**'", "'docs/**'"):
        assert branch_pattern in ci
    assert "branches: [dev]" not in ci


def test_frontend_deploy_workflow_is_ci_gated_and_quota_safe() -> None:
    workflow = (ROOT / ".github" / "workflows" / "deploy-frontends.yml").read_text(encoding="utf-8")
    assert "push:" in workflow
    assert "uses: ./.github/workflows/ci.yml" in workflow
    assert "needs: ci" in workflow
    assert "workflow_run" not in workflow
    assert "workflow_dispatch:" in workflow
    assert "github.ref_name == 'staging'" in workflow
    assert "github.ref_name == 'main'" in workflow
    assert 'git diff --name-only "$BEFORE_SHA" "$AFTER_SHA"' in workflow
    assert workflow.count("vercel deploy --prebuilt") == 4
    assert "dream-wheels-ai-staging" not in workflow
    assert "STAGING_BACKEND_URL" in workflow
    assert 'if [ "$actual_backend" != "$STAGING_BACKEND_URL" ]; then' in workflow
    for diagnostic in ("missing", "points_to_production", "trailing_slash", "other"):
        assert f'diagnostic="{diagnostic}"' in workflow
    assert "staging BACKEND_URL mismatch: $diagnostic; refusing deployment" in workflow
    assert 'test "$actual_backend" = "$PRODUCTION_BACKEND_URL" || {' in workflow
    assert "missing or mismatched; refusing deployment" in workflow
    assert 'env_file=".vercel/.env.production.local"' in workflow
    assert 'env_file=".vercel/.env.preview.local"' in workflow
    assert "BEFORE_SHA: ${{ github.event.before }}" in workflow
    assert "AFTER_SHA: ${{ github.sha }}" in workflow
    assert "fetch-depth: 0" in workflow
    assert 'git ls-tree -r --name-only "$AFTER_SHA"' in workflow


def test_frontend_vercel_configs_disable_native_git_deployments() -> None:
    assert VERCEL_JSON["git"]["deploymentEnabled"] is False
    assert ADMIN_VERCEL_JSON["git"]["deploymentEnabled"] is False


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


def test_nested_fitment_catalogue_and_variant_routes_share_fitment_proxy() -> None:
    rewrites = VERCEL_JSON["rewrites"]
    assert {
        "source": "/api/backend/jobs/:jobId/fitment/catalogue/:kind",
        "destination": "/api/fitment-proxy?jobId=:jobId&fitmentPath=catalogue/:kind",
    } in rewrites
    assert {
        "source": "/api/backend/jobs/:jobId/fitment/vehicle-variants",
        "destination": "/api/fitment-proxy?jobId=:jobId&fitmentPath=vehicle-variants",
    } in rewrites
    assert {
        "source": "/api/backend/fitment/checks/:checkId",
        "destination": "/api/backend/fitment/checks?checkId=:checkId",
    } in rewrites
    assert {
        "source": "/api/backend/jobs/:jobId/fitment/vehicle-variants/apply",
        "destination": "/api/fitment-proxy?jobId=:jobId&fitmentPath=vehicle-variants/apply",
    } in rewrites
    assert "Unsupported Fitment route" in FITMENT_PROXY_JS
    assert "catalogue/regions" in FITMENT_PROXY_JS


def test_vercel_project_binding_is_not_tracked() -> None:
    assert not (ROOT / ".vercel" / "project.json").exists()
