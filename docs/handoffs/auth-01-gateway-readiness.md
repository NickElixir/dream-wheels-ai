# AUTH-01: OAuth / Cookie Gateway Readiness

## Baseline

Работа выполнена от `staging` commit `f7f96aa`:

```text
Merge fix(fitment): preserve blocking result evidence
```

На момент аудита этот commit совпадал с `origin/staging`. `main` не использовался как база.

## Findings

До AUTH-01 Generic Vercel Backend Gateway уже обеспечивал:

- wildcard mapping `/api/backend/**` через `__backend_path`;
- deep backend paths, query strings, request methods и request body;
- forwarding Authorization и остальных end-to-end request headers, кроме hop-by-hop;
- binary response forwarding;
- server-side `BACKEND_URL` с базовой URL-валидацией;
- `Cache-Control: no-store, max-age=0` для proxied responses.

Недоставало доказанной browser-auth semantics:

- upstream `fetch` не был переведён в manual redirect mode;
- Set-Cookie проходил через обычную итерацию `Headers`, которая может представить несколько cookies как одно объединённое значение;
- `Vary` учитывал только Authorization, но не Cookie;
- отсутствовали focused tests для OAuth callback query, Cookie и нескольких Set-Cookie;
- path validation не блокировала backslash-формы, которые WHATWG URL может трактовать как host switch.

## Changes

- upstream requests используют `redirect: "manual"`, поэтому 3xx и `Location` возвращаются браузеру как есть;
- Set-Cookie извлекается через Node Fetch `Headers.getSetCookie()` и передаётся в response как независимый массив значений;
- fallback не склеивает значения повторно, если runtime предоставляет только единичное значение;
- `Vary` теперь включает `Authorization` и `Cookie`, сохраняя дополнительные upstream tokens;
- backend path отвергает backslash и проверяется на сохранение configured backend origin;
- добавлены regression tests для redirect, query preservation, request Cookie, Authorization, single/multiple Set-Cookie, cache policy, binary response и host control.

## Security properties

- browser input не может заменить server-controlled `BACKEND_URL` другим host;
- OAuth `Location` не fetch-ится gateway самостоятельно;
- Cookie не переносится на другой host;
- независимые Set-Cookie не превращаются в один cookie header;
- proxied auth/user-scoped responses имеют `Cache-Control: no-store, max-age=0`;
- `Vary` учитывает обе будущие auth transport modes: Authorization и Cookie;
- в gateway patch не добавлено логирование request/response secrets.

## Tests

Локальный repository gate:

```text
ruff check .                 PASS
ruff format --check .       PASS (114 files already formatted)
python -m compileall ...    PASS
pytest -q                   PASS (400 passed, 3 skipped)
node --test ...             PASS (7 passed)
git diff --check            PASS
GitHub Actions PR #140     PASS (оба lint-and-test запуска)
```

Итог contract gate:

```text
GENERIC_GATEWAY_DEEP_ROUTING = PASS
OAUTH_REDIRECT_FORWARDING = PASS
REQUEST_COOKIE_FORWARDING = PASS
SET_COOKIE_FORWARDING = PASS
MULTIPLE_SET_COOKIE = PASS
AUTH_QUERY_PRESERVATION = PASS
AUTH_CACHE_POLICY = PASS
PROTECTED_ASSET_REGRESSION = PASS
CI = PASS
AUTH_GATEWAY_READY = YES
```

`AUTH_GATEWAY_READY = YES` означает готовность transport contract по локальным
и CI-проверкам. Это не означает, что OAuth providers или cookie sessions уже
реализованы.

## Staging evidence

`PENDING`: patch подготовлен локально на feature branch и не деплоился. Live staging verification без изменения staging/production требует отдельного deploy/PR flow и безопасного auth fixture; provider OAuth и временный insecure endpoint не добавлялись.

## Deferred

Следующие этапы сознательно не входят в AUTH-01:

- AUTH-02 `user_identities`;
- AUTH-03 `AuthPrincipal`;
- AUTH-04 API cutover;
- AUTH-05 sessions + CSRF;
- AUTH-06 OAuth provider framework;
- AUTH-07 Avito / Yandex;
- schema/user model changes, login UX, account linking и `webapp/app.js` refactor.
