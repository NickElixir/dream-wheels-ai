import asyncio
import json
import logging
import os
import uuid
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import asyncpg
import redis.asyncio as redis
import base64
import aiohttp
from fastapi.staticfiles import StaticFiles

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")
REDIS_URL = os.getenv("REDIS_URL")

app = FastAPI(title="Dream Wheels MVP")
os.makedirs("static", exist_ok=True) # Создаем папку, если ее нет
app.mount("/static", StaticFiles(directory="static"), name="static")
db_pool = None
redis_client = None
worker_task = None

# Модели данных
class JobCreateRequest(BaseModel):
    telegram_user_id: int
    car_url: str
    wheel_url: str

class JobCreateResponse(BaseModel):
    job_id: str
    status: str

class JobStatusResponse(BaseModel):
    status: str
    output_image_url: str | None = None

# ==========================================
# ФОНОВЫЙ ВОРКЕР
# ==========================================
async def get_base64_from_url(url: str) -> str:
    """Скачивает картинку в память и сразу возвращает Base64, не трогая жесткий диск"""
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as resp:
            if resp.status == 200:
                img_bytes = await resp.read()
                return base64.b64encode(img_bytes).decode('utf-8')
            else:
                raise Exception(f"Ошибка скачивания файла: HTTP {resp.status}")
                
async def process_jobs_loop():
    logger.info("🟢 Воркер запущен и ждет задачи...")
    while True:
        try:
            # Паттерн BLPOP (блокирующее чтение из списка). 
            # Таймаут 5 сек нужен, чтобы цикл мог корректно завершиться при выключении сервера.
            result = await redis_client.blpop("job_queue", timeout=9)
            if not result:
                continue
                
            _, job_data_str = result
            job_data = json.loads(job_data_str)
            job_id = job_data["job_id"]
            
            logger.info(f"⚙️ Взята задача в работу: {job_id}")

            # 1. Меняем статус на processing [cite: 13]
            async with db_pool.acquire() as conn:
                await conn.execute("UPDATE jobs SET status = 'processing' WHERE id = $1::uuid", job_id)

           # --- ИНТЕГРАЦИЯ REVE API (ОФИЦИАЛЬНАЯ ДОКУМЕНТАЦИЯ) ---
            try:
                logger.info(f"📥 [Задача {job_id}] Скачиваем картинки в Base64...")
                car_b64 = await fetch_image_as_base64(job_data["car_url"])
                wheel_b64 = await fetch_image_as_base64(job_data["wheel_url"])

                logger.info(f"🚀 [Задача {job_id}] Отправляем запрос в Reve API...")
                
                async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=90)) as api_session:
                    headers = {
                        "Authorization": f"Bearer {os.getenv('REVE_API_KEY', 'ВАШ_ТОКЕН')}",
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    }
                    
                    # Точно по документации Reve:
                    payload = {
                        "prompt": "Replace the wheels of the car in <img>0</img> with the wheel design provided in <img>1</img>. Maintain realistic perspective, lighting, shadows, and scale.",
                        "reference_images": [car_b64, wheel_b64],
                        "aspect_ratio": "16:9",
                        "version": "latest"
                    }
                    
                    api_url = "https://api.reve.com/v1/image/remix" 
                    
                    async with api_session.post(api_url, json=payload, headers=headers) as reve_resp:
                        response_text = await reve_resp.text()
                        
                        if reve_resp.status != 200:
                            raise Exception(f"Reve API error (HTTP {reve_resp.status}): {response_text}")
                        
                        import json
                        result = json.loads(response_text)
                        
                        if result.get('content_violation'):
                            raise Exception("Reve API: Сработало предупреждение о нарушении контента (content_violation)")
                            
                        # Достаем готовую картинку из ответа
                        b64_result = result.get('image')
                        if not b64_result:
                            raise Exception(f"Reve API не вернул 'image'. Ответ: {response_text}")
                            
                        # Декодируем и сохраняем файл на диск бэкенда
                        output_filename = f"result_{job_id}.jpg"
                        output_path = os.path.join("static", output_filename)
                        
                        import base64
                        with open(output_path, "wb") as f:
                            f.write(base64.b64decode(b64_result))
                            
                        # Создаем локальный URL, который бот сможет запросить и переслать пользователю
                        result_url = f"http://127.0.0.1:10000/static/{output_filename}"
                        logger.info(f"🎨 [Задача {job_id}] Успех! Картинка сохранена: {result_url}")

            except asyncio.TimeoutError:
                raise Exception("Таймаут: Reve API не ответил за 90 секунд")
            # --- КОНЕЦ БЛОКА REVE API ---

            # 3. Меняем статус на completed и сохраняем URL [cite: 13, 15]
            async with db_pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE jobs 
                    SET status = 'completed', output_image_url = $1, completed_at = CURRENT_TIMESTAMP 
                    WHERE id = $2::uuid
                    """, 
                    mock_output_url, job_id
                )
                # Увеличиваем счетчик задач пользователя [cite: 9]
                await conn.execute("UPDATE users SET job_count = job_count + 1 WHERE telegram_user_id = $1", job_data["telegram_user_id"])
                
            logger.info(f"✅ Задача завершена: {job_id}")

        except Exception as e:
            logger.error(f"❌ Ошибка воркера: {e}")
            await asyncio.sleep(5) # Защита от спама в Redis при падении БД

# ==========================================
# ЖИЗНЕННЫЙ ЦИКЛ ПРИЛОЖЕНИЯ
# ==========================================
@app.on_event("startup")
async def startup():
    global db_pool, redis_client, worker_task
    db_pool = await asyncpg.create_pool(DATABASE_URL)
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    worker_task = asyncio.create_task(process_jobs_loop())

@app.on_event("shutdown")
async def shutdown():
    if worker_task:
        worker_task.cancel()
    await db_pool.close()
    await redis_client.close()

# ==========================================
# API ЭНДПОИНТЫ (MVP) [cite: 14, 15]
# ==========================================
@app.head("/")
@app.get("/")
@app.head("/health")
@app.get("/health")
async def health_check():
    """Uptime check for deployment health monitoring."""
    return {"status": "ok"}

@app.post("/jobs", response_model=JobCreateResponse)
async def create_job(request: JobCreateRequest):
    logger.info(f"📥 Получен запрос на создание задачи. Авто: {request.car_url}, Диск: {request.wheel_url}")
    job_id = str(uuid.uuid4())
    
    try:
        async with db_pool.acquire() as conn:
            # 1. Ищем или создаем пользователя (Таблица users [cite: 8])
            user_id = await conn.fetchval(
                "SELECT id FROM users WHERE telegram_user_id = $1", 
                request.telegram_user_id
            )
            if not user_id:
                user_id = await conn.fetchval(
                    "INSERT INTO users (telegram_user_id) VALUES ($1) RETURNING id", 
                    request.telegram_user_id
                )
            
            # 2. Создаем задачу с явным указанием типов (Таблица jobs [cite: 10])
            await conn.execute(
                """
                INSERT INTO jobs (id, user_id, status, car_image_url, wheel_image_url) 
                VALUES ($1::uuid, $2, 'queued', $3, $4)
                """,
                job_id, user_id, request.car_url, request.wheel_url
            )
            logger.info(f"✅ Задача {job_id} успешно записана в БД со статусом queued")

    except Exception as db_err:
        logger.error(f"❌ ОШИБКА ЗАПИСИ В БД (INSERT): {db_err}")
        raise HTTPException(status_code=500, detail="Database insert failed")

    # Пушим в Redis
    await redis_client.rpush("job_queue", json.dumps({
        "job_id": job_id,
        "telegram_user_id": request.telegram_user_id,
        "car_url": request.car_url,
        "wheel_url": request.wheel_url  # <-- ДОБАВЛЕНО
    }))
    return JobCreateResponse(job_id=job_id, status="queued")
    
@app.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """Poll job status. Returns status and output_image_url[cite: 15]."""
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("SELECT status, output_image_url FROM jobs WHERE id = $1::uuid", job_id)
        if not row:
            raise HTTPException(status_code=404, detail="Job not found")
        return JobStatusResponse(status=row["status"], output_image_url=row["output_image_url"])
