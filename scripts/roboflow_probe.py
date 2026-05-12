"""Probe a Roboflow instance-segmentation model on a local image.

Example:
    ROBOFLOW_API_KEY=... .venv/bin/python scripts/roboflow_probe.py car.jpg

The script saves:
    - raw Roboflow JSON response
    - binary mask for selected classes
    - filtered combined mask for selected top-N objects
    - simple red overlay for visual inspection
"""

from __future__ import annotations

import argparse
import base64
import json
import os
from pathlib import Path
from typing import Any

import httpx
from PIL import Image, ImageDraw

DEFAULT_MODEL_ID = "wheels-tires-body/1"
DEFAULT_CLASSES = ("wheel",)
DEFAULT_OUTPUT_DIR = Path("tmp/roboflow")
DEFAULT_MIN_AREA_RATIO = 0.002
DEFAULT_TOP_N = 2


def _parse_model_id(model_id: str) -> tuple[str, str]:
    parts = model_id.strip("/").split("/")
    if len(parts) != 2 or not parts[0] or not parts[1]:
        raise ValueError(
            "model id must look like 'project-slug/version', e.g. tire-segmentation-eqoeu/5"
        )
    return parts[0], parts[1]


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


def _infer(
    *,
    image_path: Path,
    model_id: str,
    api_key: str,
    confidence: int,
    overlap: int,
) -> dict[str, Any]:
    project, version = _parse_model_id(model_id)
    url = f"https://outline.roboflow.com/{project}/{version}"
    image_b64 = base64.b64encode(image_path.read_bytes()).decode("ascii")
    params = {
        "api_key": api_key,
        "confidence": confidence,
        "overlap": overlap,
    }
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
    }
    with httpx.Client(timeout=60.0) as client:
        resp = client.post(url, params=params, content=image_b64, headers=headers)
    if resp.status_code >= 400:
        raise RuntimeError(f"Roboflow HTTP {resp.status_code}: {resp.text[:300]}")
    return resp.json()


def _prediction_points(prediction: dict[str, Any]) -> list[tuple[float, float]]:
    points = prediction.get("points") or []
    out: list[tuple[float, float]] = []
    for point in points:
        if isinstance(point, dict) and "x" in point and "y" in point:
            out.append((float(point["x"]), float(point["y"])))
        elif isinstance(point, list | tuple) and len(point) >= 2:
            out.append((float(point[0]), float(point[1])))
    return out


def _polygon_area(points: list[tuple[float, float]]) -> float:
    if len(points) < 3:
        return 0.0
    area = 0.0
    for idx, (x1, y1) in enumerate(points):
        x2, y2 = points[(idx + 1) % len(points)]
        area += (x1 * y2) - (x2 * y1)
    return abs(area) / 2.0


def _filter_predictions(
    *,
    predictions: list[dict[str, Any]],
    image_size: tuple[int, int],
    classes: set[str],
    min_area_ratio: float,
    top_n: int | None,
) -> list[dict[str, Any]]:
    image_area = image_size[0] * image_size[1]
    min_area = image_area * min_area_ratio
    candidates: list[tuple[float, float, dict[str, Any]]] = []

    for prediction in predictions:
        class_name = str(prediction.get("class", "")).lower()
        if classes and class_name not in classes:
            continue

        points = _prediction_points(prediction)
        area = _polygon_area(points)
        if area < min_area:
            continue

        confidence = float(prediction.get("confidence") or 0.0)
        candidates.append((area, confidence, prediction))

    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    if top_n and top_n > 0:
        candidates = candidates[:top_n]
    return [prediction for _area, _confidence, prediction in candidates]


def _build_mask(*, predictions: list[dict[str, Any]], image_size: tuple[int, int]) -> Image.Image:
    mask = Image.new("L", image_size, 0)
    draw = ImageDraw.Draw(mask)
    for prediction in predictions:
        points = _prediction_points(prediction)
        if len(points) >= 3:
            draw.polygon(points, fill=255)
    return mask


def _save_overlay(image_path: Path, mask: Image.Image, output_path: Path) -> None:
    image = Image.open(image_path).convert("RGBA")
    red = Image.new("RGBA", image.size, (255, 0, 0, 0))
    red.putalpha(mask.point(lambda value: 110 if value else 0))
    Image.alpha_composite(image, red).save(output_path)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("image", type=Path, help="Local image to send to Roboflow")
    parser.add_argument("--model-id", default=DEFAULT_MODEL_ID)
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
    if not args.image.exists():
        raise SystemExit(f"Image not found: {args.image}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    stem = args.image.stem
    classes = {item.strip().lower() for item in args.classes.split(",") if item.strip()}

    result = _infer(
        image_path=args.image,
        model_id=args.model_id,
        api_key=api_key,
        confidence=args.confidence,
        overlap=args.overlap,
    )

    json_path = args.output_dir / f"{stem}.roboflow.json"
    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    image = Image.open(args.image)
    predictions = result.get("predictions", [])
    selected = _filter_predictions(
        predictions=predictions,
        image_size=image.size,
        classes=classes,
        min_area_ratio=args.min_area_ratio,
        top_n=args.top_n,
    )
    mask = _build_mask(predictions=selected, image_size=image.size)
    mask_path = args.output_dir / f"{stem}.mask.png"
    combined_mask_path = args.output_dir / f"{stem}.combined_mask.png"
    overlay_path = args.output_dir / f"{stem}.overlay.png"
    mask.save(mask_path)
    mask.save(combined_mask_path)
    _save_overlay(args.image, mask, overlay_path)

    print(f"model: {args.model_id}")
    print(f"predictions: {len(predictions)} total, {len(selected)} selected")
    print(f"json: {json_path}")
    print(f"mask: {mask_path}")
    print(f"combined_mask: {combined_mask_path}")
    print(f"overlay: {overlay_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
