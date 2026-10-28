"""Отдельные детерминированные проверки: (FitmentProfile, RimSpec) → RuleResult.

Ключевые инварианты (handoff §Rule baseline):
- incompatible только при доверенном evidence (E3+) с обеих сторон конфликта;
  конфликт на E1/E2 (VLM/OCR/неподтверждённый ввод) → unknown + conflict_low_evidence;
- отсутствие критичного значения → unknown, никогда не positive;
- ET неизвестен → максимум "size matched, offset not verified", не compatible.
"""

from __future__ import annotations

from src.fitment.rules import tolerances as tol
from src.fitment.schemas import (
    AxleFitment,
    FieldValue,
    FitmentProfile,
    ReasonCode,
    RimSpec,
    RuleResult,
    VerdictStatus,
)


def _close(a: float, b: float, tolerance: float) -> bool:
    return abs(a - b) <= tolerance


def _conflict_status(field: FieldValue) -> tuple[VerdictStatus, ReasonCode | None]:
    """Конфликт есть; жёсткость зависит от доверия к значению диска.

    Профиль провайдера считается доверенным (E3) по определению.
    """
    if field.is_trusted:
        return VerdictStatus.incompatible, None
    return VerdictStatus.unknown, ReasonCode.conflict_low_evidence


def check_bolt_pattern(profile: FitmentProfile, rim: RimSpec, axle: str) -> RuleResult:
    rule = "bolt_pattern"
    if profile.bolt_count is None or profile.pcd_mm is None:
        return RuleResult(
            rule=rule,
            status=VerdictStatus.unknown,
            reason_code=ReasonCode.pcd_unknown,
            axle=axle,
            detail={"missing": "vehicle bolt pattern"},
        )
    if not rim.bolt_count.is_known or not rim.pcd_mm.is_known:
        return RuleResult(
            rule=rule,
            status=VerdictStatus.unknown,
            reason_code=ReasonCode.pcd_unknown,
            axle=axle,
            detail={"missing": "rim bolt pattern"},
        )
    if not rim.bolt_count.is_trusted or not rim.pcd_mm.is_trusted:
        return RuleResult(
            rule=rule,
            status=VerdictStatus.unknown,
            reason_code=ReasonCode.conflict_low_evidence,
            axle=axle,
            detail={"missing": "trusted rim bolt pattern"},
        )

    bolt_conflict = rim.bolt_count.value != profile.bolt_count
    pcd_conflict = not _close(rim.pcd_mm.value, profile.pcd_mm, tol.PCD_TOL_MM)
    if not bolt_conflict and not pcd_conflict:
        return RuleResult(
            rule=rule,
            status=VerdictStatus.compatible,
            reason_code=ReasonCode.matches_approved_fitment,
            axle=axle,
        )

    weakest = rim.bolt_count if bolt_conflict else rim.pcd_mm
    status, low_evidence_code = _conflict_status(weakest)
    reason = ReasonCode.bolt_count_mismatch if bolt_conflict else ReasonCode.pcd_mismatch
    return RuleResult(
        rule=rule,
        status=status,
        reason_code=low_evidence_code or reason,
        axle=axle,
        detail={
            "vehicle": {"bolt_count": profile.bolt_count, "pcd_mm": profile.pcd_mm},
            "rim": {"bolt_count": rim.bolt_count.value, "pcd_mm": rim.pcd_mm.value},
        },
    )


def check_center_bore(profile: FitmentProfile, rim: RimSpec, axle: str) -> RuleResult:
    rule = "center_bore"
    if profile.center_bore_mm is None or not rim.center_bore_mm.is_known:
        return RuleResult(
            rule=rule,
            status=VerdictStatus.unknown,
            reason_code=ReasonCode.center_bore_unknown,
            axle=axle,
        )
    if not rim.center_bore_mm.is_trusted:
        return RuleResult(
            rule=rule,
            status=VerdictStatus.unknown,
            reason_code=ReasonCode.conflict_low_evidence,
            axle=axle,
            detail={"missing": "trusted rim center bore"},
        )

    hub = profile.center_bore_mm
    bore = rim.center_bore_mm.value
    detail = {"hub_bore_mm": hub, "rim_bore_mm": bore}

    if _close(bore, hub, tol.CB_TOL_MM):
        return RuleResult(
            rule=rule,
            status=VerdictStatus.compatible,
            reason_code=ReasonCode.matches_approved_fitment,
            axle=axle,
            detail=detail,
        )
    if bore < hub:
        status, low_evidence_code = _conflict_status(rim.center_bore_mm)
        return RuleResult(
            rule=rule,
            status=status,
            reason_code=low_evidence_code or ReasonCode.center_bore_too_small,
            axle=axle,
            detail=detail,
        )
    # Больше ступицы: сядет с центровочными кольцами — известное, объяснимое условие.
    return RuleResult(
        rule=rule,
        status=VerdictStatus.compatible_with_conditions,
        reason_code=ReasonCode.hub_rings_required,
        axle=axle,
        detail=detail,
    )


def _best_size_match(
    allowed: list[AxleFitment], diameter: float, width: float
) -> AxleFitment | None:
    for rec in allowed:
        if _close(rec.rim_diameter, diameter, tol.DIAMETER_TOL_IN) and _close(
            rec.rim_width, width, tol.WIDTH_TOL_IN
        ):
            return rec
    return None


def check_size_and_offset(profile: FitmentProfile, rim: RimSpec, axle: str) -> RuleResult:
    """Размер (diameter/width) и ET против approved-набора провайдера для оси.

    Standard V1 evaluates ET only against the exact provider-derived interval
    for this axle, diameter and width. It does not model physical clearance,
    so an ET outside that interval is unknown rather than a positive
    conditional result or a hard incompatibility.
    """
    rule = "size_offset"
    allowed = profile.allowed_for_axle(axle)
    if not allowed:
        return RuleResult(
            rule=rule,
            status=VerdictStatus.unknown,
            reason_code=ReasonCode.allowed_set_empty,
            axle=axle,
        )

    if not rim.wheel_diameter_in.is_known or not rim.wheel_width_j.is_known:
        return RuleResult(
            rule=rule,
            status=VerdictStatus.unknown,
            reason_code=ReasonCode.size_unknown,
            axle=axle,
        )
    if not rim.wheel_diameter_in.is_trusted or not rim.wheel_width_j.is_trusted:
        return RuleResult(
            rule=rule,
            status=VerdictStatus.unknown,
            reason_code=ReasonCode.conflict_low_evidence,
            axle=axle,
            detail={"missing": "trusted rim diameter and width"},
        )

    diameter = rim.wheel_diameter_in.value
    width = rim.wheel_width_j.value
    match = _best_size_match(allowed, diameter, width)

    if match is None:
        # A Wheel-Size allowed set is not a clearance model for adjacent sizes.
        # In particular, without tyre, brake and body-clearance evidence, no
        # invented distance from the nearest size can turn into a hard conflict
        # or a positive verdict.
        return RuleResult(
            rule=rule,
            status=VerdictStatus.unknown,
            reason_code=ReasonCode.size_not_in_reference,
            axle=axle,
            detail={
                "rim_diameter_in": diameter,
                "rim_width_j": width,
                "reference_sizes": [
                    {"rim_diameter_in": item.rim_diameter, "rim_width_j": item.rim_width}
                    for item in allowed
                ],
            },
        )

    # Размер approved. Дальше — ET.
    if not rim.offset_et_mm.is_known:
        return RuleResult(
            rule=rule,
            status=VerdictStatus.unknown,
            reason_code=ReasonCode.rim_offset_missing,
            axle=axle,
            detail={"matched": match.model_dump()},
        )
    if not rim.offset_et_mm.is_trusted:
        return RuleResult(
            rule=rule,
            status=VerdictStatus.unknown,
            reason_code=ReasonCode.conflict_low_evidence,
            axle=axle,
            detail={"missing": "trusted rim offset"},
        )

    reference = profile.offset_reference_for(axle, diameter, width)
    if reference is None:
        return RuleResult(
            rule=rule,
            status=VerdictStatus.unknown,
            reason_code=ReasonCode.vehicle_reference_offset_missing,
            axle=axle,
            detail={"matched": match.model_dump(), "missing": "reference offset"},
        )

    if rim.offset_et_mm.value < reference.et_min_mm:
        delta = rim.offset_et_mm.value - reference.et_min_mm
    elif rim.offset_et_mm.value > reference.et_max_mm:
        delta = rim.offset_et_mm.value - reference.et_max_mm
    else:
        delta = 0
    detail = {
        "rim_et_mm": rim.offset_et_mm.value,
        "reference_et_min_mm": reference.et_min_mm,
        "reference_et_max_mm": reference.et_max_mm,
        "reference_type": reference.reference_type,
        "rim_diameter_in": diameter,
        "rim_width_j": width,
        "delta_mm": round(delta, 1),
    }

    if delta == 0:
        return RuleResult(
            rule=rule,
            status=VerdictStatus.compatible,
            reason_code=ReasonCode.matches_approved_fitment,
            axle=axle,
            detail=detail,
        )
    return RuleResult(
        rule=rule,
        status=VerdictStatus.unknown,
        reason_code=ReasonCode.et_outside_reference_range,
        axle=axle,
        detail=detail,
    )


def check_fasteners(profile: FitmentProfile, rim: RimSpec, axle: str) -> RuleResult:
    """Система крепежа. Автоматически не рекомендуем «другой крепёж» (handoff):

    несовпадение системы → условие «подтвердить пакет крепежа», не подбор.
    """
    rule = "fasteners"
    if profile.fastener_type is None or not rim.fastener_system.is_known:
        return RuleResult(
            rule=rule,
            status=VerdictStatus.unknown,
            reason_code=ReasonCode.fastener_unknown,
            axle=axle,
        )
    if not rim.fastener_system.is_trusted:
        return RuleResult(
            rule=rule,
            status=VerdictStatus.unknown,
            reason_code=ReasonCode.conflict_low_evidence,
            axle=axle,
            detail={"missing": "trusted rim fastener system"},
        )
    vehicle_system = profile.fastener_type.strip().lower()
    rim_system = str(rim.fastener_system.value).strip().lower()
    if vehicle_system == rim_system:
        return RuleResult(
            rule=rule,
            status=VerdictStatus.compatible,
            reason_code=ReasonCode.matches_approved_fitment,
            axle=axle,
        )
    return RuleResult(
        rule=rule,
        status=VerdictStatus.compatible_with_conditions,
        reason_code=ReasonCode.fastener_hardware_check_required,
        axle=axle,
        detail={"vehicle": vehicle_system, "rim": rim_system},
    )


def check_load_rating(profile: FitmentProfile, rim: RimSpec, axle: str) -> RuleResult:
    """Нагрузка: у Wheel-Size нет требуемой нагрузки per-axle в базовом профиле →
    честный unknown, если сравнивать не с чем."""
    rule = "load_rating"
    if not rim.load_rating_kg.is_known:
        return RuleResult(
            rule=rule,
            status=VerdictStatus.unknown,
            reason_code=ReasonCode.load_rating_unknown,
            axle=axle,
        )
    # Данных о требуемой нагрузке в профиле нет — фиксируем как unknown-правило,
    # чтобы вердикт не завышался. Появится источник — добавить сравнение здесь.
    return RuleResult(
        rule=rule,
        status=VerdictStatus.unknown,
        reason_code=ReasonCode.load_rating_unknown,
        axle=axle,
        detail={"rim_load_kg": rim.load_rating_kg.value, "missing": "required axle load"},
    )


ALL_CHECKS = (
    check_bolt_pattern,
    check_center_bore,
    check_size_and_offset,
    check_fasteners,
)
