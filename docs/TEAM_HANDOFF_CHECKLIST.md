# Чек-лист перед передачей репозитория команде

Этот файл — практический список действий, которые нужно выполнить перед тем, как пригласить команду в репозиторий и связанные сервисы (Render, Supabase, Upstash, Telegram).

Помечай выполненное прямо в этом файле (`[x]`). Возвращайся, когда будут вопросы.

---

## 🔴 Критично — сделать ДО первого `git push` команде

### 1. Безопасность секретов

- [ ] Ротировать ВСЕ ключи, которые засветились в чате/логах:
  - [ ] **Telegram BOT_TOKEN** — @BotFather → `/revoke` → выбрать бота
  - [ ] **Supabase database password** — https://supabase.com/dashboard/project/qmgyccghsbdpehiybjae/settings/database → Reset password
  - [ ] **Supabase Personal Access Token** — https://supabase.com/dashboard/account/tokens → Revoke + Generate new
  - [ ] **Upstash Redis password** — Upstash Console → DB `Dream Wheels Redis` → Reset Credentials (внизу)
  - [ ] **Upstash Management API key** — Upstash → Account → Management API → Delete + Create
  - [ ] **Render API key** — Render → Account Settings → API Keys → Revoke + Create
- [ ] После каждой ротации — обновить значение в Render Environment (для production-секретов) и в локальном `.env` (для MCP/dev)
- [ ] Проверить, что в git history нет утечек: `git log --all --full-history -- .env`
  - Если коммит был → нужен `git filter-repo` или новый репо
- [ ] Убедиться, что `.gitignore` содержит как минимум:
  ```
  .env
  .env.local
  .env.*.local
  .claude/settings.local.json
  .claude/settings.json
  __pycache__/
  *.py[codz]
  ```
- [ ] `.env.example` в репо ✅, реальный `.env` — НЕТ
- [ ] Нет hardcoded credentials/URL'ов в коде:
  - [ ] `main.py:101` — захардкожен `dream-wheels-ai-tg.onrender.com` → вынести в env (`PUBLIC_BASE_URL`)
  - [ ] `bot.py:10` — `API_BASE_URL` уже через env ✅

### 2. Документация

- [ ] **README.md** с разделами:
  - [ ] **Что делает проект** (1-2 абзаца)
  - [ ] **Архитектура** (схема: Telegram → FastAPI → Worker → Reve API; Postgres Supabase + Redis Upstash + Render hosting)
  - [ ] **Стек** (Python 3.12, FastAPI, asyncpg, redis-py, python-telegram-bot 21, Reve API)
  - [ ] **Setup для локальной разработки**:
    - [ ] `cp .env.example .env`
    - [ ] какие переменные где взять (ссылки на дашборды)
    - [ ] команда запуска
    - [ ] ⚠️ для локального запуска бота нужен ОТДЕЛЬНЫЙ тестовый бот через @BotFather (один токен — один polling-клиент)
  - [ ] **Команды** (build, run, test, lint)
  - [ ] **Деплой** (Render auto-deploy on `main`, ~2-3 мин)
  - [ ] **Troubleshooting** (типовые ошибки и где их искать)
- [ ] **CONTRIBUTING.md** или раздел в README:
  - [ ] Branching strategy (feature branches от `main`, PR-based, никогда не коммитить в main напрямую)
  - [ ] Code style (PEP 8, formatter — black/ruff)
  - [ ] Commit messages (conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`)
- [ ] Комментарии в `.env.example` где взять каждый ключ ✅ (уже сделано)

---

## 🟡 Важно — желательно ДО передачи

### 3. Качество кода

- [x] ~~Починить `fetch_image_as_base64`~~ — сделано (commit `fb90cfd`)
- [x] ~~Disable asyncpg statement cache для Supabase pooler~~ — сделано (commit `3cc2094`)
- [x] ~~Скрыть BOT_TOKEN из httpx-логов~~ — сделано (commit `c16b87f`)
- [ ] Убрать захардкоженный URL `dream-wheels-ai-tg.onrender.com` в `main.py:101` → env
- [ ] Заменить устаревшие `@app.on_event("startup"/"shutdown")` на `lifespan` (FastAPI deprecation warning)
- [ ] **`requirements.txt`**:
  - [x] Зафиксированы версии ✅
  - [ ] Добавить `runtime.txt` со строкой `python-3.12.x` — чтобы Render и команда были на одной версии
  - [ ] Опционально: перейти на `pyproject.toml` + `uv`/`poetry`
- [ ] **Линтер и форматтер**:
  - [ ] Добавить `ruff` (или `black` + `ruff`) — конфиг в `pyproject.toml`
  - [ ] Pre-commit hook (`pre-commit` + `.pre-commit-config.yaml`)
- [ ] **Type hints + mypy** — базовая конфигурация в `pyproject.toml`

### 4. Структура репозитория

Сейчас плоская — для команды лучше реструктурировать:

```
dream-wheels-ai-tg/
├── README.md
├── .env.example
├── .gitignore
├── requirements.txt
├── pyproject.toml          # ← добавить
├── runtime.txt             # ← добавить (python-3.12.x)
├── start.sh
├── src/                    # ← вынести код в src/
│   ├── __init__.py
│   ├── main.py             # FastAPI app + worker
│   ├── bot.py              # Telegram bot
│   ├── config.py           # ← env vars в одном месте
│   ├── db.py               # ← Postgres helpers
│   ├── redis_client.py     # ← Redis helpers
│   └── reve_client.py      # ← Reve API client
├── migrations/             # ← SQL-миграции
│   ├── 0001_initial.sql
│   └── 0002_enable_rls.sql
├── tests/                  # ← хотя бы скелет
│   └── test_smoke.py
└── docs/                   # ← планы, спеки
    ├── TEAM_HANDOFF_CHECKLIST.md
    └── architecture.md
```

Не обязательно делать всё сразу — но «всё в `main.py` 8KB» команде быстро надоест.

### 5. CI/CD

- [ ] **GitHub Actions** (`.github/workflows/ci.yml`):
  - [ ] Запуск линтера на PR
  - [ ] Запуск тестов (если есть)
  - [ ] Проверка, что `pip install -r requirements.txt` проходит
  - [ ] Проверка `python -m py_compile **/*.py` (минимальный smoke)
- [ ] **Branch protection** на `main`:
  - [ ] Require PR before merge
  - [ ] Require status checks (CI)
  - [ ] Require 1+ review
  - [ ] No force push, no deletion
- [ ] `.github/PULL_REQUEST_TEMPLATE.md` с чеклистом (что протестировано, миграции запущены, deploy не сломан)
- [ ] `.github/ISSUE_TEMPLATE/` с шаблонами bug/feature

### 6. Процесс деплоя

- [x] **Render Auto-Deploy** настроен (`autoDeploy: yes` на main) ✅
- [ ] **Health Check Path** — настроить `/health` в Render → Settings → Health & Alerts
- [ ] **Preview environments** для PR — Render умеет, но платно
- [ ] Документировать процесс в README: «merge to main → auto-deploy 2-3 минуты → проверить логи в Render»
- [ ] Описать **rollback процедуру**: Render dashboard → Events → старый успешный deploy → Rollback

### 7. Миграции БД

- [ ] **SQL-схема в репо** — сейчас таблицы существуют только в проде:
  - [ ] `migrations/0001_initial.sql` со всем DDL (CREATE TABLE users, jobs, FK constraints)
  - [ ] `migrations/0002_enable_rls.sql` — то, что мы делали через Supabase MCP
  - [ ] (опционально) `migrations/0003_add_index_jobs_user_id.sql`
- [ ] Документировать **стратегию применения**: кто и когда запускает миграции в проде (вручную в Supabase SQL Editor? Через `mcp__supabase__apply_migration`? CI автомат?)
- [ ] (опционально) Установить tool для миграций: `alembic`, `yoyo-migrations`, или Supabase CLI

---

## 🟢 Хорошо бы — можно после передачи

### 8. Observability

- [ ] **Структурированное логирование** — JSON logs (`structlog` или `python-json-logger`) — Render умеет парсить и показывать в UI
- [ ] **Sentry** для error tracking (free tier хватит на старте)
- [ ] **Метрики**:
  - [ ] Время обработки задач (`completed_at - created_at`)
  - [ ] Длина очереди в Redis (`LLEN job_queue`)
  - [ ] % успешных Reve запросов
  - [ ] % failed jobs

### 9. Тесты

- [ ] **Smoke test**: `python -c "import main; import bot"` — проверка, что импорт не падает
- [ ] **Unit-тесты** на чистые функции (без БД/Redis):
  - [ ] `get_base64_from_url` — мок aiohttp
  - [ ] Pydantic-модели валидации `JobCreateRequest`
- [ ] **Integration-тесты** против тестового Supabase проекта (бесплатно создать второй) и тестовой Upstash БД

### 10. Безопасность приложения

- [x] ~~RLS на таблицах Supabase~~ — сделано через MCP ✅
- [ ] **Rate limiting** на `POST /jobs` — иначе любой может тратить квоту Reve API
  - Опции: `slowapi`, Redis-based counter, или Render-уровневый rate limit
- [ ] **Auth на `POST /jobs`** — сейчас открытый endpoint:
  - Минимум: shared secret в header (X-Internal-Token)
  - Лучше: JWT или signed request от bot.py
- [ ] **Валидация URL** в `JobCreateRequest`:
  - Проверять, что `car_url` и `wheel_url` начинаются с `https://api.telegram.org/file/`
  - Лимит на размер изображения

### 11. Совместная работа

- [ ] **CODEOWNERS** файл — кто ревьюит какие части
- [ ] **GitHub Project / Linear / Jira** — где трекать задачи (выбрать tool, дать команде доступ)
- [ ] **Уровни доступа в Render**: пригласить команду как Collaborators (Render → Workspace → Members)
- [ ] **Уровни доступа в Supabase**: пригласить в Organization (Supabase → Org Settings → Team)
- [ ] **Уровни доступа в Upstash**: пригласить в Team (Upstash → Account → Team)
- [ ] **Передача BOT_TOKEN команде**:
  - У @BotFather нет sharing — токен передавать только через 1Password Shared Vault / Bitwarden Organizations
  - НИКОГДА не отправлять в Slack/Telegram/Email открытым текстом
- [ ] **Менеджер паролей для команды** — 1Password Teams / Bitwarden Organizations

---

## 📋 Минимальный план «срочно перед первым приглашением»

Если хочется быстро (за 1-2 часа) — сделай хотя бы это:

1. ☐ Ротация всех 6 ключей (раздел 1)
2. ☐ README с setup-инструкцией (раздел 2)
3. ☐ SQL-файл с DDL таблиц в `migrations/` (раздел 7)
4. ☐ Branch protection на `main` (раздел 5)
5. ☐ Пригласить команду в Render/Supabase/Upstash как members (раздел 11)
6. ☐ Health Check Path в Render (раздел 6)

Остальное можно делать итерационно после.

---

## 🚨 Критические known issues, которые команда сразу заметит

Передавай команде с явным списком — пусть знают, что это в работе:

| Проблема | Где | Приоритет | Ссылка |
|---|---|---|---|
| Web + worker + bot в одном контейнере | `start.sh` | medium | разделить на Web Service + Background Worker (Starter+ план $14/мес) |
| Free tier Render → spin-down 15 мин | Render plan | high | upgrade на Starter ($7/мес) для прода |
| Эфемерный диск `static/` | `main.py:97-101` | high | мигрировать на Supabase Storage (бесплатно 1GB) |
| `@app.on_event` deprecated | `main.py:120,127` | low | переписать на `lifespan` |
| Нет retry для Reve API | `main.py:76-92` | medium | tenacity или ручной retry с backoff |
| Нет Telegram bot conflict-resolution | `bot.py:108` | medium | wrap в try/retry, увеличить timeout |
| Открытый `POST /jobs` | `main.py:145` | high | добавить auth |
| Захардкоженный publicURL | `main.py:101` | low | env-переменная |

---

## 🛠️ Полезные ссылки и команды

### Сервисы

- **Render dashboard**: https://dashboard.render.com/web/srv-d6u344fkijhs73ffnukg
- **Supabase**: https://supabase.com/dashboard/project/qmgyccghsbdpehiybjae
- **Upstash**: https://console.upstash.com
- **Telegram BotFather**: https://t.me/BotFather
- **Production бот**: https://t.me/DreamWheelsAI_bot
- **Production API**: https://dream-wheels-ai-tg.onrender.com

### Документация

- **Render docs**: https://render.com/docs
- **Render REST API**: https://api-docs.render.com/reference/introduction
- **Supabase docs**: https://supabase.com/docs
- **Upstash docs**: https://upstash.com/docs/redis
- **python-telegram-bot**: https://docs.python-telegram-bot.org
- **asyncpg**: https://magicstack.github.io/asyncpg/current/
- **Reve API**: https://reve.com/docs (проверь актуальный URL)

### Команды для дебага

```sh
# Логи Render через MCP (если настроен Claude Code)
# или напрямую: Render dashboard → сервис → Logs

# Длина очереди задач в Redis
# через Upstash MCP: mcp__upstash__redis_database_run_redis_commands [["LLEN","job_queue"]]
# или Upstash Console → Data Browser

# Состояние jobs в Postgres
# Supabase → SQL Editor:
SELECT status, COUNT(*) FROM public.jobs GROUP BY status;
SELECT * FROM public.jobs WHERE status = 'failed' ORDER BY created_at DESC LIMIT 10;
```

---

## 📝 Журнал изменений этого документа

- 2026-04-30 — создан перед первой передачей (Claude Code session)
