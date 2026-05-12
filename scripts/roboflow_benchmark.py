"""Benchmark several Roboflow segmentation models on a folder of images.

Example:
    ROBOFLOW_API_KEY=... .venv/bin/python scripts/roboflow_benchmark.py test-images

Outputs are saved under tmp/roboflow-benchmark/ by default:
    - one subdirectory per model
    - JSON/mask/overlay per image
    - summary.json and summary.csv
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
from pathlib import Path
from typing import Any

from PIL import Image
from roboflow_probe import (
    DEFAULT_MIN_AREA_RATIO,
    DEFAULT_TOP_N,
    _build_mask,
    _filter_predictions,
    _infer,
    _save_overlay,
)

DEFAULT_MODELS = (
    "wheels-tires-body/1",
    "tire-segmentation-eqoeu/5",
    "tire-model-5c5yg-k1wqh/1",
    "disk-segmentation/2",
)
DEFAULT_CLASSES = ("wheel", "tire")
DEFAULT_OUTPUT_DIR = Path("tmp/roboflow-benchmark")
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def _load_dotenv(path: Path = Path(".env")) -> None:
    """Tiny .env loader so local scripts work without shell `source .env`."""
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def _model_slug(model_id: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_.-]+", "_", model_id.strip("/"))


def _iter_images(path: Path) -> list[Path]:
    if path.is_file():
        return [path]
    images = [
        item
        for item in sorted(path.rglob("*"))
        if item.is_file() and item.suffix.lower() in IMAGE_SUFFIXES
    ]
    return images


def _class_counts(predictions: list[dict[str, Any]]) -> str:
    counts: dict[str, int] = {}
    for prediction in predictions:
        class_name = str(prediction.get("class", "unknown")).lower()
        counts[class_name] = counts.get(class_name, 0) + 1
    return ", ".join(f"{name}:{count}" for name, count in sorted(counts.items()))


def _write_summary(output_dir: Path, rows: list[dict[str, Any]]) -> None:
    summary_json = output_dir / "summary.json"
    summary_json.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")

    summary_csv = output_dir / "summary.csv"
    fieldnames = [
        "status",
        "model_id",
        "image",
        "total_predictions",
        "selected_predictions",
        "all_classes",
        "selected_classes",
        "mask_nonempty",
        "overlay",
        "mask",
        "combined_mask",
        "json",
        "error",
    ]
    with summary_csv.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fieldnames})


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("images", type=Path, help="Image file or directory with images")
    parser.add_argument(
        "--model-id",
        action="append",
        dest="model_ids",
        help="Roboflow model id. Can be passed multiple times.",
    )
    parser.add_argument("--classes", default=",".join(DEFAULT_CLASSES))
    parser.add_argument("--confidence", type=int, default=35)
    parser.add_argument("--overlap", type=int, default=30)
    parser.add_argument("--min-area-ratio", type=float, default=DEFAULT_MIN_AREA_RATIO)
    parser.add_argument("--top-n", type=int, default=DEFAULT_TOP_N)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    args = parser.parse_args()

    _load_dotenv()

    api_key = os.getenv("ROBOFLOW_API_KEY")
    if not api_key:
        raise SystemExit("ROBOFLOW_API_KEY is not set")
    if not args.images.exists():
        raise SystemExit(f"Path not found: {args.images}")

    model_ids = tuple(args.model_ids or DEFAULT_MODELS)
    classes = {item.strip().lower() for item in args.classes.split(",") if item.strip()}
    images = _iter_images(args.images)
    if not images:
        raise SystemExit(f"No images found under: {args.images}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    rows: list[dict[str, Any]] = []

    print(f"images: {len(images)}")
    print(f"models: {len(model_ids)}")
    print(f"output: {args.output_dir}")

    for model_id in model_ids:
        model_dir = args.output_dir / _model_slug(model_id)
        model_dir.mkdir(parents=True, exist_ok=True)
        print(f"\n== {model_id} ==")

        for image_path in images:
            row: dict[str, Any] = {
                "status": "ok",
                "model_id": model_id,
                "image": str(image_path),
                "total_predictions": 0,
                "selected_predictions": 0,
                "all_classes": "",
                "selected_classes": "",
                "mask_nonempty": False,
                "overlay": "",
                "mask": "",
                "combined_mask": "",
                "json": "",
                "error": "",
            }
            try:
                result = _infer(
                    image_path=image_path,
                    model_id=model_id,
                    api_key=api_key,
                    confidence=args.confidence,
                    overlap=args.overlap,
                )
                image = Image.open(image_path)
                predictions = result.get("predictions", [])
                selected = _filter_predictions(
                    predictions=predictions,
                    image_size=image.size,
                    classes=classes,
                    min_area_ratio=args.min_area_ratio,
                    top_n=args.top_n,
                )
                mask = _build_mask(predictions=selected, image_size=image.size)

                stem = image_path.stem
                json_path = model_dir / f"{stem}.roboflow.json"
                mask_path = model_dir / f"{stem}.mask.png"
                combined_mask_path = model_dir / f"{stem}.combined_mask.png"
                overlay_path = model_dir / f"{stem}.overlay.png"

                json_path.write_text(
                    json.dumps(result, ensure_ascii=False, indent=2),
                    encoding="utf-8",
                )
                mask.save(mask_path)
                mask.save(combined_mask_path)
                _save_overlay(image_path, mask, overlay_path)

                row.update(
                    {
                        "total_predictions": len(predictions),
                        "selected_predictions": len(selected),
                        "all_classes": _class_counts(predictions),
                        "selected_classes": _class_counts(selected),
                        "mask_nonempty": mask.getbbox() is not None,
                        "overlay": str(overlay_path),
                        "mask": str(mask_path),
                        "combined_mask": str(combined_mask_path),
                        "json": str(json_path),
                    }
                )
                print(
                    f"{image_path.name}: {row['selected_predictions']} selected "
                    f"({row['total_predictions']} total)"
                )
            except Exception as exc:
                row["status"] = "error"
                row["error"] = str(exc)[:300]
                print(f"{image_path.name}: ERROR {row['error']}")
            rows.append(row)
            _write_summary(args.output_dir, rows)

    print(f"\nsummary: {args.output_dir / 'summary.json'}")
    print(f"summary: {args.output_dir / 'summary.csv'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
