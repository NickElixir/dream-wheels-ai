import { createIsland, createTextAction } from "../ui/primitives.js";

function supportMailto(model, message = "") {
  const subject = encodeURIComponent(model.supportSubject);
  const body = message.trim() ? `&body=${encodeURIComponent(message.trim())}` : "";
  return `mailto:${model.supportEmail}?subject=${subject}${body}`;
}

function createTopic(topic, navigate) {
  const wrapper = document.createElement("div");
  wrapper.className = "vnext-support__topic";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "vnext-support__topic-button";

  const label = document.createElement("span");
  label.textContent = topic.label;
  const arrow = document.createElement("span");
  arrow.className = "vnext-support__topic-arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "›";
  button.append(label, arrow);

  if (topic.kind === "navigate") {
    button.addEventListener("click", () => navigate?.(topic.view));
  } else {
    const detail = document.createElement("p");
    detail.className = "vnext-support__topic-detail";
    detail.textContent = topic.detail || "";
    detail.hidden = true;
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", expanded ? "false" : "true");
      detail.hidden = expanded;
    });
    wrapper.append(button, detail);
    return wrapper;
  }

  wrapper.append(button);
  return wrapper;
}

export function createSupportView(model, { navigate } = {}) {
  const page = document.createElement("section");
  page.className = "vnext-support";

  const hero = document.createElement("section");
  hero.className = "vnext-support__hero";

  const eyebrow = document.createElement("p");
  eyebrow.className = "vnext-support__eyebrow";
  eyebrow.textContent = model.eyebrow;

  const heading = document.createElement("h2");
  heading.className = "vnext-support__hero-title";
  heading.textContent = model.heroTitle;

  const copy = document.createElement("p");
  copy.className = "vnext-support__hero-copy";
  copy.textContent = model.copy;
  hero.append(eyebrow, heading, copy);
  page.append(hero);

  const grid = document.createElement("div");
  grid.className = "vnext-support__grid";

  const mainContent = document.createElement("div");
  const field = document.createElement("div");
  field.className = "vnext-field";

  const label = document.createElement("label");
  label.htmlFor = "vnext-support-message";
  label.textContent = model.messageLabel;

  const textarea = document.createElement("textarea");
  textarea.id = "vnext-support-message";
  textarea.placeholder = model.messagePlaceholder;
  field.append(label, textarea);
  mainContent.append(field);

  const actions = document.createElement("div");
  actions.className = "vnext-support__actions";
  const email = document.createElement("a");
  email.className = "vnext-button vnext-button--primary";
  email.textContent = model.supportLabel;
  email.href = supportMailto(model);
  textarea.addEventListener("input", () => {
    email.href = supportMailto(model, textarea.value);
  });
  actions.append(email);
  mainContent.append(actions);

  const mainIsland = createIsland(mainContent);
  mainIsland.classList.add("vnext-support__main");

  const sideContent = document.createElement("div");
  const sideTitle = document.createElement("h3");
  sideTitle.className = "vnext-support__side-title";
  sideTitle.textContent = model.selfHelpTitle;
  sideContent.append(sideTitle);

  const topics = document.createElement("div");
  topics.className = "vnext-support__topics";
  model.topics.forEach((topic) => topics.append(createTopic(topic, navigate)));
  sideContent.append(topics);

  const docs = document.createElement("div");
  docs.className = "vnext-support__documents";
  docs.append(createTextAction({ label: model.documentsLabel, onClick: () => navigate?.("docs") }));
  sideContent.append(docs);

  const sideIsland = createIsland(sideContent);
  sideIsland.classList.add("vnext-support__side");

  grid.append(mainIsland, sideIsland);
  page.append(grid);
  return page;
}
