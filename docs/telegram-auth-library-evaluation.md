# Telegram Auth Decision

Короткий decision note для website Telegram login и Mini App auth boundary.

## Context

Проекту нужен единый Telegram auth boundary для двух каналов:

- Telegram Mini App через `initData`
- website login через Telegram

Email/phone login сейчас вне scope. В roadmap зафиксирован будущий Parallel F4: единый
Dream Wheels account с верифицированными связями Telegram, email и, позже, телефона.

## Decision

### Mini App

Оставляем текущую backend-валидацию `initData` в коде проекта.

Причины:

- поток уже рабочий и тестами покрыт;
- он не требует отдельного auth broker;
- текущая схема хорошо отделяет auth от business logic.

### Website

Для website используем текущий Telegram Login library flow:

- frontend получает `client_id` и server-generated `nonce`;
- Telegram возвращает `id_token`;
- backend валидирует `iss`, `aud`, `exp`, `iat`, `nonce`;
- backend выдаёт свой short-lived bearer token;
- bearer хранится в `sessionStorage` и используется для website requests.

Официальные источники:

- [Telegram Login / OIDC](https://core.telegram.org/bots/telegram-login)
- [Telegram Mini Apps auth](https://core.telegram.org/bots/webapps)

## Why not OIDC yet

OIDC Authorization Code Flow с `client_secret` сейчас не нужен.

Минусы OIDC для текущего этапа:

- больше интеграционной сложности;
- нужен redirect/callback UX вместо простого login callback;
- вероятнее придётся менять session/cookie strategy;
- добавляется лишний слой, который не улучшает текущий website flow с точки зрения продукта.

## Current Trade-offs

Telegram Login library flow имеет ограничения:

- он завязан на browser-side popup/callback UX;
- может конфликтовать с `Cross-Origin-Opener-Policy: same-origin`;
- хуже подходит для server-side sessions и SSO/broker сценариев;
- менее универсален, чем полный OIDC redirect flow.

Для Dream Wheels AI это приемлемо сейчас, потому что:

- website login уже работает;
- backend проверяет токен и claims;
- auth boundary уже отделен от payments/jobs;
- `TELEGRAM_LOGIN_CLIENT_SECRET` можно держать зарезервированным до момента, когда появится реальная потребность в OIDC.

## Revisit Triggers

Пересматриваем решение и переходим на OIDC, если появится хотя бы один из сценариев:

- нужна server-side session/cookie strategy;
- нужен единый auth broker или SSO;
- нужно убрать popup/callback зависимость;
- нужен redirect-based website login flow;
- требуется более жесткая интеграция нескольких веб-приложений.
- пользователю нужно входить в один и тот же Dream Wheels account через Telegram и
  verified email/phone.

## Future Unified Identity Direction

Это не текущая реализация и не повод менять работающий Telegram Login flow заранее.
Когда начнется Parallel F4, целевой результат — один внутренний account и несколько
проверенных identity links:

- Telegram identity из Mini App `initData` или website Telegram Login;
- email через magic link или одноразовый код;
- телефон через выбранный после оценки провайдер (Telegram Gateway и/или SMS).

История рендеров, баланс и платежи принадлежат внутреннему account, а не конкретному
каналу входа. Связывать новый email/телефон с существующим account можно только после
повторной проверки уже авторизованного пользователя и верификации нового идентификатора.
До начала работ нужно отдельно спроектировать recovery, rate limits, защиту от
enumeration, session revocation и миграцию от текущих Telegram identities.

OIDC Authorization Code Flow становится предпочтительным, если для этой модели
понадобится auth broker, server-side sessions/cookies, SSO между несколькими сайтами или
централизованное управление сессиями. `TELEGRAM_LOGIN_CLIENT_SECRET` хранится только в
backend secret storage и используется лишь при таком серверном token exchange.

## Current Rollout

1. Mini App auth остается на `initData` validation.
2. Website auth остается на Telegram Login library callback flow.
3. Backend выдаёт наш bearer token после успешной валидации `id_token`.
4. OIDC остается опцией на будущее, не текущим обязательным шагом.
