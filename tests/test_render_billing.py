import pytest

from src.render_billing import render_billing_status


@pytest.mark.parametrize(
    "changes,expected",
    [
        ({}, "reserved"),
        ({"credit_status": "finalized", "finalize_count": 1}, "charged"),
        ({"credit_status": "refunded", "refund_count": 1, "refund_delta": 1}, "refunded"),
        ({"status": "failed"}, "reserved"),
        ({"credit_status": "not_charged", "reserve_count": 0}, "unknown"),
        ({"credit_status": "refunded"}, "unknown"),
        ({"credit_status": "refunded", "refund_count": 1, "refund_delta": 0}, "unknown"),
        (
            {
                "credit_status": "refunded",
                "refund_count": 1,
                "refund_delta": 1,
                "finalize_count": 1,
            },
            "unknown",
        ),
        ({"reserve_count": 2}, "unknown"),
        ({"reserve_delta": -2}, "unknown"),
        (
            {
                "credit_cost": 2,
                "reserve_delta": -2,
                "credit_status": "refunded",
                "refund_count": 1,
                "refund_delta": 1,
            },
            "unknown",
        ),
    ],
)
def test_billing_requires_consistent_job_and_ledger(changes, expected):
    row = dict(
        status="processing",
        credit_status="reserved",
        credit_cost=1,
        reserve_count=1,
        reserve_delta=-1,
        refund_count=0,
        refund_delta=None,
        finalize_count=0,
    )
    row.update(changes)
    assert render_billing_status(row) == expected


def test_legacy_no_evidence_is_unknown():
    assert render_billing_status({"status": "failed"}) == "unknown"
