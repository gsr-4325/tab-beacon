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
  const CHATGPT_ASSISTANT_DOM_SCOPES = [
    {
      selectorType: "xpath",
      query: "(//*[@id='thread']//section[@data-turn='assistant'])[last()]"
    },
    {
      selectorType: "xpath",
      query: "(//main[@id='main']//section[@data-turn='assistant'])[last()]"
    }
  ];
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

  const hasSameDomScopes = (rule) => {
    const domScopes = Array.isArray(rule?.domScopes) ? rule.domScopes : [];
    if (domScopes.length !== CHATGPT_ASSISTANT_DOM_SCOPES.length) return false;
    return CHATGPT_ASSISTANT_DOM_SCOPES.every((expected, index) => {
      const actual = domScopes[index];
      return actual?.selectorType === expected.selectorType && actual?.query === expected.query;
    });
  };

  const sanitizeChatGptRule = (rule) => {
    if (!isBundledChatGptRule(rule)) return rule;

    const currentMatches = Array.isArray(rule.matches) ? rule.matches : [];
    const nextMatches = currentMatches.filter((pattern) => pattern !== CHATGPT_PROJECT_PATTERN);
    const domScopeModeChanged = rule.domScopeMode !== "selector";
    const domScopesChanged = !hasSameDomScopes(rule);
    const matchesChanged = nextMatches.length !== currentMatches.length;

    if (!matchesChanged && !domScopeModeChanged && !domScopesChanged) {
      return rule;
    }

    return {
      ...rule,
      matches: nextMatches,
      domScopeMode: "selector",
      domScopes: CHATGPT_ASSISTANT_DOM_SCOPES.map((scope) => ({ ...scope }))
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
