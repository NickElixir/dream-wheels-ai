from src.fitment.rules.checks import check_size_and_offset
from src.fitment.rules.engine import CompatibilityEngine
from src.fitment.rules.verdict import assemble_verdict
from src.fitment.schemas import (
    AxleFitment,
    FieldValue,
    FitmentProfile,
    OffsetReference,
    ReasonCode,
    RimSetup,
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
        allowed_wheels=[
            AxleFitment(axle="front", rim_diameter=20, rim_width=8.5, offset=40, is_stock=True)
        ],
        offset_references=[reference] if reference else [],
    )


def _complete_profile() -> FitmentProfile:
    return FitmentProfile(
        provider="wheel_size",
        bolt_count=5,
        pcd_mm=114.3,
        center_bore_mm=60.1,
        fastener_type="bolt",
        allowed_wheels=[
            AxleFitment(axle=axle, rim_diameter=20, rim_width=8.5, offset=40, is_stock=True)
            for axle in ("front", "rear")
        ],
        offset_references=[
            OffsetReference(
                axle=axle, rim_diameter_in=20, rim_width_j=8.5, et_min_mm=35, et_max_mm=45
            )
            for axle in ("front", "rear")
        ],
    )


def _complete_rim(*, et: float = 40, center_bore: float = 60.1, pcd: float = 114.3) -> RimSpec:
    return RimSpec(
        bolt_count=FieldValue(value=5, source=Source.user_confirmed),
        pcd_mm=FieldValue(value=pcd, source=Source.user_confirmed),
        center_bore_mm=FieldValue(value=center_bore, source=Source.user_confirmed),
        wheel_diameter_in=FieldValue(value=20, source=Source.user_confirmed),
        wheel_width_j=FieldValue(value=8.5, source=Source.user_confirmed),
        offset_et_mm=FieldValue(value=et, source=Source.user_confirmed),
        fastener_system=FieldValue(value="stud_and_nut", source=Source.user_confirmed),
        load_rating_kg=FieldValue(value=900, source=Source.user_confirmed),
    )


def test_missing_rim_et_is_distinct_critical_blocker() -> None:
    result = check_size_and_offset(
        _profile(
            OffsetReference(
                axle="front", rim_diameter_in=20, rim_width_j=8.5, et_min_mm=35, et_max_mm=45
            )
        ),
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
        _profile(
            OffsetReference(
                axle="front", rim_diameter_in=20, rim_width_j=8.5, et_min_mm=35, et_max_mm=45
            )
        ),
        _rim(42),
        "front",
    )

    verdict = assemble_verdict([result], provider="wheel_size", is_preliminary=True)
    assert result.status is VerdictStatus.compatible
    assert verdict.status is VerdictStatus.compatible


def test_et_exactly_at_lower_boundary_is_compatible() -> None:
    result = check_size_and_offset(
        _profile(
            OffsetReference(
                axle="front", rim_diameter_in=20, rim_width_j=8.5, et_min_mm=35, et_max_mm=45
            )
        ),
        _rim(35),
        "front",
    )

    assert result.status is VerdictStatus.compatible


def test_et_exactly_at_upper_boundary_is_compatible() -> None:
    result = check_size_and_offset(
        _profile(
            OffsetReference(
                axle="front", rim_diameter_in=20, rim_width_j=8.5, et_min_mm=35, et_max_mm=45
            )
        ),
        _rim(45),
        "front",
    )

    assert result.status is VerdictStatus.compatible


def test_et_below_reference_interval_is_unknown_with_canonical_reason() -> None:
    result = check_size_and_offset(
        _profile(
            OffsetReference(
                axle="front", rim_diameter_in=20, rim_width_j=8.5, et_min_mm=35, et_max_mm=45
            )
        ),
        _rim(30),
        "front",
    )

    verdict = assemble_verdict([result], provider="wheel_size", is_preliminary=True)
    assert result.status is VerdictStatus.unknown
    assert result.reason_code is ReasonCode.et_outside_reference_range
    assert result.detail == {
        "rim_et_mm": 30,
        "reference_et_min_mm": 35,
        "reference_et_max_mm": 45,
        "reference_type": "derived_interval",
        "rim_diameter_in": 20,
        "rim_width_j": 8.5,
        "delta_mm": -5,
    }
    assert verdict.status is VerdictStatus.unknown


def test_et_above_reference_interval_is_unknown_with_canonical_reason() -> None:
    result = check_size_and_offset(
        _profile(
            OffsetReference(
                axle="front", rim_diameter_in=20, rim_width_j=8.5, et_min_mm=35, et_max_mm=45
            )
        ),
        _rim(70),
        "front",
    )

    verdict = assemble_verdict([result], provider="wheel_size", is_preliminary=True)
    assert result.status is VerdictStatus.unknown
    assert result.reason_code is ReasonCode.et_outside_reference_range
    assert verdict.status is VerdictStatus.unknown


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


def test_et_unknown_has_precedence_over_dia_condition() -> None:
    rim = _complete_rim(et=50, center_bore=66.6)
    verdict = assemble_verdict(
        CompatibilityEngine().evaluate(_complete_profile(), RimSetup(front=rim, rear=rim)),
        provider="wheel_size",
    )

    assert verdict.status is VerdictStatus.unknown
    assert ReasonCode.et_outside_reference_range in verdict.reason_codes
    assert ReasonCode.hub_rings_required in verdict.condition_codes


def test_hard_pcd_conflict_has_precedence_over_et_unknown() -> None:
    rim = _complete_rim(et=50, pcd=112)
    verdict = assemble_verdict(
        CompatibilityEngine().evaluate(_complete_profile(), RimSetup(front=rim, rear=rim)),
        provider="wheel_size",
    )

    assert verdict.status is VerdictStatus.incompatible
    assert verdict.reason_codes == [ReasonCode.pcd_mismatch]


def test_standard_engine_excludes_fastener_and_load_results() -> None:
    rim = _complete_rim()
    results = CompatibilityEngine().evaluate(_complete_profile(), RimSetup(front=rim, rear=rim))
    verdict = assemble_verdict(results, provider="wheel_size")

    assert {item.rule for item in results} == {"bolt_pattern", "center_bore", "size_offset"}
    assert verdict.advisories == []
    assert ReasonCode.fastener_unknown not in verdict.reason_codes
    assert ReasonCode.load_rating_unknown not in verdict.reason_codes


def test_size_outside_reference_is_unknown_not_an_invented_hard_limit() -> None:
    result = check_size_and_offset(
        _profile(
            OffsetReference(
                axle="front", rim_diameter_in=20, rim_width_j=8.5, et_min_mm=35, et_max_mm=45
            )
        ),
        RimSpec(
            wheel_diameter_in=FieldValue(value=22, source=Source.user_confirmed),
            wheel_width_j=FieldValue(value=8.5, source=Source.user_confirmed),
            offset_et_mm=FieldValue(value=40, source=Source.user_confirmed),
        ),
        "front",
    )

    assert result.status is VerdictStatus.unknown
    assert result.reason_code is ReasonCode.size_not_in_reference


def test_compatibility_engine_checks_rear_rim_against_rear_reference() -> None:
    profile = FitmentProfile(
        provider="wheel_size",
        bolt_count=5,
        pcd_mm=114.3,
        center_bore_mm=60.1,
        allowed_wheels=[
            AxleFitment(axle=axle, rim_diameter=20, rim_width=8.5, offset=40, is_stock=True)
            for axle in ("front", "rear")
        ],
        offset_references=[
            OffsetReference(
                axle=axle, rim_diameter_in=20, rim_width_j=8.5, et_min_mm=35, et_max_mm=45
            )
            for axle in ("front", "rear")
        ],
    )
    front = RimSpec(
        bolt_count=FieldValue(value=5, source=Source.user_confirmed),
        pcd_mm=FieldValue(value=114.3, source=Source.user_confirmed),
        center_bore_mm=FieldValue(value=60.1, source=Source.user_confirmed),
        wheel_diameter_in=FieldValue(value=20, source=Source.user_confirmed),
        wheel_width_j=FieldValue(value=8.5, source=Source.user_confirmed),
        offset_et_mm=FieldValue(value=40, source=Source.user_confirmed),
    )
    rear = front.model_copy(deep=True)
    rear.pcd_mm = FieldValue(value=112, source=Source.user_confirmed)

    results = CompatibilityEngine().evaluate(
        profile, RimSetup(front=front, rear=rear, is_staggered=True)
    )

    assert any(
        item.axle == "rear" and item.reason_code is ReasonCode.pcd_mismatch for item in results
    )


def test_unconfirmed_parser_values_cannot_produce_a_compatible_verdict() -> None:
    profile = FitmentProfile(
        provider="wheel_size",
        bolt_count=5,
        pcd_mm=114.3,
        center_bore_mm=60.1,
        allowed_wheels=[
            AxleFitment(axle=axle, rim_diameter=20, rim_width=8.5, offset=40, is_stock=True)
            for axle in ("front", "rear")
        ],
        offset_references=[
            OffsetReference(
                axle=axle, rim_diameter_in=20, rim_width_j=8.5, et_min_mm=35, et_max_mm=45
            )
            for axle in ("front", "rear")
        ],
    )
    raw_parser_rim = RimSpec(
        bolt_count=FieldValue(value=5, source=Source.product_page),
        pcd_mm=FieldValue(value=114.3, source=Source.product_page),
        center_bore_mm=FieldValue(value=60.1, source=Source.product_page),
        wheel_diameter_in=FieldValue(value=20, source=Source.product_page),
        wheel_width_j=FieldValue(value=8.5, source=Source.product_page),
        offset_et_mm=FieldValue(value=40, source=Source.product_page),
    )

    verdict = assemble_verdict(
        CompatibilityEngine().evaluate(
            profile, RimSetup(front=raw_parser_rim, rear=raw_parser_rim)
        ),
        provider="wheel_size",
    )

    assert verdict.status is VerdictStatus.unknown
    assert ReasonCode.conflict_low_evidence in verdict.reason_codes
