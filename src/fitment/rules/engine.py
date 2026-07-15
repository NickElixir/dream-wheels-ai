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
from src.fitment.schemas import FitmentProfile, RimSetup, RuleResult

# Правила, unknown в которых блокирует позитивный вердикт (критичные данные).
CRITICAL_RULES = {"bolt_pattern", "center_bore", "size_offset"}


def run_checks(profile: FitmentProfile, setup: RimSetup) -> list[RuleResult]:
    results: list[RuleResult] = []
    axles = [("front", setup.front), ("rear", setup.rear)]
    for axle, rim in axles:
        results.append(check_bolt_pattern(profile, rim, axle))
        results.append(check_center_bore(profile, rim, axle))
        results.append(check_size_and_offset(profile, rim, axle))
        results.append(check_fasteners(profile, rim, axle))
        results.append(check_load_rating(profile, rim, axle))
    return results
