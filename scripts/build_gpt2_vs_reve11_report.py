from __future__ import annotations

import csv
import json
import math
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT_DIR = Path(__file__).resolve().parents[1]

MANIFEST_PATH = ROOT_DIR / "tmp/model-compare-gpt2-vs-reve11/selected_cases_20.jsonl"
OPENAI_RESULTS_PATH = (
    ROOT_DIR / "tmp/model-compare-gpt2-vs-reve11/openai-results/openai_image_edit_results.csv"
)
OPENAI_RETRY_PATH = (
    ROOT_DIR / "tmp/model-compare-gpt2-vs-reve11/openai-retry-results/openai_image_edit_results.csv"
)
REVE_RESULTS_PATH = (
    ROOT_DIR / "tmp/model-compare-gpt2-vs-reve11/reve-results/reve_image_edit_results.csv"
)
REVE_RETRY_PATH = (
    ROOT_DIR / "tmp/model-compare-gpt2-vs-reve11/reve-retry-results/reve_image_edit_results.csv"
)

ASSET_DIR = ROOT_DIR / "docs/assets/gpt-image-2-vs-reve11-report"
SUMMARY_CSV_PATH = ASSET_DIR / "gpt-image-2-vs-reve11-summary.csv"
MARKDOWN_PATH = ROOT_DIR / "docs/gpt-image-2-vs-reve11-report.md"

REFERENCE_IMAGE = ROOT_DIR / "docs/assets/fal-mask-inpaint-eval/inputs/reference-rim1.jpg"


@dataclass
class ModelResult:
    first_pass_status: str
    final_status: str
    output_image: str
    first_pass_error: str
    final_error: str
    retry_used: bool


@dataclass
class CaseRecord:
    case_id: str
    car_image: str
    mask_image: str
    reference_image: str
    wheel_description: str
    category: str
    category_label: str
    openai: ModelResult
    reve: ModelResult


def _font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
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
HEADER_FONT = _font(20, bold=True)
BODY_FONT = _font(15)
SMALL_FONT = _font(13)
TINY_FONT = _font(12)


def _csv_rows(path: Path) -> list[dict[str, str]]:
    csv.field_size_limit(sys.maxsize)
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def _manifest_rows(path: Path) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        rows.append(json.loads(line))
    return rows


def _category_for_case(case_id: str) -> tuple[str, str]:
    if case_id.startswith("ivan-C"):
        return "ivan_day", "Ivan daylight"
    if case_id.startswith("ivan-N"):
        return "ivan_night", "Ivan night"
    if case_id in {"rain-flood-bmw", "night-heavy-rain-sedan", "istock-rain-splash"}:
        return "rain_stress", "Rain stress"
    return "wheel_labeling", "Wheel-labeling stress"


def _merge_model_results(
    *,
    base_rows: list[dict[str, str]],
    retry_rows: list[dict[str, str]],
) -> dict[str, ModelResult]:
    retry_map = {row["case_id"]: row for row in retry_rows}
    merged: dict[str, ModelResult] = {}
    for row in base_rows:
        case_id = row["case_id"]
        retry_row = retry_map.get(case_id)
        retry_completed = retry_row is not None and retry_row["status"] == "completed"
        final_row = retry_row if retry_completed else row
        merged[case_id] = ModelResult(
            first_pass_status=row["status"],
            final_status=final_row["status"],
            output_image=final_row.get("output_image", ""),
            first_pass_error=row.get("error", ""),
            final_error=final_row.get("error", ""),
            retry_used=retry_row is not None,
        )
    return merged


def _load_cases() -> list[CaseRecord]:
    manifest_rows = _manifest_rows(MANIFEST_PATH)
    openai_rows = _csv_rows(OPENAI_RESULTS_PATH)
    openai_retry_rows = _csv_rows(OPENAI_RETRY_PATH) if OPENAI_RETRY_PATH.exists() else []
    reve_rows = _csv_rows(REVE_RESULTS_PATH)
    reve_retry_rows = _csv_rows(REVE_RETRY_PATH) if REVE_RETRY_PATH.exists() else []

    openai = _merge_model_results(base_rows=openai_rows, retry_rows=openai_retry_rows)
    reve = _merge_model_results(base_rows=reve_rows, retry_rows=reve_retry_rows)

    cases: list[CaseRecord] = []
    for row in manifest_rows:
        category, category_label = _category_for_case(row["id"])
        cases.append(
            CaseRecord(
                case_id=row["id"],
                car_image=row["car_image"],
                mask_image=row["mask_image"],
                reference_image=row["reference_image"],
                wheel_description=row["wheel_description"],
                category=category,
                category_label=category_label,
                openai=openai[row["id"]],
                reve=reve[row["id"]],
            )
        )
    return cases


def _fit_image(path: Path, size: tuple[int, int]) -> Image.Image:
    image = Image.open(path).convert("RGB")
    return ImageOps.contain(image, size, method=Image.Resampling.LANCZOS)


def _paste_center(canvas: Image.Image, image: Image.Image, box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    px = x0 + (bw - image.width) // 2
    py = y0 + (bh - image.height) // 2
    canvas.paste(image, (px, py))


def _status_text(result: ModelResult) -> str:
    if result.final_status == "completed":
        if result.first_pass_status == "completed":
            return "completed first pass"
        return "completed after 1 retry"
    return "failed"


def _draw_panel(
    *,
    draw: ImageDraw.ImageDraw,
    canvas: Image.Image,
    box: tuple[int, int, int, int],
    label: str,
    path: Path | None,
    footer: str = "",
) -> None:
    x0, y0, x1, y1 = box
    draw.text((x0, y0 - 24), label, fill="#333333", font=BODY_FONT)
    draw.rectangle(box, outline="#d9d9d9", width=2)
    if path and path.exists():
        image = _fit_image(path, (x1 - x0 - 14, y1 - y0 - 14))
        _paste_center(canvas, image, box)
    else:
        draw.text((x0 + 12, y0 + 12), "FAILED", fill="#a33b2e", font=HEADER_FONT)
    if footer:
        draw.text((x0, y1 + 6), footer, fill="#666666", font=SMALL_FONT)


def _build_selection_overview(cases: list[CaseRecord]) -> list[str]:
    pages: list[str] = []
    per_page = 12
    cols = 3
    thumb_w = 310
    thumb_h = 180
    pad = 18
    label_h = 42
    page_w = cols * (thumb_w + pad) + pad

    for page_idx in range(math.ceil(len(cases) / per_page)):
        chunk = cases[page_idx * per_page : (page_idx + 1) * per_page]
        rows = math.ceil(len(chunk) / cols)
        page_h = 82 + rows * (thumb_h + label_h + pad) + pad
        page = Image.new("RGB", (page_w, page_h), "white")
        draw = ImageDraw.Draw(page)
        draw.text(
            (pad, 16), f"Dataset Selection Overview {page_idx + 1}", fill="#222222", font=TITLE_FONT
        )
        draw.text(
            (pad, 50),
            "Chosen cases for head-to-head comparison: source inputs only.",
            fill="#666666",
            font=SMALL_FONT,
        )
        for idx, case in enumerate(chunk):
            r, c = divmod(idx, cols)
            x = pad + c * (thumb_w + pad)
            y = 82 + r * (thumb_h + label_h + pad)
            box = (x, y, x + thumb_w, y + thumb_h)
            draw.rectangle(box, outline="#d8d8d8", width=2)
            image = _fit_image(Path(case.car_image), (thumb_w - 12, thumb_h - 12))
            _paste_center(page, image, box)
            draw.text((x, y + thumb_h + 6), case.case_id, fill="#222222", font=BODY_FONT)
            draw.text((x, y + thumb_h + 24), case.category_label, fill="#666666", font=SMALL_FONT)
        name = f"selection-overview-page-{page_idx + 1:02d}.jpg"
        page.save(ASSET_DIR / name, quality=92)
        pages.append(name)
    return pages


def _build_compare_overview(cases: list[CaseRecord]) -> list[str]:
    pages: list[str] = []
    per_page = 5
    row_h = 225
    pad = 18
    gap = 12
    page_w = 1500
    img_w = 250
    img_h = 150
    title_h = 72
    for page_idx in range(math.ceil(len(cases) / per_page)):
        chunk = cases[page_idx * per_page : (page_idx + 1) * per_page]
        page_h = title_h + pad + len(chunk) * row_h + pad
        page = Image.new("RGB", (page_w, page_h), "white")
        draw = ImageDraw.Draw(page)
        draw.text((pad, 16), f"Output Overview {page_idx + 1}", fill="#222222", font=TITLE_FONT)
        draw.text(
            (pad, 50),
            "Each row: source, official OpenAI gpt-image-2, direct Reve masked.",
            fill="#666666",
            font=SMALL_FONT,
        )
        for idx, case in enumerate(chunk):
            y = title_h + pad + idx * row_h
            draw.line((pad, y - 8, page_w - pad, y - 8), fill="#ececec", width=1)
            draw.text((pad, y), case.case_id, fill="#222222", font=HEADER_FONT)
            draw.text((pad, y + 26), case.category_label, fill="#666666", font=SMALL_FONT)
            x_positions = [230, 230 + img_w + gap, 230 + 2 * (img_w + gap)]
            panels = [
                ("Source", Path(case.car_image), ""),
                (
                    "gpt-image-2",
                    Path(case.openai.output_image) if case.openai.output_image else None,
                    _status_text(case.openai),
                ),
                (
                    "Reve masked",
                    Path(case.reve.output_image) if case.reve.output_image else None,
                    _status_text(case.reve),
                ),
            ]
            for x, (label, path, footer) in zip(x_positions, panels, strict=True):
                box = (x, y + 6, x + img_w, y + 6 + img_h)
                _draw_panel(draw=draw, canvas=page, box=box, label=label, path=path, footer=footer)
        name = f"compare-overview-page-{page_idx + 1:02d}.jpg"
        page.save(ASSET_DIR / name, quality=92)
        pages.append(name)
    return pages


def _build_detail_pages(cases: list[CaseRecord]) -> list[str]:
    pages: list[str] = []
    page_w = 1600
    page_h = 930
    pad = 28
    gap = 20
    col_w = (page_w - 2 * pad - 3 * gap) // 4
    box_y = 130
    box_h = 610

    for idx, case in enumerate(cases, start=1):
        page = Image.new("RGB", (page_w, page_h), "white")
        draw = ImageDraw.Draw(page)
        draw.text((pad, 20), f"{idx:02d}. {case.case_id}", fill="#222222", font=TITLE_FONT)
        draw.text((pad, 58), case.category_label, fill="#666666", font=BODY_FONT)

        x_positions = [pad + i * (col_w + gap) for i in range(4)]
        panels = [
            ("Source image", Path(case.car_image), ""),
            ("Wheel reference", Path(REFERENCE_IMAGE), ""),
            (
                "OpenAI gpt-image-2",
                Path(case.openai.output_image) if case.openai.output_image else None,
                _status_text(case.openai),
            ),
            (
                "Reve masked",
                Path(case.reve.output_image) if case.reve.output_image else None,
                _status_text(case.reve),
            ),
        ]
        for x, (label, path, footer) in zip(x_positions, panels, strict=True):
            box = (x, box_y, x + col_w, box_y + box_h)
            _draw_panel(draw=draw, canvas=page, box=box, label=label, path=path, footer=footer)

        notes_y = 790
        draw.text(
            (pad, notes_y),
            f"OpenAI: first pass={case.openai.first_pass_status}; final={case.openai.final_status}",
            fill="#555555",
            font=SMALL_FONT,
        )
        draw.text(
            (pad, notes_y + 22),
            f"Reve: first pass={case.reve.first_pass_status}; final={case.reve.final_status}",
            fill="#555555",
            font=SMALL_FONT,
        )
        if case.openai.final_error:
            draw.text(
                (pad, notes_y + 44),
                f"OpenAI error: {case.openai.final_error}",
                fill="#8f3f2f",
                font=TINY_FONT,
            )
        if case.reve.final_error:
            draw.text(
                (pad, notes_y + 62),
                f"Reve error: {case.reve.final_error}",
                fill="#8f3f2f",
                font=TINY_FONT,
            )

        name = f"detail-page-{idx:02d}-{case.case_id}.jpg"
        page.save(ASSET_DIR / name, quality=92)
        pages.append(name)
    return pages


def _write_summary_csv(cases: list[CaseRecord]) -> None:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "case_id",
        "category",
        "category_label",
        "openai_first_pass_status",
        "openai_final_status",
        "openai_retry_used",
        "openai_output_image",
        "reve_first_pass_status",
        "reve_final_status",
        "reve_retry_used",
        "reve_output_image",
    ]
    with SUMMARY_CSV_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for case in cases:
            writer.writerow(
                {
                    "case_id": case.case_id,
                    "category": case.category,
                    "category_label": case.category_label,
                    "openai_first_pass_status": case.openai.first_pass_status,
                    "openai_final_status": case.openai.final_status,
                    "openai_retry_used": str(case.openai.retry_used).lower(),
                    "openai_output_image": case.openai.output_image,
                    "reve_first_pass_status": case.reve.first_pass_status,
                    "reve_final_status": case.reve.final_status,
                    "reve_retry_used": str(case.reve.retry_used).lower(),
                    "reve_output_image": case.reve.output_image,
                }
            )


def _counts(cases: list[CaseRecord], model: str, attr: str) -> int:
    return sum(1 for case in cases if getattr(getattr(case, model), attr) == "completed")


def _failed_cases(cases: list[CaseRecord], model: str, attr: str) -> list[str]:
    return [case.case_id for case in cases if getattr(getattr(case, model), attr) != "completed"]


def _write_markdown(
    *,
    selection_pages: list[str],
    overview_pages: list[str],
    detail_pages: list[str],
    cases: list[CaseRecord],
) -> None:
    openai_first = _counts(cases, "openai", "first_pass_status")
    openai_final = _counts(cases, "openai", "final_status")
    reve_first = _counts(cases, "reve", "first_pass_status")
    reve_final = _counts(cases, "reve", "final_status")
    openai_first_failed = ", ".join(_failed_cases(cases, "openai", "first_pass_status")) or "-"
    openai_final_failed = ", ".join(_failed_cases(cases, "openai", "final_status")) or "-"
    reve_first_failed = ", ".join(_failed_cases(cases, "reve", "first_pass_status")) or "-"
    reve_final_failed = ", ".join(_failed_cases(cases, "reve", "final_status")) or "-"

    lines: list[str] = [
        "---",
        "geometry: landscape,margin=0.35in",
        "fontsize: 10pt",
        "header-includes:",
        "  - \\usepackage{graphicx}",
        "---",
        "",
        "# GPT Image 2 vs Reve 1.1 Head-to-Head",
        "",
        "Date: 2026-06-17",
        "",
        "## Scope",
        "",
        "This report compares two competing masked wheel-edit paths on a 20-case dataset curated from the repository:",
        "",
        "- 9 `ivan-*` clean car baselines with day/night coverage.",
        "- 3 rain stress cases.",
        "- 8 `wheel-labeling-*` stress cases with motorcycles and auto-rickshaws.",
        "",
        "Common setup:",
        "",
        "- same silver wheel reference image;",
        "- same source image + mask + reference wheel request shape;",
        "- `gpt-image-2` via official OpenAI `/v1/images/edits` with streaming transport;",
        "- Reve direct masked remix via `version=latest` (API responses returned backend version `reve-remix@20250915`).",
        "",
        "## Topline",
        "",
        "| Model | First pass | After 1 retry | Notes |",
        "| --- | --- | --- | --- |",
        f"| `gpt-image-2` | {openai_first}/{len(cases)} completed | {openai_final}/{len(cases)} completed | remaining failure: `{openai_final_failed}` |",
        f"| Reve masked | {reve_first}/{len(cases)} completed | {reve_final}/{len(cases)} completed | all cases completed after one retry |",
        "",
        "Transport failures were disconnects rather than structured model-side validation errors.",
        "",
        "## Failure Summary",
        "",
        "| Model | First-pass failures | Final failures after retry |",
        "| --- | --- | --- |",
        f"| `gpt-image-2` | `{openai_first_failed}` | `{openai_final_failed}` |",
        f"| Reve masked | `{reve_first_failed}` | `{reve_final_failed}` |",
        "",
        "## Dataset Selection Overview",
        "",
    ]

    for page in selection_pages:
        lines.extend(
            [
                "\\begin{center}",
                f"\\includegraphics[width=\\textwidth,height=0.90\\textheight,keepaspectratio]{{docs/assets/gpt-image-2-vs-reve11-report/{page}}}",
                "\\end{center}",
                "",
                "\\newpage",
                "",
            ]
        )

    lines.extend(["## Output Overview", ""])
    for page in overview_pages:
        lines.extend(
            [
                "\\begin{center}",
                f"\\includegraphics[width=\\textwidth,height=0.90\\textheight,keepaspectratio]{{docs/assets/gpt-image-2-vs-reve11-report/{page}}}",
                "\\end{center}",
                "",
                "\\newpage",
                "",
            ]
        )

    lines.extend(["## Full-Size Detail Pages", ""])
    for page in detail_pages:
        lines.extend(
            [
                "\\begin{center}",
                f"\\includegraphics[width=\\textwidth,height=0.90\\textheight,keepaspectratio]{{docs/assets/gpt-image-2-vs-reve11-report/{page}}}",
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
            f"- Summary CSV: `{SUMMARY_CSV_PATH.relative_to(ROOT_DIR)}`",
            f"- OpenAI raw results: `{OPENAI_RESULTS_PATH.relative_to(ROOT_DIR)}`",
            f"- OpenAI retry results: `{OPENAI_RETRY_PATH.relative_to(ROOT_DIR)}`",
            f"- Reve raw results: `{REVE_RESULTS_PATH.relative_to(ROOT_DIR)}`",
            f"- Reve retry results: `{REVE_RETRY_PATH.relative_to(ROOT_DIR)}`",
            "",
        ]
    )

    MARKDOWN_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    cases = _load_cases()
    _write_summary_csv(cases)
    selection_pages = _build_selection_overview(cases)
    overview_pages = _build_compare_overview(cases)
    detail_pages = _build_detail_pages(cases)
    _write_markdown(
        selection_pages=selection_pages,
        overview_pages=overview_pages,
        detail_pages=detail_pages,
        cases=cases,
    )
    print(MARKDOWN_PATH)
    print(SUMMARY_CSV_PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
