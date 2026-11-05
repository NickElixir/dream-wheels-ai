"""Release an existing static landing app without touching WebApp, DNS or Deno."""

import argparse
import json
import os
import subprocess
import time
import urllib.request
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


def provision_app(api, profile: str, sha: str) -> dict:
    """Create only an owner-approved isolated Moscow request-priced frontend."""
    from timeweb_cloud_api.models.create_app_v2 import CreateAppV2

    name = "dream-wheels-landing-" + ("test" if profile == "landing-ru-test" else "production")
    response = api.get_apps_with_http_info(_preload_content=False)
    if response.status_code != 200:
        raise ReleaseError("Cannot inspect existing apps before creation")
    payload = json.loads(response.raw_data)
    existing = [app for app in payload.get("apps", []) if app.get("name") == name]
    if len(existing) > 1:
        raise ReleaseError("Duplicate landing app names; inspect before retrying")
    if existing:
        validate_target(existing[0], int(existing[0]["id"]))
        return {"ok": True, "created": False, "app_id": existing[0]["id"], "name": name}
    source = timeweb_app_payload(api, "read frontend source template", "get_app", 281549)
    presets = timeweb_json_payload(
        api, "read request preset", "get_apps_presets", 281549, accepted_statuses={200}
    )
    preset = next(
        (item for item in presets.get("frontend_presets", []) if item.get("id") == 2801), {}
    )
    if (
        preset.get("location") != "ru-3"
        or preset.get("price") != 1
        or preset.get("disk") != 2048
        or preset.get("description") != "Frontend app request preset MSK"
    ):
        raise ReleaseError("Approved request preset changed; review pricing before creation")
    model = CreateAppV2(
        provider_id=source["provider"]["id"],
        repository_id=source["repository"]["id"],
        type="frontend",
        language="javascript",
        framework="another",
        env_version="24",
        build_cmd=BUILD_COMMAND,
        index_dir=INDEX_DIR,
        branch_name="staging" if profile == "landing-ru-test" else "main",
        commit_sha=sha,
        is_auto_deploy=False,
        name=name,
        comment="RU static landing",
        preset_id=2801,
        project_id=560747,
        envs={"TIMEWEB_LANDING_PROFILE": profile, "LANDING_BUILD_SHA": sha},
    )
    result = timeweb_json_payload(
        api, "create approved landing frontend", "create_app_v2", model, accepted_statuses={201}
    )
    app = result.get("app", {})
    if not isinstance(app.get("id"), int):
        raise ReleaseError("Creation response lacks app ID; inspect inventory before retrying")
    return {"ok": True, "created": True, "app_id": app["id"], "name": name}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", choices=PROFILES)
    parser.add_argument("--sha")
    parser.add_argument("--inventory", action="store_true")
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--create-approved", action="store_true")
    parser.add_argument("--configure", action="store_true")
    args = parser.parse_args()
    if args.inventory:
        api, _, _ = make_sdk_client(os.environ["TIMEWEB_CLOUD_TOKEN"])
        source = timeweb_app_payload(api, "read existing frontend metadata", "get_app", 281549)
        presets = timeweb_json_payload(
            api, "read frontend presets", "get_apps_presets", 281549, accepted_statuses={200}
        )
        landing_apps = []
        for landing_id in (283503, 283505):
            landing = timeweb_app_payload(api, "read created landing status", "get_app", landing_id)
            public = {
                key: landing.get(key)
                for key in ("id", "name", "status", "ip", "commit_sha", "build_cmd", "index_dir")
            }
            public["field_names"] = sorted(landing)
            public["domains"] = [
                item
                if isinstance(item, str)
                else {
                    key: item.get(key)
                    for key in (
                        "id",
                        "domain",
                        "fqdn",
                        "name",
                        "type",
                        "is_technical",
                        "is_technical_domain",
                    )
                    if key in item
                }
                for item in landing.get("domains", [])
            ]
            landing_apps.append(public)
        print(
            json.dumps(
                {
                    "ok": True,
                    "landing_apps": landing_apps,
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
    if args.create_approved:
        api, _, _ = make_sdk_client(os.environ["TIMEWEB_CLOUD_TOKEN"])
        print(json.dumps(provision_app(api, args.profile, sha)))
        return
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
    if args.configure:
        if app_id not in {283503, 283505}:
            raise ReleaseError("Configuration restricted to the two approved landing apps")
        proxy = {
            "spa_fallback": False,
            "redirects": [],
            "headers": [{"operation": "set", "name": "Cache-Control", "value": "no-cache"}],
            "compression": {"enabled": True, "algorithms": ["gzip", "zstd"]},
        }
        if args.profile == "landing-ru-test":
            proxy["headers"].append(
                {"operation": "set", "name": "X-Robots-Tag", "value": "noindex, nofollow"}
            )
        snapshot["reverse_proxy"] = app.get("reverse_proxy")
        snapshot_file.write_text(json.dumps(snapshot, indent=2) + "\n")
        request = urllib.request.Request(
            f"https://api.timeweb.cloud/api/v1/apps/{app_id}",
            data=json.dumps({"reverse_proxy": proxy}).encode(),
            headers={
                "Authorization": "Bearer " + os.environ["TIMEWEB_CLOUD_TOKEN"],
                "Content-Type": "application/json",
            },
            method="PATCH",
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            if response.status != 200:
                raise ReleaseError("Landing web-server configuration was rejected")
            response.read()
        deadline = time.monotonic() + 600
        while time.monotonic() < deadline:
            current = timeweb_app_payload(
                api, "wait for landing web-server config", "get_app", app_id
            )
            if current.get("status") == "active" and current.get("reverse_proxy") == proxy:
                print(json.dumps({"ok": True, "app_id": app_id, "configured": True}))
                return
            if current.get("status") in {"failure", "startup_error", "no_paid", "paused"}:
                raise ReleaseError("Landing configuration deploy did not become active")
            time.sleep(10)
        raise ReleaseError("Landing web-server configuration did not converge")
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
