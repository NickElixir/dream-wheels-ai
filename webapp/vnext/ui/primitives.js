export function createButton({ label, variant = "primary", disabled = false, onClick } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `vnext-button vnext-button--${variant}`;
  button.textContent = label || "";
  button.disabled = disabled;
  if (typeof onClick === "function") button.addEventListener("click", onClick);
  return button;
}

export function createTextAction({ label, onClick } = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "vnext-text-action";
  button.textContent = label || "";
  if (typeof onClick === "function") button.addEventListener("click", onClick);
  return button;
}

export function createPageHeader({ title, copy } = {}) {
  const header = document.createElement("header");
  const heading = document.createElement("h1");
  heading.className = "vnext-page-header";
  heading.textContent = title || "";
  header.append(heading);
  if (copy) {
    const paragraph = document.createElement("p");
    paragraph.className = "vnext-copy";
    paragraph.textContent = copy;
    header.append(paragraph);
  }
  return header;
}

export function createIsland(content) {
  const island = document.createElement("section");
  island.className = "vnext-island";
  if (content) island.append(content);
  return island;
}

export function createStatusText({ label, tone = "pending" } = {}) {
  const status = document.createElement("span");
  status.className = `vnext-status vnext-status--${tone}`;
  status.textContent = label || "";
  return status;
}
