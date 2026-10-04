# P0.5-D — accounting audit

Дата: 2026-10-04. Ветка: `feature/p05d-failed-render-history`.
Audited HEAD: `9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a`.

**Gate: UNBLOCKED — owner decision received.** Решение владельца: failed/completed terminal; retry — новый job/reservation; late result не меняет terminal job и accounting. Нормативный блок: [Owner Decision / State Machine Contract](../../p05d-failed-render-history.md#owner-decision--state-machine-contract). Следующие findings описывают audited base до runtime corrections. Это аудит текущего кода и миграций, не подтверждение deployed schema или финансовых данных production. Исторические credits/ledger не изменялись.

Ссылки ниже закреплены на audited HEAD. Отсутствие recovery/guards установлено чтением полного render worker и всех call sites reserve/refund, а не предположением по названию status.

## §1.1. Когда резервируется и списывается credit

Полный путь:

- Bot: [create_job, insert + reserve внутри transaction](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/src/jobs_api.py#L2079).
- Multipart: [upload_job](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/src/jobs_api.py#L2160), загрузка исходных assets до transaction, затем insert и reserve на L2303.
- Durable assets: [create_job_from_assets](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/src/jobs_api.py#L2370), ownership/validation и insert в transaction, reserve на L2578, RPUSH после commit на L2592.
- [reserve_job_credit](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/src/credits_service.py#L749): job row `FOR UPDATE`, get_balance, availability check, FIFO active packages `FOR UPDATE`, уменьшение remaining_credits, allocations, уменьшение account balance, ledger `job_reserve` с отрицательной delta и `job_reserve:{job_id}`, job `credit_status=reserved`.
- [worker: BLPOP → process_render_job → provider → storage → completion](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/src/main.py#L339).
- [finalize_job_credit](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/src/credits_service.py#L864): только reserved → finalized; ledger `job_finalize:{job_id}`, delta=0. Completion + finalize + analytics находятся в одной transaction (main.py L364).

Credit недоступен после commit создания job/reservation, до queue/provider. Это reservation с немедленным уменьшением доступного баланса; второй debit на completion отсутствует. Окончательное успешное списание отмечается `finalized` при completion commit. Порядок фактически **insert job → reserve → commit → queue**, поскольку reserve блокирует существующий job row. При rollback создания нет ни durable job, ни debit.

## §1.2. Failure matrix

Обозначения: R = [reserve](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/src/credits_service.py#L749); Q = [queue compensation](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/src/jobs_api.py#L2053); W = [worker catch](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/src/main.py#L390); F = [transactional failure/refund](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/src/main.py#L307).

| Failure point | Job state | Credit reserved | Credit returned | Evidence / guarantee | UI statement allowed |
|---|---|---|---|---|---|
| Auth, consent, image validation, rate limit, missing draft before transaction | No new job | No | n/a | jobs_api upload/from-assets preflight | No-charge только для этого доказанного rejected request, не для произвольного failed job |
| Input asset upload before multipart insert | No new job | No | n/a | jobs_api L2237–2270 | То же |
| Job insert / availability / reserve exception | Transaction rolled back, no new durable job | No committed reservation | Rollback | R + caller transaction, jobs_api L2280–2335 / L2418–2590 | То же; потеря ответа commit — отдельная сетевая неоднозначность |
| RPUSH exception | queued/reserved до компенсации; failed/refunded после её commit | Yes | Attempted | Q; refund + failed atomic, но exception swallowed/logged | Только доказанный billing state; 503 не доказывает refund |
| Worker startup unavailable / process dies before dequeue | queued | Yes | No recovery guarantee | W; render stale recovery отсутствует, recovery относится к fitment checks | Нельзя «не списан» |
| Process dies/cancelled after BLPOP or during provider | queued/processing | Yes | Не гарантирован | W: destructive dequeue; catch Exception не покрывает process death / cancellation | Нельзя «не списан» |
| Bot input download/upload, load inputs, build request, provider config | processing → failed при F commit | Yes | Attempted; commit подтверждает refund для reserved job | process_render_job L350–354 → W → F | Только по authoritative accounting evidence |
| Provider rejection/auth/content/rate limit/unavailable/uncertain submission | processing → failed при F commit | Yes | То же | provider.edit L354 → W → F; safe codes main.py L286–299 | То же |
| Provider timeout / generation failure / invalid response / result download | processing → failed при F commit | Yes | То же | То же; timeout не доказывает, что удалённый provider прекратил работу | То же |
| Post-provider metadata / output asset upload / asset DB persistence | processing → failed при F commit | Yes | То же | main.py L355–362; _save_render_output L210; W → F | Generation job failed; сохранённый asset сам по себе не означает completed |
| Completion/finalize/analytics transaction failure | Предыдущий processing, затем failed при F commit | Yes | Attempted после rollback completion | main.py L364–381 → W → F | Только по billing evidence; commit outcome при обрыве соединения требует осторожности |
| Refund / failure transaction error | Предыдущее состояние, rollback | Yes | Не гарантирован | Q логирует и подавляет; F exception выходит из worker catch и может завершить loop | Нельзя «не списан» |
| Повторная доставка уже finalized job, затем ошибка | Может стать failed/finalized | Earlier debit finalized | Нет: refund только reserved | Без guards в W/process; credits_service L934–935 | Still charged; failed не доказывает refund |
| Completed result asset missing/inaccessible later | completed/finalized | Yes | Refund не вызывается | Read/download paths jobs_api L2630, L4663 | Только asset-unavailable; не generation-failed |

Гарантируется **атомарность успешного commit**, а не eventual refund для всех failures. Для normal reserved job F/Q commit возвращает credit и отмечает failed вместе; если процесс погиб или компенсация не завершилась, credit может оставаться недоступным. У duplicate finalized job failed может сочетаться с окончательным списанием.

## §1.3. Где вызывается refund и насколько надёжен

Все найденные runtime call sites: Q и F выше. Explicit exception handlers, не finally, не durable background compensation. Оба используют `conn.transaction()`, refund выполняется **до** записи failed; F включает также analytics event. Поэтому промежутка «committed failed, затем refund» в этих normal paths нет: API видит до commit старый queued/processing + reserved либо после commit failed + refunded. Сбой analytics откатывает refund и failed вместе.

Worker может умереть до/внутри этой transaction — тогда нет гарантии возврата. F не имеет собственного защитного catch/retry; ошибка F внутри except worker может завершить worker task. Queue compensation best-effort, с подавлением исключения. Очередь и Postgres не образуют общей transaction: RPUSH может фактически доставить сообщение, хотя клиент получил exception; worker тогда способен обработать job после queue compensation.

## §1.4. Refund idempotency

[refund_job_credit L919–1016](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/src/credits_service.py#L919): job `FOR UPDATE`; refunded → no-op, любой статус кроме reserved → no-op. При caller transaction повторные/concurrent refund для одной непрерывной reservation сериализуются и второй credit не возвращают. Restores только неистёкшие allocated packages; если restored=0, создаётся replacement package `job_refund_package:{job_id}` с PURCHASE_GRANT_TTL_DAYS. Ledger `job_refund:{job_id}` unique.

Durability: [non-partial unique ledger index + NOT NULL](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/migrations/0012_credit_accounts_ledger_schema_align.sql#L152); [package key UNIQUE, allocation UNIQUE(package_id,job_id)](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/migrations/0024_credit_packages_fifo.sql#L3).

Ограничение: service сам transaction не открывает; проверенные callers её открывают. Ledger `ON CONFLICT DO NOTHING` сам по себе не защищает баланс — защиту даёт locked job state. Reserve guard исключает только reserved/finalized, **не refunded**, поэтому намеренная повторная reservation того же refunded job нарушает single-lifecycle предпосылку: allocations увеличиваются, прежний ledger key повторно не вставляется. Такой lifecycle не разрешать без отдельного решения. Restart не даёт render recovery; render callback replay path здесь отсутствует.

Дополнительный риск вне D: при credit_cost > 1 и смеси expired/live allocations refund восстанавливает только live часть, но ставит refunded для всего job. Если все allocations expired, выдаёт весь cost новым package. Поэтому `refunded` не универсальный proof полного возврата произвольного cost. [Default job credit_cost=1](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/migrations/0009_payments_mvp.sql#L3); runtime configuration не проверялась. Исторические данные/кошельки не исправлять в D.

## §1.5. Финален ли failed

**Нет гарантии terminal failed.** [process_render_job L347](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/src/main.py#L347) безусловно обновляет processing по id; completion L367 и F L321 также не имеют guards/CAS по prior status. [Initial jobs schema](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/migrations/0001_initial.sql#L15) не задаёт transition machine. Duplicate/late queue delivery допускает failed → processing → completed. Для refunded job finalize no-op (credits_service L886): возможен completed/refunded. После повторной доставки completed job и ошибки возможен failed/finalized.

Это не утверждение о наблюдавшемся production incident: это достижимый code path, особенно при ambiguous RPUSH + Q. UI не может гарантировать permanently failed при нынешнем worker.

## §1.6. Authoritative billing state

Есть внутренний `jobs.credit_status`: not_charged / reserved / finalized / refunded; [DDL](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/migrations/0009_payments_mvp.sql#L3). Есть cost, job-linked ledger, FIFO allocations/packages. [History/status queries and projections](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/src/jobs_api.py#L2630) **не выбирают/не возвращают credit_status**, public billing contract отсутствует.

Gate A/B/C/D: backend может построить консервативный projection, но не достоверно классифицировать каждую historical job одним row default. Требуется minimal read-only backend contract после решения blocker:

- reserved + согласованный reserve evidence → reserved (credit недоступен, refund не доказан).
- finalized + согласованный reserve/finalize evidence → charged.
- refunded + согласованный reserve/refund ledger и достаточная возвращённая delta относительно cost → refunded.
- not_charged только с доказательством нового accounting lifecycle и отсутствия debit; отсутствие ledger само по себе историческую «не списан» гарантию не даёт.
- default legacy, missing/contradictory evidence, incomplete refund или ledger unavailable → unknown. При query failure нельзя заменять состояние optimistic no-charge.

Это proposal, не реализованный API. Не вводить новый billing subsystem и не выводить accounting из generation status. Остаток wallet today не доказывает job refund: package мог истечь/быть использован позже.

## §1.7. Может ли frontend делать вывод

**NO.** failed не означает no-charge: см. F/Q reliability, §1.5 failed/finalized и projection без billing в §1.6. Frontend должен использовать backend-authoritative statement eligibility; неизвестный billing — без финансовой строки. [Current frontend polling failure](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/webapp/app.js#L11725) читает job error, не ledger.

## §1.8. Legacy jobs

[0009 adds NOT NULL DEFAULT not_charged](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/migrations/0009_payments_mvp.sql#L3) без подтверждения historical debit/refund. [Ledger migration](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/migrations/0011_credit_ledger_idempotency_backfill.sql#L24) добавляет legacy keys, не доказывает per-job lifecycle. [0024](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/migrations/0024_credit_packages_fifo.sql#L36) backfills packages из grants/payments, не исторические job allocations. Legacy без достаточных согласованных evidence → unknown; omit accounting copy. Не backfill failed → refunded, не refund исторические jobs.

## §1.9. Failed generation vs completed missing asset

Разные состояния. [Output persistence](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/src/main.py#L208) отдельна от completion transaction; даже failed job может иметь asset после ошибки финализации. [History/status](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/src/jobs_api.py#L2630) отдаёт status, result URL, metadata; URL не доказывает HTTP availability. [Asset download](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/src/jobs_api.py#L4704) выдаёт 502 при StorageError без failed transition/refund. completed + missing/load error — asset unavailable, не generation failed; failed + saved asset остаётся failed job. [Generic frontend missing state](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/webapp/app.js#L9461) требует отделения после gate.

## §1.10. Исходное фото

Да, при наличии durable source и через существующий protected path. [Signed URL](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/src/jobs_api.py#L4616): required auth, jobs.user_id=auth.user_id, assets.owner_user_id=jobs.user_id, RAW_BUCKET, permitted source kind/reference, short TTL, private/no-store. [Download proxy](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/src/jobs_api.py#L4663) проверяет ownership. [Website blob loading](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/webapp/app.js#L9291) использовать с Authorization; bearer endpoint нельзя напрямую в img src. Legacy failed bot job мог не успеть сохранить source: placeholder, не raw Telegram URL. Не создавать public exposure и не выдавать source за результат.

## §1.11. Failure reason

[Provider allowlist](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/src/main.py#L286) переводит provider errors в фиксированные сообщения. Но `_safe_job_failure` для любого другого Exception возвращает `type(error).__name__, str(error)` (L300–304), а jobs_api L2688/L2766/L2826 передаёт raw error_message. **Это не универсальная безопасная public taxonomy.** Internal exceptions могут содержать внутренние URL/детали.

Для D допустимо backend public category generation_failed + fixed RU/EN copy для failed, без raw error/stack/provider diagnostics. Более конкретные сообщения только по явному safe allowlist. Completed asset retrieval error — отдельная категория result_asset_unavailable. Provider diagnostics/request ids не переносить в public copy. Existing provider mapping содержит «temporarily unavailable» для availability причины, но это не повод называть result asset failed job временно недоступным.

## §1.12. Retry

[History button](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/webapp/app.js#L9673) — navigation to Create; **не гарантирует повтор inputs конкретного historical job**. [Generation retry](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/webapp/app.js#L11188) вызывает submitJob с текущими files. [Observed failed polling](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/webapp/app.js#L11725) очищает draft/key: следующая успешная submission создаёт новый UUID/new reservation через from-assets. Старый job этим UI action не обновляется; однако worker finality отдельно не защищена (§1.5).

При network ambiguity key сохраняется: [from-assets idempotency](https://github.com/NickElixir/dream-wheels-ai/blob/9521dd7fd6a1d69cb7a73dcc674dbcd3bd9ec48a/src/jobs_api.py#L2400) возвращает прежний job_id, hardcoded status queued, без новой reservation. Это replay запроса, не retry generation. Новый render расходует собственный credit; менять billing/provider retry policy в D нельзя.

## Решение владельца получено — исходный blocker закрыт

1. Подтвердить, что **failed является terminal для старого job**, поздняя/повторная queue delivery не должна менять его, а пользовательский повтор всегда создаёт новый job и новую reservation. ТЗ предполагает permanently failed; текущий код этого не гарантирует. Добавление guards изменит runtime treatment поздних сообщений и требует решения в силу пользовательского stop condition.
2. Определить действие при ambiguous queue publish: после successful failed/refund compensation игнорировать позднее сообщение того же job либо разрешать reconciliation завершения? Второй вариант несовместим с безусловным permanently failed UI и может дать completed/refunded. Предпочтительный вариант для D — terminal failed и запрет повторной обработки terminal job, без исторических финансовых мутаций; решение получено, разрешены conditional transitions согласно контракту.

Дополнительные findings: refund replacement TTL, partial refund для multi-credit cost, legacy evidence, raw internal errors, отсутствие render crash recovery. Не исправлять автоматически и не менять финансовую политику в D. History retry сохранить как текущую navigation; автоматическое восстановление historical inputs — отдельное продуктовое расширение.

## Проверка и границы

Проверены все runtime reserve/refund call sites, transaction boundaries, worker loop, SQL constraints и projections history/status, protected source routes и retry handlers. Фокусированные существующие tests проверяются отдельно; mock tests не являются PostgreSQL доказательством rollback, row locks или refund replay. Production/staging DB и внешние provider/payment APIs не вызывались. PostgreSQL race/idempotency и runtime/UI tests из ТЗ остаются обязательными после снятия blocker; ни CI, ни browser QA сейчас не заявляются PASS.

Запуск focused suite (`test_credits_service`, `test_jobs_queue_compensation`, `test_wan_runtime_integration`, `test_jobs_upload`, `test_identity_api`) остановился на collection: в доступном Python 3.12 environment отсутствует `itsdangerous` (4 collection errors). Это environment limitation, не PASS runtime tests.

Отдельно `tests/test_credits_service.py`: **13 passed** (0.08s). Эти tests не подтверждают PostgreSQL transaction/race/replay; financial runtime changes не внесены.

Owner decision received 2026-10-04: P0.5-D0 закрыт. Runtime correction использует atomic queued claim, guarded completion и locked failure/refund; исходные ссылки остаются evidence audited base, новые проверки документируются в report.md.

Runtime corrections completed after owner decision: terminal queue replay now exits before provider; failure/refund retains one transaction with locked active-state eligibility; successful completion is conditional on processing/reserved; refunded job reservation is rejected. Read-only billing projection requires matching full-cost ledger evidence; default legacy not_charged remains unknown. The unconditional network/queue no-charge warning was removed. See report.md for the reconciled staging base, tests and browser scope. No historical financial mutation occurred.
