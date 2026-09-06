// Public browser configuration for the staging Auth harness and Slice 6A.
// Never put SMTP credentials, Turnstile secrets, service-role keys, or JWT
// secrets in this file.
globalThis.__DREAM_WHEELS_SUPABASE_CONFIG__ = Object.freeze({
    url: "https://hnawojlnfoaccinlgjyn.supabase.co",
    publishableKey: "sb_publishable_d5olG8YKefa0N_1gz99X0w_qa6zdbTf",
});

globalThis.__DREAM_WHEELS_AUTH_CONFIG__ = Object.freeze({
    site: "ru",
    otpLength: 6,
    resendWindowSeconds: 60,
    turnstileSiteKey: "0x4AAAAAAEpc6oyj1KFbS7FR",
    analyticsEndpoint: "/api/backend/analytics/events",
    // Main WebApp Auth is enabled only on the canonical staging host and the
    // integration branch preview host allowlist in app-auth.js.
    mainWebAppEnabled: true,
});
