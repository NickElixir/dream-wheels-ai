import { copy as uiText, applicationLocale } from "../copy.mjs";
const emptyDashboard = (locale) => Object.freeze({
  locale,
  balance: null,
  balanceLabel: uiText("shell.renders", locale),
  expiry: [],
  expiryNote: "",
  loading: false,
  error: "",
  authenticated: false,
  partialAuth: false,
  latest: null,
  recent: [],
});

export function legacyDashboardSnapshot() {
  return window.DreamWheelsLegacy?.dashboardSnapshot?.() || emptyDashboard(applicationLocale());
}

export function legacyOpenRenderDetail(jobId) {
  if (jobId) window.DreamWheelsLegacy?.openRenderDetail?.(jobId);
}

export function legacyOpenAuth() {
  window.DreamWheelsLegacy?.openAuth?.();
}
