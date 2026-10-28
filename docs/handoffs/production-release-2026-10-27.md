# Production release candidate — 27 октября 2026

## Основа и разрешение истории

- Ветка: `feature/production-release-2026-10-27`.
- Staging: `89690692378901b3539d77ebeb77df416483ff43`.
- Main: `c5a8524386182d540d77c636acc00f3941a52431`.
- Main объединён merge-коммитом в отдельную ветку; общие ветки не переписывались.
- Решения основаны на целевом аудите main-only изменений от 26 октября, а не на автоматическом предпочтении одной стороны для любых будущих конфликтов.

Все 15 текущих конфликтов разобраны: `.env.example`, `src/config.py`, `src/bot.py`,
`src/credits_service.py`, `src/payments_service.py`, четыре профильных теста,
`webapp/app.js`, `webapp/index.html`, `webapp/style.css`, `webapp/t/index.html`,
`docs/product-roadmap.md`, `migrations/README.md`.

Сохранены staging-реализации конфигурации, выдачи/списания/возврата кредитов,
Telegram-команд, VNext UI, gateway routing и их тестов. Исторические standalone
`/t/index.html` и старый Wallet не восстановлены: `/t` и `/t/` используют текущую
оболочку через rewrites. Существующие LICENSE, README, 0016 и остальные совпадающие
main-материалы сохранены. Новые правила текущего roadmap и порядок миграций имеют
приоритет над старыми планами main; правило «сначала проверенная схема, затем API»
остаётся обязательным.

Из main возвращены два отсутствовавших в staging документа без изменения содержания
(удалены trailing spaces по текущим проверкам репозитория):

- `docs/business/market-research/autostat-russia-auto-market-2026.md`
- `docs/marketing/dream-wheels-copy-bank.md`

Два отличия аудита разрешены отдельно:

1. Продолжение старого pending invoice не возвращается по согласованному решению.
   Текущий lifecycle нового счёта, timeout/cancelled и authoritative callbacks сохранён.
2. Historical starter-grant fallback восстановлен PR #285, без начисления денег/кредитов.

PR #286 добавил бессрочные пакеты только для переноса фактических pre-FIFO остатков.
Новые покупки, starter grants и refund-пакеты сохраняют сроки. В staging применена
только 0042: остатки/ledger не менялись, offline cutover не запускался.

Runtime, миграции, workflow и тесты кандидата совпадают с указанным staging.
Дополнения кандидата относительно staging — два main-документа выше и этот handoff.

## Данные и миграционная репетиция

Read-only production-сверка 26 октября: 13 кредитных аккаунтов, 12 положительных,
сумма 28; 30 ledger-записей; 3 pending-платежа, оплаченных нет. Это исторический
снимок, а не разрешение использовать те же суммы при будущем rollout.

Первоначальный SQL 0024 обнуляет старые остатки по TTL. Изолированная репетиция
нового transactional cutover на обезличенных финансовых полях и снимке production
DDL сохранила каждый остаток: 28 → 28; reserve → 27; повтор → 27; refund → 28.
Она не клонировала реальные фотографии, контакты, Storage, Redis, исходные
policies/grants или фактическую нагрузку. Это не full backup/restore.

Перед выпуском повторить сверку и репетицию окончательного SHA, включая
`0042_permanent_legacy_credit_packages.sql` и точную версию
`scripts/migrate_legacy_credit_balances.py`. Порядок и ограничения описаны в
`migrations/README.md`. Нельзя применять 0024 отдельно перед снятием снимка
остатков; нельзя запускать pre-FIFO cutover в уже работающем staging FIFO.

## Незакрытые production gates

- Независимое ревью release diff и зелёный CI окончательного merge SHA.
- Проверяемая production backup/restore процедура: текущая локальная репетиция её не заменяет.
- Актуальная схема, migration journal, constraints, RLS/policies/grants и Storage;
  global Storage limit и results bucket должны поддерживать новые файлы.
- Обязательные production env/config, fixed gateway BACKEND_URL, auth/provider URLs,
  Telegram, флаги распознавания/URL-resolver/fitment/Wan и платёжных таймаутов.
- Сверка 8 исторических jobs queued/processing (март–апрель, not_charged) с очередью;
  не повторять и не завершать их автоматически. Нулевое число reserved jobs
  необходимо проверить заново при остановке writers.
- Отдельно принять ограничения Avito и неустановленную причину исторической
  неудачи распознавания автомобиля №48. Успех ручного каталога не закрывает VLM.
- Остановить все writers на cutover, включая API, bot, worker, callbacks,
  account merges и периодические задачи; дождаться активных транзакций.
- Согласовать backend → frontend rollout. Текущий merge main запускает публикации;
  наличие зелёного CI само по себе не обеспечивает нужный порядок deploy.
- Записать совместимый rollback. Старый backend не поддерживает permanent packages;
  простой возврат старой версии после cutover может неверно пересчитать баланс.
- После cutover: поаккаунтная сверка остатков, packages, ledger, jobs UUID/номеров,
  identities; затем backend health/SHA, frontend SHA и разрешённый smoke.

## Граница разрешения

Эта ветка и Draft PR готовят материал к проверке. Они не разрешают merge в main,
production SQL, deploy, платежи, генерации или изменение живых данных.
Перед таким действием требуется отдельное разрешение пользователя на конкретный
проверенный план. Финальный release PR должен использовать merge commit, не squash,
чтобы сохранить уже согласованную историю main и staging.
