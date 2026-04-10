(() => {
  const storageArea = chrome?.storage?.local;
  const RULES_STORAGE_KEY = "tabBeaconRules";
  const PATCH_FLAG = "__tabBeaconIconModePreloadPatched";
  const CHATGPT_PROJECT_PATTERN = "https://chatgpt.com/g/*/project*";
  const CHATGPT_MATCH_PATTERNS = new Set([
    "https://chatgpt.com/c/*",
    "https://chatgpt.com/g/*/c/*"
  ]);

  if (!storageArea || storageArea[PATCH_FLAG]) {
    return;
  }

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
    if (!Array.isArray(rules)) return rules;
    return rules.map((rule) => sanitizeRule(rule));
  };

  const sanitizeRecord = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    if (!Array.isArray(value[RULES_STORAGE_KEY])) return value;
    return {
      ...value,
      [RULES_STORAGE_KEY]: stripRules(value[RULES_STORAGE_KEY])
    };
  };

  const originalGet = storageArea.get.bind(storageArea);
  const originalSet = typeof storageArea.set === "function"
    ? storageArea.set.bind(storageArea)
    : null;

  storageArea.get = function patchedGet(keys, callback) {
    if (typeof callback === "function") {
      return originalGet(keys, (result) => callback(sanitizeRecord(result)));
    }

    return Promise.resolve(originalGet(keys)).then((result) => sanitizeRecord(result));
  };

  if (originalSet) {
    storageArea.set = function patchedSet(items, callback) {
      if (typeof callback === "function") {
        return originalSet(sanitizeRecord(items), callback);
      }

      return originalSet(sanitizeRecord(items));
    };
  }

  Object.defineProperty(storageArea, PATCH_FLAG, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });
})();
