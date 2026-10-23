import asyncio

import pytest
from fastapi import HTTPException

from src import jobs_api


def test_created_response_reads_committed_number_on_each_replay(monkeypatch):
    class Conn:
        number = 12

        async def fetchval(self, query, *args):
            assert query == "SELECT try_on_number FROM jobs WHERE id = $1::uuid AND user_id = $2"
            assert args == ("a-job", 7)
            return self.number

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

    conn = Conn()

    class Pool:
        def acquire(self):
            return conn

    monkeypatch.setattr(jobs_api.db, "get_pool", lambda: Pool())

    async def run():
        first = await jobs_api._created_job_response("a-job", 7)
        replay = await jobs_api._created_job_response("a-job", 7)
        assert first.try_on_number == replay.try_on_number == 12
        conn.number = None
        with pytest.raises(HTTPException) as exc:
            await jobs_api._created_job_response("a-job", 7)
        assert exc.value.status_code == 409

    asyncio.run(run())
