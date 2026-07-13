"""Fitment verdict pipeline orchestrator."""

from __future__ import annotations

import logging

from fitment_verdict.config import FitmentConfig, load_config
from fitment_verdict.identification.base import RimVLMProvider, VehicleVLMProvider
from fitment_verdict.identification.normalization import merge_rim, merge_vehicle
from fitment_verdict.identification.rim_enrichment import enrich_rim_from_profile
from fitment_verdict.identification.rim_ocr import parse_rim_text
from fitment_verdict.identification.rim_url import NullRimUrlResolver, RimUrlResolver
from fitment_verdict.identification.rim_vlm import rim_spec_from_vlm_hints
from fitment_verdict.identification.vlm_profile import (
    expected_oem_from_parsed,
    profile_from_expected_oem,
)
from fitment_verdict.images import load_normalized_image
from fitment_verdict.presentation import (
    build_confirmed_presentation,
    build_preliminary_presentation,
    build_presentation,
)
from fitment_verdict.providers.base import FitmentProvider
from fitment_verdict.providers.cache import FileCache
from fitment_verdict.providers.wheel_size import (
    WheelSizeApiError,
    WheelSizeProvider,
    vehicle_matches_by_rim_results,
)
from fitment_verdict.rules.engine import evaluate
from fitment_verdict.rules.risk import build_risk_assessment, preliminary_fit_likelihood
from fitment_verdict.rules.verdict import assemble_verdict
from fitment_verdict.schemas import (
    CheckStage,
    ConfirmedCheckRequest,
    ExecutionStatus,
    FitmentCheckResult,
    FitmentProfile,
    FitmentVerdictRequest,
    PipelineStageReport,
    PreliminaryCheckRequest,
    PreliminaryCheckResult,
    PreliminaryPrediction,
    RimSpec,
    RimUserInput,
    Source,
    VehicleQuery,
    VehicleUserInput,
)
from fitment_verdict.utils import market_to_region, region_fallback

logger = logging.getLogger(__name__)


class FitmentVerdictService:
    def __init__(
        self,
        config: FitmentConfig | None = None,
        *,
        vehicle_vlm: VehicleVLMProvider | None = None,
        rim_vlm: RimVLMProvider | None = None,
        provider: FitmentProvider | None = None,
        cache: FileCache | None = None,
        rim_url_resolver: RimUrlResolver | None = None,
    ) -> None:
        self._config = config or load_config()
        self._cache = cache or FileCache(self._config.cache_dir)
        self._vehicle_vlm = vehicle_vlm
        self._rim_vlm = rim_vlm
        self._provider = provider
        self._rim_url_resolver = rim_url_resolver or NullRimUrlResolver()
        if self._provider is None and self._config.provider_enabled:
            self._provider = WheelSizeProvider(self._config, self._cache)

    async def run(self, request: FitmentVerdictRequest) -> FitmentCheckResult:
        stages: list[PipelineStageReport] = []

        try:
            vehicle, rim, stages = await self._run_stages(request, stages)
            if vehicle is None:
                return FitmentCheckResult(
                    execution_status=ExecutionStatus.failed,
                    stages=stages,
                    error_code="VEHICLE_NOT_AVAILABLE",
                    error_message="Vehicle identity could not be established.",
                )

            profile = await self._resolve_profile(vehicle, request.user_initiated, stages)
            rim, stages = await self._enrich_and_crosscheck_rim(
                rim,
                vehicle,
                profile,
                request.user_initiated,
                stages,
            )
            rule_results = evaluate(profile, rim)
            verdict = assemble_verdict(
                rule_results=rule_results,
                vehicle=vehicle,
                rim=rim,
                profile=profile,
                config=self._config,
            )
            presentation = build_presentation(verdict)
            stages.append(
                PipelineStageReport(
                    stage="G5_verdict",
                    status=verdict.status.value,
                    detail={"reason_codes": verdict.reason_codes},
                )
            )
            return FitmentCheckResult(
                execution_status=ExecutionStatus.completed,
                verdict=verdict,
                presentation=presentation,
                stages=stages,
            )
        except WheelSizeApiError as exc:
            logger.exception("❌ Fitment provider failure: %s", exc)
            return FitmentCheckResult(
                execution_status=ExecutionStatus.failed,
                stages=stages,
                error_code="PROVIDER_ERROR",
                error_message=str(exc),
            )
        except Exception as exc:
            logger.exception("❌ Fitment pipeline failure: %s", exc)
            return FitmentCheckResult(
                execution_status=ExecutionStatus.failed,
                stages=stages,
                error_code="PIPELINE_ERROR",
                error_message=str(exc),
            )

    # ------------------------------------------------------------------
    # Stage 1 — preliminary guess: photos only, VLM prior, no Wheel-Size
    # ------------------------------------------------------------------

    async def run_preliminary(self, request: PreliminaryCheckRequest) -> PreliminaryCheckResult:
        stages: list[PipelineStageReport] = []
        try:
            if self._vehicle_vlm is None or self._rim_vlm is None:
                return PreliminaryCheckResult(
                    execution_status=ExecutionStatus.failed,
                    stages=stages,
                    error_code="VLM_NOT_CONFIGURED",
                    error_message="Preliminary stage requires both vehicle and rim VLM providers.",
                )

            car_bytes, car_meta = load_normalized_image(request.car_image_path, self._config)
            stages.append(PipelineStageReport(stage="G0_intake_car", status="ok", detail=car_meta))
            rim_bytes, rim_meta = load_normalized_image(request.rim_image_path, self._config)
            stages.append(PipelineStageReport(stage="G0_intake_rim", status="ok", detail=rim_meta))

            identification = await self._vehicle_vlm.identify(car_bytes)
            parsed = identification.parsed
            vehicle = (
                identification.search_candidates[0]
                if identification.search_candidates
                else VehicleQuery(source=Source.vlm)
            )
            stages.append(
                PipelineStageReport(
                    stage="G1_vehicle_vlm",
                    status="ok",
                    detail={
                        "model_used": identification.model_used,
                        "confidence": parsed.get("confidence"),
                        "candidate_count": len(identification.search_candidates),
                    },
                )
            )

            rim_hints = await self._rim_vlm.describe(rim_bytes)
            rim = rim_spec_from_vlm_hints(rim_hints)
            stages.append(
                PipelineStageReport(
                    stage="G3_rim_vlm",
                    status="ok",
                    detail={"confidence": rim.confidence, "brand": rim.brand},
                )
            )

            expected = expected_oem_from_parsed(parsed)
            prior_profile = profile_from_expected_oem(expected, vehicle)
            if prior_profile is not None:
                rim = enrich_rim_from_profile(rim, prior_profile)
            stages.append(
                PipelineStageReport(
                    stage="P1_vlm_prior_profile",
                    status="ok" if prior_profile else "skipped",
                    detail={
                        "bolt_pattern": prior_profile.bolt_pattern if prior_profile else None,
                        "allowed_wheel_count": (
                            len(prior_profile.allowed_wheels) if prior_profile else 0
                        ),
                    },
                )
            )

            rule_results = evaluate(prior_profile, rim)
            verdict = assemble_verdict(
                rule_results=rule_results,
                vehicle=vehicle,
                rim=rim,
                profile=prior_profile,
                config=self._config,
                is_preliminary=True,
            )
            likelihood = preliminary_fit_likelihood(
                verdict.status,
                parsed.get("confidence"),
                rim.confidence,
            )
            stages.append(
                PipelineStageReport(
                    stage="P2_preliminary_verdict",
                    status=verdict.status.value,
                    detail={"fit_likelihood": likelihood},
                )
            )

            draft = self._build_draft(vehicle, rim)
            return PreliminaryCheckResult(
                execution_status=ExecutionStatus.completed,
                prediction=PreliminaryPrediction(
                    vehicle=vehicle,
                    vehicle_raw=parsed,
                    rim=rim,
                    rim_raw=dict(rim_hints) if isinstance(rim_hints, dict) else {},
                    expected_oem=expected,
                ),
                verdict=verdict,
                fit_likelihood=likelihood,
                draft=draft,
                presentation=build_preliminary_presentation(verdict, likelihood),
                stages=stages,
            )
        except Exception as exc:
            logger.exception("❌ Preliminary fitment stage failure: %s", exc)
            return PreliminaryCheckResult(
                execution_status=ExecutionStatus.failed,
                stages=stages,
                error_code="PIPELINE_ERROR",
                error_message=str(exc),
            )

    @staticmethod
    def _build_draft(vehicle: VehicleQuery, rim: RimSpec) -> ConfirmedCheckRequest:
        return ConfirmedCheckRequest(
            vehicle=VehicleUserInput(
                make=vehicle.make,
                model=vehicle.model,
                year=vehicle.year,
                body=vehicle.body,
                generation=vehicle.generation,
                modification=vehicle.modification,
                region=vehicle.region,
            ),
            rim=RimUserInput(
                brand=rim.brand,
                model=rim.model,
                diameter=rim.diameter,
                width=rim.width,
                bolt_count=rim.bolt_count,
                pcd_mm=rim.pcd_mm,
                offset=rim.offset,
                center_bore_mm=rim.center_bore_mm,
                fastener_seat=rim.fastener_seat,
                load_rating=rim.load_rating,
            ),
        )

    # ------------------------------------------------------------------
    # Stage 2 — confirmed check: user-verified data + Wheel-Size + risk
    # ------------------------------------------------------------------

    async def run_confirmed(self, request: ConfirmedCheckRequest) -> FitmentCheckResult:
        stages: list[PipelineStageReport] = []
        try:
            vehicle_input = request.vehicle
            if (
                vehicle_input is None
                or not vehicle_input.make
                or not vehicle_input.model
                or vehicle_input.year is None
            ):
                return FitmentCheckResult(
                    execution_status=ExecutionStatus.failed,
                    stage=CheckStage.confirmed,
                    stages=stages,
                    error_code="VEHICLE_INPUT_INCOMPLETE",
                    error_message="Confirmed check requires make, model and year.",
                )
            if request.rim is None:
                return FitmentCheckResult(
                    execution_status=ExecutionStatus.failed,
                    stage=CheckStage.confirmed,
                    stages=stages,
                    error_code="RIM_INPUT_MISSING",
                    error_message="Confirmed check requires rim data or a product URL.",
                )

            vehicle = vehicle_input.to_vehicle_query()
            rim_front = await self._confirmed_rim_spec(request.rim, stages, axle="front")
            rim_rear = (
                await self._confirmed_rim_spec(request.rim_rear, stages, axle="rear")
                if request.rim_rear
                else None
            )

            profile = await self._resolve_profile(vehicle, True, stages)

            rule_results = evaluate(profile, rim_front)
            if rim_rear is not None:
                for item in rule_results:
                    item.detail["axle"] = "front"
                rear_results = evaluate(profile, rim_rear)
                for item in rear_results:
                    item.detail["axle"] = "rear"
                rule_results = rule_results + rear_results

            verdict = assemble_verdict(
                rule_results=rule_results,
                vehicle=vehicle,
                rim=rim_front,
                profile=profile,
                config=self._config,
                is_preliminary=False,
            )
            risk = build_risk_assessment(rule_results, rim=rim_front)
            stages.append(
                PipelineStageReport(
                    stage="R1_risk_assessment",
                    status=risk.level.value,
                    detail={
                        "score": risk.score,
                        "blocking": risk.blocking_parameters,
                    },
                )
            )
            stages.append(
                PipelineStageReport(
                    stage="G5_verdict",
                    status=verdict.status.value,
                    detail={"reason_codes": verdict.reason_codes},
                )
            )
            return FitmentCheckResult(
                execution_status=ExecutionStatus.completed,
                stage=CheckStage.confirmed,
                verdict=verdict,
                risk=risk,
                presentation=build_confirmed_presentation(verdict, risk),
                stages=stages,
            )
        except WheelSizeApiError as exc:
            logger.exception("❌ Confirmed fitment provider failure: %s", exc)
            return FitmentCheckResult(
                execution_status=ExecutionStatus.failed,
                stage=CheckStage.confirmed,
                stages=stages,
                error_code="PROVIDER_ERROR",
                error_message=str(exc),
            )
        except Exception as exc:
            logger.exception("❌ Confirmed fitment stage failure: %s", exc)
            return FitmentCheckResult(
                execution_status=ExecutionStatus.failed,
                stage=CheckStage.confirmed,
                stages=stages,
                error_code="PIPELINE_ERROR",
                error_message=str(exc),
            )

    async def _confirmed_rim_spec(
        self,
        rim_input: RimUserInput,
        stages: list[PipelineStageReport],
        *,
        axle: str,
    ) -> RimSpec:
        rim = rim_input.to_rim_spec()

        if rim_input.product_url:
            resolved = await self._rim_url_resolver.resolve(rim_input.product_url)
            if resolved is not None:
                rim = merge_rim(rim, resolved)
            stages.append(
                PipelineStageReport(
                    stage="G3_rim_url",
                    status="ok" if resolved else "not_resolved",
                    detail={"axle": axle, "url_provided": True},
                )
            )

        stages.append(
            PipelineStageReport(
                stage="G3_rim_spec",
                status="ok",
                detail={
                    "axle": axle,
                    "diameter": rim.diameter,
                    "width": rim.width,
                    "offset": rim.offset,
                    "bolt_pattern": rim.bolt_pattern,
                    "center_bore_mm": rim.center_bore_mm,
                    "source": rim.source.value,
                },
            )
        )
        return rim.sync_bolt_fields()

    async def _run_stages(
        self,
        request: FitmentVerdictRequest,
        stages: list[PipelineStageReport],
    ) -> tuple[VehicleQuery | None, RimSpec, list[PipelineStageReport]]:
        vehicle = request.vehicle.model_copy(deep=True) if request.vehicle else VehicleQuery()
        rim = request.rim.model_copy(deep=True).sync_bolt_fields() if request.rim else RimSpec()

        if request.car_image_path:
            _, meta = load_normalized_image(request.car_image_path, self._config)
            stages.append(PipelineStageReport(stage="G0_intake_car", status="ok", detail=meta))

        if request.rim_image_path:
            _, meta = load_normalized_image(request.rim_image_path, self._config)
            stages.append(PipelineStageReport(stage="G0_intake_rim", status="ok", detail=meta))

        if not vehicle.is_user_confirmed and not (vehicle.make and vehicle.model and vehicle.year):
            vehicle = await self._identify_vehicle(request, vehicle, stages)

        rim = await self._acquire_rim_specs(request, rim, stages)
        return vehicle, rim, stages

    async def _identify_vehicle(
        self,
        request: FitmentVerdictRequest,
        vehicle: VehicleQuery,
        stages: list[PipelineStageReport],
    ) -> VehicleQuery:
        if self._vehicle_vlm is None or not request.car_image_path:
            stages.append(
                PipelineStageReport(
                    stage="G1_vehicle_vlm",
                    status="skipped",
                    detail={"reason": "no_vlm_or_image"},
                )
            )
            return vehicle

        image_bytes, _ = load_normalized_image(request.car_image_path, self._config)
        identification = await self._vehicle_vlm.identify(image_bytes)
        stages.append(
            PipelineStageReport(
                stage="G1_vehicle_vlm",
                status="ok",
                detail={
                    "model_used": identification.model_used,
                    "candidate_count": len(identification.search_candidates),
                    "confidence": identification.parsed.get("confidence"),
                },
            )
        )

        confidence = float(identification.parsed.get("confidence") or 0.0)
        if confidence < self._config.vlm_min_confidence and not vehicle.is_user_confirmed:
            stages.append(
                PipelineStageReport(
                    stage="G1_vehicle_vlm",
                    status="low_confidence",
                    detail={"threshold": self._config.vlm_min_confidence},
                )
            )
            return vehicle

        candidate = (
            identification.search_candidates[0] if identification.search_candidates else None
        )
        if candidate is None:
            return vehicle
        return merge_vehicle(vehicle, candidate)

    async def _acquire_rim_specs(
        self,
        request: FitmentVerdictRequest,
        rim: RimSpec,
        stages: list[PipelineStageReport],
    ) -> RimSpec:
        if request.rim:
            rim = merge_rim(rim, request.rim.model_copy(deep=True).sync_bolt_fields())

        if request.rim_ocr_text:
            ocr_spec = parse_rim_text(request.rim_ocr_text)
            rim = merge_rim(rim, ocr_spec)
            stages.append(
                PipelineStageReport(
                    stage="G3_rim_ocr",
                    status="ok",
                    detail={"source": ocr_spec.source.value, "confidence": ocr_spec.confidence},
                )
            )

        if self._rim_vlm is not None and request.rim_image_path:
            image_bytes, _ = load_normalized_image(request.rim_image_path, self._config)
            hints = await self._rim_vlm.describe(image_bytes)
            vlm_spec = rim_spec_from_vlm_hints(hints)
            rim = merge_rim(rim, vlm_spec)
            stages.append(
                PipelineStageReport(
                    stage="G3_rim_vlm",
                    status="ok",
                    detail={"confidence": vlm_spec.confidence},
                )
            )

        if rim.is_user_confirmed or rim.source in {Source.user_input, Source.user_confirmed}:
            rim.source = Source.user_confirmed if rim.is_user_confirmed else Source.user_input

        stages.append(
            PipelineStageReport(
                stage="G3_rim_spec",
                status="ok",
                detail={
                    "diameter": rim.diameter,
                    "width": rim.width,
                    "offset": rim.offset,
                    "bolt_pattern": rim.bolt_pattern,
                    "center_bore_mm": rim.center_bore_mm,
                    "source": rim.source.value,
                },
            )
        )
        return rim.sync_bolt_fields()

    async def _resolve_profile(
        self,
        vehicle: VehicleQuery,
        user_initiated: bool,
        stages: list[PipelineStageReport],
    ) -> FitmentProfile | None:
        if self._provider is None:
            stages.append(
                PipelineStageReport(
                    stage="G2_provider",
                    status="skipped",
                    detail={"reason": "provider_not_configured"},
                )
            )
            return None

        if not user_initiated:
            stages.append(
                PipelineStageReport(
                    stage="G2_provider",
                    status="skipped",
                    detail={"reason": "not_user_initiated"},
                )
            )
            return None

        profile = await self._provider.resolve_and_fetch_profile(
            vehicle,
            user_initiated=user_initiated,
        )
        stages.append(
            PipelineStageReport(
                stage="G2_provider",
                status="ok" if profile else "not_found",
                detail={
                    "region": vehicle.region,
                    "make_slug": vehicle.make_slug,
                    "model_slug": vehicle.model_slug,
                    "allowed_wheel_count": len(profile.allowed_wheels) if profile else 0,
                },
            )
        )
        return profile

    async def _enrich_and_crosscheck_rim(
        self,
        rim: RimSpec,
        vehicle: VehicleQuery,
        profile: FitmentProfile | None,
        user_initiated: bool,
        stages: list[PipelineStageReport],
    ) -> tuple[RimSpec, list[PipelineStageReport]]:
        if profile is not None:
            before_pcd = rim.pcd_mm
            rim = enrich_rim_from_profile(rim, profile)
            if rim.pcd_mm != before_pcd:
                stages.append(
                    PipelineStageReport(
                        stage="G3_rim_profile_hypothesis",
                        status="ok",
                        detail={
                            "pcd_mm": rim.pcd_mm,
                            "bolt_pattern": rim.bolt_pattern,
                            "reason": "lug_count_matches_vehicle_hub",
                        },
                    )
                )

        if (
            user_initiated
            and profile is not None
            and isinstance(self._provider, WheelSizeProvider)
            and rim.diameter is not None
            and rim.width is not None
            and rim.bolt_pattern
        ):
            regions = [vehicle.region] if vehicle.region else []
            fallback = region_fallback(regions[0]) if regions else None
            if fallback:
                regions.append(fallback)
            if not regions:
                regions = [market_to_region(vehicle.market) or "eudm"]

            by_rim_items = await self._provider.search_by_rim(
                rim,
                regions=regions,
                user_initiated=True,
            )
            matched = vehicle_matches_by_rim_results(vehicle, by_rim_items)
            stages.append(
                PipelineStageReport(
                    stage="G3_by_rim_crosscheck",
                    status="match" if matched else "no_match",
                    detail={
                        "result_count": len(by_rim_items),
                        "vehicle_in_results": matched,
                    },
                )
            )

        return rim, stages
