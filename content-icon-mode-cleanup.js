(() => {
  const storageArea = chrome?.storage?.local;
  if (!storageArea || typeof storageArea.get !== "function") {
    return;
  }

  const RULES_STORAGE_KEY = "tabBeaconRules";
  const CHATGPT_PROJECT_PATTERN = "https://chatgpt.com/g/*/project*";
  const CHATGPT_MATCH_PATTERNS = new Set([
    "https://chatgpt.com/c/*",
    "https://chatgpt.com/g/*/c/*"
  ]);
  const originalGet = storageArea.get.bind(storageArea);
  const originalSet = typeof storageArea.set === "function"
    ? storageArea.set.bind(storageArea)
    : null;

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
    const currentBusyWhen = Array.isArray(rule.busyWhen) ? rule.busyWhen : [];
    const nextBusyWhen = currentBusyWhen.filter((condition) => !(
      condition?.source === "dom" && condition?.query === '[data-testid="stop-button"]'
    ));

    const matchesChanged = nextMatches.length !== currentMatches.length;
    const busyWhenChanged = nextBusyWhen.length !== currentBusyWhen.length;
    const smartBusyChanged = rule.useSmartBusySignals !== false;

    if (!matchesChanged && !busyWhenChanged && !smartBusyChanged) {
      return rule;
    }

    return {
      ...rule,
      matches: nextMatches,
      busyWhen: nextBusyWhen,
      useSmartBusySignals: false
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

  storageArea.get = async function patchedGet(keys) {
    const result = await originalGet(keys);
    if (!Array.isArray(result?.[RULES_STORAGE_KEY])) {
      return result;
    }

    const stripped = stripRules(result[RULES_STORAGE_KEY]);
    return {
      ...result,
      [RULES_STORAGE_KEY]: stripped.next
    };
  };

  async function sanitizeStoredRules() {
    if (!originalSet) return;
    const result = await originalGet(RULES_STORAGE_KEY);
    if (!Array.isArray(result?.[RULES_STORAGE_KEY])) return;

    const stripped = stripRules(result[RULES_STORAGE_KEY]);
    if (!stripped.changed) return;

    await originalSet({
      [RULES_STORAGE_KEY]: stripped.next
    });
  }

  sanitizeStoredRules().catch((error) => {
    console.error("[Tab Beacon] content icon mode cleanup persistence failed", error);
  });
})();
