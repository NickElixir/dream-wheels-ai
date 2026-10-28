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
        'SUPABASE_URL=https://testproject.supabase.co\\n'
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
        EXPECTED_SUPABASE_URL="https://testproject.supabase.co",
        TEST_BACKEND_URL=backend,
        TEST_BUILD_FAIL=str(int(build_fails)),
    )
    subprocess.run(["bash", "-e", "-c", verify["run"]], cwd=tmp_path, env=env, check=True)
    result = subprocess.run(["bash", "-e", "-c", build["run"]], cwd=tmp_path, env=env)
    assert (result.returncode != 0) is build_fails
    config = (tmp_path / "webapp/auth/harness-config.js").read_text()
    assert '"url":"https://testproject.supabase.co"' in config
    assert "sb_publishable_test" in config
    cleanup = next(
        step for step in steps if step.get("name") == "Clean up pulled Vercel environment"
    )
    assert cleanup["if"] == "always()"
    assert steps.index(cleanup) > steps.index(build)
    subprocess.run(["bash", "-e", "-c", cleanup["run"]], cwd=tmp_path, env=env, check=True)
    assert not list((tmp_path / ".vercel").glob(".env.*.local"))
