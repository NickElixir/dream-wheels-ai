"""Conservative job billing projection from a single database snapshot."""

from collections.abc import Mapping
from typing import Literal

RenderBillingStatus = Literal["reserved", "charged", "refunded", "unknown"]


def billing_evidence_select() -> str:
    return """
        jobs.credit_status, jobs.credit_cost,
        (SELECT SUM(credits_delta) FROM credit_ledger
         WHERE related_job_id = jobs.id AND event_type = 'job_reserve') AS reserve_delta,
        (SELECT COUNT(*) FROM credit_ledger
         WHERE related_job_id = jobs.id AND event_type = 'job_reserve') AS reserve_count,
        (SELECT SUM(credits_delta) FROM credit_ledger
         WHERE related_job_id = jobs.id AND event_type = 'job_refund') AS refund_delta,
        (SELECT COUNT(*) FROM credit_ledger
         WHERE related_job_id = jobs.id AND event_type = 'job_refund') AS refund_count,
        (SELECT COUNT(*) FROM credit_ledger
         WHERE related_job_id = jobs.id AND event_type = 'job_finalize'
           AND credits_delta = 0) AS finalize_count
    """


def render_billing_status(row: Mapping[str, object]) -> RenderBillingStatus:
    cost = row.get("credit_cost")
    if not isinstance(cost, int) or cost <= 0:
        return "unknown"
    if row.get("reserve_count") != 1 or row.get("reserve_delta") != -cost:
        return "unknown"
    refunded = row.get("refund_count")
    finalized = row.get("finalize_count")
    credit_status = row.get("credit_status")
    if credit_status == "reserved" and refunded == 0 and finalized == 0:
        return "reserved"
    if credit_status == "finalized" and finalized == 1 and refunded == 0:
        return "charged"
    if (
        credit_status == "refunded"
        and refunded == 1
        and row.get("refund_delta") == cost
        and finalized == 0
    ):
        return "refunded"
    return "unknown"
