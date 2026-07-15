"""Свёртка RuleResult[] → FitmentVerdict.

Приоритет (handoff §Verdict semantics):
1. подтверждённый жёсткий конфликт            → incompatible
2. нет конфликта, но критичные данные unknown → unknown
3. есть explicit-условия                      → compatible_with_conditions
4. иначе                                      → compatible (preliminary)

Unknown в некритичных правилах (fasteners, load) не блокирует вердикт,
но попадает в missing_fields для честного отображения.
"""

from __future__ import annotations

from src.fitment.rules.engine import CRITICAL_RULES
from src.fitment.rules.tolerances import ENGINE_VERSION, TOLERANCES_VERSION
from src.fitment.schemas import (
    FitmentVerdict,
    ReasonCode,
    RuleResult,
    VerdictStatus,
)

_MISSING_FIELD_BY_REASON = {
    ReasonCode.pcd_unknown: "pcd",
    ReasonCode.center_bore_unknown: "center_bore",
    ReasonCode.offset_unknown: "offset_et",
    ReasonCode.size_unknown: "diameter_width",
    ReasonCode.load_rating_unknown: "load_rating",
    ReasonCode.fastener_unknown: "fastener_system",
    ReasonCode.allowed_set_empty: "provider_allowed_wheels",
    ReasonCode.vehicle_not_resolved: "vehicle_identity",
    ReasonCode.conflict_low_evidence: "trusted_conflict_evidence",
}


def assemble_verdict(
    results: list[RuleResult],
    *,
    provider: str | None,
    is_preliminary: bool = False,
) -> FitmentVerdict:
    incompatible = [r for r in results if r.status == VerdictStatus.incompatible]
    critical_unknown = [
        r for r in results if r.status == VerdictStatus.unknown and r.rule in CRITICAL_RULES
    ]
    conditions = [r for r in results if r.status == VerdictStatus.compatible_with_conditions]
    noncritical_unknown = [
        r for r in results if r.status == VerdictStatus.unknown and r.rule not in CRITICAL_RULES
    ]

    if incompatible:
        status = VerdictStatus.incompatible
        reason_results = incompatible
    elif critical_unknown:
        status = VerdictStatus.unknown
        reason_results = critical_unknown
    elif conditions:
        status = VerdictStatus.compatible_with_conditions
        reason_results = conditions
    else:
        status = VerdictStatus.compatible
        reason_results = []

    def _dedup(codes: list[ReasonCode]) -> list[ReasonCode]:
        seen: set[ReasonCode] = set()
        out: list[ReasonCode] = []
        for code in codes:
            if code not in seen:
                seen.add(code)
                out.append(code)
        return out

    missing: list[str] = []
    for r in critical_unknown + noncritical_unknown:
        field = _MISSING_FIELD_BY_REASON.get(r.reason_code)
        if field and field not in missing:
            missing.append(field)

    return FitmentVerdict(
        status=status,
        rule_results=results,
        reason_codes=_dedup([r.reason_code for r in reason_results]),
        condition_codes=_dedup([r.reason_code for r in conditions]),
        missing_fields=missing,
        engine_version=ENGINE_VERSION,
        tolerances_version=TOLERANCES_VERSION,
        provider=provider,
        is_preliminary=is_preliminary,
    )


def verdict_vehicle_not_resolved(
    *,
    provider: str | None,
    is_preliminary: bool = False,
) -> FitmentVerdict:
    """Профиль провайдера получить не удалось: честный unknown без правил."""
    return FitmentVerdict(
        status=VerdictStatus.unknown,
        rule_results=[],
        reason_codes=[ReasonCode.vehicle_not_resolved],
        condition_codes=[],
        missing_fields=["vehicle_identity"],
        engine_version=ENGINE_VERSION,
        tolerances_version=TOLERANCES_VERSION,
        provider=provider,
        is_preliminary=is_preliminary,
    )
