import asyncio

import pytest

from src import main, payment_timeout


@pytest.mark.parametrize("failure", [False, True])
def test_timeout_loop_repeats_after_success_or_failure_and_can_stop(monkeypatch, failure):
    attempts = []
    scans = []

    class Lease:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return False

    class Pool:
        def acquire(self):
            return Lease()

    async def batch(conn):
        attempts.append(conn)
        if failure:
            raise RuntimeError("isolated batch failure")
        return 1

    async def pause(seconds):
        scans.append(seconds)
        if len(scans) == 2:
            raise asyncio.CancelledError

    monkeypatch.setattr(payment_timeout.db, "get_pool", lambda: Pool())
    monkeypatch.setattr(payment_timeout, "cancel_expired_pending_payments", batch)
    monkeypatch.setattr(payment_timeout.asyncio, "sleep", pause)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(payment_timeout.payment_timeout_loop())
    assert len(attempts) == 2
    assert scans == [payment_timeout.PAYMENT_TIMEOUT_SCAN_INTERVAL_SECONDS] * 2


@pytest.mark.parametrize("enabled", [False, True])
def test_lifespan_stops_timeout_before_closing_pool(monkeypatch, enabled):
    events = []

    async def init():
        events.append("init")

    async def close():
        events.append("close")

    async def loop():
        events.append("start")
        try:
            await asyncio.Event().wait()
        finally:
            events.append("stop")

    monkeypatch.setattr(main, "PAYMENT_TIMEOUT_ENABLED", enabled)
    monkeypatch.setattr(main, "WORKER_ENABLED", False)
    monkeypatch.setattr(main, "REDIS_URL", "")
    monkeypatch.setattr(main.db, "init_pool", init)
    monkeypatch.setattr(main.db, "close_pool", close)
    monkeypatch.setattr(main.redis_client, "is_initialized", lambda: False)
    monkeypatch.setattr(main, "payment_timeout_loop", loop)

    async def scenario():
        async with main.lifespan(main.app):
            await asyncio.sleep(0)

    asyncio.run(scenario())
    assert events == (["init", "start", "stop", "close"] if enabled else ["init", "close"])
