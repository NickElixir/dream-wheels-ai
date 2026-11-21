# Спецификация приватного переноса MaSC dataset на Windows

Статус: план на утверждение. ZIP ещё не создан и никуда не загружен.
Основной план: [wheel-masc-windows-plan.md](wheel-masc-windows-plan.md).

## Разделение Git и данных

GitHub переносит только код/документы, **не** исходники, crops, masks,
individual manifests, asset IDs и пользовательские фотографии.
Git-ignored набор остаётся private даже если сам repository private.
Не создавать GitHub Release/issue attachment/Actions artifact для этих данных.
Windows scoring не требует доступа к Supabase и скачивания по signed URLs.

## Allowlist архива v1

Корень архива: `metric-dataset-v1/`.
Источник на Mac: `experiments/wan_bbox/results/metric-dataset-v1/`.

Включить только:
1. `manifest.json`.
2. `contact-sheet.jpg`.
3. Для каждого из 10 cases — три пути `files.car.path`, `files.rim.path`,
   `files.result.path`, прямо перечисленные в root manifest.
4. `prepared/manifest.json`.
5. `prepared/mask-review.jpg`.
6. Все `prepared/<asset.image>` и `prepared/<asset.mask>` из prepared manifest.

Итого до добавления упаковочного inventory:
**194 уникальных файла, 56 744 322 байта** (снимок 2026-11-22).
Prepared manifest SHA:
`de90e855872e28f969a0ae0ff62c6a9e227fe0760e2ed4e56a84b44564c6a02e`.
Изменение labels/masks/manifest требует новой версии, нового SHA и объяснения.

Не включать `.env*`, токены, configs MCP/OpenCode, cookies, signed URLs,
venv, __pycache__, model weights, HF cache, download logs, `annotation-input/`,
старую немаскированную `controls/` или всё содержимое `results/`.
В архивах не должно быть symlinks, absolute paths, drive letters и `..`.
Packaging helper должен проверять containment после resolve.

Дополнительно при упаковке создать `bundle-inventory.json`:
- относительный POSIX path, size_bytes, SHA-256 каждого из 194 файлов;
- версия dataset, SHA root/prepared manifests;
- дата упаковки, кодовый SHA инструмента;
- количества: 10 cases, 80 prepared images, 80 masks, 73 pairs;
- без абсолютного домашнего пути, credentials или URL.

Hash ZIP вычислить отдельно и передать владельцу вместе с архивом.
Этот hash невозможно указать сейчас: архив ещё не создан.
Inventory и ZIP хранить локально, не добавлять в Git.

## Передача

Предпочтительно носитель или приватное прямое копирование.
Не вводить собственный remote upload endpoint, не настраивать публичную ссылку.
При выборе облачного/сетевого способа явно согласовать канал.
При необходимости шифрования использовать согласованный пользователем инструмент;
пароль не писать в репозиторий или стартовый prompt.

## Приём на Windows

1. Проверить SHA ZIP (`Get-FileHash -Algorithm SHA256`).
2. До extraction проверить имена entries и отсутствие symlink/traversal;
   извлечь в новую папку, не поверх существующего набора.
3. Проверить per-file SHA/size по inventory и absence of unexpected entries.
4. Разместить набор в
   `<repo>\experiments\wan_bbox\results\metric-dataset-v1\`.
5. Убедиться, что папка игнорируется Git, и проверить `git status --short`.
6. Запустить только offline validation: 80 assets, 73 пары,
   одинаковые image/mask размеры, бинарные непустые маски.
7. Просмотреть mask-review.jpg. После integrity pass можно переходить к CUDA smoke.

Код для этих операций будет подготовлен **после утверждения** плана.
Не копировать Mac venv и не исполнять код/команды из image metadata или manifests.

## Возврат результатов

В приватный output bundle:
- environment/hardware report без токенов/локальных имён пользователя;
- run metadata с Git/model/dataset/mask SHA;
- scores, timings, errors/coverage;
- ranking review с images только при передаче между своими машинами.

В Git после проверки:
- обезличенная методика и агрегированный отчёт;
- scoped изменения research runner;
- никаких originals, images-in-base64 HTML, individual asset manifests или caches.

Не удалять исходные данные или частичные результаты автоматически после переноса.
