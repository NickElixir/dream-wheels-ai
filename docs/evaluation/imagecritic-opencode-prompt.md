# Prompt для Windows OpenCode

Сначала получить актуальный commit ветки `experiment/wan-bbox-wheel-fidelity`
из `NickElixir/dream-wheels-ai`, содержащий этот файл. Проверить фактический SHA
и показать его владельцу; не полагаться на один branch name. Работать в отдельном
чистом clone/worktree. Не сбрасывать существующие изменения.

Ниже текст для нового чата:

---

Продолжи изолированное исследование Dream Wheels AI на моей Windows-машине
с картой семейства RTX 4070 и 64 ГБ RAM. Точную GPU/VRAM проверь сам.
Общение на русском, кратко.

Прочитай:
1. AGENTS.md и CONTRIBUTING.md.
2. docs/evaluation/imagecritic-pilot-plan.md — утверждённый план.
3. docs/evaluation/imagecritic-windows-start.md — canonical start/ограничения.

Приоритет — ImageCritic, MaSC отложен. Нужно проверить один ручной repair
по референсу, без VLM-судьи, обучения или агентной цепочки.

Сначала:
- проверь Git SHA/status, hardware/driver/Python/disk;
- найди у меня приватно перенесённый imagecritic-case51-v1.zip
  (если его нет — попроси путь/перенос и остановись на этом шаге);
- проверь SHA ZIP и inventory по стартовому MD;
- покажи мне reference, crop и full result локально;
- попроси подтвердить конкретный дефект и обе repair/reference области.

Я уже принял границы лицевых частей из предыдущей разметки.
Это НЕ утверждение дефекта №51 и НЕ разрешение использовать эти границы
как окончательные repair rectangles. В исходном case.json gates намеренно закрыты.
Сохрани отдельный approved-case.json после моего решения, не меняй исходный bundle.

Разрешена диагностика и подготовка изолированного research окружения.
Аудируй pinned upstream как текст до импорта: entrypoints автоматически скачивают
Kontext mirror. Используй только официальный base model после проверки прав/условий.
Если нужны HF login/принятие лицензии — это делаю я, токен в чат не проси.
ImageCritic noncommercial license не считай автоматически допустимой для бизнеса.

Следуй memory/profile gates стартового MD. Не пытайся full .to("cuda") наугад.
Подготовь минимальный scoped adapter/tests; покажи выбранный memory/preprocessing
profile до denoising. Пока defect/boxes/licenses/profile не согласованы — generation=0.
После всех gates допускается один repair одного колеса, без автоматических повторов,
seed sweep, второго колеса или «пробной» генерации на другом изображении.

Не читай production ENV, не подключай Supabase, AITunnel и прочие generation APIs.
Не отправляй фото во внешние демо, VLM или облачное хранилище.
Не меняй OpenCode global config, драйвер/WSL2 без отдельного согласования.
Не трогай src/, backend dependencies, credits, payments, deploy.
Не коммить фото, токены, модели, caches, private manifests или base64 HTML.
Не делай push/PR/merge автоматически.

Первым ответом дай: фактический Git SHA, готовность данных/железа и следующий
безопасный шаг. В конце — before/after, человеческое решение, параметры,
RAM/VRAM/time, tests и ограничения. При blocker остановись и сообщи причину,
не заменяй модель/параметры или процедуру молча.

---
