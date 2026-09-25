import { legacyNavigate, legacyOpenExternal } from "./api/legacy-navigation.js";
import { supportViewModel } from "./models/support.js";
import { createAppShell } from "./shell/app-shell.js";
import { createSupportView } from "./views/support.js";

let mountedRoot = null;

function unmountSupport() {
  document.body.classList.remove("vnext-support-active");
  if (mountedRoot) mountedRoot.replaceChildren();
  mountedRoot = null;
}

function mountSupport() {
  const host = document.querySelector('[data-view="support"]');
  if (!host || mountedRoot === host) return;
  unmountSupport();
  const content = createSupportView(supportViewModel(), {
    navigate: legacyNavigate,
    openExternal: legacyOpenExternal,
  });
  host.replaceChildren(createAppShell({ activeView: "support", navigate: legacyNavigate, content }));
  host.dataset.vnextRoot = "support";
  mountedRoot = host;
  document.body.classList.add("vnext-support-active");
}

function applyView(view) {
  if (view === "support") mountSupport();
  else unmountSupport();
}

window.addEventListener("dreamwheels:viewchange", (event) => applyView(event.detail?.view));
document.addEventListener("DOMContentLoaded", () => {
  if (!document.querySelector('[data-view="support"]')?.hidden) mountSupport();
});
