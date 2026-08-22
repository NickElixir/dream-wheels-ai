"""Прогон детерминированных проверок по осям.

Staggered-поддержка: front и rear проверяются каждый против своей оси
approved-набора. Для square-сетапа rear-спека равна front — проверки всё
равно прогоняются по обеим осям (наборы могут отличаться).
"""

from __future__ import annotations

from src.fitment.rules.checks import (
    check_bolt_pattern,
    check_center_bore,
    check_fasteners,
    check_load_rating,
    check_size_and_offset,
)
from src.fitment.rules.tolerances import ENGINE_VERSION
from src.fitment.schemas import FitmentProfile, RimSetup, RuleResult

# Правила, unknown в которых блокирует позитивный вердикт (критичные данные).
CRITICAL_RULES = {"bolt_pattern", "center_bore", "size_offset"}


class CompatibilityEngine:
    """Deterministic V1 evaluator over a normalized Wheel Size reference.

    This boundary deliberately accepts canonical RimSpec values only. Parser
    candidates are not inputs here; their value becomes usable only after the
    canonical field has been confirmed by the user or another trusted source.
    """

    version = ENGINE_VERSION

    def evaluate(self, profile: FitmentProfile, setup: RimSetup) -> list[RuleResult]:
        results: list[RuleResult] = []
        for axle, rim in (("front", setup.front), ("rear", setup.rear)):
            results.extend(
                (
                    check_bolt_pattern(profile, rim, axle),
                    check_center_bore(profile, rim, axle),
                    check_size_and_offset(profile, rim, axle),
                    check_fasteners(profile, rim, axle),
                    check_load_rating(profile, rim, axle),
                )
            )
        return results


def run_checks(profile: FitmentProfile, setup: RimSetup) -> list[RuleResult]:
    """Compatibility wrapper retained for existing API callers."""
    return CompatibilityEngine().evaluate(profile, setup)
