# UI_CHANGE_MANIFEST — PR6 Balance and migration cutover

## Authority

PR6 brief; approved VNext amendment of 2026-09-27; frozen VNext Design Code v0.1, especially Balance title, conditional pending island, and payment history; canonical prototype v3. No unspecified design decisions were introduced.

## User-visible changes

| Change | Source authority |
| --- | --- |
| One `Баланс` page title, available render count, expiry rows, top-up, and history in that order | PR6 §§6–9; frozen VNext Balance |
| Package selection with restrained selected state and inline email validation | PR6 §§10–13 |
| Conditional pending payment island and plain-text paid/failed history statuses | PR6 §§16–23; frozen VNext refinement |
| Quiet loading, cabinet error/retry, expired-session recovery, empty history | PR6 §§24–26 |
| Progressive `Показать ещё` history in place of page controls | PR6 §22 |
| Existing Robokassa, legal routes, and desktop/mobile navigation remain available | PR6 §§13–15, 28–29 |

## Removed presentation

- Replaced the Wallet DOM island/wizard/history markup in `webapp/index.html` with an empty VNext host.
- Removed the Wallet-only DOM rendering and event listeners from `webapp/app.js`; payment actions and state remain there.
- Replaced the permanent latest-invoice card, status pills, heavy wizard steps, and history pager with VNext presentation.

## Interaction changes

- Package choice only selects the existing runtime package; payment starts only from the explicit CTA.
- History expands in place using existing client history state and cabinet data.
- Pending invoice refresh still delegates to `loadCabinet()` and its existing timer.

## Runtime boundary

`GET /payments/cabinet`, `POST /payments/topups`, `paymentReturnContext()`, `openPaymentUrl()`, `createPayment()`, `handlePaymentReturn()`, `schedulePendingInvoiceRefresh()`, credit package ordering, and Dashboard balance state stay in `webapp/app.js`. The VNext view receives a snapshot and callbacks and makes no network request or payment-status inference.

## Cutover audit

| Surface | Route/VNext owner | Runtime owner retained |
| --- | --- | --- |
| Dashboard | `dashboard` / `vnext/views/dashboard.js` | cabinet and render history |
| Create | `create` / `vnext/views/create.js` | identity, upload, render submission |
| Processing, Result, History | `create`, `render-detail`, `renders` / `vnext/views/render.js` | job polling, download, feedback |
| Fitment | `fitment` / `vnext/views/fitment.js` | catalogue, resolver, check, revision |
| Balance | `wallet` / `vnext/views/wallet.js` | cabinet, payments, pending refresh |
| Auth | shared VNext auth shell | session and protected API boundary |
| Support, Photo Guide, Documents | `support`, `photo-guide`, `docs` / VNext views | navigation and legal URL handlers |

All listed top-level views are in the VNext registry. The replaced Wallet markup is no longer reachable. Existing route/navigation and surface tests remain part of the full frontend suite. The retained presentation fixture at `tests/browser-fixtures/vnext-wallet-qa.html` makes wallet states reproducible without touching a real invoice or payment provider.

## Verification boundary

The pre-merge browser pass covers loading, normal balance/expiry, selected package, invalid email, pending, paid, failed, empty history, cabinet error, and expired-session presentation at 1440×1000, 1024×768, 768×844, and 390×844. It is a local presentation fixture using the actual VNext shell and Wallet modules, not an authenticated staging payment test. The latter remains post-merge and must not initiate a real payment without a confirmed sandbox environment.

## Independent review correction

The first exact-HEAD review found three presentation gaps. The selected-package summary now retains the runtime's 30-day validity label; ordinary pending guidance appears only in its conditional island; and initial cabinet loading no longer displays an empty-history claim before history loads. Follow-up review also identified the same misleading claim after session expiry; history stays quiet until authentication returns. The payment API and state ownership did not change.

## Known issue

`FITMENT-POST-PR6-01` is recorded in [post-migration known issues](vnext-post-migration-known-issues.md). PR6 does not edit Fitment progression.

## Unspecified design decisions

NONE.
