import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock

from timeweb_release import (
    RELEASES,
    ReleaseError,
    TimewebSDKError,
    build_target_envs,
    read_snapshot,
    run_release,
    validate_artifact_manifest,
)

TEST_SHA = "a" * 40
PRIOR_SHA = "b" * 40
GATEWAY_SHA = "c" * 40
PUBLIC_VALUES = {
    "EXPECTED_SUPABASE_URL": "https://test.supabase.co",
    "SUPABASE_URL": "https://test.supabase.co",
    "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_public_value",
    "TURNSTILE_SITE_KEY": "0x_public_value",
}


class ApiStub:
    def __init__(self, app):
        self.app = app
        self.updated = []
        self.deployed = []
        self.deploys = []

    def get_app(self, app_id):
        assert str(app_id) in {str(value["app_id"]) for value in RELEASES.values()}
        return {"app": self.app}

    def update_app_settings(self, app_id, settings):
        self.updated.append((app_id, settings))
        values = settings if isinstance(settings, dict) else settings.dict(exclude_none=True)
        self.app.update(values)

    def create_deploy(self, app_id, request):
        values = request if isinstance(request, dict) else request.dict(exclude_none=True)
        deploy = {"id": len(self.deployed) + 1, "commit_sha": values["commit_sha"]}
        self.deployed.append((app_id, values))
        self.deploys.append({**deploy, "ended_at": "done"})
        self.app["commit_sha"] = values["commit_sha"]
        self.app["status"] = "active"
        return {"deploy": deploy}

    def get_app_deploys(self, app_id, limit, offset):
        return {"deploys": list(self.deploys)}


class TestTimewebRelease(unittest.TestCase):
    def setUp(self):
        self.ancestry = Mock()

    @staticmethod
    def factories(**values):
        return values

    def test_sdk_diagnostics_include_only_stage_class_status_and_schema_field_names(self):
        secret = "never-print-this-token-or-response-body"

        class HttpError(Exception):
            status = 413

            def __str__(self):
                return secret

            def errors(self):
                return [
                    {"loc": ("app", "envs"), "input": secret, "msg": secret},
                    {"loc": ("app", "commit_sha"), "input": secret, "msg": secret},
                ]

        diagnostic = TimewebSDKError("read app settings", HttpError())
        message = str(diagnostic)
        self.assertIn("read app settings", message)
        self.assertIn("HttpError", message)
        self.assertIn("HTTP 413", message)
        self.assertIn("app.commit_sha", message)
        self.assertIn("app.envs", message)
        self.assertNotIn(secret, message)

    def app(self, profile="ru-test", sha=PRIOR_SHA, envs=None):
        release = RELEASES[profile]
        return {
            "id": release["app_id"],
            "type": "frontend",
            "status": "active",
            "branch_name": release["branch"],
            "commit_sha": sha,
            "is_auto_deploy": True,
            "envs": envs
            if envs is not None
            else {
                "TIMEWEB_API_TARGET": "deno-test",
                "TIMEWEB_PROFILE": "ru-test",
                "APP_BUILD_SHA": PRIOR_SHA,
                "SUPABASE_URL": "https://old.supabase.co",
                "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_old_public",
                "TURNSTILE_SITE_KEY": "0x_old_public",
                "UNRELATED_PUBLIC_SETTING": "preserve",
            },
        }

    def test_fixed_profile_mapping_and_target_env_preservation(self):
        self.assertEqual(RELEASES["ru-test"]["app_id"], 281549)
        self.assertEqual(RELEASES["ru-production"]["app_id"], 281247)
        existing = {"TIMEWEB_API_TARGET": "deno-test", "OTHER": "keep"}
        result = build_target_envs(existing, "ru-test", TEST_SHA, PUBLIC_VALUES)
        self.assertNotIn("TIMEWEB_API_TARGET", result)
        self.assertEqual(result["OTHER"], "keep")
        self.assertEqual(result["APP_BUILD_SHA"], TEST_SHA)
        self.assertEqual(result["TIMEWEB_PROFILE"], "ru-test")

    def test_immutable_artifact_manifest_is_sha_profile_and_api_target_gated(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "manifest.json"
            path.write_text(
                json.dumps(
                    {
                        "profile": "ru-test",
                        "commit": TEST_SHA,
                        "api_base_url": "https://gateway-test.dreamwheels.deno.net/api/backend",
                    }
                )
            )
            self.assertEqual(
                validate_artifact_manifest(path, "ru-test", TEST_SHA)["profile"], "ru-test"
            )
            with self.assertRaises(ReleaseError):
                validate_artifact_manifest(path, "ru-production", TEST_SHA)
            with self.assertRaises(ReleaseError):
                validate_artifact_manifest(path, "ru-test", PRIOR_SHA)

    def test_dry_run_is_read_only_and_writes_only_allowlisted_snapshot(self):
        api = ApiStub(self.app())
        with tempfile.TemporaryDirectory() as directory:
            snapshot_path = Path(directory) / "snapshot.json"
            report = run_release(
                api=api,
                update_settings_factory=self.factories,
                deploy_request_factory=self.factories,
                profile="ru-test",
                sha=TEST_SHA,
                gateway_sha=GATEWAY_SHA,
                apply=False,
                snapshot_path=snapshot_path,
                public_values=PUBLIC_VALUES,
                ancestry_validator=self.ancestry,
            )
            snapshot = json.loads(snapshot_path.read_text())
            self.assertEqual(report["mode"], "release")
            self.assertEqual(report["preserved_env_keys"], ["UNRELATED_PUBLIC_SETTING"])
            self.assertEqual(snapshot["prior_commit_sha"], PRIOR_SHA)
            self.assertNotIn("UNRELATED_PUBLIC_SETTING", snapshot["prior_managed_envs"])
            self.assertEqual(api.updated, [])
            self.assertEqual(api.deployed, [])

    def test_apply_patches_profile_and_commit_then_waits_and_verifies(self):
        api = ApiStub(self.app())
        verified = Mock(return_value={"ok": True, "sha": TEST_SHA})
        with tempfile.TemporaryDirectory() as directory:
            report = run_release(
                api=api,
                update_settings_factory=self.factories,
                deploy_request_factory=self.factories,
                profile="ru-test",
                sha=TEST_SHA,
                gateway_sha=GATEWAY_SHA,
                apply=True,
                snapshot_path=Path(directory) / "snapshot.json",
                public_values=PUBLIC_VALUES,
                ancestry_validator=self.ancestry,
                verifier=verified,
                gateway_validator=Mock(return_value={"ok": True}),
            )
        patched = api.updated[0][1]
        self.assertEqual(patched["branch_name"], "staging")
        self.assertEqual(patched["commit_sha"], TEST_SHA)
        self.assertFalse(patched["is_auto_deploy"])
        self.assertNotIn("TIMEWEB_API_TARGET", patched["envs"])
        self.assertEqual(patched["envs"]["UNRELATED_PUBLIC_SETTING"], "preserve")
        self.assertEqual(api.deployed, [(281549, {"commit_sha": TEST_SHA})])
        self.assertEqual(report["deployment"]["commit_sha"], TEST_SHA)
        verified.assert_called_once_with("ru-test", TEST_SHA, gateway_sha=GATEWAY_SHA)

    def test_production_app_is_pinned_to_main(self):
        api = ApiStub(self.app(profile="ru-production", envs={"KEEP": "x"}))
        with tempfile.TemporaryDirectory() as directory:
            run_release(
                api=api,
                update_settings_factory=self.factories,
                deploy_request_factory=self.factories,
                profile="ru-production",
                sha=TEST_SHA,
                gateway_sha=GATEWAY_SHA,
                apply=False,
                snapshot_path=Path(directory) / "snapshot.json",
                public_values=PUBLIC_VALUES,
                ancestry_validator=self.ancestry,
            )
        self.ancestry.assert_called_once_with(TEST_SHA, "main")

    def test_snapshot_authorizes_legacy_sha_outside_current_branch_history(self):
        api = ApiStub(
            self.app(
                sha=TEST_SHA,
                envs={
                    "TIMEWEB_PROFILE": "ru-test",
                    "APP_BUILD_SHA": TEST_SHA,
                    "SUPABASE_URL": "https://new.supabase.co",
                    "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_new_public",
                    "TURNSTILE_SITE_KEY": "0x_new_public",
                    "UNRELATED_PUBLIC_SETTING": "current",
                },
            )
        )
        snapshot_data = {
            "schema_version": 1,
            "profile": "ru-test",
            "app_id": 281549,
            "prior_commit_sha": PRIOR_SHA,
            "prior_branch_name": "staging",
            "prior_is_auto_deploy": True,
            "prior_managed_envs": {
                "TIMEWEB_API_TARGET": "deno-test",
                "SUPABASE_URL": "https://old.supabase.co",
                "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_old_public",
                "TURNSTILE_SITE_KEY": "0x_old_public",
            },
        }
        rollback_ancestry = Mock()
        rollback_object = Mock()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "snapshot.json"
            path.write_text(json.dumps(snapshot_data))
            report = run_release(
                api=api,
                update_settings_factory=self.factories,
                deploy_request_factory=self.factories,
                profile="ru-test",
                sha=PRIOR_SHA,
                gateway_sha=GATEWAY_SHA,
                apply=True,
                rollback=True,
                snapshot_path=path,
                ancestry_validator=self.ancestry,
                rollback_ancestry_validator=rollback_ancestry,
                rollback_object_validator=rollback_object,
                verifier=Mock(return_value={"ok": True}),
                legacy_verifier=Mock(return_value={"ok": True}),
                gateway_validator=Mock(return_value={"ok": True}),
            )
        patch = api.updated[0][1]
        self.assertEqual(report["mode"], "rollback")
        self.assertEqual(patch["envs"]["TIMEWEB_API_TARGET"], "deno-test")
        self.assertEqual(patch["envs"]["SUPABASE_URL"], "https://old.supabase.co")
        self.assertEqual(patch["envs"]["UNRELATED_PUBLIC_SETTING"], "current")
        self.assertEqual(patch["commit_sha"], PRIOR_SHA)
        self.assertFalse(patch["is_auto_deploy"])
        self.assertEqual(api.updated[1][1], {"is_auto_deploy": True})
        self.ancestry.assert_not_called()
        rollback_ancestry.assert_not_called()
        rollback_object.assert_called_once_with(PRIOR_SHA)

    def test_invalid_rollback_snapshot_fails_before_mutation(self):
        api = ApiStub(self.app())
        with self.assertRaises(ReleaseError):
            read_snapshot(Path("/missing/snapshot.json"), "ru-test")
        self.assertEqual(api.updated, [])
        self.assertEqual(api.deployed, [])

    def test_timeout_does_not_implicitly_start_a_rollback(self):
        api = ApiStub(self.app())

        def timeout(*_args, **_kwargs):
            raise TimeoutError("pending")

        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(TimeoutError):
                run_release(
                    api=api,
                    update_settings_factory=self.factories,
                    deploy_request_factory=self.factories,
                    profile="ru-test",
                    sha=TEST_SHA,
                    gateway_sha=GATEWAY_SHA,
                    apply=True,
                    snapshot_path=Path(directory) / "snapshot.json",
                    public_values=PUBLIC_VALUES,
                    ancestry_validator=self.ancestry,
                    poller=timeout,
                    gateway_validator=Mock(return_value={"ok": True}),
                )
        self.assertEqual(len(api.updated), 1)
        self.assertEqual(len(api.deployed), 1)


if __name__ == "__main__":
    unittest.main()
