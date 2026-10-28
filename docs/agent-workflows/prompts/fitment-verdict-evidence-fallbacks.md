Ниже полный промпт для Codex

```text
Работаем в проекте Dream Wheels AI

Репозиторий:
https://github.com/NickElixir/dream-wheels-ai

Базовая ветка:
staging

Создай новую feature-ветку от актуального staging:

fix/fitment-verdict-evidence-fallbacks

# Цель

Исправить архитектуру Detailed Fitment Check после PR #46–#49

Основные проблемы текущей реализации:

- заполненность пользовательской формы ошибочно воспринимается UI как достаточность данных для технического verdict
- make/model/year могут разрешаться в общий профиль без точной комплектации
- несколько модификаций объединяются в один профиль, из-за чего отсутствие ET в одной записи превращает общий эталонный ET в null
- input snapshot создаётся до окончательного разрешения Wheel-Size и не содержит точного provider mapping и фактически использованных evidence
- `offset_unknown` не различает отсутствие ET колесного диска и отсутствие эталонного ET автомобиля
- blocking issues, conditions и необязательные замечания смешиваются в одном списке
- `hub_rings_required` дублируется по передней и задней оси
- UI показывает внутренние reason codes
- process-local provider cache не подходит для нескольких экземпляров backend и не переживает redeploy

Нужно сделать техническую проверку воспроизводимой, честной и понятной пользователю

Не подставлять отсутствующие данные автоматически и не выдавать ложный `compatible`

# Обязательно прочитать

Перед изменениями прочитай:

```text
docs/product-roadmap.md
docs/fitment-verdict-pipeline-handoff.md
docs/fitment-verdict-evidence-rules.md
docs/fitment-api-contract-v1.md
docs/fitment-schema.md
docs/adr/0002-fitment-render-integration.md
docs/fitment/adr-fitment-render-integration.md
docs/fitment/adr-fitment-verdict-taxonomy.md
docs/ui-design-code.md
CONTRIBUTING.md
CLAUDE.md
```

# Обязательный UI-референс

Перед frontend-изменениями изучи утверждённый интерактивный прототип:

`/Users/nikolai/Documents/Codex/2026-07-16/referenced-chatgpt-conversation-this-is-untrusted/outputs/dream_wheels_full_product_demo_v26.html`

Он показывает каноничную визуальную систему Dream Wheels AI и состояния Detailed Fitment Check.

Добавь в репозиторий отдельный reference-файл:

`docs/references/fitment-verdict-fallbacks.html`

В reference-файле должны быть сохранены следующие утверждённые demo-состояния:

1. Точная комплектация не выбрана
2. Данные готовы к проверке
3. Недостаточно данных из-за отсутствующего эталонного ET автомобиля
4. Предварительно совместимо с расчётным диапазоном ET
5. Совместимо с условиями при выходе ET за диапазон
6. Требуется подтверждение другого рынка автомобиля
7. Wheel-Size временно недоступен

Reference HTML — это визуальный и interaction contract, но не runtime source.

Нельзя:

- использовать mock-значения из HTML в production UI;
- переносить demo JavaScript как data layer;
- показывать frontend fallback как provider evidence;
- менять утверждённую иерархию сообщений без отдельного согласования.

Все production-данные должны приходить из backend API.

# Утверждённая иерархия сообщений в Fitment UI

UI всегда отображает четыре отдельные группы и не смешивает их:

1. **Blocking issues** — мешают сформировать технический verdict.
2. **Conditions** — известные условия установки.
3. **Advisories** — не блокируют предварительный verdict, но требуют внимания.
4. **Diagnostics** — только для внутреннего debug/admin интерфейса; не показывать обычному пользователю.

Пример для отсутствующего эталонного ET:

- Blocking issue: Не удалось подтвердить ET автомобиля по данным Wheel-Size.
- Condition: Для установки потребуется центровочное кольцо 110 → 60,1 мм.
- Advisories: Рейтинг нагрузки колесного диска не подтверждён — не влияет на предварительный verdict; Тип крепежа не подтверждён — проверьте его перед установкой.

Не показывать пользователю:

`offset_unknown`, `fastener_unknown`, `load_rating_unknown`, `hub_rings_required`, `provider_reference_conflict` или другие внутренние коды.

# Визуальные требования Fitment UI

- Использовать существующую тёмную палитру, islands, скругления и кислотный accent.
- Сохранять desktop sidebar и mobile bottom navigation.
- `Комплектация не выбрана` — warning state, не success.
- `Unknown` из-за неполных provider данных визуально отличается от технической ошибки provider.
- `Wheel-Size временно недоступен` — error state с CTA «Повторить проверку».
- `Совместимо с условиями` — warning state.
- `Предварительно совместимо` — success state.
- ET показывать как расчётный диапазон `ET35–45`.
- Отдельно показывать ET колесного диска, например `ET42`.
- Не показывать source offsets `35 / 40 / 45` в основном UI.
- Сообщение про центровочное кольцо при одинаковых данных осей должно быть одно.
- Дисклеймер о заводской конфигурации показывать до запуска проверки и рядом с результатом.

Также изучи актуальную реализацию:

```text
src/fitment_checks_api.py
src/fitment/schemas.py
src/fitment/providers/base.py
src/fitment/providers/cache.py
src/fitment/providers/wheel_size.py
src/fitment/rules/checks.py
src/fitment/rules/engine.py
src/fitment/rules/verdict.py
src/fitment/rules/tolerances.py
src/rim_url_resolver.py
src/identity_service.py
src/identity_api.py
src/jobs_api.py
src/config.py
src/main.py
webapp/app.js
webapp/index.html
webapp/style.css
migrations/0021_fitment_checks.sql
все актуальные migrations
все tests для fitment, identity, history, URL resolver и static UI
```

Проверь актуальный staging после merged PR #46, #47, #48 и #49

Не возвращай исправленные ими ошибки:

- legacy JSONB может приходить строкой
- ownership render_job_id должен проверяться
- idempotency race должна оставаться безопасной
- повторное применение версии автомобиля должно блокироваться
- protected assets и auth не должны регрессировать

# Документация Wheel-Size

Изучи официальную документацию Wheel-Size API v2:

```text
https://developer.wheel-size.com/
```

Особенно:

```text
/makes/
/models/
/years/
/generations/
/modifications/
/search/by_model/
regions
technical
wheels.front
wheels.rear
rim_diameter
rim_width
offset / et
is_stock
centre_bore
bolt_pattern
fasteners
rate limits
cache restrictions
```

Не опирайся на предположения о схеме ответа

Если фактический API отличается от текущего адаптера, сначала зафиксируй различия в implementation plan

# Product boundary

Rendering Pipeline отвечает:

```text
Как колесный диск выглядит на автомобиле
```

Fitment Pipeline отвечает:

```text
Что известно о предварительной технической возможности установки
```

Рендер не подтверждает совместимость

Detailed Fitment Check остаётся предварительной проверкой и не является гарантией установки

# Терминология

Во всех новых пользовательских текстах использовать:

```text
колесный диск
```

Не использовать просто:

```text
диск
```

Не показывать пользователю внутренние backend codes

В коротких UI-текстах и сообщениях не ставить точку в конце

# Не реализовывать

В этом PR не реализовывать:

```text
- нового внешнего fitment provider
- автоматический выбор резервного provider
- majority vote между providers
- расчёт brake caliper clearance
- анализ формы спиц колесного диска
- анализ изменённой подвески
- анализ aftermarket brakes
- анализ widebody или изменений кузова
- поля про модификации подвески, тормозов или кузова
- рекомендации проставок
- рекомендации wobble bolts
- подбор другого крепежа
- подбор шин
- изменение Rendering Pipeline
- блокировку создания визуального рендера
- автоматическое списание денег за failed provider request
- сохранение полного raw provider response без явного разрешения документации и ToS
```

# 1. Разделить form readiness и provider evidence readiness

Текущий зелёный блок «данных достаточно» проверяет только заполненность пользовательской формы

Нужно разделить два состояния:

```text
input_readiness
provider_readiness
```

Пример:

```json
{
  "input_readiness": {
    "status": "ready",
    "missing_fields": []
  },
  "provider_readiness": {
    "status": "variant_required",
    "blocking_issues": [
      {
        "code": "vehicle_variant_required"
      }
    ]
  }
}
```

`input_readiness = ready` не означает, что можно получить технический verdict

UI не должен показывать общий зелёный статус, если точная комплектация или критические provider evidence отсутствуют

# 2. Точная комплектация автомобиля обязательна

Make и model могут находиться fuzzy-сопоставлением

Year проверяется точным совпадением

Но fuzzy match нельзя использовать как окончательное подтверждение generation или modification

Если Wheel-Size возвращает несколько поколений или модификаций, пользователь должен выбрать точный вариант

До выбора:

```json
{
  "resolution_status": "variant_required",
  "blocking_issues": [
    {
      "code": "vehicle_variant_required"
    }
  ]
}
```

UI:

```text
Выберите комплектацию автомобиля

Без точной версии нельзя подтвердить заводские размеры и ET
```

Кнопку запуска проверки можно показывать, но она не должна запускать полноценный verdict до выбора варианта

Не использовать общий профиль `make + model + year` для положительного verdict

Общий профиль допустим только для получения списка вариантов

# 3. Сохранять полный provider mapping

После явного выбора варианта сохранить в:

```text
vehicle_identity.provider_mappings["wheel_size"]
```

минимум:

```json
{
  "make_slug": "lexus",
  "model_slug": "rx",
  "region": "usdm",
  "generation_slug": "al20",
  "modification_slug": "rx-350-awd"
}
```

Если API возвращает стабильный provider ID, сохранить и его

Provider mapping не должен заменять канонические поля VehicleIdentity

# 4. Инвалидация mapping после изменения автомобиля

Любое изменение одного из полей:

```text
make
model
year
generation
modification
market
body
```

должно инвалидировать Wheel-Size mapping

После изменения:

```text
provider_mappings["wheel_size"] удаляется или помечается stale
provider mapping revision увеличивается
resolution_status становится stale или unresolved
```

Старый mapping сохраняется только в append-only audit history

Его нельзя использовать для новой проверки

Добавить regression test:

```text
Lexus RX 2020 с сохранённым mapping
→ пользователь меняет модель или год
→ старый mapping больше не используется
```

# 5. Разделить input snapshot и evaluation snapshot

Существующий immutable `input_snapshot` должен продолжать фиксировать канонические пользовательские данные на момент принятия check request

Добавить отдельный immutable snapshot фактического выполнения проверки:

```text
evaluation_snapshot
```

Он должен создаваться после vehicle resolution и получения provider evidence

Минимальная структура:

```json
{
  "vehicle_provider_mapping": {
    "make_slug": "...",
    "model_slug": "...",
    "region": "...",
    "generation_slug": "...",
    "modification_slug": "..."
  },
  "provider_request": {
    "make": "...",
    "model": "...",
    "year": 2020,
    "region": "...",
    "generation": "...",
    "modification": "..."
  },
  "normalized_profile": {},
  "provider_response_hash": "...",
  "provider": "wheel_size",
  "provider_version": "v2",
  "fetched_at": "...",
  "requested_region": "usdm",
  "resolved_region": "usdm",
  "fallback_region_used": false,
  "disclaimer_version": "stock_vehicle_only_v1"
}
```

Также сохранить:

```text
engine_version
rules_version
tolerances_version
vehicle_identity_revision
rim_setup_revision
provider_mapping_revision
```

Не перезаписывать snapshot после завершения проверки

Не возвращать raw provider payload в обычном клиентском API

Полный raw response не сохранять в этом PR, если официальные условия Wheel-Size прямо не разрешают такое хранение

Сохранять:

```text
- точные параметры запроса
- нормализованные evidence
- hash ответа
- provider version
- fetched_at
- diagnostic information
```

# 6. Исправить нормализацию ET

## Принятое продуктово-техническое решение

Для одной и той же:

```text
- точной комплектации
- региона
- оси
- ширины колесного диска
- диаметра колесного диска
- категории fitment / stock status
```

несколько эталонных ET формируют непрерывный расчётный диапазон:

```text
ET min → ET max
```

Пример provider records:

```text
20″ / 8,5J / ET35
20″ / 8,5J / ET40
20″ / 8,5J / ET45
```

Нормализуются как:

```text
ET35–45
```

Промежуточное ET42 считается находящимся внутри расчётного диапазона

Это `derived_interval`, если провайдер не вернул диапазон явно

Исходные provider offsets должны сохраняться для аудита

Пример evidence:

```json
{
  "axle": "front",
  "rim_diameter_in": 20,
  "rim_width_j": 8.5,
  "reference_type": "derived_interval",
  "et_min_mm": 35,
  "et_max_mm": 45,
  "source_offsets_mm": [35, 40, 45],
  "source": "wheel_size",
  "is_explicit_provider_range": false
}
```

Если Wheel-Size явно возвращает диапазон:

```json
{
  "reference_type": "explicit_interval",
  "et_min_mm": 35,
  "et_max_mm": 45,
  "is_explicit_provider_range": true
}
```

Если есть только одно значение:

```text
ET45
```

хранить как интервал:

```text
45–45
```

## Нельзя объединять ET между:

```text
- разными модификациями
- разными поколениями
- разными рынками
- передней и задней осью
- разными диаметрами
- разными ширинами
- stock и другим fitment class
```

Пример, который нельзя объединять:

```text
18″ / 7,5J / ET35
20″ / 8,5J / ET45
```

## Stock и non-stock records

Не смешивать `is_stock=true` и non-stock записи в один диапазон

Сначала использовать точную stock/OEM группу

Если stock-группа отсутствует, но провайдер возвращает другую явно разрешённую fitment-группу:

```text
- сохранить её отдельным evidence class
- оставить результат preliminary
- не смешивать с OEM interval
```

# 7. Логика ET rule

Для проверки использовать точный interval для:

```text
axle + diameter + width + selected variant + region + fitment class
```

## ET внутри интервала

```text
rim ET >= et_min
rim ET <= et_max
```

Результат ET rule:

```text
compatible
```

Пример:

```text
Reference ET35–45
Rim ET42
→ compatible
```

## ET вне интервала

Расстояние считать от ближайшей границы

```text
ET ниже et_min
→ колесный диск смещается наружу

ET выше et_max
→ колесный диск смещается внутрь
```

Существующие tolerance constants не удалять без необходимости

Применять их к расстоянию до ближайшей границы диапазона

Пример:

```python
if rim_et < et_min:
    delta = rim_et - et_min
elif rim_et > et_max:
    delta = rim_et - et_max
else:
    delta = 0
```

Далее:

```text
delta = 0
→ compatible

в пределах conditional tolerance
→ compatible_with_conditions
→ offset_deviation_check_required

выше hard limit с trusted evidence
→ incompatible

выше hard limit с low evidence
→ unknown + conflict_low_evidence
```

Не расширять сам provider interval молча

Conditional tolerance хранить и отображать отдельно от reference interval

# 8. Различить отсутствующий ET колесного диска и автомобиля

Использовать разные codes

Если у колесного диска отсутствует ET:

```text
rim_offset_missing
```

UI:

```text
Укажите ET колесного диска
```

Если ET колесного диска заполнен, но Wheel-Size не вернул reference ET:

```text
vehicle_reference_offset_missing
```

UI:

```text
Не удалось подтвердить ET автомобиля по данным Wheel-Size
```

Не использовать для этих двух случаев один `offset_unknown`

Не подставлять ET колесного диска в качестве эталонного ET автомобиля

# 9. Неполный или противоречивый provider profile

Если provider корректно ответил, но в точном профиле нет критического поля:

```text
execution_status = completed
verdict = unknown
```

Примеры codes:

```text
vehicle_reference_offset_missing
vehicle_pcd_missing
vehicle_center_bore_missing
provider_allowed_wheels_missing
rear_fitment_missing
```

Если в одной точной группе provider возвращает значения, которые невозможно согласованно нормализовать:

```text
provider_reference_conflict
```

UI:

```text
Wheel-Size содержит противоречивые данные для выбранной комплектации
```

Не вычислять среднее значение

Не выбирать первый элемент массива

Не превращать provider conflict в `compatible`

# 10. Новый контракт результата

Не смешивать все сообщения в:

```text
reasons
missing_fields
```

Разделить response:

```json
{
  "execution_status": "completed",
  "verdict": "unknown",
  "blocking_issues": [],
  "conditions": [],
  "advisories": [],
  "diagnostics": [],
  "versions": {},
  "error": null
}
```

## blocking_issues

Только то, что мешает техническому verdict:

```text
vehicle_variant_required
vehicle_not_resolved
vehicle_market_confirmation_required
vehicle_pcd_missing
vehicle_center_bore_missing
rim_pcd_missing
rim_center_bore_missing
rim_size_missing
rim_offset_missing
vehicle_reference_offset_missing
provider_allowed_wheels_missing
provider_reference_conflict
rear_fitment_missing
trusted_conflict_evidence_missing
```

## conditions

Известные условия установки:

```text
hub_rings_required
offset_deviation_check_required
fastener_hardware_check_required
```

## advisories

Не блокируют предварительный verdict:

```text
load_rating_not_verified
fastener_not_verified
brake_clearance_not_verified
```

## diagnostics

Внутренняя диагностическая информация:

```text
provider_field_missing
provider_payload_incomplete
provider_fallback_region_used
rear_profile_inferred_from_front
provider_evidence_class_non_oem
```

Не показывать diagnostics пользователю как обычные ошибки

Допускается показывать их только в internal/admin debug UI

# 11. Нагрузка и крепёж

`load_rating_unknown` и `fastener_unknown` не должны попадать в общий список блокирующих данных

Переименовать для user contract:

```text
load_rating_not_verified
fastener_not_verified
```

UI:

```text
Рейтинг нагрузки колесного диска не подтверждён — не влияет на предварительный verdict
```

```text
Тип крепежа не подтверждён — проверьте его перед установкой
```

Пока отсутствует надёжный источник требуемой осевой нагрузки, load rating остаётся advisory

Если крепёж явно конфликтует и есть trusted evidence с обеих сторон, сохранить существующую условную или conflict-логику согласно handoff

# 12. Агрегация одинаковых axle results

Сейчас одинаковые conditions могут возвращаться для front и rear

Нужно агрегировать полностью одинаковые результаты

Пример:

```json
{
  "code": "hub_rings_required",
  "applies_to": ["front", "rear"],
  "details": {
    "rim_bore_mm": 110,
    "hub_bore_mm": 60.1
  }
}
```

UI должен показывать одно сообщение:

```text
Для установки потребуется центровочное кольцо 110 → 60,1 мм
```

Для staggered setup объединять только если:

```text
- code одинаковый
- normalized details одинаковые
```

Если параметры осей различаются, показывать отдельные сообщения:

```text
Передняя ось
Задняя ось
```

Агрегацию выполнять на backend или в отдельном canonical presentation layer, а не только визуально скрывать дубликаты frontend

# 13. Region fallback

Сейчас provider может искать резервный регион

Fallback region разрешается для поиска вариантов, но не должен незаметно использоваться для положительного verdict

Если:

```text
requested_region != resolved_region
```

вернуть:

```text
vehicle_market_confirmation_required
```

UI:

```text
Данные найдены для другого рынка автомобиля

Подтвердите, что комплектация соответствует вашему автомобилю
```

Сохранить в evaluation snapshot:

```json
{
  "requested_region": "russia",
  "resolved_region": "chdm",
  "fallback_region_used": true,
  "market_confirmed_by_user": false
}
```

До подтверждения рынка положительный verdict запрещён

# 14. Front-only provider profile

Для square setup:

```text
front records есть
rear records отсутствуют
```

допускается использовать front evidence для rear, если текущая provider semantics действительно означает square setup

Добавить diagnostic:

```text
rear_profile_inferred_from_front
```

Не считать это скрытым фактом

Для staggered setup такой fallback запрещён:

```text
rear_fitment_missing
→ blocking issue
→ unknown
```

# 15. Дисклеймер для заводской конфигурации

Не добавлять в форму поля:

```text
aftermarket_brakes
modified_suspension
body_modifications
spacers_installed
```

Fitment Check не рассматривает модифицированные автомобили

Перед запуском проверки и рядом с результатом показать:

```text
Проверка рассчитана для автомобиля в заводской конфигурации

Изменения подвески, тормозной системы, кузова, ступиц или использование проставок не учитываются
```

Короткий текст в карточке результата:

```text
Результат применим только к автомобилю в заводской конфигурации
```

Сохранять версию принятого ограничения:

```json
{
  "disclaimer_version": "stock_vehicle_only_v1"
}
```

Не добавлять обязательный checkbox, если текущая UX-система не требует юридического подтверждения

Предложить в plan, нужен ли passive disclaimer или explicit acknowledgement, но не усложнять реализацию без подтверждения

# 16. Provider execution failures

Разделять:

## Техническая ошибка provider

```text
timeout
transport error
DNS error
HTTP 429
HTTP 5xx
invalid JSON
unexpected schema
```

Response:

```json
{
  "execution_status": "failed",
  "verdict": null,
  "error": {
    "code": "provider_unavailable",
    "retryable": true
  }
}
```

UI:

```text
Wheel-Size временно недоступен

Повторите проверку позже
```

## Невалидный API key или configuration failure

```json
{
  "execution_status": "failed",
  "error": {
    "code": "provider_configuration_error",
    "retryable": false
  }
}
```

Не показывать пользователю детали ключа

## Корректный ответ без критических данных

```text
execution_status = completed
verdict = unknown
```

Не считать это provider failure

Если в проекте уже есть платное списание за fitment check:

```text
- failed provider request не должен окончательно списывать оплату
- использовать существующий compensation pattern
- не создавать новую платежную архитектуру в этом PR
```

Если списание ещё не реализовано, только зафиксировать правило в документации и тестах контракта

# 17. Distributed cache

В проекте уже есть:

```text
RedisProviderCache
```

Для staging и production использовать Redis как общий provider cache

InMemory cache оставить только для:

```text
local development
unit tests
single-process fallback при явной конфигурации
```

Требования:

```text
- использовать существующий Redis client проекта
- ключ должен включать provider, endpoint и все точные query params
- ключ profile должен включать make/model/year/region/generation/modification
- разные варианты автомобиля не должны попадать в один cache entry
- отдельный TTL для catalog endpoints
- отдельный TTL для profile/search
- короткий negative TTL для пустых ответов
- не делать background prefetch search/by_model
- не выполнять provider search без user action
- сохранять fetched_at в FitmentCheck
```

Добавить configuration:

```text
FITMENT_PROVIDER_CACHE_BACKEND
FITMENT_CATALOG_CACHE_TTL_SEC
FITMENT_PROFILE_CACHE_TTL_SEC
FITMENT_NEGATIVE_CACHE_TTL_SEC
```

Не дублировать существующие переменные, если они уже есть

Обновить `.env.example`

Если Redis недоступен:

```text
- не падать в 500 при запуске приложения
- логировать degraded cache mode
- поведение выбрать в соответствии с текущими project conventions
```

Предложить точную стратегию fallback в implementation plan до написания кода

# 18. Подготовка к резервному provider

Не подключать второго provider в этом PR

Но привести provider boundary к расширяемому контракту, если текущего интерфейса недостаточно:

```python
class FitmentProvider:
    async def resolve_vehicle(...)
    async def find_vehicle_variants(...)
    async def get_exact_profile(...)
    async def get_provider_evidence(...)
```

Provider result должен позволять хранить field-level provenance

Будущие правила multi-provider:

```text
- secondary provider вызывается для той же точной комплектации
- secondary может заполнить отсутствующее поле
- каждое поле сохраняет source provider
- конфликт providers даёт unknown
- majority vote не используется
- OEM/manufacturer evidence может иметь более высокий уровень доверия
```

В этом PR реализовать только интерфейс и данные, необходимые для будущего подключения

Не создавать фиктивный secondary adapter

# 19. Rim product URL resolver и SSRF

Не ослаблять текущую защиту URL resolver

Обязательно сохранить или добавить:

```text
- HTTPS only
- строгий host allowlist
- проверка каждого redirect
- ограничение количества redirect
- DNS resolution до запроса
- повторная DNS-проверка нового host после redirect
- блокировка private, loopback, link-local и reserved IP
- запрет IP-literal URL
- запрет нестандартных портов
- ограничение response size
- timeout
- запрет cookies
- не передавать Authorization
- не загружать изображения, scripts и вложенные ресурсы
```

Если parsed значения конфликтуют с user-confirmed данными:

```text
- не перезаписывать user-confirmed
- сохранить parsed значения как candidate evidence
- явно показать конфликт пользователю
```

Эта часть не должна расширять allowlist без отдельного решения

# 20. Frontend

Обновить fitment UI без изменения общей визуальной системы Dream Wheels AI

Сохранить:

```text
- тёмную палитру
- sidebar и mobile navigation
- текущие islands и radii
- кислотный accent
- result/history flow
- Rendering Pipeline
- feedback UI
```

## Состояние до выбора комплектации

```text
Точная комплектация не выбрана

Выберите комплектацию автомобиля, чтобы подтвердить заводские размеры и ET

[ Выбрать комплектацию ]
```

## Provider ET отсутствует

```text
Не удалось подтвердить ET автомобиля по данным Wheel-Size
```

Не писать:

```text
Введите ET
```

если ET колесного диска уже заполнен

## Центровочное кольцо

```text
Для установки потребуется центровочное кольцо 110 → 60,1 мм
```

Не показывать два одинаковых сообщения для front и rear

## Advisory load rating

```text
Рейтинг нагрузки колесного диска не подтверждён — не влияет на предварительный verdict
```

## Advisory fastener

```text
Тип крепежа не подтверждён — проверьте его перед установкой
```

## Provider failure

```text
Wheel-Size временно недоступен

[ Повторить проверку ]
```

## Stock vehicle disclaimer

```text
Проверка рассчитана для автомобиля в заводской конфигурации

Изменения подвески, тормозной системы, кузова, ступиц или использование проставок не учитываются
```

# 21. Миграция

Проверить, можно ли безопасно расширить `fitment_checks`

Вероятно потребуется новая migration после `0021_fitment_checks.sql`

Например:

```text
0022_fitment_evidence_fallbacks.sql
```

Минимально рассмотреть поля:

```text
evaluation_snapshot jsonb
resolution_status
provider_mapping_revision
disclaimer_version
```

Не добавлять отдельные колонки для каждого reason code, если контракт хранится в versioned JSON result

Миграция должна:

```text
- быть безопасной для существующих staging checks
- не ломать чтение старых rows
- позволять evaluation_snapshot = null для legacy checks
- не перезаписывать старые immutable snapshots
- иметь необходимые JSON validation/check constraints в стиле проекта
```

# 22. Backward compatibility

Существующие FitmentCheck rows могут не содержать:

```text
evaluation_snapshot
blocking_issues
conditions
advisories
diagnostics
```

API должен безопасно читать старый формат

Возможен compatibility adapter:

```text
old reasons + missing_fields
→ new structured response
```

Не изменять сохранённый legacy result в БД во время обычного чтения

Не показывать старые raw internal codes в UI

# 23. Tests

Добавить или расширить тесты в существующем стиле

Минимально проверить:

1. Fuzzy make/model resolution остаётся возможным

2. Year требует точного совпадения

3. Несколько generations/modifications возвращают `vehicle_variant_required`

4. До выбора variant нельзя получить positive verdict

5. После выбора сохраняется полный Wheel-Size mapping

6. Mapping содержит make/model/region/generation/modification slugs

7. Изменение make инвалидирует mapping

8. Изменение model инвалидирует mapping

9. Изменение year инвалидирует mapping

10. Изменение generation/modification/market инвалидирует mapping

11. Старый mapping остаётся только в audit history

12. Input snapshot остаётся immutable

13. Evaluation snapshot содержит итоговый provider mapping

14. Evaluation snapshot содержит provider request

15. Evaluation snapshot содержит normalized profile

16. Evaluation snapshot содержит provider response hash и fetched_at

17. Evaluation snapshot содержит disclaimer version

18. Общий make/model/year профиль не даёт compatible

19. Для exact group ET35, ET40, ET45 создаётся derived interval 35–45

20. ET42 внутри derived interval даёт compatible для ET rule

21. ET35 и ET45 считаются границами interval

22. Единственный ET45 создаёт interval 45–45

23. ET разных ширин не объединяются

24. ET разных диаметров не объединяются

25. ET разных осей не объединяются

26. ET разных variants не объединяются

27. ET разных regions не объединяются

28. Stock и non-stock ET не смешиваются

29. ET немного вне interval использует conditional tolerance от ближайшей границы

30. ET далеко вне interval с trusted evidence даёт incompatible

31. ET далеко вне interval с low evidence даёт unknown

32. Отсутствующий rim ET возвращает `rim_offset_missing`

33. Отсутствующий vehicle reference ET возвращает `vehicle_reference_offset_missing`

34. Rim ET не подставляется как vehicle reference ET

35. Provider profile без ET завершает check как completed + unknown

36. Provider timeout возвращает failed + retryable

37. Provider 429 возвращает failed + retryable

38. Provider 5xx возвращает failed + retryable

39. Invalid JSON возвращает failed

40. Корректный incomplete payload не возвращает failed

41. Response содержит blocking_issues

42. Response содержит conditions

43. Response содержит advisories

44. Response содержит diagnostics

45. Load rating advisory не блокирует compatible/conditional verdict

46. Fastener advisory не блокирует verdict

47. Trusted fastener conflict сохраняет текущую безопасную semantics

48. Одинаковый hub ring condition для front/rear агрегируется

49. Разные hub ring values для staggered setup не агрегируются

50. Region fallback требует подтверждения

51. До подтверждения fallback region нельзя получить compatible

52. Front-only square profile создаёт diagnostic `rear_profile_inferred_from_front`

53. Front-only staggered profile даёт blocking `rear_fitment_missing`

54. Disclaimer присутствует перед запуском проверки

55. Disclaimer присутствует в результате

56. В UI нет внутренних codes `offset_unknown`, `fastener_unknown`, `load_rating_unknown`

57. В UI используется «колесный диск»

58. Redis cache key включает exact modification и region

59. Два backend instances могут использовать общий Redis cache

60. Empty provider response использует negative TTL

61. Search/by_model не запускается без user action

62. URL resolver блокирует private IP

63. URL resolver проверяет redirect hosts

64. URL resolver блокирует IP-literal URL

65. URL resolver ограничивает response size

66. Parsed URL data не перезаписывает user-confirmed values

67. Legacy checks безопасно читаются через compatibility adapter

68. Owner isolation FitmentCheck сохраняется

69. Idempotency сохраняется

70. Render job ownership сохраняется

71. Sprint 1–4 tests не регрессируют

# 24. Проверки

Запустить:

```bash
ruff check .
ruff format --check .
pytest -q
node --check webapp/app.js
git diff --check
```

Если меняется admin:

```bash
npm --prefix admin install
npm --prefix admin run lint
npm --prefix admin run build
```

Также выполнить доступные static/frontend tests

Проверить migrations на чистой БД и на schema с существующей `0021_fitment_checks.sql`

# 25. Manual staging smoke plan

Подготовить пошаговый smoke checklist:

```text
1. Автомобиль с одной точной комплектацией
2. Автомобиль с несколькими комплектациями
3. Выбор комплектации
4. Проверка сохранения mapping
5. Изменение автомобиля и сброс mapping
6. ET внутри interval
7. ET на границе interval
8. ET вне interval
9. Wheel-Size не вернул ET
10. Hub ring condition
11. Provider timeout / retry
12. Region fallback
13. Reload страницы
14. Повторное открытие сохранённого check
15. Проверка legacy check
```

Не выполнять платные массовые provider requests

Использовать минимальное число live requests, разрешённое Wheel-Size ToS

# Порядок работы

1. Обновить локальный staging

2. Создать ветку `fix/fitment-verdict-evidence-fallbacks`

3. Прочитать обязательную документацию проекта

4. Изучить официальную документацию Wheel-Size

5. Проверить реальное содержимое staging после PR #46–#49

6. Проверить реальную schema `fitment_checks`, vehicle identities, mappings, revisions и cache configuration

7. Составить implementation plan

План должен отдельно описать:

```text
- текущую причину общего null ET
- точную variant selection flow
- provider mapping lifecycle
- mapping invalidation
- migration strategy
- input snapshot vs evaluation snapshot
- ET interval normalization
- ET interval rule semantics
- blocking / conditions / advisories / diagnostics contract
- axle aggregation
- region fallback
- Redis cache activation
- legacy response compatibility
- SSRF boundary
- test plan
- deploy order
- rollback risks
```

8. Перед реализацией frontend:
   - сверить каждый UI state с `docs/references/fitment-verdict-fallbacks.html`;
   - перечислить, какие API-поля питают каждый блок интерфейса;
   - не начинать frontend-код, если backend contract не позволяет отличить blockers, conditions, advisories и provider failure.

9. Не писать код до подтверждения плана

10. После подтверждения реализовать изменения небольшими логическими commits

11. Создать PR в `staging`

# Definition of done

Задача завершена, когда:

```text
- положительный verdict невозможен без точной комплектации
- provider mapping сохраняется и инвалидируется корректно
- итоговая проверка полностью воспроизводима по immutable evidence
- ET оценивается как диапазон для exact variant/axle/size group
- ET35, ET40, ET45 корректно образуют derived interval ET35–45
- отсутствующий ET автомобиля не смешивается с отсутствующим ET колесного диска
- blocking issues отделены от conditions и advisories
- hub ring condition не дублируется
- load rating и неподтверждённый крепёж не выглядят блокирующими
- modified vehicles исключены понятным disclaimer
- provider failures отличаются от incomplete provider evidence
- staging/production используют общий Redis cache
- URL resolver остаётся защищённым от SSRF
- legacy checks продолжают читаться
- все backend и frontend tests проходят
```
```
