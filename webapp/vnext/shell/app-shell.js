import { copy } from "../copy.mjs";
const desktopNav = [
  ["Главная", "dashboard"], ["nav.create", "create"], ["nav.history", "renders"], ["Баланс", "wallet"],
];
const helpNav = [["Поддержка", "support"], ["Как подготовить фото", "photo-guide"], ["Документы", "docs"]];
const mobileNav = [["Главная", "dashboard"], ["nav.createMobile", "create"], ["nav.history", "renders"], ["Баланс", "wallet"], ["Помощь", "support"]];

function navButton([label, view], activeView, navigate) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "vnext-shell__nav-button";
  button.textContent = label.startsWith("nav.") ? copy(label) : label;
  if (view === activeView) button.setAttribute("aria-current", "page");
  button.addEventListener("click", () => navigate(view));
  return button;
}

export function createAppShell({ title = "Dream Wheels AI", activeView, navigate, content, authenticated = false, openAuth } = {}) {
  const shell = document.createElement("div");
  shell.className = "vnext-shell";

  const sidebar = document.createElement("aside");
  sidebar.className = "vnext-shell__sidebar";
  sidebar.innerHTML = '<div class="vnext-shell__brand">DREAM <span>WHEELS AI</span></div>';

  const nav = document.createElement("nav");
  nav.className = "vnext-shell__nav";
  nav.setAttribute("aria-label", "Основная навигация");
  desktopNav.forEach((item) => nav.append(navButton(item, activeView, navigate)));

  const label = document.createElement("div");
  label.className = "vnext-shell__nav-label";
  label.textContent = "Помощь";
  nav.append(label);
  helpNav.forEach((item) => nav.append(navButton(item, activeView, navigate)));
  sidebar.append(nav);

  const account = document.createElement("section");
  account.className = "vnext-shell__account";
  account.setAttribute("aria-label", "Аккаунт");
  const accountLabel = document.createElement("span");
  accountLabel.className = "vnext-shell__account-label";
  accountLabel.textContent = "Аккаунт";
  const profileButton = document.createElement("button");
  profileButton.type = "button";
  profileButton.className = "vnext-shell__account-action";
  profileButton.innerHTML = '<span>Аккаунт</span><small>Настройки профиля</small>';
  profileButton.addEventListener("click", () => navigate?.("settings"));
  const desktopLoginButton = document.createElement("button");
  desktopLoginButton.type = "button";
  desktopLoginButton.className = "vnext-shell__login vnext-shell__login--sidebar";
  desktopLoginButton.textContent = "Войти";
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
  mobileLoginButton.textContent = "Войти";
  mobileLoginButton.addEventListener("click", () => openAuth?.());
  topbar.append(pageTitle, mobileLoginButton);
  frame.append(topbar, content);
  main.append(frame);
  shell.append(main);

  const bottom = document.createElement("nav");
  bottom.className = "vnext-shell__bottom-nav";
  const mobileActiveView = ["support", "photo-guide", "docs"].includes(activeView) ? "support" : activeView;
  bottom.setAttribute("aria-label", "Основная навигация");
  mobileNav.forEach(([labelText, view]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vnext-shell__bottom-button";
    button.textContent = labelText.startsWith("nav.") ? copy(labelText) : labelText;
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
