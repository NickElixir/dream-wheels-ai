# P2-B — Dead code & legacy presentation dedup

BASE: `260c3516c286dc37c3647a2dca465e05985c38e5` (post-#264 staging; verified merged and contains P2-A `d0e543f65aad8ba772dc5999f963e42e17ec6436`).
HEAD: the commit containing this report; resolve with `git log -1 --format=%H -- docs/evidence/p2b-dead-code-dedup/report.md`. Production source SHA-256: `d2bb011fca68083acbeebd18ef5fda5fcf86fea507b3130a3f3a111616e50ff7`. Exact PR-head CI result is recorded in the review handoff/PR checks.

## Audit

Candidates audited: 60 symbol/block rows.

| Classification | Count |
|---|---:|
| ACTIVE | 14 |
| LEGACY_REQUIRED | 16 |
| TEST_ONLY | 0 |
| DEAD | 16 |
| DUPLICATE_EQUIVALENT | 1 |
| DUPLICATE_BUT_DISTINCT | 11 |
| UNCERTAIN | 2 |

B0 inventory was completed before deletion. Six private unreferenced roots and ten exclusive dependencies were removed; names, BASE line ranges, repository references and each reachability gate are recorded in reachability.md. The current renderFitment fallback, shared presentation helpers, demos, translations, snapshots, auth/payment/domain logic remain. The observer remains UNCERTAIN and retained.

Production LOC removed: 567 function-body lines, 583 including blank separators. One Fitment presentation domain; no separate Render/Auth cleanup. Helpers consolidated: 0. The equivalent year-only wrapper remains as an existing presentation boundary; distinct formatters are preserved (dedup.md).

All 586 surviving top-level AST nodes in app.js are byte-identical to BASE, including state declarations, imports, domain/controller functions, explicit public exports and callback/event registrations. Only the 16 specified function declarations and their trailing separators were removed (source-parity.json). No runtime API, DB/schema, CSS/layout or copy catalogue changed.

## Verification

- Node relevant suites: 261 PASS (includes two added behavior checks for mounted VNext delegation and safe source details).
- Frontend/Auth: 213 PASS.
- Python: 760 PASS, 22 SKIP locally (database integration requires disposable PostgreSQL; mandatory CI job runs it).
- Ruff lint / format: PASS, 152 files. Build: PASS; generated bundles unchanged. git diff --check: PASS.
- Shared browser suite: 180 PASS; exact BASE/after equality for all recorded text, accessibility attributes, clipping/errors and account locale-switch state (shared-browser-parity.json).
- Targeted BASE/HEAD browser parity: 68 PASS at 390/1440 × RU/EN, comparing route, visible status, available actions and critical state. Covers Dashboard/Create/History/Result/failed refunded/completed missing asset/Fitment editor/result/failed/stale/Wallet/pending/Auth and current legacy Fitment editor/result/failed fallback. presentation-parity.json records SHA-256 for each compared field; the runner compares complete values before hashing.
- Static deleted-symbol scan: no references remain in webapp/tests/fixtures/HTML; historical docs unchanged.
- Exact HEAD CI: required lint-and-test plus qa-context-integration; final result recorded in PR checks before review handoff.

Browser scope: controlled representative fixtures using actual production module and real index.html fallback markup, not a live provider/payment/auth production end-to-end run. BASE and HEAD use the same fixture inputs. Byte parity of every surviving app.js node complements these representative cases.

Updated tests: two catalogue slicing sentinels and the controls sentinel now end at the next surviving declaration; their extracted contracts are byte-identical. Static assertions targeting obsolete source-brand/retry/modification/readiness presentation were pointed at the surviving source detail, retry gate, workspace mode and confirmed-state copy. Existing behavioral source/currentness/failed-check/PCD tests remain; no fixture dedup/test deletion or runner architecture changes. New browser runner is scoped to BASE/HEAD parity and reuses the existing fixture without production test hooks.

User-visible behavior changed: NO. Fitment/Render/refund/Wallet/payment/Auth/session/routing semantics changed: NO. Public bridge/API changed: NO.

Self-review: no actionable BLOCKER/HIGH/MEDIUM found. This is not an independent review. Merge not performed; ready for focused independent P2-B review after exact HEAD CI passes. P2-C not started.
