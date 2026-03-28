const STORAGE_KEY = "tabBeaconRules";
const DEFAULT_RULES = [
  {
    id: crypto.randomUUID(),
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

const rulesContainer = document.getElementById("rulesContainer");
const ruleTemplate = document.getElementById("ruleTemplate");
const conditionTemplate = document.getElementById("conditionTemplate");
const saveButton = document.getElementById("saveAll");
const addRuleButton = document.getElementById("addRule");

init().catch((error) => {
  console.error("[TabBeacon] options init failed", error);
});

async function init() {
  const { [STORAGE_KEY]: rules } = await chrome.storage.local.get(STORAGE_KEY);
  const initialRules = Array.isArray(rules) && rules.length ? rules : DEFAULT_RULES;
  renderRules(initialRules.map(normalizeRuleForEditor));
}

function normalizeRuleForEditor(rule) {
  const busyWhen = Array.isArray(rule.busyWhen) && rule.busyWhen.length
    ? rule.busyWhen
    : rule.busyQuery
      ? [{ source: "dom", selectorType: rule.selectorType || "auto", query: rule.busyQuery }]
      : [{ source: "dom", selectorType: "auto", query: "" }];

  return {
    id: rule.id || crypto.randomUUID(),
    name: rule.name || "",
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
}

function createRuleNode(rule = createEmptyRule()) {
  const fragment = ruleTemplate.content.cloneNode(true);
  const root = fragment.querySelector(".rule");
  const conditionsContainer = root.querySelector(".conditions-container");

  root.dataset.ruleId = rule.id;
  root.querySelector(".rule-name").value = rule.name || "";
  root.querySelector(".rule-enabled").checked = !!rule.enabled;
  root.querySelector(".rule-matches").value = (rule.matches || []).join("\n");
  root.querySelector(".rule-match-mode").value = rule.matchMode || "any";
  root.querySelector(".rule-smart-busy").checked = !!rule.useSmartBusySignals;

  (rule.busyWhen || []).forEach((condition) => {
    conditionsContainer.appendChild(createConditionNode(condition));
  });

  if (!conditionsContainer.children.length) {
    conditionsContainer.appendChild(createConditionNode());
  }

  root.querySelector(".add-condition").addEventListener("click", () => {
    conditionsContainer.appendChild(createConditionNode());
  });

  root.querySelector(".remove-rule").addEventListener("click", () => {
    root.remove();
  });

  return root;
}

function createConditionNode(condition = createEmptyCondition()) {
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

  update();

  root.querySelector(".remove-condition").addEventListener("click", () => {
    const parent = root.parentElement;
    root.remove();
    if (parent && !parent.children.length) {
      parent.appendChild(createConditionNode());
    }
  });

  return root;
}

function createEmptyRule() {
  return {
    id: crypto.randomUUID(),
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

function updateConditionHint(condition, hintEl) {
  if (condition.source === "network") {
    const value = condition.value || "未入力";
    hintEl.textContent = `network 条件 / ${condition.matchType} / ${condition.method} / ${condition.resourceKind} / ${value}`;
    return;
  }

  const detectedType = resolveSelectorType(condition.query, condition.selectorType);
  const status = condition.query ? `現在の解釈: ${detectedType}` : "クエリ未入力";
  hintEl.textContent = `${status} / Smart busy detection はルール全体に対する補助シグナルです`;
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

addRuleButton.addEventListener("click", () => {
  rulesContainer.appendChild(createRuleNode());
});

saveButton.addEventListener("click", async () => {
  const rules = Array.from(document.querySelectorAll(".rule")).map((root) => ({
    id: root.dataset.ruleId,
    name: root.querySelector(".rule-name").value.trim() || "Untitled rule",
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
  }));

  await chrome.storage.local.set({ [STORAGE_KEY]: rules });

  saveButton.textContent = "保存しました";
  window.setTimeout(() => {
    saveButton.textContent = "保存";
  }, 1200);
});
