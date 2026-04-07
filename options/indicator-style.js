(() => {
  const STORAGE_KEY = "tabBeaconIndicatorSettings";
  const STYLE_ID = "tabBeaconIndicatorStyleUi";
  const CARD_ID = "indicatorSettingsCard";
  const DEBUG_RENDER_GROUP_ID = "debugRenderMethodGroup";

  const DEFAULT_SETTINGS = Object.freeze({
    indicatorStyle: "spinner",
    spinnerStyle: "ring",
    badgeStyle: "dot",
    badgeColor: "#3b82f6",
    renderMethod: "frames"
  });

  function normalizeSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    const badgeColor = normalizeBadgeColor(source.badgeColor);
    return {
      indicatorStyle: source.indicatorStyle === "static-badge" ? "static-badge" : "spinner",
      spinnerStyle: "ring",
      badgeStyle: ["dot", "ring", "corner"].includes(source.badgeStyle) ? source.badgeStyle : "dot",
      badgeColor,
      renderMethod: source.renderMethod === "gif" ? "gif" : "frames"
    };
  }

  function normalizeBadgeColor(value) {
    const color = typeof value === "string" ? value.trim() : "";
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : DEFAULT_SETTINGS.badgeColor;
  }

  function indicatorCardMarkup() {
    return `
      <section id="${CARD_ID}" class="card indicator-settings-card">
        <div class="section-header">
          <h2>Indicator style</h2>
        </div>
        <div class="indicator-settings-body">
          <section class="indicator-group">
            <h3 class="indicator-group-title">Display style</h3>
            <div class="indicator-choice-grid" data-setting-group="indicatorStyle">
              <label class="indicator-choice-card" style="align-items: center;">
                <input type="radio" name="indicatorStyle" value="spinner" />
                <span class="indicator-choice-copy">
                  <span class="indicator-choice-title default-inline-label-row" data-indicator-help="indicatorStyleSpinner">Spinner animation</span>
                </span>
              </label>
              <label class="indicator-choice-card" style="align-items: center;">
                <input type="radio" name="indicatorStyle" value="static-badge" />
                <span class="indicator-choice-copy">
                  <span class="indicator-choice-title default-inline-label-row" data-indicator-help="indicatorStyleStaticBadge">Static badge</span>
                </span>
              </label>
            </div>
          </section>

          <section class="indicator-group indicator-style-group" data-style-group="spinner">
            <h3 class="indicator-group-title">Spinner style</h3>
            <div class="indicator-choice-grid" data-setting-group="spinnerStyle">
              <label class="indicator-preview-card">
                <input type="radio" name="spinnerStyle" value="ring" />
                <span class="indicator-preview indicator-preview-spinner">
                  <span class="indicator-preview-spinner-ring"></span>
                  <span class="indicator-preview-spinner-dot dot-1"></span>
                  <span class="indicator-preview-spinner-dot dot-2"></span>
                  <span class="indicator-preview-spinner-dot dot-3"></span>
                  <span class="indicator-preview-spinner-dot dot-4"></span>
                  <span class="indicator-preview-spinner-dot dot-5"></span>
                  <span class="indicator-preview-spinner-dot dot-6"></span>
                  <span class="indicator-preview-spinner-dot dot-7"></span>
                  <span class="indicator-preview-spinner-dot dot-8"></span>
                </span>
                <span class="indicator-preview-label">Ring</span>
              </label>
            </div>
          </section>

          <section class="indicator-group indicator-style-group" data-style-group="static-badge">
            <h3 class="indicator-group-title">Badge style</h3>
            <div class="indicator-choice-grid" data-setting-group="badgeStyle">
              <label class="indicator-preview-card">
                <input type="radio" name="badgeStyle" value="dot" />
                <span class="indicator-preview indicator-preview-badge">
                  <span class="indicator-badge-sample indicator-badge-dot"></span>
                </span>
                <span class="indicator-preview-label">Dot</span>
              </label>
              <label class="indicator-preview-card">
                <input type="radio" name="badgeStyle" value="ring" />
                <span class="indicator-preview indicator-preview-badge">
                  <span class="indicator-badge-sample indicator-badge-ring"></span>
                </span>
                <span class="indicator-preview-label">Ring</span>
              </label>
              <label class="indicator-preview-card">
                <input type="radio" name="badgeStyle" value="corner" />
                <span class="indicator-preview indicator-preview-badge">
                  <span class="indicator-badge-sample indicator-badge-corner"></span>
                </span>
                <span class="indicator-preview-label">Corner</span>
              </label>
            </div>
          </section>

          <section class="indicator-group indicator-style-group" data-style-group="static-badge">
            <h3 class="indicator-group-title">Color</h3>
            <div class="indicator-color-field">
              <input id="badgeColorInput" name="badgeColor" type="color" value="#3b82f6" />
              <button type="button" class="indicator-color-picker-button" aria-label="Open color picker" title="Open color picker">
                <svg class="color-picker-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="display: flex;">
                  <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 -1.5)">
                    <path d="M12 9L3 18v3h3l9-9Z"></path>
                    <path d="M2 22l1-1"></path>
                    <path d="M11 8l5 5"></path>
                    <path d="M15 12l2-2c2-2-1-5-3-3l-2 2"></path>
                  </g>
                </svg>
              </button>
            </div>
          </section>
        </div>
      </section>
    `;
  }

  function debugRenderMarkup() {
    return `
      <section id="${DEBUG_RENDER_GROUP_ID}" class="debug-render-group">
        <h3 class="debug-render-title">Render method</h3>
        <div class="indicator-choice-grid" data-setting-group="renderMethod">
          <label class="indicator-choice-card compact">
            <input type="radio" name="renderMethod" value="frames" />
            <span class="indicator-choice-copy">
              <span class="indicator-choice-title">Frames</span>
              <span class="indicator-choice-description">Animate by swapping generated favicon frames with a timer.</span>
            </span>
          </label>
          <label class="indicator-choice-card compact">
            <input type="radio" name="renderMethod" value="gif" />
            <span class="indicator-choice-copy">
              <span class="indicator-choice-title">GIF</span>
              <span class="indicator-choice-description">Animate with a prebuilt GIF favicon while busy.</span>
            </span>
          </label>
        </div>
      </section>
    `;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .indicator-settings-card {
        display: grid;
        gap: 0;
      }

      .indicator-settings-body {
        display: grid;
        gap: 16px;
        padding: 14px;
      }

      .indicator-group {
        display: grid;
        gap: 12px;
      }

      .indicator-group.hidden {
        display: none !important;
      }

      .indicator-group-title,
      .debug-render-title {
        margin: 0;
        font-size: 1rem;
      }

      .indicator-choice-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
      }

      .indicator-settings-card {
        --indicator-badge-color: #3b82f6;
      }

      .indicator-choice-card,
      .indicator-preview-card {
        display: grid;
        gap: 12px;
        padding: 14px;
        border-radius: 14px;
        border: 1px solid rgba(53, 72, 110, 0.45);
        background: #0d1426;
        cursor: pointer;
      }

      .indicator-preview-card {
        justify-items: center;
        text-align: center;
      }

      @media (prefers-color-scheme: light) {
        .indicator-choice-card,
        .indicator-preview-card {
          border-color: rgba(100, 130, 180, 0.35);
          background: #eef2f9;
          color: #1a2540;
        }
      }

      html[data-default-mode="light"] .indicator-choice-card,
      html[data-default-mode="light"] .indicator-preview-card {
        border-color: rgba(100, 130, 180, 0.35);
        background: #eef2f9;
        color: #1a2540;
      }

      .indicator-choice-card.compact {
        min-height: 100%;
      }

      .indicator-choice-card input,
      .indicator-preview-card input {
        margin: 0;
      }

      .indicator-choice-card input[type="radio"],
      .indicator-preview-card input[type="radio"] {
        appearance: none;
        -webkit-appearance: none;
        width: 16px;
        height: 16px;
        min-width: 16px;
        border-radius: 50%;
        border: 2px solid rgba(90, 112, 153, 0.7);
        background: transparent;
        cursor: pointer;
        transition: border-color 0.14s, background-color 0.14s;
      }

      @media (prefers-color-scheme: light) {
        .indicator-choice-card input[type="radio"],
        .indicator-preview-card input[type="radio"] {
          border-color: rgba(80, 100, 150, 0.55);
        }
      }

      html[data-default-mode="light"] .indicator-choice-card input[type="radio"],
      html[data-default-mode="light"] .indicator-preview-card input[type="radio"] {
        border-color: rgba(80, 100, 150, 0.55);
      }

      .indicator-choice-card input[type="radio"]:checked,
      .indicator-preview-card input[type="radio"]:checked {
        border-color: var(--primary, #3b82f6);
        background: radial-gradient(
          circle at center,
          color-mix(in srgb, var(--primary, #3b82f6), #ffffff 80%) 38%,
          transparent 45%
        );
      }

      @media (prefers-color-scheme: light) {
        .indicator-choice-card input[type="radio"]:checked,
        .indicator-preview-card input[type="radio"]:checked {
          background: radial-gradient(
            circle at center,
            var(--primary, #3b82f6) 38%,
            transparent 45%
          );
        }
      }

      html[data-default-mode="light"] .indicator-choice-card input[type="radio"]:checked,
      html[data-default-mode="light"] .indicator-preview-card input[type="radio"]:checked {
        background: radial-gradient(
          circle at center,
          var(--primary, #3b82f6) 38%,
          transparent 45%
        );
      }

      .indicator-choice-card:has(input:checked),
      .indicator-preview-card:has(input:checked) {
        border-color: rgba(59, 130, 246, 0.95);
        box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.35) inset;
        background: #142135;
      }

      @media (prefers-color-scheme: light) {
        .indicator-choice-card:has(input:checked),
        .indicator-preview-card:has(input:checked) {
          background: #dce5f5;
        }
      }

      html[data-default-mode="light"] .indicator-choice-card:has(input:checked),
      html[data-default-mode="light"] .indicator-preview-card:has(input:checked) {
        background: #dce5f5;
      }

      .indicator-choice-copy {
        display: grid;
        gap: 4px;
      }

      .indicator-choice-title,
      .indicator-preview-label {
        font-weight: 700;
      }

      .indicator-choice-description {
        color: var(--muted);
        font-size: 0.92rem;
        line-height: 1.5;
      }

      @media (prefers-color-scheme: light) {
        .indicator-choice-description {
          color: #5a7090;
        }
      }

      html[data-default-mode="light"] .indicator-choice-description {
        color: #5a7090;
      }

      .indicator-preview {
        position: relative;
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: linear-gradient(180deg, #18243a, #10182a);
        border: 1px solid rgba(53, 72, 110, 0.45);
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      .indicator-preview-spinner-ring {
        position: absolute;
        inset: 8px;
        border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, 0.25);
      }

      .indicator-preview-spinner-dot {
        position: absolute;
        width: 5px;
        height: 5px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.95);
      }

      .indicator-preview-spinner-dot.dot-1 { top: 4px; left: 19.5px; opacity: 1; }
      .indicator-preview-spinner-dot.dot-2 { top: 9px; right: 8px; opacity: 0.88; }
      .indicator-preview-spinner-dot.dot-3 { top: 19.5px; right: 4px; opacity: 0.76; }
      .indicator-preview-spinner-dot.dot-4 { bottom: 9px; right: 8px; opacity: 0.64; }
      .indicator-preview-spinner-dot.dot-5 { bottom: 4px; left: 19.5px; opacity: 0.52; }
      .indicator-preview-spinner-dot.dot-6 { bottom: 9px; left: 8px; opacity: 0.4; }
      .indicator-preview-spinner-dot.dot-7 { top: 19.5px; left: 4px; opacity: 0.34; }
      .indicator-preview-spinner-dot.dot-8 { top: 9px; left: 8px; opacity: 0.28; }

      .indicator-badge-sample {
        position: absolute;
        display: inline-block;
      }

      .indicator-badge-dot {
        width: 12px;
        height: 12px;
        right: 6px;
        bottom: 6px;
        border-radius: 999px;
        background: color-mix(in srgb, var(--indicator-badge-color) 96%, transparent);
        border: 2px solid rgba(255, 255, 255, 0.92);
      }

      .indicator-badge-ring {
        width: 14px;
        height: 14px;
        right: 5px;
        bottom: 5px;
        border-radius: 999px;
        border: 3px solid color-mix(in srgb, var(--indicator-badge-color) 96%, transparent);
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.92);
      }

      .indicator-badge-corner {
        width: 12px;
        height: 12px;
        right: 6px;
        top: 6px;
        border-radius: 4px;
        background: color-mix(in srgb, var(--indicator-badge-color) 96%, transparent);
        border: 1px solid rgba(255, 255, 255, 0.92);
      }

      .indicator-color-field {
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: 260px;
      }

      .indicator-color-field input[type="color"] {
        flex: 1;
        min-height: 44px;
        padding: 6px;
        border-radius: 12px;
        border: 1px solid rgba(53, 72, 110, 0.45);
        background: #0d1426;
        cursor: pointer;
      }

      .indicator-color-field input[type="color"]::-webkit-color-swatch-wrapper {
        padding: 0;
      }

      .indicator-color-field input[type="color"]::-webkit-color-swatch {
        border: 0;
        border-radius: 8px;
      }

      .indicator-color-picker-button {
        width: 40px;
        height: 40px;
        min-width: 40px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 10px;
        border: 1px solid rgba(53, 72, 110, 0.45);
        background: #0d1426;
        color: var(--muted);
        box-shadow: none;
      }

      .indicator-color-picker-button:hover:not(:disabled) {
        color: var(--text);
        background: #142135;
      }

      .indicator-color-picker-button .color-picker-icon {
        width: 21px;
        height: 21px;
        pointer-events: none;
      }

      @media (prefers-color-scheme: light) {
        .indicator-color-field input[type="color"],
        .indicator-color-picker-button {
          border-color: rgba(100, 130, 180, 0.35);
          background: #eef2f9;
        }
      }

      html[data-default-mode="light"] .indicator-color-field input[type="color"],
      html[data-default-mode="light"] .indicator-color-picker-button {
        border-color: rgba(100, 130, 180, 0.35);
        background: #eef2f9;
      }

      .debug-render-group {
        display: grid;
        gap: 12px;
        padding-top: 4px;
      }

      @media (max-width: 760px) {
        .indicator-choice-grid {
          grid-template-columns: 1fr;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureIndicatorCard() {
    let card = document.getElementById(CARD_ID);
    if (card) return card;

    const rulesCard = Array.from(document.querySelectorAll(".card")).find((node) => node.querySelector("#rulesContainer"));
    if (!rulesCard) return null;

    rulesCard.insertAdjacentHTML("beforebegin", indicatorCardMarkup());
    return document.getElementById(CARD_ID);
  }

  function ensureDebugRenderGroup() {
    let panel = document.getElementById(DEBUG_RENDER_GROUP_ID);
    if (panel) return panel;

    const debugPanel = document.getElementById("debugPanel");
    if (!debugPanel) return null;

    debugPanel.insertAdjacentHTML("afterbegin", debugRenderMarkup());
    return document.getElementById(DEBUG_RENDER_GROUP_ID);
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

  function syncBadgeColorPreview(color) {
    const card = document.getElementById(CARD_ID);
    if (!card) return;
    card.style.setProperty("--indicator-badge-color", normalizeBadgeColor(color));
  }

  function syncGroupVisibility(indicatorStyle) {
    document.querySelectorAll("[data-style-group]").forEach((section) => {
      section.classList.toggle("hidden", section.dataset.styleGroup !== indicatorStyle);
    });
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
  }

  async function resetSettings() {
    await chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_SETTINGS });
    applySettingsToDom(DEFAULT_SETTINGS);
  }

  function ready() {
    return !!(
      document.getElementById("saveAll") &&
      document.getElementById("resetConfirmOk") &&
      document.getElementById("debugPanel")
    );
  }

  async function init() {
    injectStyles();

    if (!ready()) {
      setTimeout(init, 30);
      return;
    }

    const indicatorCard = ensureIndicatorCard();
    const debugRenderGroup = ensureDebugRenderGroup();
    if (!indicatorCard || !debugRenderGroup) {
      setTimeout(init, 60);
      return;
    }

    const settings = await loadSettings();
    applySettingsToDom(settings);
    bindChangeHandlers(indicatorCard);
    bindDebugHandlers(debugRenderGroup);

    if (!document.body.dataset.indicatorSettingsSaveBound) {
      document.getElementById("saveAll")?.addEventListener("click", async () => {
        await saveSettings();
      });

      document.getElementById("resetConfirmOk")?.addEventListener("click", async () => {
        await resetSettings();
      });

      document.body.dataset.indicatorSettingsSaveBound = "true";
    }
  }

  init().catch((error) => console.error("[TabBeacon] indicator style patch failed", error));
})();
