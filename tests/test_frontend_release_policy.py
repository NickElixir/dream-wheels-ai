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
        ".github/workflows/ci.yml",
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


@pytest.mark.parametrize("failure", [None, "staging", "main", "marker", "network"])
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
        return {"build": "d" * 40 if failure == "staging" else tested, "profile": "ru-test"}

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
