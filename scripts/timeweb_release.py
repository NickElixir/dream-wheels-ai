#!/usr/bin/env python3
"""Prepare or deploy a pinned RU frontend commit using Timeweb's official SDK."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from collections.abc import Callable
from pathlib import Path
from typing import Any

SDK_COMMIT = "bc68457b41c50813c024b620952c338995eac282"
RELEASES = {
    "ru-test": {
        "app_id": 281549,
        "branch": "staging",
        "site": "https://app-test.dream-wheels.ru",
        "gateway": "https://gateway-test.dreamwheels.deno.net",
        "gateway_environment": "test",
        "environment_prefix": "TIMEWEB_RU_TEST",
    },
    "ru-production": {
        "app_id": 281247,
        "branch": "main",
        "site": "https://app.dream-wheels.ru",
        "gateway": "https://gateway.dreamwheels.deno.net",
        "gateway_environment": "production",
        "environment_prefix": "TIMEWEB_RU_PRODUCTION",
    },
}
PUBLIC_ENV_KEYS = (
    "EXPECTED_SUPABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "TURNSTILE_SITE_KEY",
)
MANAGED_ENV_KEYS = frozenset(
    (*PUBLIC_ENV_KEYS, "TIMEWEB_PROFILE", "APP_BUILD_SHA", "TIMEWEB_API_TARGET")
)
FAILURE_APP_STATES = frozenset({"failure", "startup_error", "no_paid", "paused"})
REPO_ROOT = Path(__file__).resolve().parents[1]


class ReleaseError(RuntimeError):
    """A release could not be safely prepared or verified."""


class TimewebSDKError(ReleaseError):
    """An SDK call failed; retain only its stage, class name, and HTTP status."""

    def __init__(self, stage: str, error: Exception):
        self.stage = stage
        self.exception_class = type(error).__name__
        self.http_status = sdk_http_status(error)
        self.schema_fields = sdk_schema_fields(error)
        self.schema_type_value = sdk_schema_type_value(error)
        super().__init__(
            safe_sdk_error_message(
                self.stage,
                self.exception_class,
                self.http_status,
                self.schema_fields,
                self.schema_type_value,
            )
        )


def sdk_http_status(error: Exception) -> int | None:
    response = getattr(error, "response", None)
    candidates = (
        getattr(error, "status", None),
        getattr(error, "status_code", None),
        getattr(response, "status", None),
        getattr(response, "status_code", None),
        getattr(error, "code", None),
    )
    for candidate in candidates:
        try:
            status = int(candidate)
        except (TypeError, ValueError):
            continue
        if 100 <= status <= 599:
            return status
    return None


def sdk_schema_fields(error: Exception) -> tuple[str, ...]:
    errors_method = getattr(error, "errors", None)
    if not callable(errors_method):
        return ()
    try:
        issues = errors_method()
    except Exception:
        return ()
    fields: set[str] = set()
    for issue in issues if isinstance(issues, list | tuple) else ():
        location = issue.get("loc", ()) if isinstance(issue, dict) else ()
        parts = [str(part) for part in location]
        field_path = ".".join(parts)
        if field_path and re.fullmatch(r"[A-Za-z0-9_.\[\]-]{1,160}", field_path):
            fields.add(field_path)
    return tuple(sorted(fields))


def sdk_schema_type_value(error: Exception) -> str | None:
    """Expose only a simple enum-like value for a type-only validation failure."""
    errors_method = getattr(error, "errors", None)
    if not callable(errors_method):
        return None
    try:
        issues = errors_method()
    except Exception:
        return None
    if not isinstance(issues, list | tuple) or not issues:
        return None
    values: set[str] = set()
    for issue in issues:
        if not isinstance(issue, dict):
            return None
        location = tuple(str(part) for part in issue.get("loc", ()))
        if location not in {("type",), ("app", "type")}:
            return None
        value = issue.get("input")
        if not isinstance(value, str) or not re.fullmatch(r"[a-z][a-z0-9_-]{0,39}", value):
            return None
        values.add(value)
    return values.pop() if len(values) == 1 else None


def safe_json_type_diagnostic(value: Any) -> str:
    if isinstance(value, str):
        return value if re.fullmatch(r"[a-z][a-z0-9_-]{0,39}", value) else "string"
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int | float):
        return "number"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return "unknown"


def read_raw_app_type_diagnostic(api: Any, app_id: int) -> str | None:
    """Retry a read-only app lookup without SDK model validation; expose only app.type."""
    getter = getattr(api, "get_app_with_http_info", None)
    if not callable(getter):
        return None
    try:
        response = getter(app_id, _preload_content=False)
        if field(response, "status_code") != 200:
            return None
        raw_data = field(response, "raw_data")
        if isinstance(raw_data, bytes):
            raw_data = raw_data.decode("utf-8")
        if not isinstance(raw_data, str):
            return None
        payload = json.loads(raw_data)
    except Exception:
        return None
    if not isinstance(payload, dict) or not isinstance(payload.get("app"), dict):
        return None
    app = payload["app"]
    if "type" not in app:
        return None
    return safe_json_type_diagnostic(app["type"])


def safe_sdk_error_message(
    stage: str,
    exception_class: str,
    status: int | None,
    schema_fields: tuple[str, ...] = (),
    schema_type_value: str | None = None,
) -> str:
    suffix = f", HTTP {status}" if status is not None else ""
    advice = {
        401: "; check the configured token is valid",
        403: "; check token access to the mapped app",
        404: "; check the mapped app exists in the configured account",
        413: "; check the request schema and environment payload size",
        429: "; retry after the provider rate limit clears",
    }.get(status, "")
    if status is not None and 500 <= status <= 599:
        advice = "; retry after checking Timeweb service status"
    field_advice = f"; schema fields: {', '.join(schema_fields)}" if schema_fields else ""
    type_advice = f"; schema type value: {schema_type_value}" if schema_type_value else ""
    return (
        f"Timeweb SDK {stage} failed ({exception_class}{suffix}){advice}{field_advice}{type_advice}"
    )


def call_timeweb(stage: str, function: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
    try:
        return function(*args, **kwargs)
    except Exception as error:
        raise TimewebSDKError(stage, error) from None


def field(obj: Any, name: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def sdk_value(obj: Any) -> dict[str, Any]:
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "to_dict"):
        return obj.to_dict()
    if hasattr(obj, "dict"):
        return obj.dict(exclude_none=True)
    raise ReleaseError("Timeweb SDK returned an unsupported object")


def validate_sha(sha: str) -> str:
    if not re.fullmatch(r"[a-fA-F0-9]{40}", sha or ""):
        raise ReleaseError("commit must be a full 40-character SHA")
    return sha.lower()


def validate_git_commit(sha: str, branch: str, *, cwd: Path = REPO_ROOT) -> None:
    try:
        subprocess.run(
            ["git", "cat-file", "-e", f"{sha}^{{commit}}"], cwd=cwd, check=True, capture_output=True
        )
        subprocess.run(
            ["git", "merge-base", "--is-ancestor", sha, f"origin/{branch}"],
            cwd=cwd,
            check=True,
            capture_output=True,
        )
    except subprocess.CalledProcessError as error:
        raise ReleaseError(
            f"commit must exist locally and be reachable from origin/{branch}"
        ) from error


def validate_rollback_ancestry(sha: str, current_sha: str, *, cwd: Path = REPO_ROOT) -> None:
    try:
        subprocess.run(
            ["git", "merge-base", "--is-ancestor", sha, current_sha],
            cwd=cwd,
            check=True,
            capture_output=True,
        )
    except subprocess.CalledProcessError as error:
        raise ReleaseError(
            "rollback SHA must be an ancestor of the currently deployed commit"
        ) from error


def validate_rollback_object(sha: str, *, cwd: Path = REPO_ROOT) -> None:
    try:
        subprocess.run(
            ["git", "cat-file", "-e", f"{sha}^{{commit}}"],
            cwd=cwd,
            check=True,
            capture_output=True,
        )
    except subprocess.CalledProcessError as error:
        raise ReleaseError("rollback commit is not available in the verified repository") from error


def release_env(profile: str, environ: dict[str, str]) -> dict[str, str]:
    prefix = RELEASES[profile]["environment_prefix"]
    required = {
        "EXPECTED_SUPABASE_URL": f"{prefix}_SUPABASE_URL",
        "SUPABASE_URL": f"{prefix}_SUPABASE_URL",
        "SUPABASE_PUBLISHABLE_KEY": f"{prefix}_SUPABASE_PUBLISHABLE_KEY",
        "TURNSTILE_SITE_KEY": f"{prefix}_TURNSTILE_SITE_KEY",
    }
    missing = [source for source in required.values() if not environ.get(source)]
    if missing:
        raise ReleaseError(
            "missing public GitHub Actions variables: " + ", ".join(sorted(set(missing)))
        )
    result = {target: environ[source] for target, source in required.items()}
    if not re.fullmatch(r"https://[a-z0-9]+\.supabase\.co", result["SUPABASE_URL"]):
        raise ReleaseError("Supabase URL must be a project origin")
    if not re.fullmatch(r"[A-Za-z0-9._-]+", result["SUPABASE_PUBLISHABLE_KEY"]):
        raise ReleaseError("Supabase publishable key contains unsupported characters")
    if not re.fullmatch(r"[A-Za-z0-9_-]+", result["TURNSTILE_SITE_KEY"]):
        raise ReleaseError("Turnstile site key contains unsupported characters")
    return result


def expected_api_base(profile: str, snapshot: dict[str, Any] | None = None) -> str:
    if snapshot is None or snapshot["prior_managed_envs"].get("TIMEWEB_PROFILE") == profile:
        gateway = RELEASES[profile]["gateway"]
        return f"{gateway}/api/backend"
    if snapshot["prior_managed_envs"].get("TIMEWEB_API_TARGET") == "deno-test":
        return "https://gateway-test.dreamwheels.deno.net/api/backend"
    return "https://dream-wheels-ai-prod-vnext.onrender.com"


def validate_artifact_manifest(
    path: Path, profile: str, sha: str, snapshot: dict[str, Any] | None = None
) -> dict[str, Any]:
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ReleaseError("immutable build artifact manifest could not be read") from error
    if manifest.get("profile") != profile or str(manifest.get("commit", "")).lower() != sha.lower():
        raise ReleaseError("immutable build artifact does not match selected profile and SHA")
    if manifest.get("api_base_url") != expected_api_base(profile, snapshot):
        raise ReleaseError(
            "immutable build artifact API target does not match the selected release"
        )
    return manifest


def make_snapshot(profile: str, app: Any) -> dict[str, Any]:
    release = RELEASES[profile]
    app_id = field(app, "id")
    if str(app_id) != str(release["app_id"]):
        raise ReleaseError("Timeweb returned an app ID different from the fixed profile mapping")
    if field(app, "type") != "frontend":
        raise ReleaseError("Timeweb target is not a frontend app")
    envs = field(app, "envs") or {}
    if not isinstance(envs, dict):
        raise ReleaseError("Timeweb app envs have an unsupported shape")
    managed = {key: envs[key] for key in MANAGED_ENV_KEYS if key in envs}
    return {
        "schema_version": 1,
        "profile": profile,
        "app_id": release["app_id"],
        "prior_commit_sha": field(app, "commit_sha"),
        "prior_branch_name": field(app, "branch_name"),
        "prior_is_auto_deploy": field(app, "is_auto_deploy"),
        "prior_managed_envs": managed,
    }


def write_snapshot(snapshot: dict[str, Any], target: Path | None) -> Path:
    if target is None:
        fd, filename = tempfile.mkstemp(prefix="timeweb-release-snapshot-", suffix=".json")
        path = Path(filename)
        os.close(fd)
    else:
        path = target
        path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    path.chmod(0o600)
    return path


def read_snapshot(path: Path, profile: str) -> dict[str, Any]:
    try:
        snapshot = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ReleaseError("rollback snapshot could not be read") from error
    expected = RELEASES[profile]
    if (
        snapshot.get("schema_version") != 1
        or snapshot.get("profile") != profile
        or str(snapshot.get("app_id")) != str(expected["app_id"])
    ):
        raise ReleaseError("rollback snapshot does not match the selected profile")
    if not isinstance(snapshot.get("prior_managed_envs"), dict):
        raise ReleaseError("rollback snapshot is malformed")
    if not snapshot.get("prior_commit_sha") or not re.fullmatch(
        r"[a-fA-F0-9]{40}", str(snapshot["prior_commit_sha"])
    ):
        raise ReleaseError("rollback snapshot has no previous full commit SHA")
    if set(snapshot["prior_managed_envs"]) - MANAGED_ENV_KEYS:
        raise ReleaseError("rollback snapshot contains unmanaged environment variables")
    previous_envs = snapshot["prior_managed_envs"]
    if previous_envs.get("TIMEWEB_PROFILE") not in (None, profile):
        raise ReleaseError("rollback snapshot profile does not match its managed environment")
    if previous_envs.get("TIMEWEB_API_TARGET") not in (None, "", "deno-test"):
        raise ReleaseError("rollback snapshot contains an unsupported legacy API target")
    for url_key in ("EXPECTED_SUPABASE_URL", "SUPABASE_URL"):
        if url_key in previous_envs and not re.fullmatch(
            r"https://[a-z0-9]+\.supabase\.co", str(previous_envs[url_key])
        ):
            raise ReleaseError("rollback snapshot contains an invalid Supabase URL")
    if "SUPABASE_PUBLISHABLE_KEY" in previous_envs and not re.fullmatch(
        r"[A-Za-z0-9._-]+", str(previous_envs["SUPABASE_PUBLISHABLE_KEY"])
    ):
        raise ReleaseError("rollback snapshot contains an invalid browser publishable key")
    if "TURNSTILE_SITE_KEY" in previous_envs and not re.fullmatch(
        r"[A-Za-z0-9_-]+", str(previous_envs["TURNSTILE_SITE_KEY"])
    ):
        raise ReleaseError("rollback snapshot contains an invalid Turnstile site key")
    return snapshot


def build_target_envs(
    current_envs: dict[str, str], profile: str, sha: str, public_values: dict[str, str]
) -> dict[str, str]:
    result = dict(current_envs)
    result.pop("TIMEWEB_API_TARGET", None)
    result.update(public_values)
    result["TIMEWEB_PROFILE"] = profile
    result["APP_BUILD_SHA"] = sha
    return result


def build_rollback_envs(current_envs: dict[str, str], snapshot: dict[str, Any]) -> dict[str, str]:
    result = dict(current_envs)
    previous = snapshot["prior_managed_envs"]
    for key in MANAGED_ENV_KEYS:
        if key in previous:
            result[key] = previous[key]
        else:
            result.pop(key, None)
    return result


def verify_live_site(profile: str, sha: str, *, gateway_sha: str) -> dict[str, Any]:
    command = [
        "node",
        str(REPO_ROOT / "scripts/verify_ru_release.mjs"),
        "--profile",
        profile,
        "--sha",
        sha,
    ]
    command.extend(["--gateway-sha", gateway_sha])
    child_env = os.environ.copy()
    child_env.pop("TIMEWEB_CLOUD_TOKEN", None)
    result = subprocess.run(
        command, cwd=REPO_ROOT, capture_output=True, text=True, env=child_env, check=False
    )
    try:
        report = json.loads(result.stdout.strip().splitlines()[-1])
    except (IndexError, json.JSONDecodeError) as error:
        raise ReleaseError("live site verifier returned no JSON report") from error
    if result.returncode != 0 or report.get("ok") is not True:
        raise ReleaseError(
            "live site verification failed: " + str(report.get("error", "check did not pass"))
        )
    return report


def verify_legacy_live_version(profile: str, sha: str) -> dict[str, Any]:
    base_url = RELEASES[profile]["site"]
    try:
        with urllib.request.urlopen(f"{base_url}/version.json", timeout=20) as response:
            version = json.loads(response.read())
        with urllib.request.urlopen(base_url, timeout=20) as response:
            html = response.read().decode("utf-8", errors="replace")
    except (OSError, urllib.error.URLError, json.JSONDecodeError) as error:
        raise ReleaseError(
            "legacy rollback site did not return a readable version and page"
        ) from error
    if str(version.get("build", "")).lower() != sha.lower() or sha.lower() not in html:
        raise ReleaseError("legacy rollback frontend version does not match the selected SHA")
    return {
        "ok": True,
        "profile": profile,
        "sha": sha.lower(),
        "site": base_url,
        "checks": {"versionJson": "pass", "html": "pass"},
    }


def verify_gateway_ready(profile: str, gateway_sha: str) -> dict[str, Any]:
    expected = RELEASES[profile]
    try:
        with urllib.request.urlopen(f"{expected['gateway']}/health", timeout=20) as response:
            health = json.loads(response.read())
        with urllib.request.urlopen(
            f"{expected['gateway']}/upstream-health", timeout=65
        ) as response:
            upstream = json.loads(response.read())
    except (OSError, urllib.error.URLError, json.JSONDecodeError) as error:
        raise ReleaseError("selected Deno gateway failed its pre-deploy health request") from error
    if health.get("ok") is not True or health.get("service") != "dream-wheels-gateway":
        raise ReleaseError("selected Deno gateway health identity is invalid")
    if health.get("environment") != expected["gateway_environment"]:
        raise ReleaseError("selected Deno gateway environment does not match the RU profile")
    if str(health.get("build", "")).lower() != gateway_sha.lower():
        raise ReleaseError("selected Deno gateway is not running the requested gateway SHA")
    if upstream.get("ok") is not True or upstream.get("upstreamStatus") != 200:
        raise ReleaseError("selected Deno gateway cannot reach the fixed Render health endpoint")
    return {
        "ok": True,
        "profile": profile,
        "gateway_sha": gateway_sha.lower(),
        "upstream_status": 200,
    }


def wait_for_exact_deploy(
    api: Any,
    app_id: int,
    deploy_id: Any,
    sha: str,
    *,
    timeout_seconds: int,
    poll_seconds: float = 5.0,
    sleep: Callable[[float], None] = time.sleep,
) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        deployments = (
            field(
                call_timeweb("list deployments", api.get_app_deploys, app_id, limit=100, offset=0),
                "deploys",
                [],
            )
            or []
        )
        deployment = next(
            (item for item in deployments if str(field(item, "id")) == str(deploy_id)), None
        )
        app = field(call_timeweb("read app status", api.get_app, app_id), "app")
        app_status = field(app, "status")
        current_sha = str(field(app, "commit_sha") or "").lower()
        if app_status in FAILURE_APP_STATES:
            raise ReleaseError(f"Timeweb app entered failure state: {app_status}")
        if deployment is not None:
            deploy_sha = str(field(deployment, "commit_sha") or "").lower()
            if deploy_sha and deploy_sha != sha:
                raise ReleaseError("Timeweb deployment record reports a different commit SHA")
            if field(deployment, "ended_at") and app_status == "active" and current_sha == sha:
                return {
                    "status": app_status,
                    "commit_sha": current_sha,
                    "deploy_id": str(deploy_id),
                }
        sleep(poll_seconds)
    raise TimeoutError(
        "Timeweb deployment is still unresolved; inspect the app before choosing rollback"
    )


def make_sdk_client(token: str) -> tuple[Any, Any, Any]:
    try:
        import timeweb_cloud_api
        from timeweb_cloud_api.models.create_deploy_request import CreateDeployRequest
        from timeweb_cloud_api.models.update_settings import UpdateSettings
    except ImportError as error:
        raise ReleaseError(
            f"Timeweb SDK is unavailable; install the pinned SDK at {SDK_COMMIT}"
        ) from error
    try:
        configuration = timeweb_cloud_api.Configuration(
            host="https://api.timeweb.cloud", access_token=token
        )
        client = timeweb_cloud_api.ApiClient(configuration)
        api = timeweb_cloud_api.AppsApi(client)
    except Exception as error:
        raise TimewebSDKError("initialize client", error) from None
    return api, UpdateSettings, CreateDeployRequest


def run_release(
    *,
    api: Any,
    update_settings_factory: Callable[..., Any],
    deploy_request_factory: Callable[..., Any],
    profile: str,
    sha: str,
    gateway_sha: str,
    apply: bool,
    rollback: bool = False,
    snapshot_path: Path | None = None,
    artifact_manifest: Path | None = None,
    public_values: dict[str, str] | None = None,
    timeout_seconds: int = 900,
    verifier: Callable[..., dict[str, Any]] = verify_live_site,
    legacy_verifier: Callable[..., dict[str, Any]] = verify_legacy_live_version,
    ancestry_validator: Callable[[str, str], None] = validate_git_commit,
    rollback_ancestry_validator: Callable[[str, str], None] = validate_rollback_ancestry,
    rollback_object_validator: Callable[[str], None] = validate_rollback_object,
    poller: Callable[..., dict[str, Any]] = wait_for_exact_deploy,
    gateway_validator: Callable[[str, str], dict[str, Any]] = verify_gateway_ready,
) -> dict[str, Any]:
    if profile not in RELEASES:
        raise ReleaseError("profile must be ru-test or ru-production")
    sha = validate_sha(sha)
    gateway_sha = validate_sha(gateway_sha)
    target = RELEASES[profile]
    if not rollback:
        ancestry_validator(sha, target["branch"])
    if not apply:
        gateway_report = {
            "ok": None,
            "profile": profile,
            "gateway_sha": gateway_sha,
            "check": "apply-only",
        }
    else:
        gateway_report = None
    app_id = target["app_id"]
    try:
        app_response = call_timeweb("read app settings", api.get_app, app_id)
    except TimewebSDKError as error:
        if error.schema_fields in {("app.type",), ("type",)}:
            type_diagnostic = read_raw_app_type_diagnostic(api, app_id)
            raise ReleaseError(
                safe_sdk_error_message(
                    error.stage,
                    error.exception_class,
                    error.http_status,
                    error.schema_fields,
                    type_diagnostic,
                )
            ) from None
        raise
    app = field(app_response, "app")
    snapshot = make_snapshot(profile, app)

    if rollback:
        if snapshot_path is None:
            raise ReleaseError("rollback requires --rollback-snapshot from a prior release")
        rollback_snapshot = read_snapshot(snapshot_path, profile)
        if artifact_manifest is not None:
            validate_artifact_manifest(artifact_manifest, profile, sha, rollback_snapshot)
        expected_sha = str(rollback_snapshot["prior_commit_sha"]).lower()
        legacy_rollback = "TIMEWEB_PROFILE" not in rollback_snapshot["prior_managed_envs"]
        if sha != expected_sha:
            raise ReleaseError(
                "rollback SHA must match the previous commit in the supplied snapshot"
            )
        rollback_object_validator(sha)
        current_sha = str(field(app, "commit_sha") or "").lower()
        if current_sha == sha:
            raise ReleaseError("the requested rollback SHA is already the app's reported commit")
        if current_sha and not legacy_rollback:
            rollback_ancestry_validator(sha, current_sha)
        planned_envs = build_rollback_envs(field(app, "envs") or {}, rollback_snapshot)
        branch_name = rollback_snapshot.get("prior_branch_name") or target["branch"]
        auto_deploy = rollback_snapshot.get("prior_is_auto_deploy")
        mode = "rollback"
    else:
        if str(field(app, "commit_sha") or "").lower() == sha:
            raise ReleaseError("the requested SHA is already deployed; refusing a duplicate deploy")
        if not public_values:
            raise ReleaseError("release requires the public Supabase and Turnstile settings")
        if artifact_manifest is not None:
            validate_artifact_manifest(artifact_manifest, profile, sha)
        written = write_snapshot(snapshot, snapshot_path)
        planned_envs = build_target_envs(field(app, "envs") or {}, profile, sha, public_values)
        branch_name = target["branch"]
        auto_deploy = False
        legacy_rollback = False
        mode = "release"

    if apply and not legacy_rollback:
        gateway_report = gateway_validator(profile, gateway_sha)
    elif apply:
        gateway_report = {
            "ok": True,
            "profile": profile,
            "check": "legacy-rollback-does-not-use-deno-gateway",
        }

    report = {
        "ok": True,
        "mode": mode,
        "profile": profile,
        "app_id": app_id,
        "sha": sha,
        "gateway_sha": gateway_sha,
        "gateway_preflight": gateway_report,
        "branch": branch_name,
        "auto_deploy": auto_deploy,
        "preserved_env_keys": sorted(set(field(app, "envs") or {}) - MANAGED_ENV_KEYS),
        "updated_env_keys": sorted(set(planned_envs) & MANAGED_ENV_KEYS),
        "removed_env_keys": ["TIMEWEB_API_TARGET"]
        if "TIMEWEB_API_TARGET" in (field(app, "envs") or {}) and not rollback
        else [],
        "snapshot_file": str(written) if not rollback and snapshot_path is not None else None,
        "snapshot_managed_env_keys": sorted(snapshot["prior_managed_envs"]),
    }
    if not apply:
        return report

    settings_values = {
        "envs": planned_envs,
        "branch_name": branch_name,
        "commit_sha": sha,
        "is_auto_deploy": False,
    }
    call_timeweb(
        "update app settings",
        api.update_app_settings,
        app_id,
        update_settings_factory(**settings_values),
    )
    created = field(
        call_timeweb(
            "start deploy",
            api.create_deploy,
            app_id,
            deploy_request_factory(commit_sha=sha),
        ),
        "deploy",
    )
    deploy_id = field(created, "id")
    if deploy_id is None:
        raise ReleaseError(
            "Timeweb accepted a deploy request without a monitorable deploy ID; inspect the app before retrying"
        )

    try:
        deploy_report = poller(api, app_id, deploy_id, sha, timeout_seconds=timeout_seconds)
    except TimeoutError:
        raise
    except ReleaseError:
        raise

    live_report = (
        legacy_verifier(profile, sha)
        if legacy_rollback
        else verifier(profile, sha, gateway_sha=gateway_sha)
    )
    if auto_deploy is not None:
        call_timeweb(
            "restore automatic deploy setting",
            api.update_app_settings,
            app_id,
            update_settings_factory(is_auto_deploy=auto_deploy),
        )
    return {**report, "deployment": deploy_report, "live_verification": live_report}


def make_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", choices=sorted(RELEASES), required=True)
    parser.add_argument(
        "--sha", required=True, help="full commit SHA on staging (test) or main (production)"
    )
    parser.add_argument(
        "--gateway-sha", required=True, help="full SHA reported by the matching served Deno gateway"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="mutate the app and start a deploy; default is read-only dry-run",
    )
    parser.add_argument(
        "--rollback-snapshot",
        type=Path,
        help="prior release snapshot; using it selects explicit rollback mode",
    )
    parser.add_argument(
        "--snapshot-out",
        type=Path,
        help="write the pre-release managed settings snapshot to a private file",
    )
    parser.add_argument(
        "--artifact-manifest",
        type=Path,
        help="manifest from the immutable pre-deploy frontend artifact",
    )
    parser.add_argument("--timeout-seconds", type=int, default=900)
    return parser


def main() -> int:
    args = make_parser().parse_args()
    try:
        if not 30 <= args.timeout_seconds <= 3600:
            raise ReleaseError("timeout must be between 30 and 3600 seconds")
        token = os.environ.get("TIMEWEB_CLOUD_TOKEN")
        if not token:
            raise ReleaseError(
                "TIMEWEB_CLOUD_TOKEN is required for the read-only app snapshot and release"
            )
        api, update_factory, deploy_factory = make_sdk_client(token)
        is_rollback = args.rollback_snapshot is not None
        public_values = None if is_rollback else release_env(args.profile, dict(os.environ))
        snapshot_path = args.rollback_snapshot or args.snapshot_out
        if not is_rollback and snapshot_path is None:
            fd, filename = tempfile.mkstemp(prefix="timeweb-release-snapshot-", suffix=".json")
            os.close(fd)
            snapshot_path = Path(filename)
        result = run_release(
            api=api,
            update_settings_factory=update_factory,
            deploy_request_factory=deploy_factory,
            profile=args.profile,
            sha=args.sha,
            gateway_sha=args.gateway_sha,
            apply=args.apply,
            rollback=is_rollback,
            snapshot_path=snapshot_path,
            artifact_manifest=args.artifact_manifest,
            public_values=public_values,
            timeout_seconds=args.timeout_seconds,
        )
        print(json.dumps(result, ensure_ascii=False))
        if result.get("snapshot_file"):
            print(
                "Snapshot contains only the allowlisted public release variables and previous deploy settings.",
                file=sys.stderr,
            )
        return 0
    except (ReleaseError, TimeoutError) as error:
        print(json.dumps({"ok": False, "error": str(error)}, ensure_ascii=False))
        return 1
    except Exception:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "Timeweb SDK operation failed; inspect the app before retrying",
                },
                ensure_ascii=False,
            )
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
