# MaSC: маски, контрольные пары и запуск

**Для переноса на Windows основной документ —
`wheel-masc-windows-plan.md` (на утверждение).**
Ниже — историческая локальная схема подготовки на Mac, не готовый Windows handoff.
Research scripts пока не опубликованы с этим docs-only пакетом;
после approval будут подготовлены и закоммичены отдельно.

## Подготовлено offline

`python3 -m scripts.wheel_metric_prepare`

- 10 reference face crops, 20 result wheel crops, 30 binary envelope masks.
- 50 masked controls (по 5 на кейс): self, brightness 0.8, 90°, 128px, 64px.
  №53/54 повторяют reference; это **не 50 независимых примеров**.
- 73 pairs: 20 реальных, 50 identity controls, 3 грубых structure negatives.
- 6 связанных source groups, split пока не назначен.

Все masks — предварительная ручная AI-разметка осевых эллипсов.
Это контур лицевой части, **включающий просветы, тормоза и видимый фон**.
На косых ракурсах возможны неточности: это не точная сегментация металла
и не perspective rectification. Contact sheet осмотрен после генерации масок.
Нужна проверка чувствительности к границам перед интерпретацией scores.

Артефакты:
`experiments/wan_bbox/results/metric-dataset-v1/prepared/`
- manifest.json — coordinates, hashes, provenance, group и pairs;
- mask-review.jpg — reference/front/rear с красными границами;
- faces/*.png и *-mask.png — native crops и masks.

Реальные try-on labels **не назначены по одному лишь сходству**.
Negatives пока provisional visual, не human-approved gold.
Self/control positives проверяют происхождение дизайна и инвариантность,
но не доказывают правильность генерации на автомобиле.
№56 здесь — historical output из Supabase, **не** Wan A seed20261120,
который пользователь оценивал ранее.

## Требования

MaSC поддерживает CPU, Apple MPS и CUDA. NVIDIA GPU не обязательна.
В статье timing получен на RTX3090, его нельзя переносить на Mac/CPU.
Авторская реализация загружает весь SigLIP2 (~4.6 GB fp32 weights),
а не только vision tower. Peak RAM/VRAM не измерен.

На текущем Mac: arm64, **8 GiB общей RAM**, torch/transformers не установлены.
Полный backbone вместе с системой и промежуточными tensors может вызвать
memory pressure; запуск здесь пока отложен, не объявлен технически невозможным.
Предпочтителен компьютер с >=16 GB RAM или отдельная CUDA машина
(это консервативная рекомендация, не измеренный минимум).
Аренда GPU требует отдельного согласования.

## Проверка без модели

```bash
python3 -m scripts.wheel_masc_score
```

Проверяет SHA изображений/масок, размеры, binary masks и pair references.
Не импортирует torch/masc, не скачивает веса.

## Полный эксперимент на согласованной машине

Команды ниже **ещё не выполнялись**. Отдельное окружение обязательно:
не ставить зависимости в backend venv и не менять requirements проекта.

```bash
python3 -m venv experiments/wan_bbox/results/masc-venv
experiments/wan_bbox/results/masc-venv/bin/python -m pip install \
  "git+https://github.com/masc-metric/masc.git@5f3f4b9112268469d3dc845cd45ce43e631c4bbd"
experiments/wan_bbox/results/masc-venv/bin/python -m pip freeze \
  > experiments/wan_bbox/results/masc-environment.txt
```

Для CUDA torch устанавливается под согласованную версию CUDA;
универсальную команду выбора accelerator здесь не навязываем.
Далее из корня worktree:

```bash
experiments/wan_bbox/results/masc-venv/bin/python -m scripts.wheel_masc_score \
  --run --allow-weight-download --device cpu --max-pairs 8 \
  --output experiments/wan_bbox/results/masc-pilot-v1
```

Для доступного accelerator заменить cpu на mps/cuda.
Сначала 3 provisional negatives и 5 controls. После sanity check отдельным
запуском с новым output и --max-pairs 73 проверить весь набор.

Checkpoint pinned:
`google/siglip2-so400m-patch16-naflex`
revision `cc24074f717b612951c2dead130904ab9b65a81e`.
Веса скачиваются в private results/hf-cache; наши изображения не загружаются
на HF. PF вычисляется авторским score API, но не интерпретируется как точность
диска. CP сохраняется как число, **не вероятность корректности**.
При ошибке stop, автоматических retries эксперимента нет.

Runner проверен только offline; модельный путь ещё не прошёл интеграционный тест.
Dependencies требуют доступности нужных версий пакетов для выбранной платформы.
Не обещать работоспособность CUDA/MPS, пока не выполнен pilot.

## ImageCritic

Практический путь — отдельная CUDA машина и авторский Gradio/infer,
а не API Wan/AITunnel. CPU fallback есть в Gradio, но полезная скорость
и minimum VRAM не подтверждены. Запуск не выполнялся.
Некоммерческая лицензия и FLUX условия требуют проверки перед использованием.
Сначала нужно выбрать подтверждённый defect; не исправлять корректные соединения.
