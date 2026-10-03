import { legacyDashboardSnapshot, legacyOpenAuth, legacyOpenRenderDetail } from "./api/legacy-dashboard.js";
import { legacyNavigate, legacyOpenExternal } from "./api/legacy-navigation.js";
import { documentsViewModel } from "./models/documents.js";
import { photoGuideViewModel } from "./models/photo-guide.js";
import { supportViewModel } from "./models/support.js";
import { createAppShell, updateAppShellAuth } from "./shell/app-shell.js";
import { createDashboardView } from "./views/dashboard.js";
import { createCreateView, refreshCreateView } from "./views/create.js";
import { createDocumentsView } from "./views/documents.js";
import { createPhotoGuideView } from "./views/photo-guide.js";
import { createSupportView } from "./views/support.js";
import { createRenderView, refreshRenderView } from "./views/render.js";
import { createFitmentView, refreshFitmentView } from "./views/fitment.js";
import { createWalletView, refreshWalletView } from "./views/wallet.js";

const migratedViews = new Set(["dashboard", "create", "support", "photo-guide", "docs", "renders", "render-detail", "fitment", "wallet"]);
let mountedRoot = null;
let mountedView = "";
let mountedShell = null;
let mountedCreateContent = null;
let mountedRenderContent = null;
let mountedFitmentContent = null;
let mountedWalletContent = null;
let legacyHiddenStates = [];

const renderCallbacks = {
  action: (...args) => window.dreamwheelsRenderBridge?.action(...args),
  assetError: (...args) => window.dreamwheelsRenderBridge?.assetError(...args),
};

const fitmentCallbacks = {
  action: (...args) => window.dreamwheelsFitmentBridge?.action(...args),
  setField: (...args) => window.dreamwheelsFitmentBridge?.setField(...args),
  setSourceUrl: (...args) => window.dreamwheelsFitmentBridge?.setSourceUrl(...args),
  setVehiclePhoto: (...args) => window.dreamwheelsFitmentBridge?.setVehiclePhoto(...args),
};

const walletCallbacks = {
  selectPackage: (...args) => window.dreamwheelsWalletBridge?.selectPackage(...args),
  setReceiptEmail: (...args) => window.dreamwheelsWalletBridge?.setReceiptEmail(...args),
  createPayment: () => window.dreamwheelsWalletBridge?.createPayment(),
  refreshPayment: () => window.dreamwheelsWalletBridge?.refreshPayment(),
  showMoreHistory: () => window.dreamwheelsWalletBridge?.showMoreHistory(),
  login: legacyOpenAuth,
};

function renderKind(view) {
  if (view === "renders") return "history";
  if (view === "render-detail") return "result";
  if (view === "create") {
    const create = window.dreamwheelsCreateBridge?.snapshot();
    if (create?.createScreen === "result") return create.resultUrl && !create.submitting && !create.renderError ? "result" : "processing";
  }
  return "";
}

function refreshMountedRender() {
  if (!mountedRoot) return;
  const kind = renderKind(mountedView);
  if (kind && mountedRenderContent?.renderKind === kind) {
    const model = window.dreamwheelsRenderBridge?.snapshot(mountedView === "create" && kind === "result" ? "current-result" : kind) || {};
    if (kind === "processing") {
      const title = model.error ? "Виртуальная примерка" : "Создаём виртуальную примерку";
      const heading = mountedRoot.querySelector(".vnext-shell__topbar-title");
      if (heading && heading.textContent !== title) heading.textContent = title;
    }
    refreshRenderView(mountedRenderContent, model, renderCallbacks);
  } else if (mountedView === "create") {
    if (kind || mountedRenderContent) mountSurface("create", { force: true });
  }
}

function createCallbacks() {
  return {
    openAuth: legacyOpenAuth,
    pickFile: (kind) => window.dreamwheelsCreateBridge?.pickFile(kind),
    clearFile: (kind) => window.dreamwheelsCreateBridge?.clearFile(kind),
    createImage: () => window.dreamwheelsCreateBridge?.createImage(),
    handleGenerationError: () => window.dreamwheelsCreateBridge?.handleGenerationError(),
    setConsent: (checked) => window.dreamwheelsCreateBridge?.setConsent(checked),
    setSourceEditing: (enabled) => window.dreamwheelsCreateBridge?.setSourceEditing(enabled),
    saveRimProductUrl: (value) => window.dreamwheelsCreateBridge?.saveRimProductUrl(value),
  };
}

function renderCreate() {
  if (renderKind(mountedView) || mountedRenderContent) { refreshMountedRender(); return; }
  const bridge = window.dreamwheelsCreateBridge;
  if (!mountedCreateContent || !bridge) return;
  mountedCreateContent = refreshCreateView(mountedCreateContent, bridge.snapshot(), createCallbacks());
}

function refreshMountedFitment() {
  if (mountedView !== "fitment" || !mountedFitmentContent) return;
  mountedFitmentContent = refreshFitmentView(mountedFitmentContent, window.dreamwheelsFitmentBridge?.snapshot() || {}, fitmentCallbacks);
}

function refreshMountedWallet() {
  if (mountedView !== "wallet" || !mountedWalletContent) return;
  refreshWalletView(mountedWalletContent, window.dreamwheelsWalletBridge?.snapshot() || {});
}

function surfaceDescriptor(view) {
  const kind = renderKind(view);
  if (kind) {
    const model = window.dreamwheelsRenderBridge?.snapshot(view === "create" && kind === "result" ? "current-result" : kind) || {};
    return {
      title: kind === "history" ? "Мои примерки" : kind === "result" ? "Результат" : model.error ? "Виртуальная примерка" : "Создаём виртуальную примерку",
      content: createRenderView(kind, model, renderCallbacks),
    };
  }
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
  if (view === "fitment") return {
    title: "Совместимость",
    content: createFitmentView(window.dreamwheelsFitmentBridge?.snapshot() || {}, fitmentCallbacks),
  };
  if (view === "wallet") return {
    title: "Баланс",
    content: createWalletView(window.dreamwheelsWalletBridge?.snapshot() || {}, walletCallbacks),
  };
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
    } else if (["renders", "render-detail", "fitment", "wallet"].includes(mountedView)) mountedRoot.querySelector(":scope > [data-vnext-surface-root]")?.remove();
    else {
      mountedRoot.replaceChildren();
      delete mountedRoot.dataset.vnextRoot;
    }
    for (const [child, hidden] of legacyHiddenStates) child.hidden = hidden;
  }
  mountedRoot = null;
  mountedView = "";
  mountedShell = null;
  mountedCreateContent = null;
  mountedRenderContent = null;
  mountedFitmentContent = null;
  mountedWalletContent = null;
  legacyHiddenStates = [];
}

function mountSurface(view, { force = false } = {}) {
  const host = document.querySelector(`[data-view="${view}"]`);
  if (!host) return;
  if (!force && mountedRoot === host && mountedView === view) {
    if (view === "create") renderCreate();
    else if (view === "fitment") refreshMountedFitment();
    else if (view === "wallet") refreshMountedWallet();
    else refreshMountedRender();
    return;
  }
  const descriptor = surfaceDescriptor(view);
  if (!descriptor) return;
  if (mountedRoot && mountedRoot !== host) unmountSurface();

  if (["create", "renders", "render-detail", "fitment", "wallet"].includes(view)) {
    let createRoot = host.querySelector(view === "create" ? ":scope > [data-vnext-create-root]" : ":scope > [data-vnext-surface-root]");
    if (!createRoot) {
      createRoot = document.createElement("div");
      if (view === "create") createRoot.dataset.vnextCreateRoot = "";
      else createRoot.dataset.vnextSurfaceRoot = "";
      legacyHiddenStates = [...host.children].map((child) => [child, child.hidden]);
      host.prepend(createRoot);
    }
    [...host.children].filter((child) => child !== createRoot).forEach((child) => { child.hidden = true; });
    createRoot.hidden = false;
    mountedShell = createAppShell({
      title: descriptor.title,
      activeView: view === "render-detail" || renderKind(view) === "processing" ? "renders" : view,
      navigate: legacyNavigate,
      content: descriptor.content,
      authenticated: legacyDashboardSnapshot().authenticated,
      openAuth: legacyOpenAuth,
    });
    createRoot.replaceChildren(mountedShell);
    createRoot.dataset.vnextRoot = view;
    mountedRoot = host;
    mountedCreateContent = createRoot.querySelector(".vnext-shell__frame > .vnext-create");
    mountedRenderContent = createRoot.querySelector(".vnext-shell__frame > .vnext-render");
    mountedFitmentContent = createRoot.querySelector(".vnext-shell__frame > .vnext-fitment");
    mountedWalletContent = createRoot.querySelector(".vnext-shell__frame > .vnext-wallet");
    mountedView = view;
    document.body.classList.add("vnext-surface-active");
    if (view === "create") window.dreamwheelsCreateBridge?.surfaceMounted();
    else if (view === "fitment") window.dreamwheelsFitmentBridge?.surfaceMounted();
    else if (["renders", "render-detail"].includes(view)) window.dreamwheelsRenderBridge?.prepareAssets();
    return;
  }

  mountedShell = createAppShell({
    title: descriptor.title,
    activeView: view,
    navigate: legacyNavigate,
    content: descriptor.content,
    authenticated: legacyDashboardSnapshot().authenticated,
    openAuth: legacyOpenAuth,
  });
  host.replaceChildren(mountedShell);
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
  updateAppShellAuth(mountedShell, legacyDashboardSnapshot().authenticated);
  if (mountedView === "dashboard") mountSurface("dashboard", { force: true });
});
window.addEventListener("dreamwheels:createchange", renderCreate);
window.addEventListener("dreamwheels:renderchange", refreshMountedRender);
window.addEventListener("dreamwheels:fitmentchange", refreshMountedFitment);
window.addEventListener("dreamwheels:walletchange", refreshMountedWallet);
document.addEventListener("DOMContentLoaded", () => {
  for (const view of migratedViews) {
    const host = document.querySelector(`[data-view="${view}"]`);
    if (host && !host.hidden) {
      mountSurface(view);
      break;
    }
  }
});
