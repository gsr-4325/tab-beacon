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
        selectorType: "auto",
        query: '[aria-busy="true"]'
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
      value: 'postman-echo.com',
      method: 'GET',
      resourceKind: 'fetch-xhr'
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
const debugPanel = document.getElementById("debugPanel");
const installDebugPresetButton = document.getElementById("installDebugPreset");
const debugPresetStatus = document.getElementById("debugPresetStatus");

init().catch((error) => {
  console.error("[TabBeacon] options init failed", error);
});

async function init() {
  I18N.apply(document);
  const [rulesResult, uiStateResult] = await Promise.all([
    chrome.storage.local.get(STORAGE_KEY),
    chrome.storage.local.get(UI_STATE_KEY)
  ]);

  const initialRules = Array.isArray(rulesResult[STORAGE_KEY]) && rulesResult[STORAGE_KEY].length
    ? rulesResult[STORAGE_KEY]
    : DEFAULT_RULES;

  const normalizedRules = initialRules.map(normalizeRuleForEditor);
  renderRules(normalizedRules);
  bindGlobalActions();

  const showDebugTools = !!uiStateResult[UI_STATE_KEY]?.showDebugTools;
  showDebugToolsCheckbox.checked = showDebugTools;
  debugPanel.classList.toggle("hidden", !showDebugTools);
  updateDebugPresetStatus(normalizedRules);
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
  });

  showDebugToolsCheckbox.addEventListener("change", async () => {
    const checked = showDebugToolsCheckbox.checked;
    debugPanel.classList.toggle("hidden", !checked);
    await chrome.storage.local.set({ [UI_STATE_KEY]: { showDebugTools: checked } });
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
  });
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
    slug: rule.slug || generateUserSlug(name || rule.name || t('untitledRule'), id),
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

  originBadge.textContent = rule.origin === SYSTEM_ORIGIN ? t('ruleOriginSystem') : t('ruleOriginUser');
  readonlyNote.classList.toggle('hidden', !rule.readonly);

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

  removeRuleButton.addEventListener("click", () => {
    if (rule.readonly) return;
    root.remove();
    updateDebugPresetStatus(collectRulesFromDom());
  });

  if (rule.readonly) {
    root.classList.add('readonly-rule');
    nameInput.readOnly = true;
    disableRuleEditing(root);
  }

  return root;
}

function disableRuleEditing(root) {
  root.querySelectorAll('.rule-enabled, .rule-matches, .rule-match-mode, .rule-smart-busy, .add-condition, .remove-rule').forEach((el) => {
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
  const removeConditionButton = root.querySelector('.remove-condition');
  const toggleButton = root.querySelector('.condition-toggle');
  const summaryEl = root.querySelector('.condition-summary');

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

  toggleButton.addEventListener('click', () => {
    const collapsed = !root.classList.contains('collapsed');
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
    root.classList.add('readonly-condition');
    [sourceEl, selectorTypeEl, queryEl, matchTypeEl, valueEl, methodEl, resourceKindEl, removeConditionButton].forEach((el) => {
      el.disabled = true;
      if ('readOnly' in el) el.readOnly = true;
    });
  }

  setConditionCollapsed(root, false);
  return root;
}

function refreshConditionIndexes(container) {
  Array.from(container.querySelectorAll('.condition')).forEach((conditionRoot, index) => {
    const indexEl = conditionRoot.querySelector('.condition-index');
    if (indexEl) {
      indexEl.textContent = String(index + 1);
    }
  });
}

function setConditionCollapsed(root, collapsed) {
  root.classList.toggle('collapsed', collapsed);
  const toggleButton = root.querySelector('.condition-toggle');
  if (toggleButton) {
    toggleButton.setAttribute('aria-expanded', String(!collapsed));
    toggleButton.setAttribute('title', collapsed ? t('expandCondition') : t('collapseCondition'));
  }
}

function buildConditionSummary(condition) {
  if (condition.source === 'network') {
    const value = condition.value || t('hintEmptyQuery');
    return `${condition.matchType} · ${condition.method} · ${condition.resourceKind} · ${value}`;
  }
  const value = condition.query || t('hintEmptyQuery');
  return `${condition.selectorType} · ${value}`;
}

function createEmptyRule() {
  const id = crypto.randomUUID();
  return {
    id,
    slug: generateUserSlug(t('untitledRule'), id),
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
  debugPresetStatus.textContent = exists ? t('debugPresetInstalled') : t('debugPresetMissing');
  installDebugPresetButton.disabled = exists;
}

function updateConditionHint(condition, hintEl) {
  if (condition.source === "network") {
    const value = condition.value || t('hintEmptyQuery');
    hintEl.textContent = t('hintNetworkSummary', [condition.matchType, condition.method, condition.resourceKind, value]);
    return;
  }

  if (!condition.query) {
    hintEl.textContent = `${t('hintEmptyQuery')} / ${t('hintSmartBusy')}`;
    return;
  }

  const detectedType = resolveSelectorType(condition.query, condition.selectorType);
  hintEl.textContent = `${t('hintCurrentInterpretation', [detectedType])} / ${t('hintSmartBusy')}`;
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
    const readonly = root.dataset.readonly === 'true';
    const nameKey = root.dataset.ruleNameKey;
    const rawName = root.querySelector(".rule-name").value.trim();
    const name = origin === SYSTEM_ORIGIN && nameKey ? t(nameKey) : (rawName || t('untitledRule'));

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

function generateUserSlug(name, id) {
  const base = slugify(name) || 'rule';
  return `${base}-${id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase()}`;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function setSaveButtonSavedState() {
  saveButton.textContent = t('saved');
  window.setTimeout(() => {
    saveButton.textContent = t('save');
  }, 1200);
}
