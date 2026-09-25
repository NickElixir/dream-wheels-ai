export function createDocumentsView(model, { openExternal } = {}) {
  const page = document.createElement("section");
  page.className = "vnext-documents";

  const intro = document.createElement("section");
  intro.className = "vnext-documents__intro";
  const eyebrow = document.createElement("p");
  eyebrow.className = "vnext-eyebrow";
  eyebrow.textContent = model.eyebrow;
  const copy = document.createElement("p");
  copy.textContent = model.copy;
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

    const body = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = row.title;
    const description = document.createElement("p");
    description.textContent = row.copy;
    body.append(title, description);

    const open = document.createElement("span");
    open.className = "vnext-documents__open";
    open.textContent = "Открыть";
    link.append(body, open);

    link.addEventListener("click", (event) => {
      if (!openExternal || event.defaultPrevented || event.button !== 0) return;
      event.preventDefault();
      openExternal(row.href);
    });
    list.append(link);
  });
  page.append(list);
  return page;
}
