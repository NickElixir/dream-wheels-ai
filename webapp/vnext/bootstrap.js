import { legacyDashboardSnapshot, legacyOpenAuth, legacyOpenRenderDetail } from "./api/legacy-dashboard.js";
import { legacyNavigate, legacyOpenExternal } from "./api/legacy-navigation.js";
import { documentsViewModel } from "./models/documents.js";
import { photoGuideViewModel } from "./models/photo-guide.js";
import { supportViewModel } from "./models/support.js";
import { createAppShell } from "./shell/app-shell.js";
import { createDashboardView } from "./views/dashboard.js";
import { createCreateView, refreshCreateView } from "./views/create.js";
import { createDocumentsView } from "./views/documents.js";
import { createPhotoGuideView } from "./views/photo-guide.js";
import { createSupportView } from "./views/support.js";

const migratedViews = new Set(["dashboard", "create", "support", "photo-guide", "docs"]);
let mountedRoot = null;
let mountedView = "";
let mountedCreateContent = null;

function createCallbacks() {
  return {
    openAuth: legacyOpenAuth,
    pickFile: (kind) => window.dreamwheelsCreateBridge?.pickFile(kind),
    clearFile: (kind) => window.dreamwheelsCreateBridge?.clearFile(kind),
    resolveIdentity: () => window.dreamwheelsCreateBridge?.resolveIdentity(),
    createImage: () => window.dreamwheelsCreateBridge?.createImage(),
    checkCompatibility: () => window.dreamwheelsCreateBridge?.checkCompatibility(),
    handleGenerationError: () => window.dreamwheelsCreateBridge?.handleGenerationError(),
    handleIdentityError: () => window.dreamwheelsCreateBridge?.handleIdentityError(),
    setConsent: (checked) => window.dreamwheelsCreateBridge?.setConsent(checked),
    chooseVehicle: (index) => window.dreamwheelsCreateBridge?.chooseVehicle(index),
    setVehicleEditing: (enabled) => window.dreamwheelsCreateBridge?.setVehicleEditing(enabled),
    cancelVehicleEditing: () => window.dreamwheelsCreateBridge?.cancelVehicleEditing(),
    setSourceEditing: (enabled) => window.dreamwheelsCreateBridge?.setSourceEditing(enabled),
    saveRimProductUrl: (value) => window.dreamwheelsCreateBridge?.saveRimProductUrl(value),
    retryRimSource: () => window.dreamwheelsCreateBridge?.retryRimSource(),
    manualRimRecovery: () => window.dreamwheelsCreateBridge?.manualRimRecovery(),
    saveManualVehicle: (values) => window.dreamwheelsCreateBridge?.saveManualVehicle(values),
    setManualVehicleMode: (enabled) => window.dreamwheelsCreateBridge?.setManualVehicleMode(enabled),
    retryIdentity: () => window.dreamwheelsCreateBridge?.resolveIdentity(),
  };
}

function renderCreate() {
  const bridge = window.dreamwheelsCreateBridge;
  if (!mountedCreateContent || !bridge) return;
  mountedCreateContent = refreshCreateView(mountedCreateContent, bridge.snapshot(), createCallbacks());
}

function surfaceDescriptor(view) {
  if (view === "dashboard") {
    return {
      title: "Главная",
      content: createDashboardView(legacyDashboardSnapshot(), {
        navigate: legacyNavigate,
        openRenderDetail: legacyOpenRenderDetail,
        openAuth: legacyOpenAuth,
      }),
    };
  }
  if (view === "create") {
    return {
      title: "Примерить диски",
      content: createCreateView(window.dreamwheelsCreateBridge?.snapshot() || {}, createCallbacks()),
    };
  }
  if (view === "support") {
    const model = supportViewModel();
    return { title: model.title, content: createSupportView(model, { navigate: legacyNavigate }) };
  }
  if (view === "photo-guide") {
    const model = photoGuideViewModel();
    return { title: model.title, content: createPhotoGuideView(model) };
  }
  if (view === "docs") {
    const model = documentsViewModel();
    return { title: model.title, content: createDocumentsView(model, { openExternal: legacyOpenExternal }) };
  }
  return null;
}

function unmountSurface() {
  document.body.classList.remove("vnext-surface-active");
  if (mountedRoot) {
    if (mountedView === "create") {
      mountedRoot.querySelector(":scope > [data-vnext-create-root]")?.remove();
      const screen = window.dreamwheelsCreateBridge?.snapshot().createScreen;
      [...mountedRoot.children].forEach((child) => {
        if (child.dataset.createScreen) child.hidden = child.dataset.createScreen !== screen;
      });
    } else {
      mountedRoot.replaceChildren();
      delete mountedRoot.dataset.vnextRoot;
    }
  }
  mountedRoot = null;
  mountedView = "";
  mountedCreateContent = null;
}

function mountSurface(view, { force = false } = {}) {
  const descriptor = surfaceDescriptor(view);
  const host = document.querySelector(`[data-view="${view}"]`);
  if (!descriptor || !host) return;
  if (!force && mountedRoot === host && mountedView === view) {
    if (view === "create") renderCreate();
    return;
  }
  if (mountedRoot && mountedRoot !== host) unmountSurface();

  if (view === "create") {
    let createRoot = host.querySelector(":scope > [data-vnext-create-root]");
    if (!createRoot) {
      createRoot = document.createElement("div");
      createRoot.dataset.vnextCreateRoot = "";
      host.prepend(createRoot);
    }
    [...host.children].filter((child) => child !== createRoot).forEach((child) => { child.hidden = true; });
    createRoot.hidden = false;
    createRoot.replaceChildren(createAppShell({
      title: descriptor.title,
      activeView: view,
      navigate: legacyNavigate,
      content: descriptor.content,
    }));
    createRoot.dataset.vnextRoot = view;
    mountedRoot = host;
    mountedCreateContent = createRoot.querySelector(".vnext-shell__frame > .vnext-create");
    mountedView = view;
    document.body.classList.add("vnext-surface-active");
    window.dreamwheelsCreateBridge?.surfaceMounted();
    return;
  }

  host.replaceChildren(createAppShell({
    title: descriptor.title,
    activeView: view,
    navigate: legacyNavigate,
    content: descriptor.content,
  }));
  host.dataset.vnextRoot = view;
  mountedRoot = host;
  mountedView = view;
  document.body.classList.add("vnext-surface-active");
}

function applyView(view) {
  if (migratedViews.has(view)) mountSurface(view);
  else unmountSurface();
}

window.addEventListener("dreamwheels:viewchange", (event) => applyView(event.detail?.view));
window.addEventListener("dreamwheels:dashboardchange", () => {
  if (mountedView === "dashboard") mountSurface("dashboard", { force: true });
});
window.addEventListener("dreamwheels:createchange", renderCreate);
document.addEventListener("DOMContentLoaded", () => {
  for (const view of migratedViews) {
    const host = document.querySelector(`[data-view="${view}"]`);
    if (host && !host.hidden) {
      mountSurface(view);
      break;
    }
  }
});
