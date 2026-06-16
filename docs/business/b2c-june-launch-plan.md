# Dream Wheels AI — B2C Telegram Mini App June Launch Plan

Status: draft for June 2026 launch planning.

Scope: B2C Telegram Mini App only. This document intentionally avoids private
seller/legal details, credentials, tax data, API keys, payment secrets, and any
non-consumer distribution strategy.

## 1. Final B2C Product Pipeline

### User-facing flow

1. **Open Mini App** from the Telegram bot or shared link.
2. **Landing promise**: “Try wheels on your own car before you buy them.”
3. **Upload car photo** with guidance:
   - full side view;
   - good lighting;
   - all visible wheels unobstructed;
   - JPG/PNG up to the current app limit.
4. **Upload wheel photo** with guidance:
   - front-facing wheel;
   - minimal background clutter;
   - one wheel per image when possible.
5. **Preflight checks** before generation:
   - Telegram user identity is verified through Mini App init data;
   - image type and size are validated;
   - duplicate tap protection uses an idempotency key;
   - user has a free trial render or paid credit available;
   - hourly abuse limit is enforced.
6. **Credit authorization**:
   - free trial users consume their single trial attempt;
   - paid users reserve 1 render credit for the job;
   - reservation is finalized only after a successful render, while failed-job
     handling remains pending approval in section 6.
7. **Async generation**:
   - backend creates a job;
   - Redis queues work;
   - worker sends the images to the external image generation API;
   - result is stored and attached to the job.
8. **Result delivery**:
   - Mini App shows before/after comparison;
   - user can download or share;
   - feedback buttons capture quality signal.
9. **Next action**:
   - if user has credits: “Try another wheel”;
   - if user has no credits: “Buy credits”;
   - if the result is poor: show support/report CTA, without promising refund
     terms until section 6 is approved.

### Operational pipeline

| Stage | Owner system | Required state | Business rule |
| --- | --- | --- | --- |
| Open app | WebApp | `session_started` | Detect Telegram user and locale. |
| Upload | WebApp | `car_selected`, `wheel_selected` | Block generation until both images pass local checks. |
| Preflight | FastAPI | `preflight_ok` or error | Validate auth, rate limit, credit/trial availability, and idempotency. |
| Reserve credit | FastAPI/Postgres | `credit_reserved` | Prevent double-spend during retries and duplicate taps. |
| Queue | FastAPI/Redis/Postgres | `queued` | Persist job before queue push. |
| Generate | Worker | `processing` | Worker owns external API call and timeout. |
| Complete | Worker/Postgres/Storage | `completed` | Finalize credit usage and store output URL. |
| Deliver | WebApp | `result_ready` | Show comparison, download, share, feedback, and next purchase CTA. |

## 2. Unit Economics Model

### Editable baseline assumptions

These are launch-planning assumptions, not hard-coded product constants. Replace
with actual Robokassa, hosting, storage, and image API numbers before checkout is
opened to real users.

| Input | Symbol | Baseline value | Notes |
| --- | --- | ---: | --- |
| External API cost per attempt | `api_cost_attempt` | 35 RUB | Planning placeholder. |
| Attempts per successful render | `attempts_success` | 1.25 | Allows limited retry/regeneration overhead. |
| Failed-job rate | `failure_rate` | 12% | Track weekly; target under 8%. |
| Payment fee rate | `payment_fee_rate` | 4.0% | Editable payment-processing placeholder. |
| Payment fixed fee | `payment_fee_fixed` | 0 RUB | Add if contract requires it. |
| Monthly infra cost | `infra_monthly` | 6,000 RUB | App hosting, Postgres, Redis, storage, monitoring. |
| Paid renders per month | `paid_renders_month` | 1,000 | Launch target for allocating fixed costs. |
| Support/manual buffer per paid render | `support_buffer` | 10 RUB | Covers manual review/support time. |
| Free trial renders per month | `free_renders_month` | 300 | Free-trial subsidy cap for June. |
| Trial-to-paid conversion | `free_to_paid_conversion` | 12% | Measure by cohort. |

### Core formulas

```text
api_cost_success = api_cost_attempt * attempts_success
infra_cost_render = infra_monthly / max(paid_renders_month, 1)
cogs_per_success = api_cost_success + infra_cost_render + support_buffer
payment_fee = package_price * payment_fee_rate + payment_fee_fixed
package_cogs = included_renders * cogs_per_success
contribution_margin = package_price - payment_fee - package_cogs
gross_margin_percent = contribution_margin / package_price
free_trial_subsidy = free_renders_month * cogs_per_success
break_even_paid_revenue = (infra_monthly + free_trial_subsidy) / target_margin_after_fees
```

Baseline calculated values:

| Metric | Formula | Baseline |
| --- | --- | ---: |
| API cost per successful render | `35 * 1.25` | 43.75 RUB |
| Allocated infra per paid render | `6000 / 1000` | 6.00 RUB |
| COGS per successful paid render | `43.75 + 6 + 10` | 59.75 RUB |
| June free-trial subsidy cap | `300 * 59.75` | 17,925 RUB |

### Recommended package economics

| Package | June price | Included renders | Effective price/render | Payment fee | Package COGS | Contribution margin | Margin |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Start | 299 RUB | 3 | 99.67 RUB | 11.96 RUB | 179.25 RUB | 107.79 RUB | 36.1% |
| Pro | 699 RUB | 10 | 69.90 RUB | 27.96 RUB | 597.50 RUB | 73.54 RUB | 10.5% |
| Master | 1,290 RUB | 25 | 51.60 RUB | 51.60 RUB | 1,493.75 RUB | -255.35 RUB | -19.8% |

Decision from the baseline model:

- **Start is healthy enough for June validation.**
- **Pro is acceptable only if actual COGS is near or below the baseline and the
  package is positioned as the main conversion offer.**
- **Master at 25 renders is not viable at 1,290 RUB under baseline COGS.** Adjust
  to fewer renders or higher price before launch.

### Corrected June economics recommendation

| Package | June price | Included renders | Effective price/render | Baseline margin view |
| --- | ---: | ---: | ---: | --- |
| Start | 299 RUB | 3 | 99.67 RUB | Launch-safe entry package. |
| Pro | 699 RUB | 8 | 87.38 RUB | Better-value package with safer margin. |
| Master | 1,290 RUB | 15 | 86.00 RUB | High-volume package without loss-making render count. |

Corrected package calculations:

| Package | Payment fee | Package COGS | Contribution margin | Margin |
| --- | ---: | ---: | ---: | ---: |
| Start | 11.96 RUB | 179.25 RUB | 107.79 RUB | 36.1% |
| Pro | 27.96 RUB | 478.00 RUB | 193.04 RUB | 27.6% |
| Master | 51.60 RUB | 896.25 RUB | 342.15 RUB | 26.5% |

### Scenario analysis

| Scenario | Changed assumptions | Start margin | Pro margin | Master margin | Decision |
| --- | --- | ---: | ---: | ---: | --- |
| Conservative | Baseline values above | 36.1% | 27.6% | 26.5% | Launch with daily cost monitoring. |
| Good quality | `attempts_success = 1.10`, `failure_rate = 8%` | 42.3% | 35.5% | 36.3% | Increase trial traffic. |
| API cost +40% | `api_cost_attempt = 49 RUB` | 21.4% | 9.3% | 4.0% | Keep Start, pause large discounts. |
| Low paid volume | `paid_renders_month = 400` | 27.1% | 16.3% | 12.6% | Limit free trials until volume improves. |
| Heavy usage mix | 60% of buyers choose Master | Blended margin depends on actual usage | Blended margin depends on actual usage | Blended margin depends on actual usage | Daily cap total paid renders if API budget is constrained. |
| Low trial conversion | `free_to_paid_conversion = 5%` | Package margins unchanged | Package margins unchanged | Package margins unchanged | Reduce trial cap or add watermark/slow queue. |

June decision gates:

- Launch only packages with positive contribution margin under baseline.
- Track actual attempts per successful render from day 1.
- Pause Pro/Master sales if external API cost rises more than 40% before prices
  are updated.
- Keep monthly free-trial subsidy below a fixed June budget cap.

## 3. June Pricing and Packages

### Checkout packages for June

| Package | Price | Credits | Best for | Checkout copy |
| --- | ---: | ---: | --- | --- |
| Start | 299 RUB | 3 renders | One car, 2-3 wheel options | “Quickly compare your shortlist.” |
| Pro | 699 RUB | 8 renders | Active wheel buyers | “Try several designs before you buy wheels.” |
| Master | 1,290 RUB | 15 renders | Enthusiasts testing many styles | “More experiments at a lower per-render price.” |

### Pricing rules

- Credits are consumer render credits for the Telegram Mini App.
- Credits are not cash-equivalent.
- Credits should be visible in the Mini App cabinet immediately after successful
  payment confirmation.
- Purchased credits should have a clear validity period in checkout copy. The
  June operating recommendation is **90 days from purchase** because it gives
  users enough time to compare options while limiting indefinite liability.
- “Unlimited month” should **not** be sold in June. If tested later, it must have
  a visible fair-use cap and backend enforcement before launch.

## 4. Free Trial Policy

Recommended June policy:

| Rule | Decision |
| --- | --- |
| Trial amount | 1 free render per Telegram user. |
| Eligibility | User must open the Mini App through Telegram and pass init-data validation. |
| Watermark | Add a subtle watermark to trial results. |
| Queue priority | Trial jobs may use normal priority during the first week; switch to lower priority if API spend grows faster than paid conversion. |
| Abuse controls | One trial per Telegram user ID, idempotency protection, hourly rate limit, and duplicate image/job protection where feasible. |
| Conversion CTA | After trial result: “Buy 3 more renders” with Start package highlighted. |
| Trial budget cap | Cap June free-trial subsidy using `free_renders_month * cogs_per_success`; baseline cap is 300 free trial renders. |

Rationale:

- A free trial is the fastest way to prove that users understand the product
  value from their own car photo.
- One trial render is enough for the “magic moment” while keeping June API spend
  controllable.
- Watermarking protects paid value without blocking sharing.

## 5. Founder Pass Policy

Pending founder approval of sections 1-4 and 7-9. This section is intentionally
not defined yet.

## 6. Refund and Credit Rules

Pending founder approval of sections 1-4 and 7-9. This section is intentionally
not defined yet.

## 7. June Marketing Plan

### Campaign goals

1. Validate whether consumers will upload real car and wheel photos.
2. Convert trial users into Start/Pro purchases.
3. Learn which audience produces successful renders and paid conversion.
4. Keep API subsidy within the June budget cap.

### Campaign phases

| Phase | Dates | Goal | Actions | Exit criteria |
| --- | --- | --- | --- | --- |
| Setup | June 4-7 | Prepare funnel | Finalize checkout copy, screenshots, FAQ, analytics events, and trial cap. | Mini App can track opens, uploads, trial completion, checkout opens, purchases. |
| Soft launch | June 8-14 | First real users | Post in friendly Telegram/VK/Drive2 communities, collect 50-100 trial users, manually review failed renders. | At least 30 successful trial renders and first paid purchases. |
| Offer test | June 15-21 | Compare Start vs Pro | Run A/B copy in posts and bot CTAs; highlight Start for broad traffic and Pro for active buyers. | Know checkout-open rate and paid conversion by package. |
| Scale cautiously | June 22-30 | Increase reach if margins hold | Repost best before/after examples, ask users to share, add small creator/community placements. | Positive package margin and acceptable failed-job rate. |

### Channel plan

| Channel | Angle | CTA | Frequency |
| --- | --- | --- | --- |
| Telegram auto chats | “Before buying wheels, preview them on your car.” | Open Mini App and use 1 free render. | 3-5 community posts/week, respecting group rules. |
| VK auto/tuning groups | Before/after visual proof. | Try one free render, then Start package. | 2-3 posts/week plus comments where relevant. |
| Drive2 posts | Case-study format with real car photos. | “Send your car + wheel photos, get preview.” | 1-2 detailed posts/week. |
| Personal founder channels | Build-in-public updates and examples. | Trial render and feedback request. | 3 short updates/week. |
| User sharing | Watermarked free result. | “Share result and ask which wheels look better.” | Built into result screen. |

### Weekly execution checklist

| Cadence | Checklist |
| --- | --- |
| Daily | Check opens, upload starts, successful renders, failures, API spend, checkout opens, purchases, support messages. |
| Daily | Save 3-5 strong before/after examples with user consent for reposting. |
| Daily | Review failed jobs and update photo guidance if the same issue repeats. |
| Twice weekly | Publish a post with a concrete car/wheel example and clear CTA. |
| Weekly | Update pricing/model assumptions from actual cost per successful render. |
| Weekly | Decide whether to keep, reduce, or expand free-trial cap. |

### Offer copy

Short CTA variants:

- “Try wheels on your own car before you buy them.”
- “Upload your car + wheel photo. Get an AI preview in minutes.”
- “Not sure which wheels fit? Test them on your real car first.”
- “One free preview in Telegram. Paid credits if you want to compare more.”

Start package CTA:

> Liked the first preview? Buy 3 renders for 299 RUB and compare your shortlist.

Pro package CTA:

> Choosing between many designs? Get 8 renders for 699 RUB and test the options
> before buying wheels.

### Post templates

Telegram/VK short post:

```text
Choosing wheels is hard from product photos alone.

Dream Wheels AI lets you upload:
1) a side photo of your car;
2) a front photo of a wheel.

The Mini App returns a realistic preview of your own car with those wheels.
June launch: 1 free render, then paid render credits if you want more variants.

Open the Telegram Mini App and try your car.
```

Drive2 case-study post:

```text
I tested an AI wheel preview workflow on a real car photo.

Input:
- side-view car photo;
- front-view wheel photo.

Output:
- before/after preview in Telegram;
- useful for comparing designs before buying.

The June version has a free first render so we can collect feedback on photo
quality, realism, and which wheel styles people want to test.
```

### Metrics dashboard

| Funnel step | Metric | Target signal |
| --- | --- | --- |
| Awareness | Post views/clicks | Which channel sends users who upload. |
| Activation | Mini App opens -> upload starts | Landing clarity. |
| Input quality | Upload starts -> valid submissions | Photo guidance quality. |
| Magic moment | Submitted jobs -> completed renders | Product reliability. |
| Conversion | Trial completed -> checkout opened | Paid intent. |
| Revenue | Checkout opened -> payment success | Pricing fit and payment UX. |
| Retention | Paid users -> second job | Whether credits are useful. |
| Quality | Likes/dislikes and support reports | Render quality and prompt/image issues. |
| Cost | Cost per successful render | Package profitability. |

## 8. UX State Map

| State | User sees | Primary CTA | Backend dependency | Analytics event |
| --- | --- | --- | --- | --- |
| `app_opened` | Landing/upload screen | Upload car photo | Telegram init data available | `app_opened` |
| `not_telegram` | Limited warning | Open in Telegram | Missing init data | `not_telegram_view` |
| `car_empty` | Car upload slot | Choose car photo | Local file validation | `car_upload_start` |
| `car_ready` | Car preview | Upload wheel photo | Local preview URL | `car_upload_success` |
| `wheel_empty` | Wheel upload slot | Choose wheel photo | Local file validation | `wheel_upload_start` |
| `wheel_ready` | Wheel preview | Generate | Local preview URL | `wheel_upload_success` |
| `no_credit_trial_available` | “1 free render available” | Use free render | Trial eligibility check | `trial_offer_view` |
| `no_credit_trial_used` | Credit balance = 0 | Buy credits | Credit balance endpoint | `paywall_view` |
| `checkout_packages` | Start/Pro/Master cards | Buy package | Package catalog endpoint | `checkout_opened` |
| `payment_pending` | Payment in progress | Return to payment/status | Local preorder/payment record | `payment_started` |
| `payment_success` | Credits added | Generate | Payment callback processed | `payment_success` |
| `payment_failed` | Payment not completed | Try again | Payment status endpoint | `payment_failed` |
| `preflight_failed` | Specific fix needed | Fix photo / retry later / buy credits | Auth, validation, rate limit, credit check | `preflight_failed` |
| `job_queued` | Queue status | Wait | Job exists and queued | `job_queued` |
| `job_processing` | Generation progress | Wait | Worker processing | `job_processing` |
| `job_completed_trial` | Watermarked result | Buy credits / share | Completed job + trial flag | `trial_completed` |
| `job_completed_paid` | Result without trial watermark | Try another / share / download | Completed job + paid credit | `paid_render_completed` |
| `job_failed` | Friendly error | Retry/support CTA | Failed job status | `job_failed` |
| `cabinet` | Credits, package history, render history | Buy more / open result | User, credits, payments, jobs | `cabinet_opened` |

UX principles:

- Never let the user reach paid checkout without seeing what credits buy.
- Always explain whether the next generation uses a free trial or a paid credit.
- Show credit balance before and after generation.
- Make payment status recoverable if the user closes Telegram during checkout.
- Show clear photo guidance before errors occur, not only after failure.

## 9. Backend and Frontend Requirement Deltas

### Backend deltas

| Priority | Delta | Purpose |
| --- | --- | --- |
| P0 | Add `users.credit_balance`, `users.trial_used_at`, or equivalent ledger-backed fields. | Enforce one free render and paid credit balance. |
| P0 | Add credit ledger table: purchase, reserve, consume, release/manual-adjustment event types. | Auditable credit accounting and duplicate-tap protection. |
| P0 | Add package catalog endpoint. | Keep checkout packages server-driven for June price changes. |
| P0 | Add payment/preorder status endpoint. | Let Mini App recover from closed or interrupted payment flow. |
| P0 | Add job credit reservation linkage. | Tie each job to trial usage or a paid credit reservation. |
| P0 | Add analytics event ingestion or server-side event logging. | Measure funnel and costs. |
| P1 | Add `is_trial`, `watermarked`, `cost_attempts`, and `quality_feedback` fields to jobs. | Track trial economics and quality. |
| P1 | Add admin/export query for June dashboard. | Daily operating view without exposing secrets. |
| P1 | Add failed-job reason codes. | Improve UX guidance and future credit/refund decisions. |
| P1 | Add configurable free-trial monthly cap. | Control API subsidy if traffic spikes. |

### Frontend deltas

| Priority | Delta | Purpose |
| --- | --- | --- |
| P0 | Add credit balance/cabinet UI. | Users must understand free trial and paid credits. |
| P0 | Add package cards and checkout entry screen. | Present Start, Pro, and Master clearly. |
| P0 | Add payment status screens: pending, success, failed, recover payment. | Prevent abandoned or confusing checkout states. |
| P0 | Add pre-generation confirmation: “This will use your free render/1 credit.” | Avoid accidental spend. |
| P0 | Add trial result watermark handling. | Preserve paid value and support sharing. |
| P1 | Add photo-quality examples and inline upload tips. | Reduce failed renders and support load. |
| P1 | Add render history in cabinet. | Let users reopen/download previous results. |
| P1 | Add analytics events at each UX state. | Measure funnel drop-off. |
| P1 | Add quality feedback text option after dislike. | Diagnose poor outputs. |

### Data model sketch

```text
packages
- id
- code
- title
- price_rub
- credits
- active_from
- active_to
- is_active

credit_ledger
- id
- telegram_user_id
- event_type
- credits_delta
- related_payment_id
- related_job_id
- idempotency_key
- created_at

payments
- id
- telegram_user_id
- package_id
- amount_rub
- status
- provider
- provider_payment_id
- email_hash_or_receipt_ref
- created_at
- paid_at

jobs additions
- credit_ledger_reservation_id
- is_trial
- watermarked
- failure_reason_code
- attempts_count

## 10. Staging Infrastructure Policy

Free-tier infra constraint:

- Upstash Redis free tier gives us only one database in practice for this setup.
- We keep one Redis database and separate staging/prod by key namespace.
- Staging uses a dedicated `REDIS_KEY_PREFIX`, for example `staging:`.
- Staging can also use a separate `REDIS_JOB_QUEUE`, for example `staging:job_queue`.
- This keeps rate limits, idempotency, bot sessions, and worker queue isolated
  even when both environments point to the same Redis database.

Operational rule:

- If `WORKER_ENABLED=false`, upload/render flow is intentionally disabled and
  should return a clear `503` instead of failing with a generic 500.
- To test full image generation in staging, Redis must be configured and the
  worker must be enabled with a staging namespace.
- estimated_external_cost_rub
- feedback_vote
```

Do not store payment credentials, provider passwords, private keys, or personal
legal details in repository documentation or client-side code.
