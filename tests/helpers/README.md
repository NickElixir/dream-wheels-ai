# Test-only source extraction

`source-extract.mjs` uses pinned Acorn from `webapp` dev dependencies. Install with `npm ci --prefix webapp` before running the Node suites or Python structural tests. CI installs it before `pytest`. Python's `source_extract.py` calls the same extractor once per cached source string and transfers function text, preserving Unicode despite JS/Python offset differences.

Use `extractFunction(source, name)` / `extract_function(source, name)` for a complete named top-level function. Use an explicit `extractFunctions(source, names)` dependency list for isolated VM tests; no neighboring function acts as an end sentinel. `extractDeclaration` handles a named variable or explicit `window` bridge assignment. Missing targets and syntax errors fail the test; no skip/fallback substring extraction.

This helper does not load or execute production modules and does not replace behavioral assertions. HTML/CSS structural regions can retain semantic markers. Whole-application boot/controller harnesses remain separate.

Manual browser regression gates:

- `tests/e01-i18n-browser.cjs`: shared 180-case Release 1 matrix; set `E01_EVIDENCE_DIR` to a new evidence directory.
- `tests/legacy-fitment-fallback-browser.cjs`: current production fallback editor/result/failure/retry and C0 RU/EN copy; set `P2C_EVIDENCE_DIR` for outputs.

Both require Playwright Chromium and a local repository server on `127.0.0.1:8779`; non-loopback requests are mocked. `tests/p2b-presentation-browser.cjs` remains historical BASE/HEAD evidence, not an always-on regression after the deliberate C0 text correction.
