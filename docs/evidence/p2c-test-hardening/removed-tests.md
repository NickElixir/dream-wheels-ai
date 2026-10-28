# Removed tests / replaced assertion ledger

Removed tests: 0. Fixtures removed: 0. Fixtures consolidated: 0. No duplicate/obsolete test is deleted; historical standalone fixtures and parity tools remain.

Four source-presence assertions (two in the first row, one in each other row) were replaced; every enclosing test and its other assertions remain.

| Old test | Protected contract | Replacement | Equal/stronger coverage? |
|---|---|---|---|
| `test_cabinet_dashboard_static.py::test_saved_rim_source_is_resolved_when_fitment_opens` | function buildRimSecondaryDetails / fitmentSafeSourceDisplay source presence | `test_fitment_transition_behavior.mjs::Fitment source details keep safe labels and hide persisted source while editing` | Exact safe public URL, query/fragment removal, private-host neutral label and editing rows; source negative control fails |
| `test_fitment_frontend_g2.py::test_complete_vehicle_details_does_not_expose_variant_picker_or_internal_provenance` | fitmentVehicleWorkspaceMode function-name presence | `test_fitment_transition_behavior.mjs::required variant selection is a non-collapsible workspace; confirmed optional reselection remains collapsible; public bridge snapshot preservation` | Existing exact mode/collapsibility behavior plus retained DOM/variant gating assertions; no test removed |
| `test_fitment_frontend_slice6.py::test_async_check_polling_and_failed_state_never_become_unknown` | const showRetry exact source fragment | `test_fitment_transition_behavior.mjs::failed legacy Fitment result offers retry only when the server permits it and never changes canonical check state; legacy-fitment-fallback-browser.cjs failed + failed-no-retry` | Actual renderer distinguishes retryable/not_applicable, failed remains failed, canonical state unchanged; retry negative control fails |

All 61 neighboring-function/bridge interval migrations and two custom extraction implementations are listed in extraction-migrations.json. Their existing semantic/security assertions remain, including financial copy, failed != missing asset, exact decimal values, and revision/state ownership. The broad history-refresh interval previously included the worker beside its wrapper; it now explicitly targets requestRenderHistory, where rerender occurs. Complete bridge extraction already includes its closing `};`, so the VM's formerly appended manual brace was removed; assertions are unchanged.

Source helper hardening tests prove brace/comment/regex/template/Unicode handling, exported functions, window assignment extraction, source order/neighbor removal independence, and strict errors for missing/nested-only targets or invalid JS. No silent substring fallback.
