"""Оркестрация Detailed Fitment Check.

Жизненный цикл (handoff): queued → processing → completed | failed.
`failed` — технический сбой (провайдер/инфраструктура); `unknown` — честный
вердикт при нехватке данных. Это разные вещи.

Snapshots: identity/setup копируются в check при принятии запроса и дальше
не меняются, даже если пользователь отредактирует исходные сущности.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime

from src.fitment.identification.normalization import merge_rim_specs, rim_spec_from_hints
from src.fitment.identification.rim_ocr import parse_rim_marking
from src.fitment.identification.rim_url import RimProductUrlResolver
from src.fitment.identification.rim_vlm import extract_rim_hints
from src.fitment.identification.vehicle_vlm import identify_vehicle_detailed
from src.fitment.identification.vlm_client import (
    OpenAICompatibleVlmClient,
    VlmClient,
    VlmError,
)
from src.fitment.identification.vlm_profile import VLM_PRIOR_PROVIDER, profile_from_vlm_prior
from src.fitment.images import image_as_base64
from src.fitment.providers.base import FitmentProvider, ProviderError
from src.fitment.repository import FitmentRepository, new_id
from src.fitment.rules.engine import run_checks
from src.fitment.rules.risk import (
    build_risk_assessment,
    preliminary_fit_likelihood,
    unresolved_vehicle_risk,
)
from src.fitment.rules.verdict import assemble_verdict, verdict_vehicle_not_resolved
from src.fitment.schemas import (
    CheckStatus,
    FieldValue,
    FitmentCheck,
    PreliminaryPrediction,
    PreliminaryRun,
    RimSetup,
    RimSpec,
    VehicleIdentity,
)

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


class FitmentService:
    def __init__(
        self,
        *,
        repository: FitmentRepository,
        provider: FitmentProvider,
        vlm: VlmClient | None = None,
        rim_url_resolver: RimProductUrlResolver | None = None,
    ) -> None:
        self._repo = repository
        self._provider = provider
        self._vlm = vlm or OpenAICompatibleVlmClient()
        self._rim_url_resolver = rim_url_resolver

    @property
    def repository(self) -> FitmentRepository:
        return self._repo

    async def enrich_rim_spec(self, spec: RimSpec) -> RimSpec:
        """Resolve a product URL without overriding stronger user evidence."""
        if self._rim_url_resolver is None or not spec.product_url:
            return spec

        resolution = await self._rim_url_resolver.resolve(spec.product_url)
        resolved = resolution.rim.model_copy(deep=True)
        conflicted_fields = {conflict.field for conflict in resolution.conflicts}
        for field_name in conflicted_fields:
            if not hasattr(resolved, field_name):
                continue
            if isinstance(getattr(resolved, field_name), FieldValue):
                setattr(resolved, field_name, FieldValue())
            else:
                setattr(resolved, field_name, None)
        return merge_rim_specs(spec, resolved)

    async def run_preliminary(
        self,
        *,
        owner_telegram_user_id: int,
        car_image_bytes: bytes,
        rim_image_bytes: bytes,
        car_image_sha256: str,
        rim_image_sha256: str,
    ) -> PreliminaryRun:
        """Фото машины + диска → VLM prediction, rough verdict и editable draft."""
        run = PreliminaryRun(
            id=new_id(),
            owner_telegram_user_id=owner_telegram_user_id,
            status=CheckStatus.processing,
            car_image_sha256=car_image_sha256,
            rim_image_sha256=rim_image_sha256,
            created_at=_now_iso(),
        )
        await self._repo.create_preliminary_run(run)

        if not getattr(self._vlm, "is_configured", True):
            run.status = CheckStatus.failed
            run.error_code = "vlm_not_configured"
            run.completed_at = _now_iso()
            await self._repo.update_preliminary_run(run)
            return run

        try:
            vehicle_task = identify_vehicle_detailed(
                self._vlm,
                image_b64=image_as_base64(car_image_bytes),
            )
            rim_task = extract_rim_hints(
                self._vlm,
                image_b64=image_as_base64(rim_image_bytes),
            )
            vehicle_prediction, rim_hints = await asyncio.gather(vehicle_task, rim_task)

            hint_spec = rim_spec_from_hints(rim_hints) if rim_hints is not None else None
            marking_spec = (
                parse_rim_marking(rim_hints.visible_marking_text) if rim_hints is not None else None
            )
            specs = [spec for spec in (marking_spec, hint_spec) if spec is not None]
            rim = merge_rim_specs(*specs) if specs else merge_rim_specs()
            setup = RimSetup(
                front=rim,
                rear=rim.model_copy(deep=True),
                is_staggered=False,
            )

            run.prediction = PreliminaryPrediction(
                vehicle=vehicle_prediction,
                rim_hints=rim_hints,
                suggested_rim_setup=setup,
                raw_rim=rim_hints.model_dump() if rim_hints else {},
            )

            profile = profile_from_vlm_prior(vehicle_prediction.expected_oem)
            if vehicle_prediction.selected is None or profile is None:
                run.verdict = verdict_vehicle_not_resolved(
                    provider=VLM_PRIOR_PROVIDER,
                    is_preliminary=True,
                )
            else:
                results = run_checks(profile, setup)
                run.verdict = assemble_verdict(
                    results,
                    provider=VLM_PRIOR_PROVIDER,
                    is_preliminary=True,
                )

            vehicle_confidence = (
                vehicle_prediction.candidates[0].confidence
                if vehicle_prediction.candidates
                else 0.0
            )
            rim_confidence = rim_hints.confidence if rim_hints else 0.0
            run.fit_likelihood = preliminary_fit_likelihood(
                run.verdict.status,
                vehicle_confidence=vehicle_confidence,
                rim_confidence=rim_confidence,
            )
            run.status = CheckStatus.completed
            run.completed_at = _now_iso()
        except VlmError as exc:
            logger.exception(
                "❌ Preliminary VLM failure run_id=%s telegram_user_id=%s: %s",
                run.id,
                owner_telegram_user_id,
                exc,
            )
            run.status = CheckStatus.failed
            run.error_code = "vlm_error"
            run.completed_at = _now_iso()
        except Exception as exc:
            logger.exception(
                "❌ Preliminary fitment failure run_id=%s user_id=%s: %s",
                run.id,
                owner_telegram_user_id,
                exc,
            )
            run.status = CheckStatus.failed
            run.error_code = "preliminary_internal_error"
            run.completed_at = _now_iso()

        await self._repo.update_preliminary_run(run)
        return run

    async def create_check(
        self,
        *,
        owner_telegram_user_id: int,
        vehicle_identity_id: str,
        rim_setup_id: str,
        render_job_id: str | None,
        idempotency_key: str,
        trigger: str = "user_requested",
        mode: str = "detailed",
        preliminary_run_id: str | None = None,
    ) -> FitmentCheck:
        """Создать check с immutable snapshots. Идемпотентно по ключу."""
        existing = await self._repo.find_check_by_idempotency_key(
            owner_telegram_user_id=owner_telegram_user_id,
            idempotency_key=idempotency_key,
        )
        if existing is not None:
            logger.info(
                "♻️ Idempotent replay fitment check: telegram_user_id=%s check_id=%s",
                owner_telegram_user_id,
                existing.id,
            )
            return existing

        if preliminary_run_id is not None:
            preliminary = await self._repo.get_preliminary_run(
                preliminary_run_id,
                owner_telegram_user_id=owner_telegram_user_id,
            )
            if preliminary is None:
                raise LookupError("preliminary_run not found")

        identity = await self._repo.get_vehicle_identity(
            vehicle_identity_id, owner_telegram_user_id=owner_telegram_user_id
        )
        if identity is None:
            raise LookupError("vehicle_identity not found")
        setup = await self._repo.get_rim_setup(
            rim_setup_id, owner_telegram_user_id=owner_telegram_user_id
        )
        if setup is None:
            raise LookupError("rim_setup not found")

        check = FitmentCheck(
            id=new_id(),
            owner_telegram_user_id=owner_telegram_user_id,
            status=CheckStatus.queued,
            vehicle_identity_id=vehicle_identity_id,
            rim_setup_id=rim_setup_id,
            render_job_id=render_job_id,
            trigger=trigger,
            mode=mode,
            preliminary_run_id=preliminary_run_id,
            vehicle_snapshot=identity,
            rim_setup_snapshot=setup,
            created_at=_now_iso(),
        )
        check = await self._repo.create_check_idempotently(
            check,
            idempotency_key=idempotency_key,
        )
        logger.info(
            "📥 Fitment check check_id=%s telegram_user_id=%s identity_id=%s setup_id=%s",
            check.id,
            owner_telegram_user_id,
            vehicle_identity_id,
            rim_setup_id,
        )
        return check

    async def execute_check(self, check: FitmentCheck) -> FitmentCheck:
        """Выполнить check: резолв → профиль → правила → вердикт.

        ProviderError → status=failed (technical), не unknown.
        Отсутствие покрытия у провайдера → completed + verdict unknown.
        """
        check.status = CheckStatus.processing
        await self._repo.update_check(check)

        identity: VehicleIdentity = check.vehicle_snapshot
        setup: RimSetup = check.rim_setup_snapshot

        try:
            resolved = await self._provider.resolve_vehicle(identity)
            profile = None
            if resolved is not None:
                profile = await self._provider.get_fitment_profile(
                    resolved,
                    user_initiated=True,
                )
                check.vehicle_snapshot = resolved

            if profile is None:
                check.verdict = verdict_vehicle_not_resolved(
                    provider=self._provider.name,
                    is_preliminary=False,
                )
                check.risk = unresolved_vehicle_risk()
                logger.info(
                    "🔎 Fitment check %s: vehicle не разрешён провайдером → unknown", check.id
                )
            else:
                check.profile_snapshot = profile
                results = run_checks(profile, setup)
                check.verdict = assemble_verdict(
                    results,
                    provider=self._provider.name,
                    is_preliminary=False,
                )
                check.risk = build_risk_assessment(results)
                logger.info(
                    "✅ Fitment check %s: verdict=%s (reasons=%s)",
                    check.id,
                    check.verdict.status.value,
                    [c.value for c in check.verdict.reason_codes],
                )

            check.status = CheckStatus.completed
            check.completed_at = _now_iso()
        except ProviderError as exc:
            logger.exception(
                "❌ Fitment provider failure check_id=%s user_id=%s: %s",
                check.id,
                check.owner_telegram_user_id,
                exc,
            )
            check.status = CheckStatus.failed
            check.error_code = "provider_error"
            check.completed_at = _now_iso()
        except Exception as exc:
            logger.exception(
                "❌ Fitment internal failure check_id=%s user_id=%s: %s",
                check.id,
                check.owner_telegram_user_id,
                exc,
            )
            check.status = CheckStatus.failed
            check.error_code = "internal_error"
            check.completed_at = _now_iso()

        await self._repo.update_check(check)
        return check
