(() => {
  const STORAGE_KEY = "tabBeaconRules";

  const stripIconMode = (rule) => {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) return rule;
    if (!Object.prototype.hasOwnProperty.call(rule, "iconMode")) return rule;
    const { iconMode, ...rest } = rule;
    return rest;
  };

  const stripRules = (rules) => {
    let changed = false;
    const next = rules.map((rule) => {
      const stripped = stripIconMode(rule);
      if (stripped !== rule) changed = true;
      return stripped;
    });
    return { next, changed };
  };

  function patchGlobals() {
    const originalNormalizeRuleForEditor = normalizeRuleForEditor;
    normalizeRuleForEditor = function(rule) {
      const normalized = originalNormalizeRuleForEditor(rule);
      delete normalized.iconMode;
      return normalized;
    };

    const originalCreateEmptyRule = createEmptyRule;
    createEmptyRule = function() {
      const rule = originalCreateEmptyRule();
      delete rule.iconMode;
      return rule;
    };

    const originalBuildDefaultRules = buildDefaultRules;
    buildDefaultRules = function() {
      return originalBuildDefaultRules().map((rule) => stripIconMode(rule));
    };

    const originalCollectRulesFromDom = collectRulesFromDom;
    collectRulesFromDom = function() {
      return originalCollectRulesFromDom().map((rule) => stripIconMode(rule));
    };

    if (typeof DEBUG_LOCAL_SANDBOX_PRESET === "object" && DEBUG_LOCAL_SANDBOX_PRESET) {
      delete DEBUG_LOCAL_SANDBOX_PRESET.iconMode;
    }
  }

  async function rerenderFromStorage() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    let rules = Array.isArray(result[STORAGE_KEY]) && result[STORAGE_KEY].length
      ? result[STORAGE_KEY]
      : buildDefaultRules();

    const stripped = stripRules(rules);
    rules = stripped.next;

    if (stripped.changed) {
      await chrome.storage.local.set({ [STORAGE_KEY]: rules });
    }

    renderRules(rules.map(normalizeRuleForEditor));
    updateDebugPresetStatus?.(rules);
    markClean?.();
  }

  function ready() {
    return (
      typeof renderRules === "function" &&
      typeof normalizeRuleForEditor === "function" &&
      typeof createEmptyRule === "function" &&
      typeof collectRulesFromDom === "function" &&
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

  init().catch((error) => console.error("[Tab Beacon] icon mode cleanup patch failed", error));
})();
