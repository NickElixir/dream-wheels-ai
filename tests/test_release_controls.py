import asyncio

import httpx
import pytest

from scripts.check_release_backend import verify_release
from src import main


def test_maintenance_blocks_requests_before_any_route(monkeypatch):
    monkeypatch.setattr(main, "APP_MAINTENANCE", True)
    monkeypatch.setenv("RENDER_GIT_COMMIT", "a" * 40)

    async def run():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=main.app), base_url="http://test"
        ) as client:
            for method, path in [
                ("GET", "/payments/cabinet"),
                ("POST", "/jobs"),
                ("POST", "/payments/robokassa/result"),
                ("GET", "/health/"),
                ("POST", "/health"),
            ]:
                result = await client.request(method, path)
                assert result.status_code == 503
                assert result.headers["retry-after"] == "60"
            response = await client.get("/health/release")
            data = response.json()
            assert data["commit"] == "a" * 40
            assert data["maintenance"] is True
            assert data["payments_enabled"] is main.PAYMENTS_ENABLED
            assert data["worker_enabled"] is False
            assert data["bot_enabled"] is False
            assert data["payment_timeout_enabled"] is False
            assert (await client.get("/health")).json() == {"status": "ok"}

    asyncio.run(run())


def test_release_gate_rejects_wrong_commit_and_writers():
    sha = "a" * 40
    valid = dict(
        status="ok",
        commit=sha,
        maintenance=True,
        payments_test_mode=False,
        payments_enabled=False,
        worker_enabled=False,
        bot_enabled=False,
        payment_timeout_enabled=False,
    )
    verify_release(valid, sha)
    verify_release(valid | {"payments_test_mode": True}, sha)
    for key, value in [
        ("commit", "b" * 40),
        ("maintenance", False),
        ("payments_test_mode", None),
        ("payments_enabled", True),
        ("payments_enabled", None),
        ("worker_enabled", True),
        ("bot_enabled", True),
        ("payment_timeout_enabled", True),
    ]:
        with pytest.raises(ValueError):
            verify_release(valid | {key: value}, sha)
    with pytest.raises(ValueError):
        verify_release(valid, "main")


def test_maintenance_never_starts_background_writers(monkeypatch):
    monkeypatch.setattr(main, "APP_MAINTENANCE", True)
    monkeypatch.setattr(main, "WORKER_ENABLED", True)
    monkeypatch.setattr(main, "PAYMENT_TIMEOUT_ENABLED", True)
    monkeypatch.setattr(main, "REDIS_URL", None)
    monkeypatch.setattr(main, "worker_task", None)

    async def noop():
        pass

    def forbidden(*_args, **_kwargs):
        raise AssertionError("Maintenance must not start a writer task")

    monkeypatch.setattr(main.db, "init_pool", noop)
    monkeypatch.setattr(main.db, "close_pool", noop)
    monkeypatch.setattr(main.asyncio, "create_task", forbidden)
    monkeypatch.setattr(main.redis_client, "is_initialized", lambda: False)

    async def run():
        async with main.lifespan(main.app):
            pass

    asyncio.run(run())


@pytest.mark.parametrize("flags", [{"APP_MAINTENANCE": "TRUE"}, {"BOT_ENABLED": "false"}])
def test_start_script_api_only_never_launches_bot(tmp_path, flags):
    import os
    import subprocess
    from pathlib import Path

    stub = tmp_path / "uvicorn"
    marker = tmp_path / "api-started"
    stub.write_text('#!/bin/sh\nprintf "%s" "$*" > "$CAPTURE_FILE"\n')
    stub.chmod(0o700)
    env = dict(
        os.environ,
        PATH=str(tmp_path) + os.pathsep + os.environ["PATH"],
        CAPTURE_FILE=str(marker),
        APP_MAINTENANCE="false",
        BOT_ENABLED="true",
    )
    env.update(flags)
    subprocess.run(
        ["bash", str(Path(__file__).resolve().parents[1] / "start.sh")], env=env, check=True
    )
    assert marker.read_text().startswith("src.main:app")


def test_workflow_production_is_manual_and_backend_gated():
    from pathlib import Path

    import yaml

    workflow = yaml.safe_load(
        (Path(__file__).resolve().parents[1] / ".github/workflows/deploy-frontends.yml").read_text()
    )
    triggers = workflow.get("on", workflow.get(True))
    assert triggers["push"]["branches"] == ["staging"]
    for job in ("deploy-production", "deploy-admin"):
        config = workflow["jobs"][job]
        assert "verify-production-backend" in config["needs"]
        assert "workflow_dispatch" in config["if"]
        assert (
            config["steps"][0]["with"]["ref"]
            == "${{ needs.verify-production-backend.outputs.sha }}"
        )
    assert "git rev-parse origin/main" in str(workflow["jobs"]["verify-production-backend"])


@pytest.mark.parametrize("maintenance,enabled", [(True, True), (False, False)])
def test_direct_bot_entrypoint_honors_runtime_profile(monkeypatch, maintenance, enabled):
    from src import bot

    monkeypatch.setattr(bot, "APP_MAINTENANCE", maintenance)
    monkeypatch.setattr(bot, "BOT_ENABLED", enabled)

    def forbidden():
        raise AssertionError("Bot must not create an application while disabled")

    monkeypatch.setattr(bot.Application, "builder", forbidden)
    bot.main()
