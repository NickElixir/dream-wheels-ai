import { legacyDashboardSnapshot, legacyOpenAuth, legacyOpenRenderDetail } from "./api/legacy-dashboard.js";
import { legacyNavigate, legacyOpenExternal } from "./api/legacy-navigation.js";
import { documentsViewModel } from "./models/documents.js";
import { photoGuideViewModel } from "./models/photo-guide.js";
import { supportViewModel } from "./models/support.js";
import { createAppShell } from "./shell/app-shell.js";
import { createDashboardView } from "./views/dashboard.js";
import { createDocumentsView } from "./views/documents.js";
import { createPhotoGuideView } from "./views/photo-guide.js";
import { createSupportView } from "./views/support.js";

const migratedViews = new Set(["dashboard", "support", "photo-guide", "docs"]);
let mountedRoot = null;
let mountedView = "";

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
    mountedRoot.replaceChildren();
    delete mountedRoot.dataset.vnextRoot;
  }
  mountedRoot = null;
  mountedView = "";
}

function mountSurface(view, { force = false } = {}) {
  const descriptor = surfaceDescriptor(view);
  const host = document.querySelector(`[data-view="${view}"]`);
  if (!descriptor || !host) return;
  if (!force && mountedRoot === host && mountedView === view) return;
  if (mountedRoot && mountedRoot !== host) unmountSurface();

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
document.addEventListener("DOMContentLoaded", () => {
  for (const view of migratedViews) {
    const host = document.querySelector(`[data-view="${view}"]`);
    if (host && !host.hidden) {
      mountSurface(view);
      break;
    }
  }
});
