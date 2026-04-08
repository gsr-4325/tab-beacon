const STORAGE_KEY = "tabBeaconRules";
const UI_STATE_KEY = "tabBeaconUiState";
const INDICATOR_SETTINGS_KEY = "tabBeaconIndicatorSettings";
const DEBUG_PRESET_SLUG = "debug-local-sandbox";
const SYSTEM_ORIGIN = "system";
const USER_ORIGIN = "user";

const I18N = window.TabBeaconI18n || { t: (key) => key, apply: () => {} };
const t = (key, substitutions) => I18N.t(key, substitutions);

function buildDefaultRules() {
  return [
    {
      id: crypto.randomUUID(),
      slug: `user-default-${crypto.randomUUID().slice(0, 8)}`,
      origin: USER_ORIGIN,
      readonly: false,
      name: "ChatGPT",
      enabled: true,
      matches: [
        "https://chatgpt.com/c/*",
        "https://chatgpt.com/g/*/c/*",
        "https://chatgpt.com/g/*/project*"
      ],
      matchMode: "any",
      busyWhen: [
        {
          source: "dom",
          selectorType: "css",
          query: '[aria-busy="true"]'
        },
        {
          source: "dom",
          selectorType: "css",
          query: '[data-testid="stop-button"]'
        },
        {
          source: "network",
          matchType: "pathPrefix",
          value: "/backend-api/f/conversation",
          method: "POST",
          resourceKind: "fetch-xhr"
        }
      ],
      domScopeMode: "selector",
      domScopes: [
        {
          selectorType: "css",
          query: "#thread"
        },
        {
          selectorType: "css",
          query: 'div[data-scroll-root] main#main'
        }
      ],
      useSmartBusySignals: true,
      iconMode: "overlaySpinner"
    },
    {
      id: crypto.randomUUID(),
      slug: `user-default-${crypto.randomUUID().slice(0, 8)}`,
      origin: USER_ORIGIN,
      readonly: false,
      name: "Gemini",
      enabled: true,
      matches: ["https://gemini.google.com/*"],
      matchMode: "any",
      busyWhen: [
        {
          source: "dom",
          selectorType: "css",
          query: 'button[aria-label="Stop response"]'
        },
        {
          source: "dom",
          selectorType: "css",
          query: ".bard-avatar.thinking"
        },
        {
          source: "dom",
          selectorType: "css",
          query: ".markdown-main-panel.animate"
        },
        {
          source: "network",
          matchType: "urlContains",
          value: "BardFrontendService/StreamGenerate",
          method: "POST",
          resourceKind: "fetch-xhr"
        }
      ],
      useSmartBusySignals: true,
      iconMode: "overlaySpinner"
    },
    {
      id: crypto.randomUUID(),
      slug: `user-default-${crypto.randomUUID().slice(0, 8)}`,
      origin: USER_ORIGIN,
      readonly: false,
      name: "Claude",
      enabled: true,
      matches: ["https://claude.ai/*"],
      matchMode: "any",
      busyWhen: [
        {
          source: "dom",
          selectorType: "css",
          query: 'button[aria-label="Stop response"]'
        },
        {
          source: "network",
          matchType: "regex",
          value: "chat_conversations/[^/]+/completion$",
          method: "POST",
          resourceKind: "fetch-xhr"
        }
      ],
      useSmartBusySignals: true,
      iconMode: "overlaySpinner"
    },
    {
      id: crypto.randomUUID(),
      slug: `user-default-${crypto.randomUUID().slice(0, 8)}`,
      origin: USER_ORIGIN,
      readonly: false,
      name: "Copilot",
      enabled: true,
      matches: ["https://www.copilot.com/*"],
      matchMode: "any",
      busyWhen: [
        {
          source: "dom",
          selectorType: "css",
          query: 'button[aria-label="Interrupt message"]'
        },
        {
          source: "dom",
          selectorType: "css",
          query: '[data-testid="stop-button"]'
        }
      ],
      useSmartBusySignals: true,
      iconMode: "overlaySpinner"
    }
  ];
}

const DEFAULT_RULES = buildDefaultRules();

const DEBUG_LOCAL_SANDBOX_PRESET = {
  id: `sys:${DEBUG_PRESET_SLUG}`,
  slug: DEBUG_PRESET_SLUG,
  origin: SYSTEM_ORIGIN,
  readonly: true,
  removable: true,
  nameKey: "presetDebugLocalSandboxName",
  enabled: true,
  matches: ["file:///*/tabbeacon-sandbox.html", "extension://*/tabbeacon-sandbox.html", "chrome-extension://*/tabbeacon-sandbox.html"],
  matchMode: "any",
  busyWhen: [
    {
      source: "dom",
      selectorType: "css",
      query: '[aria-busy="true"]'
    },
    {
      source: "network",
      matchType: "urlContains",
      value: "postman-echo.com",
      method: "GET",
      resourceKind: "fetch-xhr"
    }
  ],
  useSmartBusySignals: true,
  iconMode: "overlaySpinner"
};

const indicatorSettingsToggleButton = document.getElementById("indicatorSettingsToggle");
const indicatorSettingsBody = document.getElementById("indicatorSettingsBody");
const rulesToggleButton = document.getElementById("rulesToggle");
const rulesSectionBody = document.getElementById("rulesSectionBody");
const rulesContainer = document.getElementById("rulesContainer");
const ruleTemplate = document.getElementById("ruleTemplate");
const conditionTemplate = document.getElementById("conditionTemplate");
const scopeTemplate = document.getElementById("scopeTemplate");
const resetButton = document.getElementById("resetAll");
const resetConfirmModal = document.getElementById("resetConfirmModal");
const resetConfirmOkButton = document.getElementById("resetConfirmOk");
const resetConfirmCancelButton = document.getElementById("resetConfirmCancel");
const settingsDataTriggerButton = document.getElementById("settingsDataTrigger");
const importSettingsButton = document.getElementById("importSettings");
const exportSettingsButton = document.getElementById("exportSettings");
const importSettingsInput = document.getElementById("importSettingsInput");
const addRuleButton = document.getElementById("addRule");
const debugToggleButton = document.getElementById("debugToggle");
const debugModeSwitchButton = document.getElementById("debugModeSwitch");
const debugSectionBody = document.getElementById("debugSectionBody");
const debugPanel = document.getElementById("debugPanel");
const openPackagedSandboxButton = document.getElementById("openPackagedSandbox");
const copySettingsButton = document.getElementById("copySettings");
const debugPresetStatus = document.getElementById("debugPresetStatus");
let refreshDiagnosticTabsButton;
let refreshDiagnosticsButton;
let clearDiagnosticsButton;
let diagnosticTabSelect;
let diagnosticSummary;
let diagnosticsBody;
const versionText = document.getElementById("versionText");
const autosaveToast = document.getElementById("autosaveToast");
const autosaveToastIcon = autosaveToast?.querySelector(".autosave-toast-icon");
const autosaveToastText = autosaveToast?.querySelector(".autosave-toast-text");
const COLLAPSE_AREA_SELECTOR = ".collapse-area";
const COLLAPSE_TOGGLE_BUTTON_SELECTOR = ".collapse-toggle-button";
const MOTION_FADE_MS = 220;
const MOTION_SLIDE_MS = 170;
const AUTOSAVE_DEBOUNCE_MS = 1500;
const AUTOSAVE_TOAST_MS = 2600;
let autosaveTimerId = 0;
let autosaveHideTimerId = 0;
let autosaveInFlight = null;
let autosaveQueued = false;
let autosaveDirty = false;
let autosaveRevision = 0;
let autosaveSavedRevision = 0;

init().catch((error) => {
  console.error("[TabBeacon] options init failed", error);
});

async function init() {
  ensureDiagnosticsUi();
  I18N.apply(document);
  setSectionExpanded(indicatorSettingsToggleButton, indicatorSettingsBody, indicatorSettingsToggleButton?.getAttribute("aria-expanded") !== "false");
  setSectionExpanded(rulesToggleButton, rulesSectionBody, rulesToggleButton?.getAttribute("aria-expanded") !== "false");
  openPackagedSandboxButton.setAttribute("title", t("debugOpenPackagedSandbox"));
  syncIconButtonLabels();
  versionText.textContent = `v${chrome.runtime.getManifest().version}`;
  const [rulesResult, uiStateResult] = await Promise.all([
    chrome.storage.local.get(STORAGE_KEY),
    chrome.storage.local.get(UI_STATE_KEY)
  ]);

  const hasStoredRules = Array.isArray(rulesResult[STORAGE_KEY]) && rulesResult[STORAGE_KEY].length > 0;
  let initialRules = hasStoredRules ? rulesResult[STORAGE_KEY] : DEFAULT_RULES;

  initialRules = migrateRules(initialRules);

  const uiState = uiStateResult[UI_STATE_KEY] || {};

  if (hasStoredRules) {
    initialRules = await seedMissingDefaults(initialRules, uiState);
  }

  const debugModeEnabled = !!uiState.debugMode;
  const syncedInitialRules = syncRulesWithDebugMode(initialRules, debugModeEnabled);
  if (!areRulesEqual(initialRules, syncedInitialRules)) {
    await chrome.storage.local.set({ [STORAGE_KEY]: syncedInitialRules });
    initialRules = syncedInitialRules;
  }

  const normalizedRules = initialRules.map(normalizeRuleForEditor);
  renderRules(normalizedRules);
  bindGlobalActions();

  const debugExpanded = typeof uiState.debugExpanded === "boolean"
    ? uiState.debugExpanded
    : !!uiState.showDebugTools;

  setDebugSectionExpanded(debugExpanded);
  setDebugModeSwitchState(debugModeEnabled);
  updateDebugPresetStatus(normalizedRules);

  if (debugExpanded) {
    await refreshDiagnosticTabs({ refreshDiagnostics: true });
  } else {
    renderDiagnosticEmptyState("networkDiagnosticsEmptyState");
  }
}

function syncIconButtonLabels(root = document) {
  root.querySelectorAll("button[title]").forEach((button) => {
    const title = button.getAttribute("title");
    if (title) {
      button.setAttribute("aria-label", title);
    }
  });
}

function autosaveSavingIconSvg() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8" opacity="0.28"></circle>
      <path d="M12 4a8 8 0 0 1 8 8"></path>
    </svg>
  `;
}

function autosaveSavedIconSvg() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 12.5l4.5 4.5L19 7.5"></path>
    </svg>
  `;
}

function autosaveErrorIconSvg() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.5"></circle>
      <path d="M12 8v5"></path>
      <circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none"></circle>
    </svg>
  `;
}

function clearAutosaveTimer() {
  if (!autosaveTimerId) return;
  window.clearTimeout(autosaveTimerId);
  autosaveTimerId = 0;
}

function clearAutosaveHideTimer() {
  if (!autosaveHideTimerId) return;
  window.clearTimeout(autosaveHideTimerId);
  autosaveHideTimerId = 0;
}

function hideAutosaveToast() {
  clearAutosaveHideTimer();
  if (!autosaveToast) return;
  autosaveToast.classList.remove("is-visible");
  autosaveToast.setAttribute("aria-hidden", "true");
}

function messageText(key, fallbackText) {
  const translated = t(key);
  return translated === key ? fallbackText : translated;
}

function setSwitchButtonState(button, enabled, { disabled = false } = {}) {
  if (!button) return;
  const switchText = button.querySelector(".default-rule-switch-text");
  button.classList.toggle("active", !!enabled);
  button.classList.toggle("disabled", !!disabled);
  button.disabled = !!disabled;
  button.setAttribute("aria-pressed", String(!!enabled));
  if (switchText) {
    switchText.textContent = enabled ? t("win11SwitchOn") : t("win11SwitchOff");
  }
}

function setSectionExpanded(toggleButton, body, expanded) {
  if (!toggleButton || !body) return;
  body.classList.toggle("hidden", !expanded);
  toggleButton.setAttribute("aria-expanded", String(expanded));
}

function shouldIgnoreCollapseAreaClick(target) {
  return !!target.closest("button, input, textarea, select, a, label, [contenteditable='true']");
}

function handleCollapseAreaClick(event) {
  const area = event.target.closest(COLLAPSE_AREA_SELECTOR);
  if (!area || shouldIgnoreCollapseAreaClick(event.target)) return;
  const toggleButton = area.querySelector(COLLAPSE_TOGGLE_BUTTON_SELECTOR);
  if (!toggleButton) return;
  toggleButton.click();
}

function showAutosaveToast(state, messageKey, fallbackText) {
  if (!autosaveToast || !autosaveToastIcon || !autosaveToastText) return;

  clearAutosaveHideTimer();
  autosaveToast.dataset.state = state;
  autosaveToast.classList.add("is-visible");
  autosaveToast.setAttribute("aria-hidden", "false");
  autosaveToastText.textContent = messageText(messageKey, fallbackText);

  if (state === "saving") {
    autosaveToastIcon.innerHTML = autosaveSavingIconSvg();
  } else if (state === "error") {
    autosaveToastIcon.innerHTML = autosaveErrorIconSvg();
  } else {
    autosaveToastIcon.innerHTML = autosaveSavedIconSvg();
  }

  if (state !== "saving") {
    autosaveHideTimerId = window.setTimeout(() => {
      hideAutosaveToast();
    }, AUTOSAVE_TOAST_MS);
  }
}

function getIndicatorSettingsApi() {
  const api = window.TabBeaconIndicatorSettings;
  return api && typeof api.saveSettings === "function" && document.getElementById("indicatorSettingsCard") ? api : null;
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function buildExportFileName() {
  const manifestName = chrome.runtime.getManifest()?.name || "tab-beacon";
  const safeName = manifestName
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "tab-beacon";
  const now = new Date();
  const dateStamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("");
  const timeStamp = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ].join("");
  return `${safeName}-${dateStamp}-${timeStamp}.json`;
}

async function ensureLatestSettingsStored() {
  clearAutosaveTimer();
  if (autosaveDirty) {
    await flushAutosave();
    if (autosaveDirty) {
      throw new Error("Latest settings could not be persisted before export");
    }
    return;
  }
  await waitForAutosaveIdle();
}

async function buildSettingsSnapshot() {
  const indicatorSettingsApi = getIndicatorSettingsApi();
  const [rulesResult, uiStateResult, indicatorSettings] = await Promise.all([
    chrome.storage.local.get(STORAGE_KEY),
    chrome.storage.local.get(UI_STATE_KEY),
    indicatorSettingsApi?.loadSettings?.() || chrome.storage.local.get(INDICATOR_SETTINGS_KEY).then((result) => result[INDICATOR_SETTINGS_KEY] || {})
  ]);

  return {
    appName: chrome.runtime.getManifest()?.name || "Tab Beacon",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    rules: rulesResult[STORAGE_KEY] || [],
    uiState: uiStateResult[UI_STATE_KEY] || {},
    indicatorSettings: indicatorSettings || {}
  };
}

function downloadTextFile(filename, content, mimeType = "application/json") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

async function applyImportedSettings(payload) {
  if (!isPlainObject(payload) || !Array.isArray(payload.rules)) {
    throw new Error("Invalid settings file");
  }

  const indicatorSettingsApi = getIndicatorSettingsApi();
  const [currentUiStateResult, currentIndicatorSettings] = await Promise.all([
    chrome.storage.local.get(UI_STATE_KEY),
    indicatorSettingsApi?.loadSettings?.() || chrome.storage.local.get(INDICATOR_SETTINGS_KEY).then((result) => result[INDICATOR_SETTINGS_KEY] || {})
  ]);

  const mergedUiState = isPlainObject(payload.uiState)
    ? { ...(currentUiStateResult[UI_STATE_KEY] || {}), ...payload.uiState }
    : (currentUiStateResult[UI_STATE_KEY] || {});
  const debugModeEnabled = !!mergedUiState.debugMode;
  const importedRules = syncRulesWithDebugMode(migrateRules(payload.rules), debugModeEnabled);
  const nextIndicatorSettings = isPlainObject(payload.indicatorSettings)
    ? payload.indicatorSettings
    : currentIndicatorSettings;

  clearAutosaveTimer();
  await waitForAutosaveIdle();

  await Promise.all([
    chrome.storage.local.set({ [STORAGE_KEY]: importedRules }),
    chrome.storage.local.set({ [UI_STATE_KEY]: mergedUiState }),
    chrome.storage.local.set({ [INDICATOR_SETTINGS_KEY]: nextIndicatorSettings })
  ]);

  renderRules(importedRules.map(normalizeRuleForEditor));
  const debugExpanded = typeof mergedUiState.debugExpanded === "boolean"
    ? mergedUiState.debugExpanded
    : !!mergedUiState.showDebugTools;
  setDebugSectionExpanded(debugExpanded);
  setDebugModeSwitchState(debugModeEnabled);
  updateDebugPresetStatus(importedRules);

  if (indicatorSettingsApi) {
    const normalizedIndicatorSettings = await indicatorSettingsApi.loadSettings();
    indicatorSettingsApi.applySettingsToDom(normalizedIndicatorSettings);
  }

  markClean();

  if (debugExpanded) {
    await refreshDiagnosticTabs({ refreshDiagnostics: true });
  } else {
    renderDiagnosticEmptyState("networkDiagnosticsEmptyState");
  }
}

async function persistEditorSettings() {
  const rules = syncRulesWithDebugMode(collectRulesFromDom(), isDebugModeEnabled());
  const saves = [chrome.storage.local.set({ [STORAGE_KEY]: rules })];
  const indicatorSettingsApi = getIndicatorSettingsApi();
  if (indicatorSettingsApi) {
    saves.push(indicatorSettingsApi.saveSettings());
  }
  await Promise.all(saves);
  updateDebugPresetStatus(rules);
  return rules;
}

function scheduleAutosave({ immediate = false } = {}) {
  autosaveDirty = true;
  autosaveRevision += 1;
  clearAutosaveTimer();

  if (immediate) {
    void flushAutosave();
    return;
  }

  autosaveTimerId = window.setTimeout(() => {
    void flushAutosave();
  }, AUTOSAVE_DEBOUNCE_MS);
}

function markDirty(options = {}) {
  scheduleAutosave(options);
}

function markClean() {
  autosaveDirty = false;
  autosaveQueued = false;
  autosaveSavedRevision = autosaveRevision;
  clearAutosaveTimer();
}

async function waitForAutosaveIdle() {
  if (autosaveInFlight) {
    await autosaveInFlight;
  }
}

async function flushAutosave() {
  clearAutosaveTimer();

  if (!autosaveDirty) return;
  if (autosaveInFlight) {
    autosaveQueued = true;
    return;
  }

  const targetRevision = autosaveRevision;
  showAutosaveToast("saving", "autosaveSaving", "Saving settings...");

  autosaveInFlight = (async () => {
    try {
      await persistEditorSettings();
      autosaveSavedRevision = targetRevision;
      autosaveDirty = autosaveRevision > autosaveSavedRevision;
      showAutosaveToast("saved", "autosaveUpdated", "Updated settings");
    } catch (error) {
      console.error("[TabBeacon] autosave failed", error);
      autosaveDirty = true;
      showAutosaveToast("error", "autosaveFailed", "Couldn't save settings");
    } finally {
      autosaveInFlight = null;
      if (autosaveRevision > autosaveSavedRevision || autosaveQueued) {
        autosaveQueued = false;
        autosaveTimerId = window.setTimeout(() => {
          void flushAutosave();
        }, AUTOSAVE_DEBOUNCE_MS);
      } else {
        autosaveQueued = false;
      }
    }
  })();

  await autosaveInFlight;
}

function bindGlobalActions() {
  rulesContainer.addEventListener("input", markDirty);
  rulesContainer.addEventListener("change", markDirty);
  document.addEventListener("click", handleCollapseAreaClick);

  indicatorSettingsToggleButton?.addEventListener("click", () => {
    const expanded = indicatorSettingsToggleButton.getAttribute("aria-expanded") !== "true";
    setSectionExpanded(indicatorSettingsToggleButton, indicatorSettingsBody, expanded);
  });

  rulesToggleButton?.addEventListener("click", () => {
    const expanded = rulesToggleButton.getAttribute("aria-expanded") !== "true";
    setSectionExpanded(rulesToggleButton, rulesSectionBody, expanded);
  });

  addRuleButton.addEventListener("click", async () => {
    const node = createRuleNode(createEmptyRule(), { collapsed: false });
    rulesContainer.prepend(node);
    await animateElementEnter(node);
    node.querySelector(".rule-name")?.focus();
    markDirty();
  });

  resetButton.addEventListener("click", () => {
    resetConfirmModal.showModal();
  });

  resetConfirmCancelButton.addEventListener("click", () => {
    resetConfirmModal.close();
  });

  resetConfirmOkButton.addEventListener("click", async () => {
    resetConfirmModal.close();
    const uiState = (await chrome.storage.local.get(UI_STATE_KEY))[UI_STATE_KEY] || {};
    const freshRules = syncRulesWithDebugMode(buildDefaultRules(), false);
    const indicatorSettingsApi = getIndicatorSettingsApi();
    clearAutosaveTimer();
    await waitForAutosaveIdle();
    setDebugModeSwitchState(false);
    showAutosaveToast("saving", "autosaveSaving", "Saving settings...");
    try {
      await Promise.all([
        chrome.storage.local.set({ [STORAGE_KEY]: freshRules }),
        chrome.storage.local.set({ [UI_STATE_KEY]: { ...uiState, debugMode: false } }),
        indicatorSettingsApi?.resetSettings?.()
      ]);
      renderRules(freshRules.map(normalizeRuleForEditor));
      markClean();
      updateDebugPresetStatus(freshRules);
      showAutosaveToast("saved", "autosaveUpdated", "Updated settings");
      if (isDebugSectionExpanded()) {
        await refreshNetworkDiagnosticsForSelectedTab();
      }
    } catch (error) {
      console.error("[TabBeacon] reset failed", error);
      showAutosaveToast("error", "autosaveFailed", "Couldn't save settings");
    }
  });

  debugToggleButton.addEventListener("click", async () => {
    const expanded = !isDebugSectionExpanded();
    setDebugSectionExpanded(expanded);
    const uiState = (await chrome.storage.local.get(UI_STATE_KEY))[UI_STATE_KEY] || {};
    await chrome.storage.local.set({ [UI_STATE_KEY]: { ...uiState, debugExpanded: expanded } });
    if (expanded) {
      await refreshDiagnosticTabs({ refreshDiagnostics: true });
    }
  });

  debugModeSwitchButton.addEventListener("click", async () => {
    const enabled = !isDebugModeEnabled();
    setDebugModeSwitchState(enabled);
    const uiState = (await chrome.storage.local.get(UI_STATE_KEY))[UI_STATE_KEY] || {};
    const rules = syncRulesWithDebugMode(collectRulesFromDom(), enabled);
    const indicatorSettingsApi = getIndicatorSettingsApi();
    clearAutosaveTimer();
    await waitForAutosaveIdle();
    showAutosaveToast("saving", "autosaveSaving", "Saving settings...");
    try {
      await Promise.all([
        chrome.storage.local.set({ [UI_STATE_KEY]: { ...uiState, debugMode: enabled } }),
        chrome.storage.local.set({ [STORAGE_KEY]: rules }),
        indicatorSettingsApi?.saveSettings?.()
      ]);
      await reconcileRulesWithAnimation(rules.map(normalizeRuleForEditor));
      updateDebugPresetStatus(rules);
      markClean();
      showAutosaveToast("saved", "autosaveUpdated", "Updated settings");
      if (isDebugSectionExpanded()) {
        await refreshNetworkDiagnosticsForSelectedTab();
      }
    } catch (error) {
      console.error("[TabBeacon] failed to update debug mode", error);
      setDebugModeSwitchState(!enabled);
      showAutosaveToast("error", "autosaveFailed", "Couldn't save settings");
    }
  });

  openPackagedSandboxButton.addEventListener("click", async () => {
    await chrome.tabs.create({ url: chrome.runtime.getURL("manual-tests/tabbeacon-sandbox.html") });
  });

  settingsDataTriggerButton?.addEventListener("click", (event) => {
    event.preventDefault();
    settingsDataTriggerButton.focus();
  });

  importSettingsButton?.addEventListener("click", () => {
    importSettingsInput?.click();
  });

  importSettingsInput?.addEventListener("change", async () => {
    const [file] = importSettingsInput.files || [];
    if (!file) return;

    showAutosaveToast("saving", "importingSettings", "Importing settings...");
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      await applyImportedSettings(payload);
      showAutosaveToast("saved", "importedSettings", "Imported settings");
    } catch (error) {
      console.error("[TabBeacon] failed to import settings", error);
      showAutosaveToast("error", "importSettingsFailed", "Couldn't import settings");
    } finally {
      importSettingsInput.value = "";
    }
  });

  exportSettingsButton?.addEventListener("click", async () => {
    showAutosaveToast("saving", "exportingSettings", "Exporting settings...");
    try {
      await ensureLatestSettingsStored();
      const snapshot = await buildSettingsSnapshot();
      downloadTextFile(buildExportFileName(), JSON.stringify(snapshot, null, 2));
      showAutosaveToast("saved", "exportedSettings", "Exported settings");
    } catch (error) {
      console.error("[TabBeacon] failed to export settings", error);
      showAutosaveToast("error", "exportSettingsFailed", "Couldn't export settings");
    }
  });

  copySettingsButton.addEventListener("click", async () => {
    const settings = await buildSettingsSnapshot();
    await navigator.clipboard.writeText(JSON.stringify(settings, null, 2));

    // Show check icon for 3.5 seconds
    const copyIcon = copySettingsButton.querySelector(".copy-icon");
    const checkIcon = copySettingsButton.querySelector(".check-icon");
    const copiedTitle = t("copiedSettings");
    const defaultTitle = t("debugCopySettings");

    copyIcon.style.display = "none";
    checkIcon.style.display = "flex";
    copySettingsButton.setAttribute("title", copiedTitle);
    copySettingsButton.setAttribute("aria-label", copiedTitle);

    setTimeout(() => {
      copyIcon.style.display = "flex";
      checkIcon.style.display = "none";
      copySettingsButton.setAttribute("title", defaultTitle);
      copySettingsButton.setAttribute("aria-label", defaultTitle);
    }, 3500);
  });

  refreshDiagnosticTabsButton.addEventListener("click", async () => {
    await refreshDiagnosticTabs({ refreshDiagnostics: false });
  });

  refreshDiagnosticsButton.addEventListener("click", async () => {
    await refreshNetworkDiagnosticsForSelectedTab();
  });

  clearDiagnosticsButton.addEventListener("click", async () => {
    await clearDiagnosticsForSelectedTab();
  });

  diagnosticTabSelect.addEventListener("change", async () => {
    await refreshNetworkDiagnosticsForSelectedTab();
  });
}

// Adds any default presets that have never been seeded into stored rules.
// Uses uiState.seededPresets to track which preset names were already introduced,
// so user-deleted presets are not re-added on subsequent loads.
function extractHostnames(matches) {
  const hosts = new Set();
  for (const m of (matches || [])) {
    try { hosts.add(new URL(m.replace(/\*/g, "x")).hostname); } catch {}
  }
  return hosts;
}

async function seedMissingDefaults(rules, uiState) {
  const seededPresets = new Set(Array.isArray(uiState.seededPresets) ? uiState.seededPresets : []);
  const defaults = buildDefaultRules();
  const existingNames = new Set(rules.map((r) => r.name));
  const existingHostnames = rules.flatMap((r) => [...extractHostnames(r.matches)]);

  const toAdd = defaults.filter((d) => {
    if (seededPresets.has(d.name) || existingNames.has(d.name)) return false;
    // Skip if an existing rule already covers the same hostnames (e.g. renamed legacy rule)
    const defaultHosts = extractHostnames(d.matches);
    return !existingHostnames.some((h) => defaultHosts.has(h));
  });

  const allDefaultNames = defaults.map((d) => d.name);
  const updatedSeeded = [...new Set([...seededPresets, ...allDefaultNames])];
  const seededChanged = updatedSeeded.length !== seededPresets.size;

  if (!toAdd.length && !seededChanged) return rules;

  const updatedRules = toAdd.length ? [...rules, ...toAdd] : rules;
  const updatedUiState = { ...uiState, seededPresets: updatedSeeded };

  const saves = [];
  if (toAdd.length) saves.push(chrome.storage.local.set({ [STORAGE_KEY]: updatedRules }));
  if (seededChanged) saves.push(chrome.storage.local.set({ [UI_STATE_KEY]: updatedUiState }));
  await Promise.all(saves);

  return updatedRules;
}

function migrateRules(rules) {
  let changed = false;
  const migrated = rules.map((rule) => {
    if (!Array.isArray(rule.busyWhen)) return rule;
    const filtered = rule.busyWhen.filter(
      (c) => !(c.source === "dom" && c.query === '[aria-busy="true"]' && rule.name === "Gemini")
    );
    const removable = !!rule.removable;
    // Rename legacy content-script fallback rule name
    const name = rule.name === "ChatGPT (starter)" ? "ChatGPT" : rule.name;
    const matches = Array.isArray(rule.matches) ? [...rule.matches] : [];
    const shouldAddChatGptProjectMatch = name === "ChatGPT"
      && matches.some((m) => typeof m === "string" && m.includes("chatgpt.com"))
      && !matches.includes("https://chatgpt.com/g/*/project*");
    if (shouldAddChatGptProjectMatch) {
      matches.push("https://chatgpt.com/g/*/project*");
    }
    if (
      filtered.length === rule.busyWhen.length
      && removable === !!rule.removable
      && name === rule.name
      && !shouldAddChatGptProjectMatch
    ) return rule;
    changed = true;
    return { ...rule, name, busyWhen: filtered, removable, matches };
  });
  if (changed) {
    chrome.storage.local.set({ [STORAGE_KEY]: migrated });
  }
  return migrated;
}

function normalizeRuleForEditor(rule) {
  const legacyDomScopeQuery = typeof rule.domScopeQuery === "string"
    ? rule.domScopeQuery
    : (typeof rule.domScopeSelector === "string" ? rule.domScopeSelector : "");
  const domScopeMode = ["auto", "document", "selector"].includes(rule.domScopeMode)
    ? rule.domScopeMode
    : ((Array.isArray(rule.domScopes) && rule.domScopes.length) || legacyDomScopeQuery ? "selector" : "auto");
  const domScopes = Array.isArray(rule.domScopes) && rule.domScopes.length
    ? rule.domScopes
    : legacyDomScopeQuery
      ? [{
          selectorType: ["auto", "css", "xpath"].includes(rule.domScopeSelectorType) ? rule.domScopeSelectorType : "auto",
          query: legacyDomScopeQuery
        }]
      : [createEmptyScope()];
  const busyWhen = Array.isArray(rule.busyWhen) && rule.busyWhen.length
    ? rule.busyWhen
    : rule.busyQuery
      ? [{ source: "dom", selectorType: rule.selectorType || "auto", query: rule.busyQuery }]
      : [{ source: "dom", selectorType: "auto", query: "" }];

  const id = rule.id || crypto.randomUUID();
  const origin = rule.origin === SYSTEM_ORIGIN ? SYSTEM_ORIGIN : USER_ORIGIN;
  const nameKey = origin === SYSTEM_ORIGIN ? (rule.nameKey || DEBUG_LOCAL_SANDBOX_PRESET.nameKey) : undefined;
  const name = origin === SYSTEM_ORIGIN && nameKey ? t(nameKey) : (rule.name || "");

  return {
    id,
    slug: rule.slug || generateUserSlug(name || rule.name || t("untitledRule"), id),
    origin,
    readonly: origin === SYSTEM_ORIGIN ? true : !!rule.readonly,
    removable: !!rule.removable,
    name,
    nameKey,
    enabled: rule.enabled !== false,
    matches: Array.isArray(rule.matches) ? rule.matches : [],
    matchMode: rule.matchMode === "all" ? "all" : "any",
    busyWhen: busyWhen.map((condition) => ({
      source: condition.source === "network" ? "network" : "dom",
      selectorType: condition.selectorType || "auto",
      query: condition.query || "",
      matchType: condition.matchType || "urlContains",
      value: condition.value || "",
      method: condition.method || "ANY",
      resourceKind: condition.resourceKind || "any"
    })),
    domScopeMode,
    domScopes: domScopes.map((scope) => ({
      selectorType: ["auto", "css", "xpath"].includes(scope.selectorType) ? scope.selectorType : "auto",
      query: typeof scope.query === "string" ? scope.query : ""
    })),
    useSmartBusySignals: rule.useSmartBusySignals !== false,
    iconMode: rule.iconMode || "overlaySpinner"
  };
}

function renderRules(rules) {
  rulesContainer.innerHTML = "";
  rules.forEach((rule) => {
    const node = createRuleNode(rule);
    rulesContainer.appendChild(node);
  });
  updateDebugPresetStatus(rules);
}

function createRuleNode(rule = createEmptyRule(), options = {}) {
  const { collapsed = true } = options;
  const fragment = ruleTemplate.content.cloneNode(true);
  const root = fragment.querySelector(".rule");
  const conditionsContainer = root.querySelector(".conditions-container");
  const nameInput = root.querySelector(".rule-name");
  const removeRuleButton = root.querySelector(".remove-rule");
  const originBadge = root.querySelector(".rule-origin-badge");
  const readonlyNote = root.querySelector(".rule-readonly-note");
  const ruleToggleButton = root.querySelector(".rule-toggle");

  I18N.apply(root);
  syncIconButtonLabels(root);

  root.dataset.ruleId = rule.id;
  root.dataset.ruleSlug = rule.slug;
  root.dataset.ruleOrigin = rule.origin;
  root.dataset.readonly = String(!!rule.readonly);
  root.dataset.removable = String(!!rule.removable);
  root.dataset.surfaceTone = rule.origin === SYSTEM_ORIGIN ? "neutral" : "accent";
  if (rule.nameKey) {
    root.dataset.ruleNameKey = rule.nameKey;
  }

  nameInput.value = rule.name || "";
  const enabledInput = root.querySelector(".rule-enabled");
  const enableSwitchButton = root.querySelector(".rule-enable-switch");
  enabledInput.checked = !!rule.enabled;
  setRuleEnabledState(root, enabledInput.checked);
  setSwitchButtonState(enableSwitchButton, enabledInput.checked);
  root.querySelector(".rule-matches").value = (rule.matches || []).join("\n");
  root.querySelector(".rule-match-mode").value = rule.matchMode || "any";
  root.querySelector(".rule-smart-busy").checked = !!rule.useSmartBusySignals;
  const scopeModeEl = root.querySelector(".rule-dom-scope-mode");
  const scopeSelectorFieldsEl = root.querySelector(".scope-selector-fields");
  const scopeListEl = root.querySelector(".scope-list");
  const addScopeButton = root.querySelector(".add-scope");
  const scopeHintEl = root.querySelector(".rule-scope-hint");

  scopeModeEl.value = rule.domScopeMode || "auto";
  (rule.domScopes || []).forEach((scope) => {
    scopeListEl.appendChild(createScopeNode(scope, rule.readonly));
  });
  if (!scopeListEl.children.length) {
    scopeListEl.appendChild(createScopeNode(undefined, rule.readonly));
  }
  refreshScopeIndexes(scopeListEl);

  const updateScopeUi = () => {
    const mode = scopeModeEl.value;
    scopeSelectorFieldsEl.classList.toggle("hidden", mode !== "selector");

    if (mode === "auto") {
      scopeHintEl.textContent = t("hintScopeAutomatic");
      return;
    }

    if (mode === "document") {
      scopeHintEl.textContent = t("hintScopeWholePage");
      return;
    }

    const filledScopes = collectScopesFromRuleRoot(root).filter((scope) => scope.query);
    if (!filledScopes.length) {
      scopeHintEl.textContent = t("hintScopeEmpty");
      return;
    }

    scopeHintEl.textContent = t("hintScopeSpecificAreas");
  };

  originBadge.textContent = rule.origin === SYSTEM_ORIGIN ? t("ruleOriginSystem") : t("ruleOriginUser");
  readonlyNote.classList.toggle("hidden", !rule.readonly);

  (rule.busyWhen || []).forEach((condition) => {
    conditionsContainer.appendChild(createConditionNode(condition, rule.readonly));
  });

  if (!conditionsContainer.children.length) {
    conditionsContainer.appendChild(createConditionNode(undefined, rule.readonly));
  }

  refreshConditionIndexes(conditionsContainer);

  root.querySelector(".add-condition").addEventListener("click", async () => {
    const node = createConditionNode(undefined, rule.readonly);
    conditionsContainer.appendChild(node);
    refreshConditionIndexes(conditionsContainer);
    await animateElementEnter(node);
    markDirty();
  });

  addScopeButton.addEventListener("click", async () => {
    if (rule.readonly) return;
    const node = createScopeNode(undefined, rule.readonly);
    scopeListEl.appendChild(node);
    refreshScopeIndexes(scopeListEl);
    await animateElementEnter(node);
    updateScopeUi();
    markDirty();
  });

  [scopeModeEl, scopeListEl].forEach((el) => {
    el.addEventListener("input", updateScopeUi);
    el.addEventListener("change", updateScopeUi);
  });
  updateScopeUi();

  ruleToggleButton.addEventListener("click", () => {
    setRuleCollapsed(root, !root.classList.contains("collapsed"));
  });

  removeRuleButton.disabled = !canRemoveRule(rule);
  removeRuleButton.addEventListener("click", async () => {
    if (!canRemoveRule(rule)) return;
    await animateElementExit(root);
    updateDebugPresetStatus(collectRulesFromDom());
    markDirty();
  });

  if (rule.readonly) {
    root.classList.add("readonly-rule");
    nameInput.readOnly = true;
    disableRuleEditing(root, { allowRemove: !!rule.removable });
  }

  setSwitchButtonState(enableSwitchButton, enabledInput.checked, { disabled: enabledInput.disabled });

  enableSwitchButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (enableSwitchButton.disabled) return;
    enabledInput.checked = !enabledInput.checked;
    enabledInput.dispatchEvent(new Event("input", { bubbles: true }));
    enabledInput.dispatchEvent(new Event("change", { bubbles: true }));
  });

  enabledInput.addEventListener("input", () => {
    setRuleEnabledState(root, enabledInput.checked);
    setSwitchButtonState(enableSwitchButton, enabledInput.checked, { disabled: enabledInput.disabled });
  });
  enabledInput.addEventListener("change", () => {
    setRuleEnabledState(root, enabledInput.checked);
    setSwitchButtonState(enableSwitchButton, enabledInput.checked, { disabled: enabledInput.disabled });
  });

  setRuleCollapsed(root, collapsed);
  return root;
}

function canRemoveRule(rule) {
  return !rule.readonly || !!rule.removable;
}

function setRuleEnabledState(root, enabled) {
  root.dataset.ruleEnabled = String(!!enabled);
  root.dataset.surfaceState = enabled ? "active" : "muted";
}

function disableRuleEditing(root, { allowRemove = false } = {}) {
  root.querySelectorAll(".rule-enabled, .rule-enable-switch, .rule-matches, .rule-match-mode, .rule-smart-busy, .add-condition, .rule-dom-scope-mode, .add-scope, .scope-selector-type, .scope-query").forEach((el) => {
    el.disabled = true;
  });
  if (!allowRemove) {
    root.querySelectorAll(".remove-rule, .remove-scope").forEach((el) => {
      el.disabled = true;
    });
  }
}

function createConditionNode(condition = createEmptyCondition(), readonly = false) {
  const fragment = conditionTemplate.content.cloneNode(true);
  const root = fragment.querySelector(".condition");
  const sourceEl = root.querySelector(".condition-source");
  const selectorTypeEl = root.querySelector(".condition-selector-type");
  const queryEl = root.querySelector(".condition-query");
  const matchTypeEl = root.querySelector(".condition-match-type");
  const valueEl = root.querySelector(".condition-value");
  const methodEl = root.querySelector(".condition-method");
  const resourceKindEl = root.querySelector(".condition-resource-kind");
  const domFields = root.querySelector(".condition-dom-fields");
  const networkFields = root.querySelector(".condition-network-fields");
  const hintEl = root.querySelector(".condition-hint");
  const removeConditionButton = root.querySelector(".remove-condition");
  const toggleButton = root.querySelector(".condition-toggle");
  const summaryEl = root.querySelector(".condition-summary");

  I18N.apply(root);
  syncIconButtonLabels(root);

  sourceEl.value = condition.source || "dom";
  selectorTypeEl.value = condition.selectorType || "auto";
  queryEl.value = condition.query || "";
  matchTypeEl.value = condition.matchType || "urlContains";
  valueEl.value = condition.value || "";
  methodEl.value = condition.method || "ANY";
  resourceKindEl.value = condition.resourceKind || "any";

  const update = () => {
    const source = sourceEl.value;
    domFields.classList.toggle("hidden", source !== "dom");
    networkFields.classList.toggle("hidden", source !== "network");
    const summary = buildConditionSummary({
      source,
      selectorType: selectorTypeEl.value,
      query: queryEl.value.trim(),
      matchType: matchTypeEl.value,
      value: valueEl.value.trim(),
      method: methodEl.value,
      resourceKind: resourceKindEl.value
    });
    summaryEl.textContent = summary;
    updateConditionHint({
      source,
      selectorType: selectorTypeEl.value,
      query: queryEl.value.trim(),
      matchType: matchTypeEl.value,
      value: valueEl.value.trim(),
      method: methodEl.value,
      resourceKind: resourceKindEl.value
    }, hintEl);
  };

  [sourceEl, selectorTypeEl, queryEl, matchTypeEl, valueEl, methodEl, resourceKindEl].forEach((el) => {
    el.addEventListener("input", update);
    el.addEventListener("change", update);
  });

  toggleButton.addEventListener("click", () => {
    const collapsed = !root.classList.contains("collapsed");
    setConditionCollapsed(root, collapsed);
  });

  update();

  removeConditionButton.addEventListener("click", async () => {
    if (readonly) return;
    const parent = root.parentElement;
    await animateElementExit(root);
    if (parent && !parent.children.length) {
      const replacement = createConditionNode(undefined, readonly);
      parent.appendChild(replacement);
      await animateElementEnter(replacement);
    }
    if (parent) {
      refreshConditionIndexes(parent);
    }
    markDirty();
  });

  if (readonly) {
    root.classList.add("readonly-condition");
    [sourceEl, selectorTypeEl, queryEl, matchTypeEl, valueEl, methodEl, resourceKindEl, removeConditionButton].forEach((el) => {
      el.disabled = true;
      if ("readOnly" in el) el.readOnly = true;
    });
  }

  setConditionCollapsed(root, false);
  return root;
}

function refreshConditionIndexes(container) {
  Array.from(container.querySelectorAll(".condition")).forEach((conditionRoot, index) => {
    const indexEl = conditionRoot.querySelector(".condition-index");
    if (indexEl) {
      indexEl.textContent = String(index + 1);
    }
  });
}

function refreshScopeIndexes(container) {
  Array.from(container.querySelectorAll(".scope-entry")).forEach((scopeRoot, index) => {
    const indexEl = scopeRoot.querySelector(".scope-entry-index");
    if (indexEl) {
      indexEl.textContent = String(index + 1);
    }
  });
}

function createScopeNode(scope = createEmptyScope(), readonly = false) {
  const fragment = scopeTemplate.content.cloneNode(true);
  const root = fragment.querySelector(".scope-entry");
  const selectorTypeEl = root.querySelector(".scope-selector-type");
  const queryEl = root.querySelector(".scope-query");
  const hintEl = root.querySelector(".scope-entry-hint");
  const removeButton = root.querySelector(".remove-scope");
  const toggleButton = root.querySelector(".scope-toggle");

  I18N.apply(root);
  syncIconButtonLabels(root);

  selectorTypeEl.value = scope.selectorType || "auto";
  queryEl.value = scope.query || "";

  const update = () => {
    const query = queryEl.value.trim();
    if (!query) {
      hintEl.textContent = t("hintScopeEmpty");
      return;
    }
    const detectedType = resolveSelectorType(query, selectorTypeEl.value);
    hintEl.textContent = `${t("hintCurrentInterpretation", [detectedType])} / ${t("hintScopeSpecificArea")}`;
  };

  [selectorTypeEl, queryEl].forEach((el) => {
    el.addEventListener("input", update);
    el.addEventListener("change", update);
  });

  toggleButton.addEventListener("click", () => {
    const collapsed = !root.classList.contains("collapsed");
    setScopeCollapsed(root, collapsed);
  });

  removeButton.addEventListener("click", async () => {
    if (readonly) return;
    const parent = root.parentElement;
    await animateElementExit(root);
    if (parent && !parent.children.length) {
      const replacement = createScopeNode(undefined, readonly);
      parent.appendChild(replacement);
      await animateElementEnter(replacement);
    }
    if (parent) {
      refreshScopeIndexes(parent);
    }
    markDirty();
  });

  if (readonly) {
    [selectorTypeEl, queryEl, removeButton].forEach((el) => {
      el.disabled = true;
      if ("readOnly" in el) el.readOnly = true;
    });
  }

  update();
  setScopeCollapsed(root, false);
  return root;
}

function createEmptyScope() {
  return {
    selectorType: "auto",
    query: ""
  };
}

function collectScopesFromRuleRoot(root) {
  return Array.from(root.querySelectorAll(".scope-entry")).map((scopeRoot) => ({
    selectorType: scopeRoot.querySelector(".scope-selector-type").value,
    query: scopeRoot.querySelector(".scope-query").value.trim()
  }));
}

function setRuleCollapsed(root, collapsed) {
  root.classList.toggle("collapsed", collapsed);
  const toggleButton = root.querySelector(".rule-toggle");
  if (toggleButton) {
    toggleButton.setAttribute("aria-expanded", String(!collapsed));
    toggleButton.setAttribute("title", collapsed ? t("expandRule") : t("collapseRule"));
  }
}

function setConditionCollapsed(root, collapsed) {
  root.classList.toggle("collapsed", collapsed);
  const toggleButton = root.querySelector(".condition-toggle");
  if (toggleButton) {
    toggleButton.setAttribute("aria-expanded", String(!collapsed));
    toggleButton.setAttribute("title", collapsed ? t("expandCondition") : t("collapseCondition"));
  }
}

function setScopeCollapsed(root, collapsed) {
  root.classList.toggle("collapsed", collapsed);
  const toggleButton = root.querySelector(".scope-toggle");
  const body = root.querySelector(".scope-entry-body");
  if (toggleButton) {
    toggleButton.setAttribute("aria-expanded", String(!collapsed));
    toggleButton.setAttribute("title", collapsed ? t("expandCondition") : t("collapseCondition"));
  }
  if (body) {
    body.classList.toggle("hidden", collapsed);
  }
}

function setDebugSectionExpanded(expanded) {
  setSectionExpanded(debugToggleButton, debugSectionBody, expanded);
  debugToggleButton.setAttribute("title", expanded ? t("collapseDebug") : t("expandDebug"));
}

function isDebugSectionExpanded() {
  return debugToggleButton.getAttribute("aria-expanded") === "true";
}

function buildConditionSummary(condition) {
  if (condition.source === "network") {
    const value = condition.value || t("hintEmptyQuery");
    return `${condition.matchType} · ${condition.method} · ${condition.resourceKind} · ${value}`;
  }
  const value = condition.query || t("hintEmptyQuery");
  return `${condition.selectorType} · ${value}`;
}

function createEmptyRule() {
  const id = crypto.randomUUID();
  return {
    id,
    slug: generateUserSlug(t("untitledRule"), id),
    origin: USER_ORIGIN,
    readonly: false,
    removable: true,
    name: "",
    enabled: true,
    matches: [],
    matchMode: "any",
    busyWhen: [createEmptyCondition()],
    domScopeMode: "auto",
    domScopes: [createEmptyScope()],
    useSmartBusySignals: true,
    iconMode: "overlaySpinner"
  };
}

function createEmptyCondition() {
  return {
    source: "dom",
    selectorType: "auto",
    query: "",
    matchType: "urlContains",
    value: "",
    method: "ANY",
    resourceKind: "any"
  };
}

function createDebugPresetRule(existingRule) {
  return normalizeRuleForEditor({
    ...DEBUG_LOCAL_SANDBOX_PRESET,
    ...(existingRule || {}),
    id: existingRule?.id || DEBUG_LOCAL_SANDBOX_PRESET.id,
    slug: DEBUG_PRESET_SLUG,
    origin: SYSTEM_ORIGIN,
    readonly: true,
    removable: false,
    nameKey: DEBUG_LOCAL_SANDBOX_PRESET.nameKey,
    enabled: true
  });
}

function hasSystemPreset(rules, slug) {
  return rules.some((rule) => rule.origin === SYSTEM_ORIGIN && rule.slug === slug);
}

function syncRulesWithDebugMode(rules, enabled) {
  const existingPreset = rules.find((rule) => rule.origin === SYSTEM_ORIGIN && rule.slug === DEBUG_PRESET_SLUG);
  const nextRules = rules.filter((rule) => !(rule.origin === SYSTEM_ORIGIN && rule.slug === DEBUG_PRESET_SLUG));

  if (!enabled) {
    return nextRules;
  }

  return [...nextRules, createDebugPresetRule(existingPreset)];
}

function areRulesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function reconcileRulesWithAnimation(rules) {
  const currentNodes = Array.from(rulesContainer.querySelectorAll(".rule"));
  const currentById = new Map(currentNodes.map((node) => [node.dataset.ruleId, node]));
  const nextIds = new Set(rules.map((rule) => rule.id));

  const removals = currentNodes
    .filter((node) => !nextIds.has(node.dataset.ruleId))
    .map((node) => animateElementExit(node));

  if (removals.length) {
    await Promise.all(removals);
  }

  rules.forEach((rule) => {
    if (currentById.has(rule.id)) return;
    const node = createRuleNode(rule);
    rulesContainer.appendChild(node);
    void animateElementEnter(node);
  });
}

function animateElementEnter(element) {
  return animateElementHeight(element, "enter");
}

function animateElementExit(element) {
  return animateElementHeight(element, "exit");
}

function animateElementHeight(element, direction) {
  if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    if (direction === "exit") element?.remove();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const existing = element._tabBeaconMotionCleanup;
    if (typeof existing === "function") existing();

    const style = element.style;
    const initialTransition = style.transition;
    const initialOverflow = style.overflow;
    const initialWillChange = style.willChange;
    const initialOpacity = style.opacity;
    const initialPointerEvents = style.pointerEvents;
    const initialDisplay = style.display;
    const initialMaxHeight = style.maxHeight;
    const cleanup = () => {
      style.transition = initialTransition;
      style.overflow = initialOverflow;
      style.willChange = initialWillChange;
      style.opacity = initialOpacity;
      style.pointerEvents = initialPointerEvents;
      style.display = initialDisplay;
      style.maxHeight = initialMaxHeight;
      element._tabBeaconMotionCleanup = null;
    };

    element._tabBeaconMotionCleanup = cleanup;
    style.overflow = "hidden";
    style.willChange = "max-height, opacity";

    if (direction === "enter") {
      const targetHeight = `${element.scrollHeight}px`;
      style.display = "";
      style.maxHeight = "0px";
      style.opacity = "0";
      requestAnimationFrame(() => {
        style.transition = `max-height ${MOTION_SLIDE_MS}ms ease`;
        style.maxHeight = targetHeight;
        window.setTimeout(() => {
          style.transition = `opacity ${MOTION_FADE_MS}ms ease`;
          style.opacity = "1";
        }, MOTION_SLIDE_MS);
      });
      window.setTimeout(() => {
        cleanup();
        resolve();
      }, MOTION_SLIDE_MS + MOTION_FADE_MS + 60);
      return;
    }

    style.maxHeight = `${element.offsetHeight}px`;
    style.opacity = "1";
    style.pointerEvents = "none";
    requestAnimationFrame(() => {
      style.transition = `opacity ${MOTION_FADE_MS}ms ease`;
      style.opacity = "0";
    });
    window.setTimeout(() => {
      style.transition = `max-height ${MOTION_SLIDE_MS}ms ease`;
      style.maxHeight = "0px";
      window.setTimeout(() => {
        style.display = "none";
        cleanup();
        element.remove();
        resolve();
      }, MOTION_SLIDE_MS + 40);
    }, MOTION_FADE_MS);
  });
}

function setDebugModeSwitchState(enabled) {
  if (!debugModeSwitchButton) return;
  setSwitchButtonState(debugModeSwitchButton, enabled);
  debugModeSwitchButton.setAttribute("aria-label", t("debugModeToggle"));
  debugModeSwitchButton.setAttribute("title", t("debugModeToggle"));
  if (openPackagedSandboxButton) {
    openPackagedSandboxButton.disabled = !enabled;
    openPackagedSandboxButton.setAttribute("aria-disabled", String(!enabled));
  }
}

function isDebugModeEnabled() {
  return debugModeSwitchButton?.getAttribute("aria-pressed") === "true";
}

function updateDebugPresetStatus(rules) {
  const exists = hasSystemPreset(rules, DEBUG_PRESET_SLUG);
  debugPresetStatus.textContent = exists ? t("debugPresetInstalled") : t("debugPresetMissing");
}

function updateConditionHint(condition, hintEl) {
  if (condition.source === "network") {
    const value = condition.value || t("hintEmptyQuery");
    hintEl.textContent = t("hintNetworkSummary", [condition.matchType, condition.method, condition.resourceKind, value]);
    return;
  }

  if (!condition.query) {
    hintEl.textContent = `${t("hintEmptyQuery")} / ${t("hintSmartBusy")}`;
    return;
  }

  const detectedType = resolveSelectorType(condition.query, condition.selectorType);
  hintEl.textContent = `${t("hintCurrentInterpretation", [detectedType])} / ${t("hintSmartBusy")}`;
}

function resolveSelectorType(query, selectorType) {
  if (!query) return selectorType;
  if (selectorType === "css" || selectorType === "xpath") {
    return selectorType;
  }

  const trimmed = query.trim();
  const xpathHint = /^(\.?\/{1,2}|\(|ancestor::|descendant::|following-sibling::|preceding-sibling::|self::|@)/i;
  if (xpathHint.test(trimmed) || trimmed.includes("::") || trimmed.includes("[@")) {
    return "xpath";
  }

  try {
    document.querySelector(trimmed);
    return "css";
  } catch {
    return "xpath";
  }
}

function collectRulesFromDom() {
  return Array.from(document.querySelectorAll(".rule")).map((root) => {
    const id = root.dataset.ruleId || crypto.randomUUID();
    const origin = root.dataset.ruleOrigin === SYSTEM_ORIGIN ? SYSTEM_ORIGIN : USER_ORIGIN;
    const readonly = root.dataset.readonly === "true";
    const removable = root.dataset.removable === "true";
    const nameKey = root.dataset.ruleNameKey;
    const rawName = root.querySelector(".rule-name").value.trim();
    const name = origin === SYSTEM_ORIGIN && nameKey ? t(nameKey) : (rawName || t("untitledRule"));

    return {
      id,
      slug: root.dataset.ruleSlug || generateUserSlug(name, id),
      origin,
      readonly,
      removable,
      ...(nameKey ? { nameKey } : {}),
      name,
      enabled: root.querySelector(".rule-enabled").checked,
      matches: root.querySelector(".rule-matches").value
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean),
      matchMode: root.querySelector(".rule-match-mode").value,
      busyWhen: Array.from(root.querySelectorAll(".condition")).map((conditionRoot) => {
        const source = conditionRoot.querySelector(".condition-source").value;
        if (source === "network") {
          return {
            source: "network",
            matchType: conditionRoot.querySelector(".condition-match-type").value,
            value: conditionRoot.querySelector(".condition-value").value.trim(),
            method: conditionRoot.querySelector(".condition-method").value,
            resourceKind: conditionRoot.querySelector(".condition-resource-kind").value
          };
        }
        return {
          source: "dom",
          selectorType: conditionRoot.querySelector(".condition-selector-type").value,
          query: conditionRoot.querySelector(".condition-query").value.trim()
        };
      }).filter((condition) => (condition.source === "network" ? condition.value : condition.query)),
      domScopeMode: root.querySelector(".rule-dom-scope-mode").value,
      domScopes: collectScopesFromRuleRoot(root).filter((scope) => scope.query),
      useSmartBusySignals: root.querySelector(".rule-smart-busy").checked,
      iconMode: "overlaySpinner"
    };
  });
}

async function refreshDiagnosticTabs({ refreshDiagnostics = false } = {}) {
  const previousValue = diagnosticTabSelect.value;
  const tabs = await chrome.tabs.query({});
  const candidates = tabs
    .filter((tab) => typeof tab.id === "number" && isInspectableTabUrl(tab.url || ""))
    .sort((a, b) => {
      if (a.active && !b.active) return -1;
      if (!a.active && b.active) return 1;
      return (a.index || 0) - (b.index || 0);
    });

  diagnosticTabSelect.innerHTML = "";

  if (!candidates.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = t("noInspectableTabs");
    diagnosticTabSelect.appendChild(option);
    diagnosticTabSelect.disabled = true;
    refreshDiagnosticsButton.disabled = true;
    clearDiagnosticsButton.disabled = true;
    renderDiagnosticEmptyState("networkDiagnosticsNoTabs");
    return;
  }

  candidates.forEach((tab) => {
    const option = document.createElement("option");
    option.value = String(tab.id);
    option.textContent = buildTabOptionLabel(tab);
    option.dataset.url = tab.url || "";
    diagnosticTabSelect.appendChild(option);
  });

  const selected = candidates.find((tab) => String(tab.id) === previousValue)
    || candidates.find((tab) => tab.active)
    || candidates[0];

  diagnosticTabSelect.value = String(selected.id);
  diagnosticTabSelect.disabled = false;
  refreshDiagnosticsButton.disabled = false;
  clearDiagnosticsButton.disabled = false;

  if (refreshDiagnostics) {
    await refreshNetworkDiagnosticsForSelectedTab();
  } else {
    renderDiagnosticTabSummary(selected, null);
  }
}

async function refreshNetworkDiagnosticsForSelectedTab() {
  if (!diagnosticTabSelect.value) {
    renderDiagnosticEmptyState("networkDiagnosticsNoSelection");
    return;
  }

  const tabId = Number(diagnosticTabSelect.value);
  if (!Number.isFinite(tabId)) {
    renderDiagnosticEmptyState("networkDiagnosticsNoSelection");
    return;
  }

  const tabs = await chrome.tabs.query({});
  const selectedTab = tabs.find((tab) => tab.id === tabId) || null;
  if (!selectedTab) {
    renderDiagnosticEmptyState("networkDiagnosticsTabMissing");
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: "tab-beacon/get-network-diagnostics",
      tabId
    });

    const diagnostics = response?.diagnostics || {
      entries: [],
      activeRequestCount: 0,
      matchedConditionCount: 0,
      snapshot: {}
    };

    renderDiagnostics(selectedTab, diagnostics, collectRulesFromDom());
  } catch (error) {
    console.error("[TabBeacon] failed to refresh diagnostics", error);
    diagnosticSummary.textContent = t("networkDiagnosticsError");
    diagnosticsBody.innerHTML = "";
    diagnosticsBody.appendChild(createDiagnosticsEmptyRow(t("networkDiagnosticsError")));
  }
}

async function clearDiagnosticsForSelectedTab() {
  if (!diagnosticTabSelect.value) return;

  const tabId = Number(diagnosticTabSelect.value);
  if (!Number.isFinite(tabId)) return;

  try {
    const response = await chrome.runtime.sendMessage({
      type: "tab-beacon/clear-network-diagnostics",
      tabId
    });
    const tabs = await chrome.tabs.query({});
    const selectedTab = tabs.find((tab) => tab.id === tabId) || null;
    if (!selectedTab) {
      renderDiagnosticEmptyState("networkDiagnosticsTabMissing");
      return;
    }
    renderDiagnostics(selectedTab, response?.diagnostics || { entries: [] }, collectRulesFromDom());
  } catch (error) {
    console.error("[TabBeacon] failed to clear diagnostics", error);
  }
}

function renderDiagnostics(tab, diagnostics, rules) {
  renderDiagnosticTabSummary(tab, diagnostics);

  diagnosticsBody.innerHTML = "";
  const entries = Array.isArray(diagnostics.entries) ? diagnostics.entries : [];
  if (!entries.length) {
    diagnosticsBody.appendChild(createDiagnosticsEmptyRow(t("networkDiagnosticsEmptyRows")));
    return;
  }

  const ruleMap = buildRuleLookup(rules);

  entries.forEach((entry) => {
    const row = document.createElement("tr");

    const startedCell = document.createElement("td");
    startedCell.className = "diagnostic-started-cell";
    startedCell.textContent = formatTimestamp(entry.startedAt);

    const statusCell = document.createElement("td");
    const statusBadge = document.createElement("span");
    statusBadge.className = `diagnostic-status diagnostic-status-${entry.status || "completed"}`;
    statusBadge.textContent = statusLabel(entry.status);
    statusCell.appendChild(statusBadge);

    const requestCell = document.createElement("td");
    requestCell.className = "diagnostic-request-cell";
    requestCell.appendChild(createDiagnosticRequestBlock(entry));

    const matchCell = document.createElement("td");
    matchCell.className = "diagnostic-match-cell";
    const matches = Array.isArray(entry.matches) ? entry.matches : [];
    if (!matches.length) {
      matchCell.textContent = "—";
    } else {
      const list = document.createElement("ul");
      list.className = "diagnostic-match-list";
      matches.forEach((match) => {
        const item = document.createElement("li");
        item.textContent = formatConditionMatch(match, ruleMap);
        list.appendChild(item);
      });
      matchCell.appendChild(list);
    }

    row.append(startedCell, statusCell, requestCell, matchCell);
    diagnosticsBody.appendChild(row);
  });
}

function renderDiagnosticTabSummary(tab, diagnostics) {
  if (!tab) {
    renderDiagnosticEmptyState("networkDiagnosticsNoSelection");
    return;
  }

  const title = tab.title || t("untitledTab");
  const url = tab.url || "";
  if (!diagnostics) {
    diagnosticSummary.textContent = t("networkDiagnosticsTabSummaryPending", [title, url || "—"]);
    return;
  }

  const activeRequestCount = diagnostics.activeRequestCount || 0;
  const entryCount = Array.isArray(diagnostics.entries) ? diagnostics.entries.length : 0;
  diagnosticSummary.textContent = t("networkDiagnosticsTabSummary", [
    title,
    url || "—",
    String(activeRequestCount),
    String(entryCount)
  ]);
}

function renderDiagnosticEmptyState(messageKey) {
  diagnosticSummary.textContent = t(messageKey);
  diagnosticsBody.innerHTML = "";
  diagnosticsBody.appendChild(createDiagnosticsEmptyRow(t("networkDiagnosticsEmptyRows")));
}

function createDiagnosticsEmptyRow(text) {
  const row = document.createElement("tr");
  row.className = "diagnostics-empty-row";
  const cell = document.createElement("td");
  cell.colSpan = 4;
  cell.textContent = text;
  row.appendChild(cell);
  return row;
}

function buildRuleLookup(rules) {
  const map = new Map();
  rules.forEach((rule) => {
    map.set(rule.id, rule);
  });
  return map;
}

function formatConditionMatch(match, ruleMap) {
  const rule = ruleMap.get(match.ruleId);
  const conditionIndex = Number(match.conditionIndex);
  if (!rule || !Array.isArray(rule.busyWhen)) {
    return t("diagnosticUnknownCondition", [String(match.ruleId), String(conditionIndex + 1)]);
  }

  const condition = rule.busyWhen[conditionIndex];
  const conditionSummary = condition ? buildConditionSummary(condition) : t("diagnosticMissingCondition");
  return `${rule.name || t("untitledRule")} · #${conditionIndex + 1} · ${conditionSummary}`;
}

function createDiagnosticRequestBlock(entry) {
  const wrapper = document.createElement("div");
  wrapper.className = "diagnostic-request-block";

  const meta = document.createElement("div");
  meta.className = "diagnostic-request-meta";
  meta.textContent = `${entry.method || "GET"} · ${entry.requestType || "unknown"}`;

  const url = document.createElement("code");
  url.className = "diagnostic-url";
  url.textContent = entry.url || "—";

  const finished = document.createElement("div");
  finished.className = "diagnostic-finished-at";
  finished.textContent = entry.finishedAt
    ? t("diagnosticFinishedAt", [formatTimestamp(entry.finishedAt)])
    : t("diagnosticStillInflight");

  wrapper.append(meta, url, finished);
  return wrapper;
}

function statusLabel(status) {
  if (status === "inflight") return t("diagnosticStatusInflight");
  if (status === "error") return t("diagnosticStatusError");
  return t("diagnosticStatusCompleted");
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "—";
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch {
    return String(timestamp);
  }
}

function buildTabOptionLabel(tab) {
  const title = tab.title || t("untitledTab");
  const url = tab.url || "";
  return `${title} — ${shortenText(url, 80)}`;
}

function shortenText(value, maxLength) {
  if (!value || value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function isInspectableTabUrl(url) {
  return /^(https?:|file:)/i.test(url);
}

function ensureDiagnosticsUi() {
  refreshDiagnosticTabsButton = document.getElementById("refreshDiagnosticTabs");
  refreshDiagnosticsButton = document.getElementById("refreshDiagnostics");
  clearDiagnosticsButton = document.getElementById("clearDiagnostics");
  diagnosticTabSelect = document.getElementById("diagnosticTabSelect");
  diagnosticSummary = document.getElementById("diagnosticSummary");
  diagnosticsBody = document.getElementById("diagnosticsBody");
}

function generateUserSlug(name, id) {
  const base = slugify(name) || "rule";
  return `${base}-${id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase()}`;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

