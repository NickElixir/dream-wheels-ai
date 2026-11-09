"""Read the supplied workbook/matrix and verify local catalog source files."""

import argparse
import csv
import hashlib
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

from PIL import Image

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def image_metadata(path: Path) -> dict:
    data = path.read_bytes()
    with Image.open(path) as image:
        width, height = image.size
        content_type = Image.MIME[image.format]
        image.verify()
    if content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise ValueError(f"Unsupported catalog image: {path.name}")
    if not data or len(data) > 8 * 1024 * 1024:
        raise ValueError(f"Invalid catalog image size: {path.name}")
    return {
        "fileName": path.name,
        "sha256": hashlib.sha256(data).hexdigest(),
        "sizeBytes": len(data),
        "width": width,
        "height": height,
        "contentType": content_type,
    }


def workbook_rows(workbook: Path) -> list[list[dict]]:
    with zipfile.ZipFile(workbook) as archive:
        strings = [
            "".join(x.itertext())
            for x in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("m:si", NS)
        ]
        sheets = []
        for name in ["sheet1.xml", "sheet2.xml"]:
            rows = []
            for row in ET.fromstring(archive.read("xl/worksheets/" + name)).findall(
                "m:sheetData/m:row", NS
            )[1:]:
                cells = {"excelRow": int(row.get("r"))}
                for cell in row:
                    value = cell.find("m:v", NS)
                    value = value.text if value is not None else ""
                    if cell.get("t") == "s":
                        value = strings[int(value)]
                    cells[re.sub(r"\d", "", cell.get("r"))] = value
                if cells.get("A"):
                    rows.append(cells)
            sheets.append(rows)
        return sheets


def audit(workbook: Path, matrix: Path, source_dir: Path, public_dir: Path) -> dict:
    sku_rows, design_rows = workbook_rows(workbook)
    with matrix.open(encoding="utf-8-sig", newline="") as stream:
        selections = list(csv.DictReader(stream))
    assets = {}
    source_dir = source_dir.resolve()
    for row in selections:
        barcode = row["barcode"]
        file_name = Path(row["wheel_path"]).name
        if not re.fullmatch(r"\d{8,16}", barcode) or not re.fullmatch(
            re.escape(barcode) + r"_\d+\.jpg", file_name
        ):
            raise ValueError("Invalid source barcode/filename")
        path = (source_dir / file_name).resolve()
        if path.parent != source_dir:
            raise ValueError("Source path escapes the supplied directory")
        source = image_metadata(path)
        if source["sha256"] != row["wheel_sha256"]:
            raise ValueError(f"Source changed from approved matrix: {file_name}")
        previews = {}
        for size in [320, 640]:
            preview = public_dir / f"assets/catalog/cutouts-v1/reference-{barcode}-{size}.webp"
            previews[str(size)] = {
                **image_metadata(preview),
                "landingPath": "/" + preview.relative_to(public_dir).as_posix(),
            }
        asset = {
            "id": f"wheel-image-{barcode}",
            "barcode": barcode,
            "source": source,
            "previews": previews,
        }
        if barcode in assets and assets[barcode] != asset:
            raise ValueError(f"Conflicting files for one barcode: {barcode}")
        assets[barcode] = asset
    return {
        "workbookSha256": hashlib.sha256(workbook.read_bytes()).hexdigest(),
        "matrixSha256": hashlib.sha256(matrix.read_bytes()).hexdigest(),
        "skuRows": sku_rows,
        "designRows": design_rows,
        "selections": [
            {key: row[key] for key in ["selection_id", "car", "wheel_model", "barcode", "sku_list"]}
            for row in selections
        ],
        "assets": sorted(assets.values(), key=lambda item: item["barcode"]),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workbook", type=Path, required=True)
    parser.add_argument("--matrix", type=Path, required=True)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--public-dir", type=Path, required=True)
    args = parser.parse_args()
    print(
        json.dumps(
            audit(args.workbook, args.matrix, args.source_dir, args.public_dir), ensure_ascii=False
        )
    )


if __name__ == "__main__":
    main()
