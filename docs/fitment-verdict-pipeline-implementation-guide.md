# Fitment Verdict Pipeline — Implementation Guide (agent-executable)

> Production implementation status: `src/fitment` is canonical. Use
> `fitment-production-test.md` for environment, migrations and live smoke.

> Назначение: пошаговая инструкция для построения ВТОРОГО pipeline — технической совместимости
> (verdict). На вход: фото машины + фото диска (+ опционально любые данные). Задача: если данных нет —
> определить машину и диск, но ГЛАВНОЕ — детерминированно решить, подходят ли диски к машине, и выдать
> объяснимый вердикт (`compatible` / `compatible_with_conditions` / `unknown` / `incompatible`).
>
> Этот документ настолько подробный, чтобы агентный LLM мог построить архитектуру без внешних решений:
> какие модели брать, с какими параметрами, как тюнить, что куда класть, в каком порядке, какие проблемы
> возникнут и как их решать.
>
> Это НЕ визуальная примерка. Визуальный pipeline — в
> [fitment-pipeline-implementation-guide.md](fitment-pipeline-implementation-guide.md). Два pipeline
> независимы: успешный рендер не доказывает физическую совместимость, и наоборот.
>
> Источники истины: [fitment-compatibility.md](fitment-compatibility.md),
> [fitment-provider-discovery.md](fitment-provider-discovery.md),
> [adr/0002-fitment-provider-abstraction.md](adr/0002-fitment-provider-abstraction.md),
> [data-model.md](data-model.md). Внешний провайдер: Wheel-Size API
> (<https://developer.wheel-size.com/>). Прототип-референс: `wheel_fitment_test_v2/`.
>
> Перед правками кода читать [CONTRIBUTING.md](../CONTRIBUTING.md).

---

## 0. Как пользоваться этим документом (для агента)

1. Работать пофазно (V0…V7). Не начинать `Vn+1` без выполнения Acceptance фазы `Vn`.
2. Одна фаза = ветка `feature/fitment-verdict-vX-<slug>` → PR в `dev`. Не пушить в `main`.
3. Провайдер (Wheel-Size) НЕ появляется в route handlers, enum'ах БД, правилах. Только за адаптером
   `FitmentProvider` (ADR 0002).
4. LLM/VLM НЕ решают совместимость. Они предлагают идентификацию машины/диска и объясняют результат
   словами. Истина — детерминированные правила поверх структурных данных.
5. Нет данных для критического параметра → `unknown` (или условие в `compatible_with_conditions`).
   НИКОГДА не выдумывать значение и не выводить «подходит на 100%».
6. Лицензионный инвариант Wheel-Size: **cataloging-методы** (`/makes/`,`/models/`,`/years/`,
   `/generations/`,`/modifications/`) можно кэшировать; **search-методы** (`/search/by_model/` и т.п.)
   вызываются только в ответ на действие реального пользователя, массовый префетч запрещён ToS.
7. Новая env → обновить `.env.example`. DDL → идемпотентная миграция (следующий свободный номер;
   согласовать нумерацию с визуальным гайдом, чтобы не столкнуться на `0017`).
8. После правок: `ruff check .`, `ruff format --check .`, `pytest -q` (раздел 12).
9. Логи: `logger.exception` в `except`, контекст (`verdict_job_id`, `user_id`, `telegram_user_id`),
   ключ Wheel-Size только из env, не в логах/чате.

Инвариант: вердикт — предварительная оценка, не гарантия. Финальное решение — установщик. Ввод
пользователя (подтверждённая машина/диск) приоритетнее VLM.

---

## 1. Baseline и целевое

Прототип `wheel_fitment_test_v2/` (вне прода):

- `vlm_model_probe.py` — VLM (OpenAI Responses, `json_schema strict`, модель по умолчанию `gpt-4.1-mini`)
  определяет make/model/year_from/year_to/body/market → `search_candidates` (перебор годов + регион).
- `generate_search_from_vlm_and_run.py` — перебор кандидатов, вызов `/v2/search/by_model/` c файловым
  кэшем, извлечение allowed wheels, генерация демо-дисков.
- `fitment_test_v3.py` — детерминированный движок: `extract_vehicle_level_constraints`
  (bolt_pattern/pcd/centre_bore), `extract_allowed_wheels` (front/rear rim_diameter/width/offset),
  `validate_wheel_only_v2` (mounting mismatch → approved size → offset tolerance).

Чего не хватает для прода (обязательно закрыть):
- sync `requests` → async `httpx`;
- нет Pydantic-контрактов;
- нет rim understanding из фото (VLM/OCR диска);
- center bore: обрабатывается только «меньше = fail», нет «больше = условие с кольцами»;
- нет provenance/confidence по каждому значению;
- нет резолва через modification slug (сейчас только make/model/year → грубо);
- нет кэша с TTL/версией провайдера в БД, только файлы;
- нет учёта лицензии/лимитов/ошибок Wheel-Size;
- регион зашит грубо (russia/chdm), нет нормализации через cataloging-методы.

Целевое: продакшен-модуль `src/fitment/` — провайдер-абстракция, детерминированный rule engine, кэш
cataloging + профиля, идемпотентность, объяснимый вердикт, UX-карта. Отдельная ценность (до Wallet),
вызывается из бота/Mini App независимо от визуальной генерации.

---

## 2. Целевая структура кода

```text
src/
  fitment/
    __init__.py
    service.py             # оркестрация: intake → identify → resolve → specs → rules → verdict
    schemas.py             # Pydantic-контракты (раздел 4)
    config.py              # версии/допуски/таймауты/пороги (раздел 6), читает env
    identification/
      vehicle_vlm.py       # VLM: фото машины → кандидаты (strict JSON)
      rim_vlm.py           # VLM: фото диска → визуальные признаки (+ осторожные спеки)
      rim_ocr.py           # OCR маркировки/наклейки/упаковки диска
      normalization.py     # слияние источников по trust + provenance
    providers/
      base.py              # FitmentProvider (Protocol): resolve_vehicle, get_fitment_profile
      wheel_size.py        # адаптер Wheel-Size v2 (async httpx)
      catalog.py           # cataloging-методы (makes/models/years/generations/modifications) + локальный кэш
      cache.py             # кэш нормализованного профиля (БД) + raw-ref (Storage)
    rules/
      engine.py            # прогон всех проверок → RuleResult[]
      checks.py            # bolt/pcd, center_bore, diameter, width, offset, fastener, load, axle
      tolerances.py        # версионируемые константы допусков (раздел 6.4)
      verdict.py           # свёртка RuleResult[] → FitmentVerdict
    presentation.py        # UX-карта + дисклеймер
  fitment_api.py           # HTTP-эндпоинты (тонкие; логика в service)
```

Правило слоёв: `providers/*` знают Wheel-Size; `rules/*` работают только с нормализованными
`FitmentProfile`/`RimSpec` и не знают провайдера (тестируемость + отсутствие lock-in).

---

## 3. Инвариант источников (trust order)

```text
user_confirmed > catalog/partner_feed > provider (Wheel-Size) > ocr > vlm > unknown
```

- Машина: VLM предлагает → пользователь подтверждает/правит → провайдер резолвит нормализованную ссылку
  (make/model/generation/modification slug) → возвращает `FitmentProfile`.
- Диск: user specs/SKU/URL → OCR маркировки → VLM визуально → `unknown`.
- Каждое значение несёт `source`, `confidence`, `is_user_confirmed`. Конфликты хранить, не затирать.

---

## 4. Контракты данных (Pydantic) — определить первыми

Файл `src/fitment/schemas.py`.

```python
from enum import StrEnum
from pydantic import BaseModel, Field


class Source(StrEnum):
    user_input = "user_input"
    catalog = "catalog"
    partner_feed = "partner_feed"
    provider = "provider"
    ocr = "ocr"
    vlm = "vlm"
    unknown = "unknown"


class VerdictStatus(StrEnum):
    compatible = "compatible"
    compatible_with_conditions = "compatible_with_conditions"
    unknown = "unknown"
    incompatible = "incompatible"


class VehicleQuery(BaseModel):
    make: str | None = None
    model: str | None = None
    year: int | None = None
    generation: str | None = None
    modification: str | None = None        # provider modification slug when resolved
    make_slug: str | None = None
    model_slug: str | None = None
    generation_slug: str | None = None
    modification_slug: str | None = None
    body: str | None = None
    region: str | None = None              # usdm / eudm / jdm / russia / chdm / ...
    source: Source = Source.unknown
    confidence: float = 0.0
    is_user_confirmed: bool = False


class AxleFitment(BaseModel):
    axle: str                              # front | rear
    rim_diameter: float
    rim_width: float
    offset: float | None = None            # ET
    is_stock: bool | None = None
    tire: str | None = None


class FitmentProfile(BaseModel):
    provider: str
    provider_version: str | None = None
    fetched_at: str
    raw_response_ref: str | None = None
    bolt_pattern: str | None = None        # normalized "5x114.3"
    stud_holes: int | None = None
    pcd: float | None = None
    center_bore: float | None = None       # hub bore
    fastener_type: str | None = None       # "lug nuts" / "bolts"
    thread_size: str | None = None         # "M12 x 1.5"
    tightening_torque: str | None = None
    allowed_wheels: list[AxleFitment] = Field(default_factory=list)
    oem_offset_front: float | None = None
    oem_offset_rear: float | None = None


class RimSpec(BaseModel):
    diameter: float | None = None
    width: float | None = None
    offset: float | None = None            # ET
    bolt_pattern: str | None = None
    pcd: float | None = None
    center_bore: float | None = None
    fastener_seat: str | None = None
    load_rating: float | None = None
    brand: str | None = None
    model: str | None = None
    source: Source = Source.unknown
    confidence: float = 0.0
    is_user_confirmed: bool = False


class RuleResult(BaseModel):
    rule: str
    status: VerdictStatus
    reason: str
    detail: dict = Field(default_factory=dict)


class FitmentVerdict(BaseModel):
    status: VerdictStatus
    rule_results: list[RuleResult]
    reasons: list[str] = Field(default_factory=list)
    conditions: list[str] = Field(default_factory=list)
    missing_data: list[str] = Field(default_factory=list)
    vehicle: VehicleQuery
    rim: RimSpec
    profile_ref: str | None = None
    engine_version: str
    tolerances_version: str
    provider: str
    is_preliminary: bool = True
```

Acceptance: импортируется, smoke-тест сериализации, `ruff` чистый.

---

## 5. Wheel-Size API v2 — детальная интеграция

Базовый REST: `https://api.wheel-size.com/v2/`. Auth: query-параметр `user_key` (из env
`WHEEL_SIZE_API_KEY`). v1 отключён с 2023-07-01 — только v2.

### 5.1 Два класса методов (лицензионно важно)

- **Cataloging (кэшируемые, можно хранить локально):** `/makes/`, `/models/`, `/years/`,
  `/generations/`, `/modifications/`. Использовать для нормализации VLM-строк в валидные slug провайдера.
  Периодически обновлять. Для этих методов можно передавать несколько регионов.
- **Search (только по действию пользователя, префетч запрещён):** `/search/by_model/`,
  `/by_rim/search/`, `/by_tire/search/` и `..._modifications`. Для `/search/by_model/` — ровно один
  регион. Массовый парсинг/крон-префетч нарушает ToS и приведёт к блокировке ключа.

Практический вывод для архитектуры: cataloging кэшируем агрессивно (TTL 7–30 дней) и используем для
резолва; search вызываем лениво по реальному запросу и кэшируем результат как побочный продукт запроса
пользователя (TTL 24–72 ч), НЕ префетчим наборы заранее.

### 5.2 Лестница резолва (ladder), а не «сырой» make/model/year

Прототип шлёт make/model/year напрямую — грубо. Правильный путь через cataloging для точной модификации:

```text
VLM guess (make/model/year/market)
 → /makes/            → make_slug            (fuzzy match по name/name_en)
 → /models/?make=     → model_slug
 → /years/?make=&model= → validate year
 → /generations/?make=&model=&year= → generation_slug (по year range/body)
 → /modifications/?make=&model=&year=&generation= → modification_slug (движок/тип кузова)
 → /search/by_model/?make=&model=&year=&modification=&region=&user_key=  [user-initiated]
```

Если модификацию однозначно не выбрать — допускается `/search/by_model/` без modification (вернёт набор
модификаций/усреднённые данные), но точность ниже; помечать `confidence` соответствующе. Всегда
предпочитать резолв до modification, когда возможно.

### 5.3 Маппинг ответа `/search/by_model/` → `FitmentProfile`

Ответ (по факту v2) содержит `data[]` с блоками. Извлекать:

| Источник в ответе | Поле `FitmentProfile` |
|---|---|
| `technical.bolt_pattern` (или `stud_holes`+`pcd`) | `bolt_pattern` |
| `technical.stud_holes` | `stud_holes` |
| `technical.pcd` | `pcd` (float) |
| `technical.centre_bore` (строка, напр. "67.1") | `center_bore` (float) |
| `technical.fasteners.type` ("Lug nuts") | `fastener_type` |
| `technical.fasteners.thread_size` ("M12 x 1.5") | `thread_size` |
| `technical.fasteners.wheel_tightening_torque` | `tightening_torque` |
| `wheels[].front/rear.{rim_diameter,rim_width,offset,is_stock}` | `allowed_wheels[]` |
| `wheels[]` где `is_stock=true` | `oem_offset_front/rear` |
| `generation.slug`, `modification` | резолв ссылки |

Нормализация: `bolt_pattern` → lower, убрать пробелы, `×`→`x` (как в прототипе). `centre_bore`/`pcd`/
offset → float с защитой от `null`/`"N/A"`/`""`.

### 5.4 Регионы и рынок

VLM отдаёт `market_guess` → маппить в регион провайдера. Дефолтная таблица (расширять по discovery):

| market_guess | region | fallback |
|---|---|---|
| russia | russia | chdm |
| chdm (Китай) | chdm | russia |
| europe | eudm | usdm |
| usa | usdm | eudm |
| japan | jdm | eudm |
| korea | kdm | eudm |

Для `/search/by_model/` регион один. При пустом `data[]` — повторить с fallback-регионом (как прототип
russia↔chdm), затем — `unknown`.

### 5.5 Клиентские параметры (по умолчанию, в `fitment/config.py`)

- `WHEEL_SIZE_BASE_URL = "https://api.wheel-size.com/v2"`
- httpx timeout: `connect=5s`, `read=20s`, `total≈25s`.
- retries: 3, экспоненциальный backoff `0.5s → 1s → 2s`, только на `429`/`5xx`/сетевых; на `4xx` (кроме 429) — не ретраить.
- Квоты сбрасываются в 0:00 GMT. При исчерпании дневного лимита — отдавать `unknown` (cache-only) и логировать, не падать.
- Sandbox 300 hits/day (НЕ прод); Basic 5k/day; Business 30k/day → кэш обязателен, дедуп по (make_slug,model_slug,year,modification_slug,region).

---

## 6. Модели, параметры и тюнинг

### 6.1 Vehicle identification (VLM)

Задача: фото машины → make/model/year range/body/market с confidence, строгий JSON.

- Модель (managed, старт): `gpt-4.1-mini`/актуальный vision-класс через API (как прототип) — дёшево,
  structured output из коробки (`json_schema strict`). Или `gpt-5`-класс для сложных кейсов.
- Модель (self-host / приватность / объём): `Qwen3-VL` (Instruct) через `vLLM` — сильное omni-recognition
  автомобилей и 2D-grounding; строгий JSON через `guided_json`/`xgrammar`/`outlines`. Альтернатива — InternVL-класс.
- Параметры: `temperature=0` (детерминизм), `top_p=1`, `max_tokens` небольшой (схема мелкая),
  один вызов на фото. Изображение ≤ ~1024–1536 по длинной стороне (см. Ingest), data URL/base64.
- Промпт (консервативный, как в прототипе): «идентифицируй максимально консервативно; при неуверенности —
  диапазон годов; confidence 0..1; market_guess из фиксированного списка или null; не упоминай fitment».
- Тюнинг:
  - `VLM_MIN_CONFIDENCE = 0.4`: ниже — не запускать резолв автоматически, просить ввод пользователя.
  - Диапазон годов ограничить (`year_to - year_from <= 2`), иначе слишком много search-кандидатов.
  - Порядок кандидатов: по confidence, затем текущий год к более старым.
  - Валидация make/model через cataloging fuzzy-match (`rapidfuzz`, `token_sort_ratio >= 85`), чтобы не
    слать в провайдер несуществующие строки.

### 6.2 Rim understanding (VLM + OCR)

Задача: фото диска → визуальные признаки + осторожные спеки (если видимы) + текст маркировки.

- VLM (тот же, что 6.1): style (mesh/5-spoke/multi-spoke/dish), spoke_count, primary/secondary color,
  finish (gloss/matte/polished/chrome). Размеры/ET/PCD — только «если явно видна маркировка», иначе
  не заполнять; всё от VLM помечать `source=vlm`, низкий confidence, `is_user_confirmed=false`.
- OCR маркировки/наклейки/упаковки:
  - `PaddleOCR` (PP-OCRv4/v5) — сильнее на мелком тексте/наклонах; включить angle classifier
    (`use_angle_cls=True`), `drop_score≈0.5`. Или `RapidOCR` (onnxruntime) — легче для CPU-backend.
  - Пост-парсинг регэкспами: `\d{1,2}(\.\d)?x\d{1,2}(\.\d)?` (размер), `ET\s?-?\d{1,3}`, `\d x \d{2,3}(\.\d)?`
    (bolt pattern), `CB\s?\d{2,3}(\.\d)?`.
- Тюнинг:
  - VLM-размеры/ET считать «наблюдением», не фактом: в rule engine они дают максимум `conditions`, не `compatible`.
  - OCR-совпадение по нескольким кадрам/строкам повышает confidence; одиночное — низкий.
- Embeddings (для G7 recommendations, не для вердикта): `DINOv2 ViT-L/14` или `OpenCLIP ViT-H/14`,
  cosine; порог дубликата/матча `~0.85`. Хранить в `pgvector`.

### 6.3 Structured output (обязательно)

- API: OpenAI `response_format`/`text.format = json_schema, strict=true` (как в `vlm_model_probe.py`).
- Self-host: `vLLM` + `guided_json` (backend `xgrammar`) или `outlines`. Валидировать результат Pydantic
  на границе; при невалидном JSON — один ретрай с ужесточённым промптом, затем `unknown`.

### 6.4 Rule engine — допуски и тюнинг (версионируемые константы)

Файл `src/fitment/rules/tolerances.py`, версия `TOLERANCES_VERSION` попадает в вердикт.

```python
TOLERANCES_VERSION = "v1"

PCD_TOL_MM = 0.1              # равенство PCD
CB_TOL_MM = 0.1              # равенство центрального отверстия

# Offset / ET относительно OEM (индустрия: ±5-8 безопасно, ±10 практично, >15 проблемы, >25 опасно).
# Асимметрия: внутрь (выше ET, к подвеске) допускается меньше, чем наружу (ниже ET, к арке).
ET_OK_BAND_MM = 5            # |ET - OEM| <= 5  → ok
ET_INWARD_MAX_MM = 5        # ET выше OEM (к подвеске) сверх OK-полосы → до +5 условие, дальше warn
ET_OUTWARD_MAX_MM = 15      # ET ниже OEM (к арке) → до -15 условие, дальше warn
ET_HARD_LIMIT_MM = 25       # |dET| > 25 → трактовать как несовместимо/сильное предупреждение

# Размеры: приоритет — членство в allowed set провайдера. Обобщённые допуски — для baseline-фолбэка.
DIAMETER_TOL_IN = 0.1        # совпадение с approved
WIDTH_TOL_IN = 0.1
DIAMETER_PLUS_MINUS_IN = 1   # ±1" плюс/минус-сайз → conditions (при сохранении rolling radius)
WIDTH_CONDITION_IN = 1.0     # отклонение ширины до 1" → conditions
```

Семантика проверок (`checks.py`), каждая возвращает `RuleResult`:

1. **Bolt pattern / PCD (hard):** нормализованные bolt_pattern не равны ИЛИ `|pcd-pcd|>PCD_TOL` →
   `incompatible`. Если одно из значений неизвестно → правило даёт `unknown` (нельзя утверждать посадку).
2. **Center bore:** `rim_cb < hub_cb - CB_TOL` → `incompatible` (не сядет). `rim_cb > hub_cb + CB_TOL` →
   `compatible_with_conditions` (нужны hub-centric кольца). В пределах `CB_TOL` → ok. Неизвестно → `unknown`.
3. **Diameter:** совпадает с approved (в пределах `DIAMETER_TOL`) → ok. В пределах `±DIAMETER_PLUS_MINUS`
   от approved/OEM → `conditions`. Дальше → `incompatible`/`unknown` (нет данных о rolling radius).
4. **Width:** в approved → ok; отклонение до `WIDTH_CONDITION_IN` → `conditions`; больше → `conditions`/
   `incompatible` (совместно с offset). Ширину и offset оценивать вместе.
5. **Offset / ET:** известен и `|ET-OEM| <= ET_OK_BAND` → ok. В зоне `[OEM-ET_OUTWARD_MAX, OEM+ET_INWARD_MAX]`
   → `conditions` (влияет на арку/клиренс/подвеску). За `ET_HARD_LIMIT` → `incompatible`/сильное warn.
   Неизвестен → НИКОГДА `compatible`; минимум `unknown`/`conditions`.
6. **Fastener seat / thread:** несовпадение seat/thread → `conditions` (другой крепёж) или `incompatible`;
   неизвестно → `unknown`.
7. **Load rating:** если провайдер даёт нагрузку и есть масса авто — проверить; иначе `unknown`.
8. **Staggered/axle:** если профиль различает оси — сверять диск с правильной осью, не схлопывать.

Приоритет: если провайдер вернул `allowed_wheels`, основная логика — членство в approved set (как в
прототипе: exact_fit → uncertain(no ET) → size_not_approved). Обобщённые ET/размерные допуски — для
объяснения и baseline-фолбэка, когда approved set неполон.

Калибровка допусков: собрать 30–50 размеченных кейсов (V6), сравнить вердикты движка с проф-каталогами,
подстроить константы, поднять `TOLERANCES_VERSION`. Не менять числа по месту — только через версию.

---

## 7. Pipeline вердикта — стадии

```text
Inputs (car photo, rim photo, optional user data)
 → G0 Intake & normalize
 → G1 Vehicle identification (VLM)        [если машина не подтверждена]
 → G2 Vehicle resolution via provider     → FitmentProfile
 → G3 Rim spec acquisition (user>OCR>VLM) → RimSpec
 → G4 Deterministic rule engine           → RuleResult[]
 → G5 Verdict assembly                     → FitmentVerdict
 → G6 UX presentation (+ disclaimer)
 → (G7 Recommendations — отдельный слой, позже)
```

### G0 — Intake & normalize
Принять фото машины/диска и любые заданные поля; нормализовать изображения (EXIF/ориентация/размер —
переиспользовать `src/vision/images.py`, иначе локально); user-поля → `source=user_input`,
`is_user_confirmed=true`. Выход: `VehicleQuery`, `RimSpec` (могут быть пустыми), нормализованные фото.

### G1 — Vehicle identification (VLM)
Только если машина не подтверждена. VLM strict JSON (6.1) → кандидаты + fallback-регион (5.4). UX
подтверждения: показать топ-кандидата, дать исправить (подтверждение = высший trust). При
`confidence < VLM_MIN_CONFIDENCE` и отсутствии ввода — просить пользователя, не гадать.

### G2 — Vehicle resolution via provider
Пройти лестницу резолва (5.2) через cataloging (кэш), выбрать modification_slug, вызвать
`/search/by_model/` (user-initiated), нормализовать в `FitmentProfile` (5.3), кэшировать (БД + raw-ref).
Пустой ответ по всем кандидатам/регионам → `unknown` («vehicle not resolved»), pipeline продолжается
(диск опишем, но вердикт без allowed set будет ограничен).

### G3 — Rim spec acquisition
Источники по trust (6.2): user → SKU/URL → OCR → VLM → `unknown`. Каждое поле с `source`/`confidence`.
Критичны mounting (bolt/pcd, center_bore), размер (diameter/width), ET. Их отсутствие → корректный
`unknown`/`conditions`.

### G4 — Deterministic rule engine
Прогнать проверки (6.4) на `FitmentProfile` + `RimSpec` → `RuleResult[]`.

### G5 — Verdict assembly
Свёртка по худшему исходу:

```text
есть incompatible                          → incompatible
иначе критичные данные отсутствуют         → unknown
иначе есть conditions                       → compatible_with_conditions
иначе                                       → compatible (preliminary)
```

Собрать `reasons`/`conditions`/`missing_data`, проставить `provider`/`engine_version`/`tolerances_version`/
`is_preliminary=true`, ссылку на профиль. Сохранить вердикт + входы + provenance в БД.

### G6 — UX presentation
Карта результата без гарантий (см. fitment-compatibility.md):

```text
Техническая совместимость: требует проверки
Причина: ET и DIA не подтверждены.
Перед покупкой подтвердите установку у специалиста.
```

Не писать «подходит 100%». Показывать статус, причины, условия, «неизвестно». Вердикт доступен
независимо от визуального рендера.

### G7 — Recommendations (позже)
`confirmed profile + normalized catalog + fit score + visual similarity + availability → products`.
Не показывать конкретные товары без аудируемого каталога; до этого — CTA консультации/лида.

---

## 8. Порядок разработки (фазы)

| Фаза | Цель | Зависит | Риск |
|---|---|---|---|
| V0 | Контракты + config + skeleton + fitment_api заглушка | — | низкий |
| V1 | Rule engine + tolerances (офлайн, tested) | V0 | низкий |
| V2 | Wheel-Size адаптер: catalog(кэш) + search + профиль + БД-кэш | V0 | средний |
| V3 | Vehicle identification (VLM) + подтверждение | V0 | средний |
| V4 | Rim spec: user → OCR → VLM + provenance | V0 | средний |
| V5 | Verdict assembly + UX-карта + endpoints | V1,V2,V3,V4 | средний |
| V6 | Provider discovery 30–50 авто + калибровка допусков + ADR 0003 | V2,V5 | высокий |
| V7 | Recommendations (после аудируемого каталога) | V5 | высокий |

Логика: сначала детерминированное ядро на готовых данных (V1) — ценно и тестируемо без сети; затем
источник данных (V2); автоопределение (V3/V4); сборка/UX (V5); интеграционные решения+калибровка (V6);
коммерция (V7).

---

## 9. Фазы подробно (Файлы → Задачи → Проблемы/решения → Acceptance)

### V0 — Контракты, config, скелет
- Файлы: `schemas.py`, `config.py`, пустые модули (раздел 2), `fitment_api.py` (заглушки), router в `main.py`.
- env: `WHEEL_SIZE_API_KEY`, `WHEEL_SIZE_BASE_URL`, `FITMENT_VERDICT_ENABLED=false`,
  `FITMENT_ENGINE_VERSION`, `FITMENT_TOLERANCES_VERSION`, `FITMENT_PROVIDER=wheel_size`,
  `FITMENT_VLM_MODEL`, `FITMENT_VLM_MIN_CONFIDENCE=0.4`. Обновить `.env.example`.
- Acceptance: импортируется, `compileall`/`ruff`/`pytest` зелёные, флаг off.

### V1 — Rule engine + tolerances
- Файлы: `rules/tolerances.py`, `rules/checks.py`, `rules/engine.py`, `rules/verdict.py`,
  `tests/test_fitment_rules.py`.
- Задачи: перенести логику из `fitment_test_v3.py`, убрать sync I/O, чистые функции
  `check_*(profile, rim) -> RuleResult`, добавить center-bore «больше = conditions», ET-missing ≠ compatible,
  свёртку худшего исхода, версионируемые допуски (6.4).
- Проблемы/решения:
  - «нет данных = совместимо» — запрещено; дефолт при missing → `unknown`.
  - Магические числа по коду → `tolerances.py` + версия.
  - Нормализация bolt_pattern («5X114,3»/«×») → единый нормализатор + тесты.
- Acceptance: табличные офлайн-тесты на все 4 вердикта (incompatible: PCD/bolt; conditions: CB>hub, ET
  вне полосы; unknown: нет ET/CB; compatible: exact approved) зелёные, без сети.

### V2 — Wheel-Size адаптер + кэш
- Файлы: `providers/base.py`, `providers/wheel_size.py`, `providers/catalog.py`, `providers/cache.py`,
  миграция `fitment_provider_cache` + `fitment_catalog_cache`, `tests/test_wheel_size_provider.py` (моки httpx).
- Задачи: async httpx (5.5), лестница резолва (5.2), маппинг профиля (5.3), кэш cataloging (TTL 7–30д) и
  профиля (TTL 24–72ч, только как побочный продукт user-запроса), raw JSON в Storage, region-маппинг (5.4).
- Проблемы/решения:
  - ToS: search нельзя префетчить → вызывать только по user-действию; кэшировать результат для этого запроса.
  - Дневной лимит → кэш + дедуп + backoff; при исчерпании → `unknown` cache-only.
  - Разные размеры по регионам → регион обязателен, fallback-регион.
  - Пустой `data[]`/ошибка → `None` → вердикт-слой трактует как `unknown`.
  - `centre_bore` строкой/`"N/A"` → безопасный `to_float`.
- Acceptance: на замоканных ответах профиль нормализуется; кэш попадает/инвалидируется по TTL; ключ не логируется;
  cataloging и search кэшируются раздельно.

### V3 — Vehicle identification (VLM)
- Файлы: `identification/vehicle_vlm.py`, интеграция в `service.py`, endpoint подтверждения.
- Задачи: VLM strict JSON (6.1), кандидаты + fallback-регион, fuzzy-валидация make/model через catalog,
  UX подтверждения (user override), порог `VLM_MIN_CONFIDENCE`.
- Проблемы/решения:
  - Ошибка поколения/рынка → перебор кандидатов + подтверждение пользователем.
  - Свободный текст вместо JSON → structured output + Pydantic; ретрай → `unknown`.
  - Слишком широкий диапазон годов → ограничить (6.1).
- Acceptance: по фото возвращаются валидные кандидаты; подтверждённое пользователем побеждает VLM;
  низкий confidence уводит в запрос ввода, не в догадку.

### V4 — Rim spec acquisition
- Файлы: `identification/rim_vlm.py`, `rim_ocr.py`, `normalization.py`, тесты.
- Задачи: слияние по trust с provenance; OCR (6.2) + регэксп-парсинг; VLM визуальные признаки; осторожные
  размеры от VLM с низким confidence.
- Проблемы/решения:
  - VLM «придумывает» ET/PCD → низкий confidence, не user_confirmed → максимум `conditions`.
  - Конфликт user/OCR/VLM → хранить все, брать высший trust, показывать конфликт.
- Acceptance: user-спеки используются; при отсутствии OCR/VLM заполняют с корректным provenance;
  отсутствие критичных данных ведёт к `unknown`.

### V5 — Verdict assembly + UX + endpoints
- Файлы: `rules/verdict.py`, `presentation.py`, `fitment_api.py`, миграции `vehicle_identities`/
  `rim_specs`/`fitment_checks` (data-model.md), `tests/test_fitment_verdict_api.py`.
- Задачи: свёртка, сохранение входов/провенанса/вердикта, UX-карта с дисклеймером, endpoint (auth
  `src/auth.py`, ownership-проверка).
- Проблемы/решения:
  - Юридический риск формулировок → строго «предварительно»/«у специалиста».
  - Приватность → ownership-проверка (общий gap репозитория).
- Acceptance: end-to-end фото+фото (+опц.) → объяснимый вердикт с причинами/условиями/missing; сохранён;
  текст без гарантий.

### V6 — Provider discovery + калибровка + ADR
- Файлы: `docs/adr/0003-fitment-provider-selection.md`, тест-набор 30–50 авто, отчёт калибровки.
- Задачи: измерить покрытие/полноту/латентность/ошибки/лимиты/лицензию; ручная валидация 10–20 кейсов;
  калибровать допуски (6.4), поднять `TOLERANCES_VERSION`; gaps → `unknown` UX.
- Acceptance: ADR с выбором, доказательствами покрытия, кэш/лицензионной политикой, условиями пересмотра;
  зафиксированная версия допусков.

### V7 — Recommendations (позже)
- Условие: аудируемый каталог/фид. До этого — CTA консультации.

---

## 10. Миграции

Идемпотентные, упорядоченные, вручную через Supabase SQL Editor (migrations/README.md). Номера — на
момент реализации (следующий свободный; координировать с визуальным гайдом). Логически:

| Логическое имя | Фаза | Содержание |
|---|---|---|
| fitment_catalog_cache | V2 | makes/models/years/generations/modifications + region + fetched_at/expiry |
| fitment_provider_cache | V2 | нормализованный профиль + provider/version/fetched_at/expiry + raw_ref |
| vehicle_identities | V5 | подтверждённая машина + slug'и + source/confidence |
| rim_specs | V5 | спеки диска + provenance |
| fitment_checks | V5 | вердикт, rule_results (JSONB), engine_version, tolerances_version, provider, ссылки |

`fitment_checks` связан с `jobs` (nullable): вердикт может сопровождать рендер, но не зависит от него.

---

## 11. Каталог проблем и решений

| Проблема | Симптом | Решение |
|---|---|---|
| «Нет данных = подходит» | ложный `compatible` | missing critical → `unknown`; ET/CB/PCD неизвестны → не `compatible` |
| VLM-галлюцинация спеков | выдуманные ET/PCD | низкий confidence, не user_confirmed → максимум `conditions` |
| ToS: префетч search | блок ключа | search только по user-действию; кэшировать результат запроса, не префетчить |
| Неверный регион | пустой/неверный профиль | регион обязателен, fallback-регион, нормализация через cataloging |
| Грубый резолв make/model/year | не та модификация | лестница резолва до modification_slug (5.2) |
| Дневной лимит API | 429 / отказ | кэш + дедуп + backoff; исчерпан → `unknown` cache-only; сброс 0:00 GMT |
| Vendor lock-in | провайдер в routes/rules | всё за `FitmentProvider`; rules не знают провайдера |
| Center bore | неверный вердикт | rim<hub → incompatible; rim>hub → conditions (кольца); tol 0.1 |
| Offset | грубый вердикт | асимметричные допуски (внутрь +5, наружу −15), missing ET ≠ compatible |
| Staggered fitment | диск проверен не к той оси | axle-specific allowed set, не схлопывать front/rear |
| Юридический риск | «подходит 100%» | только «предварительно» + дисклеймер |
| Лицензия на кэш | нарушение ToS | cataloging кэшируем; search — только результат user-запроса; raw-ref для аудита |
| Приватность | чужой вердикт по id | ownership-проверка |
| Sync I/O из прототипа | блокировка event loop | async httpx |
| `centre_bore` строкой/N/A | краш парсинга | безопасный `to_float`, дефолт → `unknown` |

---

## 12. Verification / Definition of Done

```bash
ruff check .
ruff format --check .
python -m compileall src/ tests/ -q
pytest -q
```

DoD фазы: Acceptance выполнены; код за флагом (`FITMENT_VERDICT_ENABLED` default false); `.env.example` и
migrations/README обновлены; тесты на новое поведение зелёные; логи по конвенции без секретов; провайдер
только за адаптером; PR в `dev`, атомарные conventional-commits.

Особое требование: тесты rule engine полностью офлайн (без сети), табличные кейсы на все 4 вердикта;
тесты провайдера — на замоканных httpx-ответах.

---

## 13. Связанные документы

- [fitment-compatibility.md](fitment-compatibility.md) — домен-модель, verdict-состояния, rule set v0.
- [fitment-provider-discovery.md](fitment-provider-discovery.md) — вопросы и критерии выбора провайдера.
- [adr/0002-fitment-provider-abstraction.md](adr/0002-fitment-provider-abstraction.md) — решение об абстракции.
- [data-model.md](data-model.md) — `vehicle_identities`, `rim_specs`, `fitment_checks`.
- [fitment-pipeline-implementation-guide.md](fitment-pipeline-implementation-guide.md) — визуальный pipeline (отдельный).
- Wheel-Size API — <https://developer.wheel-size.com/> (v2, методы, регионы, лимиты, ToS).
- Прототип-референс — `wheel_fitment_test_v2/`.
