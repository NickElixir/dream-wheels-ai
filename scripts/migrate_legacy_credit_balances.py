"""Offline cutover for a pre-FIFO database; never run alongside application writers."""

import argparse
import asyncio
import json
import os
import re
from pathlib import Path

import asyncpg

ROOT = Path(__file__).resolve().parents[1]
CUTOVER_KEY = "pre_fifo_permanent_balances_v1"
MIGRATIONS = (
    17,
    18,
    19,
    20,
    21,
    22,
    23,
    24,
    25,
    26,
    28,
    29,
    30,
    31,
    32,
    33,
    34,
    35,
    36,
    37,
    38,
    39,
    40,
    41,
    42,
)


def migration_sql(number: int) -> str:
    sql = next((ROOT / "migrations").glob(f"{number:04d}_*.sql")).read_text()
    # 0037/0040/0041 have standalone wrappers; the cutover owns the outer transaction.
    if number in (37, 40, 41):
        sql = re.sub(r"(?m)^(BEGIN|COMMIT);[ \t]*$", "", sql)
    return sql


async def migrate_legacy_balances(conn: asyncpg.Connection) -> dict[str, object]:
    """Apply the reviewed pre-FIFO sequence with an atomic balance-preserving cutover."""
    async with conn.transaction():
        await conn.execute("SET LOCAL lock_timeout = '10s'")
        await conn.execute("SELECT pg_advisory_xact_lock(724202642)")
        if await conn.fetchval("SELECT to_regclass('public.legacy_credit_balance_cutovers')"):
            if await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM legacy_credit_balance_cutovers WHERE cutover_key=$1)",
                CUTOVER_KEY,
            ):
                return {"status": "already_applied"}
        if await conn.fetchval("SELECT to_regclass('public.credit_packages')"):
            raise RuntimeError(
                "Pre-FIFO cutover requires absent credit_packages; refusing to infer old balances"
            )
        await conn.execute(
            "LOCK TABLE users, jobs, user_credit_accounts, credit_ledger, payments IN ACCESS EXCLUSIVE MODE"
        )
        if await conn.fetchval("SELECT count(*) FROM jobs WHERE credit_status='reserved'"):
            raise RuntimeError("Resolve reserved jobs before the credit cutover")
        balances = [
            dict(row)
            for row in await conn.fetch(
                "SELECT user_id,balance FROM user_credit_accounts ORDER BY user_id"
            )
        ]
        for number in MIGRATIONS:
            await conn.execute(migration_sql(number))
        # Packages made by 0024 represent historical grants, not additional credit.
        await conn.execute("UPDATE credit_packages SET remaining_credits=0")
        for row in balances:
            if row["balance"] > 0:
                await conn.execute(
                    """INSERT INTO credit_packages
                    (user_id,source,credits_granted,remaining_credits,expires_at,idempotency_key)
                    VALUES($1,'legacy_balance',$2,$2,NULL,$3)""",
                    row["user_id"],
                    row["balance"],
                    f"{CUTOVER_KEY}:{row['user_id']}",
                )
            await conn.execute(
                "UPDATE user_credit_accounts SET balance=$2 WHERE user_id=$1",
                row["user_id"],
                row["balance"],
            )
        mismatches = await conn.fetchval("""
            SELECT count(*) FROM user_credit_accounts a WHERE balance <>
            (SELECT coalesce(sum(remaining_credits),0) FROM credit_packages p
             WHERE p.user_id=a.user_id AND (expires_at IS NULL OR expires_at>now()))
        """)
        if mismatches:
            raise RuntimeError("Balance/package reconciliation failed; rolling back cutover")
        await conn.execute(
            "INSERT INTO legacy_credit_balance_cutovers(cutover_key,balances) VALUES($1,$2::jsonb)",
            CUTOVER_KEY,
            json.dumps(balances),
        )
        return {
            "status": "applied",
            "accounts": len(balances),
            "credits": sum(r["balance"] for r in balances),
        }


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", required=True)
    parser.parse_args()
    conn = await asyncpg.connect(os.environ["CREDIT_CUTOVER_DATABASE_URL"], statement_cache_size=0)
    try:
        print(json.dumps(await migrate_legacy_balances(conn)))
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
