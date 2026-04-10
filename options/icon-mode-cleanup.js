(() => {
  const STORAGE_KEY = "tabBeaconRules";
  const CHATGPT_PROJECT_PATTERN = "https://chatgpt.com/g/*/project*";
  const CHATGPT_MATCH_PATTERNS = new Set([
    "https://chatgpt.com/c/*",
    "https://chatgpt.com/g/*/c/*"
  ]);

  const stripIconMode = (rule) => {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) return rule;
    if (!Object.prototype.hasOwnProperty.call(rule, "iconMode")) return rule;
    const { iconMode, ...rest } = rule;
    return rest;
  };

  const isBundledChatGptRule = (rule) => {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) return false;
    if (rule.name === "ChatGPT") return true;
    const matches = Array.isArray(rule.matches) ? rule.matches : [];
    return matches.some((pattern) => CHATGPT_MATCH_PATTERNS.has(pattern));
  };

  const sanitizeChatGptRule = (rule) => {
    if (!isBundledChatGptRule(rule)) return rule;

    const currentMatches = Array.isArray(rule.matches) ? rule.matches : [];
    const nextMatches = currentMatches.filter((pattern) => pattern !== CHATGPT_PROJECT_PATTERN);

    if (nextMatches.length === currentMatches.length) {
      return rule;
    }

    return {
      ...rule,
      matches: nextMatches
    };
  };

  const sanitizeRule = (rule) => sanitizeChatGptRule(stripIconMode(rule));

  const stripRules = (rules) => {
    let changed = false;
    const next = rules.map((rule) => {
      const stripped = sanitizeRule(rule);
      if (stripped !== rule) changed = true;
      return stripped;
    });
    return { next, changed };
  };

  function patchGlobals() {
    const originalMigrateRules = migrateRules;
    migrateRules = function(rules) {
      const migrated = originalMigrateRules(rules);
      return stripRules(Array.isArray(migrated) ? migrated : []).next;
    };

    const originalNormalizeRuleForEditor = normalizeRuleForEditor;
    normalizeRuleForEditor = function(rule) {
      const normalized = sanitizeRule(originalNormalizeRuleForEditor(rule));
      delete normalized.iconMode;
      return normalized;
    };

    const originalCreateEmptyRule = createEmptyRule;
    createEmptyRule = function() {
      const rule = sanitizeRule(originalCreateEmptyRule());
      delete rule.iconMode;
      return rule;
    };

    const originalBuildDefaultRules = buildDefaultRules;
    buildDefaultRules = function() {
      return originalBuildDefaultRules().map((rule) => sanitizeRule(rule));
    };

    const originalCollectRulesFromDom = collectRulesFromDom;
    collectRulesFromDom = function() {
      return originalCollectRulesFromDom().map((rule) => sanitizeRule(rule));
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
      typeof migrateRules === "function" &&
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
