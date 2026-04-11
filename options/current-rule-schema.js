(() => {
  const CHATGPT_MATCHES = [
    "https://chatgpt.com/c/*",
    "https://chatgpt.com/g/*/c/*"
  ];
  const CHATGPT_ASSISTANT_DOM_SCOPES = [
    {
      selectorType: "xpath",
      query: "(//*[@id='thread']//section[@data-turn='assistant'])[last()]"
    }
  ];

  function stripIconMode(rule) {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) return rule;
    if (!Object.prototype.hasOwnProperty.call(rule, "iconMode")) return rule;
    const { iconMode, ...rest } = rule;
    return rest;
  }

  function applyChatGptDefaults(rule) {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) return rule;
    if (rule.name !== "ChatGPT") return rule;
    return {
      ...rule,
      matches: [...CHATGPT_MATCHES],
      domScopeMode: "selector",
      domScopes: CHATGPT_ASSISTANT_DOM_SCOPES.map((scope) => ({ ...scope }))
    };
  }

  function ready() {
    return (
      typeof buildDefaultRules === "function" &&
      typeof migrateRules === "function" &&
      typeof normalizeRuleForEditor === "function" &&
      typeof createEmptyRule === "function" &&
      typeof collectRulesFromDom === "function"
    );
  }

  function init() {
    if (!ready()) {
      window.setTimeout(init, 30);
      return;
    }

    const originalBuildDefaultRules = buildDefaultRules;
    buildDefaultRules = function() {
      return originalBuildDefaultRules().map((rule) => stripIconMode(applyChatGptDefaults(rule)));
    };

    migrateRules = function(rules) {
      return Array.isArray(rules) ? rules : [];
    };

    const originalNormalizeRuleForEditor = normalizeRuleForEditor;
    normalizeRuleForEditor = function(rule) {
      return stripIconMode(originalNormalizeRuleForEditor(rule));
    };

    const originalCreateEmptyRule = createEmptyRule;
    createEmptyRule = function() {
      return stripIconMode(originalCreateEmptyRule());
    };

    const originalCollectRulesFromDom = collectRulesFromDom;
    collectRulesFromDom = function() {
      return originalCollectRulesFromDom().map((rule) => stripIconMode(rule));
    };

    const nextDefaultRules = buildDefaultRules();
    if (Array.isArray(DEFAULT_RULES)) {
      DEFAULT_RULES.splice(0, DEFAULT_RULES.length, ...nextDefaultRules);
    }

    if (typeof DEBUG_LOCAL_SANDBOX_PRESET === "object" && DEBUG_LOCAL_SANDBOX_PRESET) {
      delete DEBUG_LOCAL_SANDBOX_PRESET.iconMode;
    }
  }

  init();
})();
