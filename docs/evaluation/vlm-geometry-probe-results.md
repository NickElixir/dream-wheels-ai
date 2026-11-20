# Qwen3-VL-Plus — результат первичного sanity screening

Дата: 2026-11-21. 3/3 VLM requests завершены. Image generation / repair calls: 0.
Thinking выключен, max output 2048, три независимых user contexts.
Оригинальный QA prompt и hashes — в plan.json; полный ответ не переписывался.
Результат НЕ является полной калибровкой и не доказывает false-acceptance rate.

## Стоимость по фактическим токенам

| Запрос | Input tokens | Output tokens | Оценка USD |
|---|---:|---:|---:|
| Reference audit | 626 | 189 | 0.0004276 |
| Known negative | 6164 | 1277 | 0.0032760 |
| Wan candidate | 6164 | 1097 | 0.0029880 |
| **Всего** | **12954** | **2563** | **0.0066916** |

Singapore <=32K tier: $0.20/M input, $1.60/M output. Расчёт без cache discount,
налогов и сверки bill. Это примерно 0.67 американского цента за три проверки.
Ранее предложенные $0.50 были worst-case ceiling, не ожидаемой стоимостью.
Для этого размера input practical QA estimate около $0.003/call; не обобщать
на другие image counts/resolutions/context/thinking modes.

## 1. Reference-only

VLM не получала нашу схему 10/20 или ожидаемый count.
Она вернула:

```json
{
  "group_count": 5,
  "outer_branch_count": 10,
  "lug_hole_count": 5
}
```

Причём uncertainty:
> None — all features are fully visible ... grouping is unambiguous.

Это противоречит ручной разметке **10 split-групп / 20 наружных ветвей**,
для которой сохранены координаты 20 концов и guide.
Расхождение нужно окончательно adjudicate человеку, а не объявлять ответ VLM
или первоначальную ручную разметку автоматически истинной.
До разрешения расхождения этот проверяющий не имеет подтверждённой способности
верно различать базовую структуру нашего reference.

## 2. Known negative — original как result

Без каких-либо пиксельных изменений исходная фотография передана в роли result.
Overall FAIL, оба geometry FAIL — правильное high-level отклонение.
Но replacement оставлен uncertain вместо уверенного unchanged, хотя original
и result одинаковы. Модель продолжает ссылаться на 5-group reference и использует
слабые признаки вроде плохо различимого logo. Отсутствие читаемого бренда в мелком
crop не является доказательством structural mismatch.

Следовательно, negative rejected, но объяснение нельзя считать полностью надёжным.

## 3. Wan A / seed 20261120

VLM вернула overall PASS, geometry PASS обоих колёс, observed counts 5/10.
Аргументация — соответствие reference 5×2, то есть та же спорная reference premise.
Она заявила совпадение hub/lip connections, openings и width, включая
неподтверждённое численное inner:outer width ratio ≈1.8:1.
Preservation тоже PASS с утверждением неизменности ground/background/reflections.
Это не измерения, а неподтверждённые текстовые assertions модели.

Actionable defects модель оценила лишь medium confidence:
- front: kink у lip около 10 часов;
- rear: одна ветвь около 4 часов якобы короче парной.

Эти локальные утверждения не подтверждены независимой разметкой и не должны
автоматически попадать в corrective prompt.

Наша прежняя geometry оценка кандидата — UNCERTAIN, не gold FAIL/PASS.
Поэтому этот результат называется **неподтверждённым/рискованным одобрением**,
а не измеренным false acceptance с известным ground truth.

## Решение

**Не использовать Qwen3-VL-Plus из этого профиля как автономный production gate
или автоматический автор корректирующего промпта.** Для этого пилота проблема
не цена, а уверенность при неразрешённом расхождении в базовой конструкции.

Никакой repair generation на основании этого ответа не выполнялся.
Не исправлять reference count в prompt и не пересылать запрос с подсказанным
ответом ради демонстрации «успеха»: это будет другой, guided evaluation experiment.

## Следующие варианты — требуют отдельного решения

1. Human adjudication reference guide 10/20 и конкретных spoke junctions.
2. Другой независимый visual evaluator на тех же blind inputs:
   сначала reference audit/negative, затем candidate. Не выбирать модель
   только по совпадению с предыдущей AI-оценкой.
3. Отдельный guided VLM режим: reference graph задаётся явно после human approval,
   VLM проверяет локальные nodes, а не сама выдумывает count. Такой режим проверяет
   следование утверждённой спецификации, не независимое распознавание reference.
4. Для массового QA — набор подтверждённых positives/close-SKU negatives,
   измерение false acceptance, disagreement и uncertainty. Три запроса недостаточны.

## Artifacts

Локальная Git-ignored папка:
`experiments/wan_bbox/results/vlm-geometry-probe-v1/`.
В каждом case: metadata.json, answer.txt, answer.json. В корне: plan.json,
submission.lock, cost-summary.json.
Предыдущая manual annotation/guide:
`docs/evaluation/wheel-geometry-annotations.json`,
`experiments/wan_bbox/results/geometry-review/reference-groups-guide.png`.
