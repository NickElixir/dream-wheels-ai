"""P0.5-E presentation regressions; the actual overall engine stays unchanged."""

import copy
import json

import pytest

from src import fitment_checks_api as api
from src.fitment.rules.engine import run_checks
from src.fitment.rules.tolerances import ENGINE_VERSION, TOLERANCES_VERSION
from src.fitment.rules.verdict import assemble_verdict
from src.fitment.schemas import (
    AxleFitment,
    FieldValue,
    FitmentProfile,
    OffsetReference,
    RimSetup,
    RimSpec,
)


def saved_check(diameter=19, width=8.5, et=45, count=5, pcd=112, bore=66.6, sizes=None):
    front = RimSpec(
        **{
            name: FieldValue(value=value, source="user_confirmed")
            for name, value in {
                "wheel_diameter_in": diameter,
                "wheel_width_j": width,
                "offset_et_mm": et,
                "bolt_count": count,
                "pcd_mm": pcd,
                "center_bore_mm": bore,
            }.items()
        }
    )
    setup = RimSetup(front=front, rear=front)
    profile = FitmentProfile(
        provider="saved",
        bolt_count=5,
        pcd_mm=112,
        center_bore_mm=66.6,
        allowed_wheels=[
            AxleFitment(axle=axle, rim_diameter=d, rim_width=w)
            for axle in ("front", "rear")
            for d, w in (sizes or [(19, 8.5)])
        ],
        offset_references=[
            OffsetReference(
                axle=axle, rim_diameter_in=19, rim_width_j=8.5, et_min_mm=40, et_max_mm=50
            )
            for axle in ("front", "rear")
        ],
    )
    result = assemble_verdict(run_checks(profile, setup), provider="saved", is_preliminary=True)
    return {
        "id": "11111111-1111-4111-8111-111111111111",
        "execution_status": "completed",
        "verdict": result.status.value,
        "is_preliminary": True,
        "engine_version": ENGINE_VERSION,
        "rules_version": TOLERANCES_VERSION,
        "error": None,
        "input_snapshot": {"rim_setup": setup.model_dump(mode="json")},
        "evaluation_snapshot": {"normalized_profile": profile.model_dump(mode="json")},
        "result": result.model_dump(mode="json"),
    }


def fields(row, axle="front"):
    return {item.field: item for item in api._response(row).field_results if item.axle == axle}


@pytest.mark.parametrize(
    "case,kwargs,expected,overall",
    [
        ("A/D", {"width": 10}, ("pass", "unknown", "unknown", "pass", "pass"), "unknown"),
        ("B", {"diameter": 20}, ("unknown", "pass", "unknown", "pass", "pass"), "unknown"),
        (
            "C",
            {"sizes": [(18, 8.5), (20, 8.5)]},
            ("unknown", "pass", "pass", "pass", "pass"),
            "unknown",
        ),
        ("E", {}, ("pass", "pass", "pass", "pass", "pass"), "compatible"),
        ("F", {"et": 55}, ("pass", "pass", "unknown", "pass", "pass"), "unknown"),
        (
            "G",
            {"width": 9, "sizes": [(19, 8.5), (20, 9)]},
            ("pass", "pass", "unknown", "pass", "pass"),
            "unknown",
        ),
        ("H", {"count": 4}, ("pass", "pass", "pass", "pass", "fail"), "incompatible"),
        ("I", {"pcd": 114.3}, ("pass", "pass", "pass", "fail", "pass"), "incompatible"),
        ("J", {"count": 4, "pcd": 114.3}, ("pass", "pass", "pass", "fail", "fail"), "incompatible"),
    ],
)
def test_a_to_j_saved_field_matrix_preserves_overall(case, kwargs, expected, overall):
    row = saved_check(**kwargs)
    before = copy.deepcopy(row)
    response = api._response(row)
    assert response.verdict == overall
    assert len(response.field_results) == 12
    for axle in ("front", "rear"):
        actual = fields(row, axle)
        assert (
            tuple(
                actual[name].status
                for name in (
                    "wheel_diameter_in",
                    "wheel_width_j",
                    "offset_et_mm",
                    "pcd",
                    "bolt_count",
                )
            )
            == expected
        )
        if expected[2] == "unknown":
            assert actual["offset_et_mm"].code == (
                "et_outside_reference_range" if case == "F" else "vehicle_reference_offset_missing"
            )
        if expected[3] == "fail":
            assert actual["pcd"].code == "pcd_mismatch"
        if expected[4] == "fail":
            assert actual["bolt_count"].code == "bolt_count_mismatch"
    detail = response.diameter_reference_details[0]
    assert detail.exact_diameter_match == (expected[0] == "pass")
    if case == "C":
        assert detail.reference_relation == "within_bounds" and not detail.exact_diameter_match
    if case == "G":
        assert any(
            item["reason_code"] == "size_not_in_reference" for item in row["result"]["rule_results"]
        )
        assert any(item["code"] == "size_not_in_reference" for item in response.blocking_issues)
    assert row == before  # projection never changes persisted rules or versions
    row["input_snapshot"] = json.dumps(row["input_snapshot"])
    row["evaluation_snapshot"] = json.dumps(row["evaluation_snapshot"])
    assert api._response(row) == response


@pytest.mark.parametrize(
    "bore,status,code",
    [
        (65, "fail", "center_bore_too_small"),
        (66.6, "pass", "matches_approved_fitment"),
        (70, "conditional", "hub_rings_required"),
    ],
)
def test_dia_uses_unchanged_saved_rule(bore, status, code):
    row = saved_check(bore=bore)
    assert (fields(row)["center_bore_mm"].status, fields(row)["center_bore_mm"].code) == (
        status,
        code,
    )


@pytest.mark.parametrize(
    "name",
    [
        "wheel_diameter_in",
        "wheel_width_j",
        "offset_et_mm",
        "pcd_mm",
        "bolt_count",
        "center_bore_mm",
    ],
)
@pytest.mark.parametrize(
    "raw",
    [
        None,
        19,
        {"value": 19},
        {"value": 19, "source": "ocr"},
        {"value": True, "source": "user_confirmed"},
        {"value": 19, "source": "invalid"},
    ],
)
def test_legacy_missing_untrusted_or_malformed_never_passes_or_fails(name, raw):
    row = saved_check()
    row["input_snapshot"]["rim_setup"]["front"][name] = raw
    field = "pcd" if name == "pcd_mm" else name
    assert fields(row)[field].status == "unknown"
    if name == "wheel_diameter_in":
        assert api._response(row).diameter_reference_details[0].exact_diameter_match is None


@pytest.mark.parametrize(
    "name,value", [("wheel_diameter_in", 19.05), ("wheel_width_j", 8.55), ("pcd_mm", 112.05)]
)
def test_existing_tolerances_applied_only_to_field_matching(name, value):
    row = saved_check()
    row["input_snapshot"]["rim_setup"]["front"][name]["value"] = value
    assert fields(row)["pcd" if name == "pcd_mm" else name].status == "pass"
    if name != "pcd_mm":
        assert fields(row)["offset_et_mm"].status == "unknown"  # ET context still exact
    if name == "wheel_diameter_in":
        assert api._response(row).diameter_reference_details[0].exact_diameter_match is True


def test_staggered_axles_and_saved_only_evidence(monkeypatch):
    row = saved_check()
    rear = copy.deepcopy(row["input_snapshot"]["rim_setup"]["front"])
    rear["wheel_width_j"]["value"] = 10
    rear["pcd_mm"]["value"] = 114.3
    row["input_snapshot"]["rim_setup"].update(rear=rear, is_staggered=True)

    def forbidden(*args, **kwargs):
        raise AssertionError(
            "Historical presentation must not query current inputs/provider or rerun engine"
        )

    monkeypatch.setattr(api, "WheelSizeProvider", forbidden)
    monkeypatch.setattr(api, "run_checks", forbidden)
    assert fields(row)["wheel_width_j"].status == "pass"
    assert fields(row, "rear")["wheel_width_j"].status == "unknown"
    assert fields(row)["pcd"].status == "pass"
    assert fields(row, "rear")["pcd"].status == "fail"
    assert all(
        item.exact_diameter_match is True for item in api._response(row).diameter_reference_details
    )
    row["evaluation_snapshot"] = {}
    assert all(item.status == "unknown" for item in api._response(row).field_results)


def test_diameter_detail_at_tolerance_boundary_and_independent_low_evidence():
    row = saved_check(diameter=19.95, sizes=[(20, 8.5)])
    assert fields(row)["wheel_diameter_in"].status == "pass"
    detail = api._response(row).diameter_reference_details[0]
    assert detail.exact_diameter_match is True and detail.reference_relation == "within_bounds"
    for untrusted, independent in [
        ("wheel_width_j", "wheel_diameter_in"),
        ("bolt_count", "pcd"),
        ("pcd_mm", "bolt_count"),
    ]:
        row = saved_check()
        row["input_snapshot"]["rim_setup"]["front"][untrusted]["source"] = "ocr"
        assert fields(row)[independent].status == "pass"
