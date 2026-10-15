export function createSupportView(model, { navigate } = {}) {
  const page = document.createElement("section");
  page.className = "vnext-support vnext-support--contacts";
  const ru = model.locale === "ru";
  function section(title) {
    const node = document.createElement("section");
    const heading = document.createElement("h2");
    heading.textContent = title;
    node.append(heading);
    page.append(node);
    return node;
  }
  function link(host, { title, copy, icon, href, view }) {
    const row = document.createElement("a");
    row.className = "vnext-support__link";
    row.href = href;
    if (view) {
      row.addEventListener("click", (event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !navigate) return;
        event.preventDefault();
        navigate(view);
      });
    } else if (href.startsWith("https:")) {
      row.target = "_blank";
      row.rel = "noopener noreferrer";
      row.setAttribute("data-external-link", "");
    }
    if (icon) {
      const mark = document.createElement("span");
      mark.className = "vnext-support__icon";
      mark.textContent = icon;
      mark.setAttribute("aria-hidden", "true");
      row.append(mark);
    }
    const text = document.createElement("span");
    const heading = document.createElement("strong");
    heading.textContent = title;
    const detail = document.createElement("small");
    detail.textContent = copy;
    text.append(heading, detail);
    row.append(text);
    host.append(row);
  }
  const contacts = section(ru ? "Связаться с нами" : "Contact us");
  link(contacts, { title: "Telegram", copy: "@dreamwheelsai", icon: "💬", href: "https://t.me/dreamwheelsai" });
  link(contacts, { title: "Email", copy: model.supportEmail, icon: "✉️", href: `mailto:${model.supportEmail}` });
  const useful = section(ru ? "Полезное" : "Useful links");
  link(useful, { title: ru ? "Как подготовить фото" : "How to prepare photos", copy: ru ? "Рекомендации перед загрузкой" : "Examples and tips before uploading", icon: "🚗", href: "/help/photos", view: "photo-guide" });
  link(useful, { title: ru ? "Условия возврата" : "Refund policy", copy: ru ? "Когда и как запросить возврат" : "When refunds are available and how to request one", icon: "↩", href: "https://legal.dreamwheels.pro/legal/refund" });
  return page;
}
