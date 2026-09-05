import {
    AUTH_SESSION_STATES,
    authSessionReady,
    getAuthSessionState,
    getSession,
    refreshSession,
    signOut,
    subscribeToAuthChanges,
} from "./supabase-client.js";

const stateLabel = document.querySelector("[data-auth-state]");
const authorityLabel = document.querySelector("[data-auth-authority]");
const sessionLabel = document.querySelector("[data-auth-session]");
const expiryLabel = document.querySelector("[data-auth-expiry]");
const messageLabel = document.querySelector("[data-auth-message]");

function formatExpiry(value) {
    if (!value) return "—";
    const date = new Date(value * 1000);
    return Number.isNaN(date.getTime()) ? "—" : date.toISOString();
}

function render(state) {
    stateLabel.textContent = `State: ${state.status}`;
    authorityLabel.textContent = `Authority: ${state.sessionPresent ? "Supabase" : "—"}`;
    sessionLabel.textContent = `Session present: ${state.sessionPresent ? "yes" : "no"}`;
    expiryLabel.textContent = `Access token expiry: ${formatExpiry(state.accessTokenExpiresAt)}`;
    messageLabel.textContent = state.errorCode ? `Status: ${state.errorCode}` : "";
}

async function run(action) {
    messageLabel.textContent = "Working…";
    try {
        await action();
    } catch (error) {
        messageLabel.textContent = "Action failed without exposing session details.";
    }
    render(getAuthSessionState());
}

document.querySelector("[data-auth-read]").addEventListener("click", () => run(getSession));
document.querySelector("[data-auth-refresh]").addEventListener("click", () => run(refreshSession));
document.querySelector("[data-auth-signout]").addEventListener("click", () => run(signOut));

subscribeToAuthChanges((state) => render(state));
render(getAuthSessionState());
void authSessionReady.then(render);

if (getAuthSessionState().status === AUTH_SESSION_STATES.BOOTSTRAPPING) {
    render(getAuthSessionState());
}
