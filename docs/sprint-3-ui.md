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

`Создать ещё вариант` restores the prior create context but cannot create a job or debit a render until the user confirms a new render.

## Rating

Only completed jobs show rating controls.

Initial state:

`👍 Понравилось | 👎 Не похоже`

Like receives success styling and a short acknowledgement. A second click clears it.

Dislike receives warning styling and shows five inline single-select options:

- Диск отличается
- Машина изменилась
- Ракурс / масштаб
- Качество изображения
- Другое

No modal, text field, or submit button.

## History states

Completed: `Готово` and `Открыть`.

Processing: `Создаём виртуальную примерку`, `В обработке`.

Failed: `Не удалось создать виртуальную примерку`, `Рендеры не списаны`, `Повторить`.

Processing and failed jobs do not show comparison or rating controls.
