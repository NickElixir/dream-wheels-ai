# Infra 01B — Generic Vercel Backend Gateway

Дата: 2026-08-30
Baseline: `origin/staging` at `527b193b83166408c7140d643b0513a57ee320cc`
Ветка: `codex/infra-01b-generic-vercel-gateway`

## Scope

Реализован один same-origin gateway для всех WebApp backend paths. Runtime
deployment выполнен в staging и подтверждён authenticated E2E ниже.

```text
/api/backend/(.*)
        ↓ internal Vercel rewrite
/api/backend-gateway?__backend_path=$1
        ↓ one Node.js 24 Function
BACKEND_URL/$1
```

Старые namespace catch-all, Fitment-specific и endpoint-specific Vercel
handlers удалены. Поэтому `/jobs/{id}/assets/{kind}/download`, включая
`car_original` и `rim_original`, больше не зависят от глубины filesystem route.

## Gateway contract

- `BACKEND_URL` читается только во время выполнения Function.
- Backend pathname передаётся через внутренний control parameter и
  нормализуется как path-only значение.
- Исходные query parameters сохраняются, а `__backend_path` удаляется перед
  отправкой в Render.
- Сохраняются method, Authorization, Content-Type, multipart/binary request
  body и релевантные response headers.
- Hop-by-hop headers и stale `content-encoding` не пересылаются.
- Response body передаётся как полный byte sequence через установленный для
  этого Vercel Node adapter `res.send(Buffer)` путь; streaming не заявляется
  без runtime-доказательства.
- Для authenticated/revision-sensitive responses сохраняются `no-store` и
  `Vary: Authorization`.

## Acceptance evidence

Локальная Vercel build должна показывать ровно одну Function:

```text
vercel build --prod --yes
find .vercel/output/functions -type d -name '*.func'
→ api/backend-gateway.func
```

Contract tests проверяют deep asset paths, duplicate/encoded query, method,
Authorization, Content-Type, request body и response bytes. Реальный
authenticated staging E2E выполнен ниже; acceptance checks включают:

1. `GET` `car_original` через staging Vercel → Render → Storage возвращает
   `200` и корректный image content type.
2. `GET` `rim_original` проходит тот же путь.
3. Render-origin evidence подтверждает, что ответ не является Vercel edge
   fallback.
4. Fitment nested GET/PATCH, auth, feedback, result download и payments
   сохраняют рабочие method/query/header semantics.

Production rollout и проверка зашифрованного production `BACKEND_URL` в эту
ветку не входят.

## Authenticated staging E2E: PASS

Staging deployment `dpl_C7CksSeHqPEfuGMsaDv2D65SqGmc` достиг состояния `READY`
и был назначен на alias
`https://dream-wheels-ai-webapp-staging.vercel.app`.

В авторизованной browser session пользователь открыл реальный job
`12843be8-f773-4377-876e-8dfc9d47bdcf` и нажал штатное действие
«Повторить с этими фото». Это действие делает только два protected `GET`, не
создавая новый render:

| Route | Status | Content-Type | Body | Browser result | Origin evidence |
| --- | ---: | --- | ---: | --- | --- |
| `/api/backend/jobs/{id}/assets/car_original/download` | 200 | `image/jpeg` | 3,359,704 bytes | `4096×2304` blob preview | `x-render-origin-server: uvicorn` |
| `/api/backend/jobs/{id}/assets/rim_original/download` | 200 | `image/png` | 865,898 bytes | `1200×1200` blob preview | `x-render-origin-server: uvicorn` |

Оба ответа имели `Cache-Control: no-store, max-age=0`, `Vary: Authorization`
и `x-vercel-cache: BYPASS`. На странице не появилось console error; оба
preview отображаются в форме создания примерки.
