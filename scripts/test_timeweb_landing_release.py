"""Protect the landing release boundary from targeting the existing application."""

import json
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from timeweb_landing_release import (
    BUILD_COMMAND,
    INDEX_DIR,
    ReleaseError,
    provision_app,
    validate_target,
)


class LandingBoundaryTest(unittest.TestCase):
    def test_only_isolated_frontend_with_reviewed_settings_is_allowed(self) -> None:
        app = {
            "type": "frontend",
            "name": "dream-wheels-landing-test",
            "build_cmd": BUILD_COMMAND,
            "index_dir": INDEX_DIR,
            "envs": {"TIMEWEB_LANDING_PROFILE": "landing-ru-test"},
        }
        validate_target(app, 999999)
        for key, value in (
            ("type", "backend"),
            ("name", "dream-wheels-ru-app"),
            ("index_dir", "/dist/timeweb"),
            ("envs", {"BOT_TOKEN": "private"}),
        ):
            with self.subTest(key=key), self.assertRaises(ReleaseError):
                validate_target({**app, key: value}, 999999)
        for app_id in (281247, 281549):
            with self.subTest(app_id=app_id), self.assertRaises(ReleaseError):
                validate_target(app, app_id)


class LandingProvisionTest(unittest.TestCase):
    def test_duplicate_name_is_reused_without_billing_another_app(self) -> None:
        app = {
            "id": 999999,
            "name": "dream-wheels-landing-test",
            "type": "frontend",
            "build_cmd": BUILD_COMMAND,
            "index_dir": INDEX_DIR,
            "envs": {},
        }
        api = Mock()
        api.get_apps_with_http_info.return_value = SimpleNamespace(
            status_code=200, raw_data=json.dumps({"apps": [app]})
        )
        module = SimpleNamespace(CreateAppV2=Mock())
        with patch.dict(sys.modules, {"timeweb_cloud_api.models.create_app_v2": module}):
            result = provision_app(api, "landing-ru-test", "a" * 40)
        self.assertFalse(result["created"])
        api.create_app_v2_with_http_info.assert_not_called()
        module.CreateAppV2.assert_not_called()

    def test_price_change_stops_before_creating_billable_resource(self) -> None:
        api = Mock()
        api.get_apps_with_http_info.return_value = SimpleNamespace(
            status_code=200, raw_data='{"apps": []}'
        )
        module = SimpleNamespace(CreateAppV2=Mock())
        with (
            patch.dict(sys.modules, {"timeweb_cloud_api.models.create_app_v2": module}),
            patch("timeweb_landing_release.timeweb_app_payload", return_value={}),
            patch(
                "timeweb_landing_release.timeweb_json_payload",
                return_value={"frontend_presets": []},
            ),
            self.assertRaises(ReleaseError),
        ):
            provision_app(api, "landing-ru-test", "a" * 40)
        module.CreateAppV2.assert_not_called()


if __name__ == "__main__":
    unittest.main()
