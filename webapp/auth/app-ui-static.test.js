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

test("VNext Wallet owns the visible Balance surface while runtime retains payment actions", () => {
    const view = fs.readFileSync(path.join(webappRoot, "vnext/views/wallet.js"), "utf8");
    const walletCss = fs.readFileSync(path.join(webappRoot, "vnext/styles/wallet.css"), "utf8");
    assert.match(html, /data-view="wallet" hidden><\/section>/);
    assert.match(html, /vnext\/styles\/wallet\.css/);
    assert.match(view, /История пополнений/);
    assert.match(view, /Email для чека/);
    assert.match(view, /legal\.dreamwheels\.pro/);
    assert.match(view, /data-wallet-pending/);
    assert.match(walletCss, /\.vnext-wallet__history-row/);
    assert.doesNotMatch(view, /fetch\(|setTimeout\(|payment_url|pricing_version|balance\s*[+\-]=/);
    assert.match(app, /window\.dreamwheelsWalletBridge =/);
    assert.match(app, /function paymentReturnContext\(\)/);
    assert.match(app, /function schedulePendingInvoiceRefresh\(\)/);
});

test("vehicle proposals require explicit confirmation and preserve provenance", () => {
    assert.match(html, /data-manual-vehicle-toggle/);
    assert.match(html, /Не подходит\? Указать вручную/);
    assert.match(html, /data-manual-vehicle-back/);
    assert.match(app, /selectedVehicleIndex: null/);
    assert.match(app, /state\.selectedVehicleIndex = null/);
    assert.match(app, /vehicle_user_confirmed: true/);
    assert.doesNotMatch(app, /vehicle: \{ \.\.\.selectedVehicle, source: "user_confirmed", confidence: 1 \}/);
    assert.match(app, /source: "user_input"/);
    assert.match(app, /manualVehicleMode/);
});

test("visibility changes do not reload the active app view", () => {
    const visibilityHandler = app
        .split('document.addEventListener("visibilitychange"')[1]
        .split('window.addEventListener("pagehide"', 1)[0];
    assert.doesNotMatch(visibilityHandler, /checkCurrentBuild/);
    assert.match(app, /void checkCurrentBuild\(\);/);
});
