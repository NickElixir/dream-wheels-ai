"""Fail-closed source policy for frontend-only production releases."""

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


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], text=True).strip()


def validate_sha(sha: str) -> None:
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("Expected a full commit SHA")
    git("cat-file", "-e", f"{sha}^{{commit}}")


def check_paths(paths: list[str]) -> None:
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
                "vercel.json",
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
            or path.startswith(("webapp/scripts/", "landing/scripts/"))
        ):
            raise ValueError(
                f"Dependency/server/build configuration requires a full release: {path}"
            )
        # Vercel's proxy is server-side, even though it lives under webapp.
        if path.startswith(("webapp/api/", "webapp/lib/")) or path == "webapp/vercel.json":
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
    check_paths(changes.splitlines() if changes else [])
    git("diff", "--exit-code", tested, candidate, "--", "webapp", "landing", "deploy")
