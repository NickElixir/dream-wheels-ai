# Release 1 — дизайн-приёмка Landing + WebApp

Дата: 2026-11-05. Итог: состав релиза зафиксирован; локальная приёмка Landing/Catalog и доступных гостевых WebApp экранов выполнена. Полную state-based приёмку приложения нельзя закрыть до проверки авторизованных состояний в изолированном staging. Это не release approval. Пользователь отдельно подтвердил: сейчас только локальная приёмка; авторизованные экраны — ответственность Integration Track. Локальный объём этапа 2 закрыт, staging-проверка передана дальше.

## Источники и среда

- Landing: текущий dirty worktree `landing-i18n-foundation`, HEAD `50a1196d397f96db7eea7d4ed0994f6d5c27672a`; localhost:4321.
- WebApp: readonly snapshot staging `be73ef05818cc197b1ae6f550e140437bdb125d2` из прежнего Integration Audit; localhost:4331 со SPA fallback. Remote main/staging повторно прочитаны через GitHub API 2026-11-05: SHA не изменились. Исходники runtime не редактировались.
- Старый WebApp в Landing worktree не использован для финальных визуальных выводов.
- Capture: встроенный IAB через cua_repl. Screenshots + DOM, а не косвенное исследование. RU/EN Create проверены через временную эмуляцию языка браузера; продуктовые настройки языка не менялись.
- Viewports 360/390/768/1440; высота 844/900/1000 по сценарию. Никаких production auth, OTP, генераций, платежей, миграций, merge или deploy.

## Шаги приёмки

| Шаг | Экран / действие | Состояние / доказательство |
| --- | --- | --- |
| 1 | RU/EN Landing: Hero, Two Questions, How It Works, BeforeAfter, FAQ, Footer | Актуальные screenshots на четырёх ширинах; horizontal scrollWidth равен заданной ширине. Полная RU desktop композиция проверена отдельно. Повторные снимки Hero после загрузки заменили ранние кадры с ещё не появившимся изображением |
| 2 | RU/EN Catalog | Все 6 дисков; 2×3 до 900 px и один ряд при 1440. Названия, selected state, Garage, CTA, B2B читаемы. Desktop сохранился |
| 3 | Выбор шестого диска → раскрытие характеристик → мобильное меню | active «СКАД Манчестер», specs open=true, отдельные плитки SKU; меню раскрывается. `16-catalog-selection-specs-menu.jpg` |
| 4 | Catalog CTA | Открывается preview dialog с выбранным диском и честной недоступностью интеграции; возврат в каталог работает. `04-catalog-cta-placeholder.jpg`. Это P0 работа Integration Track до выпуска, не готовый сквозной путь |
| 5 | B2B перед вводом | Найдено: о демонстрационности сообщалось только после заполнения. Исправлено: видимая RU/EN подпись перед полями и aria-describedby. Ничего не отправляется; CTA не менялся |
| 6 | Landing accessibility interactions | После появления/гидратации FAQ раскрывается: aria-expanded=true. BeforeAfter с фокусом отвечает на ArrowRight: 50→52. Фокус, доступные названия, семантика headings/summary проверены точечно, не полный WCAG audit |
| 7 | WebApp guest Home | RU desktop и EN mobile: ясные CTA и balance sign-in. `09-app-home-desktop.jpg`, `14-app-home-en-mobile.jpg` |
| 8 | WebApp Create | RU/EN на всех четырёх ширинах, без horizontal overflow. Mobile stacked upload, desktop две колонки. Кнопка создания disabled без фото; после прокрутки не перекрывается нижней навигацией. `app-create-*.jpg`, `13-create-mobile-bottom.jpg` |
| 9 | Вход / Auth Gate | Диалог открывается, email получает фокус, закрытие возвращает к Create. History гостя защищена gate «Войдите в аккаунт». `07-app-auth-mobile.jpg`, `08-app-history-mobile.jpg`. Код не запрашивался и не вводился |
| 10 | Result на существующем guest demo | RU desktop/mobile и EN mobile: comparison, действия download/share/check/another version и feedback видимы. `10/11/15-app-demo-result-*.jpg`. Это визуальная проверка demo, не доказательство render success |
| 11 | Result → Fitment на guest demo | Открываются источники автомобиля/диска, форма уточнения и disabled итоговый check до готовности. `12-app-demo-fitment-mobile.jpg`. Реальный provider/verdict не запускался |
| 12 | История аккаунта, processing, ошибки, после OTP | НЕ ПРОВЕРЕНО: нет разрешённой изолированной auth/data/render среды и вошедшего тестового пользователя. Демо и исходники не подменяют эти состояния |

## Замечания

### Исправлено — B2B выглядит как рабочая отправка до заполнения

Источник: шаг 5, первоначальный `03-catalog-ru-mobile-before.jpg`. В `MiniCatalog.tsx` добавлен notice перед полями, форма связана с ним через aria-describedby; один CSS rule задаёт читаемый размер. После изменения RU/EN notice проверен DOM и screenshots на четырёх ширинах. Backend/CTA handlers не менялись.

### P0 до выпуска — отсутствует сквозной переход из каталога

Источник: шаг 4. Нужны implementation handoff/auth/asset adapter; это этап 3, не повод блокировать начало этапа 3. Нельзя принять preview dialog за рабочую генерацию.

### P1 до общей приёмки — авторизованные состояния ещё не аттестованы

Источник: шаги 9/12. Изолированный staging и тестовый аккаунт нужны для реальных History, protected images, processing/error и восстановления выбора после входа. В локальном auth зафиксирован Turnstile 110200; официальный смысл — domain not authorized, а не ошибка формы Landing: https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/ . Проверить разрешённый test hostname либо штатную тестовую конфигурацию, не отключать защиту и не расширять production allowlist автоматически. Доступный backend локально не запускался. Telegram «Подготавливаем вход» в локальном диалоге не выдан за подтверждённый production-дефект.

### P2 — гостевой пример обозначен как собственный последний результат

Источник: шаги 7/10. На Home guest demo находится под «Последний результат» / “Latest result”; Result также не показывает явную метку demo. Рекомендация владельцу WebApp: «Пример результата» / “Example result” или существующая demo-маркировка. Это не блокер начала интеграции. Runtime в старом Landing worktree или readonly архиве не правился.

### Согласованность визуальных источников

Существующая vnext палитра dark/silver, IBM Plex и белые CTA сочетаются с Catalog; лаймовый Hero сохранён как утверждённый акцент. Исторический docs/ui-design-code.md говорит о lime cabinet, но current vnext tokens — silver. Нельзя автоматически перекрашивать актуальное приложение по этому старому описанию. При новых визуальных изменениях подтвердить authority действующих vnext patterns.

## Проверки после изменения

- `npm run check`: 35 файлов, 0 errors/warnings/hints.
- `npm test`: 14/14.
- `npm run build`: 7 страниц.
- `git diff --check`: PASS.
- Landing/Catalog: 16 комбинаций route×locale×width, без горизонтального overflow. Create: 8 locale×width, без горизонтального overflow.
- На страницах Landing runtime errors/overlay не выявлены. Общая история browser logs содержит локальные auth/Turnstile warnings; не утверждаем «всё приложение без ошибок».
- Menu/specs/selection/dialog/keyboard comparison/FAQ — interaction proof в текущем прогоне.
- 30 Garage не проходили повторную художественную экспертизу; данные не менялись. Предыдущие 120 переключений — отдельный прошлый отчёт, не выданы за текущий прогон.
- Live legal/cache/production locale-switch в этом прогоне не повторялись; сквозная проверка — release gate.

## Изменённые файлы и Git

В этом прогоне: MiniCatalog.tsx (notice + связь формы), catalog-data.css (один notice style), b2b-lead-capture-proposal.md (deferred), landing-v1-local-acceptance.md (уточнение unknown), новые release-1-scope.md, release-1-design-audit.md, integration-track-release-1-handoff.md. В каталоге и runtime приложения нет новых изменений. Исходные dirty modifications/untracked assets сохранены; .DS_Store и sources/ не тронуты. Commit/merge/deploy — NO.

## Evidence

Снимки и JSON текущего прогона: `/Users/nikolai/.codex/.chatgpt-projects/g-p-697289e1bcf48191bf9363551cb3983c/outputs/landing-release-1-design-audit-2026-11-05/`. Индекс и fingerprints рядом. Ранние startup/loading и обрезанные desktop screenshots не являются доказательством дефекта; заменены корректными либо помечены как предварительные.

## Следующий шаг

Начинать этап 3 можно с выбора базы/snapshot и фиксации минимального контракта. Детали в `integration-track-release-1-handoff.md`. B2B и unknown не блокируют. Полную дизайн-приёмку закрыть после authenticated staging state-based QA; текущий документ не обещает полного закрытия этого gate.
