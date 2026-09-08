# Release 1 — Domain, Landing, App & Auth Routing Architecture

Status: **RECONCILED FOR REVIEW**\
Scope: **Release 1**\
Production: **NOT TOUCHED**\

This document is reconciled against the closed Auth V1.1 staging baseline and
the closed 05B.1 Payment Return Routing contract. It remains architecture
documentation only: no runtime, DNS, Vercel, Supabase, Auth-provider, or
production configuration is changed by this PR.

Release 1 ordinary WebApp authentication is Email OTP through Supabase.
Telegram remains the compatible legacy website/Mini App authority. Yandex, VK,
Google, Apple, Microsoft, and other social OAuth providers are deferred.

## 1. Основные принципы

### 1.1. Приложение доступно только после авторизации

В Release 1 анонимного режима приложения нет.
```
Landing
→ App
→ Auth gate
→ authenticated App
```

Все рабочие пользовательские данные создаются только для авторизованного пользователя:

- Vehicle draft;
- Rim draft;
- uploads;
- Fitment;
- render jobs;
- history;
- credits;
- payments.

Anonymous drafts и перенос anonymous state после регистрации в Release 1 не реализуются.

### 1.2. Landing не дублирует приложение

Это базовый продуктовый принцип.

Landing отвечает только за:

- объяснение продукта;
- демонстрацию ценности;
- примеры;
- доверие;
- FAQ;
- legal/support;
- переход в приложение.

Landing не должен содержать собственные версии:

- Vehicle flow;
- Rim Parser;
- Fitment;
- uploads;
- кабинета;
- render workflow.

Вся работа пользователя выполняется только в WebApp.

---

# 2. Карта production-доменов

## Российский рынок
```
https://колесамечты.рф/
        ↓
Russian Landing
        ↓
CTA «Попробовать»
        ↓
https://dreamwheels.pro/app/new
        + market=ru
        + preserved supported UTM
```

## Международный рынок
```
https://dreamwheels.pro/
        ↓
Global Landing
        ↓
CTA
        ↓
https://dreamwheels.pro/app/new
```

## Production App Origin

Единый production origin приложения:
```
https://dreamwheels.pro
```

Cross-domain SSO для Release 1 не требуется.

---

# 3. Routing contract

Согласованная production-карта:
```
/                    Global Landing
/app                 Auth-gated WebApp
/app/new             начало нового пользовательского сценария
/app/...             Auth-gated WebApp routes
/t/...               Telegram Mini App channel
/api/backend/**      Generic Vercel Backend Gateway
```

Auth restoration and payment browser returns are separate contracts. The
ordinary WebApp Auth flow is Supabase Email OTP; Telegram remains an existing
compatibility channel. No social-OAuth callback is part of Release 1.

Не создавать новые per-endpoint Vercel proxy routes.

---

# 4. Auth gate

Любой защищённый App route требует авторизации.

Пример:
```
/app/new
↓
session?
├─ yes → открыть /app/new
└─ no
   ↓
   Auth
   ↓
   successful login
   ↓
   вернуть пользователя в /app/new
```

Auth должен поддерживать отдельный transient `auth_intended_route` — исходный
разрешённый App route, который нужно восстановить после успешной авторизации.
Это не поле `payments.return_to` и не платёжный callback context.

`auth_intended_route` строится через allowlist текущих App routes (`/app`,
`/app/new`, `/app/history`, `/app/wallet`, `/app/settings`, `/app/support`,
`/app/photo-guide`, `/app/docs`, `/app/render-detail`, `/app/fitment`) и
сохраняет только `market` и поддержанные UTM-параметры. Внешние URL, `/api/**`,
Telegram routes и неизвестные App paths отклоняются.

Пример:
```
/app/history
→ Auth
→ /app/history
```

После успешной авторизации пользователь не должен возвращаться на Landing.

Payment routing использует отдельный persisted `payments.return_to`, связанный
с `payments.client_channel`:

| Контекст | Persisted contract | Назначение |
| --- | --- | --- |
| Auth | transient `auth_intended_route` | вернуть пользователя в исходный App route после Auth |
| Web payment | `client_channel=web`, validated `payments.return_to` | browser SuccessURL/FailURL → `/app`-family route |
| Telegram payment | `client_channel=telegram`, validated `payments.return_to` | browser callback → `/t/` |

SuccessURL/FailURL только возвращают браузер и не подтверждают оплату. Credits
и финальный `paid` остаются за authoritative ResultURL; payment `return_to`
не используется как Auth redirect.

---

# 5. CTA semantics

На Landing:
```
Попробовать     — primary action
Войти           — secondary action
```

`Попробовать`:
```
→ /app/new
→ Auth при отсутствии session
→ /app/new
```

`Войти`:
```
→ Auth
→ /app
```

Основной CTA российского Landing не должен вести пользователя в Telegram.

Telegram остаётся одним из доступных способов входа / отдельным Mini App channel.

---

# 6. RU и Global domains

## `колесамечты.рф`

Используется как:

- Russian marketing origin;
- RU advertising entry point;
- русский Landing;
- RU SEO;
- RU support/legal entry point;
- источник attribution.

Не является отдельным authenticated WebApp origin в Release 1.

## `dreamwheels.pro`

Используется как:

- Global marketing origin;
- единый authenticated WebApp origin;
- Auth target;
- API gateway origin;
- основной технический production origin.

---

# 7. UTM и attribution между доменами

Browser storage российского Landing нельзя считать доступным на `dreamwheels.pro`.

Поэтому переход:
```
колесамечты.рф
→ dreamwheels.pro
```

должен переносить attribution через CTA URL.

Передавать существующие:

- `utm_source`;
- `utm_medium`;
- `utm_campaign`;
- `utm_content`;
- `utm_term`.

Дополнительно:
```
market=ru
```

`entry=ru_landing` не является частью финального Auth return contract. Если
Landing analytics использует entry context, он остаётся отдельным attribution
событием и не переносится в persisted Auth/payment route.

После входа на `dreamwheels.pro` существующая Analytics / UTM subsystem должна зафиксировать attribution.

Дальнейшая внутренняя навигация не обязана постоянно переносить UTM в URL.

First-touch и last-touch semantics существующей Phase 04 сохраняются.

---

# 8. Market и locale — разные понятия

Не использовать язык как единственный способ определить рынок.

Хранить концептуально отдельно:
```
market:
RU
GLOBAL

locale:
ru-RU
en / en-US
```

`market=ru` из URL является контекстом входа / attribution hint.

Он не должен самостоятельно определять чувствительную бизнес-логику, цены или права пользователя без server-side policy.

---

# 9. Canonical hosts

Для обоих доменов должен существовать только один canonical host.
```
www.колесамечты.рф
→ 301 → колесамечты.рф

www.dreamwheels.pro
→ 301 → dreamwheels.pro
```

HTTPS обязателен.

---

# 10. Auth V1.1 implications

Auth V1.1 должна учитывать:

- `dreamwheels.pro` как production application origin;
- приложение закрыто Auth gate;
- transient `auth_intended_route` для восстановления App route;
- persisted payment `payments.return_to`, изолированный от Auth routing;
- переход из RU Landing;
- сохранение UTM;
- отсутствие cross-domain SSO;
- Telegram как сохранённый канал;
- Email OTP через Supabase для обычного WebApp;
- отсутствие social OAuth в Release 1.

После подключения production domain выполняется отдельная production Auth
wiring для Supabase Email OTP и разрешённых Telegram сценариев. Yandex, VK,
Google, Apple и Microsoft OAuth остаются deferred и не являются частью этого
PR или Release 1 acceptance.

---

# 11. Landing V1 implications

Landing V1 должна:

- существовать отдельно от App UX;
- вести primary CTA в `/app/new`;
- передавать attribution;
- учитывать RU/Global routing;
- не вызывать защищённые App API как часть основного landing experience.

Russian Landing:
```
колесамечты.рф
```

Global Landing:
```
dreamwheels.pro/
```

---

# 12. Infra 01 implications

Generic gateway остаётся единственным frontend → backend transport:
```
dreamwheels.pro/api/backend/**
→ Generic Vercel Gateway
→ production BACKEND_URL/**
```

Domain rollout не должен возвращать namespace-specific proxy handlers.

---

# 13. Production rollout sequence
```
Auth staging ready
↓
Auth V1.1 + 05B.1 staging closeout
↓
PR #163 architecture review/merge
↓
Production domain wiring
↓
DNS / Vercel
↓
production Supabase Email OTP configuration
↓
Landing deployment
↓
App deployment
↓
routing verification
↓
UTM verification
↓
Phase 09 / production smoke
↓
Soft Launch
```

Production не изменяется в рамках принятия этого архитектурного решения.

---

# 14. Release 1 exclusions

Не входят:

- anonymous App usage;
- anonymous drafts;
- cross-domain SSO;
- authenticated App на двух production domains;
- отдельная пользовательская база для RU domain;
- дублирование App functionality внутри Landing.

---

# 15. Acceptance checks before public release

Проверить:

- `колесамечты.рф` открывает RU Landing;
- `dreamwheels.pro` открывает Global Landing;
- `/app/new` требует Auth;
- authenticated user возвращается в исходный `auth_intended_route`;
- RU CTA сохраняет UTM + `market=ru`;
- Global CTA работает без RU-specific state;
- reload защищённых `/app/*` routes работает;
- `/api/backend/**` не перехватывается SPA routing;
- `/t/*` продолжает работать;
- `www` redirects корректны;
- HTTPS корректен;
- staging не индексируется;
- production secrets отсутствуют во frontend;
- Email OTP verification и session restore работают на production configuration;
- UTM сохраняется через Landing → App → Auth → authenticated user.

Отдельно для payment routing проверить:

- web payment callback использует только validated `payments.return_to`;
- Telegram payment callback использует только validated Telegram route;
- SuccessURL/FailURL не выдаются за доказательство оплаты;
- settlement и credits подтверждаются только ResultURL;
- payment callback не может изменить Auth intended route или открыть внешний URL.
