import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP_JS = (ROOT / "webapp" / "app.js").read_text(encoding="utf-8")
VERCEL_JSON = json.loads((ROOT / "webapp" / "vercel.json").read_text(encoding="utf-8"))
ADMIN_VERCEL_JSON = json.loads((ROOT / "admin" / "vercel.json").read_text(encoding="utf-8"))
GATEWAY_JS = (ROOT / "webapp" / "api" / "backend-gateway.js").read_text(encoding="utf-8")
PROXY_HELPER_JS = (ROOT / "webapp" / "lib" / "backend-proxy.js").read_text(encoding="utf-8")


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
    for diagnostic in (
        "missing",
        "listed_but_not_pulled",
        "points_to_production",
        "trailing_slash",
        "other",
    ):
        assert f'diagnostic="{diagnostic}"' in workflow
    assert "staging BACKEND_URL mismatch: $diagnostic; refusing deployment" in workflow
    assert 'vercel whoami --token="$VERCEL_TOKEN"' in workflow
    assert 'vercel env ls production --token="$VERCEL_TOKEN"' in workflow
    assert "Vercel production environment inventory: BACKEND_URL=$inventory_state" in workflow
    assert "Pulled production environment: BACKEND_URL=present" in workflow
    assert "Pulled production environment: BACKEND_URL=absent" in workflow
    assert 'test "$actual_backend" = "$PRODUCTION_BACKEND_URL" || {' in workflow
    assert "missing or mismatched; refusing deployment" in workflow
    assert 'env_file=".vercel/.env.production.local"' in workflow
    assert 'env_file=".vercel/.env.preview.local"' in workflow
    assert "BEFORE_SHA: ${{ github.event.before }}" in workflow
    assert "AFTER_SHA: ${{ github.sha }}" in workflow
    assert "fetch-depth: 0" in workflow
    assert 'git ls-tree -r --name-only "$AFTER_SHA"' in workflow
    assert "working-directory: webapp" not in workflow
    assert "working-directory: admin" not in workflow


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


def test_webapp_uses_one_generic_wildcard_gateway_function() -> None:
    rewrites = VERCEL_JSON["rewrites"]
    assert {
        "source": "/api/backend/(.*)",
        "destination": "/api/backend-gateway?__backend_path=$1",
    } in rewrites
    backend_rewrites = [item for item in rewrites if item["source"].startswith("/api/backend")]
    assert backend_rewrites == [
        {
            "source": "/api/backend/(.*)",
            "destination": "/api/backend-gateway?__backend_path=$1",
        }
    ]
    assert 'require("../lib/backend-proxy")' in GATEWAY_JS
    assert 'const BACKEND_PATH_QUERY_KEY = "__backend_path";' in GATEWAY_JS
    assert "stripQueryKeys" in GATEWAY_JS
    assert sorted(
        path.relative_to(ROOT / "webapp" / "api").as_posix()
        for path in (ROOT / "webapp" / "api").rglob("*.js")
    ) == ["backend-gateway.js"]


def test_generic_gateway_covers_deep_fitment_and_protected_asset_paths() -> None:
    source = next(
        item["source"] for item in VERCEL_JSON["rewrites"] if item["source"] == "/api/backend/(.*)"
    )
    route = re.compile(r"^/api/backend(?:/(.*))$")
    for path in (
        "/api/backend/jobs/:jobId/fitment/catalogue/regions",
        "/api/backend/jobs/:jobId/fitment/vehicle-variants/apply",
        "/api/backend/jobs/:jobId/assets/car_original/download",
        "/api/backend/jobs/:jobId/assets/rim_original/download",
        "/api/backend/foo/bar/baz",
    ):
        match = route.fullmatch(path)
        assert match is not None
        assert match.group(1) == path.removeprefix("/api/backend/")
    assert source == "/api/backend/(.*)"


def test_vercel_project_binding_is_not_tracked() -> None:
    assert not (ROOT / ".vercel" / "project.json").exists()
