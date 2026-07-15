from src.fitment.providers.wheel_size import WheelSizeProvider


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
