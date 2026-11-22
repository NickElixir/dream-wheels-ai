"""Export one private ImageCritic candidate; no database or model dependencies."""

import argparse
import hashlib
import json
import logging
import shutil
import zipfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

logger = logging.getLogger(__name__)
DATASET = Path("experiments/wan_bbox/results/metric-dataset-v1")
HANDOFF = Path("experiments/wan_bbox/results/imagecritic-handoff")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def contained_file(root: Path, relative: str) -> Path:
    path = root / relative
    if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
        raise ValueError("Unsafe input path")
    if not path.is_file():
        raise ValueError("Missing input file")
    return path


def write_json(path: Path, data: object) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def build_bundle(dataset: Path, destination: Path, number: int = 51) -> Path:
    root_manifest = json.loads((dataset / "manifest.json").read_text(encoding="utf-8"))
    prepared = json.loads((dataset / "prepared/manifest.json").read_text(encoding="utf-8"))
    case = next(c for c in root_manifest["cases"] if c["try_on_number"] == number)
    assets = {a["role"]: a for a in prepared["assets"] if a.get("case") == number}
    destination.mkdir(parents=True, exist_ok=True)
    folder = destination / f"imagecritic-case{number}-v1"
    archive = destination / f"{folder.name}.zip"
    if archive.exists():
        raise ValueError("Archive already exists")
    folder.mkdir()  # Never overwrite a previous handoff.
    exported = {}
    for role in ("car", "rim", "result"):
        entry = case["files"][role]
        source = contained_file(dataset, entry["path"])
        if sha256(source) != entry["sha256"]:
            raise ValueError(f"Source hash mismatch role={role}")
        with Image.open(source) as image:
            suffix = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}[image.format]
            size = list(image.size)
            image.verify()
        name = f"{role}.{suffix}"
        shutil.copyfile(source, folder / name)
        exported[role] = {"path": name, "sha256": entry["sha256"], "size": size}
    for role in ("rim", "front"):
        entry = assets[role]
        source = contained_file(dataset / "prepared", entry["image"])
        if sha256(source) != entry["sha256"]:
            raise ValueError(f"Crop hash mismatch role={role}")
        name = f"{role}-inspection-crop.png"
        shutil.copyfile(source, folder / name)
        exported[f"{role}_crop"] = {
            "path": name,
            "sha256": entry["sha256"],
            "size": entry["size"],
            "face_bbox_xyxy": entry["face_bbox_xyxy"],
            "bbox_note": "face envelope on full source; crop includes extra context",
        }
    preview = Image.new("RGB", (1400, 650), "white")
    draw = ImageDraw.Draw(preview)
    for column, role in enumerate(("rim_crop", "front_crop")):
        with Image.open(folder / exported[role]["path"]) as image:
            tile = ImageOps.contain(image.convert("RGB"), (680, 570))
        preview.paste(tile, (column * 700, 40))
        draw.text((column * 700 + 10, 10), role + " / inspection only", fill="black")
    draw.text(
        (10, 620), "Candidate only. Defect and repair rectangles NOT yet approved.", fill="black"
    )
    preview.save(folder / "candidate-review.png")
    write_json(
        folder / "case.json",
        {
            "case_number": number,
            "status": "CANDIDATE_PENDING_HUMAN_DEFECT_AND_REPAIR_BOX_APPROVAL",
            "face_envelopes": "accepted by owner; not a structural ground truth",
            "reference_role": "rim",
            "target_role": "result",
            "target_wheel_candidate": "front",
            "approved_defect": None,
            "approved_reference_box": None,
            "approved_target_box": None,
            "generation_authorized_for_this_case": False,
            "files": exported,
            "prepared_manifest_sha256": sha256(dataset / "prepared/manifest.json"),
            "limits": "No external uploads, no production access. One repair after case/profile gates.",
        },
    )
    inventory = []
    for path in sorted(folder.iterdir()):
        inventory.append(
            {
                "path": path.name,
                "size_bytes": path.stat().st_size,
                "sha256": sha256(path),
            }
        )
    write_json(
        folder / "bundle-inventory.json",
        {
            "version": 1,
            "case_number": number,
            "files": inventory,
            "note": "Inventory excludes itself; entire ZIP has an independent checksum.",
        },
    )
    with zipfile.ZipFile(archive, "x", compression=zipfile.ZIP_DEFLATED) as handle:
        for path in sorted(folder.iterdir()):
            handle.write(path, arcname=f"{folder.name}/{path.name}")
    write_json(
        destination / f"{folder.name}-zip-checksum.json",
        {
            "archive": archive.name,
            "sha256": sha256(archive),
            "size_bytes": archive.stat().st_size,
            "entries": len(inventory) + 1,
            "private": True,
        },
    )
    return archive


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dataset", type=Path, default=DATASET)
    parser.add_argument("--destination", type=Path, default=HANDOFF)
    args = parser.parse_args()
    archive = build_bundle(args.dataset, args.destination)
    print(f"Private bundle ready: {archive}; SHA256={sha256(archive)}")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        logger.exception("ImageCritic bundle preparation stopped; no overwrite or retry")
        raise SystemExit(1) from None
