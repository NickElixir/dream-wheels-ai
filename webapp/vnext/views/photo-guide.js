
export function createPhotoGuideView(model, callbacks = {}) {
  const page = document.createElement("section");
  page.className = "vnext-guide";

  const hero = document.createElement("section");
  hero.className = "vnext-static-hero";
  const intro = document.createElement("p");
  intro.textContent = model.intro;
  hero.append(intro);
  page.append(hero);

  const examples = document.createElement("div");
  examples.className = "vnext-guide__examples";
  model.examples.forEach((example) => {
    const body = document.createElement("div");
    body.className = "vnext-guide__example-body";
    const visual = document.createElement("div");
    visual.className = "vnext-guide__visual" + (example.cropped ? " vnext-guide__visual--cropped" : "");
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
    copyWrap.append(tone, heading);
    body.append(visual, copyWrap);
    examples.append(body);
  });
  page.append(examples);

  const rulesHeading = document.createElement("h2");
  rulesHeading.className = "vnext-guide__rules-title";
  rulesHeading.textContent = model.rulesTitle;
  page.append(rulesHeading);
  const rules = document.createElement("ul");
  rules.className = "vnext-guide__rules";
  model.rules.forEach(([number, headingText, copyText]) => {
    const row = document.createElement("li");
    row.className = "vnext-guide__rule";
    const num = document.createElement("div");
    num.className = "vnext-guide__num";
    num.textContent = "✓";
    num.setAttribute("aria-hidden", "true");
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
  const wheel = document.createElement("section");
  wheel.className = "vnext-guide__wheel";
  const wheelTitle = document.createElement("h2");
  wheelTitle.textContent = model.wheelTitle;
  const wheelCopy = document.createElement("p");
  wheelCopy.textContent = model.wheelCopy;
  wheel.append(wheelTitle, wheelCopy);
  const action = document.createElement("a");
  action.className = "vnext-button vnext-button--primary vnext-guide__create";
  action.href = "/create";
  action.textContent = model.createLabel;
  action.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !callbacks.navigate) return;
    event.preventDefault();
    callbacks.navigate("create");
  });
  page.append(wheel, action);
  return page;
}
