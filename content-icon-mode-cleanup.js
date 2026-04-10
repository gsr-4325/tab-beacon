(() => {
  const storageArea = chrome?.storage?.local;
  if (!storageArea || typeof storageArea.get !== "function") {
    return;
  }

  const RULES_STORAGE_KEY = "tabBeaconRules";
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

  const stripRules = (rules) => {
    let changed = false;
    const next = rules.map((rule) => {
      const stripped = stripIconMode(rule);
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
