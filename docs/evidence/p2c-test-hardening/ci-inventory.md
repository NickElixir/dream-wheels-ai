# Regression versus evidence execution

Always-on CI (`lint-and-test`):

- `pytest -q`: all Python tests, including the shared extractor adapter tests. Requires Node + `npm ci --prefix webapp`; no new skip/fallback if unavailable.
- `node --test`: gateway; Vehicle catalogue behavior; Fitment transition/navigation; composition/focus; E-01 i18n/corrective; failed-render billing/asset behavior; boot; new source-extractor regression tests.
- `npm --prefix webapp test`: all `webapp/auth/*.test.js`, including OTP/session/authority/link/merge, Create/Render/Fitment/Wallet routes/bridges and the deterministic concurrent-401 refresh test.
- Ruff lint/format, Python syntax compilation, auth builds and committed harness bundle parity.

The frontend dependency install moves earlier, before Python tests, because the Python source adapter invokes the same Acorn parser. It is still installed once. Pinned test-only Acorn is a dev dependency; runtime dependencies and bundles do not change.

Mandatory disposable PostgreSQL (`qa-context-integration`, unchanged):

- `TEST_FITMENT_QA_DATABASE_URL`: `test_fitment_qa_tooling.py` disposable setup/isolation.
- `TEST_VEHICLE_CONFIRMATION_DATABASE_URL`: `test_vehicle_confirmation_provenance.py` and `test_fitment_variant_details.py`, persistence/rollback/variant details.
- `TEST_PAYMENT_LIFECYCLE_DATABASE_URL`: `test_payment_lifecycle_postgres.py`, timeout/late callback/exact-once/credit races.
- `TEST_RENDER_DATABASE_URL`: `test_render_finality_postgres.py`, replay/terminal states/refund/finalize/publish rollback.

Local optional integration: these 22 existing cases skip without their isolated PostgreSQL DSNs. No new skip/xfail/todo added. Never point them at production.

Manual browser release regression (not always-on CI):

- `e01-i18n-browser.cjs` + `e01-i18n.html`: 180 shared RU/EN, mobile/desktop, locale-switch/accessibility/status/action/clipping cases. Output in this phase through `E01_EVIDENCE_DIR=docs/evidence/p2c-test-hardening`.
- `legacy-fitment-fallback-browser.cjs` + new feature fixture: 20 actual fallback DOM editor/result/incompatible/failed/retry-disallowed cases; C0 language probe targets the two requested strings and existing incompatible helper. Node C0/retry tests are always-on CI counterparts.

Evidence-only / standalone feature QA:

- P2-B BASE/HEAD parity runner: retained, historically proves #265. It intentionally compares against its old production source and is not a new C0 regression gate; C0 changes approved EN text.
- P1 copy runner and older feature/browser fixtures: retained for historical diagnosis; no global fixture consolidation or rerunner rename. Historical evidence directories are immutable.
- New negative controls: controlled in-memory read overrides, no committed production mutation; results recorded in `negative-controls.json`.

No deploy, secrets, production jobs or staging data cleanup changes.
