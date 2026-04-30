-- Миграция 0002: включить Row Level Security на public-таблицах.
--
-- Зачем: Supabase раздаёт публичный anon-ключ для PostgREST. Без RLS
-- любой клиент мог бы читать/писать в users/jobs через REST API напрямую.
-- Бэкенд использует service_role (или прямое подключение через DATABASE_URL),
-- которое RLS обходит — поэтому FastAPI продолжит работать как раньше.
--
-- Никаких политик не добавляем: anon-доступ полностью отключаем.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs  ENABLE ROW LEVEL SECURITY;
