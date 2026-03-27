const STORAGE_KEY = "tabBeaconRules";
const DEFAULT_RULES = [
  {
    id: crypto.randomUUID(),
    name: "ChatGPT",
    enabled: true,
    matches: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
    selectorType: "auto",
    busyQuery: '[aria-busy="true"]',
    useSmartBusySignals: true,
    iconMode: "overlaySpinner"
  }
];

const rulesContainer = document.getElementById("rulesContainer");
const ruleTemplate = document.getElementById("ruleTemplate");
const saveButton = document.getElementById("saveAll");
const addRuleButton = document.getElementById("addRule");

init().catch((error) => {
  console.error("[TabBeacon] options init failed", error);
});

async function init() {
  const { [STORAGE_KEY]: rules } = await chrome.storage.local.get(STORAGE_KEY);
  const initialRules = Array.isArray(rules) && rules.length ? rules : DEFAULT_RULES;
  renderRules(initialRules);
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

  root.dataset.ruleId = rule.id;
  root.querySelector(".rule-name").value = rule.name || "";
  root.querySelector(".rule-enabled").checked = !!rule.enabled;
  root.querySelector(".rule-matches").value = (rule.matches || []).join("\n");
  root.querySelector(".rule-selector-type").value = rule.selectorType || "auto";
  root.querySelector(".rule-smart-busy").checked = !!rule.useSmartBusySignals;
  root.querySelector(".rule-busy-query").value = rule.busyQuery || "";

  const hintEl = root.querySelector(".hint");
  updateHint(root, hintEl);

  root.querySelector(".rule-busy-query").addEventListener("input", () => updateHint(root, hintEl));
  root.querySelector(".rule-selector-type").addEventListener("change", () => updateHint(root, hintEl));

  root.querySelector(".remove-rule").addEventListener("click", () => {
    root.remove();
  });

  return root;
}

function createEmptyRule() {
  return {
    id: crypto.randomUUID(),
    name: "",
    enabled: true,
    matches: [],
    selectorType: "auto",
    busyQuery: "",
    useSmartBusySignals: true,
    iconMode: "overlaySpinner"
  };
}

function updateHint(root, hintEl) {
  const query = root.querySelector(".rule-busy-query").value.trim();
  const selectorType = root.querySelector(".rule-selector-type").value;
  const detectedType = resolveSelectorType(query, selectorType);
  const status = query ? `現在の解釈: ${detectedType}` : "クエリ未入力";
  hintEl.textContent = `${status} / Smart busy detection は aria-busy と Stop 系UIを補助的に見ます`;
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
    selectorType: root.querySelector(".rule-selector-type").value,
    busyQuery: root.querySelector(".rule-busy-query").value.trim(),
    useSmartBusySignals: root.querySelector(".rule-smart-busy").checked,
    iconMode: "overlaySpinner"
  }));

  await chrome.storage.local.set({ [STORAGE_KEY]: rules });

  saveButton.textContent = "保存しました";
  window.setTimeout(() => {
    saveButton.textContent = "保存";
  }, 1200);
});
