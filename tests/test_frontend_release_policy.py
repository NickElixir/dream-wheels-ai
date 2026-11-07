import subprocess

import pytest

from scripts.check_frontend_release import verify_health
from scripts.frontend_release_policy import check_paths, verify_sources


@pytest.mark.parametrize(
    "path",
    [
        "webapp/app.js",
        "webapp/auth/app-auth.js",
        "landing/src/pages/index.astro",
        "deploy/timeweb-static/build.mjs",
        "tests/test_auth.py",
        "docs/release.md",
    ],
)
def test_frontend_paths_allowed(path):
    check_paths([path])


@pytest.mark.parametrize(
    "path",
    [
        "src/main.py",
        "migrations/100.sql",
        "requirements.txt",
        "start.sh",
        "render.yaml",
        ".env",
        ".github/workflows/unknown.yml",
        "scripts/unknown.py",
        "webapp/api/backend-gateway.js",
        "webapp/lib/backend-proxy.js",
        "webapp/vercel.json",
        "deploy/gateway/main.ts",
        "new-runtime-file.py",
        "../webapp/app.js",
    ],
)
def test_backend_and_unknown_paths_blocked(path):
    with pytest.raises(ValueError):
        check_paths([path])


def test_health_preserves_active_writer_flags():
    data = dict(
        status="ok",
        commit="a" * 40,
        maintenance=False,
        payments_enabled=True,
        payments_test_mode=False,
        worker_enabled=True,
        bot_enabled=True,
        payment_timeout_enabled=True,
    )
    assert verify_health(data) == "a" * 40
    for patch in ({"status": "error"}, {"maintenance": True}, {"payments_enabled": None}):
        with pytest.raises(ValueError):
            verify_health(data | patch)


def test_source_policy_uses_real_git_history(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)

    def run(*args):
        return subprocess.check_output(["git", *args], text=True).strip()

    run("init", "-q")
    run("config", "user.email", "test@example.invalid")
    run("config", "user.name", "Test")
    (tmp_path / "src").mkdir()
    (tmp_path / "webapp").mkdir()
    (tmp_path / "src/backend.py").write_text("original")
    run("add", ".")
    run("commit", "-qm", "backend")
    backend = run("rev-parse", "HEAD")
    (tmp_path / "webapp/app.js").write_text("frontend")
    run("add", ".")
    run("commit", "-qm", "frontend")
    tested = run("rev-parse", "HEAD")
    run("update-ref", "refs/remotes/origin/staging", tested)
    verify_sources(backend, tested, tested)
    # A post-acceptance frontend edit is also forbidden.
    (tmp_path / "webapp/app.js").write_text("untested")
    run("add", ".")
    run("commit", "-qm", "untested")
    with pytest.raises(subprocess.CalledProcessError):
        verify_sources(backend, run("rev-parse", "HEAD"), tested)
    # Moving a backend file to an allowed directory cannot hide the deletion.
    run("mv", "src/backend.py", "webapp/backend.py")
    run("commit", "-qm", "move backend")
    candidate = run("rev-parse", "HEAD")
    run("update-ref", "refs/remotes/origin/staging", candidate)
    with pytest.raises(ValueError, match="src/backend.py"):
        verify_sources(backend, candidate, candidate)
    with pytest.raises(ValueError, match="full commit"):
        verify_sources("main", candidate, candidate)
    # A backend newer than the candidate cannot be accepted.
    with pytest.raises(subprocess.CalledProcessError):
        verify_sources(candidate, backend, backend)


def test_release_workflows_keep_full_gate_and_recheck_before_publication():
    from pathlib import Path

    import yaml

    root = Path(__file__).resolve().parents[1]
    vercel = yaml.safe_load((root / ".github/workflows/deploy-frontends.yml").read_text())
    inputs = vercel.get("on", vercel.get(True))["workflow_dispatch"]["inputs"]
    assert inputs["release_mode"]["default"] == "full"
    gate = str(vercel["jobs"]["verify-production-backend"])
    assert "scripts/check_release_backend.py" in gate
    assert "scripts.check_frontend_release" in gate
    assert 'test "$DEPLOY_ADMIN" = "false"' in gate
    steps = vercel["jobs"]["deploy-production"]["steps"]
    names = [s.get("name", "") for s in steps]
    assert names.index(
        "Recheck frontend-only compatibility immediately before publication"
    ) < names.index("Deploy exactly one production artifact")
    ru = yaml.safe_load((root / ".github/workflows/ru-release.yml").read_text())
    assert "scripts.check_frontend_release" in str(ru["jobs"]["validate-source"])
    names = [s.get("name", "") for s in ru["jobs"]["timeweb-release"]["steps"]]
    assert names.index(
        "Recheck frontend-only compatibility before changing Timeweb settings"
    ) < names.index("Deploy exact commit or explicit rollback")


@pytest.mark.parametrize("failure", [None, "staging", "en_staging", "main", "marker", "network"])
def test_publication_gate_fails_closed(monkeypatch, failure):
    from scripts import check_frontend_release as gate

    candidate, tested = "a" * 40, "b" * 40
    monkeypatch.setattr("sys.argv", ["gate", candidate, "--tested", tested])
    calls = []

    def fetch(url):
        if failure == "network":
            raise TimeoutError("backend unavailable")
        if url == gate.URL:
            return dict(
                status="ok",
                commit="c" * 40,
                maintenance=False,
                payments_enabled=True,
                payments_test_mode=False,
                worker_enabled=True,
                bot_enabled=False,
                payment_timeout_enabled=True,
            )
        mismatch = failure == "staging" or (failure == "en_staging" and "vercel.app" in url)
        return {"build": "d" * 40 if mismatch else tested, "profile": "ru-test"}

    def git(*args):
        if args[0] == "rev-parse":
            return "d" * 40 if failure == "main" else candidate
        return "release" if failure == "marker" else "release [skip render]"

    monkeypatch.setattr(gate, "fetch_json", fetch)
    monkeypatch.setattr(gate, "git", git)
    monkeypatch.setattr(gate, "verify_sources", lambda *args: calls.append(args))
    if failure:
        with pytest.raises((ValueError, TimeoutError)):
            gate.main()
    else:
        gate.main()
        assert calls == [("c" * 40, candidate, tested)]


@pytest.mark.parametrize(
    "path",
    [
        "webapp/package.json",
        "webapp/package-lock.json",
        "landing/package.json",
        "landing/package-lock.json",
        "landing/middleware.ts",
        "landing/src/middleware.ts",
        "landing/vercel.json",
        "landing/astro.config.mjs",
        "webapp/vite.config.ts",
        "webapp/nested/package.json",
        "landing/pnpm-lock.yaml",
        "landing/.npmrc",
        "webapp/scripts/build-public-config.mjs",
    ],
)
def test_dependencies_and_server_build_configs_blocked(path):
    with pytest.raises(ValueError, match="full release"):
        check_paths([path])


@pytest.mark.parametrize("link_path", ["webapp/app.js", "docs/indirect.js"])
def test_committed_symlink_cannot_supply_unaccepted_runtime(tmp_path, monkeypatch, link_path):
    monkeypatch.chdir(tmp_path)

    def run(*args):
        return subprocess.check_output(["git", *args], text=True).strip()

    run("init", "-q")
    run("config", "user.email", "test@example.invalid")
    run("config", "user.name", "Test")
    (tmp_path / "docs").mkdir()
    (tmp_path / "webapp").mkdir()
    (tmp_path / "docs/runtime.js").write_text("accepted")
    run("add", ".")
    run("commit", "-qm", "backend baseline")
    backend = run("rev-parse", "HEAD")
    (tmp_path / link_path).symlink_to("../docs/runtime.js")
    run("add", ".")
    run("commit", "-qm", "accepted symlink")
    tested = run("rev-parse", "HEAD")
    run("update-ref", "refs/remotes/origin/staging", tested)
    (tmp_path / "docs/runtime.js").write_text("unaccepted executable content")
    run("add", ".")
    run("commit", "-qm", "docs-only change")
    candidate = run("rev-parse", "HEAD")
    # Runtime tree comparison alone cannot see the change.
    run("diff", "--exit-code", tested, candidate, "--", "webapp", "landing", "deploy")
    with pytest.raises(ValueError, match="Symlinks"):
        verify_sources(backend, candidate, tested)


def test_preflight_workflow_uses_trusted_event_without_executing_pr_code():
    from pathlib import Path

    import yaml

    workflow = yaml.safe_load(
        (
            Path(__file__).resolve().parents[1] / ".github/workflows/frontend-release-preflight.yml"
        ).read_text()
    )
    events = workflow.get("on", workflow.get(True))
    assert "pull_request_target" in events
    assert "pull_request" not in events
    assert workflow["permissions"] == {"contents": "read"}
    steps = workflow["jobs"]["compatibility"]["steps"]
    checkout = [step for step in steps if step.get("uses", "").startswith("actions/checkout@")]
    assert len(checkout) == 1
    assert checkout[0]["with"]["ref"] == "${{ github.event.pull_request.base.sha }}"
    assert all("secrets." not in str(step) for step in steps)
    run = steps[-1]["run"]
    assert 'git fetch origin main staging "$HEAD_SHA"' in run
    assert "git checkout" not in run
    assert "--preflight" in run


def test_submodule_tree_is_rejected(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)

    def run(*args):
        return subprocess.check_output(["git", *args], text=True).strip()

    run("init", "-q")
    run("config", "user.email", "test@example.invalid")
    run("config", "user.name", "Test")
    (tmp_path / "docs").mkdir()
    (tmp_path / "docs/a.md").write_text("baseline")
    run("add", ".")
    run("commit", "-qm", "baseline")
    backend = run("rev-parse", "HEAD")
    run("update-index", "--add", "--cacheinfo", f"160000,{backend},docs/external")
    run("commit", "-qm", "gitlink")
    tested = run("rev-parse", "HEAD")
    run("update-ref", "refs/remotes/origin/staging", tested)
    with pytest.raises(ValueError, match="submodules"):
        verify_sources(backend, tested, tested)
