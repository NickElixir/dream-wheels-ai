# Landing V1 — локальная приёмка

Дата: 2026-11-04. Worktree: landing-i18n-foundation. Deploy / merge / backend: не выполнялись.

## Собственные изменения

- `landing/src/styles/catalog-data.css`: до 900 px сетка дисков 2×3 вместо горизонтальной ленты. Desktop-правила сохранены.
- `landing/src/components/MiniCatalog.tsx`: responsive sizes для плиток; srcset/sizes для двух 74 px превью, исключающие лишний 640 px cutout. Обработчики CTA, B2B и catalog data не изменены.
- `landing/src/components/LandingPage.astro`: BeforeAfter и FAQ гидратируются при появлении на экране.
- `landing/src/components/TwoQuestions.tsx`: ссылки на два новых lossless WebP.
- Новые WebP в `landing/public/assets/two-questions/`: 8 945 644 → 5 606 654 bytes суммарно (−37,3%). Сравнение декодированных RGBA буферов подтвердило совпадение каждого пикселя. Оригиналы сохранены.
- `docs/landing/b2b-lead-capture-proposal.md`: решения и предлагаемый контракт для будущего B2B. Заглушка сохранена.

## Performance baseline → после

Статическая Astro preview-сборка, localhost:4322. Headless Chrome / Playwright, viewport 390×844, DPR 1; CPU ×4; latency 150 ms; downstream 200 000 B/s, upstream 93 750 B/s. Три новых browser context на маршрут, окно наблюдения 12 секунд после DOMContentLoaded, без scroll/input; медианы LCP. Это ограниченный локальный cold-context тест, не Lighthouse score и не полевые показатели. Внешние fonts и состояние хоста могут влиять на результат.

| Метрика | До | После |
| --- | ---: | ---: |
| Landing LCP | 828 ms | 616 ms |
| Catalog LCP | 4888 ms | 860 ms |
| Landing CLS | 0,00019 | 0,00019 |
| Catalog CLS | 0,00306 | 0,00306 |
| Landing загруженный JS, без сжатия | 17 685 B | 7 939 B |
| Catalog загруженный JS, без сжатия | 23 665 B | 23 684 B |

Все JS chunks сборки вместе: менее 30 KB gzip, включая отложенные chunks и обе страницы. Hero уже имеет AVIF/WebP, responsive sources, eager/high priority; изменения не нужны. Garage уже имеет WebP 640/960/1400; DOM содержит только активную комбинацию, остальные 29 не загружаются заранее. CSS и размеры изображений сохраняют место; новых layout shifts не выявлено. Шрифты загружаются через display=swap.

Cache policy production не проверена: необходимы фактические заголовки static assets на Timeweb через Deno gateway, особенно /_astro/* и versioned /assets/catalog/*. Нужна политика revalidation для неизменяемых по URL assets, чтобы длительный cache не закреплял старые замены. Infrastructure не менялась.

## Проверки

- `npm run check`: 35 файлов, 0 errors/warnings/hints.
- `npm test`: 14/14.
- `npm run build`: 7 статических страниц.
- `git diff --check`: без ошибок.
- Mobile grid: 360/390/768 px — 3 ряда, 2 столбца, 6 карточек; 1440 px — 1 ряд. Нет горизонтального overflow; выбор шестого диска переключает aria-pressed и изображение.
- RU/EN Landing/Catalog: страницы не пустые, правильный lang/title/h1, без framework overlay, page errors и HTTP ошибок локальных ресурсов.
- 30 Garage-комбинаций × 2 locale × 2 viewport = 120 переключений; изображения декодируются, selected state единственный. Повторная художественная/fitment экспертиза не проводилась.
- CTA: открывает честный preview dialog, Escape закрывает.
- B2B: пустая форма блокируется браузером; заполненная открывает сообщение о недоступной отправке; ложного успеха нет.
- Характеристики раскрываются; мобильное меню доступно.
- Locale switch: проверены ссылки на https://dreamwheels.pro и https://колесамечты.рф с сохранением маршрута. При включённом domainI18nEnabled локальный switch ведёт на production; внешний переход не выполнялся. RU/EN страницы отдельно проверены локально. Сквозной switch — остающийся инфраструктурный пункт приёмки.
- Все четыре legal URL из footer отвечают HTTP 200 через curl с обычной проверкой TLS. Проверка текста legal документов не входила в задачу.
- A11y: проверены названия полей/кнопок, aria-pressed, раскрытие FAQ, управление BeforeAfter стрелками, закрытие dialog Escape, focus-visible в каталоге. Это targeted smoke, не полный WCAG audit.

## Оставшиеся решения

1. B2B: назначить получателя, хранение/уведомление, Telegram, антиспам и текст согласия (см. proposal).
2. Решение пользователя: `compatibility.status = unknown` сохраняется. На лендинге параметры показанных комбинаций проверены автором вручную; приложение позволяет выполнить независимую проверку или выбрать другую машину. Ручная проверка не становится verified Fitment Engine. Согласование новой модели статусов не требуется и не блокирует интеграцию.
3. Проверить production cache headers и сквозной locale switch отдельно, без предположений о gateway.

## Git status

До начала уже были изменены HowItWorks.astro, MiniCatalog.tsx, SiteHeader.astro, catalog.ts, ru/en/types, global.css, catalog.test.ts; catalog assets и catalog-data.css были untracked. Эти изменения сохранены. Новые собственные tracked modifications: LandingPage.astro, TwoQuestions.tsx; собственные добавления: два WebP и docs/landing/. MiniCatalog.tsx и untracked catalog-data.css дополнены минимальными изменениями поверх пользовательского состояния. Существующие .DS_Store не затронуты. Коммиты, reset, merge и deploy не выполнялись.

## Evidence

Скриншоты вне репозитория: `/tmp/dw-grid-360.png`, `/tmp/dw-grid-390.png`, `/tmp/dw-grid-768.png`, `/tmp/dw-grid-1440.png`, `/tmp/dw-two-questions.png`. Замеры: `/tmp/dw-perf-before.json`, `/tmp/dw-perf-after.json`. Browser plugin not available; использован установленный Playwright с локальным Chrome, без установки зависимостей.
