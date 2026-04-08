(() => {
  const STORAGE_KEY = "tabBeaconIndicatorSettings";
  const CARD_ID = "indicatorSettingsCard";
  const DEBUG_RENDER_GROUP_ID = "debugRenderMethodGroup";

  const DEFAULT_SETTINGS = Object.freeze({
    indicatorStyle: "spinner",
    spinnerStyle: "ring",
    badgeStyle: "dot",
    badgeColor: "#3b82f6",
    renderMethod: "frames"
  });

  const indicatorSettingsApi = window.TabBeaconIndicatorSettings || {};
  window.TabBeaconIndicatorSettings = indicatorSettingsApi;

  function normalizeBadgeColor(value) {
    const color = typeof value === "string" ? value.trim() : "";
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : DEFAULT_SETTINGS.badgeColor;
  }

  function normalizeSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      indicatorStyle: source.indicatorStyle === "static-badge" ? "static-badge" : "spinner",
      spinnerStyle: "ring",
      badgeStyle: ["dot", "ring", "corner"].includes(source.badgeStyle) ? source.badgeStyle : "dot",
      badgeColor: normalizeBadgeColor(source.badgeColor),
      renderMethod: source.renderMethod === "gif" ? "gif" : "frames"
    };
  }

  function setGroupValue(root, name, value) {
    const input = root?.querySelector(`input[name="${name}"][value="${value}"]`);
    if (input) input.checked = true;
  }

  function readSettingsFromDom() {
    return normalizeSettings({
      indicatorStyle: document.querySelector('input[name="indicatorStyle"]:checked')?.value,
      spinnerStyle: document.querySelector('input[name="spinnerStyle"]:checked')?.value,
      badgeStyle: document.querySelector('input[name="badgeStyle"]:checked')?.value,
      badgeColor: document.querySelector('input[name="badgeColor"]')?.value,
      renderMethod: document.querySelector('input[name="renderMethod"]:checked')?.value
    });
  }

  function syncGroupVisibility(indicatorStyle) {
    document.querySelectorAll("[data-style-group]").forEach((section) => {
      section.classList.toggle("hidden", section.dataset.styleGroup !== indicatorStyle);
    });
  }

  function syncBadgeColorPreview(color) {
    const card = document.getElementById(CARD_ID);
    if (!card) return;
    card.style.setProperty("--indicator-badge-color", normalizeBadgeColor(color));
  }

  function applySettingsToDom(settings) {
    setGroupValue(document, "indicatorStyle", settings.indicatorStyle);
    setGroupValue(document, "spinnerStyle", settings.spinnerStyle);
    setGroupValue(document, "badgeStyle", settings.badgeStyle);
    setGroupValue(document, "renderMethod", settings.renderMethod);
    const badgeColorInput = document.querySelector('input[name="badgeColor"]');
    if (badgeColorInput) badgeColorInput.value = settings.badgeColor;
    syncGroupVisibility(settings.indicatorStyle);
    syncBadgeColorPreview(settings.badgeColor);
  }

  function bindChangeHandlers(root) {
    if (!root || root.dataset.bound === "true") return;
    const badgeColorInput = root.querySelector('input[name="badgeColor"]');
    const colorPickerButton = root.querySelector(".indicator-color-picker-button");

    if (badgeColorInput && colorPickerButton) {
      colorPickerButton.addEventListener("click", () => {
        if (typeof badgeColorInput.showPicker === "function") {
          badgeColorInput.showPicker();
        } else {
          badgeColorInput.click();
        }
      });
    }

    root.addEventListener("change", () => {
      const settings = readSettingsFromDom();
      syncGroupVisibility(settings.indicatorStyle);
      syncBadgeColorPreview(settings.badgeColor);
      if (typeof markDirty === "function") markDirty();
    });

    root.addEventListener("input", (event) => {
      if (event.target instanceof HTMLInputElement && event.target.name === "badgeColor") {
        syncBadgeColorPreview(event.target.value);
        if (typeof markDirty === "function") markDirty();
      }
    });

    root.dataset.bound = "true";
  }

  function bindDebugHandlers(root) {
    if (!root || root.dataset.bound === "true") return;
    root.addEventListener("change", () => {
      if (typeof markDirty === "function") markDirty();
    });
    root.dataset.bound = "true";
  }

  async function loadSettings() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return normalizeSettings(result[STORAGE_KEY]);
  }

  async function saveSettings() {
    const settings = readSettingsFromDom();
    await chrome.storage.local.set({ [STORAGE_KEY]: settings });
    return settings;
  }

  async function resetSettings() {
    await chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_SETTINGS });
    applySettingsToDom(DEFAULT_SETTINGS);
  }

  function ready() {
    return !!document.getElementById(CARD_ID) && !!document.getElementById(DEBUG_RENDER_GROUP_ID);
  }

  async function init() {
    if (!ready()) {
      window.setTimeout(init, 30);
      return;
    }

    const indicatorCard = document.getElementById(CARD_ID);
    const debugRenderGroup = document.getElementById(DEBUG_RENDER_GROUP_ID);
    const settings = await loadSettings();

    applySettingsToDom(settings);
    bindChangeHandlers(indicatorCard);
    bindDebugHandlers(debugRenderGroup);
  }

  Object.assign(indicatorSettingsApi, {
    DEFAULT_SETTINGS,
    readSettingsFromDom,
    loadSettings,
    saveSettings,
    resetSettings,
    applySettingsToDom
  });

  init().catch((error) => console.error("[Tab Beacon] indicator style patch failed", error));
})();
