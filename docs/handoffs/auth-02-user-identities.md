# AUTH-02: Canonical User Identities + Telegram Backfill

## Baseline

Работа выполнена от актуального `staging` commit `c8bc30e`:

```text
Merge pull request #141 from NickElixir/codex/phase-07b-g-modification-reselection-demo-fix
```

На момент аудита PR #140 (`AUTH-01`) оставался `OPEN` и не был частью
`staging`. AUTH-02 не дублирует и не изменяет gateway scope AUTH-01.

Последняя migration до AUTH-02 — `0030_results_bucket_20m.sql`; номер `0031`
был свободен.

## Existing model

`users.id` — внутренний canonical owner для jobs, credits/ledger, payments,
assets, vehicle/rim identity, Fitment, feedback и analytics.

До AUTH-02 таблица `users` требовала `telegram_user_id BIGINT UNIQUE NOT NULL`.
`src/users_service.py` разрешал пользователя только через Telegram ID:

```text
telegram_user_id → SELECT users → users.id
```

Текущие auth/API/bot paths продолжают использовать Telegram-specific
контракты. AUTH-02 не меняет `resolve_telegram_auth`, jobs, payments, Fitment,
analytics или WebApp UX.

В legacy `preorders` сохраняется `telegram_user_id` без FK на `users`; текущий
`src/` код не использует эту таблицу как active ownership path. Она намеренно
не мигрируется и остаётся отдельной deferred legacy boundary.

## New model

Добавлена `user_identities`:

```text
users.id
└── user_identities(provider, provider_subject)
```

`(provider, provider_subject)` глобально уникален. `UNIQUE(user_id, provider)`
не добавлен: multi-provider model не требует пока ограничения на количество
identities одного provider для пользователя.

Canonical provider names валидируются на application boundary:

```text
telegram, avito, yandex, vk, sber, tbank, google, apple, microsoft
```

Это allow-list, а не реализация этих providers. OAuth tokens, scopes и
provider credentials в `user_identities` не хранятся.

## Migration

`migrations/0031_auth_identities.sql`:

- создаёт `user_identities` с FK `user_id → users.id ON DELETE CASCADE`;
- создаёт unique key `(provider, provider_subject)` и index по `user_id`;
- включает RLS без public policies, оставляя auth metadata server-only;
- снимает только `NOT NULL` с `users.telegram_user_id`, не удаляя column и не
  меняя legacy uniqueness для non-null values;
- backfill-ит каждую существующую non-null Telegram identity через
  `INSERT ... SELECT ... ON CONFLICT DO NOTHING`;
- не создаёт users, не меняет `users.id` и не копирует business records.

Migration повторно применима: backfill не дублирует identities, а существующая
identity не перепривязывается к другому user.

## Service layer

Добавлены:

- `get_user_by_identity(conn, provider, provider_subject) -> int | None`;
- `ensure_user_identity(conn, provider, provider_subject, username=None) -> int`;
- `IdentityConflictError` для невозможного race/conflict при binding.

`ensure_user()` сохранён как legacy Telegram boundary с прежней сигнатурой.
Теперь он атомарно поддерживает и legacy `users.telegram_user_id`, и Telegram
row в `user_identities`. Для non-Telegram provider создаётся users row с
`telegram_user_id = NULL`.

Создание identity выполняется во вложенной transaction. Перед lookup/create
берётся transaction-scoped PostgreSQL advisory lock по provider + subject;
DB unique constraint остаётся окончательной защитой. При conflict helper не
делает reassignment и не оставляет созданный canonical user.

`users.username` обновляется только Telegram compatibility path и не
используется как universal identity/profile field.

## Invariants

```text
users.id remains canonical
(provider, provider_subject) globally unique
existing Telegram users keep the same users.id
every backfilled Telegram user has a Telegram identity
new Telegram ensure_user creates both legacy and identity rows
new non-Telegram identity has telegram_user_id = NULL
identity ownership is never silently reassigned
business rows are not migrated
```

## Verification queries for staging

После ручного применения migration на staging проверить:

```sql
SELECT count(*)
FROM users
WHERE telegram_user_id IS NOT NULL;

SELECT count(*)
FROM user_identities
WHERE provider = 'telegram';

SELECT u.id, u.telegram_user_id
FROM users u
WHERE u.telegram_user_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM user_identities i
      WHERE i.user_id = u.id
        AND i.provider = 'telegram'
        AND i.provider_subject = u.telegram_user_id::text
  );

SELECT provider, provider_subject, count(*)
FROM user_identities
GROUP BY provider, provider_subject
HAVING count(*) > 1;

SELECT count(*)
FROM user_identities i
LEFT JOIN users u ON u.id = i.user_id
WHERE u.id IS NULL;
```

Ожидается: counts backfill совпадают, missing/duplicates/orphans равны `0`.
Business samples должны подтверждать тот же `users.id` и прежние job/credit/
payment/Fitment ownership; сами business rows AUTH-02 не трогает.

## Compatibility

Не менялись Telegram Mini App, website bearer auth, bot, jobs, payments,
credits, analytics, Fitment, assets, generation, login UX, `webapp/app.js` или
production. API cutover на generic identity будет отдельным AUTH slice.

## Tests

Новый `tests/test_auth_identities.py` покрывает:

- migration contract, idempotence и отсутствие `INSERT INTO users`;
- Telegram backfill, сохранение user IDs, nullable legacy column, uniqueness и
  backend-only RLS при наличии `DATABASE_URL`;
- legacy/new Telegram service paths;
- generic Avito identity с `telegram_user_id = NULL`;
- lookup, repeated call, provider/subject validation и conflict rollback;
- concurrent same-identity creation при наличии `DATABASE_URL`.

На текущем host `DATABASE_URL` не задан, поэтому live database tests отмечены
как skipped; application/service contract tests проходят локально.

## Gate status

```text
USER_IDENTITIES_SCHEMA       = PASS (migration contract; live staging check pending)
TELEGRAM_IDENTITY_BACKFILL  = PASS (migration contract; live staging check pending)
EXISTING_USER_IDS_PRESERVED = PASS
TELEGRAM_USER_ID_NULLABLE   = PASS (migration contract; live staging check pending)
LEGACY_TELEGRAM_USER_CREATION = PASS
NEW_TELEGRAM_IDENTITY_CREATION = PASS
GENERIC_IDENTITY_LOOKUP        = PASS
GENERIC_USER_CREATION          = PASS
IDENTITY_UNIQUENESS            = PASS (DB constraint; live staging check pending)
NO_BUSINESS_DATA_MIGRATION     = PASS
FULL_REGRESSION_SUITE          = PASS
CI                             = PASS (PR #142 lint-and-test)
AUTH_02_STAGING_MIGRATION      = PENDING (manual Supabase SQL Editor rollout)
AUTH_IDENTITY_MODEL_READY      = YES (repository foundation; staging rollout pending)
```

## Deferred

Следующие этапы не входят в AUTH-02:

- AUTH-03 `AuthPrincipal`;
- AUTH-04 generic user_id API cutover;
- AUTH-05 sessions + CSRF;
- AUTH-06 OAuth provider framework;
- AUTH-07 Avito/Yandex;
- AUTH-08 account linking;
- migration/cleanup legacy `preorders.telegram_user_id`;
- login UI, cross-domain SSO и production rollout.
