"""Rule engine entrypoint."""

from __future__ import annotations

from fitment_verdict.rules.checks import run_all_checks
from fitment_verdict.schemas import FitmentProfile, RimSpec, RuleResult


def evaluate(profile: FitmentProfile | None, rim: RimSpec) -> list[RuleResult]:
    return run_all_checks(profile, rim)
