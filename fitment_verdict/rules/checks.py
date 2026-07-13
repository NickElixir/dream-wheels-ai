"""Deterministic fitment checks."""

from __future__ import annotations

from fitment_verdict.rules import tolerances as tol
from fitment_verdict.schemas import FitmentProfile, RimSpec, RuleResult, VerdictStatus
from fitment_verdict.utils import almost_equal, normalize_bolt_pattern, to_float


def _result(
    rule: str,
    status: VerdictStatus,
    reason: str,
    reason_code: str,
    **detail,
) -> RuleResult:
    return RuleResult(
        rule=rule,
        status=status,
        reason=reason,
        reason_code=reason_code,
        detail=detail,
    )


def check_bolt_pattern(profile: FitmentProfile | None, rim: RimSpec) -> RuleResult:
    rim = rim.model_copy(deep=True).sync_bolt_fields()
    car_bp = normalize_bolt_pattern(profile.bolt_pattern if profile else None)
    car_pcd = profile.pcd if profile else None
    car_holes = profile.stud_holes if profile else None
    rim_bp = normalize_bolt_pattern(rim.bolt_pattern)
    rim_pcd = rim.pcd_mm or rim.pcd

    # Hole count mismatch is decisive even when PCD is unreadable.
    if car_holes and rim.bolt_count and car_holes != rim.bolt_count:
        return _result(
            "bolt_pattern",
            VerdictStatus.incompatible,
            f"Bolt hole count mismatch: vehicle={car_holes}, rim={rim.bolt_count}",
            "MOUNTING_BOLT_COUNT_MISMATCH",
            vehicle=car_holes,
            rim=rim.bolt_count,
        )

    if not car_bp and car_pcd is None:
        return _result(
            "bolt_pattern",
            VerdictStatus.unknown,
            "Vehicle bolt pattern is unknown.",
            "EVIDENCE_MISSING_VEHICLE_PCD",
        )
    if not rim_bp and rim_pcd is None:
        return _result(
            "bolt_pattern",
            VerdictStatus.unknown,
            "Rim bolt pattern is unknown.",
            "EVIDENCE_MISSING_RIM_PCD",
        )

    if car_bp and rim_bp and car_bp != rim_bp:
        return _result(
            "bolt_pattern",
            VerdictStatus.incompatible,
            f"Bolt pattern mismatch: vehicle={car_bp}, rim={rim_bp}",
            "MOUNTING_BOLT_PATTERN_MISMATCH",
            vehicle=car_bp,
            rim=rim_bp,
        )

    if (
        car_pcd is not None
        and rim_pcd is not None
        and not almost_equal(car_pcd, rim_pcd, tol.PCD_TOL_MM)
    ):
        return _result(
            "bolt_pattern",
            VerdictStatus.incompatible,
            f"PCD mismatch: vehicle={car_pcd}, rim={rim_pcd}",
            "MOUNTING_PCD_MISMATCH",
            vehicle=car_pcd,
            rim=rim_pcd,
        )

    return _result(
        "bolt_pattern",
        VerdictStatus.compatible,
        "Bolt pattern and PCD match.",
        "MOUNTING_OK",
    )


def check_center_bore(profile: FitmentProfile | None, rim: RimSpec) -> RuleResult:
    rim = rim.model_copy(deep=True).sync_bolt_fields()
    hub = profile.center_bore if profile else None
    rim_cb = rim.center_bore_mm or rim.center_bore

    if hub is None:
        return _result(
            "center_bore",
            VerdictStatus.unknown,
            "Vehicle center bore is unknown.",
            "EVIDENCE_MISSING_VEHICLE_BORE",
        )
    if rim_cb is None:
        return _result(
            "center_bore",
            VerdictStatus.unknown,
            "Rim center bore is unknown.",
            "EVIDENCE_MISSING_RIM_BORE",
        )

    if rim_cb < hub - tol.CB_TOL_MM:
        return _result(
            "center_bore",
            VerdictStatus.incompatible,
            f"Center bore too small: hub={hub}, rim={rim_cb}",
            "MOUNTING_BORE_TOO_SMALL",
            hub=hub,
            rim=rim_cb,
        )

    if rim_cb > hub + tol.CB_TOL_MM:
        return _result(
            "center_bore",
            VerdictStatus.compatible_with_conditions,
            f"Hub-centric rings required: hub={hub}, rim={rim_cb}",
            "CONDITION_HUB_RINGS_REQUIRED",
            hub=hub,
            rim=rim_cb,
        )

    return _result(
        "center_bore",
        VerdictStatus.compatible,
        "Center bore matches hub.",
        "BORE_OK",
    )


def _extract_allowed(profile: FitmentProfile) -> list[dict]:
    records: list[dict] = []
    for item in profile.allowed_wheels:
        records.append(
            {
                "axle": item.axle,
                "rim_diameter": item.rim_diameter,
                "rim_width": item.rim_width,
                "offset": item.offset,
                "is_stock": item.is_stock,
            }
        )
    return records


def check_size_and_offset(profile: FitmentProfile | None, rim: RimSpec) -> list[RuleResult]:
    diameter = rim.diameter
    width = rim.width
    offset = rim.offset

    if diameter is None or width is None:
        return [
            _result(
                "size",
                VerdictStatus.unknown,
                "Rim diameter and width are required.",
                "EVIDENCE_MISSING_RIM_SIZE",
            )
        ]

    if profile is None or not profile.allowed_wheels:
        if offset is None:
            return [
                _result(
                    "size",
                    VerdictStatus.unknown,
                    "No provider allowed wheel set and rim offset is unknown.",
                    "EVIDENCE_MISSING_PROFILE_AND_ET",
                )
            ]
        return [
            _result(
                "size",
                VerdictStatus.unknown,
                "No provider allowed wheel set to validate size.",
                "EVIDENCE_MISSING_PROFILE",
            )
        ]

    allowed = _extract_allowed(profile)
    exact_matches: list[dict] = []
    uncertain_matches: list[dict] = []
    near_matches: list[dict] = []

    for rec in allowed:
        size_reasons: list[str] = []
        if not almost_equal(diameter, rec["rim_diameter"], tol.DIAMETER_TOL_IN):
            size_reasons.append(f"diameter mismatch ({diameter} vs {rec['rim_diameter']})")
        if not almost_equal(width, rec["rim_width"], tol.WIDTH_TOL_IN):
            size_reasons.append(f"width mismatch ({width} vs {rec['rim_width']})")

        if size_reasons:
            score = abs(diameter - rec["rim_diameter"]) * 10 + abs(width - rec["rim_width"])
            near_matches.append({**rec, "reasons": size_reasons, "score": score})
            continue

        if offset is not None and rec["offset"] is not None:
            if almost_equal(offset, rec["offset"], tol.ET_APPROVED_TOL_MM):
                exact_matches.append(rec)
            else:
                delta = offset - rec["offset"]
                near_matches.append(
                    {
                        **rec,
                        "reasons": [f"offset mismatch ({offset} vs {rec['offset']})"],
                        "score": 0.01 + abs(delta),
                        "offset_delta": delta,
                    }
                )
        else:
            uncertain_matches.append(rec)

    near_matches.sort(key=lambda item: item.get("score", 0))

    if exact_matches:
        return [
            _result(
                "size",
                VerdictStatus.compatible,
                "Wheel matches an approved wheel configuration from provider data.",
                "SIZE_EXACT_APPROVED",
                matches=exact_matches,
            )
        ]

    if uncertain_matches:
        return [
            _result(
                "size",
                VerdictStatus.compatible_with_conditions,
                "Wheel size matches approved fitment, but offset could not be fully verified.",
                "CONDITION_OFFSET_UNVERIFIED",
                matches=uncertain_matches,
            )
        ]

    if near_matches:
        best = near_matches[0]
        offset_delta = to_float(best.get("offset_delta"))
        if offset_delta is not None and abs(offset_delta) > tol.ET_HARD_LIMIT_MM:
            return [
                _result(
                    "offset",
                    VerdictStatus.incompatible,
                    "Offset is far outside approved fitment range.",
                    "OFFSET_OUT_OF_RANGE",
                    closest=best,
                ),
                _result(
                    "size",
                    VerdictStatus.compatible_with_conditions,
                    "Mounting geometry acceptable, but size/offset not approved.",
                    "SIZE_NOT_APPROVED",
                    closest=best,
                ),
            ]
        return [
            _result(
                "size",
                VerdictStatus.compatible_with_conditions,
                "Mounting geometry acceptable, but no approved wheel size matched.",
                "SIZE_NOT_APPROVED",
                closest=best,
            )
        ]

    return [
        _result(
            "size",
            VerdictStatus.compatible_with_conditions,
            "Mounting geometry acceptable, but no approved wheel size matched.",
            "SIZE_NOT_APPROVED",
        )
    ]


def check_offset_general(profile: FitmentProfile | None, rim: RimSpec) -> RuleResult | None:
    if profile is None or rim.offset is None:
        return None

    oem = profile.oem_offset_front or profile.oem_offset_rear
    if oem is None:
        return None

    delta = rim.offset - oem
    if abs(delta) <= tol.ET_OK_BAND_MM:
        return _result(
            "offset",
            VerdictStatus.compatible,
            f"Offset within OEM band ({delta:+.1f} mm vs OEM {oem}).",
            "OFFSET_OK",
            delta=delta,
            oem=oem,
        )

    if abs(delta) > tol.ET_HARD_LIMIT_MM:
        return _result(
            "offset",
            VerdictStatus.incompatible,
            f"Offset exceeds hard limit ({delta:+.1f} mm vs OEM {oem}).",
            "OFFSET_OUT_OF_RANGE",
            delta=delta,
            oem=oem,
        )

    if delta > tol.ET_OK_BAND_MM and delta <= tol.ET_OK_BAND_MM + tol.ET_INWARD_MAX_MM:
        return _result(
            "offset",
            VerdictStatus.compatible_with_conditions,
            "Offset pushes wheel inward; verify suspension clearance.",
            "CONDITION_OFFSET_INWARD",
            delta=delta,
            oem=oem,
        )

    if delta < -tol.ET_OK_BAND_MM and abs(delta) <= tol.ET_OUTWARD_MAX_MM:
        return _result(
            "offset",
            VerdictStatus.compatible_with_conditions,
            "Offset pushes wheel outward; verify fender/arch clearance.",
            "CONDITION_OFFSET_OUTWARD",
            delta=delta,
            oem=oem,
        )

    return _result(
        "offset",
        VerdictStatus.compatible_with_conditions,
        "Offset differs from OEM; clearance verification required.",
        "CONDITION_OFFSET_CLEARANCE",
        delta=delta,
        oem=oem,
    )


def run_all_checks(profile: FitmentProfile | None, rim: RimSpec) -> list[RuleResult]:
    results = [
        check_bolt_pattern(profile, rim),
        check_center_bore(profile, rim),
        *check_size_and_offset(profile, rim),
    ]
    offset_result = check_offset_general(profile, rim)
    if offset_result is not None:
        results.append(offset_result)
    return results
