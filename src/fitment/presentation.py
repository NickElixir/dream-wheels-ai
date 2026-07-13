"""Черновые русские тексты для машинных кодов вердикта.

API отдаёт машинные коды (handoff: no final Russian UI prose in backend
contract). Эти тексты — вспомогательный черновик для бота/отладки; финальную
UI-копию утверждает продукт отдельно.
"""

from __future__ import annotations

from src.fitment.schemas import FitmentVerdict, ReasonCode, RiskAssessment, VerdictStatus

_STATUS_TITLES: dict[VerdictStatus, str] = {
    VerdictStatus.compatible: "Предварительно совместимо",
    VerdictStatus.compatible_with_conditions: "Совместимо при условиях",
    VerdictStatus.unknown: "Недостаточно данных для оценки",
    VerdictStatus.incompatible: "Несовместимо по известным параметрам",
}

_REASON_TEXTS: dict[ReasonCode, str] = {
    ReasonCode.bolt_count_mismatch: "Не совпадает количество крепёжных отверстий",
    ReasonCode.pcd_mismatch: "Не совпадает разболтовка (PCD)",
    ReasonCode.center_bore_too_small: "Центральное отверстие диска меньше ступицы",
    ReasonCode.diameter_out_of_range: "Диаметр вне допустимого диапазона",
    ReasonCode.width_out_of_range: "Ширина вне допустимого диапазона",
    ReasonCode.offset_out_of_range: "Вылет (ET) вне допустимого диапазона",
    ReasonCode.load_rating_insufficient: "Недостаточная грузоподъёмность диска",
    ReasonCode.fastener_incompatible: "Несовместимая система крепежа",
    ReasonCode.hub_rings_required: "Потребуются центровочные кольца",
    ReasonCode.offset_deviation_check_required: "Вылет отличается от штатного — нужна проверка зазоров",
    ReasonCode.width_deviation_check_required: "Ширина отличается — нужна проверка зазоров",
    ReasonCode.non_approved_size_check_required: "Размер вне заводского списка — нужна проверка на месте",
    ReasonCode.fastener_hardware_check_required: "Нужно подтвердить комплект крепежа",
    ReasonCode.offset_not_verified: "Вылет (ET) не удалось подтвердить",
    ReasonCode.vehicle_not_resolved: "Автомобиль не найден в базе данных",
    ReasonCode.pcd_unknown: "Разболтовка не подтверждена",
    ReasonCode.center_bore_unknown: "Центральное отверстие не подтверждено",
    ReasonCode.offset_unknown: "Вылет (ET) не подтверждён",
    ReasonCode.size_unknown: "Размер диска не подтверждён",
    ReasonCode.load_rating_unknown: "Грузоподъёмность не подтверждена",
    ReasonCode.fastener_unknown: "Система крепежа не подтверждена",
    ReasonCode.conflict_low_evidence: "Обнаружено расхождение, но данные не подтверждены",
    ReasonCode.allowed_set_empty: "Нет заводских конфигураций для сравнения",
    ReasonCode.matches_approved_fitment: "Совпадает с заводской конфигурацией",
}

DISCLAIMER = (
    "Предварительная оценка по справочным данным. "
    "Перед покупкой подтвердите установку у специалиста."
)


def verdict_display(verdict: FitmentVerdict) -> dict:
    """Черновой display-блок: заголовок, причины, условия, дисклеймер."""
    return {
        "title": _STATUS_TITLES[verdict.status],
        "reasons": [_REASON_TEXTS.get(code, code.value) for code in verdict.reason_codes],
        "conditions": [_REASON_TEXTS.get(code, code.value) for code in verdict.condition_codes],
        "missing_fields": verdict.missing_fields,
        "disclaimer": DISCLAIMER,
        "is_draft_copy": True,
    }


def preliminary_display(verdict: FitmentVerdict, fit_likelihood: float) -> dict:
    display = verdict_display(verdict)
    display.update(
        {
            "stage": "preliminary",
            "fit_likelihood": fit_likelihood,
            "disclaimer_code": "preliminary_vlm_guess_only",
            "next_step_code": "confirm_data_for_full_check",
        }
    )
    return display


def confirmed_display(verdict: FitmentVerdict, risk: RiskAssessment) -> dict:
    display = verdict_display(verdict)
    display.update(
        {
            "stage": "confirmed",
            "risk_score": risk.score,
            "risk_level": risk.level.value,
            "blocking_parameters": risk.blocking_parameters,
            "recommendation_codes": risk.recommendation_codes,
            "recommendations": risk.recommendations,
            "disclaimer_code": "specialist_verification_required",
        }
    )
    return display
