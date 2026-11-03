import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

from timeweb_release import (
    RELEASES,
    ReleaseError,
    TimewebSDKError,
    build_target_envs,
    inspect_timeweb_app,
    make_parser,
    read_snapshot,
    run_release,
    timeweb_app_payload,
    timeweb_create_deploy,
    update_timeweb_app_settings,
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

    def get_app_with_http_info(self, app_id, *, _preload_content):
        assert str(app_id) in {str(value["app_id"]) for value in RELEASES.values()}
        assert _preload_content is False
        return SimpleNamespace(status_code=200, raw_data=json.dumps({"app": self.app}).encode())

    def update_app_settings(self, app_id, settings):
        self.updated.append((app_id, settings))
        values = settings if isinstance(settings, dict) else settings.dict(exclude_none=True)
        self.app.update(values)

    def update_app_settings_with_http_info(self, app_id, settings, *, _preload_content):
        assert _preload_content is False
        self.update_app_settings(app_id, settings)
        return SimpleNamespace(status_code=204, raw_data=b"")

    def create_deploy_with_http_info(self, app_id, request, *, _preload_content):
        assert _preload_content is False
        values = request if isinstance(request, dict) else request.dict(exclude_none=True)
        deploy = {"id": len(self.deployed) + 1, "commit_sha": values["commit_sha"]}
        self.deployed.append((app_id, values))
        self.deploys.append({**deploy, "ended_at": "done"})
        self.app["commit_sha"] = values["commit_sha"]
        self.app["status"] = "active"
        return SimpleNamespace(status_code=201, raw_data=json.dumps({"deploy": deploy}).encode())

    def get_app_deploys_with_http_info(self, app_id, limit, offset, *, _preload_content):
        assert _preload_content is False
        return SimpleNamespace(
            status_code=200, raw_data=json.dumps({"deploys": list(self.deploys)}).encode()
        )


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

    def test_sdk_diagnostics_include_simple_value_for_type_only_validation(self):
        class ValidationError(Exception):
            def errors(self):
                return [{"loc": ("app", "type"), "input": "frontend_payg"}]

        diagnostic = TimewebSDKError("read app settings", ValidationError())
        self.assertIn("schema type value: frontend_payg", str(diagnostic))

    def test_sdk_diagnostics_never_include_type_value_with_other_fields_or_unsafe_shape(self):
        class ValidationError(Exception):
            def __init__(self, issues):
                self.issues = issues

            def errors(self):
                return self.issues

        unsafe_inputs = (
            [{"loc": ("app", "type"), "input": "https://token.example/secret"}],
            [
                {"loc": ("app", "type"), "input": "frontend_payg"},
                {"loc": ("app", "envs"), "input": "sensitive-value"},
            ],
            [
                {"loc": ("app", "type"), "input": "frontend_payg"},
                {"loc": ("app", "type"), "input": "backend"},
            ],
        )
        for issues in unsafe_inputs:
            with self.subTest(issues=issues):
                diagnostic = TimewebSDKError("read app settings", ValidationError(issues))
                self.assertNotIn("schema type value:", str(diagnostic))
                self.assertNotIn("sensitive-value", str(diagnostic))

    def test_raw_app_response_uses_frontend_type_without_validating_nested_models(self):
        app = self.app()
        app["framework"] = {"type": "another"}
        with tempfile.TemporaryDirectory() as directory:
            report = run_release(
                api=ApiStub(app),
                update_settings_factory=self.factories,
                deploy_request_factory=self.factories,
                profile="ru-test",
                sha=TEST_SHA,
                gateway_sha=GATEWAY_SHA,
                apply=False,
                snapshot_path=Path(directory) / "snapshot.json",
                public_values=PUBLIC_VALUES,
                ancestry_validator=self.ancestry,
            )
        self.assertTrue(report["ok"])

    @unittest.skipUnless(
        importlib.util.find_spec("timeweb_cloud_api"), "pinned Timeweb SDK is not installed"
    )
    def test_pinned_sdk_raw_app_method_avoids_nested_provider_model_validation(self):
        import timeweb_cloud_api
        from pydantic import ValidationError
        from timeweb_cloud_api.models.create_deploy_request import CreateDeployRequest
        from timeweb_cloud_api.models.update_settings import UpdateSettings

        app = {
            "id": 281549,
            "type": "frontend",
            "status": "active",
            "provider": {"id": 1, "type": "github"},
            "framework": {"type": "another"},
            "repository": {"id": 1},
            "envs": {"KEEP": "value"},
            "branch_name": "staging",
            "is_auto_deploy": True,
            "commit_sha": PRIOR_SHA,
            "configuration": {},
            "disk_status": {},
        }
        response_body = json.dumps({"app": app}).encode()
        config = timeweb_cloud_api.Configuration(
            host="https://api.timeweb.cloud", access_token="test-only-dummy"
        )
        client = timeweb_cloud_api.ApiClient(config)
        api = timeweb_cloud_api.AppsApi(client)

        class MockResponse:
            status = 200
            data = response_body

            @staticmethod
            def getheader(name):
                return "application/json"

            @staticmethod
            def getheaders():
                return {"content-type": "application/json"}

        client.request = Mock(side_effect=lambda *args, **kwargs: MockResponse())
        with self.assertRaises(ValidationError) as raised:
            api.get_app(281549)
        self.assertEqual(tuple(raised.exception.errors()[0]["loc"]), ("type",))

        parsed_app = timeweb_app_payload(api, "read app settings", "get_app", 281549)
        self.assertEqual(parsed_app["provider"]["type"], "github")
        self.assertEqual(parsed_app["type"], "frontend")
        update_request = UpdateSettings(envs={"UPDATED": "value"})
        with self.assertRaises(ValidationError):
            api.update_app_settings(281549, update_request)

        class NoContentResponse:
            status = 204
            data = b""

            @staticmethod
            def getheader(name):
                return None

            @staticmethod
            def getheaders():
                return {}

        client.request = Mock(return_value=NoContentResponse())
        update_timeweb_app_settings(api, 281549, update_request)

        deployment = {
            "id": 42,
            "app_id": 281549,
            "commit_sha": TEST_SHA,
            "started_at": "2026-11-03T10:00:00Z",
            "ended_at": None,
            "status": "running",
            "commit_msg": "release",
        }
        deploy_body = json.dumps({"deploy": deployment}).encode()

        class DeployResponse:
            status = 201
            data = deploy_body

            @staticmethod
            def getheader(name):
                return "application/json"

            @staticmethod
            def getheaders():
                return {"content-type": "application/json"}

        client.request = Mock(side_effect=lambda *args, **kwargs: DeployResponse())
        deploy_request = CreateDeployRequest(commit_sha=TEST_SHA)
        with self.assertRaises(ValidationError) as raised:
            api.create_deploy(281549, deploy_request)
        self.assertEqual(tuple(raised.exception.errors()[0]["loc"]), ("status",))
        raw_deploy = timeweb_create_deploy(api, 281549, deploy_request, TEST_SHA)
        self.assertEqual(raw_deploy["id"], 42)

    def test_raw_app_response_enforces_fixed_id_type_and_env_shape(self):
        invalid_apps = (
            {**self.app(), "id": 99},
            {**self.app(), "type": "backend"},
            {**self.app(), "envs": ["invalid"]},
        )
        for app in invalid_apps:
            with self.subTest(app_id=app["id"], app_type=app["type"]):
                with self.assertRaises(ReleaseError):
                    run_release(
                        api=ApiStub(app),
                        update_settings_factory=self.factories,
                        deploy_request_factory=self.factories,
                        profile="ru-test",
                        sha=TEST_SHA,
                        gateway_sha=GATEWAY_SHA,
                        apply=False,
                        public_values=PUBLIC_VALUES,
                        ancestry_validator=self.ancestry,
                    )

    def test_inspect_returns_only_safe_app_and_deploy_fields(self):
        api = ApiStub(self.app())
        api.deploys = [
            {
                "id": 42,
                "commit_sha": TEST_SHA,
                "started_at": "2026-11-03T10:00:00Z",
                "ended_at": None,
                "status": "unmodeled",
                "envs": {"SENSITIVE": "never-return"},
            }
        ]
        report = inspect_timeweb_app(api, "ru-test")
        self.assertEqual(report["app"]["commit_sha"], PRIOR_SHA)
        self.assertEqual(report["deployments"][0]["id"], 42)
        self.assertEqual(report["deployments"][0]["status"], "unmodeled")
        self.assertNotIn("SENSITIVE", json.dumps(report))

    def test_inspect_cli_needs_only_profile(self):
        args = make_parser().parse_args(["--profile", "ru-test", "--inspect"])
        self.assertTrue(args.inspect)
        self.assertIsNone(args.sha)
        self.assertIsNone(args.gateway_sha)

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
