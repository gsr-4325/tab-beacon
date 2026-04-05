(() => {
  const STORAGE_KEY = "tabBeaconRules";
  const BROAD_MATCHES = new Set([
    "https://chatgpt.com/*",
    "https://chat.openai.com/*"
  ]);
  const NARROW_MATCHES = [
    "https://chatgpt.com/c/*",
    "https://chatgpt.com/g/*/c/*"
  ];
  const NARROW_TEXT = NARROW_MATCHES.join("\n");

  init().catch((error) => {
    console.warn("[TabBeacon] options ChatGPT defaults patch failed", error);
  });

  async function init() {
    await migrateStoredRules();
    patchVisibleRuleMatches();
    hookResetConfirmation();
  }

  async function migrateStoredRules() {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const storedRules = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
    if (!storedRules.length) return false;

    let changed = false;
    const nextRules = storedRules.map((rule) => {
      const migrated = migrateRule(rule);
      if (migrated !== rule) changed = true;
      return migrated;
    });

    if (changed) {
      await chrome.storage.local.set({ [STORAGE_KEY]: nextRules });
    }

    return changed;
  }

  function migrateRule(rule) {
    const matches = Array.isArray(rule?.matches) ? rule.matches.filter(Boolean) : [];
    const isBroadDefault = matches.length === 2 && matches.every((pattern) => BROAD_MATCHES.has(pattern));
    if (!isBroadDefault) return rule;
    return {
      ...rule,
      matches: [...NARROW_MATCHES]
    };
  }

  function patchVisibleRuleMatches() {
    document.querySelectorAll(".rule").forEach((ruleRoot) => {
      const matchesTextarea = ruleRoot.querySelector(".rule-matches");
      if (!matchesTextarea) return;

      const currentMatches = matchesTextarea.value
        .split("\n")
        .map((value) => value.trim())
        .filter(Boolean);

      const isBroadDefault = currentMatches.length === 2 && currentMatches.every((pattern) => BROAD_MATCHES.has(pattern));
      if (!isBroadDefault) return;

      matchesTextarea.value = NARROW_TEXT;
      matchesTextarea.dispatchEvent(new Event("input", { bubbles: true }));
      matchesTextarea.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  function hookResetConfirmation() {
    const resetConfirmOk = document.getElementById("resetConfirmOk");
    if (!resetConfirmOk || resetConfirmOk.dataset.chatgptDefaultsPatched === "true") return;

    resetConfirmOk.dataset.chatgptDefaultsPatched = "true";
    resetConfirmOk.addEventListener("click", () => {
      window.setTimeout(async () => {
        const changed = await migrateStoredRules();
        patchVisibleRuleMatches();
        if (changed) {
          window.location.reload();
        }
      }, 0);
    });
  }
})();
