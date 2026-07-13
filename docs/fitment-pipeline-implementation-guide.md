# Fitment Pipeline — Implementation Guide (agent-executable)

> Production implementation status: `src/fitment` is the canonical technical
> fitment package. See `fitment-production-test.md` for rollout and live smoke.

> Назначение: пошаговая инструкция, по которой агентный LLM (или человек) может построить
> полный pipeline визуальной примерки колёс (fitment) от текущего MVP до управляемой
> многостадийной архитектуры. Документ самодостаточный: что делать, в каком файле, в каком
> порядке, как проверять, какие проблемы возникнут и как их решать.
>
> Источники истины верхнего уровня: [ai-rendering-pipeline.md](ai-rendering-pipeline.md),
> [architecture.md](architecture.md), [data-model.md](data-model.md),
> [product-roadmap.md](product-roadmap.md). Этот гайд — их детализация до уровня задач.
>
> Перед любыми правками кода читать [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## 0. Как пользоваться этим документом (для агента)

Правила исполнения, которым обязан следовать агент:

1. Работать строго пофазно. Не начинать фазу `Pn+1`, пока не выполнены Acceptance criteria фазы `Pn`.
2. Одна фаза = одна ветка `feature/fitment-pX-<slug>` → PR в `dev`. Не пушить в `main`.
3. Каждая фаза должна оставлять продукт в рабочем состоянии (no broken main path). Любая новая
   стадия pipeline подключается за feature-flag (env), по умолчанию `false`.
4. Никакой генеративный/ML-код не должен жить в route handlers. Бизнес-логика — в сервисах.
5. На каждую новую env-переменную обновлять `.env.example`. На каждое DDL-изменение — отдельная
   идемпотентная миграция в `migrations/` (следующий свободный номер — `0017+`).
6. После правок запускать локальную проверку (раздел [Verification](#13-verification--definition-of-done)).
7. Соблюдать логирование из CONTRIBUTING: `logger.exception(...)` в `except`, контекст
   (`job_id`, `user_id`, `telegram_user_id`), эмодзи статусов, без секретов в логах.
8. Type hints в публичных сигнатурах, async для I/O, Pydantic на границах, абсолютные импорты `from src...`.

Инвариант продукта: примерка возможна, если на фото видно колесо. Технические спеки (PCD/ET/...)
полезны, но НЕ обязательны для самой генерации. Любой шаг, не имеющий данных, возвращает `unknown`,
а не выдумывает значение.

---

## 1. Текущее состояние (baseline) и целевое

Что есть сейчас (репозиторий `main`):

- `src/main.py` — `process_jobs_loop`: один линейный воркер, тянет job из Redis, грузит вход в base64,
  вызывает один провайдер (Reve), сохраняет результат, финализирует кредиты.
- `src/jobs_api.py` — `POST /jobs`, `POST /jobs/upload`, `GET /jobs/{id}/status`, `download`, `feedback`.
- `src/reve_client.py` — единственный провайдер, прямой вызов.
- Статусы job грубые: `queued/processing/completed/failed`.
- Нет сегментации, нет понимания сцены, нет валидации результата, нет render plan, нет durable assets
  (durable assets частично готовы в ветке `staging`: `src/assets_service.py`, `migrations/0015_*`).

Целевое: staged `RenderJob` (см. [ai-rendering-pipeline.md](ai-rendering-pipeline.md)):

```text
Upload → Ingest/Normalize → Quality Gate → Vehicle Understanding → Rim Understanding
       → Wheel Segmentation/Geometry → Render Plan → Generation → Post-validation
       → durable result + history + feedback + dataset
```

Стратегия миграции: НЕ переписывать всё сразу. Оборачиваем текущий линейный путь в оркестратор,
затем добавляем стадии по одной за флагом. Сначала надёжность и наблюдаемость, потом качество, потом ML.

---

## 2. Целевая структура кода (что куда класть)

Создаётся постепенно (по фазам), но целевая раскладка фиксирована заранее:

```text
src/
  pipeline/
    __init__.py
    orchestrator.py        # стейт-машина job, переходы между стадиями, retry/refund
    stages.py              # тонкие обёртки: вызывают сервисы, пишут артефакты и статус
    render_plan.py         # RenderPlan (pydantic) + версионирование
    attempts.py            # учёт generation_attempts
    flags.py               # чтение feature-flags стадий из config
  vision/
    __init__.py
    quality_gate.py        # cheap CV + detector + VLM-gate → InputQualityReport
    wheel_segmentation.py   # YOLO detect → SAM2 refine → маски
    geometry.py            # эллипс/перспектива/арка → WheelGeometryReport
    rim_features.py        # CV-дескрипторы + embedding диска
    images.py              # нормализация, HEIC, EXIF, downscale, dedup
  understanding/
    __init__.py
    vehicle_vlm.py         # VLM-распознавание машины (structured JSON)
    vehicle_rag.py         # retrieval по справочнику (pgvector)
    rim_vlm.py             # VLM-описание диска
    rim_ocr.py             # OCR маркировки/упаковки
    normalization.py       # слияние источников по trust + provenance
  generation/
    __init__.py
    providers/
      base.py              # ImageGenerationProvider (Protocol/ABC)
      reve.py              # обёртка существующего reve_client
      flux_kontext.py
      qwen_edit.py
    prompt_builder.py      # построение промпта из RenderPlan (вне routes/provider)
    router.py              # выбор провайдера/режима по плану и флагам
  validation/
    __init__.py
    vehicle_preservation.py
    wheel_consistency.py   # позиция/количество колёс до/после
    rim_similarity.py      # embedding similarity результата к референсу
    result_quality.py      # сводный вердикт return/retry/fail
  evaluation/
    __init__.py
    datasets.py            # версионированные case sets
    metrics.py
    benchmark.py           # офлайн-сравнение провайдеров/версий
  schemas/
    fitment.py             # все pydantic-модели отчётов и планов
```

Тяжёлые ML-инференсы (SAM2, VLM self-host, diffusion self-host) НЕ исполняются в основном backend.
См. раздел [Инфраструктура / GPU offload](#10-инфраструктура-и-gpu-offload).

---

## 3. Контракты данных (pydantic) — определить первыми

Файл: `src/schemas/fitment.py`. Это «язык» всего pipeline; стадии общаются только через эти модели,
их же сериализуем в JSON в БД. Определить ДО реализации стадий.

```python
from enum import StrEnum
from pydantic import BaseModel, Field


class Provenance(StrEnum):
    catalog = "catalog"
    user_sku = "user_sku"
    user_specs = "user_specs"
    ocr = "ocr"
    vlm = "vlm"
    unknown = "unknown"


class InputQualityReport(BaseModel):
    decision: str  # accepted | warning | rejected
    reasons: list[str] = Field(default_factory=list)
    car_present: bool
    wheels_visible_count: int
    blur_score: float | None = None
    brightness_score: float | None = None
    model: str
    model_version: str
    confidence: float


class VehicleAnalysisReport(BaseModel):
    make: str | None = None
    model: str | None = None
    generation: str | None = None
    year_range: str | None = None
    body: str | None = None
    candidates: list[dict] = Field(default_factory=list)
    source: Provenance
    confidence: float
    rag_evidence: list[dict] = Field(default_factory=list)


class WheelInstance(BaseModel):
    index: int
    bbox: list[float]              # x1,y1,x2,y2 (normalized)
    mask_asset_id: str | None = None
    center: list[float] | None = None
    ellipse: dict | None = None    # cx,cy,rx,ry,angle
    visible_fraction: float
    occlusion_score: float
    position: str | None = None    # front_left / rear_right / ...
    replaceable: bool


class WheelGeometryReport(BaseModel):
    wheels: list[WheelInstance]
    target_indexes: list[int]
    arch_mask_asset_id: str | None = None


class RimAnalysisReport(BaseModel):
    style: str | None = None
    spoke_count: int | None = None
    primary_color: str | None = None
    finish: str | None = None
    brand: str | None = None
    model: str | None = None
    embedding_ref: str | None = None
    source: Provenance
    confidence: float


class RetryPolicy(BaseModel):
    max_internal_retries: int = 1
    billable: bool = False


class RenderPlan(BaseModel):
    pipeline_version: str
    prompt_version: str
    quality_policy_version: str
    car_asset_id: str
    rim_asset_id: str
    rim_crop_asset_id: str | None = None
    wheel_mask_asset_ids: list[str] = Field(default_factory=list)
    control_map_asset_ids: list[str] = Field(default_factory=list)
    target_wheel_indexes: list[int]
    generation_mode: str           # provider-neutral
    provider: str
    negative_prompt_version: str | None = None
    expected_wheel_count: int
    expected_style: str | None = None
    retry_policy: RetryPolicy = RetryPolicy()


class GenerationResult(BaseModel):
    provider: str
    provider_request_id: str | None = None
    result_asset_id: str | None = None
    attempt_no: int
    status: str                    # ok | provider_error | rejected_by_validation
    latency_ms: int | None = None
    cost: float | None = None
    raw_response_ref: str | None = None


class PostValidationReport(BaseModel):
    vehicle_preserved: bool
    wheel_count_ok: bool
    rim_similarity: float | None = None
    artifact_score: float | None = None
    decision: str                  # return | retry | fail
    reasons: list[str] = Field(default_factory=list)
```

Acceptance: модели импортируются, покрыты smoke-тестом сериализации, `ruff` чистый.

---

## 4. Стейт-машина статусов job

Расширяем `jobs.status` (или добавляем `pipeline_stage`, оставляя `status` грубым для совместимости
с фронтом — предпочтительно второе, чтобы не ломать `webapp/app.js`).

Переходы (в `src/pipeline/orchestrator.py`):

```text
created → uploaded → checking_input
  checking_input → input_rejected            (terminal, refund/none)
  checking_input → understanding_vehicle
  understanding_vehicle → understanding_rim
  understanding_rim → segmenting_wheels
  segmenting_wheels → planning_render
  planning_render → generating
  generating → validating_result
  validating_result → retrying → generating  (max_internal_retries раз)
  validating_result → completed
  любой шаг → failed                          (terminal, refund)
```

Маппинг для UI (`webapp/app.js`), человекочитаемо:

| pipeline_stage | UI текст |
|---|---|
| checking_input | Проверяем фото |
| understanding_vehicle / understanding_rim | Распознаём машину и диск |
| segmenting_wheels / planning_render | Готовим примерку |
| generating | Генерируем результат |
| validating_result / retrying | Проверяем качество |
| completed | Готово |

Правила:

- Каждый переход атомарно пишет в БД: новый `pipeline_stage`, артефакт стадии, `model/version`, время.
- Биллинг: кредит резервируется один раз (`reserve_job_credit`), списывается при `completed`,
  возвращается при `failed`/`input_rejected`. Internal retry не биллится (см. `RetryPolicy.billable=false`).
- Идемпотентность: переход применяется только если текущий статус — ожидаемый предыдущий (optimistic
  guard через `UPDATE ... WHERE status = :expected`), иначе no-op (защита от двойной обработки воркером).

---

## 5. Порядок разработки (фазы)

Логика порядка: сначала фундамент (надёжность, артефакты, оркестрация), затем то, что напрямую
поднимает качество (сегментация → geometry → валидация), затем понимание (VLM/RAG), затем ML-апгрейды
(self-host/LoRA) — только когда есть датасет и бенчмарк, иначе работа вслепую.

| Фаза | Цель | Зависит от | Риск |
|---|---|---|---|
| P0 | Durable assets + история (из `staging`) | — | низкий |
| P1 | Оркестратор + stage-статусы (обёртка текущего пути) | P0 | низкий |
| P2 | Ingest/Normalize (HEIC/EXIF/downscale/dedup) | P1 | низкий |
| P3 | Quality Gate (встроить готовую модель видимости колёс) | P1,P2 | средний |
| P4 | Wheel Segmentation + Geometry (YOLO+SAM2) | P2 | высокий (GPU) |
| P5 | RenderPlan + provider interface (обернуть Reve) | P1 | средний |
| P6 | Post-generation Validation + internal retry | P4,P5 | средний |
| P7 | Vehicle/Rim Understanding (VLM + RAG + OCR) | P2,P5 | высокий |
| P8 | Evaluation harness + benchmark/датасет | P5,P6 | средний |
| P9 | Generation upgrade (Kontext/Qwen или self-host control/LoRA) | P8 | высокий |

P0–P3 дают «честный, наблюдаемый, не ломающийся» продукт. P4–P6 дают скачок качества. P7–P9 —
понимание и максимизацию качества. Можно остановиться/релизить после любой фазы.

---

## 6. Фазы подробно

Каждая фаза: Цель → Файлы → Задачи → Библиотеки → Миграции/env → Проблемы и решения → Acceptance.

### P0 — Durable assets и история

Цель: результаты и входы не теряются (Telegram file URL протухает), история job доступна.

Файлы: перенести из ветки `staging`: `src/assets_service.py`, `migrations/0015_durable_render_assets.sql`,
`tests/test_assets_service.py`, `tests/test_jobs_history_api.py`; интегрировать в `src/main.py`
(`_save_render_output` пишет durable asset) и `src/jobs_api.py` (history endpoint).

Задачи:
- Скопировать durable-asset логику из `staging`, разрешить конфликты с `main` (`src/bot.py`,
  `src/payments_service.py` — см. анализ веток).
- Сохранять `car_original`/`rim_original` в Supabase Storage сразу при upload, не держать только
  Telegram URL.

Библиотеки: уже есть (`src/storage.py`).

Проблемы и решения:
- Конфликт нумерации миграций: `0015` уже занят в README, но файла нет в `main`. Решение — взять файл
  из `staging` как есть, проверить, что в проде он применён; если занят — переименовать в следующий свободный.
- Telegram URL expiry: всегда копировать байты в Storage до постановки в очередь.

Acceptance: job создаётся, входы и результат лежат в Storage, `GET` истории отдаёт прошлые рендеры,
тесты `test_assets_service`/`test_jobs_history_api` зелёные.

### P1 — Оркестратор + stage-статусы

Цель: текущий линейный путь работает через стейт-машину, видны стадии, поведение не меняется.

Файлы: `src/pipeline/orchestrator.py`, `src/pipeline/stages.py`, `src/pipeline/flags.py`,
`src/schemas/fitment.py` (модели из раздела 3), правка `src/main.py` (`process_jobs_loop` вызывает
оркестратор), миграция `0017_pipeline_stage.sql` (добавить `jobs.pipeline_stage`, `pipeline_version`,
`prompt_version`, `quality_policy_version`, `error_code` — все nullable, идемпотентно).

Задачи:
- Вынести тело `process_jobs_loop` в `orchestrator.run(job_id)`, разбить на вызовы `stages.*`.
- На старте только две реальные стадии (`generating`, `completed`) + остальные как pass-through заглушки
  за флагами `FITMENT_STAGE_*_ENABLED=false`.
- Optimistic guard на переходах.

env: `FITMENT_PIPELINE_VERSION`, `FITMENT_STAGE_QUALITY_ENABLED`, `FITMENT_STAGE_SEGMENTATION_ENABLED`,
`FITMENT_STAGE_UNDERSTANDING_ENABLED`, `FITMENT_STAGE_VALIDATION_ENABLED` (все default `false`).

Проблемы и решения:
- Двойная обработка job двумя воркерами: optimistic `UPDATE ... WHERE status=expected` + Redis-lock
  по `job_id`.
- Регрессия фронта: `status` для `webapp` оставить грубым; `pipeline_stage` — отдельное поле.

Acceptance: end-to-end рендер работает как раньше, в БД виден `pipeline_stage`, флаги стадий выключены,
все существующие тесты зелёные.

### P2 — Ingest / Normalize

Цель: предсказуемый, безопасный вход для CV (особенно iPhone/Telegram).

Файлы: `src/vision/images.py`, правка upload-пути в `src/jobs_api.py`.

Задачи: MIME/декодируемость/размер; auto-orient по EXIF; конверсия HEIC→JPEG/PNG; strip EXIF/GPS;
downscale по long side (CV-копия 1280–1536, оригинал отдельно); sRGB; dedup по sha256/`imagehash`.
Тяжёлую обработку — в thread/process pool, не блокировать event loop.

Библиотеки: `Pillow`, `pillow-heif`, `opencv-python-headless`, `imagehash`, `numpy`. Пины — в
`requirements.txt` (точные версии, без latest вслепую).

Проблемы и решения:
- HEIC не открывается → подключить `pillow-heif`, тест на реальном HEIC.
- Повёрнутые фото → `ImageOps.exif_transpose` до любых CV-операций.
- OOM на больших фото → downscale до обработки, ограничить max pixels (`Image.MAX_IMAGE_PIXELS`).
- Блокировка event loop → `anyio.to_thread.run_sync` / `ProcessPoolExecutor`.

Acceptance: загрузка HEIC и повёрнутого JPEG даёт корректно ориентированную нормализованную копию;
оригинал и CV-копия в Storage; дубликаты детектируются.

### P3 — Quality Gate

Цель: до дорогой генерации решить `accepted | warning | rejected`, встроив существующую модель
видимости колёс.

Файлы: `src/vision/quality_gate.py`, стадия `stages.check_input`, миграция `0018_quality_metadata.sql`
(или JSONB-колонка в `render_analyses`).

Задачи (cascade от дешёвого к дорогому):
1. Cheap CV: blur (variance of Laplacian), brightness/contrast (гистограмма), разрешение, кроп.
2. Detector: существующая модель / YOLO-seg → есть машина, число видимых колёс, visible fraction.
3. (опц., за флагом) VLM-чек ракурса/перекрытий.
Писать `InputQualityReport`. По умолчанию `warning`, hard reject только для очевидно невозможного.

Библиотеки: `OpenCV`, `numpy`, `Ultralytics`, VLM через провайдера.

Проблемы и решения:
- Ложные reject → начинать с warning-режима, собирать метрики (`quality_metadata`), включать жёсткий
  порог только по данным.
- Дорогой VLM на каждом фото → VLM-ступень только если cheap-CV/detector неоднозначны.

Acceptance: плохое фото (нет машины/колёс) → `rejected` с причиной без вызова генерации; нормальное →
`accepted`; отчёт сохраняется.

### P4 — Wheel Segmentation + Geometry (ядро качества)

Цель: точные маски целевых колёс + геометрия для контроля генерации.

Файлы: `src/vision/wheel_segmentation.py`, `src/vision/geometry.py`, стадия `stages.segment_wheels`.
Инференс — на GPU-сервисе (раздел 10), backend вызывает по HTTP/очереди.

Задачи:
1. `YOLO26-seg`/`YOLO11-seg` (дообученный на колёсах) → bbox, грубая маска, позиция, visible fraction, occlusion.
2. `SAM 2` box-prompt по выбранным колёсам → pixel-perfect маска (НЕ по всему кадру — дорого).
3. `cv2.fitEllipse` → center/оси/угол; отделить rim от tyre; маска арки для защиты кузова.
4. Fallback `SAM 3` concept-seg по тексту «wheel» для странных ракурсов.
Писать `WheelGeometryReport` + маски как assets.

Библиотеки: `ultralytics`, `segment-anything-2`, `opencv`, опц. `Depth-Anything-V2` для control-карты,
`albumentations` (обучение), датасеты — `Roboflow` + ручная разметка hard cases.

Проблемы и решения:
- SAM по всему изображению медленный/дорогой → только box-prompt от YOLO.
- Колесо обрезано/перекрыто → `replaceable=false`, не пытаться заменять; пометить как warning.
- Нет GPU в backend → отдельный GPU-worker, backend асинхронно ждёт результат.
- Холодный старт модели → держать warm-инстанс или serverless с min-instances.

Acceptance: на тест-наборе из 20–30 фото маски визуально точные (IoU по ручной разметке выше порога),
эллипс и target_wheels определяются, артефакты сохранены для дебага.

### P5 — RenderPlan + provider interface

Цель: убрать промпт-строительство из routes/provider, сделать провайдеры заменяемыми.

Файлы: `src/pipeline/render_plan.py`, `src/generation/providers/base.py`,
`src/generation/providers/reve.py` (обёртка `src/reve_client.py`), `src/generation/prompt_builder.py`,
`src/generation/router.py`, `src/pipeline/attempts.py`, миграции
`0019_render_plans.sql`, `0020_generation_attempts.sql`.

Задачи:
- `ImageGenerationProvider.generate(plan: RenderPlan) -> GenerationResult` (ABC/Protocol).
- `prompt_builder` собирает промпт из плана + understanding (версионированный `prompt_version`).
- `router` выбирает провайдера/режим по флагам.
- Существующий Reve-вызов переехать за интерфейс без смены поведения.

Проблемы и решения:
- Скрытая связанность с Reve-специфичным форматом → нормализовать вход/выход в `GenerationResult`.
- Невоспроизводимость → хранить `plan_json` и версии; `raw_response_ref` в Storage.

Acceptance: генерация идёт через провайдер-интерфейс, план и attempt сохраняются, поведение для
пользователя не изменилось.

### P6 — Post-generation Validation + internal retry

Цель: независимая проверка результата и бесплатный авто-ретрай при провале.

Файлы: `src/validation/*.py`, стадия `stages.validate_result`, доработка `orchestrator` (retry-петля).

Задачи:
- Vehicle preservation: повторный детект машины, сравнение немаскированной области (SSIM/embedding).
- Wheel consistency: повторный детект колёс, IoU боксов до/после, нет лишнего диска на кузове/фоне.
- Rim similarity: crop результата vs reference диска (`DINOv2`/`OpenCLIP` cosine) + цвет/спицы.
- (опц.) VLM QA «один ли диск на всех колёсах, не изменилась ли машина, есть ли артефакты».
- Вердикт `return | retry | fail`; при `retry` — до `max_internal_retries` с изменённым планом
  (другая маска/control strength/провайдер), retry НЕ биллится.

Библиотеки: `ultralytics`, `open_clip`/`dinov2`, `scikit-image` (SSIM), VLM.

Проблемы и решения:
- Бесконечный retry-цикл → жёсткий лимит + после лимита `fail` с refund.
- Двойное списание кредита на retry → биллинг только на `completed`, флаг `billable=false`.
- Порог similarity субъективен → калибровать на размеченном наборе из P8.

Acceptance: подложенный «битый» результат (изменена машина / лишний диск) → `retry`/`fail`;
корректный → `return`; пользователь видит один списанный кредит независимо от числа internal retry.

### P7 — Vehicle / Rim Understanding (VLM + RAG + OCR)

Цель: распознавать машину/диск и нормализовать данные с provenance.

Файлы: `src/understanding/vehicle_vlm.py`, `vehicle_rag.py`, `rim_vlm.py`, `rim_ocr.py`,
`normalization.py`, миграции `0021_vehicle_rim_understanding.sql` (+ `pgvector` extension и таблица
справочника, если RAG локальный).

Задачи:
- VLM (`Qwen3-VL`/`InternVL`) со structured JSON output (Pydantic-схема / `xgrammar`/`outlines`).
- RAG: справочник машин и штатных размеров, эмбеддинги (`BGE-M3`/`OpenCLIP-text`) в `pgvector`,
  retrieval по VLM-гипотезе.
- OCR (`PaddleOCR`/`RapidOCR`) маркировки/упаковки/скрина диска.
- `normalization`: слияние источников по trust (catalog > user_sku > user_specs > ocr > vlm > unknown),
  хранить provenance/confidence, конфликты не затирать молча.
- User input всегда override VLM.

Проблемы и решения:
- VLM «галлюцинирует» точные значения → возвращать только то, что подтверждено; иначе `unknown`.
- Свободный текст вместо JSON → structured outputs/Pydantic-валидация на границе.
- Лицензии внешнего справочника (Wheel-Size API и т.п.) → проверить право на кэш/показ, хранить
  `provider/version/fetched_at`; см. [fitment-provider-discovery.md](fitment-provider-discovery.md).
- pgBouncer transaction mode + asyncpg → `statement_cache_size=0` (см. CLAUDE.md).

Acceptance: для тест-набора VLM выдаёт валидный JSON, RAG возвращает релевантного кандидата,
конфликт источников отражён в provenance, user input побеждает.

### P8 — Evaluation harness + benchmark

Цель: измеримое качество, сравнение провайдеров/версий, накопление датасета.

Файлы: `src/evaluation/datasets.py`, `metrics.py`, `benchmark.py`; версионированный case set (100–200
кейсов, как в `DreamWheels_LoRA_Model_Selection`).

Задачи:
- Хранить inputs, plan/prompt-версии, output, labels, scores, cost, latency для каждого кейса.
- Метрики: vehicle preservation, rim similarity, artifact rate, success rate, $/успешный рендер, latency.
- Сравнение провайдеров (Reve vs FLUX Kontext vs Qwen-Image-Edit 2509) на одном наборе.
- Не импортировать evaluation в request handlers.

Проблемы и решения:
- Нерепрезентативный набор → включить hard cases (плохой ракурс, перекрытие, тёмные фото, редкие диски).
- Дрейф метрик между релизами → фиксировать `pipeline_version`/`prompt_version` в каждом прогоне.

Acceptance: `benchmark.py` прогоняет набор, выдаёт сравнительную таблицу метрик и стоимости.

### P9 — Generation upgrade (только после P8)

Цель: максимизировать качество на основе данных, не вслепую.

Варианты (выбор по бенчмарку):
- Managed: переключить дефолт на `FLUX.1 Kontext (pro/max)` или `Qwen-Image-Edit 2509` (multi-image
  reference диска нативно). Реализовать `flux_kontext.py`/`qwen_edit.py` за тем же интерфейсом.
- Self-host control: SDXL/FLUX.1-dev + inpainting + `ControlNet` (depth/canny по маске, фиксирует
  геометрию) + `IP-Adapter` (reference диска, scale 0.5–0.7, structural ControlNet первым) +
  soft/differential inpainting на границе маски.
- Fine-tune DreamWheels LoRA на победителе; Reve 1.1 как teacher для генерации датасета.

Библиотеки self-host: `diffusers`, `transformers`, `accelerate`, `controlnet-aux`, `torch`;
инференс через `ComfyUI` или прямой `diffusers` pipeline; serving — отдельный GPU-сервис.

Проблемы и решения:
- Identity drift диска → reference-guided генерация + проверка similarity в P6, не «надежда на промпт».
- Дорогой self-host GPU → переходить только если бенчмарк доказывает выигрыш качества/цены.
- LoRA рано → запрещено без датасета и бенчмарка (иначе оптимизация вслепую).

Acceptance: новый дефолтный путь генерации на бенчмарке P8 не хуже текущего по preservation/similarity
и лучше по целевой метрике; переключение за флагом с возможностью отката.

---

## 7. Миграции (порядок и правила)

Следующий свободный номер — `0017` (текущий максимум `0016_credit_ledger_expiration_compat.sql`).
Каждая миграция идемпотентна (`IF NOT EXISTS`/`ADD COLUMN IF NOT EXISTS`), упорядочена, применяется
вручную через Supabase SQL Editor (см. [migrations/README.md](../migrations/README.md)).

| Миграция | Фаза | Содержание |
|---|---|---|
| 0017_pipeline_stage.sql | P1 | `jobs`: pipeline_stage, pipeline_version, prompt_version, quality_policy_version, error_code |
| 0018_quality_metadata.sql | P3 | `render_analyses` или JSONB quality_metadata |
| 0019_render_plans.sql | P5 | таблица render_plans (plan_json, version) |
| 0020_generation_attempts.sql | P5 | таблица generation_attempts |
| 0021_vehicle_rim_understanding.sql | P7 | vehicle/rim JSON + pgvector extension + справочник |

Деструктивные изменения (DROP/массовый DELETE) — только с явным подтверждением. Все DDL только через
`migrations/`, не править схему через Supabase UI.

---

## 8. Cross-cutting требования

- Версионирование: `pipeline_version`, `prompt_version`, `quality_policy_version` в каждом job и
  каждом benchmark-прогоне. Без этого нельзя сравнивать релизы.
- Идемпотентность: upload по idempotency-key (уже есть), переходы стадий — optimistic guard.
- Биллинг: reserve при создании, charge при `completed`, refund при `failed`/`rejected`; internal
  retry не биллится. Любые правки кредитов — через `credits_service`/ledger, не напрямую.
- Логирование: `logger.exception` в `except`, контекст `job_id/user_id/telegram_user_id`, эмодзи
  статусов, без секретов.
- Конфиг: все ключи/флаги через `src/config.py` + `.env.example`. Ничего хардкодом.
- Безопасность путей: проверять ownership job в `GET /jobs/{id}/*` (текущий privacy-gap из анализа репо).

---

## 9. Наблюдаемость

- Структурные логи на каждый переход стадии: `job_id`, `pipeline_stage`, `model`, `version`,
  `latency_ms`, `cost`.
- Метрики (минимум, в логи/таблицу): per-stage latency, success/fail/retry rate, $/успешный рендер,
  reject-rate quality gate, validation-fail rate.
- Дебаг-артефакты (маски, control-карты, raw provider response) в Storage за `debug`-флагом и с
  retention-политикой (не хранить вечно).

---

## 10. Инфраструктура и GPU offload

Backend на Render (CPU) НЕ держит GPU-модели. Тяжёлые стадии (SAM2, VLM self-host, diffusion self-host)
выносятся:

- Managed inference API (старт): fal.ai / Replicate / Reve — провайдеры за `generation/providers/*`.
- Self-host GPU worker (позже): RunPod / Modal / отдельный GPU-инстанс, своя очередь задач.
  Backend кладёт задачу, асинхронно ждёт результат (Redis-очередь у нас уже есть).

Учитывать:
- Render Free spin-down 15 мин убивает long-poll бота (keep-alive — см. docs/keep-alive-setup.md).
- Холодный старт GPU-моделей → warm min-instances или принять задержку первого запроса.
- Лимиты Upstash Free tier на размер/частоту → не гонять байты картинок через Redis, только ссылки/ID.
- asyncpg на Supabase pooler (transaction mode, порт 6543) → `statement_cache_size=0`.

---

## 11. Каталог проблем и решений (failure modes)

| Проблема | Симптом | Решение |
|---|---|---|
| Identity drift диска | на результате диск не похож на референс | reference-guided (IP-Adapter/multi-image) + similarity-проверка в P6 |
| Геометрия/перспектива | диск неправильного размера/наклона | маска + ellipse + depth control-карта |
| Рассинхрон осей | разные диски на колёсах | проверка консистентности всех target wheels в P6 |
| Порча кузова/арки | артефакты вокруг колеса | маскировать только колесо, защита арки, soft/differential inpainting |
| HEIC/EXIF/большие фото | падение или повёрнутый вход | нормализация в P2 (pillow-heif, exif_transpose, downscale) |
| Дорогая/медленная генерация | высокий $/латентность | quality gate ДО генерации, не биллить retry, кэш по dedup |
| VLM-галлюцинации | выдуманные точные спеки | structured output + provenance, `unknown` вместо догадки |
| Двойная обработка job | дубль рендера/списания | optimistic guard + Redis-lock по job_id |
| Бесконечный retry | job не завершается | жёсткий лимит retry → fail + refund |
| Невоспроизводимость | нельзя сравнить релизы | версионирование плана/промпта/политики |
| Протухший Telegram URL | вход недоступен воркеру | копировать в Storage до очереди (P0) |
| Privacy gap | чужой job доступен по id | проверка ownership в job-эндпоинтах |

---

## 12. Зависимости (добавлять с пинами)

CPU backend (`requirements.txt`): `Pillow`, `pillow-heif`, `opencv-python-headless`, `numpy`,
`imagehash`, `scikit-image`, `pydantic` (есть), HTTP-клиент к inference (есть).

GPU worker (отдельный requirements/сервис): `torch`, `ultralytics`, `segment-anything-2`, `open_clip_torch`
или `dinov2`, `diffusers`, `transformers`, `accelerate`, `controlnet-aux`, `vllm` (для VLM self-host),
`paddleocr`/`rapidocr-onnxruntime`, `albumentations`.

RAG: `pgvector` (расширение Postgres), эмбеддер (`FlagEmbedding`/`sentence-transformers` или API).

Не ставить latest вслепую — фиксировать версии, тестировать совместимость (особенно torch/CUDA).

---

## 13. Verification / Definition of Done

Запускать после каждой фазы (см. CONTRIBUTING / CI):

```bash
ruff check .
ruff format --check .
python -m compileall src/ tests/ -q
pytest -q
```

Definition of Done для фазы:
- Acceptance criteria фазы выполнены.
- Новый код за feature-flag, дефолт сохраняет прежнее поведение.
- `.env.example` и `migrations/README.md` обновлены при необходимости.
- Тесты на новое поведение добавлены и зелёные.
- Логи соответствуют конвенции, секреты не светятся.
- PR в `dev` (не в `main`), атомарные conventional-commits.

---

## 14. Связанные документы

- [ai-rendering-pipeline.md](ai-rendering-pipeline.md) — canonical pipeline (верхний уровень).
- [architecture.md](architecture.md) — диаграммы потоков и job lifecycle.
- [data-model.md](data-model.md) — целевая модель данных.
- [fitment-provider-discovery.md](fitment-provider-discovery.md) — выбор источников fitment-данных.
- [product-roadmap.md](product-roadmap.md) — продуктовые треки и приоритеты.
- [migrations/README.md](../migrations/README.md) — стратегия миграций.
- [CONTRIBUTING.md](../CONTRIBUTING.md) — стиль, логирование, ветки, безопасность.
