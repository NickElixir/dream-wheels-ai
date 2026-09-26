import { createButton, createTextAction } from "../ui/primitives.js";

const LEGAL_PRIVACY = "https://legal.dreamwheels.pro/legal/privacy";
const LEGAL_CONSENT = "https://legal.dreamwheels.pro/legal/consent";

function text(value) {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function numberText(value) {
  if (value === null || value === undefined || value === "") return "";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return Number.isInteger(numeric) ? String(numeric) : String(numeric).replace(".", ",");
}

function pcdText(rim) {
  if (!rim?.bolt_count || rim?.pcd_mm === null || rim?.pcd_mm === undefined) return "";
  return `${rim.bolt_count}×${numberText(rim.pcd_mm)}`;
}

function vehicleTitle(vehicle) {
  if (!vehicle) return "Автомобиль";
  return [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Автомобиль";
}

function vehicleSummary(vehicle) {
  if (!vehicle) return "Данные ещё не определены";
  const year = vehicle.year || (
    vehicle.year_start && vehicle.year_end ? `${vehicle.year_start}–${vehicle.year_end}` : ""
  );
  return [vehicle.make, vehicle.model, year].filter(Boolean).join(" / ");
}

function wheelTitle(rim) {
  if (!rim) return "Колесный диск";
  return [rim.brand, rim.model].filter(Boolean).join(" ") || "Колесный диск";
}

function wheelSummary(rim) {
  if (!rim) return "Параметры не указаны";
  const values = [];
  if (rim.wheel_diameter_in !== null && rim.wheel_diameter_in !== undefined) {
    values.push(`${numberText(rim.wheel_diameter_in)}″`);
  }
  if (rim.wheel_width_j !== null && rim.wheel_width_j !== undefined) {
    values.push(`${numberText(rim.wheel_width_j)}J`);
  }
  const pcd = pcdText(rim);
  if (pcd) values.push(pcd);
  if (rim.offset_et_mm !== null && rim.offset_et_mm !== undefined) {
    values.push(`ET ${numberText(rim.offset_et_mm)}`);
  }
  if (rim.center_bore_mm !== null && rim.center_bore_mm !== undefined) {
    values.push(`DIA ${numberText(rim.center_bore_mm)}`);
  }
  return values.join(" / ") || "Параметры не указаны";
}

function parserCopy(model) {
  if (model.parserStatus === "loading") {
    return {
      title: "Получаем данные по ссылке",
      copy: "Проверяем товарную страницу, изображение и доступные параметры диска.",
      tone: "loading",
    };
  }
  if (model.parserStatus === "success") {
    if (model.rim?.variant_state === "selection_required") {
      return {
        title: "Нужно уточнить вариант диска",
        copy: "На странице найдено несколько вариантов. Используйте ссылку на конкретный вариант или загрузите диск вручную.",
        tone: "warning",
      };
    }
    return {
      title: "Данные диска обновлены",
      copy: "Изображение и доступные параметры получены по ссылке.",
      tone: "success",
    };
  }
  if (model.parserStatus === "error") {
    return {
      title: "Не удалось получить данные по ссылке",
      copy: model.parserError || "Попробуйте другую ссылку или загрузите изображение диска вручную.",
      tone: "error",
    };
  }
  return null;
}

function setImage(stage, url, alt, hasFile) {
  const image = stage.querySelector("[data-create-image]");
  const placeholder = stage.querySelector("[data-create-placeholder]");
  if (url) {
    if (image.src !== url) image.src = url;
    image.alt = alt;
    image.hidden = false;
    placeholder.hidden = true;
  } else {
    image.removeAttribute("src");
    image.hidden = true;
    placeholder.hidden = false;
    placeholder.querySelector("strong").textContent = hasFile ? "Подготавливаем изображение…" : "Добавьте фотографию";
  }
}

function setValueUnlessEditing(input, value) {
  if (document.activeElement === input) return;
  input.value = value ?? "";
}

function formNumber(value) {
  return value === null || value === undefined ? "" : String(value);
}

function parsePcdFields(value) {
  const match = String(value || "").trim().match(/^(\d+)\s*[xх×*]\s*(\d+(?:[.,]\d+)?)$/i);
  return match ? { bolt_count: match[1], pcd_mm: match[2].replace(",", ".") } : {};
}

export function createCreateView(initialModel = {}, callbacks = {}) {
  let model = initialModel;
  let openPanel = "";
  let sourceDirty = false;

  const root = document.createElement("div");
  root.className = "vnext-create";
  root.innerHTML = `
    <div class="vnext-create__pair">
      <article class="vnext-create__source" data-create-source="vehicle">
        <p class="vnext-create__eyebrow">Автомобиль</p>
        <div class="vnext-create__media">
          <img data-create-image hidden>
          <div class="vnext-create__placeholder" data-create-placeholder>
            <strong>Добавьте фотографию</strong>
            <span>Автомобиль должен быть виден целиком</span>
          </div>
        </div>
        <div class="vnext-create__meta">
          <div>
            <div class="vnext-create__object-name" data-create-vehicle-title>Автомобиль</div>
            <div class="vnext-create__object-sub" data-create-car-file></div>
          </div>
          <button type="button" class="vnext-text-action" data-create-pick="car">Выбрать фото</button>
        </div>
        <input type="file" accept="image/jpeg,image/png,image/webp" data-create-file="car" hidden>
      </article>

      <article class="vnext-create__source" data-create-source="wheel">
        <p class="vnext-create__eyebrow">Колесный диск</p>
        <div class="vnext-create__media">
          <img data-create-image hidden>
          <div class="vnext-create__placeholder" data-create-placeholder>
            <strong>Добавьте фотографию</strong>
            <span>Диск лучше снимать спереди</span>
          </div>
        </div>
        <div class="vnext-create__meta">
          <div>
            <div class="vnext-create__object-name" data-create-wheel-title>Колесный диск</div>
            <div class="vnext-create__object-sub" data-create-wheel-file></div>
          </div>
          <button type="button" class="vnext-text-action" data-create-pick="wheel">Выбрать фото</button>
        </div>
        <input type="file" accept="image/jpeg,image/png,image/webp" data-create-file="wheel" hidden>
      </article>
    </div>

    <section class="vnext-create__consent" data-create-consent hidden>
      <label>
        <input type="checkbox" data-create-consent-check>
        <span>Я подтверждаю право использовать выбранные фотографии и соглашаюсь с их обработкой для создания AI-примерки.</span>
      </label>
      <div class="vnext-create__legal">
        <button type="button" class="vnext-text-action" data-create-privacy>Политика обработки данных</button>
        <span>/</span>
        <button type="button" class="vnext-text-action" data-create-legal-consent>Согласие</button>
      </div>
    </section>

    <section class="vnext-create__runtime-state" data-create-runtime-state hidden aria-live="polite">
      <span class="vnext-spinner" data-create-runtime-spinner hidden></span>
      <div>
        <strong data-create-runtime-title></strong>
        <p data-create-runtime-copy></p>
      </div>
    </section>

    <section class="vnext-create__summary" data-create-summary hidden>
      <div class="vnext-create__summary-list">
        <div class="vnext-create__summary-row">
          <div class="vnext-create__summary-label">Данные автомобиля</div>
          <div class="vnext-create__summary-value" data-create-vehicle-summary></div>
          <button type="button" class="vnext-text-action" data-create-edit="vehicle">Изменить данные</button>
        </div>
        <div class="vnext-create__edit-panel" data-create-panel="vehicle" hidden>
          <div class="vnext-create__form-grid">
            <label><span>Марка</span><input data-create-vehicle-field="make"></label>
            <label><span>Модель</span><input data-create-vehicle-field="model"></label>
            <label><span>Год</span><input inputmode="numeric" data-create-vehicle-field="year"></label>
          </div>
          <div class="vnext-create__edit-actions">
            <button type="button" class="vnext-button vnext-button--primary" data-create-save="vehicle">Сохранить</button>
            <button type="button" class="vnext-button vnext-button--secondary" data-create-close="vehicle">Отмена</button>
          </div>
        </div>

        <div class="vnext-create__summary-row">
          <div class="vnext-create__summary-label">Источник диска</div>
          <div class="vnext-create__summary-value" data-create-source-summary></div>
          <button type="button" class="vnext-text-action" data-create-edit="source">Изменить ссылку</button>
        </div>
        <div class="vnext-create__edit-panel" data-create-panel="source" hidden>
          <label class="vnext-create__field">
            <span>Ссылка на товар</span>
            <input type="url" inputmode="url" autocomplete="url" placeholder="https://…" data-create-source-url>
          </label>
          <div class="vnext-create__parser" data-create-parser hidden aria-live="polite">
            <span class="vnext-spinner" data-create-parser-spinner hidden></span>
            <div>
              <strong data-create-parser-title></strong>
              <p data-create-parser-copy></p>
            </div>
          </div>
          <div class="vnext-create__parser-recovery" data-create-parser-recovery hidden>
            <button type="button" class="vnext-button vnext-button--secondary" data-create-parser-retry>Попробовать другую ссылку</button>
            <button type="button" class="vnext-button vnext-button--secondary" data-create-manual-wheel>Загрузить вручную</button>
          </div>
          <div class="vnext-create__edit-actions">
            <button type="button" class="vnext-button vnext-button--primary" data-create-refresh-source>Обновить данные</button>
            <button type="button" class="vnext-button vnext-button--secondary" data-create-close="source">Отмена</button>
          </div>
        </div>

        <div class="vnext-create__summary-row">
          <div class="vnext-create__summary-label">Параметры диска</div>
          <div>
            <div class="vnext-create__summary-value" data-create-wheel-summary></div>
            <div class="vnext-create__summary-note" data-create-wheel-note hidden></div>
          </div>
          <button type="button" class="vnext-text-action" data-create-edit="wheel">Изменить данные</button>
        </div>
        <div class="vnext-create__edit-panel" data-create-panel="wheel" hidden>
          <div class="vnext-create__form-grid">
            <label><span>Бренд</span><input data-create-wheel-field="brand"></label>
            <label><span>Модель</span><input data-create-wheel-field="model"></label>
            <label><span>Диаметр</span><input inputmode="decimal" data-create-wheel-field="wheel_diameter_in"></label>
            <label><span>Ширина</span><input inputmode="decimal" data-create-wheel-field="wheel_width_j"></label>
            <label><span>PCD</span><input placeholder="5×112" data-create-wheel-field="pcd"></label>
            <label><span>ET</span><input inputmode="numeric" data-create-wheel-field="offset_et_mm"></label>
            <label><span>DIA</span><input inputmode="decimal" data-create-wheel-field="center_bore_mm"></label>
          </div>
          <div class="vnext-create__edit-actions">
            <button type="button" class="vnext-button vnext-button--primary" data-create-save="wheel">Сохранить</button>
            <button type="button" class="vnext-button vnext-button--secondary" data-create-close="wheel">Отмена</button>
          </div>
        </div>
      </div>

      <div class="vnext-create__actions">
        <button type="button" class="vnext-button vnext-button--primary" data-create-image>Создать изображение</button>
        <button type="button" class="vnext-button vnext-button--secondary" data-create-fitment>Проверить совместимость</button>
      </div>
    </section>
  `;

  const carSource = root.querySelector('[data-create-source="vehicle"]');
  const wheelSource = root.querySelector('[data-create-source="wheel"]');
  const carInput = root.querySelector('[data-create-file="car"]');
  const wheelInput = root.querySelector('[data-create-file="wheel"]');
  const sourceInput = root.querySelector("[data-create-source-url]");

  function setPanel(panel) {
    openPanel = panel;
    root.querySelectorAll("[data-create-panel]").forEach((node) => {
      node.hidden = node.dataset.createPanel !== panel;
    });
    if (panel === "vehicle") {
      const vehicle = model.vehicle || {};
      root.querySelector('[data-create-vehicle-field="make"]').value = vehicle.make || "";
      root.querySelector('[data-create-vehicle-field="model"]').value = vehicle.model || "";
      root.querySelector('[data-create-vehicle-field="year"]').value = vehicle.year || "";
    }
    if (panel === "wheel") {
      const rim = model.rim || {};
      root.querySelector('[data-create-wheel-field="brand"]').value = rim.brand || "";
      root.querySelector('[data-create-wheel-field="model"]').value = rim.model || "";
      root.querySelector('[data-create-wheel-field="wheel_diameter_in"]').value = formNumber(rim.wheel_diameter_in);
      root.querySelector('[data-create-wheel-field="wheel_width_j"]').value = formNumber(rim.wheel_width_j);
      root.querySelector('[data-create-wheel-field="pcd"]').value = pcdText(rim);
      root.querySelector('[data-create-wheel-field="offset_et_mm"]').value = formNumber(rim.offset_et_mm);
      root.querySelector('[data-create-wheel-field="center_bore_mm"]').value = formNumber(rim.center_bore_mm);
    }
    if (panel === "source" && !sourceDirty) sourceInput.value = model.sourceUrl || "";
  }

  root.querySelectorAll("[data-create-edit]").forEach((button) => {
    button.addEventListener("click", () => setPanel(button.dataset.createEdit));
  });
  root.querySelectorAll("[data-create-close]").forEach((button) => {
    button.addEventListener("click", () => setPanel(""));
  });

  root.querySelector('[data-create-pick="car"]').addEventListener("click", () => carInput.click());
  root.querySelector('[data-create-pick="wheel"]').addEventListener("click", () => wheelInput.click());
  root.querySelector("[data-create-manual-wheel]").addEventListener("click", () => wheelInput.click());

  for (const [kind, input] of [["car", carInput], ["wheel", wheelInput]]) {
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) callbacks.selectFile?.(kind, file);
      input.value = "";
    });
  }

  root.querySelector("[data-create-consent-check]").addEventListener("change", (event) => {
    callbacks.setPhotoConsent?.(Boolean(event.target.checked));
  });
  root.querySelector("[data-create-privacy]").addEventListener("click", () => callbacks.openExternal?.(LEGAL_PRIVACY));
  root.querySelector("[data-create-legal-consent]").addEventListener("click", () => callbacks.openExternal?.(LEGAL_CONSENT));

  sourceInput.addEventListener("input", () => { sourceDirty = true; });
  root.querySelector("[data-create-refresh-source]").addEventListener("click", () => {
    const value = sourceInput.value.trim();
    if (!value) return;
    callbacks.refreshWheelUrl?.(value);
  });
  root.querySelector("[data-create-parser-retry]").addEventListener("click", () => {
    sourceInput.focus();
    sourceInput.select();
  });

  root.querySelector('[data-create-save="vehicle"]').addEventListener("click", () => {
    callbacks.saveVehicle?.({
      make: root.querySelector('[data-create-vehicle-field="make"]').value.trim(),
      model: root.querySelector('[data-create-vehicle-field="model"]').value.trim(),
      year: root.querySelector('[data-create-vehicle-field="year"]').value.trim(),
    });
    setPanel("");
  });

  root.querySelector('[data-create-save="wheel"]').addEventListener("click", () => {
    const pcd = parsePcdFields(root.querySelector('[data-create-wheel-field="pcd"]').value);
    callbacks.saveWheel?.({
      brand: root.querySelector('[data-create-wheel-field="brand"]').value.trim(),
      model: root.querySelector('[data-create-wheel-field="model"]').value.trim(),
      wheel_diameter_in: root.querySelector('[data-create-wheel-field="wheel_diameter_in"]').value.trim(),
      wheel_width_j: root.querySelector('[data-create-wheel-field="wheel_width_j"]').value.trim(),
      offset_et_mm: root.querySelector('[data-create-wheel-field="offset_et_mm"]').value.trim(),
      center_bore_mm: root.querySelector('[data-create-wheel-field="center_bore_mm"]').value.trim(),
      ...pcd,
    });
    setPanel("");
  });

  root.querySelector("[data-create-image]").addEventListener("click", () => callbacks.createImage?.());
  root.querySelector("[data-create-fitment]").addEventListener("click", () => callbacks.checkCompatibility?.());

  function update(nextModel = {}) {
    model = nextModel;

    setImage(
      carSource.querySelector(".vnext-create__media"),
      model.vehiclePreviewUrl || "",
      "Фотография автомобиля",
      model.hasCarFile
    );
    setImage(
      wheelSource.querySelector(".vnext-create__media"),
      model.wheelPreviewUrl || "",
      "Фотография колесного диска",
      model.hasWheelFile
    );

    root.querySelector("[data-create-vehicle-title]").textContent = vehicleTitle(model.vehicle);
    root.querySelector("[data-create-wheel-title]").textContent = wheelTitle(model.rim);
    root.querySelector("[data-create-car-file]").textContent = model.carFileName || "";
    root.querySelector("[data-create-wheel-file]").textContent = model.wheelFileName || "";

    const consent = root.querySelector("[data-create-consent]");
    consent.hidden = !(model.hasCarFile && model.hasWheelFile && !model.consentAccepted);
    root.querySelector("[data-create-consent-check]").checked = Boolean(model.consentAccepted);

    const runtime = root.querySelector("[data-create-runtime-state]");
    const runtimeSpinner = root.querySelector("[data-create-runtime-spinner]");
    const runtimeTitle = root.querySelector("[data-create-runtime-title]");
    const runtimeCopy = root.querySelector("[data-create-runtime-copy]");
    if (model.submitting) {
      runtime.hidden = false;
      runtime.dataset.tone = "loading";
      runtimeSpinner.hidden = false;
      runtimeTitle.textContent = "Создаём виртуальную примерку";
      runtimeCopy.textContent = "Результат появится в «Моих примерках» после завершения обработки.";
    } else if (model.identityResolving) {
      runtime.hidden = false;
      runtime.dataset.tone = "loading";
      runtimeSpinner.hidden = false;
      runtimeTitle.textContent = "Определяем автомобиль";
      runtimeCopy.textContent = "Подбираем марку, модель и год по фотографии.";
    } else if (model.identityError) {
      runtime.hidden = false;
      runtime.dataset.tone = "error";
      runtimeSpinner.hidden = true;
      runtimeTitle.textContent = "Не удалось определить данные";
      runtimeCopy.textContent = model.identityError;
    } else {
      runtime.hidden = true;
      runtimeSpinner.hidden = true;
    }

    const summary = root.querySelector("[data-create-summary]");
    summary.hidden = !model.hasProposal;
    root.querySelector("[data-create-vehicle-summary]").textContent = vehicleSummary(model.vehicle);
    root.querySelector("[data-create-source-summary]").textContent = model.sourceUrl || "Ссылка на товар не добавлена";
    root.querySelector("[data-create-wheel-summary]").textContent = wheelSummary(model.rim);

    const wheelNote = root.querySelector("[data-create-wheel-note]");
    if (model.rim?.variant_state === "selection_required") {
      wheelNote.hidden = false;
      wheelNote.textContent = "На странице несколько вариантов — точные параметры не выбраны.";
    } else {
      wheelNote.hidden = true;
      wheelNote.textContent = "";
    }

    const parser = root.querySelector("[data-create-parser]");
    const parserState = parserCopy(model);
    if (parserState) {
      parser.hidden = false;
      parser.dataset.tone = parserState.tone;
      root.querySelector("[data-create-parser-title]").textContent = parserState.title;
      root.querySelector("[data-create-parser-copy]").textContent = parserState.copy;
      root.querySelector("[data-create-parser-spinner]").hidden = model.parserStatus !== "loading";
    } else {
      parser.hidden = true;
      root.querySelector("[data-create-parser-spinner]").hidden = true;
    }
    root.querySelector("[data-create-parser-recovery]").hidden = model.parserStatus !== "error";

    if (model.parserStatus === "success") {
      sourceDirty = false;
      setValueUnlessEditing(sourceInput, model.sourceUrl || "");
    } else if (!sourceDirty) {
      setValueUnlessEditing(sourceInput, model.sourceUrl || "");
    }

    const refreshSource = root.querySelector("[data-create-refresh-source]");
    refreshSource.disabled = !model.draftId || model.parserStatus === "loading" || !sourceInput.value.trim();

    const createImage = root.querySelector("[data-create-image]");
    createImage.disabled = !model.canCreate || model.submitting;
    createImage.textContent = model.submitting ? "Создаём изображение…" : "Создать изображение";

    const fitment = root.querySelector("[data-create-fitment]");
    fitment.disabled = !model.canCheckFitment;
    fitment.title = model.fitmentUnavailableReason || "";

    if (openPanel && root.querySelector(`[data-create-panel="${openPanel}"]`)?.hidden) {
      setPanel(openPanel);
    }
  }

  update(initialModel);
  return { element: root, update };
}
