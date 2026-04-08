(() => {
  const STORAGE_KEY = "tabBeaconRules";
  const DEFAULT_BUSY_END_GRACE_MS = 5_000;

  const normalizeBusyEndGraceMs = (value, fallbackMs = DEFAULT_BUSY_END_GRACE_MS) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(300_000, Math.round(n))) : fallbackMs;
  };

  const formatBusyEndGraceSeconds = (value) =>
    String(Number((normalizeBusyEndGraceMs(value) / 1000).toFixed(2)));

  const parseBusyEndGraceSeconds = (value) => {
    const n = Number.parseFloat(String(value || "").trim());
    return Number.isFinite(n) ? normalizeBusyEndGraceMs(n * 1000) : DEFAULT_BUSY_END_GRACE_MS;
  };

  function syncBehaviorPanel(root, rule) {
    const panel = root?.querySelector(".behavior-panel");
    const input = panel?.querySelector(".rule-busy-end-grace-seconds");
    if (!input) return;
    input.value = formatBusyEndGraceSeconds(rule?.busyEndGraceMs);
    input.disabled = root.dataset.readonly === "true";
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
      syncBehaviorPanel(node, rule);
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
        busyEndGraceMs: parseBusyEndGraceSeconds(roots[index]?.querySelector(".rule-busy-end-grace-seconds")?.value)
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
    if (!ready()) {
      window.setTimeout(init, 30);
      return;
    }

    patchGlobals();
    await rerenderFromStorage();
  }

  init().catch((error) => console.error("[Tab Beacon] rule behavior patch failed", error));
})();
