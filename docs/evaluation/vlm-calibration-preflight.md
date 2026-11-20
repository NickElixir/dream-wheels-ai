# VLM preflight: Qwen3-VL-Plus, без repair generation

Обновление: пользователь разрешил однократный тест, выполнены 3/3 calls.
Фактический token-based estimate $0.0066916; итог и ограничения —
`vlm-geometry-probe-results.md`. Ниже сохранён исходный preflight design.

Статус: offline подготовка; платные VLM вызовы ещё не выполнялись.
Модель для первого screening: **qwen3-vl-plus**, Singapore.
Это text-output vision model, не qwen-image-3.0.
Она документирует multi-image understanding, spatial perception и structured outputs.
Выбор основан на пригодности интерфейса/стоимости и существующем провайдере,
не на доказанной способности считать split spokes.

## Кандидат и наблюдаемые вопросы

Временно выбран Wan A / seed 20261120 (без bbox). Видна замена обоих rims,
тёмный finish и сравнительно читаемый rear. Это кандидат, НЕ доказанный лучший
по точной геометрии: предыдущая разметка не дала подтверждённых geometry PASS.
Seed 20261121 исключён как factory-like retention; seed 20261122 имеет сильный
центральный блик, мешающий trace. Это heuristic selection с риском selection bias.

Output SHA-256:
`d1ed1290442d11b87d24e053de5fa50e9e8bb933ad9b8b60e9948431ecd1180f`.

Что проверять, не подсказывая модели ожидаемый ответ:
- видна ли замена именно обоих колёс, а не только правдоподобные rims;
- можно ли проследить отдельные split groups до hub и rim;
- front: тонкие внутренние ветви смешиваются с brake/background; counts неизвестны;
- rear: плечи у hub и ширина пустот выглядят приближёнными;
- нельзя уверенно утверждать неправильное число спиц без полного trace;
- не путать грани/отражения и brake components с дополнительными spokes;
- dark appearance и photorealism не являются geometry PASS.

Эти observations предварительные, не human ground truth.
Их НЕ включать в первый blind prompt модели как ожидаемый диагноз.

Локальные native crops сохранены без увеличения:
`experiments/wan_bbox/results/vlm-calibration-preflight/`.
Front xyxy [90,930,280,1150] (190×220), rear [750,960,1015,1225] (265×265).
Вместе с original 1440×1920, product 750×750 и полным candidate result.
При необходимости resize для VLM — отдельный logged preprocessing step;
увеличение не создаёт новых деталей.

## Минимальный screening: 3 независимых запроса

1. **Reference-only audit:** самостоятельно описать и сосчитать видимые
   split groups, outer branches, bolt holes, объяснить видимость и неопределённость.
   Не передавать заранее наш count 10/20 и annotated guide. Сравнить с ручной
   разметкой после ответа. Расхождение — повод проверить обе оценки человеком.
2. **Known negative:** original car + product + original car в роли result,
   front/rear crops original. Заведомо replacement не выполнялся; VLM должна
   не одобрить конкретный товар. Метка hidden от VLM, одинаковый QA prompt.
3. **Wan candidate:** original car + product + result + два native crops.
   Нет доказанной PASS-метки: оценить качество диагноза и уверенность, а не
   объявлять истинным любой ответ VLM.

Все запросы отдельными контекстами, без предыдущего диагноза и без model labels.
enable_thinking=false, max_tokens=2048, n=1, non-streaming; no tools/search.
Ответ text/JSON: per-wheel replacement, observable counts (nullable),
split/hub/lip/width/openings evidence, geometry verdict, finish verdict,
car preservation verdict, uncertainty, high-confidence actionable defects.
Ответы не исполнять как команды. Любой corrective prompt — только будущий шаблон
из проверенного диагноза, не автоматическая отправка генератору.

Это sanity screening, **не полноценная калибровка**:
нет независимо подтверждённых edited-positive примеров, сложных close-SKU negatives
и большого sample. Нельзя оценить false-acceptance rate или production надёжность
по одному negative и одному uncertain candidate.

## Принцип решения

- Одобрение известного negative => не доверять модели autonomous QA.
- Уверенные точные counts без достаточной видимости => hallucination warning.
- PASS для candidate без проверяемых оснований => human review, не разрешение repair.
- UNCERTAIN допустим; не превращать осторожность в неправильный FAIL.
- Хороший negative rejection и полезный candidate diagnosis => следующий этап:
  human validation и расширение labelled dataset, затем отдельный repair experiment.

## Endpoint и цена

OpenAI-compatible:
`https://{WAN_WORKSPACE_ID}.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions`.
Region/workspace/key из выбранного staging ENV. Production adapters не менять.
TLS/certifi preflight по `docs/wan-local-testing.md`. POST analysis тоже платный,
даже без image generation.

Singapore, input <=32K: $0.20/M input tokens, $1.60/M output tokens.
Выше 128K: $0.60/M input и $4.80/M output.
Изображения входят в input tokens; реальная стоимость определяется usage.

При 32K input + 2048 output один call оценивается в $0.0096768;
три call — $0.0290304. Фактический input пока не измерен.
Консервативная верхняя оценка по полному max input модели 260096 tokens
и max output=2048, максимальному тарифу:
3×(260096×0.60/1M + 2048×4.80/1M) = **$0.497664** без налогов.

Предлагаемое approval: **не более 3 submission attempts, лимит $0.50** по
публичному тарифу без налогов; вероятная стоимость значительно ниже.
При любой ошибке/uncertain submission stop, без автоматического resubmit.
Если API/тариф/выбранный model отличаются — новый approval.
Это approval только VLM analysis, НЕ repair generation.

## Официальные источники, проверены 2026-11-21

- https://www.alibabacloud.com/help/en/model-studio/qwen3-vl-plus
- https://www.alibabacloud.com/help/en/model-studio/vision
