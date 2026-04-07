const STORAGE_KEY = "tabBeaconRules";
const UI_STATE_KEY = "tabBeaconUiState";
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
      matches: ["https://chatgpt.com/c/*", "https://chatgpt.com/g/*/c/*"],
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

function helpIconSvg() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9"></circle>
      <path d="M9.4 9.2a2.7 2.7 0 1 1 4.8 1.7c-.6.7-1.4 1.1-1.9 1.7-.3.4-.4.7-.4 1.4"></path>
      <circle cx="12" cy="17.2" r=".9"></circle>
    </svg>
  `;
}

const rulesContainer = document.getElementById("rulesContainer");
const ruleTemplate = document.getElementById("ruleTemplate");
const conditionTemplate = document.getElementById("conditionTemplate");
const saveButton = document.getElementById("saveAll");
const resetButton = document.getElementById("resetAll");
const resetConfirmModal = document.getElementById("resetConfirmModal");
const resetConfirmOkButton = document.getElementById("resetConfirmOk");
const resetConfirmCancelButton = document.getElementById("resetConfirmCancel");
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

init().catch((error) => {
  console.error("[TabBeacon] options init failed", error);
});

async function init() {
  ensureDiagnosticsUi();
  I18N.apply(document);
  openPackagedSandboxButton.setAttribute("title", t("debugOpenPackagedSandbox"));
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

function markDirty() {
  saveButton.disabled = false;
}

function markClean() {
  saveButton.disabled = true;
}

function bindGlobalActions() {
  rulesContainer.addEventListener("input", markDirty);
  rulesContainer.addEventListener("change", markDirty);

  addRuleButton.addEventListener("click", () => {
    const node = createRuleNode(createEmptyRule(), { collapsed: false });
    rulesContainer.prepend(node);
    node.querySelector(".rule-name")?.focus();
    markDirty();
  });

  saveButton.addEventListener("click", async () => {
    const rules = syncRulesWithDebugMode(collectRulesFromDom(), isDebugModeEnabled());
    await chrome.storage.local.set({ [STORAGE_KEY]: rules });
    renderRules(rules.map(normalizeRuleForEditor));
    setSaveButtonSavedState();
    if (isDebugSectionExpanded()) {
      await refreshNetworkDiagnosticsForSelectedTab();
    }
  });

  resetButton.addEventListener("click", () => {
    resetConfirmModal.showModal();
  });

  resetConfirmCancelButton.addEventListener("click", () => {
    resetConfirmModal.close();
  });

  resetConfirmOkButton.addEventListener("click", async () => {
    resetConfirmModal.close();
    const freshRules = syncRulesWithDebugMode(buildDefaultRules(), isDebugModeEnabled());
    await chrome.storage.local.set({ [STORAGE_KEY]: freshRules });
    renderRules(freshRules.map(normalizeRuleForEditor));
    markClean();
    updateDebugPresetStatus(freshRules);
    if (isDebugSectionExpanded()) {
      await refreshNetworkDiagnosticsForSelectedTab();
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
    await Promise.all([
      chrome.storage.local.set({ [UI_STATE_KEY]: { ...uiState, debugMode: enabled } }),
      chrome.storage.local.set({ [STORAGE_KEY]: rules })
    ]);
    renderRules(rules.map(normalizeRuleForEditor));
    updateDebugPresetStatus(rules);
    setSaveButtonSavedState();
    if (isDebugSectionExpanded()) {
      await refreshNetworkDiagnosticsForSelectedTab();
    }
  });

  openPackagedSandboxButton.addEventListener("click", async () => {
    await chrome.tabs.create({ url: chrome.runtime.getURL("manual-tests/tabbeacon-sandbox.html") });
  });

  copySettingsButton.addEventListener("click", async () => {
    const [rulesResult, uiStateResult] = await Promise.all([
      chrome.storage.local.get(STORAGE_KEY),
      chrome.storage.local.get(UI_STATE_KEY)
    ]);
    const settings = {
      rules: rulesResult[STORAGE_KEY] || [],
      uiState: uiStateResult[UI_STATE_KEY] || {}
    };
    await navigator.clipboard.writeText(JSON.stringify(settings, null, 2));

    // Show check icon for 3.5 seconds
    const copyIcon = copySettingsButton.querySelector(".copy-icon");
    const checkIcon = copySettingsButton.querySelector(".check-icon");

    copyIcon.style.display = "none";
    checkIcon.style.display = "flex";
    copySettingsButton.setAttribute("title", "Copied!");

    setTimeout(() => {
      copyIcon.style.display = "flex";
      checkIcon.style.display = "none";
      copySettingsButton.setAttribute("title", "Copy settings");
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
    if (filtered.length === rule.busyWhen.length && removable === !!rule.removable && name === rule.name) return rule;
    changed = true;
    return { ...rule, name, busyWhen: filtered, removable };
  });
  if (changed) {
    chrome.storage.local.set({ [STORAGE_KEY]: migrated });
  }
  return migrated;
}

function normalizeRuleForEditor(rule) {
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

  root.dataset.ruleId = rule.id;
  root.dataset.ruleSlug = rule.slug;
  root.dataset.ruleOrigin = rule.origin;
  root.dataset.readonly = String(!!rule.readonly);
  root.dataset.removable = String(!!rule.removable);
  if (rule.nameKey) {
    root.dataset.ruleNameKey = rule.nameKey;
  }

  nameInput.value = rule.name || "";
  const enabledInput = root.querySelector(".rule-enabled");
  enabledInput.checked = !!rule.enabled;
  setRuleEnabledState(root, enabledInput.checked);
  root.querySelector(".rule-matches").value = (rule.matches || []).join("\n");
  root.querySelector(".rule-match-mode").value = rule.matchMode || "any";
  root.querySelector(".rule-smart-busy").checked = !!rule.useSmartBusySignals;

  // Set up smart busy help button
  const smartBusyHelpButton = root.querySelector(".smart-busy-help-button");
  if (smartBusyHelpButton) {
    smartBusyHelpButton.innerHTML = helpIconSvg();
    smartBusyHelpButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  }

  originBadge.textContent = rule.origin === SYSTEM_ORIGIN ? t("ruleOriginSystem") : t("ruleOriginUser");
  readonlyNote.classList.toggle("hidden", !rule.readonly);

  (rule.busyWhen || []).forEach((condition) => {
    conditionsContainer.appendChild(createConditionNode(condition, rule.readonly));
  });

  if (!conditionsContainer.children.length) {
    conditionsContainer.appendChild(createConditionNode(undefined, rule.readonly));
  }

  refreshConditionIndexes(conditionsContainer);

  root.querySelector(".add-condition").addEventListener("click", () => {
    conditionsContainer.appendChild(createConditionNode(undefined, rule.readonly));
    refreshConditionIndexes(conditionsContainer);
    markDirty();
  });

  ruleToggleButton.addEventListener("click", () => {
    setRuleCollapsed(root, !root.classList.contains("collapsed"));
  });

  removeRuleButton.disabled = !canRemoveRule(rule);
  removeRuleButton.addEventListener("click", () => {
    if (!canRemoveRule(rule)) return;
    root.remove();
    updateDebugPresetStatus(collectRulesFromDom());
    markDirty();
  });

  if (rule.readonly) {
    root.classList.add("readonly-rule");
    nameInput.readOnly = true;
    disableRuleEditing(root, { allowRemove: !!rule.removable });
  }

  enabledInput.addEventListener("input", () => {
    setRuleEnabledState(root, enabledInput.checked);
  });
  enabledInput.addEventListener("change", () => {
    setRuleEnabledState(root, enabledInput.checked);
  });

  setRuleCollapsed(root, collapsed);
  return root;
}

function canRemoveRule(rule) {
  return !rule.readonly || !!rule.removable;
}

function setRuleEnabledState(root, enabled) {
  root.dataset.ruleEnabled = String(!!enabled);
}

function disableRuleEditing(root, { allowRemove = false } = {}) {
  root.querySelectorAll(".rule-enabled, .rule-matches, .rule-match-mode, .rule-smart-busy, .add-condition").forEach((el) => {
    el.disabled = true;
  });
  if (!allowRemove) {
    root.querySelectorAll(".remove-rule").forEach((el) => {
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

  removeConditionButton.addEventListener("click", () => {
    if (readonly) return;
    const parent = root.parentElement;
    root.remove();
    if (parent && !parent.children.length) {
      parent.appendChild(createConditionNode(undefined, readonly));
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

function setDebugSectionExpanded(expanded) {
  debugSectionBody.classList.toggle("hidden", !expanded);
  debugToggleButton.setAttribute("aria-expanded", String(expanded));
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

function setDebugModeSwitchState(enabled) {
  if (!debugModeSwitchButton) return;
  const switchText = debugModeSwitchButton.querySelector(".default-rule-switch-text");
  debugModeSwitchButton.classList.toggle("active", enabled);
  debugModeSwitchButton.setAttribute("aria-pressed", String(enabled));
  debugModeSwitchButton.setAttribute("aria-label", t("debugModeToggle"));
  debugModeSwitchButton.setAttribute("title", t("debugModeToggle"));
  if (switchText) {
    switchText.textContent = enabled ? t("win11SwitchOn") : t("win11SwitchOff");
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
  injectDiagnosticsStyles();

  let panel = document.getElementById("networkDiagnosticsPanel");
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "networkDiagnosticsPanel";
    panel.className = "diagnostics-panel";
    panel.innerHTML = `
      <div class="section-header diagnostics-header">
        <div class="diagnostics-title-group">
          <h3 data-i18n="networkDiagnosticsTitle">Network diagnostics</h3>
          <button id="networkDiagnosticsHelp" type="button" class="diagnostics-help-button" aria-label="Help for network diagnostics" title="Help for network diagnostics">
            ${helpIconSvg()}
          </button>
        </div>
        <div class="row diagnostics-actions">
          <button id="refreshDiagnosticTabs" type="button" data-i18n="refreshTabList">Refresh tab list</button>
          <button id="refreshDiagnostics" type="button" data-i18n="refreshDiagnostics">Refresh diagnostics</button>
          <button id="clearDiagnostics" type="button" data-i18n="clearDiagnostics">Clear history</button>
        </div>
      </div>
      <div class="row diagnostics-target-row">
        <label class="diagnostic-target">
          <span data-i18n="diagnosticTargetTab">Target tab</span>
          <select id="diagnosticTabSelect"></select>
        </label>
      </div>
      <div id="diagnosticSummary" class="hint diagnostic-summary" data-i18n="networkDiagnosticsEmptyState">
        Select a tab and refresh diagnostics to inspect matched requests.
      </div>
      <div class="diagnostics-table-wrap">
        <table class="diagnostics-table">
          <thead>
            <tr>
              <th data-i18n="diagnosticColumnStarted">Started</th>
              <th data-i18n="diagnosticColumnStatus">Status</th>
              <th data-i18n="diagnosticColumnRequest">Request</th>
              <th data-i18n="diagnosticColumnMatchedBy">Matched by</th>
            </tr>
          </thead>
          <tbody id="diagnosticsBody">
            <tr class="diagnostics-empty-row">
              <td colspan="4" data-i18n="networkDiagnosticsEmptyRows">No matched requests captured yet.</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    debugPanel.appendChild(panel);
    I18N.apply(panel);
  }

  refreshDiagnosticTabsButton = document.getElementById("refreshDiagnosticTabs");
  refreshDiagnosticsButton = document.getElementById("refreshDiagnostics");
  clearDiagnosticsButton = document.getElementById("clearDiagnostics");
  diagnosticTabSelect = document.getElementById("diagnosticTabSelect");
  diagnosticSummary = document.getElementById("diagnosticSummary");
  diagnosticsBody = document.getElementById("diagnosticsBody");

  // Wire up help button
  const networkDiagnosticsHelpButton = document.getElementById("networkDiagnosticsHelp");
  if (networkDiagnosticsHelpButton) {
    networkDiagnosticsHelpButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      showNetworkDiagnosticsHelp();
    });
  }
}

function injectDiagnosticsStyles() {
  if (document.getElementById("tabBeaconDiagnosticsStyle")) return;

  const style = document.createElement("style");
  style.id = "tabBeaconDiagnosticsStyle";
  style.textContent = `
    .diagnostics-panel {
      padding: 16px;
      display: grid;
      gap: 14px;
      background: #10182a;
      border: 1px solid var(--panel-border);
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.22);
    }

    .diagnostics-header {
      align-items: flex-start;
    }

    .diagnostics-actions {
      flex-wrap: wrap;
      justify-content: flex-end;
      margin-left: auto;
    }

    .diagnostics-target-row {
      justify-content: flex-start;
    }

    .diagnostic-target {
      min-width: min(100%, 420px);
    }

    .diagnostic-summary {
      padding: 10px 12px;
      border: 1px solid rgba(53, 72, 110, 0.45);
      border-radius: 12px;
      background: rgba(9, 16, 29, 0.65);
    }

    .diagnostics-table-wrap {
      overflow: auto;
      border: 1px solid rgba(53, 72, 110, 0.45);
      border-radius: 14px;
    }

    .diagnostics-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 760px;
      background: #0d1426;
    }

    .diagnostics-table th,
    .diagnostics-table td {
      padding: 12px 14px;
      text-align: left;
      vertical-align: top;
      border-bottom: 1px solid rgba(53, 72, 110, 0.35);
    }

    .diagnostics-table th {
      color: var(--muted);
      font-size: 0.9rem;
      font-weight: 700;
      background: rgba(9, 16, 29, 0.9);
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .diagnostics-empty-row td {
      color: var(--muted);
    }

    .diagnostic-request-block {
      display: grid;
      gap: 6px;
    }

    .diagnostic-request-meta,
    .diagnostic-finished-at {
      color: var(--muted);
      font-size: 0.9rem;
    }

    .diagnostic-url {
      display: inline-block;
      white-space: normal;
      overflow-wrap: anywhere;
      background: #09101d;
      border-radius: 8px;
      padding: 6px 8px;
    }

    .diagnostic-match-list {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 6px;
    }

    .diagnostic-status {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 0.85rem;
      font-weight: 700;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }

    .diagnostic-status-inflight {
      background: rgba(59, 130, 246, 0.18);
    }

    .diagnostic-status-completed {
      background: rgba(34, 197, 94, 0.16);
    }

    .diagnostic-status-error {
      background: rgba(239, 68, 68, 0.18);
    }

    .diagnostics-title-group {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .diagnostics-help-button {
      min-width: 22px;
      width: 22px;
      height: 22px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 4px;
      background: transparent;
      color: var(--muted);
      box-shadow: none;
      cursor: pointer;
      flex-shrink: 0;
    }

    .diagnostics-help-button:hover:not(:disabled) {
      color: var(--text);
      background: rgba(255, 255, 255, 0.04);
    }

    .diagnostics-help-button svg {
      width: 14px;
      height: 14px;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
      pointer-events: none;
    }

    .diagnostics-help-dialog {
      width: min(420px, calc(100vw - 32px));
      padding: 22px 24px;
      border-radius: 14px;
      border: 1px solid rgba(53, 72, 110, 0.45);
      background: #10182a;
      color: var(--text);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.32);
    }

    .diagnostics-help-dialog::backdrop {
      background: rgba(0, 0, 0, 0.6);
    }

    .diagnostics-help-dialog-title {
      margin: 0 0 12px;
      font-size: 1.05rem;
    }

    .diagnostics-help-dialog-text {
      margin: 0;
      color: var(--muted);
      line-height: 1.6;
    }

    @media (max-width: 900px) {
      .diagnostics-header {
        flex-direction: column;
        align-items: stretch;
      }

      .diagnostics-actions {
        justify-content: stretch;
      }
    }
  `;
  document.head.appendChild(style);
}

function ensureNetworkDiagnosticsHelpDialog() {
  const HELP_DIALOG_ID = "networkDiagnosticsHelpDialog";
  let dialog = document.getElementById(HELP_DIALOG_ID);
  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.id = HELP_DIALOG_ID;
  dialog.className = "diagnostics-help-dialog";
  dialog.innerHTML = `
    <h2 class="diagnostics-help-dialog-title"></h2>
    <p class="diagnostics-help-dialog-text"></p>
  `;

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  document.body.appendChild(dialog);
  return dialog;
}

function showNetworkDiagnosticsHelp() {
  const dialog = ensureNetworkDiagnosticsHelpDialog();
  dialog.querySelector(".diagnostics-help-dialog-title").textContent = t("networkDiagnosticsTitle", "Network diagnostics");
  dialog.querySelector(".diagnostics-help-dialog-text").textContent = t(
    "networkDiagnosticsDescription",
    "Inspect recent captured requests and see which ones matched your network conditions."
  );

  if (dialog.open) {
    dialog.close();
  } else {
    dialog.showModal();
  }
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

function setSaveButtonSavedState() {
  saveButton.textContent = t("saved");
  markClean();
  window.setTimeout(() => {
    saveButton.textContent = t("save");
  }, 1200);
}
