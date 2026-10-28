# P2-A — copy/i18n/presentation consistency

Base: `staging @ cd414ff086931c4c44f6d00eb674f5e4fccbc1c7`.
Scope: remaining E-01 LOW-2 / LOW-4 / LOW-5 only, without product redesign.
The PR handoff records the exact final HEAD and CI run; this document does not
claim that a commit contains its own SHA or pre-empt independent review.

## Decisions and changes

[`terminology-audit.md`](terminology-audit.md) records 25 concept/context decisions
before their edits: UNIFY, KEEP DISTINCT or LEGACY-ONLY. All 19 cross-boundary
RU-label groups with different EN variants found at this base are accounted for,
including distinctions between one-field matching, overall verdict and photo
quality; recognition retry vs technical recheck; invoice vs job refresh; compact
navigation vs page heading; session heading vs sentence; and billing units vs
visual try-ons. No key or code is declared DEAD in this phase.

Thirty existing COPY entries change. Thirteen normalize controlled progress
ellipses from `...` to `…`; overlapping terminology changes align the labels and
actions for login, balance/account, creation, vehicle version, compatibility,
vehicle photo/replacement, photo guide and refund-document links. The old inline
dashboard loading fallback now uses the existing `wallet.loading` data-i18n key.
No global Render→Try-on replacement is performed; credit/payment/audit terms and
approved technical Fitment vocabulary retain their meanings.

[`catalog-changes.json`](catalog-changes.json) lists every old/new bilingual pair
and reason. COPY remains the sole catalogue, with the same 932 keys and unchanged
interpolation placeholders. No production function, routing, state, request or
adapter logic changes. User/provider strings and Coupe/AWD/FWD/ET/PCD/DIA retain
their values. No backend, migrations, styles, dependencies or business semantics
change. Archived E-01 evidence remains unchanged.

## Semantic checks

The digest remains a secondary change detector, updated for the reviewed change
set. It is complemented by independent structured assertions:

- Required legacy groups exist in RU and EN; both dictionaries have equal leaf paths.
- Every non-empty legacy leaf derives from its corresponding COPY key; every legacy
  key is present in the adapter. Only the seven explicitly named compatibility
  slots are empty, and no catalogue text is hidden by those slots.
- Canonical concept keys retain expected RU/EN meaning; equivalent EN labels agree.
  Deliberately different concepts are asserted separately, rather than normalized
  by spelling alone.
- Controlled COPY entries contain no ASCII ellipses. External safe text, interpolated
  values, URLs and technical tokens remain untouched.

Missing/prototype keys, dynamic reason/error maps, escaping, authoritative Fitment
reasons and original runtime regressions remain tested. No test is deleted or
merged. One Render hierarchy assertion changes only its expected ellipsis; all
its object/spec/status structure checks remain.

## Validation

- Node: **259 PASS**, including three gateway checks and the three new semantic tests.
- Frontend/auth: **213 PASS**.
- Python: **760 PASS / 22 skipped locally**; database integration is checked by CI.
- Ruff check/format: **PASS** (152 files). Build: **PASS**; auth bundles unchanged.
- `git diff --check`: **PASS**.
- Browser: **180 PASS**, 390×900 / 1440×900, RU/EN: all prior 176 states plus four
  focused legacy-copy cases using production `applyTranslations()` / `t()` and
  actual index nodes where available. Exact canonical text, ellipses, visible
  text/ARIA/alt/placeholders, page errors, overflow and clipped actions are checked.
  EN frontend-owned Cyrillic: **0** with controlled ASCII data. Existing runtime
  locale switches and account input/state/request preservation still pass.

Run the existing shared browser suite without rewriting historical evidence:

```sh
python3 -m http.server 8779
E01_EVIDENCE_DIR=docs/evidence/p2a-copy-consistency node tests/e01-i18n-browser.cjs
```

`PLAYWRIGHT_MODULE` may point to the available Playwright installation. The runner's
original default output remains compatible. Browser results and representative
mobile EN images are stored in this directory; no screenshot refresh is committed
to archived E-01 evidence.

## Focused review / next gate

Focused self-review found no new blocker/high/medium issues. Production diff is
limited to catalogue values and one legacy binding. No new translation source or
substring replacement is introduced. Remaining distinctions are justified in the
audit, not silently treated as cleanup omissions.

P2-A implementation is ready for focused independent review after exact-HEAD CI.
Independent review and merge are pending; they are the phase boundary in the owner
specification before P2-B. P2-B/C, P2-D destructive cleanup, and final re-baseline
are not claimed complete. Staging QA data has not been changed.
