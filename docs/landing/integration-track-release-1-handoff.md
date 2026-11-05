# Integration Track — Release 1 handoff

> Обновление 2026-11-05: пользователь отложил интеграцию приложения. Текущий этап — RU/EN дизайн и подготовка статических сборок; этот документ сохраняет контекст будущего интеграционного этапа. Актуальная локальная приёмка: ru-en-sync-acceptance.md.

Дата: 2026-11-05. Для чата «Integrate Landing with WebApp». Это материал для передачи; сообщение автоматически в чат не отправлялось.

## Контекст

Состав релиза зафиксирован в `release-1-scope.md`. B2B/Яндекс Формы/HubSpot отложены. Пользователь подтвердил локальную приёмку в Landing Track; авторизованные экраны и проверка после входа передаются Integration Track. `unknown` оставляем: автор вручную проверил примеры на лендинге, сервис выполняет независимую проверку; нет задачи менять модель статусов.

Дизайн Landing/Catalog проверен RU/EN на 360/390/768/1440 px. Сетка 2×3 сохранена. В B2B добавлено явное RU/EN уведомление до полей. Внешний вид CTA и данные каталога не менялись в этой приёмке.

Существующий аудит Integration Track: `/Users/nikolai/.codex/.chatgpt-projects/g-p-697289e1bcf48191bf9363551cb3983c/outputs/landing-webapp-integration-audit-2026-11-04/INTEGRATION-AUDIT-AND-CONTRACT.md`. Не начинать повторный архитектурный аудит с нуля; проверить дельту и продолжить его проект контракта.

## Что блокирует реализацию, а что — только приёмку

| Пункт | До начала реализации | До включения / выпуска |
| --- | --- | --- |
| База и snapshot | Выбрать актуальную main/staging; определить владельца и воспроизводимый источник catalog/assets | Включить весь untracked каталог в релизный артефакт, зафиксировать version/checksum |
| Handoff design vs SKU | Зафиксировать минимальный design-level контракт, без первого SKU | Проверить 30 item mappings, принадлежность optional SKU и trusted wheel bytes |
| Origins и locale | Зафиксировать RU/global app origins и правило locale | Проверить фактические переходы и auth return на обеих площадках |
| Auth persistence / asset adapter / registration | Это работа этапа 3, не внешние предварительные блокеры | Нужны реализация и успешные тесты |
| Изолированный staging и тестовый аккаунт | Не мешают писать код и unit-тесты | Обязательны для authenticated E2E; ru-test с production API не считать изолированной средой |
| Дизайн History/processing/error | Можно начать существующий контракт без редизайна | Нужна повторная state-based QA после интеграции |
| B2B, unknown | Не блокируют | Не блокируют |

## Конкретный минимальный handoff

Продолжить предложенный Integration Track envelope: `handoff_v`, `catalog_version`, `catalog_item_id = ShowcaseVariant.id`, `source=landing`, `entry_point`, `landing_locale`, разрешённые UTM; optional `sku_id` только при явном выборе. Точные названия и TTL зафиксировать в общем контракте до wiring.

В текущем UI SKU не выбирается; `skuIds` — список исполнений, не готовый выбор. Поэтому default — design-level visual handoff, `sku_id=null`; dropdown и новый экран выбора не добавлять. Не брать первый SKU даже при единственном отображаемом design. Технические параметры не объявлять пользовательским подтверждением.

Showcase vehicle — контекст примера, не автомобиль пользователя. Garage image — итоговая сцена, не wheel input. Backend должен разрешать trusted reference по versioned manifest; произвольный URL/путь из query не принимать.

## Порядок реализации

1. Зафиксировать base SHA, versioned catalog snapshot и ownership общих файлов. Генерировать manifest из catalog.ts; не поддерживать вручную вторую таблицу.
2. Захватывать allowlisted handoff до очистки query / `replaceState`. Сохранять его до/после Auth Gate, refresh и отмены входа; не затирать ручные изменения старым async response.
3. Дополнить существующий Create и upload adapter. Своя машина + согласие остаются обязательными. Сохранять обычный upload, ownership, TTL и idempotency. Никаких jobs до явного submit.
4. Зафиксировать канонические origins: по вашему аудиту global `https://app.dreamwheels.pro`, RU `https://app.dream-wheels.ru`. Helper Landing сейчас выбирает landing origin `dreamwheels.pro` либо RU same-origin — это не доказанный app target. Изменить только по подтверждённой карте маршрутов, без DNS/gateway реконструкции.
5. Поддержать `landing_locale`: текущий detectLocale приложения использует Telegram/browser, поэтому один лишь EN/RU URL не гарантирует нужный язык после входа.
6. Переиспользовать штатный auth: RU Email OTP; global доступные штатные методы. Не включать Telegram на RU автоматически. Без open redirect / широкого query allowlist.
7. Каноническую новую регистрацию фиксировать серверно, ровно один раз. Повторный вход, linking, выдача стартовых кредитов и auth_completed не являются новой регистрацией. Миграцию подготовить отдельно, без применения production.
8. Проверить E2E из прежнего аудита на изолированном staging; затем повторить UI QA заполненного Create, входа/отмены, processing/error, Result/History.

## UI замечания и ограничения проверки

Гостевые Home/Create/Auth, демонстрационный Result и Fitment визуально проверены локально на актуальном staging snapshot. Реальная History, protected images, processing/error и состояние после OTP не аттестованы. Это не доказательство бага и не замена E2E.

Неблокирующее для начала интеграции замечание: гостевой demo на Home подписан «Последний результат» / “Latest result”, а в Result нет явной отметки демо. Рассмотреть подпись «Пример результата» / “Example result”, не меняя доменное состояние. Не маскировать demo как реальную завершённую генерацию для теста.

Сохранить текущие vnext компоненты и серебристые CTA; не устраивать редизайн приложения по устаревшему webapp/ Landing worktree. Общий docs/ui-design-code.md содержит историческое lime-описание, тогда как vnext tokens/current UI используют silver; уточнить authority при изменениях дизайна, не перекрашивать runtime в рамках интеграции.

## Общие файлы

Landing worktree: `/Users/nikolai/Documents/GitHub/dream-wheels-ai/worktrees/landing-i18n-foundation`, branch `feature/landing-two-domain-routing`. Пользовательские изменения не сбрасывать.

- catalog.ts — источник истины, read source для manifest; данные не менять без владельца Landing.
- MiniCatalog.tsx — только wiring CTA/handoff; не менять grid, specs и B2B.
- attribution.ts — фиксированные target origins + разрешённый context по контракту.
- Auth / WebApp / backend / analytics — Integration Track.

Ожидаемый ответ от Integration Track: выбранная база/ветка, versioned контракт и manifest, точные origins/locale rules, список файлов/миграций, среда E2E и результаты тестов, оставшиеся release gates. Merge/deploy/production writes пока NO.
