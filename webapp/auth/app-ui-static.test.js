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
    assert.match(html, /placeholder="name@example\.com"/);
    assert.match(html, /data-auth-send>Получить код/);
    assert.match(html, /class="auth-dialog-divider"/);
    assert.match(html, />или<\/span>/);
    assert.match(html, /data-auth-telegram-label>Продолжить через Telegram/);
    assert.match(html, /data-auth-trust[^>]*>Без пароля\. Код действует 10 минут\./);
    assert.match(html, /legal\/privacy/);
    assert.match(html, /aria-describedby="auth-email-error"/);
    assert.match(html, /data-auth-email-error/);
});

test("OTP auth UI is a single accessible six-digit input with safe resend actions", () => {
    assert.match(html, /data-auth-dialog-title>Войдите в аккаунт/);
    assert.match(html, /data-auth-otp-destination/);
    assert.match(html, /autocomplete="one-time-code"/);
    assert.match(html, /maxlength="6"/);
    assert.match(html, /aria-describedby="auth-otp-error"/);
    assert.match(html, /data-auth-otp-error/);
    assert.match(html, /data-auth-resend-prompt>Не пришёл код\?/);
    assert.match(html, /data-auth-resend>Отправить ещё раз/);
    assert.match(html, /data-auth-change-email>Изменить почту/);
    assert.match(app, /function maskAuthEmail\(email\)/);
    assert.match(app, /authDialogEmailError/);
    assert.match(app, /authDialogOtpError/);
});

test("restore gate keeps the session gate independent from cabinet data", () => {
    assert.match(html, /data-application-auth-gate-spinner/);
    assert.match(app, /restoring: "Открываем приложение…"/);
    assert.match(css, /\.application-auth-gate-spinner/);
    assert.match(css, /prefers-reduced-motion: reduce/);
    const start = app.indexOf("function isApplicationAuthGranted()");
    const end = app.indexOf("\n}\n", start);
    assert.notEqual(start, -1);
    assert.notEqual(end, -1);
    assert.doesNotMatch(app.slice(start, end), /applicationDataReady/);
});
