import { createIsland } from "../ui/primitives.js";

export function createPhotoGuideView(model) {
  const page = document.createElement("section");
  page.className = "vnext-guide";

  const hero = document.createElement("section");
  hero.className = "vnext-static-hero";
  const eyebrow = document.createElement("p");
  eyebrow.className = "vnext-eyebrow";
  eyebrow.textContent = model.eyebrow;
  const title = document.createElement("h2");
  title.textContent = model.heroTitle;
  const copy = document.createElement("p");
  copy.textContent = model.copy;
  hero.append(eyebrow, title, copy);
  page.append(hero);

  const examples = document.createElement("div");
  examples.className = "vnext-guide__examples";
  model.examples.forEach((example) => {
    const body = document.createElement("div");
    body.className = "vnext-guide__example-body";
    const visual = document.createElement("div");
    visual.className = "vnext-guide__visual";
    const image = document.createElement("img");
    image.src = example.src;
    image.alt = example.alt;
    image.loading = "lazy";
    visual.append(image);
    const copyWrap = document.createElement("div");
    copyWrap.className = "vnext-guide__copy";
    const tone = document.createElement("div");
    tone.className = `vnext-guide__tone vnext-guide__tone--${example.tone}`;
    tone.textContent = example.toneLabel;
    const heading = document.createElement("h3");
    heading.textContent = example.title;
    const paragraph = document.createElement("p");
    paragraph.textContent = example.copy;
    copyWrap.append(tone, heading, paragraph);
    body.append(visual, copyWrap);
    examples.append(createIsland(body));
  });
  page.append(examples);

  const rules = document.createElement("div");
  rules.className = "vnext-guide__rules";
  model.rules.forEach(([number, headingText, copyText]) => {
    const row = document.createElement("div");
    row.className = "vnext-guide__rule";
    const num = document.createElement("div");
    num.className = "vnext-guide__num";
    num.textContent = number;
    const body = document.createElement("div");
    const heading = document.createElement("h3");
    heading.textContent = headingText;
    const paragraph = document.createElement("p");
    paragraph.textContent = copyText;
    body.append(heading, paragraph);
    row.append(num, body);
    rules.append(row);
  });
  page.append(rules);
  return page;
}
