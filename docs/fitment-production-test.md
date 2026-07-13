# Two-stage fitment: production test

`src/fitment` is the canonical implementation. `fitment_verdict/` contains
standalone demo material and must not be wired into the production API.

## 1. Environment

Use Python 3.12 and install the project dependencies:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

Set secrets in the process environment (or the Render environment). The
repository does not auto-load `.env`; a local launcher may load it, or set
PowerShell variables explicitly:

```powershell
$env:FITMENT_VERDICT_ENABLED="true"
$env:FITMENT_DB_PERSISTENCE="false"
$env:FITMENT_VLM_BASE_URL="https://api.aitunnel.ru/v1"
$env:FITMENT_VLM_API_KEY="<AITUNNEL key>"
$env:FITMENT_VLM_MODEL="<AITUNNEL vision-capable model>"
$env:WHEEL_SIZE_API_KEY="<Wheel-Size API key>"
$env:WHEEL_SIZE_REGION_DEFAULT="russia"
```

The AITUNNEL key does not grant access to Wheel-Size. Stage 1 needs AITUNNEL;
the confirmed Stage 2 needs both keys.

For product URL enrichment, prefer an explicit store allowlist:

```dotenv
FITMENT_RIM_URL_RESOLVER_ENABLED=true
FITMENT_RIM_URL_ALLOWED_HOSTS=shop.example.com,manufacturer.example
FITMENT_RIM_URL_ALLOW_ALL_PUBLIC=false
```

`FITMENT_RIM_URL_ALLOW_ALL_PUBLIC=true` allows any public HTTPS host but still
enforces DNS/IP, redirect, port, content-type, timeout and body-size controls.
The allowlist is the recommended production setting.

## 2. Database

Review and apply migrations in sequence using the normal deployment process:

- `migrations/0015_durable_render_assets.sql`
- `migrations/0016_credit_ledger_expiration_compat.sql`
- `migrations/0017_fitment_verdict.sql`

Then set:

```dotenv
FITMENT_DB_PERSISTENCE=true
```

Do not enable database persistence before the migration is applied. The
fitment tables have RLS enabled and are accessed by the backend connection;
there are no anonymous client policies.

## 3. Automated verification

```powershell
.\.venv\Scripts\python.exe -m ruff check .
.\.venv\Scripts\python.exe -m ruff format --check .
.\.venv\Scripts\python.exe -m pytest -q
```

Unit tests use fake VLM, HTTP and database clients. They do not consume live API
quota.

## 4. Direct live smoke

Run Stage 1 using real local photos:

```powershell
.\.venv\Scripts\python.exe scripts\run_fitment_live_smoke.py `
  --car-image path\to\car.jpg `
  --rim-image path\to\rim.jpg
```

Run both stages by adding user-confirmed values:

```powershell
.\.venv\Scripts\python.exe scripts\run_fitment_live_smoke.py `
  --car-image path\to\car.jpg `
  --rim-image path\to\rim.jpg `
  --make "Land Rover" `
  --model "Range Rover Evoque" `
  --year 2020 `
  --generation L551 `
  --market europe `
  --bolt-count 5 `
  --pcd-mm 108 `
  --center-bore-mm 63.4 `
  --diameter-in 19 `
  --width-j 8 `
  --offset-et-mm 43
```

The output contains no API keys. Stage 1 values are low-trust predictions and
never become confirmed values implicitly.

## 5. HTTP flow

With the backend running and Telegram authentication available:

1. `POST /fitment/preliminary` as multipart form with `car_image`, `rim_image`
   and `init_data`.
2. Display `prediction`, `fit_likelihood`, missing fields and the preliminary
   disclaimer.
3. Let the user correct and confirm vehicle fields and both axle rim specs.
4. `POST /fitment/vehicle-identities` with `is_confirmed=true`.
5. `POST /fitment/rim-setups` with `is_confirmed=true`.
6. `POST /fitment/checks` with both IDs, the `preliminary_run_id` and a unique
   `Idempotency-Key`.
7. Render the deterministic verdict, weighted risk, blocking parameters and
   recommendation codes from the response.

Do not present Stage 1 as guaranteed compatibility. Stage 2 still requires
physical clearance and installation verification before purchase.
