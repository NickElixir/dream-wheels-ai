from src.fitment.rules.checks import check_size_and_offset
from src.fitment.rules.verdict import assemble_verdict
from src.fitment.schemas import (
    AxleFitment,
    FieldValue,
    FitmentProfile,
    OffsetReference,
    ReasonCode,
    RimSpec,
    Source,
    VerdictStatus,
)


def _rim(et: float | None) -> RimSpec:
    return RimSpec(
        wheel_diameter_in=FieldValue(value=20, source=Source.user_confirmed, confidence=1),
        wheel_width_j=FieldValue(value=8.5, source=Source.user_confirmed, confidence=1),
        offset_et_mm=FieldValue(value=et, source=Source.user_confirmed, confidence=1),
    )


def _profile(reference: OffsetReference | None) -> FitmentProfile:
    return FitmentProfile(
        provider="wheel_size",
        allowed_wheels=[AxleFitment(axle="front", rim_diameter=20, rim_width=8.5, offset=40, is_stock=True)],
        offset_references=[reference] if reference else [],
    )


def test_missing_rim_et_is_distinct_critical_blocker() -> None:
    result = check_size_and_offset(
        _profile(OffsetReference(axle="front", rim_diameter_in=20, rim_width_j=8.5, et_min_mm=35, et_max_mm=45)),
        _rim(None),
        "front",
    )

    assert result.status is VerdictStatus.unknown
    assert result.reason_code is ReasonCode.rim_offset_missing


def test_missing_vehicle_et_is_distinct_critical_blocker() -> None:
    result = check_size_and_offset(_profile(None), _rim(42), "front")

    assert result.status is VerdictStatus.unknown
    assert result.reason_code is ReasonCode.vehicle_reference_offset_missing


def test_et_inside_derived_interval_is_compatible() -> None:
    result = check_size_and_offset(
        _profile(OffsetReference(axle="front", rim_diameter_in=20, rim_width_j=8.5, et_min_mm=35, et_max_mm=45)),
        _rim(42),
        "front",
    )

    verdict = assemble_verdict([result], provider="wheel_size", is_preliminary=True)
    assert result.status is VerdictStatus.compatible
    assert verdict.status is VerdictStatus.compatible


def test_advisories_are_not_blocking() -> None:
    from src.fitment.schemas import RuleResult

    verdict = assemble_verdict(
        [
            RuleResult(
                rule="load_rating",
                status=VerdictStatus.unknown,
                reason_code=ReasonCode.load_rating_unknown,
                axle="front",
            )
        ],
        provider="wheel_size",
    )

    assert verdict.status is VerdictStatus.compatible
    assert [item.code for item in verdict.advisories] == ["load_rating_unknown"]
    assert verdict.blocking_issues == []
