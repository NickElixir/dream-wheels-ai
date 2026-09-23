# Landing dependency security audit — 2026-09-23

Scope: `landing/` on `feature/landing-two-domain-routing`. This is an assessment, not a dependency upgrade or production release. Evidence: `npm ls astro sharp esbuild @vercel/functions --all --depth=4`, `npm audit --omit=dev --json`, source inspection, static build output, and protected Vercel preview route checks.

## Findings

| Package and installed version | Dependency path | Advisory and patched version | Exposure in this deployment | Upgrade/regression risk |
| --- | --- | --- | --- | --- |
| `astro@6.4.8` | Direct dependency | [Critical AVIF optimization RCE](https://github.com/advisories/GHSA-26w7-cxv4-gfx2), patched in Astro `7.2.8` (audit proposes `7.3.4`). The audit also lists lower-severity XSS and base-path advisories under Astro. | The site builds with `output: 'static'`. Its only `astro:assets` transformation uses a trusted repository PNG for the hero; source inspection found no untrusted/remote AVIF input. The protected preview returned `404` for a `/_image` request, consistent with no public on-demand Astro image endpoint. Remote exploitation of the cited AVIF path is therefore **not demonstrated** for the current release, but the vulnerable build dependency remains present. An untrusted asset introduced through a PR or future dynamic processing would change the assessment. | A supported patched Astro version requires a **major 6→7 migration**. Vite moves to 8; image output, Preact hydration, static routes, and Vercel middleware must be rechecked. |
| `sharp@0.34.5` | Transitive: `landing → astro → sharp` | [libvips issue](https://github.com/advisories/GHSA-f88m-g3jw-g9cj), patched in `0.35.0`; [libheif issue](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c), patched in `0.35.4`. | The advisories concern processing untrusted images, particularly AVIF/HEIF for libheif and GIF/TIFF/VIPS for the cited libvips issue. This static build transforms a repository PNG at build time; no user upload is passed to Astro/Sharp. Risk is lower for current runtime, **not zero for untrusted build inputs**. | Astro owns the installed Sharp version. A direct override without Astro compatibility validation is not treated as a safe fix. Upgrade with Astro and verify generated AVIF/WebP/JPG assets. |
| `esbuild@0.27.7` | Transitive: `landing → astro → esbuild` and `landing → @astrojs/preact → vite → esbuild` | [Windows development-server path traversal](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr), patched in `0.28.1`; audit severity low. | The advisory is specific to the esbuild dev server on Windows. Current local development is macOS and Vercel builds on Linux; no esbuild dev server is exposed in production. | Resolved as part of the Astro/Vite upgrade; not an independent production blocker on this topology. |

`npm audit --omit=dev` currently reports **1 critical, 1 high, 1 low**. The critical label on `astro` is an aggregate of multiple advisories and transitive dependencies; it is not evidence that the static public site exposes an RCE endpoint.

## Upgrade path and release gate

1. Do **not** run `npm audit fix --force` on the candidate branch. It proposes Astro `7.3.4`, a major upgrade, without validating this site's behavior.
2. In a separate dependency-upgrade branch, update Astro to a patched 7.x release and evaluate the matching official `@astrojs/preact` version. Keep the Vercel Routing Middleware and existing front-door rewrites unchanged unless the migration requires a tested adjustment.
3. Re-run `npm ci`, `npm run check`, `npm run test`, `npm run build`, `npm audit --omit=dev`, and `git diff --check`.
4. Compare generated hero image formats, dimensions, asset requests and LCP; smoke `/`, `/catalog`, locale rewrites, `/app/**`, `/t/**`, `/api/backend/**`, canonical/hreflang, and language switching on a protected preview at 360/390/768/1440 px.
5. Reassess whether any attacker-controlled images can reach the Astro image service or CI build. Do not claim the advisories are fixed until the lockfile and audit show patched versions.

**Status:** Dependency audit complete; remediation and regression QA pending. No package versions, production deployment, or DNS settings changed by this audit.
