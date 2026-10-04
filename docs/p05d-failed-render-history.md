Да. Перед P0.5-D нужно сначала закрыть **billing/accounting semantics failed render**, иначе есть риск написать в UI то, чего backend на самом деле не гарантирует.

# P0.5-D — Failed Render / History
## Название чата
`P0.5-D — Failed Render History`

**Ветка:** `feature/p05d-failed-render-history`
**Режим:** можно выполнять параллельно с P0.5-C
**PR:** отдельный, в `staging`

---

# 0. Главная проблема

Сейчас failed render отображается некорректно:

```text
- сообщение об ошибке повторяется;
- показывается «Изображение временно недоступно»,
  хотя render уже permanently failed;
- непонятно, был ли списан credit;
- UI может создавать впечатление временной проблемы asset delivery,
  хотя generation itself завершилась ошибкой;
- на 390px часть текста/состояния выглядит плохо.
```

Главный принцип:

```text
JOB FAILURE
≠
CREDIT NOT CHARGED
```

и:

```text
FAILED RENDER
≠
COMPLETED RENDER WITH MISSING IMAGE ASSET
```

---

# 1. Вопросы, на которые нужно ответить ДО UI implementation

## 1.1. Когда именно резервируется / списывается credit?

Найти полный path:

```text
render request
→ credit availability check
→ reserve_job_credit
→ job creation
→ queue
→ worker/provider
→ completion/failure
→ refund_job_credit if applicable
```

Ответить:

```text
Когда credit становится недоступен пользователю?
Когда он считается окончательно потраченным?
Это reservation или immediate debit?
```

---

## 1.2. Какие failure paths возвращают credit?

Нужно перечислить реальные failure classes.

Например:

```text
validation failure before job creation
queue failure
worker startup failure
provider rejected request
provider timeout
provider generation failure
post-processing failure
asset upload failure
database finalization failure
```

Для каждого:

```text
credit reserved?
credit refunded?
refund guaranteed?
refund best-effort?
can job fail while credit remains charged?
```

Никаких предположений по `status=failed`.

---

## 1.3. `refund_job_credit` вызывается где и насколько надёжно?

Проверить:

```text
all failure exits?
finally?
explicit exception paths?
background task?
transaction?
```

И:

```text
может ли worker умереть между:
job = failed
и
refund?
```

Если да — UI не может выводить accounting status только из job status.

---

## 1.4. Refund idempotent?

Проверить:

```text
duplicate failure handling
worker retry
callback replay
manual retry
process restart
```

не способны вернуть один credit дважды.

Нужно установить durable source of truth:

```text
ledger idempotency key?
job_credit_reservation?
transaction constraint?
unique grant/refund?
```

---

## 1.5. Может ли failed job потом стать completed?

Проверить state machine.

Например:

```text
queued
→ processing
→ failed
```

финальный ли `failed`?

Или возможен:

```text
failed
→ retry
→ completed
```

Если retry создаёт **новый job**, это нужно явно зафиксировать.

Если старый failed job может воскреснуть — UI semantics другие.

---

## 1.6. Есть ли authoritative billing state у конкретного render job?

Нужно найти, можно ли backend однозначно сказать:

```text
not_reserved
reserved
charged
refunded
unknown
```

или существующий эквивалент.

Проверить:

```text
job row
credit ledger
reservation table
credit transaction
wallet package
```

Если такого поля нет — определить, можно ли безопасно вычислить его backend-side.

---

## 1.7. Может ли frontend сам делать вывод?

Ответ должен быть:

```text
NO
```

Frontend не должен делать:

```javascript
if (job.status === "failed") {
  show("Рендер не списан")
}
```

Accounting semantics должны приходить от backend.

---

## 1.8. Что показывать для legacy jobs?

Старые failed jobs могут не иметь достаточно evidence.

Нужно определить fallback:

```text
billing_status = unknown
```

Тогда UI не должен утверждать:

```text
Рендер не списан
```

Лучше вообще не показывать accounting statement либо использовать нейтральную формулировку.

---

## 1.9. Failed render и missing result asset — это разные состояния?

Проверить случаи:

### A

```text
job.status = failed
```

Generation failed.

### B

```text
job.status = completed
result asset URL missing / expired / inaccessible
```

Generation technically succeeded, но изображение недоступно.

Они не должны использовать один UI block.

---

## 1.10. Можно ли показывать исходное фото машины?

Для failed generation желательно вместо пустого result pane показывать:

```text
source car preview
```

но проверить:

```text
private asset routing
signed URL / protected route
authorization
ownership checks
```

Не вводить новый public asset exposure.

---

## 1.11. Что именно можно показать из failure reason?

Проверить:

```text
provider raw error
internal exception
safe public reason
error code
```

Не показывать пользователю:

```text
provider secrets
stack trace
internal URL
request ID unless useful
raw API errors
```

Нужно определить user-safe taxonomy.

---

## 1.12. Как работает Retry?

Ответить:

```text
Retry creates new render job?
Uses same inputs?
Consumes another credit?
Needs new reservation?
Old job remains failed?
```

Не менять retry/billing semantics в D без отдельной необходимости.

---

# 2. Обязательный audit deliverable

До UI changes создать:

```text
docs/evidence/p05d-failed-render-history/accounting-audit.md
```

Минимальная таблица:

| Failure point | Job state | Credit reserved | Credit returned | Evidence | UI statement allowed |
|---|---|---:|---:|---|---|
| Before reservation | failed/no job | no | n/a | code path | «Не списан» |
| Provider failure | failed | ? | ? | code path/ledger | depends |
| Asset upload failure | ? | ? | ? | code path | depends |

Фактические строки определить по repo.

---

# 3. Audit gate

Implementation UI можно продолжать только после ответа:

```text
Can backend authoritatively distinguish:

A. failed + no charge
B. failed + refunded
C. failed + still charged
D. unknown
```

Если **YES** — используем существующий state.

Если **NO**, допустимо добавить минимальный backend contract.

Не проектировать новый billing subsystem.

---

# 4. Рекомендуемый billing contract

Если current API не даёт безопасного состояния, добавить минимальное поле.

Conceptual example:

```json
{
  "render_billing_status": "refunded"
}
```

Допустимые значения подобрать по текущей архитектуре, например:

```text
not_reserved
reserved
charged
refunded
unknown
```

Но не создавать лишние состояния, если существующая ledger model позволяет проще.

Главное:

```text
status должен быть backend-authoritative
```

---

# 5. Когда разрешено писать «Рендер не списан»

Только если backend доказал:

```text
credit was never reserved
```

или:

```text
reservation/refund completed successfully
```

Можно использовать единый user-facing copy:

```text
Кредит за этот рендер не списан.
```

если обе semantics продуктово эквивалентны.

Но internally желательно не терять distinction.

---

# 6. Когда нельзя писать «Рендер не списан»

Если:

```text
billing state unknown
refund pending
ledger unavailable
failed job only
```

Не делать optimistic claim.

---

# 7. Failed render History card

Для permanently failed render card должна показывать один clear state.

Например:

```text
Не удалось создать изображение

Рендер завершился ошибкой.
```

Если accounting authoritative:

```text
Кредит за этот рендер не списан.
```

И action:

```text
Повторить
```

если retry уже поддерживается.

Не показывать одновременно:

```text
Ошибка рендера
+
Изображение временно недоступно
+
Не удалось загрузить изображение
```

для одного failed job.

---

# 8. Убрать false temporary messaging

Для:

```text
job.status = failed
```

не использовать:

```text
Изображение временно недоступно
```

Эта формулировка допустима только для situation уровня:

```text
completed result exists
but asset retrieval temporarily failed
```

если такой state вообще поддерживается.

---

# 9. Failure statement — один раз

На странице Result / History не должно быть повторения одной ошибки:

```text
card badge
headline
placeholder
footer warning
```

в четырёх местах.

Нужно определить hierarchy:

```text
status badge
+
one primary explanation
+
optional billing line
+
actions
```

---

# 10. Failed result visual state

Для failed generation:

предпочтительный fallback:

```text
source vehicle photo
```

с явным состоянием поверх / рядом:

```text
Рендер не создан
```

Не выдавать source photo за generated result.

Если безопасный source preview недоступен:

использовать нейтральный placeholder.

---

# 11. Completed + missing asset

Обработать отдельно.

Например:

```text
job.status = completed
result asset unavailable
```

Это **не failed render**.

Copy:

```text
Изображение сейчас недоступно
```

может быть допустимо здесь.

Не показывать:

```text
Рендер завершился ошибкой
```

если generation была completed.

---

# 12. API state separation

Frontend желательно получать достаточно данных, чтобы различать:

```text
generation_status
asset_availability
billing_status
```

Не обязательно именно три новых поля — использовать существующую модель.

Но не кодировать три разных понятия одним:

```text
status
```

если current data уже позволяет разделить их backend-side.

---

# 13. User-safe error taxonomy

Минимальная product taxonomy может быть:

```text
generation_failed
provider_unavailable
processing_failed
result_asset_unavailable
unknown_failure
```

Только если current backend позволяет доказать distinction.

Не создавать taxonomy ради taxonomy.

Если evidence слабое — лучше один:

```text
generation_failed
```

чем ложная конкретика.

---

# 14. Retry semantics

Не менять accounting.

Если existing retry создаёт новый job:

```text
old job remains failed
new job gets own billing lifecycle
```

UI должен это сохранять.

Не «переиспользовать» failed job row так, чтобы History переписывалась.

---

# 15. History consistency

Одинаковый failed job должен иметь одинаковую semantics:

```text
History list
History detail
Result page
Home recent renders
```

Если эти поверхности используют один projection — исправлять общий projection.

Не допускать:

```text
History: "Не удалось"
Result: "Временно недоступно"
```

---

# 16. Legacy failed jobs

Для исторических записей без authoritative billing evidence:

```text
render failed
billing statement omitted
```

Не делать backfill:

```text
all failed → refunded
```

без доказательства.

---

# 17. No historical financial mutation

P0.5-D не должен:

```text
refund old jobs automatically
change historical credits
rebuild wallets
rewrite ledger
```

Если audit найдёт actual accounting corruption — отдельная задача.

---

# 18. 390 px

Обязательно проверить failed card/detail на:

```text
390px
1440px
```

На 390:

```text
headline not truncated
billing line wraps
action visible
no horizontal overflow
no giant empty result area
```

---

# 19. Accessibility

Проверить:

```text
status not conveyed by color only
error text readable by screen reader
retry button has useful label
placeholder has correct alt/aria semantics
```

---

# 20. RU / EN

Все новые strings через current i18n.

Например:

```text
RU:
Не удалось создать изображение
Кредит за этот рендер не списан.

EN:
Image generation failed
You were not charged for this render.
```

Финальный copy уточнить после accounting audit.

---

# 21. Backend tests — accounting

Обязательные tests по фактической architecture.

Минимум cases:

```text
failure before reservation
failure after reservation + successful refund
duplicate failure handling
refund replay/idempotency
failure with unknown legacy accounting
```

Если audit показывает другие реальные paths — добавить их.

---

# 22. Atomicity / race tests

Если status и refund происходят в разных transactions, проверить race:

```text
worker marks failed
refund happens
API reads between them
```

UI не должен получить ложное final statement.

Если можно избежать intermediate ambiguity transactional update — проверить.

Если нет — billing state должен уметь выражать:

```text
unknown / pending
```

а не «не списан».

---

# 23. Failed vs completed asset tests

Добавить отдельные cases:

```text
failed + no result
→ failed render UI
```

```text
completed + valid asset
→ normal result
```

```text
completed + missing/unavailable asset
→ asset unavailable UI
NOT failed generation UI
```

---

# 24. Frontend tests

Покрыть:

```text
failed + refunded
failed + never reserved
failed + billing unknown
completed + missing asset
completed + asset
legacy failed job
```

Проверить, что failure text не дублируется.

---

# 25. Source image preview

Если используется source photo:

тестировать ownership/protected URL path.

Не создавать новый public raw asset endpoint.

---

# 26. Browser QA

Сохранить screenshots/evidence:

```text
390:
- failed + no charge
- failed + unknown billing
- completed + missing asset

1440:
те же ключевые states
```

---

# 27. Out of scope

Не менять:

```text
payment lifecycle P0.5-B
Fitment P0.5-C
credit pricing
number of credits per render
provider retry policy
render provider architecture
History redesign целиком
old N-06 provenance
```

---

# 28. Parallel branch rules

Так как C и D идут параллельно:

создать D от текущего `staging`.

Перед merge D:

```text
1. первый из C/D merged
2. второй обновить на новый staging
3. resolve conflicts
4. rerun affected backend/frontend tests
5. CI exact new HEAD
6. focused re-review if changed runtime overlap exists
```

Особенно проверить общие:

```text
webapp/app.js
jobs_api.py
schemas
i18n
```

---

# 29. Evidence directory

Создать:

```text
docs/evidence/p05d-failed-render-history/
```

Минимум:

```text
accounting-audit.md
report.md
browser-390.png
browser-1440.png
test evidence
```

---

# 30. Delivery report

```text
# P0.5-D FAILED RENDER / HISTORY REPORT

1. Base SHA
2. Branch
3. PR
4. HEAD
5. Existing render billing lifecycle
6. Credit reservation point
7. Credit finalization point
8. Failure/refund paths
9. Refund idempotency
10. Failed-job finality
11. Authoritative billing source
12. API contract
13. Legacy-job semantics
14. Failed vs missing-asset distinction
15. History UI
16. Result UI
17. Source-photo fallback
18. Retry semantics
19. RU/EN
20. Accessibility
21. 390 QA
22. 1440 QA
23. Backend tests
24. Frontend tests
25. PostgreSQL/ledger tests if applicable
26. CI exact HEAD
27. New findings
28. Deferred findings
29. READY FOR INDEPENDENT REVIEW
```

---

# 31. Acceptance — accounting

```text
[ ] failed status alone is never treated as proof of refund
[ ] credit lifecycle is documented
[ ] refund paths are known
[ ] refund is idempotent
[ ] UI billing statement comes from authoritative backend evidence
[ ] legacy unknown accounting does not produce false "not charged"
[ ] no historical credit mutations
```

---

# 32. Acceptance — rendering state

```text
[ ] failed generation separated from missing asset
[ ] permanent failure does not say "temporarily unavailable"
[ ] failure message appears once
[ ] source photo is not presented as generated result
[ ] completed missing asset is not labelled generation failure
[ ] History and Result use consistent semantics
```

---

# 33. Acceptance — UI

```text
[ ] RU/EN
[ ] 390 PASS
[ ] 1440 PASS
[ ] no truncation/overflow
[ ] retry action correct
[ ] accessibility PASS
```

---

# 34. Required implementation result

После завершения вернуть:

```text
P0.5-D IMPLEMENTATION RESULT

PR:
HEAD:

ACCOUNTING AUDIT:
PASS / BLOCKED

FAILED → NO CHARGE ASSUMPTION:
REMOVED / STILL PRESENT

AUTHORITATIVE BILLING STATE:
existing / added / unavailable

FAILED VS MISSING ASSET:
SEPARATED / NOT SEPARATED

LEGACY FAILED JOBS:
SAFE / UNSAFE

HISTORY:
PASS / FAIL

RESULT:
PASS / FAIL

390:
PASS / FAIL

1440:
PASS / FAIL

BACKEND:
...

FRONTEND:
...

POSTGRESQL / LEDGER:
...

CI EXACT HEAD:
...

NEW BLOCKER:
NEW HIGH:
NEW MEDIUM:
NEW LOW:

READY FOR FULL INDEPENDENT REVIEW:
YES / NO
```

---

# 35. Stop condition

После открытия PR:

```text
STOP
→ independent review
→ corrective pass if needed
→ re-review
→ merge
```

Не merge автоматически.

## Ключевые вопросы перед D в одной строке

Нужно доказать четыре вещи:

```text
1. Когда credit резервируется/списывается?
2. Какие failed paths гарантированно его возвращают?
3. Чем backend доказывает refund/no-charge для конкретного job?
4. Как отличить generation failure от completed render с недоступным asset?
```

Пока на эти четыре вопроса нет точного ответа из кода/ledger, фраза **«Кредит за этот рендер не списан»** не должна попадать в UI.

# Owner Decision / State Machine Contract

P0.5-D OWNER DECISION — RENDER JOB FINALITY

Decision: APPROVED (owner message, 2026-10-04).

1. `failed` and `completed` are terminal. No transition out of either state is allowed.
2. Normal transitions: queued → processing → completed; queued → failed; processing → failed.
3. User retry creates a new job_id, render job and credit reservation. Original failed job remains unchanged in History; no reuse/resurrection.
4. Credit transitions: reserved → finalized on successful completion; reserved → refunded on committed failure/refund. finalized and refunded are terminal for that job; refunded must never become finalized.
5. Queue consumption atomically claims only an eligible queued job. Replays for processing/failed/completed must not invoke the provider again.
6. Completion is conditional on active processing. Late terminal-job results must not change state, finalize credit or attach a user-visible result. Diagnostic logging is allowed.
7. Failure affects only queued/processing jobs. Late exceptions cannot change completed to failed. Repeated failure on failed is a no-op for state and credits.
8. After reservation, refund + failed transition remain one database transaction. No stable failed/reserved or refunded/active state may be introduced by this implementation.
9. Historical failed status never proves refund. Use authoritative credit/ledger evidence; omit/neutralize financial copy when unavailable.
10. No resurrection/recovery of terminal jobs. Stuck processing recovery is a separate task.

Additional mandatory acceptance:

- [ ] failed and completed are terminal; failed → processing/completed and completed → processing/failed are impossible.
- [ ] Duplicate queue delivery does not invoke provider twice.
- [ ] failed/refunded cannot produce a free late completion or a new ledger event.
- [ ] completed/finalized cannot later become failed.
- [ ] User retry creates new job_id + reservation and preserves the original job.
- [ ] Refund + failed are atomic; late results cannot finalize refunded credit.
- [ ] Legacy failed does not imply refund without accounting evidence.

Required regressions:

- Given failed/refunded, queue replay or direct process_render_job invocation: provider not called, state/credits unchanged, no result attachment or ledger event.
- Given completed/finalized, duplicate delivery: provider not called, state/credits unchanged.
- Given provider in flight then committed failure/refund: late result cannot attach/finalize/complete.
- Given completed/finalized then late exception: no failure/refund mutation.
