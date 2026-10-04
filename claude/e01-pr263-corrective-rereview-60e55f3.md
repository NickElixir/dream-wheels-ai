# E-01 PR #263 — corrective re-review

Reviewed HEAD: `60e55f3e52a113534a1945c1425e9d398564528c`.
Source: review supplied by the project owner in this chat.

## Closed findings

- M-1: `fitmentCatalogueFieldState` accepts language; callers pass it explicitly.
- M-2: Create error classification uses canonical `generation.error.*` copy.
- M-3: account/link/merge runtime and static presentation use COPY; dynamic HTML is escaped.
- LOW-1: EN uses `Parameters left to confirm: {count}`.
- LOW-3: corrective regression coverage is included in CI.

## New finding — MEDIUM: three remaining EN presentation leaks

1. `downloadResult`: “Загрузка изображения начата”, “Не удалось скачать изображение. Повторите попытку.” and “Примерка недоступна. Обновите историю и повторите попытку.” appear on Result after download actions.
2. `buildRenderExpiryCohorts`: “Стартовый пакет” appears in the expiry list for a starter grant without a provider label.
3. `setFitmentVehiclePhoto`: “Выберите JPEG, PNG или WebP до 10 МБ.” appears when vehicle photo validation fails.

Recommendation: fix these sources with approximately five canonical keys before merge, in one small commit. LOW-2 terminology, LOW-4 digest design and LOW-5 ellipsis consistency can remain deferred. Other Russian literals identified by the reviewer belong to hidden legacy presentation or provider/user/demo/feedback data.

## Verification reported by the reviewer

- Diff limited to webapp, tests, evidence and one CI line.
- 927 COPY keys; no empty values or Cyrillic in EN values.
- Node: 250/250; auth: 167 passed, two failures described as recurring environment failures.
- Browser runner: 156 states passed.
- The reviewer could not inspect GitHub CI due to API access limitations in that session.

These are the reviewer's reported results, not new execution results. The agent independently verified both CI jobs for reviewed HEAD in run [37232155855](https://github.com/NickElixir/dream-wheels-ai/actions/runs/37232155855). Verification of the subsequent fix is recorded separately in `docs/evidence/e01-i18n/report.md` and the PR's exact-HEAD handoff.
