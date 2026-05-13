"""Use a vision-language model to choose real wheel masks from Roboflow candidates.

Example:
    .venv/bin/python scripts/vlm_mask_filter_probe.py \
      webapp/cover.jpg \
      tmp/roboflow/cover.roboflow.json \
      --output-dir tmp/vlm-mask-filter

Required .env values:
    VLM_BASE_URL=https://api.zveno.ai/v1
    VLM_API_KEY=...
    VLM_MODEL=qwen/qwen3-vl-30b-a3b-instruct

The VLM does not draw masks. It only returns candidate IDs to keep/reject.
This script combines the selected Roboflow polygons into the final mask.
"""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import re
from pathlib import Path
from typing import Any

import httpx
from PIL import Image, ImageDraw, ImageFont
from roboflow_probe import (
    DEFAULT_MIN_AREA_RATIO,
    DEFAULT_TOP_N,
    _build_mask,
    _filter_predictions,
    _prediction_points,
)

DEFAULT_CLASSES = ("wheel",)
DEFAULT_OUTPUT_DIR = Path("tmp/vlm-mask-filter")
DEFAULT_TIMEOUT_SECONDS = 120.0


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


def _image_data_url(path: Path) -> str:
    mime_type = mimetypes.guess_type(path.name)[0] or "image/png"
    payload = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{payload}"


def _candidate_metadata(
    *, candidates: list[dict[str, Any]], image_size: tuple[int, int]
) -> list[dict[str, Any]]:
    width, height = image_size
    metadata: list[dict[str, Any]] = []
    for candidate_id, prediction in enumerate(candidates):
        points = _prediction_points(prediction)
        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        if xs and ys:
            bbox = [min(xs), min(ys), max(xs), max(ys)]
            center = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
        else:
            bbox = [0.0, 0.0, 0.0, 0.0]
            center = [0.0, 0.0]
        area = float((bbox[2] - bbox[0]) * (bbox[3] - bbox[1]))
        metadata.append(
            {
                "id": candidate_id,
                "class": prediction.get("class"),
                "confidence": prediction.get("confidence"),
                "bbox_xyxy": [round(value, 1) for value in bbox],
                "center_xy": [round(value, 1) for value in center],
                "center_ratio_xy": [
                    round(center[0] / width, 3) if width else 0,
                    round(center[1] / height, 3) if height else 0,
                ],
                "bbox_area_ratio": round(area / (width * height), 5) if width and height else 0,
            }
        )
    return metadata


def _save_labeled_overlay(
    *,
    image_path: Path,
    candidates: list[dict[str, Any]],
    output_path: Path,
    padding_bottom: int,
) -> None:
    image = Image.open(image_path).convert("RGBA")
    if padding_bottom > 0:
        padded = Image.new("RGBA", (image.width, image.height + padding_bottom), (0, 0, 0, 255))
        padded.paste(image, (0, 0))
        image = padded

    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    label_font = ImageFont.load_default()
    colors = [
        (255, 70, 70, 120),
        (70, 170, 255, 120),
        (90, 220, 120, 120),
        (255, 190, 70, 120),
        (210, 110, 255, 120),
        (60, 230, 220, 120),
    ]

    for candidate_id, prediction in enumerate(candidates):
        points = _prediction_points(prediction)
        if len(points) < 3:
            continue
        color = colors[candidate_id % len(colors)]
        draw.polygon(points, fill=color, outline=(*color[:3], 255))

        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        label = str(candidate_id)
        label_x = int(min(xs))
        label_y = int(min(ys))
        bbox = draw.textbbox((label_x, label_y), label, font=label_font)
        pad = 3
        draw.rectangle(
            (bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad),
            fill=(0, 0, 0, 210),
        )
        draw.text((label_x, label_y), label, fill=(255, 255, 255, 255), font=label_font)

    Image.alpha_composite(image, overlay).save(output_path)


def _extract_json_object(text: str) -> dict[str, Any]:
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if not match:
            raise ValueError(f"VLM response is not JSON: {text[:500]}")
        parsed = json.loads(match.group(0))
    if not isinstance(parsed, dict):
        raise ValueError("VLM response JSON must be an object")
    return parsed


def _call_vlm(
    *,
    base_url: str,
    api_key: str,
    model: str,
    image_path: Path,
    overlay_path: Path,
    candidates: list[dict[str, Any]],
    timeout_seconds: float,
) -> dict[str, Any]:
    url = base_url.rstrip("/") + "/chat/completions"
    prompt = (
        "You are filtering instance-segmentation candidates for a car wheel mask.\n"
        "You receive two images: the original car image and a labeled overlay with candidate "
        "mask IDs. Keep only physical visible wheels/rims/tires on the actual car. Reject road "
        "reflections, wet-floor reflections, shadows, body panels, background objects, and partial "
        "artifacts that are not real wheels.\n\n"
        "Return only compact JSON with this schema:\n"
        "{"
        '"keep_candidate_ids":[0],'
        '"reject_candidate_ids":[1],'
        '"confidence":0.0,'
        '"reasoning_summary":"short reason"'
        "}\n\n"
        f"Candidate metadata:\n{json.dumps(candidates, ensure_ascii=False)}"
    )
    payload: dict[str, Any] = {
        "model": model,
        "temperature": 0,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": _image_data_url(image_path)},
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": _image_data_url(overlay_path)},
                    },
                ],
            }
        ],
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=timeout_seconds) as client:
        response = client.post(url, headers=headers, json=payload)
    if response.status_code >= 400:
        raise RuntimeError(f"VLM HTTP {response.status_code}: {response.text[:500]}")
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    result = _extract_json_object(content)
    result["_raw_response"] = data
    return result


def _candidate_ids(value: Any, *, max_id: int) -> list[int]:
    if not isinstance(value, list):
        return []
    ids: list[int] = []
    for item in value:
        try:
            candidate_id = int(item)
        except (TypeError, ValueError):
            continue
        if 0 <= candidate_id <= max_id and candidate_id not in ids:
            ids.append(candidate_id)
    return ids


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("image", type=Path, help="Original image sent to Roboflow")
    parser.add_argument("roboflow_json", type=Path, help="Raw Roboflow JSON response")
    parser.add_argument("--classes", default=",".join(DEFAULT_CLASSES))
    parser.add_argument("--min-area-ratio", type=float, default=DEFAULT_MIN_AREA_RATIO)
    parser.add_argument("--top-n", type=int, default=DEFAULT_TOP_N)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--timeout-seconds", type=float, default=DEFAULT_TIMEOUT_SECONDS)
    parser.add_argument("--model", help="Override VLM_MODEL from .env for A/B tests")
    parser.add_argument(
        "--overlay-padding-bottom",
        type=int,
        default=80,
        help="Extra pixels below the image in the debug overlay so bottom candidates are not clipped",
    )
    args = parser.parse_args()

    _load_dotenv()

    base_url = os.getenv("VLM_BASE_URL")
    api_key = os.getenv("VLM_API_KEY")
    model = args.model or os.getenv("VLM_MODEL")
    if not base_url:
        raise SystemExit("VLM_BASE_URL is not set")
    if not api_key:
        raise SystemExit("VLM_API_KEY is not set")
    if not model:
        raise SystemExit("VLM_MODEL is not set")
    if not args.image.exists():
        raise SystemExit(f"Image not found: {args.image}")
    if not args.roboflow_json.exists():
        raise SystemExit(f"Roboflow JSON not found: {args.roboflow_json}")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    stem = args.image.stem
    classes = {item.strip().lower() for item in args.classes.split(",") if item.strip()}

    image = Image.open(args.image)
    roboflow_result = json.loads(args.roboflow_json.read_text(encoding="utf-8"))
    predictions = roboflow_result.get("predictions", [])
    candidates = _filter_predictions(
        predictions=predictions,
        image_size=image.size,
        classes=classes,
        min_area_ratio=args.min_area_ratio,
        top_n=args.top_n,
    )
    if not candidates:
        raise SystemExit("No Roboflow candidates after filtering")

    metadata = _candidate_metadata(candidates=candidates, image_size=image.size)
    overlay_path = args.output_dir / f"{stem}.vlm_candidates_overlay.png"
    _save_labeled_overlay(
        image_path=args.image,
        candidates=candidates,
        output_path=overlay_path,
        padding_bottom=args.overlay_padding_bottom,
    )

    result = _call_vlm(
        base_url=base_url,
        api_key=api_key,
        model=model,
        image_path=args.image,
        overlay_path=overlay_path,
        candidates=metadata,
        timeout_seconds=args.timeout_seconds,
    )

    keep_ids = _candidate_ids(result.get("keep_candidate_ids"), max_id=len(candidates) - 1)
    reject_ids = _candidate_ids(result.get("reject_candidate_ids"), max_id=len(candidates) - 1)
    selected = [
        candidate for candidate_id, candidate in enumerate(candidates) if candidate_id in keep_ids
    ]
    mask = _build_mask(predictions=selected, image_size=image.size)

    mask_path = args.output_dir / f"{stem}.vlm_mask.png"
    result_path = args.output_dir / f"{stem}.vlm_result.json"
    metadata_path = args.output_dir / f"{stem}.vlm_candidates.json"
    mask.save(mask_path)
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"model: {model}")
    print(f"candidates: {len(candidates)}")
    print(f"keep_candidate_ids: {keep_ids}")
    print(f"reject_candidate_ids: {reject_ids}")
    print(f"confidence: {result.get('confidence')}")
    print(f"reasoning_summary: {result.get('reasoning_summary')}")
    print(f"overlay: {overlay_path}")
    print(f"mask: {mask_path}")
    print(f"result: {result_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
