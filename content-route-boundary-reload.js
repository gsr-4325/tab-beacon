(() => {
  if (window.__tabBeaconRouteBoundaryReloadLoaded) return;
  window.__tabBeaconRouteBoundaryReloadLoaded = true;

  const STORAGE_KEY = "tabBeaconRules";
  const BROAD_MATCHES = new Set([
    "https://chatgpt.com/*",
    "https://chat.openai.com/*"
  ]);
  const NARROW_MATCHES = [
    "https://chatgpt.com/c/*",
    "https://chatgpt.com/g/*/c/*"
  ];

  let lastMatched = false;
  let historyHooked = false;
  let storageHooked = false;
  let checkTimer = null;
  let reloadScheduled = false;

  bootstrap().catch((error) => {
    console.warn("[TabBeacon] route boundary bootstrap failed", error);
  });

  async function bootstrap() {
    const { matched, matchChangedByMigration } = await loadAndMaybeMigrateRules(location.href);
    lastMatched = matched;
    installHistoryHooks();
    watchStorageChanges();
    if (matchChangedByMigration) {
      scheduleReload();
    }
  }

  async function loadAndMaybeMigrateRules(href) {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const storedRules = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
    const beforeMatched = matchesAnyRule(storedRules, href);

    let changed = false;
    const nextRules = storedRules.map((rule) => {
      const migrated = migrateChatGptMatches(rule);
      if (migrated !== rule) changed = true;
      return migrated;
    });

    if (changed) {
      await chrome.storage.local.set({ [STORAGE_KEY]: nextRules });
    }

    const afterMatched = matchesAnyRule(nextRules, href);
    return {
      matched: afterMatched,
      matchChangedByMigration: changed && beforeMatched !== afterMatched
    };
  }

  function migrateChatGptMatches(rule) {
    const matches = Array.isArray(rule?.matches) ? rule.matches.filter(Boolean) : [];
    const isBroadDefault = matches.length === 2 && matches.every((pattern) => BROAD_MATCHES.has(pattern));
    if (!isBroadDefault) return rule;
    return {
      ...rule,
      matches: [...NARROW_MATCHES]
    };
  }

  function matchesAnyRule(rules, href) {
    return rules.some((rule) => (
      rule?.enabled !== false
      && Array.isArray(rule.matches)
      && rule.matches.some((pattern) => wildcardMatch(pattern, href))
    ));
  }

  function wildcardMatch(pattern, href) {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`).test(href);
  }

  async function handleBoundaryChange() {
    const { matched, matchChangedByMigration } = await loadAndMaybeMigrateRules(location.href);
    const boundaryChanged = matched !== lastMatched;
    lastMatched = matched;
    if (matchChangedByMigration || boundaryChanged) {
      scheduleReload();
    }
  }

  function queueBoundaryCheck() {
    clearTimeout(checkTimer);
    checkTimer = window.setTimeout(() => {
      handleBoundaryChange().catch((error) => {
        console.warn("[TabBeacon] route boundary check failed", error);
      });
    }, 50);
  }

  function scheduleReload() {
    if (reloadScheduled) return;
    reloadScheduled = true;
    window.setTimeout(() => {
      location.reload();
    }, 0);
  }

  function installHistoryHooks() {
    if (historyHooked) return;
    historyHooked = true;

    for (const name of ["pushState", "replaceState"]) {
      const original = history[name];
      history[name] = function (...args) {
        const result = original.apply(this, args);
        queueBoundaryCheck();
        return result;
      };
    }

    window.addEventListener("popstate", queueBoundaryCheck);
    window.addEventListener("hashchange", queueBoundaryCheck);
  }

  function watchStorageChanges() {
    if (storageHooked) return;
    storageHooked = true;

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local" || !changes[STORAGE_KEY]) return;
      queueBoundaryCheck();
    });
  }
})();
