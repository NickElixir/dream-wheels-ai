"""Schema serialization smoke test."""

from fitment_verdict.schemas import VerdictStatus


def test_verdict_status_values():
    assert VerdictStatus.incompatible.value == "incompatible"
    assert VerdictStatus.unknown.value == "unknown"
