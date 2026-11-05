"""Protect the landing release boundary from targeting the existing application."""

import unittest

from timeweb_landing_release import BUILD_COMMAND, INDEX_DIR, ReleaseError, validate_target


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


if __name__ == "__main__":
    unittest.main()
