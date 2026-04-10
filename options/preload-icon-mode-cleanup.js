(() => {
  const storageArea = chrome?.storage?.local;
  const RULES_STORAGE_KEY = "tabBeaconRules";
  const PATCH_FLAG = "__tabBeaconIconModePreloadPatched";

  if (!storageArea || storageArea[PATCH_FLAG]) {
    return;
  }

  const stripIconMode = (rule) => {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) return rule;
    if (!Object.prototype.hasOwnProperty.call(rule, "iconMode")) return rule;
    const { iconMode, ...rest } = rule;
    return rest;
  };

  const stripRules = (rules) => {
    if (!Array.isArray(rules)) return rules;
    return rules.map((rule) => stripIconMode(rule));
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
    const maybePromise = originalGet(keys, typeof callback === "function"
      ? (result) => callback(sanitizeRecord(result))
      : undefined);

    if (typeof callback === "function") {
      return maybePromise;
    }

    return Promise.resolve(maybePromise).then((result) => sanitizeRecord(result));
  };

  if (originalSet) {
    storageArea.set = function patchedSet(items, callback) {
      return originalSet(sanitizeRecord(items), callback);
    };
  }

  Object.defineProperty(storageArea, PATCH_FLAG, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false
  });
})();
