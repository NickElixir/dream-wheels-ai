# P2-A terminology audit

Base: staging `cd414ff086931c4c44f6d00eb674f5e4fccbc1c7`.
Scope: catalogue/presentation consistency, not new product copy or behavior.
The table records decisions before changing the corresponding group. Statuses
apply to presentation concepts; no reachability/deletion claim is made in P2-A.

| Concept | RU variants | EN variants at base | Intended canonical | Action / semantic reason |
|---|---|---|---|---|
| Account login | Войти; Подготавливаем вход; Входим | Sign in / Log in; Preparing login / Preparing sign-in; Logging in | Sign in; Preparing sign-in…; Signing in… | UNIFY: same auth action/progress; `auth.login`, `legacy.auth.loginShort`, `legacy.auth.verify`, `legacy.auth.preparing`, `account.link.preparing`. Login/logout authority and provider names are unchanged. |
| Balance page | Баланс | Balance / Wallet | Balance | UNIFY: `nav.wallet`, `legacy.menu.wallet`, `legacy.caption.wallet`, `legacy.wallet.title`, `legacy.wallet.balanceLabel` all name the same balance destination. Wallet remains the route/module identifier. |
| Account label | Кабинет | Cabinet / Account | Account | UNIFY: `legacy.wallet.eyebrow`, `account.cabinet`, `legacy.wallet.loading` and `legacy.settings.eyebrow` identify the account context, not its numerical balance. |
| Create try-on action | Создать примерку / Создать виртуальную примерку | Create a try-on / Create virtual render | Create a try-on | UNIFY EN: `nav.create`, `legacy.menu.create`, `legacy.caption.create`, `legacy.create.title`, `legacy.create.createRender` start the same generation flow. Preserve approved RU text and shortened mobile Create label. |
| History | История; История платежей; История пополнений | History / Payment history / Top-up history | History for try-ons; Payment history / Top-up history for money | KEEP DISTINCT: `nav.history`, `legacy.menu.renders`, `legacy.caption.renders`, `legacy.renders.title` already agree. Financial histories remain explicitly qualified; no blanket history replacement. |
| Wheel | Диск; Колесо; Параметры колёс | Wheel / Rim | Existing technical Wheel vocabulary; rim remains API/form identifier | KEEP DISTINCT: wheel assembly vs rim identity/technical paths cannot be merged by word replacement. No technical glossary, SKU, provider/user labels or numeric fields changed. |
| Vehicle version | Комплектация | Vehicle version / Trim | Vehicle version | UNIFY: `fitment.vehicleVersion2` and `legacy.fitment.modification` label the same selected variant/version picker. Provider trim names remain data. |
| Technical compatibility page | Совместимость | Compatibility / Fitment | Compatibility | UNIFY: `page.fitment` and `legacy.caption.fitment` name the same destination; route stays fitment. |
| Technical compatibility heading | Проверка совместимости | Compatibility check / Fitment preparation | Compatibility check | UNIFY: `fitment.compatibilityCheck` and `legacy.fitment.eyebrow` label the technical check workspace. No verdict or check-start semantics change. |
| Field / verdict / photo quality | Подходит | Matches / Compatible / Works well | Existing context-specific words | KEEP DISTINCT: `fitment.row.matches` is one field; `fitment.compatible` is a verdict; `legacy.photoGuide.carGoodLabel` assesses photo quality. Same RU token does not imply same concept. |
| Vehicle photo | Фото автомобиля | Vehicle photo / Car photo | Vehicle photo | UNIFY: `create.vehiclePhoto`, `legacy.create.carPhoto`, `legacy.photoGuide.carSection` refer to the same input image type. |
| Full vehicle visible | Автомобиль виден целиком | The whole vehicle is visible / The whole car is visible | The whole vehicle is visible | UNIFY: `photoguide.theWholeCarIsVisible` and `legacy.photoGuide.carCheck1` are the same photo requirement. |
| Replace vehicle photo | Заменить фото автомобиля | Replace vehicle photo / Replace car photo | Replace vehicle photo | UNIFY: `legacy.create.replaceCar` and `generation.error.vehicle.replace` invoke the same car-photo replacement action. |
| Short wait hint | Это может занять до 90 секунд | This may take up to 90 seconds / This can take up to 90 seconds | This may take up to 90 seconds. | UNIFY: `create.thisMayTakeUpToSeconds`, `render.thisCanTakeUpToSeconds`, `legacy.status.upTo90` express the same ceiling; no timeout changes. The separate 1–2 minute hint remains unchanged. |
| Hero fragment | Примерьте | Try / Try on | Existing complete hero composition | KEEP DISTINCT: `dashboard.try` and `legacy.dashboard.titleLine1` are different phrase fragments/compositions; do not revise approved P1 hero wording. |
| Recheck vs recognition recovery | Проверить ещё раз | Check again / Retry | Check again / Retry | KEEP DISTINCT: `fitment.checkAgain` reruns a technical check, while `legacy.errors.identityRetryAction` recovers identity recognition. |
| Refund document link | Условия возврата | Refund terms / Refund Terms | Refund terms | UNIFY: `documents.refundTerms`, `legacy.wallet.refundLink`, `legacy.support.refundTitle`, `legacy.docs.refund` open the same legal-document kind. No legal document contents changed. |
| Photo guide title/caption | Как подготовить фото | How to prepare photos / How to prepare a photo | How to prepare photos | UNIFY: `nav.photoGuide`, `legacy.caption.photoGuide`, `legacy.photoGuide.title`, `legacy.support.photoGuideTitle` name the same multi-photo guide. |
| Compact guide menu label | Как подготовить фото | Photo guide | Photo guide | KEEP DISTINCT: `legacy.menu.photoGuide` is a compact navigation label; preserve deliberate abbreviation rather than force longer heading copy. |
| Session error heading vs notice | Сессия истекла | Session expired / Your session has expired. | Existing heading / complete sentence | KEEP DISTINCT: `legacy.auth.sessionExpiredTitle` is a heading, `auth.sessionExpired` is a sentence; punctuation/grammar serve different contracts. |
| Refresh job vs invoice | Обновить статус | Refresh status / Refresh invoice | Existing job status / invoice action | KEEP DISTINCT: `action.refreshStatus` and `legacy.wallet.refreshInvoice` address different resources. No payment refresh semantics change. |
| Identity link status | Подключено | Connected / Linked | Linked | UNIFY: `legacy.settings.linked` and `account.settings.linked` describe an already linked login identity. |
| Generated visual progress | Создаём примерку | Generating render | Creating the try-on… | UNIFY EN: `render.generatingRender` and `legacy.status.generating` describe the visual try-on generation, not a balance unit. |
| Credits vs visual result | Рендер / Примерка | Render(s) / Try-on | Render(s) for credit units; try-on for the visual workflow | KEEP DISTINCT: credit counts, expiry, billed events and financial/audit copy retain render terminology. No regex-wide render→try-on rewrite; other approved result wording remains unchanged. |
| Legacy-only server/upload/payment progress | Запускаем сервер; Загружаем файлы; Обновляем статус оплаты | Starting server; Uploading files; Refreshing invoice status | Existing wording with … | LEGACY-ONLY: preserve compatibility copy; normalize only its ellipsis. P2-B will determine reachability before any deletion. |

## Ellipsis boundary

Thirteen controlled COPY entries contain `...` at base. Normalize their RU/EN
progress text to `…`. Replace the one inline dashboard loading fallback with its
existing `legacy.wallet.loading` key using the existing data-i18n adapter. Do not
rewrite user/provider text, URLs, JS spread syntax, or archived E-01 evidence.

## Semantic catalogue contract

Keep the digest as a secondary detector. Add structured checks for required legacy
groups, matching RU/EN leaf paths, the seven known intentional empty slots, every
legacy leaf being derived from COPY, canonical concept keys and deliberate
non-equivalence. Keep missing/prototype-key, dynamic-key, escaping, authoritative
Fitment reasons and user/provider data tests intact.
