import { escapeCopy as esc } from "../copy.mjs";
import { copy as uiText, applicationLocale } from "../copy.mjs";
const desktopNav = [
  ["nav.dashboard", "dashboard"], ["nav.create", "create"], ["nav.history", "renders"], ["nav.wallet", "wallet"],
];
const helpNav = [["nav.support", "support"], ["nav.photoGuide", "photo-guide"], ["nav.documents", "docs"]];
const mobileNav = [["nav.dashboard", "dashboard"], ["nav.createMobile", "create"], ["nav.history", "renders"], ["nav.wallet", "wallet"], ["nav.help", "support"]];

function navButton([label, view], activeView, navigate, locale) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "vnext-shell__nav-button";
  button.textContent = uiText(label, locale);
  if (view === activeView) button.setAttribute("aria-current", "page");
  button.addEventListener("click", () => navigate(view));
  return button;
}

export function createAppShell({ title = "Dream Wheels AI", activeView, navigate, content, authenticated = false, openAuth, locale = applicationLocale() } = {}) {
  const shell = document.createElement("div");
  shell.className = "vnext-shell";

  const sidebar = document.createElement("aside");
  sidebar.className = "vnext-shell__sidebar";
  sidebar.innerHTML = '<div class="vnext-shell__brand">DREAM <span>WHEELS AI</span></div>';

  const nav = document.createElement("nav");
  nav.className = "vnext-shell__nav";
  nav.setAttribute("aria-label", uiText("aria.mainNavigation", locale));
  desktopNav.forEach((item) => nav.append(navButton(item, activeView, navigate, locale)));

  const label = document.createElement("div");
  label.className = "vnext-shell__nav-label";
  label.textContent = uiText("nav.help", locale);
  nav.append(label);
  helpNav.forEach((item) => nav.append(navButton(item, activeView, navigate, locale)));
  sidebar.append(nav);

  const account = document.createElement("section");
  account.className = "vnext-shell__account";
  account.setAttribute("aria-label", uiText("account.label", locale));
  const accountLabel = document.createElement("span");
  accountLabel.className = "vnext-shell__account-label";
  accountLabel.textContent = uiText("account.label", locale);
  const profileButton = document.createElement("button");
  profileButton.type = "button";
  profileButton.className = "vnext-shell__account-action";
  profileButton.innerHTML = `<span>${esc(uiText("account.label", locale))}</span><small>${esc(uiText("account.settings", locale))}</small>`;
  profileButton.addEventListener("click", () => navigate?.("settings"));
  const desktopLoginButton = document.createElement("button");
  desktopLoginButton.type = "button";
  desktopLoginButton.className = "vnext-shell__login vnext-shell__login--sidebar";
  desktopLoginButton.textContent = uiText("auth.login", locale);
  desktopLoginButton.addEventListener("click", () => openAuth?.());
  account.append(accountLabel, profileButton, desktopLoginButton);
  sidebar.append(account);
  shell.append(sidebar);

  const main = document.createElement("main");
  main.className = "vnext-shell__main";
  const frame = document.createElement("div");
  frame.className = "vnext-shell__frame";
  const topbar = document.createElement("header");
  topbar.className = "vnext-shell__topbar";
  const pageTitle = document.createElement("h1");
  pageTitle.className = "vnext-shell__topbar-title";
  pageTitle.textContent = title;
  const mobileLoginButton = document.createElement("button");
  mobileLoginButton.type = "button";
  mobileLoginButton.className = "vnext-shell__login vnext-shell__login--topbar";
  mobileLoginButton.textContent = uiText("auth.login", locale);
  mobileLoginButton.addEventListener("click", () => openAuth?.());
  topbar.append(pageTitle, mobileLoginButton);
  frame.append(topbar, content);
  main.append(frame);
  shell.append(main);

  const bottom = document.createElement("nav");
  bottom.className = "vnext-shell__bottom-nav";
  const mobileActiveView = ["support", "photo-guide", "docs"].includes(activeView) ? "support" : activeView;
  bottom.setAttribute("aria-label", uiText("aria.mainNavigation", locale));
  mobileNav.forEach(([labelText, view]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vnext-shell__bottom-button";
    button.textContent = uiText(labelText, locale);
    if (view === mobileActiveView) button.setAttribute("aria-current", "page");
    button.addEventListener("click", () => navigate(view));
    bottom.append(button);
  });
  shell.append(bottom);
  updateAppShellAuth(shell, authenticated);
  return shell;
}

export function updateAppShellAuth(shell, authenticated) {
  if (!shell) return;
  const isAuthenticated = Boolean(authenticated);
  const accountLabel = shell.querySelector(".vnext-shell__account-label");
  const profileButton = shell.querySelector(".vnext-shell__account-action");
  const desktopLoginButton = shell.querySelector(".vnext-shell__login--sidebar");
  const mobileLoginButton = shell.querySelector(".vnext-shell__login--topbar");
  if (accountLabel) accountLabel.hidden = isAuthenticated;
  if (profileButton) profileButton.hidden = !isAuthenticated;
  if (desktopLoginButton) desktopLoginButton.hidden = isAuthenticated;
  if (mobileLoginButton) mobileLoginButton.hidden = isAuthenticated;
  shell.dataset.authenticated = String(isAuthenticated);
}
