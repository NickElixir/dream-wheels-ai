"""Unit-тесты для src.wheel_seg.

Не требуют наличия .onnx модели — все ML-зависимости тестируются на
синтетических numpy-массивах. Реальный inference покрывается отдельным
интеграционным тестом, помеченным @pytest.mark.integration (skipped по
умолчанию, запускается при наличии файла модели).
"""

from __future__ import annotations

import io
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from src import wheel_seg


@pytest.fixture(autouse=True)
def _reset_session():
    """Каждый тест стартует с чистым ленивым session-кэшем."""
    wheel_seg._reset_session()
    yield
    wheel_seg._reset_session()


def _png_bytes(h: int = 128, w: int = 256, color: int = 200) -> bytes:
    arr = np.full((h, w, 3), color, dtype=np.uint8)
    out = io.BytesIO()
    Image.fromarray(arr).save(out, format="PNG")
    return out.getvalue()


def test_letterbox_preserves_aspect_ratio_and_pads_to_square():
    arr = np.full((100, 200, 3), 50, dtype=np.uint8)
    canvas, scale, (pad_w, pad_h) = wheel_seg._letterbox(arr, new_size=640)

    assert canvas.shape == (640, 640, 3)
    assert scale == pytest.approx(640 / 200)  # ограничение по w
    # 100 * 3.2 = 320 → паддинг по высоте (640 - 320) / 2 = 160
    assert pad_h == 160
    assert pad_w == 0
    # Padding всегда серый 114
    assert canvas[0, 0].tolist() == [114, 114, 114]


def test_xywh_to_xyxy_basic():
    boxes = np.array([[100.0, 100.0, 40.0, 20.0]])  # cx, cy, w, h
    out = wheel_seg._xywh_to_xyxy(boxes)
    assert out.tolist() == [[80.0, 90.0, 120.0, 110.0]]


def test_nms_keeps_highest_score_when_overlap_high():
    # Два идентичных бокса, второй чуть ниже по score → должен быть отброшен
    boxes = np.array(
        [
            [0.0, 0.0, 100.0, 100.0],
            [10.0, 10.0, 100.0, 100.0],  # IoU > 0.45 с первым
        ]
    )
    scores = np.array([0.9, 0.8])
    keep = wheel_seg._nms(boxes, scores, iou_threshold=0.45)
    assert keep.tolist() == [0]


def test_nms_keeps_both_when_no_overlap():
    boxes = np.array(
        [
            [0.0, 0.0, 50.0, 50.0],
            [200.0, 200.0, 250.0, 250.0],
        ]
    )
    scores = np.array([0.9, 0.8])
    keep = wheel_seg._nms(boxes, scores, iou_threshold=0.45)
    assert sorted(keep.tolist()) == [0, 1]


def test_nms_empty_input():
    keep = wheel_seg._nms(np.empty((0, 4)), np.empty((0,)), iou_threshold=0.45)
    assert keep.shape == (0,)


def test_decode_masks_returns_zero_mask_when_no_detections():
    protos = np.zeros((32, 160, 160), dtype=np.float32)
    coeffs = np.empty((0, 32), dtype=np.float32)
    boxes = np.empty((0, 4), dtype=np.float32)
    mask = wheel_seg._decode_masks(coeffs, protos, boxes, (480, 640), (0, 80))
    assert mask.shape == (480, 640)
    assert mask.dtype == np.uint8
    assert mask.max() == 0


def test_decode_masks_returns_binary_mask_with_detection():
    # Прототипы — все нули, кроме одного канала, который полностью «горячий».
    # coeff на этом канале большой → sigmoid → ~1 в bbox-окне.
    protos = np.zeros((32, 160, 160), dtype=np.float32)
    protos[0] = 5.0  # после sigmoid(5*1) ≈ 0.99
    coeffs = np.array([[1.0] + [0.0] * 31], dtype=np.float32)
    # bbox в координатах 640x640: квадрат в центре
    boxes = np.array([[200.0, 200.0, 440.0, 440.0]], dtype=np.float32)
    mask = wheel_seg._decode_masks(coeffs, protos, boxes, (256, 256), (0, 0))

    assert mask.shape == (256, 256)
    assert mask.dtype == np.uint8
    assert set(np.unique(mask).tolist()) <= {0, 255}
    # Должна быть существенная белая область
    assert (mask == 255).sum() > 1000


def test_detect_wheel_mask_raises_when_model_missing(monkeypatch, tmp_path):
    """Без файла модели — внятная ошибка с инструкцией."""
    missing = tmp_path / "no-such-model.onnx"
    monkeypatch.setattr(wheel_seg, "WHEEL_SEG_MODEL_PATH", str(missing))
    with pytest.raises(FileNotFoundError, match="не найдена"):
        wheel_seg.detect_wheel_mask(_png_bytes())


def test_detect_wheel_mask_returns_empty_png_when_no_detections(monkeypatch):
    """Поведенческий контракт: нет детекций → валидный PNG того же размера, всё чёрное."""

    class FakeSession:
        def get_inputs(self):
            class _Input:
                name = "images"

            return [_Input()]

        def run(self, _outputs, feeds):
            # 4 + 1 класс + 32 коэффициента = 37 каналов; все scores ниже SCORE_THRESHOLD
            num_anchors = 8400
            out0 = np.zeros((1, 37, num_anchors), dtype=np.float32)
            out1 = np.zeros((1, 32, 160, 160), dtype=np.float32)
            return [out0, out1]

    monkeypatch.setattr(wheel_seg, "_get_session", lambda: FakeSession())

    png = _png_bytes(h=120, w=200)
    out = wheel_seg.detect_wheel_mask(png)

    assert isinstance(out, bytes)
    img = Image.open(io.BytesIO(out))
    assert img.size == (200, 120)
    assert img.mode == "L"
    assert np.array(img).max() == 0


def test_detect_wheel_mask_decodes_real_detection(monkeypatch):
    """Один высокий score → маска не пустая."""

    class FakeSession:
        def get_inputs(self):
            class _Input:
                name = "images"

            return [_Input()]

        def run(self, _outputs, feeds):
            num_anchors = 100
            n_classes = 1
            channels = 4 + n_classes + 32
            out0 = np.zeros((1, channels, num_anchors), dtype=np.float32)
            # anchor 0: bbox в центре летербокса 640×640, высокий class score, единичный mask coeff
            out0[0, 0, 0] = 320.0  # cx
            out0[0, 1, 0] = 320.0  # cy
            out0[0, 2, 0] = 200.0  # w
            out0[0, 3, 0] = 200.0  # h
            out0[0, 4, 0] = 0.95  # class[0] score
            out0[0, 5, 0] = 1.0  # первый mask coefficient
            out1 = np.zeros((1, 32, 160, 160), dtype=np.float32)
            out1[0, 0] = 5.0  # sigmoid → ~0.99 везде
            return [out0, out1]

    monkeypatch.setattr(wheel_seg, "_get_session", lambda: FakeSession())

    png = _png_bytes(h=480, w=640)
    out = wheel_seg.detect_wheel_mask(png)

    img = Image.open(io.BytesIO(out))
    arr = np.array(img)
    assert arr.shape == (480, 640)
    assert (arr == 255).sum() > 1000  # есть существенный белый регион


@pytest.mark.integration
def test_detect_wheel_mask_real_model():
    """Инференс на реальной модели. Skipped если .onnx нет на диске."""
    from src.config import WHEEL_SEG_MODEL_PATH

    if not Path(WHEEL_SEG_MODEL_PATH).exists():
        pytest.skip(f"Модель отсутствует: {WHEEL_SEG_MODEL_PATH}")

    png = _png_bytes(h=480, w=640)
    out = wheel_seg.detect_wheel_mask(png)
    img = Image.open(io.BytesIO(out))
    assert img.size == (640, 480)
    assert img.mode == "L"
