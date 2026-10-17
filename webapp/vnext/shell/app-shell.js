import { escapeCopy as esc } from "../copy.mjs";
import { copy as uiText, applicationLocale } from "../copy.mjs";
import { accountPresentation } from "./account.mjs";
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

export function createAppShell({ title = "Dream Wheels AI", activeView, navigate, content, authenticated = false, accountData = {}, openAuth, locale = applicationLocale() } = {}) {
  const shell = document.createElement("div");
  shell.className = "vnext-shell";
  shell.accountLocale = locale;
  shell.accountData = accountData;

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
  profileButton.setAttribute("aria-label", uiText("account.settings", locale));
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
  const pageTitle = document.createElement(["fitment", "dashboard"].includes(activeView) ? "p" : "h1");
  pageTitle.className = "vnext-shell__topbar-title";
  pageTitle.textContent = title;
  const mobileLoginButton = document.createElement("button");
  mobileLoginButton.type = "button";
  mobileLoginButton.className = "vnext-shell__login vnext-shell__login--topbar";
  mobileLoginButton.textContent = uiText("auth.login", locale);
  mobileLoginButton.addEventListener("click", () => openAuth?.());
  const mobileAccountButton = document.createElement("button");
  mobileAccountButton.type = "button";
  mobileAccountButton.className = "vnext-shell__account-action vnext-shell__account-action--mobile";
  mobileAccountButton.addEventListener("click", () => navigate?.("settings"));
  topbar.append(pageTitle, mobileAccountButton, mobileLoginButton);
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

export function updateAppShellAuth(shell, authenticated, accountData) {
  if (!shell) return;
  const isAuthenticated = Boolean(authenticated);
  if (accountData) shell.accountData = accountData;
  const locale = shell.accountLocale || applicationLocale();
  const account = accountPresentation(shell.accountData, locale);
  shell.querySelectorAll(".vnext-shell__account-action").forEach(button => {
    button.hidden = !isAuthenticated;
    button.title = `${account.identifier} — ${account.subtitle}`;
    button.setAttribute("aria-label", `${uiText("account.settings", locale)}: ${account.identifier}, ${account.subtitle}`);
    button.innerHTML = `<span class="vnext-shell__avatar" aria-hidden="true">${esc(account.initials)}</span><span class="vnext-shell__account-copy"><span class="vnext-shell__account-identifier">${esc(account.identifier)}</span><small>${esc(account.subtitle)}</small></span><span class="vnext-shell__account-cue" aria-hidden="true">›</span>`;
  });
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
