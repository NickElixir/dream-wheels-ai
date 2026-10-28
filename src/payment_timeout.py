"""Periodic payment maintenance hosted by the existing API process."""

import asyncio
import logging

from src import db
from src.payments_service import cancel_expired_pending_payments

logger = logging.getLogger(__name__)
PAYMENT_TIMEOUT_SCAN_INTERVAL_SECONDS = 60


async def payment_timeout_loop() -> None:
    while True:
        try:
            async with db.get_pool().acquire() as conn:
                cancelled = await cancel_expired_pending_payments(conn)
            logger.info("payment_timeout_batch cancelled=%s", cancelled)
        except Exception:
            logger.exception("Payment timeout batch failed; next scheduled scan will retry")
        await asyncio.sleep(PAYMENT_TIMEOUT_SCAN_INTERVAL_SECONDS)
