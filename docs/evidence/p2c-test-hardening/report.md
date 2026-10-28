# P2-C — Tests / fixtures cleanup & hardening

BASE: `7762584633914abe6b1ca26ea0197cba72df4239` (verified staging after merged #265).
HEAD: final commit containing this report; resolve with `git log -1 --format=%H -- docs/evidence/p2c-test-hardening/report.md`. Exact PR-head CI SHA/result is recorded in PR checks and the review handoff. Runtime app.js SHA-256: `0c603f85023328084a74116b65318160374ef68c60bdef75bef3dc6b409f22ef`.

C0 fallback i18n: FIXED. Two literal renderFitment title/helper texts use new canonical COPY keys in both languages. Existing incompatible helper branch preserved. Real fallback DOM and always-on Node behavior tests assert exact RU/EN text and unchanged canonical state. No other runtime logic, CSS/layout, backend or migration changed.

## Inventory and coverage

C1 read-only inventory completed before cleanup. Counts below are 119 BASE test-file/fixture rows, not runtime parametrized case counts (full table and definition names in inventory.md/json).

| Classification | Count |
|---|---:|
| CRITICAL_BEHAVIOR | 28 |
| USEFUL_BEHAVIOR | 46 |
| STATIC_CONTRACT | 6 |
| SOURCE_SENTINEL | 13 |
| DUPLICATE | 0 |
| OBSOLETE | 0 |
| EVIDENCE_ONLY | 21 |
| ENVIRONMENT_INTEGRATION | 5 |
| UNCERTAIN | 0 |

Tests removed: 0. Existing static named definitions lost: 0. Tests added: 10 executed cases (8 Node, 2 Python); no count-reduction KPI. Fixtures removed: 0. Fixtures consolidated: 0. One new feature fixture and its manual runner; other scenarios remain independent. Critical contracts lost: 0. New skips: 0.

61 neighboring-function/bridge extraction intervals hardened, plus two custom Node extraction mechanisms consolidated into the same test-only helper. Acorn uses real syntax boundaries; Python is a thin cached adapter, transferring text to preserve Unicode. Existing VM dependency groups use explicit function lists; their semantic/security assertions remain. Four weak source-presence assertions have equal/stronger behavioral replacements documented in removed-tests.md. Remaining historical source/markup guards are audited and retained, not silently removed. No new test DSL/framework or production parser import.

Coverage matrix: COMPLETE — Single Active Workspace, Vehicle confirmation, staggered Save, Fitment A–J / overall safety, payment races, render finality/accounting, auth, i18n, protected assets, legacy fallback and public bridges/events preserved. Negative controls detected four intentional defects (billing inference, retry permission, source sanitization, C0 locale) with failing behavior tests; production files stayed unchanged.

Auth flakiness: the concurrent Supabase 401 case uses explicit initial-response/refresh gates and a failure timeout instead of a 10ms delay, preserving exact one-refresh/four-request assertions. Previously reported two auth environment failures are not reproduced (all 213 pass); no test is suppressed or converted to skip.

## Verification and execution roles

- Node full relevant suite: 269 PASS (BASE 261).
- Frontend/Auth: 213 PASS, no skips.
- Python: 762 PASS, 22 existing local PostgreSQL skips (BASE 760/22).
- Ruff lint / format: PASS, 154 Python files. Build: PASS; both generated auth bundles unchanged. git diff --check: PASS.
- Shared browser: 180 PASS, output exactly equal to the post-P2-B baseline; no locale/ARIA/layout regression.
- Current legacy fallback browser: 20 PASS at 390×900 / 1440×900 × RU/EN. Real index.html markup, actual renderFitment, no VNext root; editor/result/incompatible/failed/retry-disallowed. Canonical form/overview/check/job unchanged. Language assertions cover the requested C0 title/helper and existing incompatible helper, without expanding C0 into a full legacy localization migration.
- PostgreSQL CI: mandatory unchanged qa-context-integration; exact final PR HEAD required before review handoff.

Always-on CI, local optional integration, manual browser regression and historical evidence-only runners are explicitly listed in ci-inventory.md. Node/npm/Acorn is now an explicit Python structural-test prerequisite, installed once before pytest in CI. No accidental live service dependency is introduced; fixtures mock outbound traffic. Runtime differences outside C0: NONE — 585 of 586 app.js top-level nodes are byte-identical; remaining renderer differs only at two copy expressions (production-boundary.json). Historical evidence untouched.

Product semantics changed: NO. Backend changed: NO. Migration: NO. Layout changed: NO. Public bridge/API changed: NO. User-visible change: approved C0 EN title/helper translation only; RU exact original text retained.

Self-review: no actionable BLOCKER/HIGH/MEDIUM found; this is not independent review. Residual low-risk source boundaries outside selected files are recorded in source-slicing-audit.md; low-cost historical fixtures remain intentionally separate. Merge not performed. Ready for focused independent P2-C coverage-parity review after exact HEAD CI passes. P2-D not started.
