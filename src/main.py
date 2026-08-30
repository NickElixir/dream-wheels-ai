import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src import (
    analytics_api,
    assets_service,
    auth_api,
    db,
    fitment_checks_api,
    identity_api,
    jobs_api,
    payments_api,
    redis_client,
    share_api,
    storage,
)
from src.config import REDIS_JOB_QUEUE, REDIS_URL, WEBAPP_URL, WORKER_ENABLED, runtime_env_summary
from src.credits_service import finalize_job_credit, refund_job_credit
from src.generation import (
    GenerationInput,
    GenerationProvider,
    GenerationProviderError,
    GenerationResult,
    WanImageConfig,
    WanImageProvider,
    build_generation_request,
    inspect_image,
)
from src.image_fetch import fetch_image_bytes

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Подавить INFO-логи httpx/httpcore — каждый запрос содержит BOT_TOKEN в URL
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)


worker_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown приложения. Заменяет устаревшие @app.on_event с FastAPI 0.93+."""
    global worker_task

    logger.info("🟢 Runtime env summary: %s", runtime_env_summary())
    await db.init_pool()
    if REDIS_URL:
        redis_client.init_client()
        logger.info("🟢 Redis client initialized")
    elif WORKER_ENABLED:
        logger.warning("⚠️ WORKER_ENABLED=true, но REDIS_URL не задан: worker не запущен")
    else:
        logger.info("🟢 Redis отключён: API-only режим без очереди рендеров")

    if WORKER_ENABLED and REDIS_URL:
        worker_task = asyncio.create_task(process_jobs_loop())
    elif WORKER_ENABLED:
        logger.warning("⚠️ Redis отсутствует: worker loop не запущен")
    else:
        logger.info("🟢 ВОРКЕР ОТКЛЮЧЕН (WORKER_ENABLED=false)")

    yield

    if worker_task:
        worker_task.cancel()
    await db.close_pool()
    if redis_client.is_initialized():
        await redis_client.close_client()


app = FastAPI(title="Dream Wheels MVP", lifespan=lifespan)

# CORS — webapp хостится на Vercel и шлёт fetch с другого домена.
# Telegram-клиент проксирует Mini App тоже как origin: разрешаем т.г-домены
# чтобы preview Mini App в Telegram Web работал без отдельного фикса.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[WEBAPP_URL, "https://web.telegram.org"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    allow_credentials=False,
    max_age=600,
)

os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")
app.include_router(auth_api.router)
app.include_router(analytics_api.router)
app.include_router(identity_api.router)
app.include_router(fitment_checks_api.router)
app.include_router(jobs_api.router)
app.include_router(payments_api.router)
app.include_router(share_api.router)


def build_generation_provider() -> GenerationProvider:
    """Build the one active production provider without a fallback."""
    return WanImageProvider(WanImageConfig.from_env())


async def _load_generation_inputs(
    pool, job_id: str, job_data: dict
) -> tuple[GenerationInput, GenerationInput]:
    """Load and inspect the durable vehicle/rim inputs for a render request.

    - bot:    {car_url, wheel_url}        — Telegram file URLs
    - webapp: {car_storage_path, wheel_storage_path, source: "webapp"}
              — пути в Supabase Storage `raw` bucket
    """
    if job_data.get("source") == "webapp":
        car_bytes = await storage.download_bytes(
            bucket=storage.RAW_BUCKET, path=job_data["car_storage_path"]
        )
        wheel_bytes = await storage.download_bytes(
            bucket=storage.RAW_BUCKET, path=job_data["wheel_storage_path"]
        )
    else:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT car_asset.storage_key AS car_storage_path,
                       rim_asset.storage_key AS rim_storage_path
                FROM jobs
                LEFT JOIN assets AS car_asset ON car_asset.id = jobs.car_asset_id
                LEFT JOIN assets AS rim_asset ON rim_asset.id = jobs.rim_asset_id
                WHERE jobs.id = $1::uuid
                """,
                job_id,
            )
        if not row or not row["car_storage_path"] or not row["rim_storage_path"]:
            raise GenerationProviderError(
                "provider_input_error", "Durable render inputs are missing"
            )
        car_bytes = await storage.download_bytes(
            bucket=storage.RAW_BUCKET, path=row["car_storage_path"]
        )
        wheel_bytes = await storage.download_bytes(
            bucket=storage.RAW_BUCKET, path=row["rim_storage_path"]
        )
    return (
        inspect_image(car_bytes, role="vehicle"),
        inspect_image(wheel_bytes, role="rim reference"),
    )


async def _save_legacy_bot_inputs(pool, job_id: str, user_id: int, job_data: dict) -> None:
    """Persist Telegram bot input URLs into durable raw storage on first processing."""
    if job_data.get("source") == "webapp":
        return

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT car_asset_id, rim_asset_id FROM jobs WHERE id = $1::uuid",
            job_id,
        )
    if row and row["car_asset_id"] and row["rim_asset_id"]:
        return

    car_bytes, _ = await fetch_image_bytes(job_data["car_url"])
    wheel_bytes, _ = await fetch_image_bytes(job_data["wheel_url"])
    car_content_type = inspect_image(car_bytes, role="vehicle").content_type
    wheel_content_type = inspect_image(wheel_bytes, role="rim reference").content_type
    car_asset = await assets_service.upload_render_asset(
        owner_user_id=user_id,
        job_id=job_id,
        kind="car_original",
        data=car_bytes,
        content_type=car_content_type,
    )
    rim_asset = await assets_service.upload_render_asset(
        owner_user_id=user_id,
        job_id=job_id,
        kind="rim_original",
        data=wheel_bytes,
        content_type=wheel_content_type,
    )

    async with pool.acquire() as conn:
        async with conn.transaction():
            await assets_service.insert_asset(conn, car_asset)
            await assets_service.insert_asset(conn, rim_asset)
            await conn.execute(
                """
                UPDATE jobs
                SET car_asset_id = COALESCE(car_asset_id, $1::uuid),
                    rim_asset_id = COALESCE(rim_asset_id, $2::uuid)
                WHERE id = $3::uuid
                """,
                car_asset.id,
                rim_asset.id,
                job_id,
            )


async def _save_render_output(
    pool,
    job_id: str,
    user_id: int,
    img_bytes: bytes,
    content_type: str = "image/jpeg",
) -> str:
    """Сохранить рендер в постоянное public-хранилище Supabase results."""
    asset = await assets_service.upload_render_asset(
        owner_user_id=user_id,
        job_id=job_id,
        kind="result",
        data=img_bytes,
        content_type=content_type,
    )
    async with pool.acquire() as conn:
        async with conn.transaction():
            await assets_service.insert_asset(conn, asset)
            await conn.execute(
                """
                UPDATE jobs
                SET result_asset_id = $1::uuid,
                    output_image_url = $2,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $3::uuid
                """,
                asset.id,
                asset.public_url,
                job_id,
            )
    return asset.public_url or storage.public_url(asset.bucket, asset.storage_key)


async def _persist_generation_metadata(pool, job_id: str, result: GenerationResult) -> None:
    """Persist provider-neutral usage metadata before result finalization."""
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE jobs
            SET generation_provider = $1,
                provider_request_id = $2,
                provider_task_id = $3,
                generation_latency_ms = $4,
                generation_cost = $5,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $6::uuid
            """,
            result.provider,
            result.provider_request_id,
            result.provider_task_id,
            result.latency_ms,
            result.generation_cost,
            job_id,
        )


def _log_provider_diagnostics(job_id: str, user_id: int, error: GenerationProviderError) -> None:
    diagnostics = error.diagnostics
    if diagnostics is None:
        return
    logger.warning(
        "⚠️ Wan provider diagnostics job_id=%s user_id=%s code=%s http_status=%s "
        "request_id=%s task_id=%s task_status=%s provider_code=%s message=%s "
        "poll_attempts=%s transitions=%s",
        job_id,
        user_id,
        error.code,
        diagnostics.http_status,
        diagnostics.request_id,
        diagnostics.task_id,
        diagnostics.raw_task_status,
        diagnostics.provider_error_code,
        diagnostics.provider_message,
        diagnostics.poll_attempts,
        diagnostics.status_transitions,
    )


_SAFE_PROVIDER_MESSAGES = {
    "provider_config_error": "Image generation is temporarily unavailable.",
    "provider_auth_error": "Image generation is temporarily unavailable.",
    "provider_input_error": "The uploaded images could not be processed.",
    "provider_content_rejected": "The uploaded images could not be processed.",
    "provider_rate_limited": "Image generation is busy. Please try again later.",
    "provider_unavailable": "Image generation is temporarily unavailable.",
    "provider_submission_uncertain": "The generation request could not be confirmed.",
    "provider_task_failed": "Image generation failed. Please try again.",
    "provider_task_timeout": "Image generation timed out. Please try again.",
    "provider_result_download_error": "The generated image could not be saved.",
    "provider_response_error": "Image generation returned an invalid response.",
}


def _safe_job_failure(error: Exception) -> tuple[str, str]:
    if isinstance(error, GenerationProviderError):
        return error.code, _SAFE_PROVIDER_MESSAGES[error.code]
    return type(error).__name__, str(error)


async def _mark_render_failed(
    pool,
    *,
    job_id: str,
    user_id: int,
    error: Exception,
) -> None:
    if isinstance(error, GenerationProviderError):
        _log_provider_diagnostics(job_id, user_id, error)
    error_code, error_message = _safe_job_failure(error)
    async with pool.acquire() as conn:
        async with conn.transaction():
            await refund_job_credit(conn, user_id=user_id, job_id=job_id)
            await conn.execute(
                "UPDATE jobs SET status = 'failed', error_code = $1, error_message = $2, "
                "updated_at = CURRENT_TIMESTAMP WHERE id = $3::uuid",
                error_code,
                error_message,
                job_id,
            )
            await analytics_api.record_system_event(
                conn,
                user_id=user_id,
                event_name="render_failed",
                properties={"job_id": job_id, "error_code": error_code},
            )


async def process_render_job(
    pool,
    *,
    job_id: str,
    user_id: int,
    job_data: dict,
    provider: GenerationProvider | None = None,
) -> None:
    """Run one render without owning queue or credit compensation policy."""
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE jobs SET status = 'processing', updated_at = CURRENT_TIMESTAMP "
            "WHERE id = $1::uuid",
            job_id,
        )

    await _save_legacy_bot_inputs(pool, job_id, user_id, job_data)
    vehicle, rim_reference = await _load_generation_inputs(pool, job_id, job_data)
    request = build_generation_request(vehicle=vehicle, rim_reference=rim_reference)
    result = await (provider or build_generation_provider()).edit(request)
    await _persist_generation_metadata(pool, job_id, result)
    output_url = await _save_render_output(
        pool,
        job_id,
        user_id,
        result.image_bytes,
        content_type=result.content_type,
    )

    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                "UPDATE jobs SET status = 'completed', output_image_url = $1, "
                "completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP "
                "WHERE id = $2::uuid",
                output_url,
                job_id,
            )
            await finalize_job_credit(conn, user_id=user_id, job_id=job_id)
            await analytics_api.record_system_event(
                conn,
                user_id=user_id,
                event_name="render_completed",
                properties={"job_id": job_id, "model": result.model},
            )
    logger.info(
        "✅ Задача %s завершена provider=%s model=%s task_id=%s latency_ms=%s",
        job_id,
        result.provider,
        result.model,
        result.provider_task_id,
        result.latency_ms,
    )


async def process_jobs_loop():
    logger.info("🟢 ВОРКЕР ЗАПУЩЕН")
    pool = db.get_pool()
    rds = redis_client.get_client()
    try:
        await fitment_checks_api.recover_stale_fitment_checks()
    except Exception:
        # Recovery is best-effort; normal queue processing must still start.
        logger.exception("❌ Не удалось восстановить зависшие Fitment checks")

    while True:
        job_id = None
        job_data = None
        try:
            result = await rds.blpop(
                [
                    redis_client.key(REDIS_JOB_QUEUE),
                    redis_client.key(fitment_checks_api.FITMENT_CHECK_QUEUE),
                ],
                timeout=10,
            )
            if not result:
                continue

            job_data = json.loads(result[1])
            if job_data.get("kind") == "fitment_check":
                await fitment_checks_api.execute_fitment_check(str(job_data["check_id"]))
                continue
            job_id = job_data["job_id"]
            user_id = int(job_data["user_id"])
            source = job_data.get("source", "bot")
            logger.info(f"🔥 Взята задача: {job_id} (source={source})")

            await process_render_job(
                pool,
                job_id=job_id,
                user_id=user_id,
                job_data=job_data,
            )

        except Exception as e:
            logger.exception("❌ Ошибка воркера на job_id=%s: %s", job_id, e)
            if job_id:
                await _mark_render_failed(
                    pool,
                    job_id=job_id,
                    user_id=int(job_data["user_id"]),
                    error=e,
                )
            await asyncio.sleep(5)


@app.head("/")
@app.get("/")
@app.head("/health")
@app.get("/health")
async def health_check():
    """Uptime check для мониторинга деплоя."""
    return {"status": "ok"}


@app.get("/health/full")
async def health_check_full():
    """Полный health-check: пингует Postgres и Redis.

    Используется внешним keep-alive (cron-job.org) — см. docs/keep-alive-setup.md.
    Каждый вызов делает реальный SQL-запрос → Supabase не ставит проект на паузу
    через 7 дней неактивности.
    """
    try:
        async with db.get_pool().acquire() as conn:
            await conn.fetchval("SELECT 1")
        redis_status = "disabled"
        if redis_client.is_initialized():
            await redis_client.get_client().ping()
            redis_status = "alive"
        return {"status": "ok", "db": "alive", "redis": redis_status}
    except Exception as exc:
        logger.exception(f"❌ /health/full failed: {exc}")
        raise HTTPException(status_code=503, detail=f"unhealthy: {exc}") from exc
