# P1 copy + LOW-1 evidence

Base: staging b707906, after PR #261 merge. Browser QA uses the production
vnextFitmentSnapshot and view modules with stored representative API responses;
external requests are isolated. Copy changes do not alter verdicts or data.

36 browser snapshots cover Create, Result, History and Fitment compatible,
conditions, unknown, incompatible, failed, stale at 390/1440 in RU/EN.
`browser-snapshots.json` records visible text, no page overflow, no clipped
buttons/badges and no JS errors. `verdict-snapshots.json` has 12 regression
snapshots checked by the composition tests. EN translation is limited to affected
strings; existing untranslated shell/Result text remains outside the E-01 scope.

Run the static server from the repository root at http://127.0.0.1:8779, then:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/p1-copy-browser.cjs
node --test tests/*.mjs
```

The browser runner compares the stored baseline. To approve changed snapshots,
run with UPDATE_P1_SNAPSHOTS=1 after reviewing the copy and screenshots.

LOW-1 also covers size, ET, DIA, PCD, absent vehicle/wheel details, multiple
reasons, unknown codes, redundant server missing-field projections, exact
reason-text duplication and stale/failed exclusion in both locales. Its mutation
check verifies that restoring the former universal size text fails the renderer
contract. E-03 tests exercise t() and the actual DOM copy observer.

Local validation: Node 236 passed; auth 213 passed; Python 760 passed / 22 skipped;
Ruff lint/format and diff check passed; auth bundles unchanged. The minified
Fitment bundle contains neither the old unknown subtitle nor «целиком».

Catalogue coverage, individual changes, RESOLVED/OBSOLETE exclusions and
screenshot links are recorded in the PR description. No synced project source
files or docs were changed.
