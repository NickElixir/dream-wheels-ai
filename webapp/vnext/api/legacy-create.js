function legacyBridge() {
  return window.DreamWheelsLegacy || null;
}

export function legacyCreateSnapshot() {
  return legacyBridge()?.createSnapshot?.() || {
    draftId: "",
    consentAccepted: false,
    identityResolving: false,
    identityError: "",
    parserStatus: "idle",
    parserError: "",
    vehicle: null,
    rim: null,
    vehiclePreviewUrl: "",
    wheelPreviewUrl: "",
    hasCarFile: false,
    hasWheelFile: false,
    canCreate: false,
    canCheckFitment: false,
  };
}

export function legacyCreateActions() {
  return {
    selectFile(kind, file) {
      legacyBridge()?.selectCreateFile?.(kind, file);
    },
    clearFile(kind) {
      legacyBridge()?.clearCreateFile?.(kind);
    },
    setPhotoConsent(accepted) {
      legacyBridge()?.setCreatePhotoConsent?.(accepted);
    },
    resolveIdentity() {
      return legacyBridge()?.resolveCreateIdentity?.();
    },
    refreshWheelUrl(productUrl) {
      return legacyBridge()?.refreshCreateWheelUrl?.(productUrl);
    },
    saveVehicle(fields) {
      legacyBridge()?.saveCreateVehicle?.(fields);
    },
    saveWheel(fields) {
      legacyBridge()?.saveCreateWheel?.(fields);
    },
    createImage() {
      return legacyBridge()?.createImage?.();
    },
    checkCompatibility() {
      return legacyBridge()?.checkCreateCompatibility?.();
    },
    openExternal(url) {
      legacyBridge()?.openExternal?.(url);
    },
  };
}
