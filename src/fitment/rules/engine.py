"""Прогон детерминированных проверок по осям.

Staggered-поддержка: front и rear проверяются каждый против своей оси
approved-набора. Для square-сетапа rear-спека равна front — проверки всё
равно прогоняются по обеим осям (наборы могут отличаться).
"""

from __future__ import annotations

from src.fitment.rules.checks import (
    check_bolt_pattern,
    check_center_bore,
    check_size_and_offset,
)
from src.fitment.rules.tolerances import ENGINE_VERSION
from src.fitment.schemas import FitmentProfile, RimSetup, RuleResult

# Правила, unknown в которых блокирует позитивный вердикт (критичные данные).
CRITICAL_RULES = {"bolt_pattern", "center_bore", "size_offset"}

# Standard V1 is intentionally limited to PCD, DIA, diameter, width and ET.
# Additional rule implementations remain available for a separately approved
# Extended ruleset, but must never leak into a Standard result payload.
STANDARD_RULES = (
    check_bolt_pattern,
    check_center_bore,
    check_size_and_offset,
)


class CompatibilityEngine:
    """Deterministic V1 evaluator over a normalized Wheel Size reference.

    This boundary deliberately accepts canonical RimSpec values only. Parser
    candidates are not inputs here; their value becomes usable only after the
    canonical field has been confirmed by the user or another trusted source.
    """

    version = ENGINE_VERSION

    rules = STANDARD_RULES

    def evaluate(self, profile: FitmentProfile, setup: RimSetup) -> list[RuleResult]:
        results: list[RuleResult] = []
        for axle, rim in (("front", setup.front), ("rear", setup.rear)):
            results.extend(rule(profile, rim, axle) for rule in self.rules)
        return results


def run_checks(profile: FitmentProfile, setup: RimSetup) -> list[RuleResult]:
    """Compatibility wrapper retained for existing API callers."""
    return CompatibilityEngine().evaluate(profile, setup)
