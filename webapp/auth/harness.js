import {
    AUTH_SESSION_STATES,
    authSessionReady,
    getAuthRuntimeConfig,
    getAuthSessionState,
    getSession,
    refreshSession,
    requestEmailOtp,
    signOut,
    subscribeToAuthChanges,
    verifyEmailOtp,
} from "./supabase-client.js";

const stateLabel = document.querySelector("[data-auth-state]");
const authorityLabel = document.querySelector("[data-auth-authority]");
const sessionLabel = document.querySelector("[data-auth-session]");
const expiryLabel = document.querySelector("[data-auth-expiry]");
const messageLabel = document.querySelector("[data-auth-message]");
const emailForm = document.querySelector("[data-auth-email-form]");
const emailInput = document.querySelector("[data-auth-email]");
const sendButton = document.querySelector("[data-auth-send]");
const otpStep = document.querySelector("[data-auth-otp-step]");
const otpInput = document.querySelector("[data-auth-otp]");
const verifyButton = document.querySelector("[data-auth-verify]");
const resendButton = document.querySelector("[data-auth-resend]");
const cooldownLabel = document.querySelector("[data-auth-cooldown]");

let resendAvailableAt = 0;
let cooldownTimer = null;
let actionBusy = false;

function formatExpiry(value) {
    if (!value) return "—";
    const date = new Date(value * 1000);
    return Number.isNaN(date.getTime()) ? "—" : date.toISOString();
}

function safeMessage(code) {
    return {
        invalid_otp: "The code is incorrect. Check it and try again.",
        expired_otp: "The code has expired. Request a new code.",
        rate_limited: "Too many attempts. Please try again later.",
        network_error: "The authentication service is temporarily unavailable.",
        session_missing: "The code was accepted, but no session was created.",
        provider_error: "The authentication service could not complete this request.",
        unknown: "Check the entered data and try again.",
    }[code] || "The authentication request could not be completed.";
}

function render(state) {
    stateLabel.textContent = `State: ${state.status}`;
    authorityLabel.textContent = `Authority: ${state.sessionPresent ? "Supabase" : "—"}`;
    sessionLabel.textContent = `Session present: ${state.sessionPresent ? "yes" : "no"}`;
    expiryLabel.textContent = `Access token expiry: ${formatExpiry(state.accessTokenExpiresAt)}`;
    if (state.status === AUTH_SESSION_STATES.BOOTSTRAPPING) messageLabel.textContent = "Restoring session…";
}

function setResultMessage(message) {
    messageLabel.textContent = message;
}

function updateCooldown() {
    const remaining = Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));
    const canResend = remaining === 0;
    sendButton.disabled = actionBusy || !canResend;
    resendButton.disabled = actionBusy || !canResend;
    cooldownLabel.textContent = canResend ? "" : `You can request another code in ${remaining}s.`;
    if (canResend && cooldownTimer) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
    }
}

function startCooldown() {
    resendAvailableAt = Date.now() + getAuthRuntimeConfig().resendWindowSeconds * 1000;
    if (!cooldownTimer) cooldownTimer = setInterval(updateCooldown, 1000);
    updateCooldown();
}

function setBusy(busy) {
    actionBusy = busy;
    verifyButton.disabled = busy || !otpInput.value.trim();
    updateCooldown();
}

async function sendCode() {
    const email = emailInput.value.trim();
    setBusy(true);
    setResultMessage("Sending code…");
    try {
        await requestEmailOtp(email);
        otpStep.hidden = false;
        otpInput.focus();
        startCooldown();
        setResultMessage("Code request accepted. Check the email inbox.");
    } catch (error) {
        if (error?.code === "rate_limited") startCooldown();
        setResultMessage(safeMessage(error?.code));
    } finally {
        setBusy(false);
        updateCooldown();
        render(getAuthSessionState());
    }
}

async function verifyCode() {
    setBusy(true);
    setResultMessage("Verifying code…");
    try {
        await verifyEmailOtp(emailInput.value, otpInput.value);
        setResultMessage("Email verified. Supabase session established.");
    } catch (error) {
        setResultMessage(safeMessage(error?.code));
    } finally {
        setBusy(false);
        render(getAuthSessionState());
    }
}

emailForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void sendCode();
});
resendButton.addEventListener("click", () => void sendCode());
otpInput.addEventListener("input", () => {
    verifyButton.disabled = !otpInput.value.trim();
});
document.querySelector("[data-auth-verify-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!verifyButton.disabled) void verifyCode();
});

document.querySelector("[data-auth-read]").addEventListener("click", async () => {
    setResultMessage("Reading session…");
    try {
        await getSession();
        setResultMessage("Current session read.");
    } catch (error) {
        setResultMessage(safeMessage(error?.code));
    }
    render(getAuthSessionState());
});
document.querySelector("[data-auth-refresh]").addEventListener("click", async () => {
    setResultMessage("Refreshing session…");
    try {
        await refreshSession();
        setResultMessage("Session refreshed.");
    } catch (error) {
        setResultMessage(safeMessage(error?.code));
    }
    render(getAuthSessionState());
});
document.querySelector("[data-auth-signout]").addEventListener("click", async () => {
    setResultMessage("Signing out…");
    try {
        await signOut();
        otpInput.value = "";
        otpStep.hidden = true;
        setResultMessage("Signed out. Persistent Supabase session removed by the SDK.");
    } catch (error) {
        setResultMessage(safeMessage(error?.code));
    }
    render(getAuthSessionState());
});

subscribeToAuthChanges((state) => render(state));
render(getAuthSessionState());
void authSessionReady.then(render);

if (getAuthSessionState().status === AUTH_SESSION_STATES.BOOTSTRAPPING) render(getAuthSessionState());
