# Передача в чат «Timeweb Frontend Deploy»

Дата: 5 ноября 2026 года. Исходный чат: «Завершить Landing V1».

## Решение пользователя и границы

Перенести RU-лендинг dream-wheels.ru на Timeweb по аналогии с app.dream-wheels.ru. Это выбранное пользователем решение, не гипотеза для нового сравнения хостингов. На Android RU-лендинг не открывается без VPN. EN dreamwheels.pro оставить на Vercel. В текущей задаче подготовлены GitHub-синхронизация и план; переключение DNS/Timeweb этим документом не выполнено.

Не менять согласованный дизайн, данные 30 комбинаций, модель unknown, WebApp/backend и их версии. Интеграция Catalog → WebApp/Auth/attribution и отправка B2B-заявок отложены. Формы честно демонстрационные.

## Источник и опубликованный релиз

Репозиторий NickElixir/dream-wheels-ai. Исходная ветка feature/landing-two-domain-routing, коммит 2e0b10e (feat: complete bilingual landing and catalog release) теперь отправлен в GitHub. Эта ветка содержит старую историю WebApp; не сливать её целиком поверх актуального приложения.

От актуальной staging be73ef0 создана отдельная ветка feature/landing-release-sync: точная копия landing/ и документации релиза из 2e0b10e, без старых изменений WebApp. Использовать её PR как путь включения лендинга в staging/main. PR/CI-статус см. в передаче из исходного чата. Нельзя считать main/staging обновлёнными до merge.

Production Vercel: проект dream-wheels-ai-landing, prj_Zc70ETVBZ3exQfLrcFg4vNkTNNiV. Текущий релиз dpl_CcC1exNP5kJGhdJMjVRFqruW9et8; откат dpl_FTMYnwd5Qc4GjwE4FHt6UMJRn2tY.

Через API подтверждено: dreamwheels.pro и www.dream-wheels.ru направлены на текущий deployment; dream-wheels.ru имеет 308 на www. RU-домен лендинга сейчас на Vercel, приложение app.dream-wheels.ru — отдельный контур Timeweb. DNS пока не меняли.

Тестовый релиз прошёл RU/EN проверки HTML/canonical/чистых ссылок. 19 тестов, Astro check без ошибок и сборка прошли. После выпуска английская Главная открылась; полный сетевой smoke не завершён из-за таймаутов, пользователь остановил его и решил проверить без VPN самостоятельно. Не утверждать доступность RU из российских сетей.

## Что готово во frontend

Astro + Preact, static output. Согласованы RU/EN, общий IBM Plex Sans (Inter Tight только Hero-бренд), мобильная сетка дисков 2×3, 30 финальных Garage-примеров, SKU/cutouts. Исправлены мобильные Hero и Zeekr: бампер/передний диск видны, тень слабее, нет полосы справа. Подписи всех шагов одинаковы, Geely Monjaro в одну строку. Названия машин видны при промежуточных ширинах. Главные CTA и основная примерка каталога лаймовые; примерка в демо-карточке белая; Discuss a pilot тёмная. Кнопка Explore the wheel catalog объёмная графитовая, без стрелки.

Worktree исходного трека: /Users/nikolai/Documents/GitHub/dream-wheels-ai/worktrees/landing-i18n-foundation.

Сборка из landing/: npm ci; npm run check; npm test; npm run build:domains. RU-артефакт landing/dist-domains/ru, EN landing/dist-domains/en. manifest.json содержит хеши HTML. Root RU и /catalog имеют lang=ru/canonical www.dream-wheels.ru, не зависят от Vercel middleware. Публиковать файлы артефакта, не исходники/node_modules/.env. Не публиковать dev/; /ru,/en — noindex preview; /localized — служебные Vercel rewrite-цели, не обязательны для Timeweb. У публичных / и /catalog не должно быть noindex.

## Важное уточнение про Deno

По актуальным файлам deploy/gateway/README.md и handler.ts Deno обслуживает API /api/backend/*, а не весь HTML/изображения приложения. Статика приложения размещена на Timeweb. Поэтому лендинг тоже доставлять статически через Timeweb; не превращать API gateway в общий reverse proxy без отдельной необходимости. Для чисто статического лендинга расширение CORS Deno не требуется, если он не делает API-вызовов. Секреты/настройки приложения не копировать в лендинг.

Существующие опорные файлы в актуальном репозитории: deploy/timeweb-static/README.md, deploy/timeweb-static/build.mjs, deploy/gateway/README.md, deploy/gateway/handler.ts, docs/ru-release-pipeline.md, .github/workflows/ru-release.yml. У них профили ru-test/ru-production и фиксированные gateway-test/gateway. Сборка WebApp dist/timeweb содержит SPA fallback/noindex — её нельзя без изменений переиспользовать как индексируемый лендинг.

## План выполнения в Timeweb-чате

1. Прочитать действующий RU runbook и настройки app.dream-wheels.ru. Использовать актуальную staging/main и чистый PR лендинга; не откатывать приложение к старой ветке Landing. Включить проверенный PR через обычные проверки/согласование релиза, зафиксировать полный source SHA.
2. Расширить существующий процесс выпуска отдельной целью Landing (собственный артефакт/сайт/версия), без замены dist/timeweb приложения. Сохранить rollback-снимок, фиксировать SHA и профиль. Не создавать платные ресурсы/менять тариф автоматически.
3. Собрать RU static, проверить все изображения и runtime islands. Проверить внешние Google Fonts: при нестабильности из РФ подготовить локальную доставку используемых весов с лицензиями. Не считать HTTP 200 HTML достаточной проверкой.
4. Разместить кандидат на тестовом Timeweb-адресе с noindex на уровне тестового сайта. Для /catalog настроить directory index/нормализацию, корректные MIME CSS/JS/fonts/AVIF/WebP, кеш HTML с revalidation и версионированные ресурсы. Изображения с неизменяемым URL не кешировать навечно при замене содержимого.
5. Явно определить существующие /app/** и /t/** ссылки RU-лендинга: на Vercel их обслуживают rewrites landing/vercel.json; Timeweb их автоматически не поддержит. Выбрать минимальное сохранение переходов в уже работающий app.dream-wheels.ru с корректным путём/query/hash, либо эквивалентный штатный redirect. Проверить реальный формат URL приложения, не угадывать. Не реализовывать пока передачу выбранного диска/Auth Gate и не менять backend.
6. Проверить RU-Главную/Каталог на Android без VPN (Wi-Fi и мобильная сеть) и MacBook: загрузка HTML/CSS/JS/fonts/картинок, выбор автомобиля/диска, характеристики, меню, FAQ, сравнение, обе CTA и честный demo B2B. Проверить canonical/hreflang и EN switch. Получить подтверждение пользовательского сетевого теста до финального переключения; таймаут не равен успеху.
7. Подготовить точные DNS-записи из реальных настроек Timeweb для dream-wheels.ru и www.dream-wheels.ru, проверить HTTPS/SNI и сохранить текущие значения DNS/TTL. Предпочтительно сохранить canonical www и apex→www, если нет конкретной причины менять. Согласовать границы финального переключения с пользователем в Timeweb-чате. EN домен и app.* не менять.
8. Переключить RU на проверенный сайт, проверить оба имени, сертификаты, /catalog и переходы в приложение из РФ. Убедиться, что RU-ресурсы не продолжают грузиться с Vercel. Повторить независимую проверку dreamwheels.pro на EN; там сохранить текущий релиз. Сохранить release ID/SHA/DNS и инструкцию отката.

Definition of Done: RU-лендинг и каталог реально открываются без VPN на Android со всеми ресурсами через Timeweb; app.dream-wheels.ru не затронут; EN на Vercel работает; исходники/CI/артефакт привязаны к GitHub SHA; доступен проверенный откат. Backend-интеграция и B2B отправка остаются отдельными этапами.
