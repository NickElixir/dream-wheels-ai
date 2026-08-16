"""Pydantic-контракты fitment-пайплайна.

Единый «язык» всех стадий: identification → provider → rules → verdict → API.
Требования из docs/fitment-verdict-pipeline-handoff.md:

- PCD хранится числами (bolt_count=5, pcd_mm=114.3), "5x114.3" — только display;
- каждое техническое значение несёт provenance (source/confidence/is_user_confirmed);
- вердикт отделён от operational-статуса проверки;
- наружу отдаются машинные reason/condition-коды, не финальные русские тексты.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, model_validator


class Source(StrEnum):
    user_input = "user_input"
    user_confirmed = "user_confirmed"
    user_edited = "user_edited"
    product_page = "product_page"
    manufacturer_sku = "manufacturer_sku"
    catalog = "catalog"
    partner_feed = "partner_feed"
    provider = "provider"
    ocr = "ocr"
    vlm = "vlm"
    unknown = "unknown"


# Уровни доказательности (handoff):
# E0 unknown; E1 VLM/OCR; E2 user input (не подтверждён); E3 user-confirmed
# или доверенный провайдер; E4 manufacturer SKU / точный аудированный профиль.
_EVIDENCE_BY_SOURCE: dict[Source, int] = {
    Source.unknown: 0,
    Source.vlm: 1,
    Source.ocr: 1,
    Source.user_input: 2,
    Source.product_page: 2,
    Source.user_confirmed: 3,
    Source.user_edited: 3,
    Source.provider: 3,
    Source.catalog: 3,
    Source.partner_feed: 3,
    Source.manufacturer_sku: 4,
}

# Минимальный уровень, при котором значению можно верить для вердикта
# compatible/incompatible. E1/E2 сами по себе не дают ни positive, ни hard fail.
TRUSTED_EVIDENCE_LEVEL = 3


class FieldValue(BaseModel):
    """Значение с provenance. value=None == значение неизвестно."""

    value: Any | None = None
    source: Source = Source.unknown
    confidence: float = 0.0
    is_user_confirmed: bool = False

    @property
    def evidence_level(self) -> int:
        if self.value is None:
            return 0
        if self.is_user_confirmed:
            return max(_EVIDENCE_BY_SOURCE[self.source], 3)
        return _EVIDENCE_BY_SOURCE[self.source]

    @property
    def is_known(self) -> bool:
        return self.value is not None

    @property
    def is_trusted(self) -> bool:
        return self.is_known and self.evidence_level >= TRUSTED_EVIDENCE_LEVEL


class VerdictStatus(StrEnum):
    compatible = "compatible"
    compatible_with_conditions = "compatible_with_conditions"
    unknown = "unknown"
    incompatible = "incompatible"


class CheckStage(StrEnum):
    preliminary = "preliminary"
    confirmed = "confirmed"


class RiskLevel(StrEnum):
    low = "low"
    moderate = "moderate"
    elevated = "elevated"
    high = "high"
    critical = "critical"


class CheckStatus(StrEnum):
    """Operational-статус проверки. Провайдерский сбой = failed, не unknown."""

    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class ReasonCode(StrEnum):
    """Машинные коды причин/условий. UI-тексты собираются на фронте/в presentation."""

    # incompatible
    bolt_count_mismatch = "bolt_count_mismatch"
    pcd_mismatch = "pcd_mismatch"
    center_bore_too_small = "center_bore_too_small"
    diameter_out_of_range = "diameter_out_of_range"
    width_out_of_range = "width_out_of_range"
    offset_out_of_range = "offset_out_of_range"
    load_rating_insufficient = "load_rating_insufficient"
    fastener_incompatible = "fastener_incompatible"
    # conditions
    hub_rings_required = "hub_rings_required"
    offset_deviation_check_required = "offset_deviation_check_required"
    width_deviation_check_required = "width_deviation_check_required"
    non_approved_size_check_required = "non_approved_size_check_required"
    fastener_hardware_check_required = "fastener_hardware_check_required"
    offset_not_verified = "offset_not_verified"
    # unknown / missing
    vehicle_not_resolved = "vehicle_not_resolved"
    pcd_unknown = "pcd_unknown"
    center_bore_unknown = "center_bore_unknown"
    offset_unknown = "offset_unknown"
    rim_offset_missing = "rim_offset_missing"
    vehicle_reference_offset_missing = "vehicle_reference_offset_missing"
    vehicle_variant_required = "vehicle_variant_required"
    vehicle_market_confirmation_required = "vehicle_market_confirmation_required"
    provider_reference_conflict = "provider_reference_conflict"
    rear_fitment_missing = "rear_fitment_missing"
    size_unknown = "size_unknown"
    load_rating_unknown = "load_rating_unknown"
    fastener_unknown = "fastener_unknown"
    conflict_low_evidence = "conflict_low_evidence"
    allowed_set_empty = "allowed_set_empty"
    # ok
    matches_approved_fitment = "matches_approved_fitment"


class VehicleIdentity(BaseModel):
    """Каноническая идентичность авто. Provider slugs — отдельно, не вместо полей."""

    make: str | None = None
    model: str | None = None
    year: int | None = None
    body: str | None = None
    generation: str | None = None
    modification: str | None = None
    market: str | None = None  # usdm / eudm / jdm / russia / chdm / ...
    is_user_confirmed: bool = False
    source: Source = Source.unknown
    confidence: float = 0.0
    provider_mappings: dict[str, dict[str, str]] = Field(default_factory=dict)

    @property
    def is_resolvable(self) -> bool:
        return bool(self.make and self.model and self.year)


class VehicleCandidate(BaseModel):
    """Кандидат идентификации от VLM (до подтверждения пользователем)."""

    make: str
    model: str
    year_from: int | None = None
    year_to: int | None = None
    body: str | None = None
    market: str | None = None
    confidence: float = 0.0
    notes: str | None = None


class ExpectedOemSpec(BaseModel):
    """Низкодоверенный VLM prior заводской геометрии для preliminary stage."""

    bolt_count: int | None = Field(default=None, ge=3, le=10)
    pcd_mm: float | None = Field(default=None, gt=0)
    center_bore_mm: float | None = Field(default=None, gt=0)
    rim_diameter_min: float | None = Field(default=None, gt=0)
    rim_diameter_max: float | None = Field(default=None, gt=0)
    rim_width_min: float | None = Field(default=None, gt=0)
    rim_width_max: float | None = Field(default=None, gt=0)
    offset_min: float | None = None
    offset_max: float | None = None

    @model_validator(mode="after")
    def validate_ranges(self) -> ExpectedOemSpec:
        for lower_name, upper_name in (
            ("rim_diameter_min", "rim_diameter_max"),
            ("rim_width_min", "rim_width_max"),
            ("offset_min", "offset_max"),
        ):
            lower = getattr(self, lower_name)
            upper = getattr(self, upper_name)
            if lower is not None and upper is not None and lower > upper:
                raise ValueError(f"{lower_name} must not exceed {upper_name}")
        return self

    @property
    def has_mounting_prior(self) -> bool:
        return self.bolt_count is not None or self.pcd_mm is not None


class VehicleIdentification(BaseModel):
    candidates: list[VehicleCandidate] = Field(default_factory=list)
    selected: VehicleIdentity | None = None
    expected_oem: ExpectedOemSpec | None = None
    vlm_model: str | None = None
    raw: dict = Field(default_factory=dict)


class RimSpec(BaseModel):
    """Спецификация одного диска для одной оси. Числовые поля — с provenance."""

    brand: str | None = None
    model: str | None = None
    sku: str | None = None
    product_url: str | None = None

    bolt_count: FieldValue = Field(default_factory=FieldValue)
    pcd_mm: FieldValue = Field(default_factory=FieldValue)
    center_bore_mm: FieldValue = Field(default_factory=FieldValue)
    wheel_diameter_in: FieldValue = Field(default_factory=FieldValue)
    wheel_width_j: FieldValue = Field(default_factory=FieldValue)
    offset_et_mm: FieldValue = Field(default_factory=FieldValue)
    load_rating_kg: FieldValue = Field(default_factory=FieldValue)

    fastener_system: FieldValue = Field(default_factory=FieldValue)
    seat_type: FieldValue = Field(default_factory=FieldValue)
    thread_diameter_mm: FieldValue = Field(default_factory=FieldValue)
    thread_pitch_mm: FieldValue = Field(default_factory=FieldValue)
    bolt_length_mm: FieldValue = Field(default_factory=FieldValue)

    @property
    def bolt_pattern_display(self) -> str | None:
        if self.bolt_count.value is None or self.pcd_mm.value is None:
            return None
        return format_bolt_pattern(self.bolt_count.value, self.pcd_mm.value)


class RimSetup(BaseModel):
    """Комплект: front/rear. Для square-сетапа обе ссылки — на одинаковый spec."""

    front: RimSpec
    rear: RimSpec
    is_staggered: bool = False


class AxleFitment(BaseModel):
    """Одна допустимая конфигурация колеса от провайдера (для одной оси)."""

    axle: str  # front | rear
    rim_diameter: float
    rim_width: float
    offset: float | None = None
    is_stock: bool | None = None
    tire: str | None = None


class OffsetReference(BaseModel):
    axle: str
    rim_diameter_in: float
    rim_width_j: float
    et_min_mm: float
    et_max_mm: float
    source_offsets_mm: list[float] = Field(default_factory=list)
    reference_type: str = "derived_interval"
    evidence_class: str = "stock"


class FitmentProfile(BaseModel):
    """Нормализованный технический профиль авто от провайдера."""

    provider: str
    provider_version: str | None = None
    fetched_at: str = ""
    raw_response_ref: str | None = None

    bolt_count: int | None = None
    pcd_mm: float | None = None
    center_bore_mm: float | None = None
    fastener_type: str | None = None  # "Lug nuts" | "Lug bolts" | ...
    thread_size: str | None = None  # "M12 x 1.5"
    tightening_torque: str | None = None

    allowed_wheels: list[AxleFitment] = Field(default_factory=list)
    offset_references: list[OffsetReference] = Field(default_factory=list)
    oem_offset_front: float | None = None
    oem_offset_rear: float | None = None

    @property
    def bolt_pattern_display(self) -> str | None:
        if self.bolt_count is None or self.pcd_mm is None:
            return None
        return format_bolt_pattern(self.bolt_count, self.pcd_mm)

    def allowed_for_axle(self, axle: str) -> list[AxleFitment]:
        return [w for w in self.allowed_wheels if w.axle == axle]

    def offset_reference_for(
        self, axle: str, diameter: float, width: float
    ) -> OffsetReference | None:
        matches = [
            item
            for item in self.offset_references
            if item.axle == axle and item.rim_diameter_in == diameter and item.rim_width_j == width
        ]
        return next(
            (item for item in matches if item.evidence_class == "stock"),
            matches[0] if matches else None,
        )


class RuleResult(BaseModel):
    rule: str
    status: VerdictStatus
    reason_code: ReasonCode
    axle: str | None = None
    detail: dict = Field(default_factory=dict)


class VerdictMessage(BaseModel):
    """Canonical presentation input; UI owns copy, not provider machine codes."""

    code: str
    applies_to: list[str] = Field(default_factory=list)
    details: dict = Field(default_factory=dict)


class FitmentVerdict(BaseModel):
    status: VerdictStatus
    rule_results: list[RuleResult] = Field(default_factory=list)
    reason_codes: list[ReasonCode] = Field(default_factory=list)
    condition_codes: list[ReasonCode] = Field(default_factory=list)
    missing_fields: list[str] = Field(default_factory=list)
    blocking_issues: list[VerdictMessage] = Field(default_factory=list)
    conditions: list[VerdictMessage] = Field(default_factory=list)
    advisories: list[VerdictMessage] = Field(default_factory=list)
    diagnostics: list[VerdictMessage] = Field(default_factory=list)
    engine_version: str = ""
    tolerances_version: str = ""
    provider: str | None = None
    is_preliminary: bool = True


class ParameterRisk(BaseModel):
    parameter: str
    axle: str | None = None
    status: VerdictStatus
    weight: float
    risk_points: float
    is_blocking: bool = False
    reason_code: ReasonCode
    recommendation_code: str | None = None
    recommendation: str | None = None


class RiskAssessment(BaseModel):
    score: float = Field(ge=0, le=100)
    level: RiskLevel
    risk_model_version: str = ""
    blocking_parameters: list[str] = Field(default_factory=list)
    parameter_risks: list[ParameterRisk] = Field(default_factory=list)
    recommendation_codes: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class PreliminaryPrediction(BaseModel):
    vehicle: VehicleIdentification
    rim_hints: RimExtractionHints | None = None
    suggested_rim_setup: RimSetup | None = None
    raw_rim: dict = Field(default_factory=dict)


class PreliminaryRun(BaseModel):
    id: str
    owner_telegram_user_id: int
    status: CheckStatus = CheckStatus.processing
    stage: CheckStage = CheckStage.preliminary
    car_image_sha256: str | None = None
    rim_image_sha256: str | None = None
    prediction: PreliminaryPrediction | None = None
    verdict: FitmentVerdict | None = None
    fit_likelihood: float | None = Field(default=None, ge=0, le=1)
    error_code: str | None = None
    created_at: str = ""
    completed_at: str | None = None


class FitmentCheck(BaseModel):
    """Проверка совместимости: operational-статус + immutable snapshots + вердикт."""

    id: str
    owner_telegram_user_id: int
    status: CheckStatus = CheckStatus.queued
    vehicle_identity_id: str
    rim_setup_id: str
    render_job_id: str | None = None
    trigger: str = "user_requested"
    mode: str = "detailed"
    stage: CheckStage = CheckStage.confirmed
    preliminary_run_id: str | None = None

    vehicle_snapshot: VehicleIdentity | None = None
    rim_setup_snapshot: RimSetup | None = None
    profile_snapshot: FitmentProfile | None = None

    verdict: FitmentVerdict | None = None
    risk: RiskAssessment | None = None
    error_code: str | None = None

    created_at: str = ""
    completed_at: str | None = None


class RimExtractionHints(BaseModel):
    """Mode 1 (visual-support inference): подсказки для форм рендера.

    НЕ технический вердикт — статусы compatible/unknown отсюда не возвращаются.
    """

    style: str | None = None
    spoke_count: int | None = None
    primary_color: str | None = None
    finish: str | None = None
    brand: str | None = None
    model: str | None = None
    visible_marking_text: str | None = None
    suggested_diameter_in: float | None = None
    suggested_width_j: float | None = None
    suggested_offset_et_mm: float | None = None
    suggested_bolt_count: int | None = None
    suggested_pcd_mm: float | None = None
    confidence: float = 0.0
    notes: str | None = None


PreliminaryPrediction.model_rebuild()


def format_bolt_pattern(bolt_count: int, pcd_mm: float) -> str:
    pcd = f"{pcd_mm:.1f}".rstrip("0").rstrip(".")
    return f"{bolt_count}x{pcd}"


def parse_bolt_pattern(raw: str | None) -> tuple[int | None, float | None]:
    """'5x114.3' / '5X114,3' / '5×114.3' → (5, 114.3). Мусор → (None, None)."""
    if not raw:
        return None, None
    text = str(raw).strip().lower().replace("×", "x").replace(",", ".").replace(" ", "")
    parts = text.split("x")
    if len(parts) != 2:
        return None, None
    try:
        return int(parts[0]), float(parts[1])
    except ValueError:
        return None, None
