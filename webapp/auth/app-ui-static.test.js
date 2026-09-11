import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const webappRoot = path.resolve(import.meta.dirname, "..");
const html = fs.readFileSync(path.join(webappRoot, "index.html"), "utf8");
const css = fs.readFileSync(path.join(webappRoot, "style.css"), "utf8");
const app = fs.readFileSync(path.join(webappRoot, "app.js"), "utf8");

test("Release 1 email auth UI exposes the approved controls and copy", () => {
    assert.match(html, /DREAM<\/span><span class="brand-dim">WHEELS AI/);
    assert.match(html, /data-auth-dialog-title>Войдите в аккаунт/);
    assert.match(html, /data-auth-description-line1>Введите электронную почту/);
    assert.match(html, /data-auth-description-line2>Мы пришлём код для входа/);
    assert.doesNotMatch(html, /Введите электронную почту —/);
    assert.match(html, /placeholder="name@example\.com"/);
    assert.match(html, /data-auth-send>Получить код/);
    assert.match(html, /class="auth-dialog-divider"/);
    assert.match(html, />или<\/span>/);
    assert.match(html, /data-auth-telegram-label>Продолжить через Telegram/);
    assert.doesNotMatch(html, /Без пароля\. Код действует 10 минут\./);
    assert.match(html, /legal\/privacy/);
    assert.match(html, /aria-describedby="auth-email-error"/);
    assert.match(html, /data-auth-email-error/);
});

test("OTP auth UI is a single accessible six-digit input with safe resend actions", () => {
    assert.match(app, /otpTitle: "Проверьте почту"/);
    assert.match(app, /otpSentTo: "Мы отправили код на"/);
    assert.match(html, /data-auth-otp-destination/);
    assert.match(html, /autocomplete="one-time-code"/);
    assert.match(html, /inputmode="numeric"/);
    assert.match(html, /maxlength="6"/);
    assert.match(html, /aria-describedby="auth-otp-error"/);
    assert.match(html, /data-auth-otp-error/);
    assert.match(html, /data-auth-resend-prompt>Не пришёл код\?/);
    assert.match(html, /data-auth-resend>Отправить ещё раз/);
    assert.match(html, /data-auth-change-email>Изменить почту/);
    assert.match(app, /resendIn: "Отправить ещё раз через \{seconds\} сек"/);
    assert.match(app, /state\.authDialogStep = "change-email"/);
    assert.match(html, /data-auth-back-to-otp/);
    assert.match(app, /state\.authDialogEmail = state\.authDialogChangeEmailOriginal/);
    assert.match(app, /state\.authDialogOtp = state\.authDialogOtpBeforeChange/);
    assert.doesNotMatch(`${html}\n${app}`, /Код отправлен\. Проверьте почту/);
    assert.match(app, /function maskAuthEmail\(email\)/);
    assert.match(app, /authDialogEmailError/);
    assert.match(app, /authDialogOtpError/);
});

test("authenticated account and logout surfaces expose provider-aware safe actions", () => {
    assert.match(html, /data-auth-restored-avatar/);
    assert.match(html, /data-auth-restored-name/);
    assert.match(html, /data-auth-restored-provider/);
    assert.match(html, /data-auth-switch>Сменить аккаунт/);
    assert.match(html, /data-logout-dialog/);
    assert.match(html, /data-logout-title>Выйти из аккаунта\?/);
    assert.match(html, /data-logout-description>После выхода потребуется снова войти/);
    assert.match(html, /data-logout-cancel>Отмена/);
    assert.match(html, /data-logout-confirm>Выйти/);
    assert.match(app, /providerTelegram: "Telegram"/);
    assert.match(app, /providerEmail: "Email"/);
    assert.match(app, /function openLogoutDialog\(\)/);
    assert.match(app, /function confirmLogout\(\)/);
    assert.match(app, /if \(isFrontendUserAuthenticated\(\)\) \{\s+openLogoutDialog\(\);/);
    assert.doesNotMatch(`${html}\n${app}`, /В этой вкладке уже есть действующий вход/);
    assert.doesNotMatch(`${html}\n${app}`, /Войти \/ сменить аккаунт/);
});

test("restore gate keeps the session gate independent from cabinet data", () => {
    assert.match(html, /data-application-auth-gate-spinner/);
    assert.match(app, /restoring: "Открываем приложение…"/);
    assert.match(css, /\.application-auth-gate-spinner/);
    assert.match(css, /\.auth-turnstile:has\(iframe\)/);
    assert.match(css, /prefers-reduced-motion: reduce/);
    const start = app.indexOf("function isApplicationAuthGranted()");
    const end = app.indexOf("\n}\n", start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    assert.doesNotMatch(app.slice(start, end), /applicationDataReady/);
});

test("wallet polish separates credits from payment history and keeps checkout explicit", () => {
    assert.match(html, /data-wallet-topup/);
    assert.match(html, /data-i18n="wallet\.creditsTitle">Ваши рендеры/);
    assert.doesNotMatch(html, /Ваши credits/);
    assert.match(html, /data-i18n="wallet\.topUpHistory">История пополнений/);
    assert.match(html, /data-i18n="wallet\.emailHint">Чек будет отправлен на этот email/);
    assert.match(html, /data-i18n="wallet\.privacyDetails">Подробнее — в Политике обработки персональных данных/);
    assert.match(html, /data-pay-button disabled data-i18n="wallet\.choosePackage">Выберите пакет/);
    assert.doesNotMatch(html, /class="topup-icon"/);
    assert.doesNotMatch(html, /data-topup-amount="(?:100|200|500|1000)"[\s\S]{0,220}[⚡🏁💎👑]/u);
    assert.match(app, /selectedAmount: null/);
    assert.match(app, /receiptEmailTouched: false/);
    assert.match(app, /function syncReceiptEmailForAuth\(\)/);
    assert.match(app, /receiptEmailDefault\(\)/);
    assert.doesNotMatch(app, /const rememberedEmail = state\.payments/);
    assert.match(app, /state\.receiptEmailTouched = true/);
    assert.match(app, /paySelected: "Оплатить \{amount\}"/);
    assert.match(app, /const topUpPackage = getTopUpPackage\(state\.selectedAmount\)/);
});

test("wallet payment summaries use layout elements instead of punctuation separators", () => {
    assert.match(html, /payment-card-top/);
    assert.match(html, /data-last-invoice-amount/);
    assert.match(html, /data-last-invoice-renders/);
    assert.match(html, /data-last-invoice-date/);
    assert.match(html, /data-last-invoice-number-meta/);
    assert.match(html, /data-last-invoice-status-detail/);
    assert.doesNotMatch(html, /data-last-invoice-state/);
    assert.match(html, /data-topup-summary-values/);
    assert.match(app, /payment-history-renders/);
    assert.match(app, /payment-history-meta/);
    assert.match(app, /packageDuration:/);
    assert.doesNotMatch(`${html}\n${app}`, /0 ₽ — \+0 рендеров/);
    assert.doesNotMatch(app, /— \+\$\{formatRenderCount\(lastInvoice\.credits\)\}/);
    assert.doesNotMatch(app, /— \+\$\{formatRenderCount\(item\.credits\)\}/);
    assert.doesNotMatch(app, /formatTemplate\("wallet\.packageSummary"/);
    assert.doesNotMatch(app, /data-last-invoice-date[^\n]*—/);
    assert.doesNotMatch(app, /data-last-invoice-number-meta[^\n]*·/);
    assert.doesNotMatch(`${html}\n${app}`, /invoiceState/);
    assert.match(app, /formatPaymentStatus\(lastInvoice\.status\)/);
    assert.match(app, /telegramUser\?\.id \|\| state\.websiteAuth\?\.telegramUserId \|\| state\.websiteAuth\?\.username/);
    assert.doesNotMatch(`${html}\n${app}`, /\b\+\$\{formatRenderCount/);
});

test("wallet spacing and payment statuses keep their visual alignment", () => {
    assert.match(css, /\.wizard-panel\s*\{[\s\S]*?gap: 14px;[\s\S]*?padding: 20px 24px;/);
    assert.match(css, /\.topup-wizard\s*\{[\s\S]*?gap: 12px;/);
    assert.match(css, /\.payment-card-top\s*\{[\s\S]*?align-items: center;/);
    assert.match(css, /\.payment-card-top \.status-pill,\s*\.payment-history-item \.status-pill\s*\{[\s\S]*?align-self: center;/);
});

test("latest payment status and details action use the compact card treatment", () => {
    assert.match(css, /\.last-invoice-panel \.payment-card\s*\{[\s\S]*?position: relative;[\s\S]*?padding-right: 190px;/);
    assert.match(css, /\.last-invoice-panel \.payment-card-top \.status-pill\s*\{[\s\S]*?position: absolute;[\s\S]*?top: 50%;[\s\S]*?transform: translateY\(-50%\);/);
    assert.match(css, /\.latest-payment-details\s*\{[\s\S]*?width: fit-content;[\s\S]*?max-width: 100%;/);
    assert.match(css, /\.latest-payment-details-toggle\s*\{[\s\S]*?display: inline-flex;[\s\S]*?justify-self: start;[\s\S]*?width: fit-content;[\s\S]*?min-height: 44px;/);
    assert.match(css, /\.latest-payment-details\[open\]\s*\{[\s\S]*?width: 100%;/);
});

test("visibility changes do not reload the active app view", () => {
    const visibilityHandler = app
        .split('document.addEventListener("visibilitychange"')[1]
        .split('window.addEventListener("pagehide"', 1)[0];
    assert.doesNotMatch(visibilityHandler, /checkCurrentBuild/);
    assert.match(app, /void checkCurrentBuild\(\);/);
});
