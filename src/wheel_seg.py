"""Wheel-region segmentation через YOLO11n-seg (ONNX runtime).

Stage 1: модуль изолирован, не интегрирован в воркер. Готовит маску
области колеса для будущего inpainting-режима Reve API (Stage 2).

Public API:
    detect_wheel_mask(image_bytes: bytes) -> bytes
        Возвращает PNG-маску того же размера, что вход. 255 — пиксели колёс,
        0 — фон. Если детекций нет — полностью чёрная маска.

Архитектурные решения:
- Pure onnxruntime (без torch / ultralytics): минимальный footprint для
  Render Free 512MB RAM.
- Lazy session loading: модель грузится на первом вызове, не на импорте —
  чтобы импорт src.* в тестах/CI не требовал наличия .onnx файла.
- Postprocessing руками: NMS + маска через mask_coeffs @ prototypes —
  стандартный YOLOv11-seg decoding.

Модель ожидается по пути `WHEEL_SEG_MODEL_PATH` (см. src.config).
Получить можно через `scripts/download_yolo_seg.py` или вручную
(`yolo export model=yolo11n-seg.pt format=onnx`).
"""

from __future__ import annotations

import io
import logging
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

from src.config import WHEEL_SEG_CLASS_ID, WHEEL_SEG_MODEL_PATH

logger = logging.getLogger(__name__)

INPUT_SIZE = 640
SCORE_THRESHOLD = 0.25
IOU_THRESHOLD = 0.45
MASK_THRESHOLD = 0.5
MASK_COEFF_DIM = 32  # YOLOv11-seg всегда 32 прототипа

_session: ort.InferenceSession | None = None


def _get_session() -> ort.InferenceSession:
    """Lazy-load ONNX session. Кэшируется на уровне модуля."""
    global _session
    if _session is None:
        path = Path(WHEEL_SEG_MODEL_PATH)
        if not path.exists():
            raise FileNotFoundError(
                f"YOLO11n-seg модель не найдена: {path}. "
                "Запусти `python scripts/download_yolo_seg.py` или экспортни вручную: "
                "`yolo export model=yolo11n-seg.pt format=onnx`."
            )
        _session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        logger.info(f"🟢 YOLO11n-seg загружена: {path}")
    return _session


def _reset_session() -> None:
    """Сбросить кэш — нужно тестам и при смене модели runtime'но."""
    global _session
    _session = None


def _letterbox(
    img: np.ndarray, new_size: int = INPUT_SIZE
) -> tuple[np.ndarray, float, tuple[int, int]]:
    """Resize с сохранением aspect ratio + padding до квадрата.

    Возвращает (canvas, scale, (pad_w, pad_h)). pad_w/pad_h — по сколько
    пикселей добавлено по каждой стороне (только одна ось pad'ится за раз).
    """
    h, w = img.shape[:2]
    scale = min(new_size / h, new_size / w)
    new_h, new_w = round(h * scale), round(w * scale)

    resized = np.array(Image.fromarray(img).resize((new_w, new_h), Image.BILINEAR))

    # 114 — стандартный YOLO grey-padding (даёт нейтральный сигнал классификатору).
    canvas = np.full((new_size, new_size, 3), 114, dtype=np.uint8)
    pad_h = (new_size - new_h) // 2
    pad_w = (new_size - new_w) // 2
    canvas[pad_h : pad_h + new_h, pad_w : pad_w + new_w] = resized

    return canvas, scale, (pad_w, pad_h)


def _xywh_to_xyxy(boxes: np.ndarray) -> np.ndarray:
    """(cx, cy, w, h) → (x1, y1, x2, y2)."""
    out = np.empty_like(boxes)
    out[:, 0] = boxes[:, 0] - boxes[:, 2] / 2
    out[:, 1] = boxes[:, 1] - boxes[:, 3] / 2
    out[:, 2] = boxes[:, 0] + boxes[:, 2] / 2
    out[:, 3] = boxes[:, 1] + boxes[:, 3] / 2
    return out


def _nms(boxes: np.ndarray, scores: np.ndarray, iou_threshold: float) -> np.ndarray:
    """Non-Maximum Suppression. Возвращает индексы оставшихся детекций (по убыванию scores)."""
    if len(boxes) == 0:
        return np.empty((0,), dtype=np.int64)

    x1, y1, x2, y2 = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
    areas = np.maximum(0, x2 - x1) * np.maximum(0, y2 - y1)
    order = scores.argsort()[::-1]

    keep: list[int] = []
    while order.size > 0:
        i = int(order[0])
        keep.append(i)
        if order.size == 1:
            break
        rest = order[1:]
        xx1 = np.maximum(x1[i], x1[rest])
        yy1 = np.maximum(y1[i], y1[rest])
        xx2 = np.minimum(x2[i], x2[rest])
        yy2 = np.minimum(y2[i], y2[rest])
        inter = np.maximum(0, xx2 - xx1) * np.maximum(0, yy2 - yy1)
        union = areas[i] + areas[rest] - inter
        iou = np.where(union > 0, inter / union, 0.0)
        order = rest[iou <= iou_threshold]
    return np.array(keep, dtype=np.int64)


def _decode_masks(
    coeffs: np.ndarray,
    protos: np.ndarray,
    boxes_xyxy_input: np.ndarray,
    orig_shape: tuple[int, int],
    pad: tuple[int, int],
) -> np.ndarray:
    """Соединить mask coefficients с прототипами → бинарная маска оригинального размера.

    coeffs: (N, 32)
    protos: (32, mh, mw) — обычно 160×160
    boxes_xyxy_input: (N, 4) — bbox'ы в координатах летербоксного INPUT_SIZE×INPUT_SIZE
    orig_shape: (h, w) — исходный размер изображения
    pad: (pad_w, pad_h) — сколько отступа добавил _letterbox по каждой оси
    """
    orig_h, orig_w = orig_shape
    if len(coeffs) == 0:
        return np.zeros((orig_h, orig_w), dtype=np.uint8)

    # sigmoid(coeffs @ protos) → (N, mh, mw)
    n_masks, mh, mw = len(coeffs), protos.shape[1], protos.shape[2]
    flat = coeffs @ protos.reshape(MASK_COEFF_DIM, -1)
    masks_low = 1.0 / (1.0 + np.exp(-flat.reshape(n_masks, mh, mw)))

    pad_w, pad_h = pad
    combined = np.zeros((INPUT_SIZE, INPUT_SIZE), dtype=np.float32)
    for mask_low, box in zip(masks_low, boxes_xyxy_input, strict=False):
        # Resize маску с прото-разрешения → INPUT_SIZE
        mask_full = (
            np.array(
                Image.fromarray((mask_low * 255).astype(np.uint8)).resize(
                    (INPUT_SIZE, INPUT_SIZE), Image.BILINEAR
                ),
                dtype=np.float32,
            )
            / 255.0
        )

        # Зануляем всё за пределами bbox — чтобы прототипы не «текли» в фон
        x1, y1, x2, y2 = box
        x1_i = max(0, int(np.floor(x1)))
        y1_i = max(0, int(np.floor(y1)))
        x2_i = min(INPUT_SIZE, int(np.ceil(x2)))
        y2_i = min(INPUT_SIZE, int(np.ceil(y2)))
        bbox_window = np.zeros((INPUT_SIZE, INPUT_SIZE), dtype=np.float32)
        bbox_window[y1_i:y2_i, x1_i:x2_i] = 1.0
        combined = np.maximum(combined, mask_full * bbox_window)

    # Срезать padding (он симметричный по делению на 2: один из pad_w/pad_h может быть 0)
    inner = combined[
        pad_h : INPUT_SIZE - pad_h if pad_h > 0 else INPUT_SIZE,
        pad_w : INPUT_SIZE - pad_w if pad_w > 0 else INPUT_SIZE,
    ]
    final = (
        np.array(
            Image.fromarray((inner * 255).astype(np.uint8)).resize(
                (orig_w, orig_h), Image.BILINEAR
            ),
            dtype=np.float32,
        )
        / 255.0
    )
    return ((final > MASK_THRESHOLD) * 255).astype(np.uint8)


def detect_wheel_mask(image_bytes: bytes) -> bytes:
    """Вернуть PNG-маску колёс на входном изображении.

    255 — пиксели, принадлежащие колесу, 0 — фон. Размер маски совпадает
    с размером входа. Если детекций ниже SCORE_THRESHOLD не нашлось —
    маска полностью чёрная (валидный PNG).
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    arr = np.array(img)
    orig_h, orig_w = arr.shape[:2]

    canvas, _scale, pad = _letterbox(arr)
    tensor = canvas.astype(np.float32).transpose(2, 0, 1)[None] / 255.0

    sess = _get_session()
    input_name = sess.get_inputs()[0].name
    out0, out1 = sess.run(None, {input_name: tensor})
    # out0: (1, 4 + nc + 32, num_anchors) → транспонируем в (num_anchors, 4 + nc + 32)
    # out1: (1, 32, mh, mw) — прототипы маски
    pred = out0[0].T
    n_classes = pred.shape[1] - 4 - MASK_COEFF_DIM

    boxes_xywh = pred[:, :4]
    class_scores = pred[:, 4 : 4 + n_classes]
    coeffs = pred[:, -MASK_COEFF_DIM:]
    protos = out1[0]

    target_scores = class_scores[:, WHEEL_SEG_CLASS_ID]
    keep = target_scores > SCORE_THRESHOLD
    if not keep.any():
        return _empty_png(orig_h, orig_w)

    boxes_xywh = boxes_xywh[keep]
    target_scores = target_scores[keep]
    coeffs = coeffs[keep]

    boxes_xyxy = _xywh_to_xyxy(boxes_xywh)
    nms_idx = _nms(boxes_xyxy, target_scores, IOU_THRESHOLD)
    if len(nms_idx) == 0:
        return _empty_png(orig_h, orig_w)

    boxes_xyxy = boxes_xyxy[nms_idx]
    coeffs = coeffs[nms_idx]

    mask = _decode_masks(coeffs, protos, boxes_xyxy, (orig_h, orig_w), pad)
    return _encode_png(mask)


def _encode_png(mask: np.ndarray) -> bytes:
    out = io.BytesIO()
    # mode опускаем: для 2D uint8 Pillow сам выводит "L"; явный mode= deprecated в Pillow 13.
    Image.fromarray(mask).save(out, format="PNG")
    return out.getvalue()


def _empty_png(h: int, w: int) -> bytes:
    return _encode_png(np.zeros((h, w), dtype=np.uint8))
