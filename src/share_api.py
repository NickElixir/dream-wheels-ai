"""Public share pages for completed Dream Wheels jobs."""

import html
import logging
import re

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse, Response

from src import db, storage
from src.config import PUBLIC_BASE_URL

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/s", tags=["share"])

SHORT_ID_RE = re.compile(r"^[0-9a-fA-F]{8,36}$")


def share_url_for_job(job_id: str) -> str:
    return f"{PUBLIC_BASE_URL}/s/{job_id[:8]}"


def _content_type_for_path(path: str | None) -> str:
    ext = (path or "").rsplit(".", 1)[-1].lower()
    return {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
    }.get(ext, "image/jpeg")


def _normalize_short_id(short_id: str) -> str:
    value = short_id.strip()
    if not SHORT_ID_RE.match(value):
        raise HTTPException(status_code=404, detail="Share not found")
    return value.lower()


async def _find_completed_job(short_id: str):
    prefix = _normalize_short_id(short_id)
    pool = db.get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id::text, car_image_url, output_image_url, completed_at
            FROM jobs
            WHERE id::text LIKE $1
              AND status = 'completed'
              AND output_image_url IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 2
            """,
            f"{prefix}%",
        )
    if not rows:
        raise HTTPException(status_code=404, detail="Share not found")
    if len(rows) > 1:
        raise HTTPException(status_code=409, detail="Share id is ambiguous")
    return rows[0]


@router.get("/{short_id}", response_class=HTMLResponse)
async def share_page(short_id: str):
    row = await _find_completed_job(short_id)
    job_id = row["id"]
    result_url = row["output_image_url"]
    page_url = share_url_for_job(job_id)
    original_url = f"{page_url}/original" if row["car_image_url"] else None

    title = "Dream Wheels AI render"
    description = "Before and after AI wheel visualization."
    escaped_title = html.escape(title)
    escaped_description = html.escape(description)
    escaped_page_url = html.escape(page_url, quote=True)
    escaped_result_url = html.escape(result_url, quote=True)
    escaped_original_url = html.escape(original_url, quote=True) if original_url else ""

    before_markup = ""
    if escaped_original_url:
        before_markup = f"""
          <section class="panel">
            <div class="label">Before</div>
            <img src="{escaped_original_url}" alt="Original car photo" loading="lazy">
          </section>
        """

    return HTMLResponse(
        f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escaped_title}</title>
  <meta name="description" content="{escaped_description}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="{escaped_title}">
  <meta property="og:description" content="{escaped_description}">
  <meta property="og:url" content="{escaped_page_url}">
  <meta property="og:image" content="{escaped_result_url}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{escaped_title}">
  <meta name="twitter:description" content="{escaped_description}">
  <meta name="twitter:image" content="{escaped_result_url}">
  <style>
    :root {{
      color-scheme: dark;
      --bg: #0a0a0b;
      --surface: #15161a;
      --border: rgba(255,255,255,.12);
      --text: #f4f4f5;
      --muted: rgba(255,255,255,.58);
      --accent: #e8ff00;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }}
    main {{
      width: min(980px, 100%);
      margin: 0 auto;
      padding: 24px 16px 40px;
    }}
    header {{
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-end;
      padding-bottom: 18px;
      border-bottom: 1px solid var(--border);
    }}
    .brand {{
      color: var(--accent);
      font-weight: 700;
      letter-spacing: .1em;
      font-size: 13px;
    }}
    h1 {{
      margin: 8px 0 0;
      font-size: clamp(26px, 5vw, 44px);
      line-height: 1.05;
      letter-spacing: -.02em;
    }}
    .job {{
      color: var(--muted);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      white-space: nowrap;
    }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-top: 18px;
    }}
    .panel {{
      min-width: 0;
      border: 1px solid var(--border);
      background: var(--surface);
    }}
    .label {{
      padding: 12px 14px;
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .12em;
      border-bottom: 1px solid var(--border);
    }}
    img {{
      display: block;
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: contain;
      background: #050506;
    }}
    .cta {{
      display: inline-flex;
      margin-top: 18px;
      color: #050506;
      background: var(--accent);
      padding: 12px 16px;
      text-decoration: none;
      font-weight: 700;
    }}
    @media (max-width: 720px) {{
      header {{ display: block; }}
      .job {{ margin-top: 8px; white-space: normal; }}
      .grid {{ grid-template-columns: 1fr; }}
    }}
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <div class="brand">DREAMWHEELS AI</div>
        <h1>Before / After</h1>
      </div>
      <div class="job">{html.escape(job_id)}</div>
    </header>
    <div class="grid">
      {before_markup}
      <section class="panel">
        <div class="label">After</div>
        <img src="{escaped_result_url}" alt="AI render" loading="eager">
      </section>
    </div>
    <a class="cta" href="{escaped_result_url}" target="_blank" rel="noreferrer">Open image</a>
  </main>
</body>
</html>""",
        headers={"Cache-Control": "public, max-age=300"},
    )


@router.get("/{short_id}/original")
async def share_original(short_id: str):
    row = await _find_completed_job(short_id)
    car_image_url = row["car_image_url"]
    if not car_image_url:
        raise HTTPException(status_code=404, detail="Original image not found")

    if car_image_url.startswith("http://") or car_image_url.startswith("https://"):
        return RedirectResponse(car_image_url, status_code=302)

    try:
        content = await storage.download_bytes(bucket=storage.RAW_BUCKET, path=car_image_url)
    except storage.StorageError as exc:
        logger.exception(f"❌ Original fetch failed for share {short_id}: {exc}")
        raise HTTPException(status_code=404, detail="Original image not found") from exc

    return Response(
        content=content,
        media_type=_content_type_for_path(car_image_url),
        headers={"Cache-Control": "public, max-age=300"},
    )


@router.get("/{short_id}/result")
async def share_result(short_id: str):
    row = await _find_completed_job(short_id)
    result_url = row["output_image_url"]
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.head(result_url)
    except httpx.HTTPError:
        resp = None
    if resp is not None and resp.status_code >= 400:
        raise HTTPException(status_code=404, detail="Result image not found")
    return RedirectResponse(result_url, status_code=302)
