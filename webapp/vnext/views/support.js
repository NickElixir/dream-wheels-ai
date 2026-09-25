import { createIsland, createPageHeader, createTextAction } from "../ui/primitives.js";

export function createSupportView(model, { navigate, openExternal } = {}) {
  const page = document.createElement("section");
  page.className = "vnext-support";
  page.append(createPageHeader({ title: model.title, copy: model.copy }));

  const channels = document.createElement("div");
  channels.className = "vnext-support__channels";
  for (const channel of model.channels) {
    const content = document.createElement("a");
    content.className = "vnext-support__channel";
    content.href = channel.href;
    content.textContent = `${channel.label} — ${channel.detail}`;
    if (channel.external) {
      content.target = "_blank";
      content.rel = "noopener noreferrer";
      content.addEventListener("click", (event) => {
        if (!openExternal || event.defaultPrevented || event.button !== 0) return;
        event.preventDefault();
        openExternal(channel.href);
      });
    }
    channels.append(content);
  }
  const island = createIsland(channels);
  island.classList.add("vnext-support__island");
  page.append(island);
  page.append(createTextAction({ label: model.documentsLabel, onClick: () => navigate?.("docs") }));
  return page;
}
