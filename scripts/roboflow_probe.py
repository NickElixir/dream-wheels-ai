"""Probe a Roboflow instance-segmentation model on a local image.

Example:
    ROBOFLOW_API_KEY=... .venv/bin/python scripts/roboflow_probe.py car.jpg

The script saves:
    - raw Roboflow JSON response
    - binary mask for selected classes
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

DEFAULT_MODEL_ID = "tire-segmentation-eqoeu/5"
DEFAULT_CLASSES = ("wheel", "rim")
DEFAULT_OUTPUT_DIR = Path("tmp/roboflow")


def _parse_model_id(model_id: str) -> tuple[str, str]:
    parts = model_id.strip("/").split("/")
    if len(parts) != 2 or not parts[0] or not parts[1]:
        raise ValueError(
            "model id must look like 'project-slug/version', e.g. tire-segmentation-eqoeu/5"
        )
    return parts[0], parts[1]


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
    with httpx.Client(timeout=60.0) as client:
        resp = client.post(url, params=params, content=image_b64)
    if resp.status_code >= 400:
        raise RuntimeError(f"Roboflow HTTP {resp.status_code}: {resp.text[:500]}")
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


def _build_mask(
    *,
    result: dict[str, Any],
    image_size: tuple[int, int],
    classes: set[str],
) -> Image.Image:
    mask = Image.new("L", image_size, 0)
    draw = ImageDraw.Draw(mask)
    for prediction in result.get("predictions", []):
        class_name = str(prediction.get("class", "")).lower()
        if classes and class_name not in classes:
            continue
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
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    args = parser.parse_args()

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
    mask = _build_mask(result=result, image_size=image.size, classes=classes)
    mask_path = args.output_dir / f"{stem}.mask.png"
    overlay_path = args.output_dir / f"{stem}.overlay.png"
    mask.save(mask_path)
    _save_overlay(args.image, mask, overlay_path)

    predictions = result.get("predictions", [])
    selected = [
        pred for pred in predictions if not classes or str(pred.get("class", "")).lower() in classes
    ]
    print(f"model: {args.model_id}")
    print(f"predictions: {len(predictions)} total, {len(selected)} selected")
    print(f"json: {json_path}")
    print(f"mask: {mask_path}")
    print(f"overlay: {overlay_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
