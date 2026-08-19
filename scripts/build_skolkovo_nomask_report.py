from __future__ import annotations

import argparse
import csv
import json
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_ARCHIVE_ROOT = Path(
    "/Users/nikolai/Documents/Dream Wheel AI/images/virtual_tryon_archive/skolkovo-no-mask-2026-06-17"
)
MANIFEST_PATH = ROOT_DIR / "tmp/skolkovo_nomask_selected.jsonl"

DEFAULT_ASSET_DIR = ROOT_DIR / "docs/assets/skolkovo-no-mask-report"
DEFAULT_MARKDOWN_PATH = ROOT_DIR / "docs/skolkovo-no-mask-report.md"
DEFAULT_SUMMARY_CSV_NAME = "skolkovo-no-mask-summary.csv"
DEFAULT_TITLE = "Skolkovo No-Mask Wheel Try-On Report"
DEFAULT_REFERENCE_LABEL = "silver multi-spoke alloy wheel"


@dataclass
class OpenAIRecord:
    first_status: str
    final_status: str
    output_image: str
    retry2_used: bool
    error: str


@dataclass
class ReveRecord:
    status: str
    output_image: str
    error: str


@dataclass
class CaseRecord:
    case_id: str
    original_image: str
    resized_image: str
    vehicle_label: str
    source_filename: str
    openai: OpenAIRecord
    reve: ReveRecord


@dataclass
class ReportConfig:
    archive_root: Path
    manifest_path: Path
    asset_dir: Path
    markdown_path: Path
    summary_csv_path: Path
    title: str
    reference_label: str
    report_slug: str


def _font(size: int, *, bold: bool = False):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
        if bold
        else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica.ttc",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


TITLE_FONT = _font(30, bold=True)
HEADER_FONT = _font(18, bold=True)
BODY_FONT = _font(14)
SMALL_FONT = _font(12)


def _csv_rows(path: Path) -> list[dict[str, str]]:
    csv.field_size_limit(sys.maxsize)
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def _load_cases(config: ReportConfig) -> list[CaseRecord]:
    manifest_rows = [
        json.loads(line)
        for line in config.manifest_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    original_dir = config.archive_root / "source_original"
    resized_dir = config.archive_root / "source_resized"

    openai_base: dict[str, dict[str, str]] = {}
    for csv_path in sorted(
        (config.archive_root / "gpt-image-2-nomask-per-case").glob(
            "*/openai_image_nomask_results.csv"
        )
    ):
        row = _csv_rows(csv_path)[0]
        openai_base[row["case_id"]] = row

    openai_retry2: dict[str, dict[str, str]] = {}
    for csv_path in sorted(
        (config.archive_root / "gpt-image-2-nomask-retry2-per-case").glob(
            "*/openai_image_nomask_results.csv"
        )
    ):
        row = _csv_rows(csv_path)[0]
        openai_retry2[row["case_id"]] = row

    reve_rows = {
        row["case_id"]: row
        for row in _csv_rows(config.archive_root / "reve-nomask/reve_image_nomask_results.csv")
    }

    cases: list[CaseRecord] = []
    for row in manifest_rows:
        case_id = row["id"]
        base_row = openai_base[case_id]
        retry_row = openai_retry2.get(case_id)
        final_row = base_row
        retry2_used = False
        if base_row["status"] != "completed" and retry_row and retry_row["status"] == "completed":
            final_row = retry_row
            retry2_used = True
        elif retry_row:
            retry2_used = True
            final_row = retry_row

        base_output = base_row.get("output_image", "")
        base_status = "completed" if base_row["status"] == "completed" and base_output else "failed"
        base_error = base_row.get("error", "")
        if base_row["status"] == "completed" and not base_output:
            base_error = base_error or "completed without image payload"

        final_output = final_row.get("output_image", "")
        final_status = (
            "completed" if final_row["status"] == "completed" and final_output else "failed"
        )
        final_error = final_row.get("error", "")
        if final_row["status"] == "completed" and not final_output:
            final_error = final_error or "completed without image payload"

        cases.append(
            CaseRecord(
                case_id=case_id,
                original_image=str(original_dir / Path(row["car_image"]).name),
                resized_image=str(resized_dir / f"{case_id}.png"),
                vehicle_label=row["vehicle_label"],
                source_filename=Path(row["car_image"]).name,
                openai=OpenAIRecord(
                    first_status=base_status,
                    final_status=final_status,
                    output_image=final_output,
                    retry2_used=retry2_used,
                    error=final_error,
                ),
                reve=ReveRecord(
                    status=reve_rows[case_id]["status"],
                    output_image=reve_rows[case_id].get("output_image", ""),
                    error=reve_rows[case_id].get("error", ""),
                ),
            )
        )
    return cases


def _fit(path: Path, size: tuple[int, int]) -> Image.Image:
    return ImageOps.contain(Image.open(path).convert("RGB"), size, method=Image.Resampling.LANCZOS)


def _paste_center(canvas: Image.Image, img: Image.Image, box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = box
    px = x0 + (x1 - x0 - img.width) // 2
    py = y0 + (y1 - y0 - img.height) // 2
    canvas.paste(img, (px, py))


def _status_text(openai: OpenAIRecord) -> str:
    if openai.final_status == "completed":
        if openai.first_status == "completed":
            return "completed first pass"
        return "completed after second pass"
    return "failed"


def _draw_strip(
    *,
    draw: ImageDraw.ImageDraw,
    canvas: Image.Image,
    x: int,
    y: int,
    width: int,
    height: int,
    label: str,
    path: Path | None,
    footer: str,
) -> None:
    draw.text((x, y), label, fill="#222222", font=HEADER_FONT)
    box = (x, y + 24, x + width, y + 24 + height)
    draw.rectangle(box, outline="#d8d8d8", width=2)
    if path and path.exists():
        img = _fit(path, (width - 12, height - 12))
        _paste_center(canvas, img, box)
    else:
        draw.text((x + 10, y + 40), "FAILED", fill="#9b3b2f", font=TITLE_FONT)
    draw.text((x, y + 24 + height + 6), footer, fill="#666666", font=SMALL_FONT)


def _build_cover(cases: list[CaseRecord], config: ReportConfig) -> str:
    preview_src = ROOT_DIR / "tmp/skolkovo_selected_preview.jpg"
    page = Image.new("RGB", (1600, 1100), "white")
    draw = ImageDraw.Draw(page)
    draw.text((32, 24), config.title, fill="#222222", font=TITLE_FONT)
    draw.text(
        (32, 62),
        "Deduplicated unique transport set from 61 photos: 24 representative vehicles.",
        fill="#555555",
        font=BODY_FONT,
    )
    openai_ok = sum(1 for case in cases if case.openai.final_status == "completed")
    reve_ok = sum(1 for case in cases if case.reve.status == "completed")
    draw.text(
        (32, 94),
        f"OpenAI gpt-image-2 no-mask: {openai_ok}/{len(cases)} final completions",
        fill="#222222",
        font=BODY_FONT,
    )
    draw.text(
        (32, 118),
        f"Reve no-mask: {reve_ok}/{len(cases)} final completions",
        fill="#222222",
        font=BODY_FONT,
    )
    draw.text(
        (32, 142),
        "Layout: source / OpenAI / Reve as full-width labeled strips on each page.",
        fill="#555555",
        font=BODY_FONT,
    )
    preview = _fit(preview_src, (1530, 900))
    _paste_center(page, preview, (32, 180, 1568, 1068))
    name = "cover-page.jpg"
    page.save(config.asset_dir / name, quality=92)
    return name


def _build_case_pages(cases: list[CaseRecord], config: ReportConfig) -> list[str]:
    pages: list[str] = []
    page_w = 1600
    page_h = 1120
    pad = 28
    strip_w = page_w - 2 * pad
    strip_h = 250
    gap = 32
    for idx, case in enumerate(cases, start=1):
        page = Image.new("RGB", (page_w, page_h), "white")
        draw = ImageDraw.Draw(page)
        draw.text((pad, 18), f"{idx:02d}. {case.case_id}", fill="#222222", font=TITLE_FONT)
        draw.text(
            (pad, 56),
            f"type: {case.vehicle_label} | source: {case.source_filename}",
            fill="#666666",
            font=BODY_FONT,
        )
        y1 = 96
        _draw_strip(
            draw=draw,
            canvas=page,
            x=pad,
            y=y1,
            width=strip_w,
            height=strip_h,
            label="Source image",
            path=Path(case.original_image),
            footer="original Skolkovo photo",
        )
        y2 = y1 + 24 + strip_h + gap
        _draw_strip(
            draw=draw,
            canvas=page,
            x=pad,
            y=y2,
            width=strip_w,
            height=strip_h,
            label="OpenAI gpt-image-2 no-mask",
            path=Path(case.openai.output_image) if case.openai.output_image else None,
            footer=_status_text(case.openai),
        )
        y3 = y2 + 24 + strip_h + gap
        _draw_strip(
            draw=draw,
            canvas=page,
            x=pad,
            y=y3,
            width=strip_w,
            height=strip_h,
            label="Reve no-mask",
            path=Path(case.reve.output_image) if case.reve.output_image else None,
            footer="completed first pass" if case.reve.status == "completed" else "failed",
        )
        if case.openai.final_status != "completed":
            draw.text(
                (pad, 1080),
                f"OpenAI final error: {case.openai.error}",
                fill="#8f3f2f",
                font=SMALL_FONT,
            )
        name = f"case-page-{idx:02d}-{case.case_id}.jpg"
        page.save(config.asset_dir / name, quality=92)
        pages.append(name)
    return pages


def _write_summary(cases: list[CaseRecord], config: ReportConfig) -> None:
    config.asset_dir.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "case_id",
        "vehicle_label",
        "source_filename",
        "openai_first_status",
        "openai_final_status",
        "openai_retry2_used",
        "openai_output_image",
        "reve_status",
        "reve_output_image",
    ]
    with config.summary_csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for case in cases:
            writer.writerow(
                {
                    "case_id": case.case_id,
                    "vehicle_label": case.vehicle_label,
                    "source_filename": case.source_filename,
                    "openai_first_status": case.openai.first_status,
                    "openai_final_status": case.openai.final_status,
                    "openai_retry2_used": str(case.openai.retry2_used).lower(),
                    "openai_output_image": case.openai.output_image,
                    "reve_status": case.reve.status,
                    "reve_output_image": case.reve.output_image,
                }
            )
    archive_summary = config.archive_root / "metadata" / config.summary_csv_path.name
    archive_summary.parent.mkdir(parents=True, exist_ok=True)
    archive_summary.write_text(
        config.summary_csv_path.read_text(encoding="utf-8"), encoding="utf-8"
    )


def _write_markdown(
    cover_page: str,
    case_pages: list[str],
    cases: list[CaseRecord],
    config: ReportConfig,
) -> None:
    openai_ok = sum(1 for case in cases if case.openai.final_status == "completed")
    reve_ok = sum(1 for case in cases if case.reve.status == "completed")
    openai_fail = (
        ", ".join(case.case_id for case in cases if case.openai.final_status != "completed") or "-"
    )
    lines = [
        "---",
        "geometry: landscape,margin=0.35in",
        "fontsize: 10pt",
        "header-includes:",
        "  - \\usepackage{graphicx}",
        "---",
        "",
        f"# {config.title}",
        "",
        "Date: 2026-06-17",
        "",
        "## Scope",
        "",
        "This report uses deduplicated Skolkovo transport photos without masks.",
        "",
        "- input pool: 61 local photos;",
        "- deduplicated representative transport subjects: 24;",
        f"- common wheel reference: {config.reference_label};",
        "- OpenAI path: `gpt-image-2` no-mask edit with source + reference image;",
        "- Reve path: direct no-mask remix with source + reference image.",
        "",
        "## Topline",
        "",
        "| Model | Final completed | Notes |",
        "| --- | --- | --- |",
        f"| `gpt-image-2` no-mask | {openai_ok}/{len(cases)} | final hard-fails: `{openai_fail}` |",
        f"| Reve no-mask | {reve_ok}/{len(cases)} | all deduplicated Skolkovo cases completed |",
        "",
        "\\begin{center}",
        f"\\includegraphics[width=\\textwidth,height=0.90\\textheight,keepaspectratio]{{docs/assets/{config.report_slug}/{cover_page}}}",
        "\\end{center}",
        "",
        "\\newpage",
        "",
    ]
    for page in case_pages:
        lines.extend(
            [
                "\\begin{center}",
                f"\\includegraphics[width=\\textwidth,height=0.94\\textheight,keepaspectratio]{{docs/assets/{config.report_slug}/{page}}}",
                "\\end{center}",
                "",
                "\\newpage",
                "",
            ]
        )
    lines.extend(
        [
            "## Output Files",
            "",
            f"- Summary CSV: `{config.summary_csv_path.relative_to(ROOT_DIR)}`",
            f"- Archive root: `{config.archive_root}`",
            "",
        ]
    )
    config.markdown_path.write_text("\n".join(lines), encoding="utf-8")


def _parse_args() -> ReportConfig:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive-root", type=Path, default=DEFAULT_ARCHIVE_ROOT)
    parser.add_argument("--manifest-path", type=Path, default=MANIFEST_PATH)
    parser.add_argument("--asset-dir", type=Path, default=DEFAULT_ASSET_DIR)
    parser.add_argument("--markdown-path", type=Path, default=DEFAULT_MARKDOWN_PATH)
    parser.add_argument("--summary-csv-name", default=DEFAULT_SUMMARY_CSV_NAME)
    parser.add_argument("--title", default=DEFAULT_TITLE)
    parser.add_argument("--reference-label", default=DEFAULT_REFERENCE_LABEL)
    parser.add_argument("--report-slug", default=DEFAULT_ASSET_DIR.name)
    args = parser.parse_args()
    return ReportConfig(
        archive_root=args.archive_root,
        manifest_path=args.manifest_path,
        asset_dir=args.asset_dir,
        markdown_path=args.markdown_path,
        summary_csv_path=args.asset_dir / args.summary_csv_name,
        title=args.title,
        reference_label=args.reference_label,
        report_slug=args.report_slug,
    )


def main() -> int:
    config = _parse_args()
    cases = _load_cases(config)
    config.asset_dir.mkdir(parents=True, exist_ok=True)
    _write_summary(cases, config)
    cover_page = _build_cover(cases, config)
    case_pages = _build_case_pages(cases, config)
    _write_markdown(cover_page, case_pages, cases, config)
    print(config.markdown_path)
    print(config.summary_csv_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
