# Dream Wheels AI — VNext full-screen QA audit and formal UI freeze

## Formal freeze — COMPLETE (25 сентября 2026)

**FROZEN / FORMAL FREEZE COMPLETE.** Freeze commit: `7f35d55416bb2688c50b84c4b62e116dc0cc14ec` (`docs(vnext): freeze application UI contract`). The [Design Code VNext](dream-wheels-application-design-code-vnext-v0.1.md) is the authoritative visual/UI target for new VNext implementation; the [reconciled HTML](../references/application-vnext-state-coverage-prototype-v3.html) is the canonical interactive visual reference. The frozen V1 Design Code remains the legacy/current-runtime reference until migration.

The formal approval covers the static UI/design contract only. Its evidence is the closing reconciliation **PASS: 128 checks, 0 errors**, at desktop `1440×1000` and mobile `390×844`, with no open HIGH/BLOCKER in prototype scope, followed by closing consistency smoke PASS. The frozen HTML is the current branch artifact at source commit `1f90851`: relative to `472c21b`, it contains only the user-requested removal of one parser-help sentence; no layout or visual change was made for freeze. Historical BLOCKED/HIGH assessments below remain explicitly superseded.

Post-freeze documentation smoke on `1440×1000` and `390×844` also passed: the prototype loads without console errors, broken images or horizontal overflow; nine main screens, four Fitment verdicts, Create/Processing assets, Documents labels, Result slider and Help navigation remain intact. The full 128-check suite was not repeated because the canonical HTML was not changed for formal freeze.

This freeze does **not** certify production runtime, frontend/backend integration, parser API, Fitment backend execution, render provider, auth runtime, Robokassa/payment runtime, network failure handling, Safari iOS, Chrome Android, Telegram WebView, physical safe areas, software keyboard, screen readers or real-device performance. Those require subsequent implementation, staging and device QA; they are not blockers to this static UI-contract freeze. No merge or deploy was performed.

## Closing reconciliation — PASS (25 сентября 2026)

База интеграции — только closing-QA PASS V3, commit `7d6d66b`. Старый V4 использован исключительно как источник трёх новых экранов и переходов; он не стал базой итогового HTML. В [актуальном прототипе](../references/application-vnext-state-coverage-prototype-v3.html) добавлены Support, Photo Guide, Documents, desktop-навигация и mobile `Помощь → Support`; из Support есть явный переход в Documents. Экран `Ещё` не возвращён. Текущий статус и правила визуальной системы записаны в [Design Code VNext](dream-wheels-application-design-code-vnext-v0.1.md). На момент первого closing reconciliation Photo Guide использовал фотографии `photo-guide-car.jpg` и `photo-guide-car-bad.jpg` из `webapp/assets/`.

25 сентября фотографии Photo Guide заменены на исходники пользователя `skolkovo_cars/2026-05-14 13-54-22.JPG` и `Ivan's Dataset/cars/C4.jpg` с размытыми номерами. В прототипе используются только новые `photo-guide-good-redacted.jpg` и `photo-guide-bad-redacted.jpg`; файлы WebApp не менялись. Повторная проверка в Chrome через Playwright на `1440×1000` и `390×844`: изображения загружаются, переходы в Photo Guide работают, ошибок консоли и горизонтального переполнения нет.

Локальный smoke QA: Chrome через Playwright, `1440×1000` и `390×844`, **128 проверок — PASS, 0 ошибок**. Подтверждены загрузка и отображение экранов, desktop/mobile переходы, работа Support → Documents / Photo Guide, действующие ссылки на четыре RU legal-документа, отсутствие ошибок консоли, битых изображений и горизонтального overflow. Сохранены Create с исходными demo-фото автомобиля и диска, прозрачный диск только в Processing, четыре Fitment verdict с доступным render CTA, компактный mobile History, mobile touch targets ≥44 px, Balance packages 2×2 и отсутствие status-dot CSS. Result slider реагирует в обе стороны; слева `РЕЗУЛЬТАТ` соответствует `demo-render-zeekr-xtrike.jpg`, справа `ОРИГИНАЛ` соответствует `demo-vehicle-zeekr.jpg`. На mobile CTA остаётся после slider.

В первом smoke обнаружены и исправлены: прозрачный диск в Create вместо исходного demo asset и запрос отсутствующего favicon. Повторный прогон — PASS. На момент этого closing reconciliation результат был **READY FOR FORMAL FREEZE; открытых HIGH/BLOCKER для статического прототипа не осталось**. Последующее формальное approval и действующий статус записаны в разделе Formal freeze выше. Это QA статического прототипа, **не проверка runtime, API, платежей или реальных устройств**. Merge/deploy не выполнялись.

Исторический scope первоначального pre-freeze прохода: 24 сентября 2026, PR #196, commit `1b93aa0`. Его выводы ниже сохранены как superseded baseline, а не как текущий статус. Frozen V1 и runtime не изменялись.

## Closing pre-freeze pass — historical QA evidence

**Итог повторного QA прототипа: PASS; открытых HIGH/BLOCKER из исходного аудита не осталось.** Сам этот проход ещё не устанавливал formal freeze; отдельное approval отражено в разделе Formal freeze выше. Runtime и реальные устройства в этот прогон не входили. Повторена прежняя матрица 14 основных экранов и 5 review-state сценариев на 1440×1000 и 390×844, плюс Dashboard/стресс-геометрия на 1680×1000. Все 38 full-page captures обновлены после правок; отдельные четыре Fitment fixture сняты на каждой ширине.

| Pre-freeze item | Проверка | Результат |
|---|---|---|
| IBM Plex Sans | локальные Cyrillic/Latin WOFF2 загружены, `document.fonts.check` = true | PASS |
| 4 Fitment verdicts | compatible / conditional / unknown / incompatible; во всех доступен render CTA, без horizontal overflow | PASS |
| Compact mobile History | 50 rows: один ряд ~167 px вместо ~377 px, документ ~9.3k px вместо ~20k px, overflow 0 | PASS |
| Mobile touch areas | product controls на семи экранах ≥44 px, включая text actions и feedback | PASS |
| Status dots | CSS pseudo-dot удалён у status/inline-state; состояния различаются текстом и цветом | PASS |
| Create save/parser | изменение vehicle/wheel видно в сводке; успешная ссылка отображается, error сохраняет прежнюю ссылку | PASS |
| `Ещё` / navigation | нерабочий mobile пункт удалён; desktop «Поддержка» и «Документы» получили реальные адреса | PASS |
| Create/Processing assets | Create: существующие фото ZEEKR и диск; Processing: подготовленный прозрачный dark-stage wheel | PASS |
| Result CTA mobile | CTA расположен после сравнения и до оценки; slider keyboard/pointer не затронут | PASS |
| Balance 390 px | четыре пакета занимают две колонки и две строки | PASS |

Повторные проверки: HTTP 200; не пустая страница; ошибок JS-консоли/framework overlay нет; все изображения загружены; `scrollWidth − clientWidth = 0` во всех 38 состояниях; стресс-тест длинных названий/URL и 50 History rows — без horizontal overflow. В режиме `prefers-reduced-motion: reduce` spinner статичен. Сохранены [desktop Fitment fixtures](../references/vnext-qa/desktop/fitment-compatible-desktop.png) и [mobile Fitment fixtures](../references/vnext-qa/mobile-390/fitment-compatible-390.png), а также обновлённые [Create](../references/vnext-qa/mobile-390/create-390.png), [History](../references/vnext-qa/mobile-390/history-390.png), [Processing](../references/vnext-qa/mobile-390/processing-390.png), [Result](../references/vnext-qa/mobile-390/result-390.png), [Balance](../references/vnext-qa/mobile-390/wallet-390.png).

Ограничения: Fitment values намеренно качественные и явно помечены как review-fixture, не как расчёт по конкретному автомобилю. Create parser в статическом HTML не обращается к сервису; success подтверждает сохранение ссылки, а не новые технические характеристики. Прозрачный wheel — подготовленная review-производная от исходного demo asset, поэтому точное соответствие продуктовой фотографии следует отдельно подтвердить до использования в runtime. Реальные iOS/Android, screen reader, network/API и payment flow не проверялись.

## Closing consistency smoke — PASS (25 сентября 2026)

Повторный короткий smoke в Chrome через Playwright на `1440×1000` и `390×844` прошёл без ошибок. На каждой ширине проверены девять экранов (Dashboard, Create, Fitment, History, Balance, Result, Support, Photo Guide, Documents), переходы в Support → Photo Guide / Documents и mobile `Помощь → Support`, отсутствие ошибок консоли, битых изображений и горизонтального overflow. Все четыре строки Documents кликабельны целиком и показывают только «Открыть» без стрелок. Result slider изменяет позицию; слева отображается результат, справа — оригинал, подписи соответствуют изображениям. Прототип не изменён визуально или по содержимому. Этот сокращённый smoke дополняет, но не заменяет полный closing reconciliation pass на 128 проверок.

## Initial QA baseline (before closing pass; superseded)

> Архив исходного аудита. Все оценки `BLOCKED`, список blockers и вывод «не готово» ниже относятся **только к состоянию до closing pass**. Текущий авторитетный вывод — closing reconciliation PASS (128 проверок, 0 ошибок) выше.

### Executive summary — superseded

**Исторический итог до closing pass: BLOCKED для `VNEXT_UI_CONTRACT = FROZEN`.** Система уже была согласована по базовой композиции: desktop и 390 px не имели горизонтального overflow, ключевые реальные изображения загружались, результат и Fitment сохраняли различие визуальной примерки и технической совместимости, основные review-состояния открывались. На тот момент прототип ещё не позволял утвердить типографику и все Fitment-сценарии; мобильные History и touch targets требовали коррекции. Эти замечания закрыты в текущем PASS выше.

Проверка выполнялась через локальный HTTP-сервер из корня репозитория, а не `file://`: `http://127.0.0.1:8765/docs/references/application-vnext-state-coverage-prototype-v3.html`. Browser plugin в этой сессии недоступен; использован Playwright Chromium. Viewports: 1440×1000, 390×844; дополнительный обзор Dashboard на 1680×1000. Скриншоты без review-controller; его состояния переключались отдельно. Это QA прототипа, не QA production runtime или реального устройства.

Проверки: страница не пустая, identity/title корректны, framework overlay нет, ошибок JS-консоли нет. Все три demo asset отдаются с HTTP 200 и имеют ненулевой `naturalWidth` после завершения загрузки. Во всех проверенных состояниях `scrollWidth − clientWidth = 0`; стрессовые длинные названия/URL и 50 History rows также не дали горизонтального overflow. Быстрое переключение экранов может поймать изображение до `load`, поэтому asset-вывод сделан только после ожидания загрузки.

### Screen matrix — superseded

`✓` — подтверждено; `△` — выявлена проблема или недостаточное покрытие. Ссылки ведут на clean full-page screenshots.

| Screen | Desktop | 390 px | UX | Visual | State coverage | Result |
|---|---|---|---|---|---|---|
| Главная / Dashboard | [✓](../references/vnext-qa/desktop/dashboard-desktop.png) | [△](../references/vnext-qa/mobile-390/dashboard-390.png) | △ touch links | ✓ | ✓ | PASS WITH ISSUES |
| Примерить диски / Create | [△](../references/vnext-qa/desktop/create-desktop.png) | [△](../references/vnext-qa/mobile-390/create-390.png) | △ edit/save | △ fixture media | ✓ parser | PASS WITH ISSUES |
| Проверка совместимости / Fitment | [✓](../references/vnext-qa/desktop/fitment-desktop.png) | [△](../references/vnext-qa/mobile-390/fitment-390.png) | ✓ invariant | ✓ anchor | △ only incompatible | BLOCKED |
| Результат / Result | [✓](../references/vnext-qa/desktop/result-desktop.png) | [✓](../references/vnext-qa/mobile-390/result-390.png) | ✓ slider / feedback | △ CTA order | ✓ completed | PASS WITH ISSUES |
| Мои примерки / History | [✓](../references/vnext-qa/desktop/history-desktop.png) | [△](../references/vnext-qa/mobile-390/history-390.png) | △ long archive | △ card density | ✓ 3 statuses | BLOCKED |
| Баланс / Balance | [✓](../references/vnext-qa/desktop/wallet-desktop.png) | [✓](../references/vnext-qa/mobile-390/wallet-390.png) | ✓ payment states | ✓ | ✓ pending/paid/failed | PASS |
| Render processing | [✓](../references/vnext-qa/desktop/processing-desktop.png) | [△](../references/vnext-qa/mobile-390/processing-390.png) | △ reduced motion | △ white wheel stage | ✓ | PASS WITH ISSUES |
| Auth / email login | [✓](../references/vnext-qa/desktop/auth-login-desktop.png) | [✓](../references/vnext-qa/mobile-390/auth-login-390.png) | △ Telegram path stub | ✓ | ✓ | PASS WITH ISSUES |
| OTP | [✓](../references/vnext-qa/desktop/auth-otp-desktop.png) | [△](../references/vnext-qa/mobile-390/auth-otp-390.png) | △ small text actions | ✓ | ✓ | PASS WITH ISSUES |
| Session restoring | [✓](../references/vnext-qa/desktop/session-restoring-desktop.png) | [✓](../references/vnext-qa/mobile-390/session-restoring-390.png) | △ reduced motion | ✓ | ✓ | PASS WITH ISSUES |
| Session expired | [✓](../references/vnext-qa/desktop/session-expired-desktop.png) | [✓](../references/vnext-qa/mobile-390/session-expired-390.png) | ✓ no auto-replay copy | ✓ | ✓ | PASS |
| Empty history | [✓](../references/vnext-qa/desktop/empty-history-desktop.png) | [✓](../references/vnext-qa/mobile-390/empty-history-390.png) | ✓ recovery | ✓ | ✓ | PASS |
| Generation error | [✓](../references/vnext-qa/desktop/generation-error-desktop.png) | [✓](../references/vnext-qa/mobile-390/generation-error-390.png) | △ support stub | ✓ | ✓ | PASS WITH ISSUES |
| Balance error | [✓](../references/vnext-qa/desktop/balance-error-desktop.png) | [✓](../references/vnext-qa/mobile-390/balance-error-390.png) | ✓ recovery | ✓ | ✓ | PASS |

Дополнительно сохранены [parser success](../references/vnext-qa/mobile-390/create-parser-success-390.png), [parser error](../references/vnext-qa/mobile-390/create-parser-error-390.png), [payment pending](../references/vnext-qa/mobile-390/balance-pending-390.png), [paid](../references/vnext-qa/mobile-390/balance-paid-390.png), [failed](../references/vnext-qa/mobile-390/balance-failed-390.png) для обеих ширин. [Dashboard 1680 px](../references/vnext-qa/desktop/dashboard-1680.png) показывает ограничение основного контента по ширине без растянутых islands.

### Issues — superseded

#### QA-001 — IBM Plex Sans не поставляется с прототипом

- **Экран / viewport / severity:** все экраны, desktop и mobile; **HIGH**.
- **Screenshot:** [Dashboard desktop](../references/vnext-qa/desktop/dashboard-desktop.png), [mobile](../references/vnext-qa/mobile-390/dashboard-390.png).
- **Expected:** оценивать утверждённые размеры, веса и переносы именно на IBM Plex Sans.
- **Actual:** CSS объявляет `"IBM Plex Sans","Segoe UI",Arial,sans-serif`, но в HTML нет `@font-face`/font import, а в репозитории нет файлов Plex. На машине без установленного шрифта браузер использует fallback, поэтому typography QA и пиксельное утверждение переносов недостоверны.
- **Причина / рекомендация:** подключить локальный или официально выбранный webfont с нужными начертаниями, затем повторить screenshots и проверить line-height/переносы. Не маскировать расхождение подбором размеров под fallback.

#### QA-002 — отсутствует state coverage для Fitment verdicts

- **Экран / viewport / severity:** Fitment, 1440 и 390 px; **BLOCKER** для полного VNext state contract.
- **Screenshot:** [несовместимость desktop](../references/vnext-qa/desktop/fitment-desktop.png), [390 px](../references/vnext-qa/mobile-390/fitment-390.png).
- **Expected:** можно визуально проверить как минимум compatible, conditional, unknown/data-missing и incompatible, сохранив `FITMENT_VERDICT ≠ RENDER_PERMISSION`.
- **Actual:** `screens.fitment` содержит только статический несовместимый сценарий; review-controller не имеет Fitment state switch. Сценарии с `!` и `?` проверить невозможно. Нынешний отрицательный verdict корректно оставляет «Создать изображение» доступным.
- **Причина / рекомендация:** добавить контролируемые review fixtures для остальных verdicts без изменения реальной Fitment-логики или выдумывания технических значений. До этого не считать полный Fitment contract проверенным.

#### QA-003 — mobile History не масштабируется как архив

- **Экран / viewport / severity:** History, 390 px; **HIGH**.
- **Screenshot:** [History 390](../references/vnext-qa/mobile-390/history-390.png).
- **Expected:** компактные сканируемые rows для 20–50 элементов, группировка по дате, preview подчинён тексту.
- **Actual:** mobile CSS превращает каждую запись в полноширинную медиа-карточку; одна запись занимает около **377 px**. Контролируемый DOM stress-test с 50 одинаковыми записями дал около **20 010 px** высоты документа без overflow — это технически помещается, но плохо сканируется.
- **Причина / рекомендация:** сохранить дату и статусы, но сделать mobile archive rows компактнее и уменьшить preview. Повторить тест на 20 и 50 реальных по длине записей.

#### QA-004 — часть mobile-действий имеет область касания 22–38 px

- **Экран / viewport / severity:** Dashboard, Create, Fitment, OTP, parser error; 390 px; **HIGH**.
- **Screenshot:** [Create 390](../references/vnext-qa/mobile-390/create-390.png), [parser error](../references/vnext-qa/mobile-390/create-parser-error-390.png), [OTP](../references/vnext-qa/mobile-390/auth-otp-390.png).
- **Expected:** доступные для пальца targets при сохранении editorial вида текстовых ссылок.
- **Actual:** `Заменить автомобиль`, `Изменить данные`, `Изменить`, `Отправить ещё раз` и аналоги имеют видимую высоту **22 px**; parser recovery — **38 px**, feedback chips — **34 px**. Основные CTA и bottom nav достаточно крупные.
- **Причина / рекомендация:** увеличить hit area невидимым padding/min-height, не превращая текстовые действия в pills и не меняя визуальный размер шрифта.

#### QA-005 — навигация содержит видимые тупики

- **Экран / viewport / severity:** sidebar desktop и bottom nav 390 px; **HIGH** для navigation contract.
- **Screenshot:** [Dashboard desktop](../references/vnext-qa/desktop/dashboard-desktop.png), [390 px](../references/vnext-qa/mobile-390/dashboard-390.png).
- **Expected:** видимые пункты ведут в экран/меню или имеют явно обозначенное прототипное состояние.
- **Actual:** desktop `Поддержка` и `Документы`, mobile `Ещё` не меняют URL или UI после клика. В mobile `Ещё` не раскрывает доступ к вспомогательной навигации. `Совместимость` остаётся глобальным desktop пунктом при contextual-подходе к Fitment; это отдельное IA-решение, не автоматическая правка.
- **Причина / рекомендация:** описать/смоделировать назначение этих контролов; отдельно решить, должен ли Fitment остаться глобальным пунктом. Не менять IA молча.

#### QA-006 — Create подтверждает сохранение, не меняя сводку

- **Экран / viewport / severity:** Create, оба viewport; **MEDIUM**.
- **Screenshot:** [Create desktop](../references/vnext-qa/desktop/create-desktop.png), [parser success](../references/vnext-qa/mobile-390/create-parser-success-390.png).
- **Expected:** после `Сохранить` пользователь видит изменённые данные; после parser success — согласованные preview и параметры либо явное указание, что это только fixture.
- **Actual:** изменение марки на `Volvo` и нажатие `Сохранить` закрывает форму и показывает `Сохранено`, но сводка остаётся `Porsche Cayenne…`. Parser даёт loading→success/error и оба recovery path работают, однако success не обновляет видимый объект. Это именно ограничение интерактивного HTML-прототипа, не доказательство ошибки runtime.
- **Причина / рекомендация:** синхронизировать review-state со сводкой/preview или явно пометить демонстрационность данных. Иначе невозможно проверить UX подтверждения изменений.

#### QA-007 — processing wheel asset выглядит как белый блок

- **Экран / viewport / severity:** Render processing, особенно 390 px; **MEDIUM**.
- **Screenshot:** [processing 390](../references/vnext-qa/mobile-390/processing-390.png), [desktop](../references/vnext-qa/desktop/processing-desktop.png).
- **Expected:** выбранный диск читается внутри спокойной тёмной automotive-системы и не перехватывает внимание у исходного фото/статуса.
- **Actual:** `demo-rim-xtrike.png` загружается корректно, но его непрозрачный белый фон образует самый яркий прямоугольник экрана.
- **Причина / рекомендация:** отдельный подготовленный dark/transparent review asset или контролируемая подложка; не «исправлять» цвет всего экрана.

#### QA-008 — spinner игнорирует reduced motion

- **Экран / viewport / severity:** Processing и Session restoring; оба viewport; **MEDIUM**.
- **Screenshot:** [processing](../references/vnext-qa/mobile-390/processing-390.png), [restoring](../references/vnext-qa/mobile-390/session-restoring-390.png).
- **Expected:** при `prefers-reduced-motion: reduce` остаётся читаемый статический индикатор или прекращается вращение.
- **Actual:** `.spinner` всегда использует бесконечный `spin 1s linear infinite`; media override отсутствует.
- **Причина / рекомендация:** добавить узкий reduced-motion override для spinner, не менять состояние и copy.

#### QA-009 — Result CTA предшествует главному изображению

- **Экран / viewport / severity:** Result, особенно 390 px; **LOW**.
- **Screenshot:** [Result desktop](../references/vnext-qa/desktop/result-desktop.png), [390 px](../references/vnext-qa/mobile-390/result-390.png).
- **Expected:** `результат → контекст → действие`, при этом только один product CTA.
- **Actual:** «Создать ещё вариант» стоит над comparison viewer. Это не ломает взаимодействие, но слегка ослабляет заявленный image-first hierarchy.
- **Причина / рекомендация:** визуально проверить вариант после slider; менять только если сохраняется заметность действия и feedback остаётся вторичным.

#### QA-010 — фотографический и SVG-fixture язык смешиваются между экранами

- **Экран / viewport / severity:** Create и Fitment против Dashboard/Result; оба viewport; **MEDIUM**.
- **Screenshot:** [Create desktop](../references/vnext-qa/desktop/create-desktop.png), [Dashboard desktop](../references/vnext-qa/desktop/dashboard-desktop.png).
- **Expected:** cross-surface visual review показывает единую материальность. Fitment может сохранять controlled technical fixture, если реальные параметры не верифицированы.
- **Actual:** Dashboard, Result, Processing и History используют реальные demo images; Create использует нарисованные `carSvg()`/`wheelSvg()`. Fitment делает то же намеренно для технического якоря. Из-за этого оценка Create как общего входного экрана менее надёжна, чем оценка остальных surfaces.
- **Причина / рекомендация:** сделать дополнительный review-state Create с реальными repo assets без замены Fitment fixture; оставить точные технические данные только в проверенном сценарии.

### Cross-surface issues — superseded

- **Typography:** основной blocker — непоставляемый IBM Plex Sans. Аналогичные semantic levels в одном CSS в основном единообразны; после подключения font повторить измерения переносов.
- **Spacing / grid:** frame ограничен `1180px`, gutters и baseline превью Create/desktop Fitment согласованы; на 1680 px чрезмерного растяжения нет. На mobile основные формы становятся одной колонкой. История — исключение по вертикальной плотности.
- **Color:** primary CTA near-white; lime не используется как повсеместный accent или active marker. Положительные/отрицательные/ожидающие состояния имеют текст и цвет, а не один лишь цвет. Декоративных точек в реально показанных status rows нет.
- **Media geometry:** три demo assets загружаются через HTTP; `object-fit: contain` предотвращает искажение. Create/fitment stages фиксированы, но mixed SVG/photographic review снижает fidelity; белый фон wheel в Processing — отдельная проблема.
- **Navigation / links:** основные экраны доступны через sidebar/bottom nav, а review states — через контроллер. Видимые `Поддержка`, `Документы`, `Ещё` и часть прототипных text actions не имеют конечного поведения. У Create ссылка источника также является `href="#"` с отменённым переходом — допустимо для fixture, но не считать проверкой реальной ссылки.
- **Forms / interaction:** edit/cancel, parser loading→success/error, retry/manual recovery, negative feedback и slider проверены. Save confirmation не отражает изменения данных. Небольшие text targets мешают mobile touch QA.
- **Responsive / accessibility:** 390 px и длинные строки без горизонтального overflow; bottom nav фиксирован и имеет отступ в основном контенте. Скриншоты full-page показывают fixed nav в середине длинной страницы, что является артефактом склейки, а не наложением при обычной прокрутке. Safe-area задан через `env(safe-area-inset-bottom)`, но iOS device/notch отдельно не проверялся. `focus-visible` есть для button/input/select; reduced-motion нет.
- **Separators / metadata:** middle dot `·` в обоих VNext prototype HTML не найден; технические строки используют `/`, смысловое разделение — `–`.

### Interaction and state evidence — superseded

- Desktop sidebar и mobile bottom nav открывают Create с ожидаемым active item.
- Create: edit panel открывается; Cancel закрывает; Save показывает `Сохранено`. Parser success и error видны после loading; retry возвращает фокус в URL; manual recovery показывает `Фото загружено`.
- Fitment: отрицательный verdict не отключает `Создать изображение` — core invariant соблюдён.
- Result: клавиша `ArrowRight` сдвигает range `50→51`; pointer drag на desktop `→80`, touch drag на mobile `→82`; negative feedback раскрывает reasons.
- Balance: pending показывает operational island и 5 строк истории; paid/failed убирают island, оставляя историю. Пакеты 3/100 ₽, 7/200 ₽, 20/500 ₽, 45/1000 ₽ и 30 дней присутствуют.
- History: готовый, processing и failed entries представлены корректным plain status text и нужными действиями; в processing result action отсутствует.
- Auth/session и system states доступны и не показывают crash/overlay. Session expired прямо говорит, что прежнее действие не будет запущено автоматически.

### Freeze blockers — superseded, resolved by closing pass

1. **QA-001:** поставлять IBM Plex Sans и переснять typography review.
2. **QA-002:** дать проверяемое покрытие остальных Fitment verdicts без выдуманных технических фактов.
3. **QA-003:** превратить mobile History в масштабируемый архив и повторить stress QA на 20–50 записях.
4. **QA-004:** увеличить mobile hit areas текстовых действий.
5. **QA-005:** определить конечное поведение видимой навигации и отдельно принять IA-решение для Fitment.

### Non-blocking polish / runtime implementation phase — historical

- QA-006: сделать прототипное Save/parser-success состояние непротиворечивым.
- QA-007: подготовить dark/transparent wheel asset для Processing.
- QA-008: reduced-motion fallback.
- QA-009: проверить image-first порядок Result CTA, не добавляя второй CTA.
- QA-010: дополнительный photographic Create review-state.
- Реальная клавиатура телефона, Safari iOS/macOS, Chrome Android, screen reader и `safe-area` на устройстве здесь не проверялись; это отдельный device/runtime QA.

### Final conclusion — superseded baseline, not the current conclusion

1. **Готова ли общая система к freeze?** Нет. Базовая композиция и большинство состояний уже достаточно зрелые, но указанные blockers не позволяют поставить `VNEXT_UI_CONTRACT = FROZEN`.
2. **Что конкретно блокирует?** Доставка шрифта, неполный Fitment state coverage, mobile History на длинном архиве, touch targets и недоопределённая навигация.
3. **Что визуально стабильно?** Dashboard desktop, основной Fitment incompatible anchor, Balance/payment-state композиция, Auth/session и спокойные empty/error states. Result slider и feedback взаимодействуют корректно; его CTA placement — только polish-вопрос. Эти экраны не требуют полной переработки.
