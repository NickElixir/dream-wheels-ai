"""Fail-closed source policy for frontend-only production releases."""

import json
import re
import subprocess
from pathlib import PurePosixPath

# Changes here require review; never derive this list from a remote response.
PREFIXES = (
    "webapp/",
    "landing/",
    "docs/",
    "tests/",
    "deploy/timeweb-static/",
    "deploy/timeweb-landing/",
)
CONTROL_FILES = frozenset(
    {
        ".github/workflows/deploy-frontends.yml",
        ".github/workflows/ci.yml",
        ".github/workflows/ru-release.yml",
        ".github/workflows/frontend-release-preflight.yml",
        "scripts/check_release_backend.py",
        "scripts/frontend_release_policy.py",
        "scripts/check_frontend_release.py",
    }
)
BUILD_ONLY_SCRIPTS = frozenset(
    {
        "webapp/scripts/build-public-config.mjs",
        "webapp/scripts/bundle-css.mjs",
        "webapp/scripts/bundle-js.mjs",
    }
)


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], text=True).strip()


def validate_sha(sha: str) -> None:
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("Expected a full commit SHA")
    git("cat-file", "-e", f"{sha}^{{commit}}")


def _blob(sha: str, path: str) -> str:
    return subprocess.check_output(["git", "show", f"{sha}:{path}"], text=True)


def _build_command_only_change(path: str, candidate: str, tested: str) -> bool:
    try:
        accepted = json.loads(_blob(tested, path))
        proposed = json.loads(_blob(candidate, path))
    except (json.JSONDecodeError, subprocess.CalledProcessError):
        return False
    if accepted.get("buildCommand") != "node scripts/build-public-config.mjs":
        return False
    if proposed.get("buildCommand") != (
        "node scripts/build-public-config.mjs && node scripts/bundle-js.mjs"
    ):
        return False
    accepted.pop("buildCommand", None)
    proposed.pop("buildCommand", None)
    return accepted == proposed


def check_paths(
    paths: list[str],
    *,
    candidate: str | None = None,
    tested: str | None = None,
    baseline: str | None = None,
) -> None:
    for path in paths:
        if ".." in PurePosixPath(path).parts or path.startswith("/"):
            raise ValueError("Invalid changed path")
        name = PurePosixPath(path).name
        if (
            name
            in {
                "package.json",
                "package-lock.json",
                "npm-shrinkwrap.json",
                "yarn.lock",
                "pnpm-lock.yaml",
                "bun.lock",
                "bun.lockb",
                "deno.json",
                "deno.jsonc",
                "deno.lock",
                ".npmrc",
                ".yarnrc.yml",
                ".node-version",
                ".nvmrc",
                "tsconfig.json",
            }
            or name.startswith(
                (
                    "middleware.",
                    "next.config.",
                    "astro.config.",
                    "vite.config.",
                    "webpack.config.",
                    "rollup.config.",
                    "postcss.config.",
                    "tailwind.config.",
                    "eslint.config.",
                )
            )
            or (
                path.startswith(("webapp/scripts/", "landing/scripts/"))
                and not (
                    path in BUILD_ONLY_SCRIPTS
                    and candidate
                    and tested
                    and _blob(candidate, path) == _blob(tested, path)
                )
            )
        ):
            raise ValueError(
                f"Dependency/server/build configuration requires a full release: {path}"
            )
        if name == "vercel.json" and path != "webapp/vercel.json":
            raise ValueError(f"Server/gateway change requires a full release: {path}")
        # Vercel's proxy is server-side, even though it lives under webapp.
        if path.startswith(("webapp/api/", "webapp/lib/")):
            raise ValueError(f"Server/gateway change requires a full release: {path}")
        if path == "webapp/vercel.json" and not (
            candidate
            and (baseline or tested)
            and _build_command_only_change(path, candidate, baseline or tested)
        ):
            raise ValueError(f"Server/gateway change requires a full release: {path}")
        if not path.startswith(PREFIXES) and path not in CONTROL_FILES:
            raise ValueError(f"Unclassified change requires a full release: {path}")


def verify_sources(backend_sha: str, candidate: str, tested: str) -> None:
    for sha in (backend_sha, candidate, tested):
        validate_sha(sha)
    git("merge-base", "--is-ancestor", backend_sha, candidate)
    git("merge-base", "--is-ancestor", tested, candidate)
    git("merge-base", "--is-ancestor", tested, "origin/staging")
    # Inspect committed trees, not the checkout: links outside the compared runtime
    # directories can otherwise supply executable input after staging acceptance.
    for sha in {candidate, tested}:
        entries = git("ls-tree", "-r", "-z", sha).split("\0")
        for entry in entries:
            if entry.startswith(("120000 ", "160000 ")):
                raise ValueError("Symlinks and submodules require a full release")
    # Disable rename detection so moves cannot hide either side of a backend edit.
    changes = git("diff", "--no-renames", "--name-only", backend_sha, candidate, "--")
    check_paths(
        changes.splitlines() if changes else [],
        candidate=candidate,
        tested=tested,
        baseline=backend_sha,
    )
    git("diff", "--exit-code", tested, candidate, "--", "webapp", "landing", "deploy")
