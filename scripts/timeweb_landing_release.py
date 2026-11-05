"""Release an existing static landing app without touching WebApp, DNS or Deno."""

import argparse
import json
import os
import subprocess
from pathlib import Path

from timeweb_release import (
    ReleaseError,
    make_sdk_client,
    timeweb_app_payload,
    timeweb_create_deploy,
    timeweb_json_payload,
    update_timeweb_app_settings,
    validate_sha,
    wait_for_exact_deploy,
)

ROOT = Path(__file__).resolve().parents[1]
BUILD_COMMAND = "npm run build:landing:timeweb"
INDEX_DIR = "/dist/landing-timeweb"
PROFILES = ("landing-ru-test", "landing-ru-production")


def validate_target(app: dict, app_id: int) -> None:
    if app_id in {281247, 281549} or app.get("type") != "frontend":
        raise ReleaseError("Landing must use its own frontend app")
    if not str(app.get("name", "")).startswith("dream-wheels-landing-"):
        raise ReleaseError("Unexpected landing app name")
    if app.get("build_cmd") != BUILD_COMMAND or app.get("index_dir") != INDEX_DIR:
        raise ReleaseError("Landing app build settings differ from the reviewed configuration")
    if set(app.get("envs") or {}) - {"TIMEWEB_LANDING_PROFILE", "LANDING_BUILD_SHA"}:
        raise ReleaseError("Unexpected environment variables in the isolated landing app")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", choices=PROFILES)
    parser.add_argument("--sha")
    parser.add_argument("--inventory", action="store_true")
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if args.inventory:
        api, _, _ = make_sdk_client(os.environ["TIMEWEB_CLOUD_TOKEN"])
        source = timeweb_app_payload(api, "read existing frontend metadata", "get_app", 281549)
        presets = timeweb_json_payload(
            api, "read frontend presets", "get_apps_presets", 281549, accepted_statuses={200}
        )
        print(
            json.dumps(
                {
                    "ok": True,
                    "source_template": {
                        "provider_id": (source.get("provider") or {}).get("id"),
                        "repository_id": (source.get("repository") or {}).get("id"),
                        "location": source.get("location"),
                        "preset_id": source.get("preset_id"),
                        "env_version": source.get("env_version"),
                    },
                    "presets": presets,
                }
            )
        )
        return
    if args.profile not in PROFILES or not args.sha:
        raise ReleaseError("Release profile and SHA are required")
    sha = validate_sha(args.sha)
    prefix = "LANDING_RU_TEST" if args.profile == "landing-ru-test" else "LANDING_RU_PRODUCTION"
    try:
        app_id = int(os.environ[f"{prefix}_APP_ID"])
        site = os.environ[f"{prefix}_URL"]
    except (KeyError, ValueError) as error:
        raise ReleaseError("Landing app ID and URL must be configured explicitly") from error
    if app_id in {281247, 281549}:
        raise ReleaseError("Cannot target an existing WebApp app")
    api, settings_factory, deploy_factory = make_sdk_client(os.environ["TIMEWEB_CLOUD_TOKEN"])
    app = timeweb_app_payload(api, "read landing app", "get_app", app_id)
    validate_target(app, app_id)
    snapshot = {
        key: app.get(key)
        for key in (
            "id",
            "name",
            "commit_sha",
            "branch_name",
            "build_cmd",
            "index_dir",
            "is_auto_deploy",
            "envs",
        )
    }
    snapshot_file = ROOT / "landing-release-snapshot.json"
    snapshot_file.write_text(json.dumps(snapshot, indent=2) + "\n")
    snapshot_file.chmod(0o600)
    if not args.apply:
        print(json.dumps({"ok": True, "dry_run": True, "app_id": app_id, "sha": sha}))
        return
    if (
        str(app.get("commit_sha", "")).lower() == sha
        and app.get("envs", {}).get("TIMEWEB_LANDING_PROFILE") == args.profile
        and app.get("envs", {}).get("LANDING_BUILD_SHA") == sha
        and app.get("status") == "active"
    ):
        deployment = {"status": "already-deployed"}
    else:
        if app.get("status") in {"deploy", "new", "reboot"}:
            raise ReleaseError("Landing deployment already in progress; inspect before retrying")
        branch = "staging" if args.profile == "landing-ru-test" else "main"
        update_timeweb_app_settings(
            api,
            app_id,
            settings_factory(
                envs={"TIMEWEB_LANDING_PROFILE": args.profile, "LANDING_BUILD_SHA": sha},
                branch_name=branch,
                commit_sha=sha,
                is_auto_deploy=False,
            ),
        )
        created = timeweb_create_deploy(api, app_id, deploy_factory(commit_sha=sha), sha)
        deployment = wait_for_exact_deploy(
            api, app_id, created["id"], sha, timeout_seconds=900, poll_seconds=10
        )
    result = subprocess.run(
        [
            "node",
            str(ROOT / "scripts/verify_landing_release.mjs"),
            "--site",
            site,
            "--sha",
            sha,
            "--profile",
            args.profile,
        ],
        check=False,
        text=True,
        capture_output=True,
        env={key: value for key, value in os.environ.items() if key != "TIMEWEB_CLOUD_TOKEN"},
    )
    if result.returncode:
        raise ReleaseError("Published landing verification failed: " + result.stderr[-500:])
    print(
        json.dumps(
            {
                "ok": True,
                "app_id": app_id,
                "sha": sha,
                "deployment": deployment,
                "verification": json.loads(result.stdout),
            }
        )
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        message = str(error) if isinstance(error, ReleaseError) else type(error).__name__
        print(json.dumps({"ok": False, "error": message}))
        raise SystemExit(1) from None
