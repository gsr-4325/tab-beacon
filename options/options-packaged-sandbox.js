(() => {
  const STORAGE_KEY = "tabBeaconRules";
  const DEBUG_PRESET_SLUG = "debug-local-sandbox";
  const EXPECTED_MATCHES = [
    "file:///*manual-tests/*",
    "chrome-extension://*/manual-tests/*",
    "extension://*/manual-tests/*"
  ];

  function uniqueMatches(matches) {
    return Array.from(new Set(matches.filter(Boolean)));
  }

  function mergeExpectedMatches(matches) {
    return uniqueMatches([...(Array.isArray(matches) ? matches : []), ...EXPECTED_MATCHES]);
  }

  async function patchStoredPresetIfPresent() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const rules = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
    const index = rules.findIndex((rule) => rule?.slug === DEBUG_PRESET_SLUG);
    if (index < 0) return false;

    const current = rules[index];
    const nextMatches = mergeExpectedMatches(current.matches);
    const changed = JSON.stringify(nextMatches) !== JSON.stringify(current.matches || []);
    if (!changed) return false;

    const nextRules = [...rules];
    nextRules[index] = { ...current, matches: nextMatches };
    await chrome.storage.local.set({ [STORAGE_KEY]: nextRules });
    return true;
  }

  function patchRenderedPresetIfPresent() {
    const root = document.querySelector(`.rule[data-rule-slug="${DEBUG_PRESET_SLUG}"]`);
    if (!root) return false;

    const textarea = root.querySelector(".rule-matches");
    if (!textarea) return false;

    const currentMatches = textarea.value
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);
    const nextMatches = mergeExpectedMatches(currentMatches);
    const nextValue = nextMatches.join("\n");
    if (textarea.value === nextValue) return false;

    textarea.value = nextValue;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  async function syncDebugPresetMatches() {
    await patchStoredPresetIfPresent();
    patchRenderedPresetIfPresent();
  }

  syncDebugPresetMatches().catch((error) => {
    console.error("[TabBeacon] failed to sync packaged sandbox matches", error);
  });
})();
