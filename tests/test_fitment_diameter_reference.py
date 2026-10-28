import json
from pathlib import Path

import pytest

from src.fitment.diameter_reference import diameter_reference_detail
from src.fitment.providers.wheel_size import WheelSizeProvider
from src.fitment_checks_api import _diameter_reference_details


@pytest.mark.parametrize(
    "submitted,values,relation,exact",
    [
        (16, [19, 20], "below", False),
        (21, [19, 20], "above", False),
        (19, [19, 20], "within_bounds", True),
        (20, [19, 20], "within_bounds", True),
        (19, [18, 20], "within_bounds", False),
        (19, [], "unknown", None),
    ],
)
def test_diameter_only_relation(submitted, values, relation, exact):
    for width in [None, 8.5, 10, "broken"]:
        rows = [{"axle": "front", "rim_diameter": x, "rim_width": width} for x in values]
        detail = diameter_reference_detail(submitted, rows, axle="front")
        assert (detail.reference_relation, detail.exact_diameter_match) == (relation, exact)
        assert detail.reference_diameters_in == sorted(set(values))


def test_malformed_and_axle_reference_safe_degradation():
    rows = [
        None,
        {},
        {"axle": "front", "rim_diameter": float("nan")},
        {"axle": "front", "rim_diameter": True},
        {"axle": "front", "rim_diameter": -1},
        {"axle": "front", "rim_diameter": "19"},
        {"axle": "rear", "rim_diameter": 19},
    ]
    assert diameter_reference_detail(16, rows, axle="front").reference_relation == "unknown"
    assert diameter_reference_detail(16, rows, axle="rear").reference_relation == "below"
    assert diameter_reference_detail(float("inf"), rows, axle="rear").exact_diameter_match is None


def test_cayenne_exact_modification_saved_api_detail_width_independent():
    root = Path(__file__).resolve().parents[1] / "docs/evidence/p05c0-wheel-size-live-spike/raw"
    provider = WheelSizeProvider(api_key="", cache=object())
    for slug, relation, exact, diameters in [
        ("117a52c786", "within_bounds", True, [19, 20, 21, 22]),
        ("19e5c5a357", "below", False, [20, 21, 22]),
    ]:
        data = json.loads((root / f"porsche-cayenne-2021-eudm-exact-{slug}.json").read_text())[
            "data"
        ]
        profile = provider._normalize_profile(data).model_dump()
        for width in [8.5, 10, None]:
            row = {
                "execution_status": "completed",
                "input_snapshot": {
                    "rim_setup": {
                        "is_staggered": True,
                        "front": {
                            "wheel_diameter_in": {"source": "user_confirmed", "value": 19},
                            "wheel_width_j": {"source": "user_confirmed", "value": width},
                        },
                        "rear": {"wheel_diameter_in": {"source": "user_confirmed", "value": 16}},
                    }
                },
                "evaluation_snapshot": {"normalized_profile": profile},
            }
            front, rear = _diameter_reference_details(row)
            assert front.reference_relation == relation
            assert front.exact_diameter_match == exact
            assert front.reference_diameters_in == diameters
            assert rear.axle == "rear" and rear.reference_relation == "below"
        assert _diameter_reference_details({"execution_status": "failed"}) == []
