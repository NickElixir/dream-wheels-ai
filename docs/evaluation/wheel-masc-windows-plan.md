# План: исследование MaSC на Windows / RTX 4070 / 64 ГБ RAM

**Обновление 2026-11-22: MaSC отложен по решению пользователя.
Текущий утверждённый пилот — [ImageCritic](imagecritic-pilot-plan.md).
Не использовать этот исторический план как команду запуска MaSC.**

Дата: 2026-11-22. **Статус: на утверждение, не инструкция на немедленный запуск.**
После утверждения подготовим отдельный стартовый prompt и MD для другого OpenCode,
переносимый код, архив данных и точный SHA стартового пакета.
Этот документ сам по себе не разрешает ImageCritic repair или платные API.

## 1. Цель и границы

Проверить, помогает ли MaSC CP ранжировать точность конкретного диска,
а не просто сходство цвета/стиля. Отдельные вопросы:

1. Отличаются ли заведомо разные конструкции?
2. Устойчив ли score к яркости, повороту и native low resolution?
3. Различает ли метрика близкие дизайны и пропорции спиц?
4. Согласуется ли ranking с независимой ручной оценкой?
5. Приемлемы ли время и RAM/VRAM на реальной машине?

Не превращать CP в «процент точности». Сохранность автомобиля проверять отдельно.
Не включать backend, bot, Redis, Supabase, provider adapters, credits или deployment.
Не обучать модели. Не загружать наши изображения во внешние API/демо.
На Windows **не нужны** staging ENV, Supabase service-role key или AITunnel key.

Ожидаемая карта относится к семейству **GeForce RTX 4070**; пользователь назвал
«gtx 4070». До установки уточнить фактическую модель, desktop/laptop и VRAM
через `nvidia-smi`, не предполагать объём VRAM по названию.
64 ГБ RAM не заменяют VRAM. Успешный CUDA inference ещё не проверен.

## 2. Архитектура запуска

Основной вариант — **native Windows x64 + PowerShell + Python 3.12 x64 + CUDA PyTorch**.
WSL2 не устанавливать автоматически: для MaSC сначала достаточно native-варианта.
ImageCritic при необходимости рассмотреть отдельно, возможно в Linux/WSL2.

Рекомендуемая короткая папка, например `C:\AI\DreamWheelsResearch`.
Это будущий путь, не требование читать существующие каталоги пользователя.
Отдельный clone/worktree экспериментальной ветки:
`experiment/wan-bbox-wheel-fidelity`. Не использовать checkout production.

Разделяем:
- Git: документы, подготовленный исследовательский код и тесты;
- private bundle: исходные images, crops, masks, manifests;
- локальный cache: публичные pinned weights;
- локальные результаты: scores, resource logs, отчёт.

Python venv — только исследовательский; backend requirements не устанавливать.
Работать через явный путь `...\Scripts\python.exe`, activation policy менять не нужно.
Не запускать агент/терминал с правами администратора.
Не менять глобальные настройки другого OpenCode и его провайдеров.

## 3. Что уже есть и что ещё надо подготовить

### Локально подготовлено на Mac

- 10 реальных completed cases, только аккаунт владельца.
- 30 исходных файлов: car / reference / historical result.
- 30 native face crops: 10 reference, 20 front/rear.
- 50 controls с соответствующими masks.
- 80 image assets + 80 masks.
- 73 pairs: 20 real try-ons, 50 identity controls, 3 coarse negatives.
- 6 связанных source groups; split пока не назначен.

Предварительная разметка одного AI-reviewer: envelope ellipses включают просветы,
тормоза/видимый фон, не являются сегментацией металла.
Все real labels UNREVIEWED; negatives ещё не human-approved.
№53/54 имеют общий reference; №55/52/51 и №50/47 связаны автомобилем.
Нельзя считать 73 пары независимой выборкой.

Prepared manifest SHA-256:
`de90e855872e28f969a0ae0ff62c6a9e227fe0760e2ed4e56a84b44564c6a02e`.

№56 в этом наборе — **historical result**, не Wan A seed20261120.
Прежнюю human-оценку experimental Wan не переносить автоматически на historical.
18 экспериментальных outputs X5 не входят в стартовые 73 пары;
при добавлении сделать отдельную версию manifest.

### Текущее ограничение Git-пакета

В этом docs-only commit публикуется план, **не готовый Windows executable package**.
Ранее написанные `scripts/wheel_metric_*.py` / `wheel_masc_score.py` и тесты
пока локальные untracked artifacts, не предполагать их наличие в чистом clone.
Не начинать запуск по старым фрагментам команд до публикации стартового пакета.

После approval отдельно:
1. Отделить digest/manifest/path utilities от DB downloader.
   Текущий scorer косвенно импортирует asyncpg/aiohttp/dotenv и Mac-only ENV constant:
   на Windows эти зависимости и доступ к базе для scoring не нужны.
2. Сделать UTF-8 explicit для всех manifests/JSONL/logs.
3. Устранить определение NaFlex только по строке model path либо
   гарантировать `naflex` в локальном пути; Windows cache layout проверить.
4. Проверять image/mask hashes, binary/nonempty masks, path traversal и duplicate ids.
5. Добавить явный список pair IDs, device, dtype, TF32/seed settings,
   CUDA synchronization, timings и peak RAM/VRAM. Не выбирать pilot по случайному порядку.
6. Добавить понятные download-only и offline-score режимы; скачивание
   весов не должно происходить от простого импорта/проверки manifests.
7. При OOM/error сохранить завершённые строки, статус incomplete и остановиться.
   Не перезаписывать output, не менять dtype/patch budget/model молча.
8. Подготовить отдельные зависимости, PowerShell команды и offline tests.
9. Закоммитить только этот scope; не переносить несвязанные uncommitted изменения.

## 4. Перенос данных без production-доступа

Подробная спецификация: [wheel-masc-data-transfer.md](wheel-masc-data-transfer.md).
Рекомендация — приватный ZIP через носитель или прямой канал между своими машинами.
В GitHub repository, Releases, issues, Actions artifacts и публичные HF datasets
изображения не выкладывать. Облачный способ передачи — только по выбору владельца.

Allowlist стартового набора: **194 файла / 56 744 322 байта** до архивации,
включая 30 originals, 160 prepared image/mask files и 4 manifests/review files.
ZIP, его hash и per-file manifest будут созданы после approval.
Не переносить весь `results/`, venv, cache, .env или конфиги MCP.
Hash prepared manifest проверяется до каких-либо вычислений.

## 5. Preflight на Windows — без inference

Другой OpenCode сначала фиксирует:
- Git SHA и отсутствие несвязанных изменений;
- Windows version, CPU, RAM, свободный диск (плановый резерв 25 ГБ под MaSC,
  окружение, cache и результаты; это запас, не измеренный минимум);
- `nvidia-smi`: точная модель GPU, VRAM, driver, занятая VRAM;
- Python x64 и доступность wheel packages;
- SHA архива, file inventory, 80 assets / 73 pairs;
- визуальный просмотр mask-review, особенно косых и маленьких колёс.

Пустые/повреждённые masks, missing images, несовпадающий SHA => STOP.
Перенесённые данные не перегенерировать/не переаннотировать молча.
При корректировках — новая версия manifest с причиной.

## 6. Изолированное окружение и CUDA

1. Создать новый venv, не использовать глобальный Python site-packages.
2. По официальному PyTorch selector подобрать **stable Windows/Pip/CUDA build**,
   совместимый с текущим driver и Python. Зафиксировать команду и версии.
   Не обещать конкретный CUDA wheel до preflight и не ставить nightly автоматически.
3. Установить pinned MaSC commit
   `5f3f4b9112268469d3dc845cd45ce43e631c4bbd` (version 0.3.0).
   Проверить, что dependency resolver не заменил CUDA torch на CPU-only.
4. Выполнить `pip check`, offline tests, `pip freeze`.
5. Проверить `torch.cuda.is_available()`, device name, простой CUDA tensor operation,
   `torch.cuda.synchronize()`, версии torch/torchvision/transformers/CUDA.
6. Если CUDA недоступна — STOP с диагностикой; не считать CPU fallback CUDA-тестом.
   Обновление системного драйвера — только с разрешения владельца.

Model baseline — авторский **fp32**, batch=1, 1024 NaFlex patches.
Первый запуск без AMP, quantization, torch.compile, xformers/FlashAttention plugins.
Если памяти недостаточно: отдельное решение между CPU fp32 и изменённым
precision profile. Нельзя смешивать результаты разных профилей в одной таблице.
Фиксация seeds не гарантирует bitwise reproducibility между GPU/версиями.

## 7. Публичные веса — один раз, потом offline

Checkpoint: `google/siglip2-so400m-patch16-naflex`.
Revision: `cc24074f717b612951c2dead130904ab9b65a81e`.
Ожидаемый полный fp32 checkpoint около 4.6 GB; VRAM peak определяется пилотом.
Загружается только из официального HF repo, без стороннего mirror.

Download и scoring — отдельные шаги.
Сохранить revision, имена/размеры/checksums скачанных файлов и environment freeze.
Не добавлять веса в Git или приватный dataset ZIP.
На Windows HF cache работает и без symlinks, но может дублировать файлы;
не включать Developer Mode/administrator автоматически ради cache.
Offline scoring должен работать с уже скачанным snapshot, без запроса к API модели.
Отключить не требуемые telemetry/tracking integrations в рамках исследовательского
процесса; это не отменяет сетевые обращения OpenCode к его собственному провайдеру.

## 8. Поэтапный эксперимент и критерии перехода

### A. Offline integrity + human review

Проверить набор, проверить masks и согласовать 3 coarse negatives.
Геометрию real try-ons не выводить из статуса completed.
Human labels фиксировать до показа scores; неопределённое оставить UNCERTAIN.

### B. Smoke: одна self-пара

Один reference crop против самого себя с той же mask.
Ожидается finite CP близкий к 1; предварительный integrity check `|1-CP| <= 1e-4`.
Это численная проверка pipeline, **не порог качества примерки**.
Сделать второй запуск той же пары и записать расхождение, не требовать
побитового совпадения на всех платформах.
Замерить cold start отдельно от warm inference, GPU synchronize вокруг timing.
Зафиксировать RAM, GPU allocated/reserved peak и VRAM free.

NaN/Inf, OOM, self-score далеко от 1 => STOP и анализ preprocessing,
mask alignment, dtype, device; весь benchmark не запускать.

### C. Pilot: 8 фиксированных пар

После подготовки runner выбирать явно:
- 56-rim -> 56-rim-self;
- 56-rim -> 56-rim-brightness080;
- 56-rim -> 56-rim-rotate90;
- 56-rim -> 56-rim-resolution128;
- 56-rim -> 56-rim-resolution64;
- 48-rim -> 56-rim;
- 48-rim -> 53-rim;
- 48-rim -> 55-rim.

Первые 5 — controls одного reference, последние 3 — другие конструкции.
Этого достаточно для smoke, **недостаточно для заявления о точности на дисках**.
Это не проверка subtle length mismatch: для неё нужен дополнительный набор.
Не требовать заранее конкретных CP разниц: показать ranking и контрпримеры.

### D. Полный базовый прогон: 73 пары

Только после B/C. Один frozen profile, per-pair JSONL и stable pair ID.
Scores, elapsed time, status, source hashes, mask versions и dimensions сохранять.
PF не интерпретировать как wheel fidelity; авторский score API может его вычислять.
Missing/failed строки явно учитывать, не отбрасывать из отчёта.

Контроль происхождения дизайна не равен true positive генерации.
Реальные 20 wheel pairs пока используются для exploratory ranking, не accuracy.
Не оценивать false acceptance rate без human gold.

### E. Что действительно проверяет пригодность

1. На том же backbone добавить **global pooled cosine baseline** с тем же
   preprocessing; не выдавать mean patch cosine за авторский trained global pool.
   DINO/DreamSim — последующий вариант, а не обязательные новые weights сразу.
2. Маски: исходная, слегка суженная/расширенная (согласованный диапазон,
   например 3% minor diameter), без потери исходников и с отдельными hashes.
   Проверить, не меняется ли ranking от границы сильнее, чем от конструкции.
3. Добавить небольшой human-labelled набор близких дизайнов:
   та же топология, другие пропорции/длина, по возможности сходный finish.
   Новые изображения — только после согласования происхождения/прав использования.
4. Контрольная перестановка локальных секторов одного изображения может проверить
   пространственную чувствительность, но это **synthetic stress test**, не реальная
   ошибочная примерка. Деформации не маскировать под gold.
5. Сначала сравнение product-to-product; затем product-to-wheel с разными ракурсами.
   Результаты этих режимов не смешивать.

Если доступны только стартовые 73 пары, честный вывод ограничен инвариантностью,
coarse discrimination и exploratory try-on ranking. Вопрос длины остаётся открытым.
Пороги не подбирать и не проверять на тех же парах; linked groups держать вместе.

## 9. Когда прекращаем и что считаем результатом

STOP при:
- проблемах integrity/доступа к данным/CUDA;
- OOM или нестабильных/нечисловых scores;
- попытке скачать иной checkpoint или изменить protocol без фиксации;
- необходимости внешнего API, платного сервиса или production credential;
- отсутствии подтверждённых labels для заявленного вывода.

После ошибки сохраняем уже полученное. Повтор после устранения причины —
явно отдельная попытка с записью причины, не бесконечный retry loop.

На выходе:
- environment/hardware report и CUDA smoke;
- frozen dataset + mask + model + code hashes;
- scores.jsonl / comparison.csv, ошибки и coverage;
- latency и RAM/VRAM, без выдуманного throughput;
- визуальная страница ranking с отдельными front/rear;
- отчёт: MaSC пригоден для retrieval / coarse filtering / geometry QA либо не пригоден,
  с границами доказательности. Один score не заменяет видимые измерения длины.

Возврат результатов — локальный приватный пакет; в Git только обезличенный
агрегированный отчёт и scoped code после проверки на секреты.
Ни один результат не включает автоизменение пользовательского pipeline.

## 10. ImageCritic — отдельная развилка, не часть первого запуска

После результатов MaSC и независимого решения:
- подтвердить локальный дефект и фиксируемый участок;
- проверить noncommercial/FLUX license и CUDA compatibility;
- оценить VRAM, размер весов и необходимость offload на фактической GPU;
- отдельно согласовать загрузку/запуск;
- один repair, сравнение before/after и сохранности контекста.

Не обещать, что ImageCritic целиком поместится в RTX 4070.
Не начинать с автозагрузки полного Kontext mirror.
Не исправлять корректные соединения на основании прежнего VLM диагноза.

## 11. Следующий deliverable — только после утверждения

Подготовить:
1. Windows-ready scoped code и tests, frozen runtime recipe.
2. Проверенный приватный ZIP + archive SHA + per-file inventory.
3. Точный Git SHA, содержащий код, а не только план.
4. Отдельный MD для старта на Windows: paths, prerequisites, stop conditions,
   команды, expected artifacts, ограничения другого OpenCode.
5. Стартовый prompt с указанием этого MD и первого read-only preflight.

В текущем действии стартовый prompt/MD, архив и окружение **не создаются**.

## Источники

Проверены 2026-11-22:
- https://pytorch.org/get-started/locally/ — Windows/CUDA installation и verification.
- https://huggingface.co/docs/huggingface_hub/guides/manage-cache — pinned cache,
  Windows symlinks limitations.
- https://github.com/masc-metric/masc — авторский API и device support.
- https://arxiv.org/html/2605.22469v1 — CP protocol/ограничения.
- https://github.com/HVision-NKU/ImageCritic — отдельный correction pipeline/licenses.
