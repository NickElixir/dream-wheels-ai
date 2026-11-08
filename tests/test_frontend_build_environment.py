import json
import os
import shutil
import subprocess
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize("job_name", ["deploy-staging", "deploy-production", "deploy-preview"])
@pytest.mark.parametrize("build_fails", [False, True])
def test_pulled_environment_survives_until_build_and_is_always_cleaned(
    tmp_path: Path, job_name: str, build_fails: bool
) -> None:
    workflow = yaml.safe_load((ROOT / ".github/workflows/deploy-frontends.yml").read_text())
    steps = workflow["jobs"][job_name]["steps"]
    verify = next(step for step in steps if "environment before build" in step.get("name", ""))
    build = next(step for step in steps if step.get("name", "").startswith("Build "))

    scripts = tmp_path / "webapp/scripts"
    scripts.mkdir(parents=True)
    (tmp_path / "webapp/auth").mkdir()
    shutil.copy(ROOT / "webapp/scripts/build-public-config.mjs", scripts)
    catalog_target = "production" if job_name == "deploy-production" else "staging"
    data_root = ROOT / "landing/src/data"
    destination = tmp_path / "landing/src/data"
    destination.mkdir(parents=True)
    for name in [
        "catalog-storage",
        "catalog-publications",
        "catalog-asset-registry",
        "catalog-reconciliation",
        "catalog-primary-skus",
    ]:
        shutil.copy(data_root / f"{name}.json", destination)
    guard = tmp_path / "scripts/catalog"
    guard.mkdir(parents=True)
    shutil.copy(ROOT / "scripts/catalog/verify-build.mjs", guard)
    generated = tmp_path / "webapp/vnext"
    generated.mkdir()
    shutil.copy(ROOT / "webapp/vnext/catalog-data.mjs", generated)
    storage_config = json.loads((data_root / "catalog-storage.json").read_text())
    publications = json.loads((data_root / "catalog-publications.json").read_text())
    origin = storage_config["targets"][catalog_target]["origin"]
    manifest = {
        "catalogAssetRegistry": json.loads((data_root / "catalog-asset-registry.json").read_text()),
        "catalogStorageTarget": storage_config["targets"][catalog_target],
        "catalogBucket": storage_config["bucket"],
        "catalogPublication": publications[catalog_target],
    }
    (generated / "catalog-assets.mjs").write_text(
        "".join(f"export const {key} = {json.dumps(value)};\n" for key, value in manifest.items())
    )
    tools = tmp_path / "bin"
    tools.mkdir()
    cli = tools / "vercel"
    cli.write_text(
        """#!/usr/bin/env python3
import os
import subprocess
import sys
from pathlib import Path

target = 'preview' if '--environment=preview' in sys.argv or '--prod' not in sys.argv else 'production'
if sys.argv[1] == 'whoami':
    print('test-user')
elif sys.argv[1:3] == ['env', 'ls']:
    print('header\\nheader\\nBACKEND_URL')
elif sys.argv[1] == 'pull':
    target = 'preview' if '--environment=preview' in sys.argv else 'production'
    folder = Path('.vercel')
    folder.mkdir(exist_ok=True)
    (folder / f'.env.{target}.local').write_text(
        'BACKEND_URL=' + os.environ['TEST_BACKEND_URL'] + '\\n'
        'SUPABASE_URL=' + os.environ['TEST_SUPABASE_URL'] + '\\n'
        'SUPABASE_PUBLISHABLE_KEY=sb_publishable_test\\n'
        'TURNSTILE_SITE_KEY=test-site-key\\n'
    )
elif sys.argv[1] == 'build':
    env_file = Path('.vercel') / f'.env.{target}.local'
    values = dict(line.split('=', 1) for line in env_file.read_text().splitlines())
    result = subprocess.run(['node', 'webapp/scripts/build-public-config.mjs'], env=dict(os.environ, **values))
    sys.exit(result.returncode or int(os.environ['TEST_BUILD_FAIL']))
else:
    raise SystemExit('Unexpected CLI command')
"""
    )
    cli.chmod(0o700)
    backend = workflow["env"][
        "PRODUCTION_BACKEND_URL" if job_name == "deploy-production" else "STAGING_BACKEND_URL"
    ]
    env = dict(
        os.environ,
        PATH=str(tools) + os.pathsep + os.environ["PATH"],
        VERCEL_TOKEN="test-token",
        VERCEL_ORG_ID="test-org",
        VERCEL_PROJECT_ID="test-project",
        STAGING_BACKEND_URL=workflow["env"]["STAGING_BACKEND_URL"],
        PRODUCTION_BACKEND_URL=workflow["env"]["PRODUCTION_BACKEND_URL"],
        EXPECTED_SUPABASE_URL=origin,
        TEST_SUPABASE_URL=origin,
        CATALOG_BUILD_TARGET=catalog_target,
        VERCEL_ENV="preview" if job_name == "deploy-preview" else "production",
        TEST_BACKEND_URL=backend,
        TEST_BUILD_FAIL=str(int(build_fails)),
    )
    subprocess.run(["bash", "-e", "-c", verify["run"]], cwd=tmp_path, env=env, check=True)
    result = subprocess.run(["bash", "-e", "-c", build["run"]], cwd=tmp_path, env=env)
    assert (result.returncode != 0) is build_fails
    config = (tmp_path / "webapp/auth/harness-config.js").read_text()
    assert f'"url":"{origin}"' in config
    assert "sb_publishable_test" in config
    cleanup = next(
        step for step in steps if step.get("name") == "Clean up pulled Vercel environment"
    )
    assert cleanup["if"] == "always()"
    assert steps.index(cleanup) > steps.index(build)
    subprocess.run(["bash", "-e", "-c", cleanup["run"]], cwd=tmp_path, env=env, check=True)
    assert not list((tmp_path / ".vercel").glob(".env.*.local"))


@pytest.mark.parametrize("job_name", ["deploy-staging", "deploy-preview"])
def test_staging_job_generates_catalog_and_public_config_from_real_source(
    tmp_path: Path, job_name: str
) -> None:
    workflow = yaml.safe_load((ROOT / ".github/workflows/deploy-frontends.yml").read_text())
    steps = workflow["jobs"][job_name]["steps"]
    generate = next(step for step in steps if step.get("name") == "Generate staging catalog bundle")
    backend = next(step for step in steps if "matching staging backend" in step.get("name", ""))
    verify = next(step for step in steps if "environment before build" in step.get("name", ""))
    assert steps.index(backend) < steps.index(generate) < steps.index(verify)
    # The installer is the only substituted boundary; execute the real workflow
    # generator/guard and the real config CLI in a disposable source tree.
    for folder in (
        "landing/scripts",
        "webapp/scripts",
        "webapp/vnext",
        "webapp/auth",
        "scripts/catalog",
    ):
        (tmp_path / folder).mkdir(parents=True, exist_ok=True)
    shutil.copytree(ROOT / "landing/src/data", tmp_path / "landing/src/data")
    shutil.copy(ROOT / "landing/scripts/build-handoff.ts", tmp_path / "landing/scripts")
    shutil.copy(ROOT / "webapp/vnext/catalog-assets.mjs", tmp_path / "webapp/vnext")
    shutil.copy(ROOT / "webapp/vnext/catalog-data.mjs", tmp_path / "webapp/vnext")
    shutil.copy(ROOT / "webapp/scripts/build-public-config.mjs", tmp_path / "webapp/scripts")
    shutil.copy(ROOT / "scripts/catalog/verify-build.mjs", tmp_path / "scripts/catalog")
    (tmp_path / "landing/node_modules").symlink_to(
        ROOT / "landing/node_modules", target_is_directory=True
    )
    tools = tmp_path / "bin"
    tools.mkdir()
    npm = tools / "npm"
    npm.write_text('#!/bin/sh\ntest "$*" = "ci --prefix landing"\n')
    npm.chmod(0o700)
    env = dict(os.environ, PATH=str(tools) + os.pathsep + os.environ["PATH"])
    for name in (
        "EXPECTED_SUPABASE_URL",
        "CATALOG_BUILD_TARGET",
        "TIMEWEB_PROFILE",
        "TIMEWEB_LANDING_PROFILE",
    ):
        env.pop(name, None)
    env["VERCEL_ENV"] = "production" if job_name == "deploy-staging" else "preview"
    result = subprocess.run(
        ["node", "scripts/catalog/verify-build.mjs"],
        cwd=tmp_path,
        env=dict(env, EXPECTED_SUPABASE_URL="https://hnawojlnfoaccinlgjyn.supabase.co"),
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert "deployment target" in result.stderr
    subprocess.run(
        ["bash", "-e", "-c", generate["run"]],
        cwd=tmp_path,
        env=dict(env, **generate["env"]),
        check=True,
    )
    env.update(
        EXPECTED_SUPABASE_URL="https://hnawojlnfoaccinlgjyn.supabase.co",
        SUPABASE_URL="https://hnawojlnfoaccinlgjyn.supabase.co",
        SUPABASE_PUBLISHABLE_KEY="sb_publishable_local_test",
        TURNSTILE_SITE_KEY="local-test",
    )
    subprocess.run(
        ["node", "webapp/scripts/build-public-config.mjs"], cwd=tmp_path, env=env, check=True
    )
    generated = (tmp_path / "webapp/vnext/catalog-assets.mjs").read_text()
    assert '"projectRef":"hnawojlnfoaccinlgjyn"' in generated
    assert '"mode":"published"' in generated.replace(" ", "").replace("\n", "")
    result = subprocess.run(
        ["node", "scripts/catalog/verify-build.mjs"],
        cwd=tmp_path,
        env=dict(env, EXPECTED_SUPABASE_URL="https://qmgyccghsbdpehiybjae.supabase.co"),
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert "deployment target" in result.stderr


def test_staging_backend_gate_is_pinned_and_rejects_old_or_unhealthy_backend() -> None:
    from scripts.check_staging_backend import URL, verify_release

    workflow = yaml.safe_load((ROOT / ".github/workflows/deploy-frontends.yml").read_text())
    assert URL == workflow["env"]["STAGING_BACKEND_URL"] + "/health/release"
    sha = "a" * 40
    verify_release({"status": "ok", "commit": sha}, sha)
    for payload in ({"status": "ok", "commit": "b" * 40}, {"status": "error", "commit": sha}, {}):
        with pytest.raises(ValueError, match="deploy backend first"):
            verify_release(payload, sha)
    with pytest.raises(ValueError, match="full commit SHA"):
        verify_release({"status": "ok", "commit": sha}, "staging")
    assert not any(
        step.get("name") == "Generate staging catalog bundle"
        for step in workflow["jobs"]["deploy-production"]["steps"]
    )
