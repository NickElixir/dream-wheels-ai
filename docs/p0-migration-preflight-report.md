# P0-A — Production migration preflight

Дата проверки: 2026-08-16 (Europe/Moscow)  
Ветка: `codex/p0-release-verification`  
База кода: `80cccd8` (`origin/staging`)  
Production Supabase project ref: `qmgyccghsbdpehiybjae`

## Scope and safety

Проверка выполнена read-only через Supabase MCP. В production не выполнялись DDL, DML, миграции, `DROP`, `UPDATE`, `DELETE` или массовые операции. История применённых миграций в отдельной таблице не обнаружена, поэтому статус ниже основан на фактическом inventory схемы, а не на предположении, что staging и production эквивалентны.

## Inventory evidence

- Public tables: `assets`, `credit_ledger`, `jobs`, `payments`, `preorders`, `user_credit_accounts`, `users`.
- `assets` присутствует; в `jobs` присутствуют durable asset IDs и generation metadata из `0015`.
- `credit_ledger` содержит legacy и canonical поля (`event_type`, `credits_delta`, `balance_after`, `related_*`, обязательный `idempotency_key`), а также trigger `trg_sync_credit_ledger_compat_fields`.
- RLS включён на всех семи public tables; public policies не обнаружены. Это согласуется с backend-only доступом.
- Storage buckets: `raw` private, `results` public. Storage policies должны быть отдельно подтверждены перед production release.
- В production отсутствуют таблицы `vehicle_identities`, `rim_specs`, `rim_setups`, `render_input_drafts`, `render_feedback`, `fitment_change_events`, `fitment_checks`, `credit_packages`, `credit_package_allocations`.

## Migration ledger (0015–0024)

| Migration | Status | Evidence / next action |
|---|---|---|
| 0015 durable render assets | `ALREADY_PRESENT` | `assets`, asset columns in `jobs`, indexes and constraints present. Migration history itself is not recorded. |
| 0016 credit ledger expiration compat | `ALREADY_PRESENT` | Canonical/legacy ledger columns, compatibility trigger and event constraint are present. Verify function body before relying on it. |
| 0017 vehicle/rim identity | `NOT_PRESENT` | Four identity/draft tables and dependent job columns are absent. Apply only after backup and review. |
| 0018 render feedback | `NOT_PRESENT` | `render_feedback` and its unique/FK constraints are absent. Contains a data backfill from `jobs.feedback`; review row counts before applying. |
| 0019 fitment identity candidates | `NOT_PRESENT` | Parent tables from 0017 are absent; apply sequentially after 0017. Drops/recreates revision checks. |
| 0020 fitment change events | `NOT_PRESENT` | `fitment_change_events` is absent; apply after 0017/0019. |
| 0021 fitment checks | `NOT_PRESENT` | `fitment_checks` is absent; depends on identity/rim setup tables. |
| 0022 fitment evidence fallbacks | `NOT_PRESENT` | Depends on `fitment_checks`; drops/recreates one check constraint and adds columns. |
| 0023 enable credit accounts RLS | `ALREADY_PRESENT` | `user_credit_accounts.relrowsecurity = true`; migration history unknown, so do not rerun blindly. |
| 0024 credit packages FIFO | `APPLY` | Both package tables are absent. Contains starter/purchase backfills and balance recalculation (`INSERT`/`UPDATE`), so it requires backup, row-count reconciliation and an explicit operator GO. |

## Destructive/data-sensitive review

No `DROP TABLE`, `TRUNCATE`, or mass delete was found in 0015–0024. The following still require manual review before any production apply:

1. `0018` backfills `render_feedback` from legacy `jobs.feedback`.
2. `0019` and `0022` drop/recreate named CHECK constraints.
3. `0024` creates package accounting and recalculates `remaining_credits` and cached balances from existing ledger/payment rows.
4. Foreign keys use `ON DELETE CASCADE`, `SET NULL`, or `RESTRICT`; these are part of future runtime semantics and must be approved with the backup/rollback plan.

## Gate decision

**P0-A: NEEDS_OPERATOR_ACTION.** The read-only preflight is complete, but production is missing 0017–0022 and 0024. Before release, take a production backup, reconcile counts and apply only the missing migrations sequentially in a maintenance window. Do not apply the whole directory blindly and do not treat staging as proof of production state.
