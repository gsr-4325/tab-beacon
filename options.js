const STORAGE_KEY = "tabBeaconRules";
const UI_STATE_KEY = "tabBeaconUiState";
const DEBUG_PRESET_SLUG = "debug-local-sandbox";
const SYSTEM_ORIGIN = "system";
const USER_ORIGIN = "user";

const I18N = window.TabBeaconI18n || { t: (key) => key, apply: () => {} };
const t = (key, substitutions) => I18N.t(key, substitutions);

const DEFAULT_RULES = [
  {
    id: crypto.randomUUID(),
    slug: `user-default-${crypto.randomUUID().slice(0, 8)}`,
    origin: USER_ORIGIN,
    readonly: false,
    name: "ChatGPT",
    enabled: true,
    matches: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
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
        source: "network",
        matchType: "urlContains",
        value: "BardFrontendService/StreamGenerate",
        method: "POST",
        resourceKind: "fetch-xhr"
      }
    ],
    useSmartBusySignals: true,
    iconMode: "overlaySpinner"
  }
];

const DEBUG_LOCAL_SANDBOX_PRESET = {
  id: `sys:${DEBUG_PRESET_SLUG}`,
  slug: DEBUG_PRESET_SLUG,
  origin: SYSTEM_ORIGIN,
  readonly: true,
  nameKey: "presetDebugLocalSandboxName",
  enabled: true,
  matches: ["file:///*manual-tests/*"],
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

const rulesContainer = document.getElementById("rulesContainer");
const ruleTemplate = document.getElementById("ruleTemplate");
const conditionTemplate = document.getElementById("conditionTemplate");
const saveButton = document.getElementById("saveAll");
const addRuleButton = document.getElementById("addRule");
const showDebugToolsCheckbox = document.getElementById("showDebugTools");
const enableDebugModeCheckbox = document.getElementById("enableDebugMode");
const debugPanel = document.getElementById("debugPanel");
const installDebugPresetButton = document.getElementById("installDebugPreset");
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
  versionText.textContent = `v${chrome.runtime.getManifest().version}`;
  const [rulesResult, uiStateResult] = await Promise.all([
    chrome.storage.local.get(STORAGE_KEY),
    chrome.storage.local.get(UI_STATE_KEY)
  ]);

  let initialRules = Array.isArray(rulesResult[STORAGE_KEY]) && rulesResult[STORAGE_KEY].length
    ? rulesResult[STORAGE_KEY]
    : DEFAULT_RULES;

  initialRules = migrateRules(initialRules);

  const normalizedRules = initialRules.map(normalizeRuleForEditor);
  renderRules(normalizedRules);
  bindGlobalActions();

  const showDebugTools = !!uiStateResult[UI_STATE_KEY]?.showDebugTools;
  showDebugToolsCheckbox.checked = showDebugTools;
  debugPanel.classList.toggle("hidden", !showDebugTools);

  enableDebugModeCheckbox.checked = !!uiStateResult[UI_STATE_KEY]?.debugMode;
  updateDebugPresetStatus(normalizedRules);

  if (showDebugTools) {
    await refreshDiagnosticTabs({ refreshDiagnostics: true });
  } else {
    renderDiagnosticEmptyState("networkDiagnosticsEmptyState");
  }
}

function bindGlobalActions() {
  addRuleButton.addEventListener("click", () => {
    rulesContainer.appendChild(createRuleNode());
  });

  saveButton.addEventListener("click", async () => {
    const rules = collectRulesFromDom();
    await chrome.storage.local.set({ [STORAGE_KEY]: rules });
    renderRules(rules.map(normalizeRuleForEditor));
    setSaveButtonSavedState();
    if (showDebugToolsCheckbox.checked) {
      await refreshNetworkDiagnosticsForSelectedTab();
    }
  });

  enableDebugModeCheckbox.addEventListener("change", async () => {
    const uiState = (await chrome.storage.local.get(UI_STATE_KEY))[UI_STATE_KEY] || {};
    await chrome.storage.local.set({ [UI_STATE_KEY]: { ...uiState, debugMode: enableDebugModeCheckbox.checked } });
  });

  showDebugToolsCheckbox.addEventListener("change", async () => {
    const checked = showDebugToolsCheckbox.checked;
    debugPanel.classList.toggle("hidden", !checked);
    const uiState = (await chrome.storage.local.get(UI_STATE_KEY))[UI_STATE_KEY] || {};
    await chrome.storage.local.set({ [UI_STATE_KEY]: { ...uiState, showDebugTools: checked } });
    if (checked) {
      await refreshDiagnosticTabs({ refreshDiagnostics: true });
    }
  });

  installDebugPresetButton.addEventListener("click", async () => {
    const rules = collectRulesFromDom();
    if (hasSystemPreset(rules, DEBUG_PRESET_SLUG)) {
      updateDebugPresetStatus(rules);
      return;
    }
    rules.push(createDebugPresetRule());
    await chrome.storage.local.set({ [STORAGE_KEY]: rules });
    renderRules(rules.map(normalizeRuleForEditor));
    updateDebugPresetStatus(rules);
    setSaveButtonSavedState();
    if (showDebugToolsCheckbox.checked) {
      await refreshNetworkDiagnosticsForSelectedTab();
    }
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

function migrateRules(rules) {
  let changed = false;
  const migrated = rules.map((rule) => {
    if (!Array.isArray(rule.busyWhen)) return rule;
    const filtered = rule.busyWhen.filter(
      (c) => !(c.source === "dom" && c.query === '[aria-busy="true"]' && rule.name === "Gemini")
    );
    if (filtered.length === rule.busyWhen.length) return rule;
    changed = true;
    return { ...rule, busyWhen: filtered };
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

function createRuleNode(rule = createEmptyRule()) {
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
  if (rule.nameKey) {
    root.dataset.ruleNameKey = rule.nameKey;
  }

  nameInput.value = rule.name || "";
  root.querySelector(".rule-enabled").checked = !!rule.enabled;
  root.querySelector(".rule-matches").value = (rule.matches || []).join("\n");
  root.querySelector(".rule-match-mode").value = rule.matchMode || "any";
  root.querySelector(".rule-smart-busy").checked = !!rule.useSmartBusySignals;

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
  });

  ruleToggleButton.addEventListener("click", () => {
    setRuleCollapsed(root, !root.classList.contains("collapsed"));
  });

  removeRuleButton.addEventListener("click", () => {
    if (rule.readonly) return;
    root.remove();
    updateDebugPresetStatus(collectRulesFromDom());
  });

  if (rule.readonly) {
    root.classList.add("readonly-rule");
    nameInput.readOnly = true;
    disableRuleEditing(root);
  }

  setRuleCollapsed(root, true);
  return root;
}

function disableRuleEditing(root) {
  root.querySelectorAll(".rule-enabled, .rule-matches, .rule-match-mode, .rule-smart-busy, .add-condition, .remove-rule").forEach((el) => {
    el.disabled = true;
  });
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

function createDebugPresetRule() {
  return normalizeRuleForEditor(DEBUG_LOCAL_SANDBOX_PRESET);
}

function hasSystemPreset(rules, slug) {
  return rules.some((rule) => rule.origin === SYSTEM_ORIGIN && rule.slug === slug);
}

function updateDebugPresetStatus(rules) {
  const exists = hasSystemPreset(rules, DEBUG_PRESET_SLUG);
  debugPresetStatus.textContent = exists ? t("debugPresetInstalled") : t("debugPresetMissing");
  installDebugPresetButton.disabled = exists;
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
    const nameKey = root.dataset.ruleNameKey;
    const rawName = root.querySelector(".rule-name").value.trim();
    const name = origin === SYSTEM_ORIGIN && nameKey ? t(nameKey) : (rawName || t("untitledRule"));

    return {
      id,
      slug: root.dataset.ruleSlug || generateUserSlug(name, id),
      origin,
      readonly,
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
        <div>
          <h3 data-i18n="networkDiagnosticsTitle">Network diagnostics</h3>
          <p class="hint" data-i18n="networkDiagnosticsDescription">Inspect which matched requests are driving the network busy state.</p>
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
  }

  refreshDiagnosticTabsButton = document.getElementById("refreshDiagnosticTabs");
  refreshDiagnosticsButton = document.getElementById("refreshDiagnostics");
  clearDiagnosticsButton = document.getElementById("clearDiagnostics");
  diagnosticTabSelect = document.getElementById("diagnosticTabSelect");
  diagnosticSummary = document.getElementById("diagnosticSummary");
  diagnosticsBody = document.getElementById("diagnosticsBody");
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
  window.setTimeout(() => {
    saveButton.textContent = t("save");
  }, 1200);
}
