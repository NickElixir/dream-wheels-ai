-- Миграция 0001: начальная схема
-- Применяется на пустой базе. Создаёт таблицы users и jobs.

CREATE TABLE IF NOT EXISTS users (
    id              SERIAL PRIMARY KEY,
    telegram_user_id BIGINT UNIQUE NOT NULL,
    username        VARCHAR,
    created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    job_count       INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS jobs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          INTEGER REFERENCES users(id),
    status           VARCHAR NOT NULL DEFAULT 'queued',
    car_image_url    TEXT,
    wheel_image_url  TEXT,
    output_image_url TEXT,
    error_message    TEXT,
    created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at     TIMESTAMPTZ
);

-- Производительность: GET /jobs/{id} ходит по PK, но воркер/админка может фильтровать по user_id.
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
