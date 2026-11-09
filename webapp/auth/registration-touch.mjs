const KEY = "dreamWheelsRegistrationTouch:v1";
const TTL = 24 * 60 * 60 * 1000;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
let memory = null;

export function captureRegistrationTouch() {
    const location = globalThis.location;
    if (!location?.href) return;
    const url = new URL(location.href);
    const source = url.searchParams.get("registration_source");
    const locale = url.searchParams.get("registration_locale");
    if (!["landing", "catalog"].includes(source) || !["ru", "en"].includes(locale)) return;
    memory = { source, locale, touched_at: new Date().toISOString() };
    for (const key of UTM_KEYS) {
        const value = url.searchParams.get(key)?.trim().slice(0, 200);
        if (value) memory[key] = value;
    }
    try {
        globalThis.localStorage.setItem(KEY, JSON.stringify(memory));
        url.searchParams.delete("registration_source");
        url.searchParams.delete("registration_locale");
        globalThis.history.replaceState(globalThis.history.state, "", url);
    } catch {
        // Keep the attribution in memory if browser storage is unavailable.
    }
}

export function registrationTouchPayload() {
    captureRegistrationTouch();
    let touch = memory;
    try {
        touch = JSON.parse(globalThis.localStorage.getItem(KEY) || "null") || touch;
    } catch {
        // The current tab can still complete sign-in using its in-memory touch.
    }
    const age = Date.now() - Date.parse(touch?.touched_at);
    if (!(age >= 0 && age <= TTL)) return null;
    // HTTP header values must be byte-safe, including for Cyrillic UTM values.
    return JSON.stringify(touch).replace(/[^\x20-\x7e]/g, char =>
        "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"));
}
