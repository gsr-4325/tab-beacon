(() => {
  const storageArea = chrome?.storage?.local;
  if (!storageArea || typeof storageArea.get !== "function") {
    return;
  }

  const RULES_STORAGE_KEY = "tabBeaconRules";
  const originalGet = storageArea.get.bind(storageArea);

  const stripIconMode = (rule) => {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) return rule;
    if (!Object.prototype.hasOwnProperty.call(rule, "iconMode")) return rule;
    const { iconMode, ...rest } = rule;
    return rest;
  };

  storageArea.get = async function patchedGet(keys) {
    const result = await originalGet(keys);
    if (!Array.isArray(result?.[RULES_STORAGE_KEY])) {
      return result;
    }

    const strippedRules = result[RULES_STORAGE_KEY].map(stripIconMode);
    return {
      ...result,
      [RULES_STORAGE_KEY]: strippedRules
    };
  };
})();
