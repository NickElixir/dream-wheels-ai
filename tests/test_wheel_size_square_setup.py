import json
from pathlib import Path

import pytest

from src.fitment.providers.wheel_size import WheelSizeProvider

_FIXTURE_PATH = Path(__file__).parent / "fixtures" / "fitment" / "wheel_size_et_reference_v1.json"
_ET_FIXTURES = json.loads(_FIXTURE_PATH.read_text())["candidates"]


def test_front_only_provider_profile_is_normalized_for_square_setup() -> None:
    profile = WheelSizeProvider(api_key="test")._normalize_profile(
        [
            {
                "technical": {"stud_holes": 5, "pcd": 114.3, "centre_bore": 60.1},
                "wheels": [
                    {
                        "front": {
                            "rim_diameter": 20,
                            "rim_width": 8.5,
                            "offset": 38,
                            "is_stock": True,
                        }
                    }
                ],
            }
        ]
    )

    assert profile is not None
    assert len(profile.allowed_for_axle("front")) == 1
    assert len(profile.allowed_for_axle("rear")) == 1


def test_live_rim_offset_field_builds_et_reference() -> None:
    profile = WheelSizeProvider(api_key="test")._normalize_profile(
        [
            {
                "technical": {"stud_holes": 5, "pcd": 114.3, "centre_bore": "60.1"},
                "wheels": [
                    {
                        "is_stock": True,
                        "front": {
                            "rim_diameter": 19,
                            "rim_width": 8,
                            "rim_offset": 40,
                        },
                    }
                ],
            }
        ]
    )

    assert profile is not None
    reference = profile.offset_reference_for("front", 19, 8)
    assert reference is not None
    assert reference.et_min_mm == 40
    assert reference.et_max_mm == 40
    assert reference.source_offsets_mm == [40]
    assert reference.evidence_class == "stock"


@pytest.mark.parametrize("candidate", _ET_FIXTURES, ids=lambda item: item["id"])
def test_provider_exact_pair_retains_et_through_normalized_profile(candidate: dict) -> None:
    """Provider fixture → normalized/persistable technical reference."""
    expected = candidate["expected_pair"]
    profile = WheelSizeProvider(api_key="test")._normalize_profile(candidate["raw_data"])

    assert profile is not None
    reference = profile.offset_reference_for(
        expected["axle"], expected["rim_diameter"], expected["rim_width"]
    )
    assert reference is not None
    assert reference.source_offsets_mm == [expected["rim_offset"]]
    assert reference.et_min_mm == expected["rim_offset"]
    assert reference.et_max_mm == expected["rim_offset"]
    assert reference.evidence_class == "stock"
    # evaluation_snapshot stores model_dump(mode="json"); this round-trip is
    # the persistence boundary before the CompatibilityEngine consumes it.
    restored = type(profile).model_validate(profile.model_dump(mode="json"))
    assert (
        restored.offset_reference_for(
            expected["axle"], expected["rim_diameter"], expected["rim_width"]
        )
        == reference
    )


def test_multiple_provider_offsets_for_one_exact_pair_form_only_that_pair_interval() -> None:
    profile = WheelSizeProvider(api_key="test")._normalize_profile(
        [
            {
                "technical": {"stud_holes": 5, "pcd": 114.3},
                "wheels": [
                    {
                        "is_stock": True,
                        "front": {
                            "rim_diameter": 19,
                            "rim_width": 8,
                            "rim_offset": [38, 40, 42],
                        },
                    },
                    {
                        "is_stock": True,
                        "front": {"rim_diameter": 19, "rim_width": 8.5, "rim_offset": 35},
                    },
                ],
            }
        ]
    )

    assert profile is not None
    reference = profile.offset_reference_for("front", 19, 8)
    assert reference is not None
    assert reference.source_offsets_mm == [38, 40, 42]
    assert (reference.et_min_mm, reference.et_max_mm) == (38, 42)
