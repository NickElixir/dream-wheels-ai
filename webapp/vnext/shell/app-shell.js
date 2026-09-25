const desktopNav = [
  ["Главная", "dashboard"], ["Примерить диски", "create"], ["Совместимость", "fitment"], ["Мои примерки", "renders"], ["Баланс", "wallet"],
];
const helpNav = [["Поддержка", "support"], ["Как подготовить фото", "photo-guide"], ["Документы", "docs"]];
const mobileNav = [["Главная", "dashboard"], ["Создать", "create"], ["Мои", "renders"], ["Баланс", "wallet"], ["Помощь", "support"]];

function navButton([label, view], activeView, navigate) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "vnext-shell__nav-button";
  button.textContent = label;
  if (view === activeView) button.setAttribute("aria-current", "page");
  button.addEventListener("click", () => navigate(view));
  return button;
}

export function createAppShell({ title = "Dream Wheels AI", activeView, navigate, content } = {}) {
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

  const account = document.createElement("button");
  account.type = "button";
  account.className = "vnext-shell__account";
  account.innerHTML = '<span>Аккаунт</span><small>Настройки профиля</small>';
  account.addEventListener("click", () => navigate?.("settings"));
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
  topbar.append(pageTitle);
  frame.append(topbar, content);
  main.append(frame);
  shell.append(main);

  const bottom = document.createElement("nav");
  bottom.className = "vnext-shell__bottom-nav";
  bottom.setAttribute("aria-label", "Основная навигация");
  mobileNav.forEach(([labelText, view]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vnext-shell__bottom-button";
    button.textContent = labelText;
    if (view === activeView) button.setAttribute("aria-current", "page");
    button.addEventListener("click", () => navigate(view));
    bottom.append(button);
  });
  shell.append(bottom);
  return shell;
}
