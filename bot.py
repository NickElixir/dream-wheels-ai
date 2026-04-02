import logging
import os
import asyncio
import aiohttp
import redis.asyncio as redis
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

BOT_TOKEN = os.getenv("BOT_TOKEN")
API_BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:10000")
REDIS_URL = os.getenv("REDIS_URL")

logging.basicConfig(format='%(asctime)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

redis_client = redis.from_url(REDIS_URL, decode_responses=True)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Шаг 1: Приветствие[cite: 4]."""
    await update.message.reply_text("Привет! Отправь мне фотографию своего автомобиля.")

async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    photo_file_id = update.message.photo[-1].file_id
    
    # Session cache: stores image file_ids (TTL 10 min) 
    session_key = f"session:{user_id}:car_url"
    cached_car_url = await redis_client.get(session_key)
    
    # Получаем прямую ссылку на скачивание файла от серверов Telegram
    telegram_file = await context.bot.get_file(photo_file_id)
    current_photo_url = telegram_file.file_path

    if not cached_car_url:
        # Шаг 2: Сохраняем URL машины в Redis на 600 секунд [cite: 4]
        await redis_client.setex(session_key, 600, current_photo_url)
        await update.message.reply_text("Фото авто получено! 🚗\nТеперь отправь фото диска.")
        return

    # Шаг 3: Фото машины есть, значит сейчас прислали фото диска [cite: 4]
    wheel_url = current_photo_url
    await redis_client.delete(session_key) # Очищаем сессию
    
    status_msg = await update.message.reply_text("Создаю задачу... ⏳")
    
    # Шаг 4: Отправляем запрос POST /jobs к FastAPI [cite: 4]
    async with aiohttp.ClientSession() as session:
        payload = {
            "telegram_user_id": user_id,
            "car_url": cached_car_url,
            "wheel_url": wheel_url
        }
        try:
            async with session.post(f"{API_BASE_URL}/jobs", json=payload) as resp:
                if resp.status != 200:
                    await status_msg.edit_text("❌ Ошибка сервера API.")
                    return
                job_data = await resp.json()
                job_id = job_data["job_id"]
        except Exception as e:
            logger.error(f"Связь с API потеряна: {e}")
            await status_msg.edit_text("❌ Бэкенд недоступен.")
            return

    await status_msg.edit_text("Задача в очереди! Ожидаем результат... 🎨")
    
    # Шаг 7: Bot polls GET/jobs/{job_id} every 3s [cite: 5]
    await poll_job_status(update, status_msg, job_id)

async def poll_job_status(update: Update, status_msg, job_id: str):
    max_retries = 60 # Ждем максимум 3 минуты
    
    async with aiohttp.ClientSession() as session:
        for _ in range(max_retries):
            await asyncio.sleep(3) # Polling каждые 3 секунды [cite: 5]
            try:
                async with session.get(f"{API_BASE_URL}/jobs/{job_id}") as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        status = data["status"]
                        
                        if status == "completed":
                            # Sends result image back to user [cite: 5]
                            await update.message.reply_photo(
                                photo=data["output_image_url"], 
                                caption="Готово! (Имитация работы ИИ)"
                            )
                            await status_msg.delete()
                            return
                            
                        elif status == "failed":
                            await status_msg.edit_text("❌ Ошибка при обработке.")
                            return
                            
                        # Если статус 'queued' или 'processing' [cite: 13] -> цикл идет дальше
            except Exception as e:
                logger.error(f"Ошибка опроса: {e}")
                continue
                
    await status_msg.edit_text("❌ Превышено время ожидания.")

if __name__ == "__main__":
    logger.info("Запуск Telegram-бота...")
    # Чистый запуск без конфликтов
    application = Application.builder().token(BOT_TOKEN).build()
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    application.run_polling()import logging
import os
import asyncio
import aiohttp
import redis.asyncio as redis
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

# ==========================================
# ⚙️ НАСТРОЙКИ
# ==========================================
BOT_TOKEN = os.getenv("BOT_TOKEN", "ВАШ_ТОКЕН_БОТА")
# URL вашего запущенного FastAPI приложения (например, на Render)
API_BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000") 
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Инициализация клиента Redis для сессий
redis_client = redis.from_url(REDIS_URL, decode_responses=True)

# ==========================================
# 📱 ХЭНДЛЕРЫ
# ==========================================

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Шаг 1: Обработка команды /start [cite: 4]"""
    await update.message.reply_text(
        "Привет! Я бот для виртуальной примерки дисков 🛞\n\n"
        "Шаг 1: Отправь мне фотографию своего автомобиля."
    )

async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка всех входящих фотографий"""
    user_id = update.effective_user.id
    # Берем фото в самом высоком качестве (последнее в массиве)
    photo_file_id = update.message.photo[-1].file_id
    
    # Проверяем в Redis, присылал ли пользователь фото машины в последние 10 минут
    session_key = f"session:{user_id}:car_file_id"
    car_file_id = await redis_client.get(session_key)
    
    # Шаг 2: Если фото машины еще нет, значит это оно [cite: 4]
    if not car_file_id:
        # Сохраняем file_id в Redis с TTL = 600 секунд (10 минут) 
        await redis_client.setex(session_key, 600, photo_file_id)
        await update.message.reply_text("Отличное фото авто! 🚗\n\nШаг 2: Теперь отправь фото диска.")
        return

    # Шаг 3: Если фото машины есть в Redis, значит сейчас прислали фото диска [cite: 4]
    wheel_file_id = photo_file_id
    
    # Сразу удаляем фото машины из сессии, чтобы диалог начался заново
    await redis_client.delete(session_key)
    
    status_msg = await update.message.reply_text("Принято! Отправляю задачу на сервер... ⏳")
    
    # Шаг 4: Отправляем запрос POST /jobs к FastAPI [cite: 4]
    job_id = None
    car_file = await context.bot.get_file(car_file_id)
    wheel_file = await context.bot.get_file(wheel_file_id)
    async with aiohttp.ClientSession() as session:
        payload = {
            "telegram_user_id": user_id,
            "car_url": car_file.file_path,  # Передаем готовую ссылку
            "wheel_url": wheel_file.file_path # Передаем готовую ссылку
        }
        try:
            async with session.post(f"{API_BASE_URL}/jobs", json=payload) as resp:
                if resp.status != 200:
                    logger.error(f"API Error: {await resp.text()}")
                    await status_msg.edit_text("❌ Ошибка при создании задачи на сервере.")
                    return
                
                job_data = await resp.json()
                job_id = job_data["job_id"]
        except Exception as e:
            logger.error(f"Connection Error: {e}")
            await status_msg.edit_text("❌ Нет связи с сервером API.")
            return

    await status_msg.edit_text(f"Задача создана! Ожидаем результат... 🎨")

    # Шаг 5-7: Опрашиваем статус задачи (Polling) каждые 3 секунды 
    await poll_job_status(update, status_msg, job_id)

async def poll_job_status(update: Update, status_msg, job_id: str):
    """Опрашивает GET /jobs/{job_id} каждые 3 секунды """
    # Защита от бесконечного цикла (максимум 5 минут)
    max_retries = 100 
    retries = 0

    async with aiohttp.ClientSession() as session:
        while retries < max_retries:
            await asyncio.sleep(3) 
            retries += 1
            
            try:
                async with session.get(f"{API_BASE_URL}/jobs/{job_id}") as resp:
                    if resp.status != 200:
                        logger.error(f"Сервер вернул ошибку {resp.status}")
                        continue

                    status_data = await resp.json()
                    current_status = status_data["status"]
                    
                    if current_status == "completed":
                        result_url = status_data.get("output_image_url")
                        if not result_url:
                            await status_msg.edit_text("❌ Сервер вернул пустую картинку.")
                            return
                            
                        await update.message.reply_photo(
                            photo=result_url, 
                            caption="Готово! Твой автомобиль на новых дисках 🔥"
                        )
                        await status_msg.delete()
                        return # Выходим из функции
                        
                    elif current_status == "failed":
                        await status_msg.edit_text("❌ Произошла ошибка при генерации изображения. Попробуй еще раз.")
                        return # Выходим из функции
                    
                    elif current_status in ["queued", "processing"]:
                        # Задача еще в работе. Просто ждем следующий цикл.
                        continue
                    else:
                        logger.warning(f"Неизвестный статус: {current_status}")
                        continue
                        
            except Exception as e:
                logger.error(f"Polling error: {e}")
                # Если сервер моргнул, просто продолжаем опрос
                continue
                
    # Если цикл завершился по лимиту попыток
    await status_msg.edit_text("❌ Превышено время ожидания сервера. Попробуйте позже.")

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка случайного текста"""
    await update.message.reply_text("Пожалуйста, отправь мне фотографию как картинку (не файлом и не текстом).")

# ==========================================
# 🚀 ЗАПУСК БОТА
# ==========================================
def main():
    logger.info("Бот запускается...")
    # Инициализация приложения
    application = Application.builder().token(BOT_TOKEN).build()

    # Регистрация обработчиков (handlers)
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.PHOTO, handle_photo))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))

    # Запуск поллинга Telegram серверов
    # Запуск поллинга с агрессивным сбросом фантомных соединений и жесткими тайм-аутами
    application.run_polling()

if __name__ == "__main__":
    main()
