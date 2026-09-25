const emptyDashboard = Object.freeze({
  balance: null,
  balanceLabel: "0 рендеров",
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
  return window.DreamWheelsLegacy?.dashboardSnapshot?.() || emptyDashboard;
}

export function legacyOpenRenderDetail(jobId) {
  if (jobId) window.DreamWheelsLegacy?.openRenderDetail?.(jobId);
}

export function legacyOpenAuth() {
  window.DreamWheelsLegacy?.openAuth?.();
}
