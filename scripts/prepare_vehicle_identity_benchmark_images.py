"""Create bounded local benchmark previews without changing source assets."""

from __future__ import annotations

import argparse
import io
import json
from pathlib import Path

from PIL import Image, ImageOps


def prepare(manifest_path: Path, output_path: Path, *, max_edge: int) -> None:
    """Write JPEG previews and a matching manifest for a downloaded source manifest."""
    manifest = json.loads(manifest_path.read_text())
    output_cases: list[dict[str, object]] = []
    seen_case_ids: set[str] = set()
    for case in manifest["cases"]:
        case_id = case["case_id"]
        if case_id in seen_case_ids:
            continue
        source_path = manifest_path.parent / case["image_path"]
        if not source_path.exists():
            continue
        with Image.open(source_path) as source_image:
            source_image.load()
            image = ImageOps.exif_transpose(source_image)
            image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
            normalized = image.convert("RGB")
        destination = output_path.parent / "prepared" / f"{case['case_id']}.jpg"
        destination.parent.mkdir(parents=True, exist_ok=True)
        output = io.BytesIO()
        normalized.save(output, format="JPEG", quality=88, optimize=True)
        destination.write_bytes(output.getvalue())
        output_case = dict(case)
        output_case["image_path"] = str(destination.relative_to(output_path.parent))
        output_cases.append(output_case)
        seen_case_ids.add(case_id)
    output_path.write_text(
        json.dumps(
            {"dataset_version": manifest["dataset_version"], "cases": output_cases},
            ensure_ascii=False,
            indent=2,
        )
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--max-edge", type=int, default=1536)
    args = parser.parse_args()
    prepare(args.manifest, args.output, max_edge=args.max_edge)


if __name__ == "__main__":
    main()
