(()=> {
  const STORAGE_KEY = "tabBeaconRules";
  const STYLE_ID = "tabBeaconRuleBehaviorStyle";
  const HELP_DIALOG_ID = "tabBeaconBehaviorHelpDialog";
  const DEFAULT_BUSY_END_GRACE_MS = 5_000;
  const t = (key, fallback) => chrome.i18n?.getMessage?.(key) || fallback || key;

  const normalizeBusyEndGraceMs = (value, fallbackMs = DEFAULT_BUSY_END_GRACE_MS) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(300_000, Math.round(n))) : fallbackMs;
  };

  const formatBusyEndGraceSeconds = (value) => String(Number((normalizeBusyEndGraceMs(value) / 1000).toFixed(2)));

  const parseBusyEndGraceSeconds = (value) => {
    const n = Number.parseFloat(String(value || "").trim());
    return Number.isFinite(n) ? normalizeBusyEndGraceMs(n * 1000) : DEFAULT_BUSY_END_GRACE_MS;
  };

  const helpIconSvg = () => `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9"></circle>
      <path d="M9.4 9.2a2.7 2.7 0 1 1 4.8 1.7c-.6.7-1.4 1.1-1.9 1.7-.3.4-.4.7-.4 1.4"></path>
      <circle cx="12" cy="17.2" r=".9"></circle>
    </svg>
  `;

  const behaviorMarkup = () => `
    <section class="behavior-panel">
      <div class="section-header">
        <h3>${t("behaviorTitle", "Behavior")}</h3>
      </div>
      <div class="behavior-body">
        <div class="behavior-row">
          <label class="behavior-grace-field">
            <span class="behavior-inline-label">
              <span>${t("busyEndGracePeriod", "End grace period")}</span>
              <button
                type="button"
                class="behavior-help-button"
                aria-label="${t("endGracePeriodHelpLabel", "Help for end grace period")}"
                title="${t("endGracePeriodHelpLabel", "Help for end grace period")}" 
              >
                ${helpIconSvg()}
              </button>
            </span>
            <div class="behavior-grace-input">
              <input
                type="number"
                min="0"
                max="300"
                step="0.5"
                inputmode="decimal"
                class="rule-busy-end-grace-seconds behavior-number-input"
              />
              <span class="hint">${t("secondsUnit", "seconds")}</span>
            </div>
          </label>
        </div>
      </div>
    </section>
  `;

  function ensureHelpDialog() {
    let dialog = document.getElementById(HELP_DIALOG_ID);
    if (dialog) return dialog;

    dialog = document.createElement("dialog");
    dialog.id = HELP_DIALOG_ID;
    dialog.className = "behavior-help-dialog";
    dialog.innerHTML = `
      <div class="behavior-help-dialog-header">
        <h2 class="behavior-help-dialog-title"></h2>
      </div>
      <div class="behavior-help-dialog-content" role="document">
        <p class="behavior-help-dialog-text"></p>
      </div>
    `;

    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });

    document.body.appendChild(dialog);
    return dialog;
  }

  function openBehaviorHelpDialog() {
    const dialog = ensureHelpDialog();
    dialog.querySelector(".behavior-help-dialog-title").textContent = t("busyEndGracePeriod", "End grace period");
    dialog.querySelector(".behavior-help-dialog-text").textContent = t(
      "busyEndGraceHint",
      "Keep the busy indicator for a short time after all conditions become false."
    );

    if (dialog.open) {
      dialog.close();
    }

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "open");
    }
  }

  function wireBehaviorHelp(panel) {
    const button = panel?.querySelector(".behavior-help-button");
    if (!button || button.dataset.behaviorHelpBound === "true") return;

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openBehaviorHelpDialog();
    });

    button.dataset.behaviorHelpBound = "true";
  }

  function patchStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .rule-body > label:first-child {
        gap: 8px;
        margin-bottom: 12px;
      }

      .rule-controls {
        align-items: flex-end;
        margin-top: 0;
        margin-bottom: 12px;
      }

      .rule-controls > label:first-child {
        gap: 8px;
      }

      .rule-controls > label:first-child select {
        margin-top: 0;
      }

      .behavior-panel {
        display: grid;
        gap: 0;
        margin-bottom: 12px;
        padding: 0;
        background: var(--conditions-surface);
        border: 1px solid var(--panel-border);
        border-radius: 16px;
        overflow: hidden;
      }

      .readonly-rule .behavior-panel {
        background: var(--system-conditions-surface);
        border-color: rgba(95, 108, 133, 0.28);
      }

      .behavior-panel > .section-header {
        margin: 0;
        padding: 12px 14px;
        border-bottom: 1px solid rgba(53, 72, 110, 0.35);
        background: transparent;
      }

      .behavior-panel > .section-header > h3 {
        margin: 0;
        font-size: 1.05rem;
        line-height: 1.2;
      }

      .behavior-body {
        padding: 14px;
        display: grid;
        gap: 12px;
      }

      .behavior-row {
        display: flex;
        align-items: flex-end;
        justify-content: flex-start;
        gap: 12px;
      }

      .behavior-grace-field {
        display: grid;
        gap: 8px;
        width: min(100%, 220px);
      }

      .behavior-inline-label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .behavior-help-button {
        min-width: 22px;
        width: 22px;
        height: 22px;
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #31405f;
        border-radius: 999px;
        background: transparent;
        color: var(--muted);
        box-shadow: none;
      }

      .behavior-help-button:hover:not(:disabled) {
        color: var(--text);
        background: rgba(255, 255, 255, 0.04);
      }

      .behavior-help-button svg {
        width: 14px;
        height: 14px;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
        fill: none;
        pointer-events: none;
      }

      .behavior-help-button svg circle:last-child {
        fill: currentColor;
        stroke: none;
      }

      .behavior-grace-input {
        display: inline-flex;
        align-items: center;
        gap: 10px;
      }

      .behavior-number-input {
        width: 5.5rem;
        min-width: 5.5rem;
        padding: 10px 6px;
        border-radius: 10px;
        border: 1px solid #31405f;
        background: #0d1426;
        color: var(--text);
        text-align: right;
      }

      .behavior-number-input::-webkit-inner-spin-button,
      .behavior-number-input::-webkit-outer-spin-button {
        margin-left: 4px;
      }

      .behavior-help-dialog {
        width: min(420px, calc(100vw - 32px));
        padding: 22px 24px;
        border-radius: 14px;
        border: 1px solid var(--panel-border);
        background: var(--panel);
        color: var(--text);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.32);
      }

      .behavior-help-dialog::backdrop {
        background: rgba(0, 0, 0, 0.6);
      }

      .behavior-help-dialog-title {
        margin: 0 0 12px;
        font-size: 1.05rem;
      }

      .behavior-help-dialog-text {
        margin: 0;
        color: var(--muted);
        line-height: 1.6;
      }

      html[data-theme="default"] .behavior-panel {
        border-radius: 8px;
        backdrop-filter: blur(16px) saturate(125%);
        -webkit-backdrop-filter: blur(16px) saturate(125%);
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.16);
        background: var(--panel);
        border: 1px solid var(--panel-border);
      }

      html[data-theme="default"] .rule[data-rule-origin="system"] .behavior-panel {
        background: var(--system-panel-bg);
        border-style: dashed;
        border-color: color-mix(in srgb, var(--system-rule-border) 85%, var(--panel-border) 15%);
      }

      html[data-theme="default"] .rule[data-rule-enabled="false"]:not([data-rule-origin="system"]) .behavior-panel {
        background: var(--user-rule-off-panel);
      }

      html[data-theme="default"] .behavior-panel > .section-header {
        padding: 8px 12px;
        border-bottom: 1px solid var(--panel-border);
      }

      html[data-theme="default"] .behavior-panel > .section-header > h3 {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      html[data-theme="default"] .behavior-body {
        padding: 12px;
      }

      html[data-theme="default"] .behavior-help-button {
        min-width: 28px;
        width: 28px;
        height: 28px;
        border: 0;
        background: transparent;
        color: var(--muted);
      }

      html[data-theme="default"] .behavior-help-button:hover:not(:disabled) {
        background: transparent;
        color: var(--text);
      }

      html[data-theme="default"] .behavior-number-input {
        border-radius: 8px;
        border: 1px solid var(--field-border);
        background: var(--field-bg);
      }

      html[data-theme="default"] .rule[data-rule-enabled="false"]:not([data-rule-origin="system"]) .behavior-number-input {
        background: color-mix(in srgb, var(--user-rule-off-head) 18%, var(--field-bg) 82%);
      }

      html[data-theme="default"] .behavior-help-dialog {
        width: min(640px, calc(100vw - 32px));
        padding: 18px 20px;
        border-radius: 12px;
        border: 1px solid var(--panel-border);
        background: var(--panel);
        color: var(--text);
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
      }

      html[data-theme="default"] .behavior-help-dialog::backdrop {
        background: rgba(3, 8, 20, 0.58);
      }

      @media (max-width: 900px) {
        .behavior-row {
          flex-direction: column;
          align-items: stretch;
        }

        .behavior-grace-field {
          width: 100%;
          max-width: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureBehaviorSection(root, rule) {
    const conditionsPanel = root.querySelector(".conditions-panel");
    if (!conditionsPanel) return;

    let panel = root.querySelector(".behavior-panel");
    if (!panel) {
      conditionsPanel.insertAdjacentHTML("beforebegin", behaviorMarkup());
      panel = root.querySelector(".behavior-panel");
    }

    wireBehaviorHelp(panel);

    const input = panel.querySelector(".rule-busy-end-grace-seconds");
    if (input) {
      input.value = formatBusyEndGraceSeconds(rule?.busyEndGraceMs);
      input.disabled = root.dataset.readonly === "true";
    }
  }

  function patchGlobals() {
    const originalNormalizeRuleForEditor = normalizeRuleForEditor;
    normalizeRuleForEditor = function(rule) {
      const normalized = originalNormalizeRuleForEditor(rule);
      normalized.busyEndGraceMs = normalizeBusyEndGraceMs(rule?.busyEndGraceMs);
      return normalized;
    };

    const originalCreateEmptyRule = createEmptyRule;
    createEmptyRule = function() {
      const rule = originalCreateEmptyRule();
      rule.busyEndGraceMs = DEFAULT_BUSY_END_GRACE_MS;
      return rule;
    };

    const originalBuildDefaultRules = buildDefaultRules;
    buildDefaultRules = function() {
      return originalBuildDefaultRules().map((rule) => ({
        ...rule,
        busyEndGraceMs: normalizeBusyEndGraceMs(rule.busyEndGraceMs)
      }));
    };

    if (typeof DEBUG_LOCAL_SANDBOX_PRESET === "object" && DEBUG_LOCAL_SANDBOX_PRESET) {
      DEBUG_LOCAL_SANDBOX_PRESET.busyEndGraceMs = normalizeBusyEndGraceMs(DEBUG_LOCAL_SANDBOX_PRESET.busyEndGraceMs);
    }

    const originalCreateRuleNode = createRuleNode;
    createRuleNode = function(rule, options) {
      const node = originalCreateRuleNode(rule, options);
      ensureBehaviorSection(node, rule);
      return node;
    };

    const originalDisableRuleEditing = disableRuleEditing;
    disableRuleEditing = function(root, options) {
      originalDisableRuleEditing(root, options);
      root.querySelector(".rule-busy-end-grace-seconds")?.setAttribute("disabled", "disabled");
    };

    const originalCollectRulesFromDom = collectRulesFromDom;
    collectRulesFromDom = function() {
      const rules = originalCollectRulesFromDom();
      const roots = Array.from(document.querySelectorAll(".rule"));
      return rules.map((rule, index) => ({
        ...rule,
        busyEndGraceMs: parseBusyEndGraceSeconds(
          roots[index]?.querySelector(".rule-busy-end-grace-seconds")?.value
        )
      }));
    };
  }

  async function rerenderFromStorage() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    let rules = Array.isArray(result[STORAGE_KEY]) && result[STORAGE_KEY].length
      ? result[STORAGE_KEY]
      : buildDefaultRules();

    let changed = false;
    rules = rules.map((rule) => {
      const busyEndGraceMs = normalizeBusyEndGraceMs(rule?.busyEndGraceMs);
      if (rule?.busyEndGraceMs === busyEndGraceMs) return rule;
      changed = true;
      return { ...rule, busyEndGraceMs };
    });

    if (changed) {
      await chrome.storage.local.set({ [STORAGE_KEY]: rules });
    }

    renderRules(rules.map(normalizeRuleForEditor));
    markClean?.();
  }

  function ready() {
    return (
      typeof renderRules === "function" &&
      typeof normalizeRuleForEditor === "function" &&
      typeof createRuleNode === "function" &&
      document.getElementById("rulesContainer")
    );
  }

  async function init() {
    patchStyles();
    if (!ready()) {
      setTimeout(init, 30);
      return;
    }

    patchGlobals();
    await rerenderFromStorage();
  }

  init().catch((error) => console.error("[TabBeacon] rule behavior patch failed", error));
})();
