export function createDocumentsView(model, { openExternal } = {}) {
  const page = document.createElement("section");
  page.className = "vnext-documents";

  const intro = document.createElement("section");
  intro.className = "vnext-documents__intro";
  const eyebrow = document.createElement("p");
  eyebrow.className = "vnext-eyebrow";
  eyebrow.textContent = model.eyebrow;
  const copy = document.createElement("p");
  copy.textContent = model.copy.replace(/\.\s*$/, "");
  intro.append(eyebrow, copy);
  page.append(intro);

  const list = document.createElement("section");
  list.className = "vnext-documents__list";
  model.rows.forEach((row) => {
    const link = document.createElement("a");
    link.className = "vnext-documents__row";
    link.href = row.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("focusable", "false");
    icon.classList.add("vnext-documents__icon");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Zm0 0v5h5M8 12h8M8 16h6");
    icon.append(path);
    const body = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = row.title;
    const description = document.createElement("p");
    description.textContent = row.copy.replace(/\.\s*$/, "");
    body.append(title, description);

    link.append(icon, body);

    link.addEventListener("click", (event) => {
      if (!openExternal || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openExternal(row.href);
    });
    list.append(link);
  });
  page.append(list);
  return page;
}
