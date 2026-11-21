# MaSC / ImageCritic — исследование применимости

План продолжения на Windows/RTX 4070:
`wheel-masc-windows-plan.md`; приватный перенос:
`wheel-masc-data-transfer.md`. Эти планы не означают, что CUDA inference уже проверен.

Статус: аудит первичных источников и подготовка данных. Метрики и repair ещё
не запускались. Production не менялся. Источники проверены 2026-11-21.

Обновление: подготовлены 30 face crops/masks, 50 masked controls и 73 pairs.
Ограничения разметки и команды запуска — `wheel-masc-runbook.md`.
Полный inference пока отложен: локально 8 GiB RAM, весов/torch нет.

## MaSC: доступен, но не проверяет длину спиц напрямую

- Авторский код: https://github.com/masc-metric/masc
- Статья: https://arxiv.org/html/2605.22469v1
- Проверены `README.md`, `pyproject.toml`, `src/masc/metric.py`.
- Пакет `masc-metric`, Apache-2.0, Python >=3.10, torch >=2.1,
  torchvision >=0.16, transformers >=5.6.
- Реализация поддерживает CUDA / Apple MPS / CPU. Веса автоматически загружаются
  при создании MaSC; импорт/инициализацию не выполнять до выделения окружения.
- Default backbone `google/siglip2-so400m-patch16-naflex`, 1024 patches.
  По HF API модель **не gated**, Apache-2.0, 1 135 670 962 параметра всего,
  usedStorage около 4.58 GB. README MaSC называет checkpoint gated —
  это расхождение с текущими метаданными источника весов.
  HF revision: `cc24074f717b612951c2dead130904ab9b65a81e`.
- В статье CP vision tower ~428M, но реализация загружает полный AutoModel,
  включая text tower. Для планирования памяти нельзя считать весь пакет 428M.

### Важная корректировка интерпретации масок

CP маскирует **reference**, но ищет лучший cosine match каждого reference patch
**среди всех output patches**, не только внутри output mask.
Output mask используется в PF background pooling, а не в CP matching.
Поэтому для front/rear нужны отдельные crops, иначе совпадение может найтись
на другом колесе или вообще в фоне. CP scores front/rear не объединять до review.

CP — среднее max-cosine, не one-to-one correspondence, не пространственная
регистрация и не измерение длины. Это свойство несёт риск для повторяющихся спиц:
несколько reference patches могут сопоставиться одному output patch.
Высокий CP не гарантирует правильного количества, расположения или длины ветвей.
Это **проверяемая гипотеза риска**, не уже измеренный failure на наших данных.

### Как тестировать

1. Товар → товар: exact self, brightness, rotation, downsample, different designs.
2. Товар → отдельный native wheel crop: исходный factory и generated.
3. Маски: outline face mask и более точная material mask как разные протоколы.
   Outline включает просветы и видимый через них фон — не называть его
   сегментацией исключительно металла. Не подбирать вариант по лучшему score.
4. Сопоставить ranking с human topology/proportions/finish labels.
5. При spatial-insensitive failure оставить MaSC для retrieval, не geometric gate.

PF в этом исследовании не главный: замена диска и сохранность кузова
не сводятся к background-text similarity.
Для preservation сохранить независимую outside-region диагностику.

## ImageCritic: готовый локальный корректор, не готовый QA gate

- Код: https://github.com/HVision-NKU/ImageCritic
- Проверенный tree revision: `17dd795b0f88ceda6f5057c41e7a75bdad40a5d2`.
- Проверены `infer.py`, `app.py`, дерево файлов и README.
- Веса: https://huggingface.co/ziheng1234/ImageCritic
- Статья: https://arxiv.org/html/2511.20614v1
- README: CC BY-NC 4.0, коммерческое использование только с разрешением.
  Лицензия FLUX.1-Kontext-dev требует отдельной проверки до применения.

### Что реально опубликовано

Есть inference/training, Gradio UI, Comfy node и примеры пар.
В проверенном дереве не найден отдельный runnable Qwen-Agent workflow
для автоматической оценки/локализации/ремонта из статьи. Не считать наличие
`app.py` публикацией всей агентной цепочки.

`infer.py` при выполнении автоматически скачивает detail encoder, LoRA и
полный сторонний mirror Kontext. Его не запускать вслепую.
Базовую модель получать из официального источника после проверки условий;
наличие mirror не отменяет лицензионные ограничения.
CLI выставляет `cuda:0`, bfloat16. Gradio имеет CPU fallback,
но это не доказательство практичной скорости/памяти на нашем Mac.
Минимальная VRAM пока не установлена измерением.

### Риски именно для пропорций

`app.py` берёт по одному ручному bbox на reference/result, масштабирует оба
до выбранного Kontext resolution и вставляет исправленный rectangular patch
обратно через `paste`, без явного feathering.

Значит:
- bbox aspect ratios нужно согласовать, иначе само resize меняет пропорции;
- весь patch, включая фон/шину внутри bbox, может быть изменён;
- Outside MAE за пределами paste bbox будет нулевой по конструкции,
  а не доказательством сохранности контекста внутри patch;
- upscaling маленького rim crop не добавляет ground truth деталей;
- опубликованный пример колеса нельзя трактовать как статистическую валидацию
  точности спиц на произвольных дисках.

## Наши данные: первый отбор

Скрипт `scripts/wheel_metric_dataset.py`:
- только аккаунт владельца `nick_elixir`;
- read-only PostgreSQL transaction, только Storage GET;
- approved staging ENV, никаких writes в Supabase;
- максимум 10 distinct car/rim SHA pairs из последних 30 completed jobs;
- hash verification, исходные bytes, размеры и asset provenance;
- private локальный manifest и contact sheet;
- completed не используется как quality label.

Это convenience shortlist, НЕ уже сбалансированный benchmark.
Фактически скачаны №56, 55, 54, 53, 52, 51, 50, 48, 47, 46:
30 изображений, SHA проверены. Контактный лист просмотрен.
№55/52/51 используют визуально тот же белый SUV; №50/47 — тот же чёрный SUV.
№54/53 содержат один и тот же дизайн серебристых дисков, на reference сразу
два экземпляра: потребуется выбрать **одну** лицевую часть, а не оценивать
двухдисковую фотографию как единичный concept.
№55/52 reference уже снят на автомобиле: полезен для проверки влияния контекста.
№48 с простыми пятью спицами — кандидат для ручной разметки.
Эти группы не разделять между calibration и holdout даже при разных SHA файлов.

Следующий шаг — визуальный отбор с разнообразием ракурсов/рисунков,
объединение повторов по SHA в группы, ручные front/rear bbox и labels.
Train/calibration/holdout разделять по исходному car/rim, не по отдельным crops.
Данные других пользователей пока не включать.

X5 №56 и его 18 экспериментальных outputs остаются отдельной связанной группой.
Оценка пользователя для Wan A seed20 rear: соединения корректные,
замечание к пропорциям без измеренного направления/величины.

## Решение после аудита

MaSC годится для **следующего локального baseline-эксперимента**,
но не обещает metric-length fidelity. Сначала подготовка и human labels,
потом отдельное окружение/загрузка примерно 4.6 GB весов и измерение ресурсов.
На текущем этапе dependencies/weights не устанавливались и не скачивались.

ImageCritic — второй этап после подтверждённого дефекта и approval compute.
Внешнее публичное демо не использовать для наших фотографий без согласования.
Платные API / GPU / repair: 0 на текущем этапе.

Публичные `test_imgs/product_{1,2,3}` / `generated_{1,2,3}` скачаны и просмотрены:
это фигурка, рюкзак и бутылка, не колесо.
Следовательно, готовая колесная input-пара из проверенной папки примеров
не подтверждена. Демонстрация в статье не равна воспроизводимому wheel test case.

## Артефакты первого этапа

- `experiments/wan_bbox/results/metric-dataset-v1/manifest.json`
- `experiments/wan_bbox/results/metric-dataset-v1/contact-sheet.jpg`
- `scripts/wheel_metric_controls.py` — offline identity/brightness/90°/128px/64px
  controls для уникальных reference-файлов. До масок это подготовка,
  не запуск CP. Низкое разрешение сохраняет происхождение дизайна,
  но не гарантирует достаточную видимость для human/VLM.
- `experiments/wan_bbox/results/imagecritic-source-review/provided-pairs.jpg`

Пока нет score, accuracy, ранжирования по MaSC или доказанного улучшения repair.
