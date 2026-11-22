# Старт ImageCritic на Windows — для другого OpenCode

Основной документ: [утверждённый план](imagecritic-pilot-plan.md).
**Первое действие агента — диагностика и case review, не `python infer.py`.**
GPU inference на этой машине ещё не проверен. Готового протестированного CUDA runner
в этом Git-пакете нет: scoped adapter предстоит подготовить/проверить здесь.

## 1. Контекст и scope

- Repo: `https://github.com/NickElixir/dream-wheels-ai`.
- Ветка: `experiment/wan-bbox-wheel-fidelity`.
- Сначала AGENTS.md, CONTRIBUTING.md, этот MD и основной план.
- Рабочая папка — отдельный clone/worktree, например `C:\AI\DreamWheelsResearch`.
  Не перезаписывать имеющиеся изменения, не работать в production checkout.
- Допустимый кодовый scope: новый локальный ImageCritic research adapter/tests
  и документы; не трогать `src/`, deploy, backend dependencies или платежи.
- Старые `wheel-masc-*` документы — отложенная ветка, **не текущая инструкция**.
- Веса/данные/venv/results только в `experiments/wan_bbox/results/` (Git-ignored).
- Никакого service-role, DB, WAN/OpenAI/AITunnel ENV. Наши фото не отправлять
  провайдеру VLM для анализа: локально показывать владельцу.
  OpenCode сам использует свой настроенный провайдер; не менять его настройки
  и не прикладывать private фото/base64 к удалённым model calls без согласования.

## 2. Код и веса: pin, аудит, лицензии

ImageCritic source:
`https://github.com/HVision-NKU/ImageCritic`
commit `17dd795b0f88ceda6f5057c41e7a75bdad40a5d2`.

Adapters:
`https://huggingface.co/ziheng1234/ImageCritic`
revision `2aa67e700b6e425a98c9b5dba02258cc0a2ba12a`.
Только `detail_encoder.safetensors`, `lora.safetensors` + лицензионные metadata.

Base:
`https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev`
revision `5b73edc910e96f4bf9588a4708e2b9a6d0755123`.
Gated access: владелец сам принимает применимые условия и проходит HF login.
Не записывать HF token в код/чат/logs/репозиторий.

Сначала прочитать `app.py`, `infer.py`, requirements, detail encoder и custom pipeline
**как текст**. Не импортировать entrypoints: они сразу скачивают полный Kontext mirror,
а Gradio entrypoint создаёт UI; `infer.py` содержит full CUDA placement.
Никаких сторонних mirrors, Critic-10K/Bench или полного датасета для этого запуска.
В official base repo есть diffusers layout и дублирующие single-file weights:
скачивать только необходимые diffusers components, не весь repo без разбора.
Не менять revision молча при 401/404/другой ошибке.

## 3. Что передать с Mac приватно

Готовый ZIP:
`experiments/wan_bbox/results/imagecritic-handoff/imagecritic-case51-v1.zip`.
SHA-256:
`e5a1b7d14f261fe28b0359498fce310bef48a7fa445e5017fbe3a95d09fdd905`.

Внутри 8 файлов, один корень `imagecritic-case51-v1/`:
три original images, два inspection crops, candidate-review.png,
case.json и bundle-inventory.json.
ZIP не опубликован в GitHub: владелец переносит напрямую/носителем.
Не переносить весь results, venv, .env, MCP config или модельный cache.

Сначала проверить ZIP SHA (`Get-FileHash -Algorithm SHA256`),
entry names: нет absolute/drive/`..`/symlinks; извлечь в новую пустую папку.
Проверить 7 file hashes/size из inventory (inventory не хеширует сам себя;
его защищает hash ZIP). Никаких дополнительных entries.
Рекомендуемая папка внутри clone:
`experiments/wan_bbox/results/imagecritic-input/imagecritic-case51-v1/`.

`case.json` намеренно содержит null defect/repair boxes и false generation gate.
Approved face bbox — координаты на full source image, inspection crops дополнительно
содержат padding. Это **не** окончательные reference/repair rectangles.
Нельзя брать face_bbox как bbox на padded crop и нельзя молча использовать его
как утверждённый repair bbox.

Показать reference, result crop и full frame владельцу локальным просмотрщиком.
Получить описание отклонения, reference/target rectangles и сохраняемых деталей.
Записать решение в отдельный `approved-case.json` с исходными hashes и
координатной системой (original absolute xyxy); исходный bundle не менять.
Пока case не принят, denoising/generation запрещены.

## 4. Диагностика Windows

Без установки/изменения системы:

```powershell
git status --short --branch
git rev-parse HEAD
nvidia-smi
py -0p
Get-CimInstance Win32_ComputerSystem | Select-Object TotalPhysicalMemory
Get-PSDrive -PSProvider FileSystem
```

Не отправлять в отчёт hostname/имя пользователя; драйвер/GPU/VRAM нужны.
Проверить реальную desktop/laptop модель, свободную VRAM.
Запас диска определить по официальным файлам весов + venv + временным shards;
до download оценить размер и сообщить владельцу. Не обещать лимит 4.6 GB:
он относится к MaSC, **не ImageCritic**.

## 5. Окружение — не backend venv

Native Windows/PowerShell первым. Новый research venv, команды через явный
`...\Scripts\python.exe`, без administrator и изменения ExecutionPolicy.
Для adapter — Python 3.12 x64 при совместимых wheels; upstream рекомендует 3.10.
Если требуется upstream Python 3.10, отдельный research-only profile и фиксация причины,
не downgrade backend. Если native dependencies несовместимы — STOP, обсудить WSL2.

PyTorch CUDA wheel выбрать по официальному selector под реальный driver/Python.
Зафиксировать torch/torchvision/CUDA. Проверить CUDA tensor op и synchronize,
bf16 capability, pip check, dependency freeze и offline unit tests.
CUDA=False => STOP, не выдавать CPU fallback за CUDA experiment.

Upstream requirements: transformers==4.51.3, accelerate==1.10.0,
safetensors==0.6.2, diffusers Git commit
`345864eb852b528fd1f4b6ad087fa06e0470006b`.
Не устанавливать весь requirements вслепую: есть training/notebook/video/tracking
и API-клиенты, не нужные одиночному repair. Вывести минимальный набор
из реально импортируемого pinned inference path. Без wandb login/remote logging.
Не обновлять diffusers до latest ради одной функции offload молча.

## 6. Память и scoped adapter

Авторский CLI загружает full pipeline на CUDA. Это не подход для слепого запуска
на 4070: только ~12B bf16 transformer уже порядка 24 GB весов, без остальных компонентов.
По фактической VRAM требуется проверенный memory profile, возможно submodule/
sequential CPU offload. Model-level offload не гарантирует, что transformer поместится.

Общая поддержка offload в Diffusers **не доказывает** совместимость с custom class,
внешним DetailEncoder и ручными `.to(device)` в её forward.
Сначала изучить регистрацию modules/placement/hooks; никаких `.to("cuda")`
перед sequential offload. Не подключать актуальный API offload к старому pinned
diffusers без проверки наличия/совместимости.

Подготовить минимальный headless adapter, не HTTP service:
- явные local paths и pinned models; загрузка отдельно от generation;
- seed до создания дополнительных modules и до random initialization.
  Upstream создаёт DetailEncoder, затем **прибавляет** checkpoint tensors
  (`param.add_`), а не обычный strict load: проверить смысл/coverage, не
  «исправлять» это произвольно и не скрывать missing/unexpected weights;
- LoRA weight=1, bf16 если поддерживается, guidance=3.5, seed=0 как исходное предложение;
  steps=28 и max_sequence_length=512 по проверенному pinned __call__;
  явно передавать и записывать их до run, не полагаться на default иной версии;
- batch=1, без quantization/compile/black mask в первом профиле;
- предложить профиль владельцу до denoising (offload/size/steps/time budget);
- отдельный output dir, lock перед generation, запись SUBMISSION/STARTED state,
  ровно один pipeline generation call после gates;
- exceptions с контекстом, partial/error status, no hidden retries;
- сохранять source/crop hashes, seed/dtype, actual target size, placement,
  torch/packages/Git/model revisions, время и RAM/VRAM;
- offline tests bbox bounds, no stretch, inverse paste, outside-bbox pixel equality,
  output overwrite protection и gate отказа без approved-case.

Если для запуска нужна quantization, радикальный rewrite/другая модель —
остановиться и согласовать, это уже другой профиль исследования.

## 7. Preprocessing и один repair

Human-approved rectangles берём на full originals.
Нельзя независимо растянуть reference/result crops до одинакового WxH:
это само меняет пропорции спиц. Сначала согласовать aspect-compatible bbox
или padding без искажения с явным transform manifest и обратным mapping.
Не выдавать padding за дорисовку деталей.
До вызова показать локальную preprocessed pair владельцу.

Prompt сохранить в стиле upstream:
`use the wheel rim in IMG1 as a reference to refine, replace, enhance the wheel rim in IMG2`.
Не добавлять неподтверждённые требования о числе спиц или соединениях.
Текстовый defect нужен для human acceptance; не обязательно превращать его
в новый сложный prompt при первом тесте.

Один repair одного согласованного wheel/region, не всего авто и не обоих колёс.
Никаких GPU warmup generations на других images.
После вызова сохранить native patch и обратную вставку в full result, без silent
feathering/резкости/дополнительного апскейла. Если нужны отдельные варианты
композиции — сначала согласовать, не подменять output модели обработкой.
OOM/error => STOP; другой профиль/повтор только после отдельного решения.

## 8. Review и возврат

Локально показать reference → before → after с одинаковыми crops, плюс full frame.
Human outcome: BETTER / SAME / WORSE / UNCERTAIN; отдельные defect/regression notes.
Критерий из плана: целевой дефект уменьшился, новых существенных ошибок нет.
Вне paste bbox equality ожидается по конструкции; особенно проверять окружение внутри.

В private output: native inputs/transforms, approved-case, run.json, output patch,
composed full image, comparison, errors и resource summary.
В Git: только scoped code/tests и обезличенный отчёт после проверки, без base64 HTML.
Не push/PR/merge автоматически в Windows-сессии. Сначала показать diff и outcome.

## Источники, проверены 2026-11-22

- https://github.com/HVision-NKU/ImageCritic (pinned source выше)
- https://huggingface.co/ziheng1234/ImageCritic
- https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev
- https://pytorch.org/get-started/locally/
- https://huggingface.co/docs/diffusers/optimization/memory

Официальный base model card при unauthenticated raw GET вернул 401;
public metadata подтверждает gated noncommercial terms. Читать полные условия
после входа владельца, не считать этот MD заменой лицензии.
