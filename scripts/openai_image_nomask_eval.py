"""Budgeted OpenAI no-mask wheel edit evaluation runner."""

from __future__ import annotations

import argparse
import base64
import csv
import json
import mimetypes
import os
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from src.openai_image_edit import (  # noqa: E402
    DEFAULT_OPENAI_API_BASE_URL,
    DEFAULT_OPENAI_IMAGE_MODEL,
    DEFAULT_OPENAI_IMAGE_SIZE,
    DEFAULT_OPENAI_OUTPUT_FORMAT,
    build_openai_image_edit_url,
    first_b64_image,
    response_without_b64,
)

DEFAULT_OUTPUT_DIR = Path("tmp/openai-image-nomask-eval")


def _load_dotenv(path: Path = Path(".env")) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _resolve_path(value: str, *, manifest_dir: Path) -> Path:
    path = Path(value).expanduser()
    if path.is_absolute():
        return path
    return (manifest_dir / path).resolve()


def _read_manifest(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise SystemExit(f"Manifest not found: {path}")

    manifest_dir = path.parent.resolve()
    cases: list[dict[str, Any]] = []
    for line_no, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        item = json.loads(line)
        item["id"] = str(item.get("id") or f"case-{line_no:04d}")
        for field in ("car_image", "reference_image"):
            if not item.get(field):
                raise SystemExit(f"{path}:{line_no}: missing required field {field!r}")
            resolved = _resolve_path(str(item[field]), manifest_dir=manifest_dir)
            if not resolved.exists():
                raise SystemExit(f"{path}:{line_no}: {field} not found: {resolved}")
            item[field] = str(resolved)
        cases.append(item)
    return cases


def _write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def _write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def _mime_type(path: Path) -> str:
    return mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def _build_prompt(*, vehicle_label: str | None = None) -> str:
    subject = vehicle_label or "vehicle"
    return (
        f"Use the first input image as the source {subject} photo and the second input image as the wheel design reference. "
        "Replace the visible wheels with the exact wheel design, color, finish, spoke pattern, center cap, and material from the reference image. "
        "If text conflicts with the reference image, the reference image wins. Match correct perspective, scale, and alignment with each visible hub. "
        "Preserve tires, body shape, paint, windows, road, background, reflections, shadows, camera angle, and the overall composition. "
        "Do not crop, zoom, redraw the whole vehicle, repaint the vehicle, change the background, add text, logos, or watermarks. "
        "Keep the result photorealistic and as close as possible to the original photograph except for the wheel swap."
    )


def _resolve_api_settings() -> tuple[str, str]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")
    return api_key, os.getenv("OPENAI_BASE_URL") or DEFAULT_OPENAI_API_BASE_URL


def _read_streaming_image_edit_response(response: httpx.Response) -> dict[str, Any]:
    events: list[dict[str, Any]] = []
    last_b64: str | None = None
    for line in response.iter_lines():
        if not line.startswith("data:"):
            continue
        payload = line.removeprefix("data:").strip()
        if not payload or payload == "[DONE]":
            continue
        event = json.loads(payload)
        events.append(event)
        if isinstance(event.get("b64_json"), str):
            last_b64 = event["b64_json"]
    return {"data": [{"b64_json": last_b64}]} if last_b64 else {"data": [], "stream_events": events}


def _call_openai_edit(*, row: dict[str, Any], timeout: float, max_retries: int) -> dict[str, Any]:
    api_key, base_url = _resolve_api_settings()
    car_path = Path(row["car_image"])
    reference_path = Path(row["reference_image"])
    data = {
        "model": row["model"],
        "prompt": row["prompt"],
        "size": row["size"],
        "quality": row["quality"],
        "output_format": row["output_format"],
        "n": "1",
        "stream": "true",
        "partial_images": "1",
    }
    with car_path.open("rb") as car_handle, reference_path.open("rb") as reference_handle:
        files = [
            ("image[]", (car_path.name, car_handle, _mime_type(car_path))),
            ("image[]", (reference_path.name, reference_handle, _mime_type(reference_path))),
        ]
        for attempt in range(max_retries + 1):
            try:
                with httpx.Client(http2=False, trust_env=False, timeout=timeout) as client:
                    with client.stream(
                        "POST",
                        build_openai_image_edit_url(base_url),
                        headers={"Authorization": f"Bearer {api_key}"},
                        data=data,
                        files=files,
                    ) as response:
                        if response.status_code >= 400:
                            raise RuntimeError(
                                "openai image edit failed "
                                f"{response.status_code}: {response.read().decode('utf-8', 'replace')}"
                            )
                        return _read_streaming_image_edit_response(response)
            except (httpx.ConnectError, httpx.ReadError, httpx.RemoteProtocolError):
                if attempt >= max_retries:
                    raise
                time.sleep(1.5 * (attempt + 1))
        raise RuntimeError("OpenAI no-mask request failed after retries")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--model", default=DEFAULT_OPENAI_IMAGE_MODEL)
    parser.add_argument("--size", default=DEFAULT_OPENAI_IMAGE_SIZE)
    parser.add_argument("--quality", default="low")
    parser.add_argument("--output-format", default=DEFAULT_OPENAI_OUTPUT_FORMAT)
    parser.add_argument("--timeout", type=float, default=240.0)
    parser.add_argument("--max-retries", type=int, default=2)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()

    _load_dotenv()
    cases = _read_manifest(args.manifest)
    selected = cases[: args.limit] if args.limit else cases
    rows = [
        {
            "case_id": case["id"],
            "config": f"openai-{args.model}-nomask",
            "model": args.model,
            "size": args.size,
            "quality": args.quality,
            "output_format": args.output_format,
            "car_image": case["car_image"],
            "reference_image": case["reference_image"],
            "vehicle_label": case.get("vehicle_label", ""),
            "prompt": _build_prompt(vehicle_label=case.get("vehicle_label")),
        }
        for case in selected
    ]

    args.output_dir.mkdir(parents=True, exist_ok=True)
    plan_jsonl = args.output_dir / "openai_image_nomask_plan.jsonl"
    plan_csv = args.output_dir / "openai_image_nomask_plan.csv"
    _write_jsonl(plan_jsonl, rows)
    _write_csv(plan_csv, rows)
    print(f"cases: {len(rows)}")
    print(f"plan jsonl: {plan_jsonl}")
    print(f"plan csv: {plan_csv}")

    if not args.execute:
        print("dry-run only. Add --execute to run paid OpenAI image edits.")
        return 0

    results: list[dict[str, Any]] = []
    outputs_dir = args.output_dir / "outputs"
    outputs_dir.mkdir(parents=True, exist_ok=True)
    for idx, row in enumerate(rows, start=1):
        print(f"[{idx}/{len(rows)}] {row['case_id']} {row['config']}", flush=True)
        started_at = datetime.now(UTC).isoformat()
        try:
            result = _call_openai_edit(row=row, timeout=args.timeout, max_retries=args.max_retries)
            image_b64 = first_b64_image(result)
            output_path = outputs_dir / f"{row['case_id']}__{row['config']}.png"
            if image_b64:
                output_path.write_bytes(base64.b64decode(image_b64))
            record = {
                **row,
                "status": "completed",
                "output_image": str(output_path) if image_b64 else "",
                "error": "",
                "started_at": started_at,
                "completed_at": datetime.now(UTC).isoformat(),
                "raw_result": json.dumps(response_without_b64(result), ensure_ascii=False),
            }
            print(f"  completed: {record['output_image']}", flush=True)
        except Exception as exc:
            record = {
                **row,
                "status": "failed",
                "output_image": "",
                "error": str(exc),
                "started_at": started_at,
                "completed_at": datetime.now(UTC).isoformat(),
                "raw_result": "",
            }
            print(f"  failed: {exc}", flush=True)
        results.append(record)

    results_jsonl = args.output_dir / "openai_image_nomask_results.jsonl"
    results_csv = args.output_dir / "openai_image_nomask_results.csv"
    _write_jsonl(results_jsonl, results)
    _write_csv(results_csv, results)
    print(f"results jsonl: {results_jsonl}")
    print(f"results csv: {results_csv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
