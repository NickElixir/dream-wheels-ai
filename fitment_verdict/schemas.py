"""Pydantic contracts for the fitment verdict pipeline."""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class Source(StrEnum):
    user_input = "user_input"
    user_confirmed = "user_confirmed"
    catalog = "catalog"
    partner_feed = "partner_feed"
    provider = "provider"
    ocr = "ocr"
    vlm = "vlm"
    unknown = "unknown"


class VerdictStatus(StrEnum):
    compatible = "compatible"
    compatible_with_conditions = "compatible_with_conditions"
    unknown = "unknown"
    incompatible = "incompatible"


class ExecutionStatus(StrEnum):
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class CheckStage(StrEnum):
    preliminary = "preliminary"
    confirmed = "confirmed"


class RiskLevel(StrEnum):
    low = "low"
    moderate = "moderate"
    elevated = "elevated"
    high = "high"
    critical = "critical"


class EvidenceLevel(StrEnum):
    e0_unknown = "E0"
    e1_vlm_ocr = "E1"
    e2_user_unconfirmed = "E2"
    e3_user_or_provider = "E3"
    e4_manufacturer = "E4"


class ProvenanceField(BaseModel):
    value: Any = None
    source: Source = Source.unknown
    confidence: float = 0.0
    is_user_confirmed: bool = False

    @property
    def evidence_level(self) -> EvidenceLevel:
        if self.source in {Source.user_confirmed, Source.catalog, Source.partner_feed}:
            return (
                EvidenceLevel.e4_manufacturer
                if self.source == Source.partner_feed
                else EvidenceLevel.e3_user_or_provider
            )
        if self.source == Source.provider:
            return EvidenceLevel.e3_user_or_provider
        if self.source == Source.user_input:
            return (
                EvidenceLevel.e2_user_unconfirmed
                if not self.is_user_confirmed
                else EvidenceLevel.e3_user_or_provider
            )
        if self.source in {Source.ocr, Source.vlm}:
            return EvidenceLevel.e1_vlm_ocr
        return EvidenceLevel.e0_unknown


class VehicleQuery(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    make: str | None = None
    model: str | None = None
    year: int | None = None
    generation: str | None = None
    modification: str | None = None
    make_slug: str | None = None
    model_slug: str | None = None
    generation_slug: str | None = None
    modification_slug: str | None = None
    body: str | None = None
    region: str | None = None
    market: str | None = None
    source: Source = Source.unknown
    confidence: float = 0.0
    is_user_confirmed: bool = False


class VehicleIdentificationResult(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    parsed: dict[str, Any] = Field(default_factory=dict)
    search_candidates: list[VehicleQuery] = Field(default_factory=list)
    model_used: str | None = None


class AxleFitment(BaseModel):
    axle: str
    rim_diameter: float
    rim_width: float
    offset: float | None = None
    is_stock: bool | None = None
    tire: str | None = None


class FitmentProfile(BaseModel):
    provider: str
    provider_version: str | None = None
    fetched_at: str
    raw_response_ref: str | None = None
    bolt_pattern: str | None = None
    stud_holes: int | None = None
    pcd: float | None = None
    center_bore: float | None = None
    fastener_type: str | None = None
    thread_size: str | None = None
    tightening_torque: str | None = None
    allowed_wheels: list[AxleFitment] = Field(default_factory=list)
    oem_offset_front: float | None = None
    oem_offset_rear: float | None = None
    vehicle_query: VehicleQuery | None = None


class RimSpec(BaseModel):
    diameter: float | None = None
    width: float | None = None
    offset: float | None = None
    bolt_count: int | None = None
    pcd_mm: float | None = None
    center_bore_mm: float | None = None
    bolt_pattern: str | None = None
    pcd: float | None = None
    center_bore: float | None = None
    fastener_seat: str | None = None
    load_rating: float | None = None
    brand: str | None = None
    model: str | None = None
    style: str | None = None
    finish: str | None = None
    source: Source = Source.unknown
    confidence: float = 0.0
    is_user_confirmed: bool = False
    field_provenance: dict[str, ProvenanceField] = Field(default_factory=dict)

    def sync_bolt_fields(self) -> RimSpec:
        if self.bolt_count and self.pcd_mm:
            pcd_display = f"{float(self.pcd_mm):g}"
            self.bolt_pattern = f"{self.bolt_count}x{pcd_display}"
            self.pcd = self.pcd_mm
        elif self.bolt_pattern and self.pcd:
            parts = self.bolt_pattern.lower().replace("×", "x").split("x")
            if len(parts) == 2:
                try:
                    self.bolt_count = int(parts[0])
                    self.pcd_mm = float(parts[1])
                except ValueError:
                    pass
        if self.center_bore_mm is not None:
            self.center_bore = self.center_bore_mm
        elif self.center_bore is not None:
            self.center_bore_mm = self.center_bore
        return self


class RuleResult(BaseModel):
    rule: str
    status: VerdictStatus
    reason: str
    reason_code: str
    detail: dict[str, Any] = Field(default_factory=dict)


class FitmentVerdict(BaseModel):
    status: VerdictStatus
    rule_results: list[RuleResult]
    reasons: list[str] = Field(default_factory=list)
    reason_codes: list[str] = Field(default_factory=list)
    conditions: list[str] = Field(default_factory=list)
    condition_codes: list[str] = Field(default_factory=list)
    missing_data: list[str] = Field(default_factory=list)
    vehicle: VehicleQuery
    rim: RimSpec
    profile_ref: str | None = None
    engine_version: str
    tolerances_version: str
    provider: str
    is_preliminary: bool = True


class FitmentVerdictRequest(BaseModel):
    car_image_path: str | None = None
    rim_image_path: str | None = None
    vehicle: VehicleQuery | None = None
    rim: RimSpec | None = None
    rim_ocr_text: str | None = None
    user_initiated: bool = True
    trigger: str = "user_requested"
    mode: str = "detailed"


class PipelineStageReport(BaseModel):
    stage: str
    status: str
    detail: dict[str, Any] = Field(default_factory=dict)


class ParameterRisk(BaseModel):
    parameter: str
    status: VerdictStatus
    weight: float
    risk_points: float
    is_blocking: bool = False
    reason_code: str
    recommendation_code: str | None = None
    recommendation: str | None = None


class RiskAssessment(BaseModel):
    score: float
    level: RiskLevel
    blocking_parameters: list[str] = Field(default_factory=list)
    parameter_risks: list[ParameterRisk] = Field(default_factory=list)
    recommendation_codes: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class FitmentCheckResult(BaseModel):
    execution_status: ExecutionStatus
    stage: CheckStage | None = None
    verdict: FitmentVerdict | None = None
    risk: RiskAssessment | None = None
    presentation: dict[str, Any] | None = None
    stages: list[PipelineStageReport] = Field(default_factory=list)
    error_code: str | None = None
    error_message: str | None = None


# ---------------------------------------------------------------------------
# Stage 1 — preliminary (photos only, VLM-based guess)
# ---------------------------------------------------------------------------


class ExpectedOemSpec(BaseModel):
    """VLM prior: typical factory wheel parameters for the identified vehicle."""

    bolt_count: int | None = None
    pcd_mm: float | None = None
    center_bore_mm: float | None = None
    rim_diameter_min: float | None = None
    rim_diameter_max: float | None = None
    rim_width_min: float | None = None
    rim_width_max: float | None = None
    offset_min: float | None = None
    offset_max: float | None = None

    @property
    def has_mounting_prior(self) -> bool:
        return self.pcd_mm is not None or self.bolt_count is not None


class PreliminaryCheckRequest(BaseModel):
    car_image_path: str
    rim_image_path: str


class PreliminaryPrediction(BaseModel):
    vehicle: VehicleQuery
    vehicle_raw: dict[str, Any] = Field(default_factory=dict)
    rim: RimSpec
    rim_raw: dict[str, Any] = Field(default_factory=dict)
    expected_oem: ExpectedOemSpec | None = None


# ---------------------------------------------------------------------------
# Stage 2 — confirmed (user-verified structured data + Wheel-Size)
# ---------------------------------------------------------------------------


class VehicleUserInput(BaseModel):
    """Stage-2 vehicle form. VLM may prefill it, but the user confirms/corrects."""

    make: str | None = None
    model: str | None = None
    year: int | None = None
    body: str | None = None
    generation: str | None = None
    modification: str | None = None
    region: str | None = None

    def to_vehicle_query(self) -> VehicleQuery:
        return VehicleQuery(
            make=self.make,
            model=self.model,
            year=self.year,
            body=self.body,
            generation=self.generation,
            modification=self.modification,
            region=self.region,
            source=Source.user_confirmed,
            confidence=1.0,
            is_user_confirmed=True,
        )


class RimUserInput(BaseModel):
    """Stage-2 rim form. Structured data preferred; product_url as fallback."""

    brand: str | None = None
    model: str | None = None
    sku: str | None = None
    product_url: str | None = None
    diameter: float | None = None
    width: float | None = None
    bolt_count: int | None = None
    pcd_mm: float | None = None
    offset: float | None = None
    center_bore_mm: float | None = None
    fastener_seat: str | None = None
    load_rating: float | None = None

    def to_rim_spec(self) -> RimSpec:
        return RimSpec(
            diameter=self.diameter,
            width=self.width,
            offset=self.offset,
            bolt_count=self.bolt_count,
            pcd_mm=self.pcd_mm,
            center_bore_mm=self.center_bore_mm,
            fastener_seat=self.fastener_seat,
            load_rating=self.load_rating,
            brand=self.brand,
            model=self.model,
            source=Source.user_confirmed,
            confidence=1.0,
            is_user_confirmed=True,
        ).sync_bolt_fields()


class ConfirmedCheckRequest(BaseModel):
    """Stage-2 request. Also serves as the editable draft returned by stage 1."""

    vehicle: VehicleUserInput | None = None
    rim: RimUserInput | None = None
    rim_rear: RimUserInput | None = None
    preliminary_ref: str | None = None


class PreliminaryCheckResult(BaseModel):
    execution_status: ExecutionStatus
    stage: CheckStage = CheckStage.preliminary
    prediction: PreliminaryPrediction | None = None
    verdict: FitmentVerdict | None = None
    fit_likelihood: float | None = None
    draft: ConfirmedCheckRequest | None = None
    presentation: dict[str, Any] | None = None
    stages: list[PipelineStageReport] = Field(default_factory=list)
    error_code: str | None = None
    error_message: str | None = None
