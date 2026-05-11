"""Подготовка YOLOv11n-seg ONNX-модели для src.wheel_seg.

Сценарии:
1. Файл уже на месте → выходим без действия.
2. Задан YOLO_SEG_DOWNLOAD_URL → скачиваем по нему в WHEEL_SEG_MODEL_PATH.
3. Иначе → печатаем инструкцию по ручной подготовке (export через ultralytics).

Использование:
    python scripts/download_yolo_seg.py

Переменные окружения:
    WHEEL_SEG_MODEL_PATH     путь, куда положить .onnx (default: models/yolov11n-seg.onnx)
    YOLO_SEG_DOWNLOAD_URL    прямая ссылка на готовый .onnx (опционально)
"""

from __future__ import annotations

import os
import sys
import urllib.request
from pathlib import Path

DEFAULT_PATH = "models/yolov11n-seg.onnx"


def main() -> int:
    target = Path(os.getenv("WHEEL_SEG_MODEL_PATH", DEFAULT_PATH))
    if target.exists():
        size_mb = target.stat().st_size / 1024 / 1024
        print(f"✅ Уже на месте: {target} ({size_mb:.1f} MB)")
        return 0

    target.parent.mkdir(parents=True, exist_ok=True)

    url = os.getenv("YOLO_SEG_DOWNLOAD_URL")
    if url:
        print(f"⬇️  Скачиваю {url} → {target}")
        with urllib.request.urlopen(url) as resp, target.open("wb") as out:
            out.write(resp.read())
        size_mb = target.stat().st_size / 1024 / 1024
        print(f"✅ Готово: {target} ({size_mb:.1f} MB)")
        return 0

    print(
        "ℹ️  Модель не найдена и YOLO_SEG_DOWNLOAD_URL не задан.\n"
        f"   Целевой путь: {target}\n"
        "\n"
        "Варианты:\n"
        "  A) Экспорт из ultralytics (нужен torch + ultralytics):\n"
        "     pip install ultralytics\n"
        "     yolo export model=yolov11n-seg.pt format=onnx imgsz=640\n"
        f"     mv yolov11n-seg.onnx {target}\n"
        "\n"
        "  B) Указать прямой URL и перезапустить:\n"
        "     YOLO_SEG_DOWNLOAD_URL=https://... python scripts/download_yolo_seg.py\n"
        "\n"
        "Замечание: COCO-pretrained YOLOv11n-seg не имеет класса «колесо».\n"
        "Для production нужен fine-tuned на wheel-датасете (Roboflow Universe etc.)\n"
        "и WHEEL_SEG_CLASS_ID, выставленный под id класса колеса в этой модели."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
