# E-01 — Full Release 1 RU/EN cleanup

BASE: `d76189421993cf53aa5149fdf67fe4461e439517` (staging after PR #262).
HEAD (implementation checkpoint): `1992ae041f1aa4d381aed41a43963bed3e7f09b7`.
The following evidence-only commit does not change implementation. The exact final
PR HEAD and CI run are recorded in the PR handoff. No merge is performed.

## Audit and inventory

Audited shell/navigation, bootstrap titles, Dashboard, Create, processing/result/
History, Fitment, Wallet, Support, Photo Guide, Documents, and legacy email/OTP/
restored/restoring authorization. `before-inventory.txt` contains 467 pre-change
VNext candidate lines. `key-inventory.json` records 911 occurrences with source
path, previous literal, semantic key, RU/EN and disposition, including the legacy
dictionary migration. Seven entries are intentionally empty legacy presentation
slots (`NO_VISIBLE_COPY`), not translation keys or untranslated text.

`catalog-summary.json` lists all 790 new keys and 60 existing keys referenced by
production renderers. The final catalog contains 857 nonempty bilingual keys.
Existing approved #262 meaning is preserved. The discontinued leading-space
`fitment.picker.noRounding` key is replaced by the complete ET hint:

- RU: `ET — от −150 до +150 мм. Без округления.`
- EN: `ET — from −150 to +150 mm. Do not round the value.`

## Implementation and locale contract

`webapp/vnext/copy.mjs` owns translations. Renderers request semantic keys at
creation time. Dynamic phrases use named interpolation and existing HTML escaping.
Create's post-render DOM translation walk and Fitment's substring replacement map
are removed. No new per-view translation dictionaries are introduced.

`applicationLocale()` reads the synchronized document language; `localeOf(model)`
accepts an explicit RU/EN snapshot first. Dashboard, Wallet, Create, Fitment and
Render bridge snapshots carry the application locale. Static models receive the
same locale. Shell labels, bootstrap titles and helper renderers receive it too.
`dreamwheels:localechange` updates the existing application locale and document,
refreshes legacy keyed content/auth, then remounts the active VNext surface.
Existing refresh events discard their event argument instead of treating it as a
locale. No locale persistence or state manager is added.

Missing keys warn and return the key, using `Object.hasOwn`; `toString`,
`constructor` and `__proto__` are covered. Unknown reason/code lookups are also
protected against inherited properties. Known API error codes map to catalog keys;
unknown structured codes use a bilingual neutral fallback. Explicit `safe_text`
and user/provider labels remain verbatim; arbitrary text is not substring-translated.

## Legacy boundaries remaining

The existing `t()` / `data-i18n` interface remains for static legacy markup, auth
and runtime presentation formatters. Its dictionary is reconstructed from
`COPY["legacy.*"]` by `legacyTranslations()` and contains no independent copy.
A frozen dictionary digest checks unchanged bilingual content, with four explicit
translation-completeness repairs: missing EN History hide/create-another/download
labels, and the missing RU Wallet details label. Seven deliberate empty slots are
reconstructed as empty values outside the translation catalog.

Legacy static ARIA/placeholder attributes use explicit `data-copy-aria` and
`data-copy-placeholder` keys in `applyTranslations()`. Legacy conditional runtime
presentation helpers remain locale-aware; they are not DOM translators. The
punctuation observer only handles legacy heading/button/status labels, skips
sentence-marked content, and now skips the entire VNext shell. It does not translate
text or change VNext body sentences. Auth stays with its existing controller,
OTP/resend/restore logic and legal endpoints; accessible close/divider/legal copy
is localized and refreshes on locale changes.

## Remaining non-localized user-visible copy

Frontend-owned RU leaking into EN migrated Release 1 surfaces: **0 known**.
Frontend-owned EN leaking into RU migrated Release 1 surfaces: **0 known**.

Intentional content: Dream Wheels AI, Telegram, Robokassa, Wheel-Size, email/URLs,
brand/model/SKU, technical symbols/units, numeric values, user/provider labels and
external legal documents. `Coupe`, `AWD`, `FWD` remain unchanged. Russian user data
is explicitly preserved even in EN; the Cyrillic gate uses controlled ASCII data.

Glossary: Автомобиль → Vehicle; Диск → Wheel; Примерка → Try-on; История → History;
Совместимость → Compatibility; Комплектация → Vehicle version (existing project
term); Рынок → Market; Артикул → SKU; Диаметр → Diameter; Ширина → Width;
Количество отверстий → Bolt count; technical table ET, PCD and DIA retain their names.

## Verification

- Node behavioral/catalog tests: 245 PASS, including seven E-01 checks.
- Frontend/auth/payment/render tests: 213 PASS.
- Python regression: 760 PASS, 22 skipped locally; database integration runs in CI.
- Ruff check / format check: PASS. Build: PASS; generated auth bundles unchanged.
- Diff whitespace check: PASS.
- Browser: 102 checks PASS, 390×900 and 1440×900, RU/EN. Dashboard logged in/out,
  Create, History, Result, processing, failed/refunded, missing result asset;
  Fitment compatible/conditions/unknown/incompatible/failed/stale/editor; Wallet
  normal/pending; Support, Photo Guide, Documents; auth email/OTP/restored/restoring.
  Six additional checks switch RU→EN→RU→EN through the production bootstrap on
  mounted Support surfaces. Visible copy, ARIA/alt/placeholders, page errors,
  horizontal overflow and clipped buttons/status labels are checked.
- `browser-results.json` contains all machine results; seven representative mobile
  EN screenshots are included. Runner: `tests/e01-i18n-browser.cjs`, local server
  port 8779; `PLAYWRIGHT_MODULE` selects the installed Playwright runtime.
- Exact final HEAD CI: the PR handoff records the verified SHA and run URL.
  [Branch CI](https://github.com/NickElixir/dream-wheels-ai/actions?query=branch%3Afix%2Fe01-i18n)
  is the authoritative live result; a commit cannot include its own final SHA.

Backend, migrations, fitment verdict/field_results, render lifecycle, billing,
credit reservation/refund/finality, payment lifecycle, provider behavior, asset
access, auth authority, API payloads, routing and navigation destinations are
unchanged. No layout/style source is modified. Existing behavioral assertions are
retained; static copy checks now follow the catalog instead of inline literals.


## Corrective pass — M-1 / M-2 / M-3

Reviewed checkpoint: `47fa1384a31284859357c0d260607cd281d43b84`.
Base remains `d76189421993cf53aa5149fdf67fe4461e439517`.
The new exact HEAD and its CI run are recorded in PR #263's handoff/body after
this single corrective commit is pushed; the previous HEAD/CI are not evidence
for the corrective result.

The original 102-state browser coverage missed three upstream legacy presentation
paths. This pass expands coverage to 156 states and fixes the sources:

- M-1: `fitmentCatalogueFieldState(kind, value, language)` localizes make/model/year
  placeholders and dependency/loading/empty/failed messages. Its state decisions
  are unchanged. `vnextFitmentSnapshot()` passes `locale` explicitly; the VNext
  catalogue field now uses the already escaped localized placeholder.
- M-2: `classifyGenerationError(message, language)` retains the five regex branches,
  actions and support flags. `submitJob()` localizes preparing/generating and
  still-processing/refresh copy at the existing write points. Browser fixtures
  invoke production submission and classification with isolated request doubles;
  timeout time advances only inside the test fixture. Retry keys, upload recovery,
  polling deadlines, render state and credit behavior remain unchanged.
- M-3: account settings/link/OTP/Telegram/merge runtime and static account HTML use
  canonical keys. `setAccountPresentation()` retains a semantic companion key for
  notices; `refreshAccountPresentation()` relocalizes and redraws existing surfaces
  without requests or auth/account reset. Email and OTP DOM values are untouched.
  The existing `data-i18n` adapter can resolve canonical account keys while still
  preferring existing derived legacy entries. Telegram login errors and the account
  subtitle fallback are localized; provider/user values remain verbatim.
- LOW-1: EN uses `Parameters left to confirm: {count}`, including count 1.
- LOW-3: every entry of both `unknownReasonKeys` and `errorKeys` is exercised through
  its public behavior in RU and EN, with catalog existence assertions. No production
  export was introduced for testing. LOW-2, LOW-4 and LOW-5 remain deferred.

All 70 new keys are used; COPY now contains 927 entries. No second translation
source, substring replacement or DOM text walker was added. Legacy dictionary
content and its existing digest remain unchanged. `key-inventory.json` appends
corrective entries; `catalog-summary.json` separates original and corrective counts.

Validation at the corrective source checkpoint:

- Node: 253 PASS (includes three gateway checks); targeted corrective tests cover
  catalogue states, classification actions, dynamic map completeness and account
  notice/Telegram error refresh without another login.
- Frontend/auth: 213 PASS, including failed-render retry/upload recovery tests.
- Python: 760 PASS, 22 local database skips. Ruff check and format: PASS (152 files).
- Build: PASS; generated auth bundles unchanged. `git diff --check`: PASS.
- Browser: 156 PASS, 390×900 / 1440×900, RU/EN. Existing scenarios plus vehicle
  editor loading/empty/failed, production Create service/wheel/timeout, account
  settings/error/link email/link OTP/merge. Ten account RU→EN checks preserve input,
  dialog/flow/auth state and request count. Six prior production bootstrap locale
  checks remain. Newly covered EN frontend-owned Cyrillic: **0** across visible
  text, ARIA, alt and placeholders with controlled ASCII data; no page errors,
  horizontal overflow or clipped actions/statuses.

Focused corrective re-review: the diff after the reviewed checkpoint changes
presentation sources and their tests/evidence only. No backend/migration/style
files changed. Fitment decisions, render lifecycle, payment/credit lifecycle,
auth authority and request payloads/destinations remain unchanged. Merge is not
performed. Ready for a short corrective re-review after exact-HEAD CI succeeds.


## Remaining runtime leaks — Result / starter grant / photo validation

Review of `60e55f3e52a113534a1945c1425e9d398564528c` was supplied by the owner
in the conversation. Its reported checks are distinguished from independently
run checks.

Five new canonical keys replace five inline strings at the source: Result download
success, failure and unavailable-history notices; starter-grant package fallback;
and vehicle-photo format/10 MB rejection. COPY now has 932 bilingual entries. The
production diff only changes these text expressions. Download route, authorization,
job selection, sorting/filtering/credits, provider labels, MIME/size limit and upload
behavior are unchanged. Backend, migrations and styles remain unchanged.

Regression checks invoke all three production functions in both locales, asserting
unchanged download routes/current-job context, cohort order/credits/provider labels,
and invalid-photo rejection before storage. Browser coverage adds actual Result
notices, the legacy expiry card and Fitment recognition validation presentation.

Validation: Node 256 PASS (includes 3 gateway checks); frontend/auth 213 PASS;
Python 760 PASS / 22 local database skips; Ruff check/format, build and diff checks
PASS; generated auth bundles unchanged. Browser 176 PASS at 390×900 and 1440×900,
RU/EN, including all previous 156 checks and 20 new checks. Newly covered EN text,
ARIA, alt and placeholders contain no frontend-owned Cyrillic. The exact new SHA
and CI run are recorded in the PR handoff after this commit is pushed. Prior CI
for `60e55f3` is not used as verification of the subsequent fix. Merge not performed.
