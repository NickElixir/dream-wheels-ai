export function legacyNavigate(view) {
  window.DreamWheelsLegacy?.navigate?.(view);
}

export function legacyOpenExternal(url) {
  const openExternal = window.DreamWheelsLegacy?.openExternal;
  if (typeof openExternal === "function") {
    openExternal(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
