export function legacyNavigate(view) {
  window.DreamWheelsLegacy?.navigate?.(view);
}

export function legacyOpenExternal(url) {
  window.DreamWheelsLegacy?.openExternal?.(url) || window.open(url, "_blank", "noopener,noreferrer");
}
