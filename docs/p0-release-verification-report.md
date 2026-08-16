# P0 release verification — P0-A / P0-B

Дата: 2026-08-16 (Europe/Moscow)  
Ветка: `codex/p0-release-verification`  
Base: `80cccd8` (`origin/staging`)

## Executive decision

**Release gate: HOLD.** P0-A выявил фактический production schema drift: отсутствуют миграции 0017–0022 и 0024. P0-B automated payment tests проходят, но полный Robokassa sandbox callback flow и production migration apply в этой сессии не выполнялись. Следующий шаг — backup + migration ledger/apply с явным GO, затем sandbox browser evidence.

## P0-B automated checks

Команда:

```text
.venv/bin/python -m pytest -q tests/test_credits_service.py tests/test_robokassa_client.py tests/test_payments_mvp.py tests/test_payments_switch.py
```

Результат: **37 passed**, 2 ожидаемых deprecation warnings от httpx.

Проверены локально: Robokassa signature/URL calculation, create/callback status handling, duplicate/idempotent payment paths, credit grant/debit/refund service behavior and switch coverage. Live Robokassa платежи не выполнялись.

## Browser / staging evidence

Ранее подтверждены в staging WebApp: Telegram session `@nick_elixir`, same-origin staging WebApp, wallet/history navigation, protected result asset access, feedback UI and mobile viewport. Upload flow reached render polling, но генерация завершилась внешней ошибкой Reve `PARTNER_API_CLOSED`; это отдельный внешний blocker и не смешивается с payment gate.

Полный Robokassa sandbox submit/callback/duplicate-callback evidence в этой итерации отсутствует — **NEEDS_OPERATOR_ACTION**. До sandbox submit не использовались live credentials и не проводились production платежи.

## P0 bug status

Render logs ранее показали `TypeError: expected a datetime.date or datetime.datetime instance, got 'str'` при expiration ledger insert. Исправление уже входит в текущую базу `80cccd8`: asyncpg получает `datetime`, а не `isoformat()` строку. Regression coverage включён в `tests/test_credits_service.py` и входит в 37 passed.

## Remaining blockers

1. Production migration ledger, backup, post-migration SQL checks and explicit GO.
2. Robokassa sandbox browser flow: create → sandbox → callback → paid → one-time ledger grant → duplicate callback → pending resume → failed/cancelled no grant.
3. Reve `PARTNER_API_CLOSED` remains external; fitment beta must not start until the release gates above are closed.

## Recommended next phase entry criteria

Start fitment beta only after P0-A is marked PASS by the operator and P0-B has browser/network/console evidence for sandbox callback idempotency. Keep production and staging `BACKEND_URL` values isolated and do not run live payments as a test.
