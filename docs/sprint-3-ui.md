# Sprint 3 UI specification

## Result detail

Open the selected history item in place. Do not create a new route.

Desktop: image viewer on the left; actions and rating controls on the right.
Mobile: one column.

Use one viewer, not two simultaneous images. The full-width two-part control is:

`Результат | Оригинал`

The result is selected initially. Selecting Original swaps the current viewer image with a short fade.

Main images must preserve their composition: `width:100%`, `height:auto`, `object-fit:contain`.

History thumbnails use a compact fixed frame with `object-fit:contain`; dark letterboxing is acceptable.

## Actions

`Скачать изображение`

Completed result action: `Примерить другие диски`.

It opens the existing create flow with the previous car asset and confirmed vehicle identity restored. The previous rim asset and rim setup are not preselected: the user uploads another wheel image and then explicitly starts a new render. It does not create a job or debit a render on navigation.

Failed result action: `Повторить`.

It opens the existing create flow with the prior source assets and confirmed data restored. It does not automatically retry, create a job, enqueue work, or debit a render. The user explicitly confirms a new render after review.

## Rating

Only completed jobs show rating controls.

Initial state:

`👍 Понравилось | 👎 Не похоже`

Like receives success styling and a short acknowledgement. A second click clears it without a separate confirmation island.

Dislike is stored immediately and then reveals five optional inline single-select reasons:

- Диск отличается
- Машина изменилась
- Ракурс / масштаб
- Качество изображения
- Другое

No modal, text field, or submit button.

## Status updates

For Sprint 3, continue using polling while a job is processing. Poll every 3–5 seconds and stop immediately after `completed` or `failed`, or when the screen is no longer active.

Keep frontend status handling behind a small adapter so the transport can later move to WebSocket or SSE without changing history/result UI semantics.

## Retention and deletion

Sprint 3 has no user-initiated deletion of render jobs, source assets, result assets, or feedback. Do not add delete controls or deletion endpoints in this sprint.

## History states

Completed: `Готово` and `Открыть`.

Processing: `Создаём виртуальную примерку`, `В обработке`.

Failed: `Не удалось создать виртуальную примерку`, `Рендеры не списаны`, `Повторить`.

Processing and failed jobs do not show comparison or rating controls.