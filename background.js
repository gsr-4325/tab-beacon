const STORAGE_KEY = "tabBeaconRules";
const MAX_DIAGNOSTIC_ENTRIES = 80;

let rulesCache = [];
const tabUrls = new Map();
const requestMatches = new Map();
const tabConditionCounts = new Map();
const tabDiagnosticEntries = new Map();

initialize()
  .then(rebuildTabUrls)
  .catch((error) => {
    console.error("[TabBeacon:bg] initialize failed", error);
  });

chrome.runtime.onInstalled.addListener((details) => {
  initialize()
    .then(rebuildTabUrls)
    .then(() => {
      if (details.reason === "install" || details.reason === "update") {
        injectIntoExistingTabs();
      }
    })
    .catch((error) => console.error("[TabBeacon:bg] install init failed", error));
});

async function injectIntoExistingTabs() {
  const tabs = await chrome.tabs.query({ status: "complete" });
  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    const url = tab.url;
    if (
      url.startsWith("chrome://") ||
      url.startsWith("edge://") ||
      url.startsWith("about:") ||
      url.startsWith("chrome-extension://") ||
      url.startsWith("devtools://")
    ) continue;
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content-indicator-renderer.js"] })
      .catch(() => {});
  }
}

chrome.runtime.onStartup.addListener(() => {
  initialize()
    .then(rebuildTabUrls)
    .catch((error) => console.error("[TabBeacon:bg] startup init failed", error));
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[STORAGE_KEY]) return;
  initialize({ preserveRuntimeState: true })
    .catch((error) => console.error("[TabBeacon:bg] storage init failed", error));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabUrls.delete(tabId);
  tabConditionCounts.delete(tabId);
  tabDiagnosticEntries.delete(tabId);
  for (const [requestId, record] of requestMatches.entries()) {
    if (record.tabId === tabId) {
      requestMatches.delete(requestId);
    }
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (typeof changeInfo.url === "string" && changeInfo.url) {
    tabUrls.set(tabId, changeInfo.url);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== "object") return;

  if (message.type === "tab-beacon/register-tab") {
    if (sender.tab?.id >= 0 && typeof message.url === "string") {
      tabUrls.set(sender.tab.id, message.url);
      sendResponse({ snapshot: buildSnapshotForTab(sender.tab.id) });
      return true;
    }
  }

  if (message.type === "tab-beacon/get-network-state") {
    if (sender.tab?.id >= 0) {
      sendResponse({ snapshot: buildSnapshotForTab(sender.tab.id) });
      return true;
    }
  }

  if (message.type === "tab-beacon/get-network-diagnostics") {
    const tabId = resolveRequestedTabId(message, sender);
    if (tabId >= 0) {
      sendResponse({ diagnostics: buildDiagnosticsForTab(tabId) });
      return true;
    }
  }

  if (message.type === "tab-beacon/clear-network-diagnostics") {
    const tabId = resolveRequestedTabId(message, sender);
    if (tabId >= 0) {
      clearDiagnosticHistoryForTab(tabId);
      sendResponse({ diagnostics: buildDiagnosticsForTab(tabId) });
      return true;
    }
  }
});

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    handleRequestStarted(details);
  },
  { urls: ["<all_urls>"] }
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    handleRequestFinished(details.requestId, "completed");
  },
  { urls: ["<all_urls>"] }
);

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    handleRequestFinished(details.requestId, "error");
  },
  { urls: ["<all_urls>"] }
);

async function initialize({ preserveRuntimeState = false } = {}) {
  rulesCache = normalizeRules(await loadRules());
  if (!preserveRuntimeState) {
    clearRuntimeState();
    return;
  }

  reconcileRuntimeStateWithRules();
  broadcastSnapshotsToTrackedTabs();
}

function clearRuntimeState() {
  requestMatches.clear();
  tabConditionCounts.clear();
  tabDiagnosticEntries.clear();
}

function reconcileRuntimeStateWithRules() {
  const ruleById = new Map(rulesCache.map((rule) => [rule.id, rule]));
  const validConditionKeys = new Set();

  rulesCache.forEach((rule) => {
    rule.busyWhen.forEach((condition) => {
      validConditionKeys.add(`${rule.id}:${condition.originalIndex}`);
    });
  });

  for (const [requestId, record] of requestMatches.entries()) {
    const nextMatches = filterRelevantMatches(record.tabId, record.matches, ruleById, validConditionKeys);
    if (!nextMatches.length) {
      requestMatches.delete(requestId);
      continue;
    }
    record.matches = nextMatches;
  }

  for (const [tabId, entries] of tabDiagnosticEntries.entries()) {
    const nextEntries = entries
      .map((entry) => ({
        ...entry,
        matches: filterRelevantMatches(tabId, entry.matches, ruleById, validConditionKeys)
      }))
      .filter((entry) => entry.matches.length);

    if (nextEntries.length) {
      tabDiagnosticEntries.set(tabId, nextEntries);
    } else {
      tabDiagnosticEntries.delete(tabId);
    }
  }

  rebuildConditionCountsFromRequestMatches();
}

function filterRelevantMatches(tabId, matches, ruleById, validConditionKeys) {
  const tabUrl = tabUrls.get(tabId) || "";
  return (matches || []).filter((match) => {
    const key = `${match.ruleId}:${match.conditionIndex}`;
    if (!validConditionKeys.has(key)) return false;

    const rule = ruleById.get(match.ruleId);
    if (!rule?.enabled) return false;
    if (!tabUrl) return true;

    return rule.matches.some((pattern) => wildcardMatch(pattern, tabUrl));
  });
}

function rebuildConditionCountsFromRequestMatches() {
  tabConditionCounts.clear();

  for (const record of requestMatches.values()) {
    if (!record?.matches?.length) continue;

    const counts = tabConditionCounts.get(record.tabId) || new Map();
    record.matches.forEach(({ ruleId, conditionIndex }) => {
      const key = `${ruleId}:${conditionIndex}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    tabConditionCounts.set(record.tabId, counts);
  }
}

function broadcastSnapshotsToTrackedTabs() {
  const tabIds = new Set([
    ...tabUrls.keys(),
    ...tabConditionCounts.keys(),
    ...Array.from(requestMatches.values(), (record) => record.tabId)
  ]);

  tabIds.forEach((tabId) => {
    if (typeof tabId === "number" && tabId >= 0) {
      sendSnapshotToTab(tabId);
    }
  });
}

async function rebuildTabUrls() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id >= 0 && tab.url) {
      tabUrls.set(tab.id, tab.url);
    }
  }
}

async function loadRules() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
}

function normalizeRules(rules) {
  return rules.map((rule, index) => {
    const normalized = {
      id: rule.id || `rule-${index}`,
      enabled: rule.enabled !== false,
      matches: Array.isArray(rule.matches) ? rule.matches : [],
      busyWhen: [],
      selectorType: rule.selectorType || "auto",
      busyQuery: typeof rule.busyQuery === "string" ? rule.busyQuery.trim() : ""
    };

    if (Array.isArray(rule.busyWhen) && rule.busyWhen.length) {
      normalized.busyWhen = rule.busyWhen;
    } else if (normalized.busyQuery) {
      normalized.busyWhen = [
        {
          source: "dom",
          selectorType: normalized.selectorType,
          query: normalized.busyQuery
        }
      ];
    }

    normalized.busyWhen = normalized.busyWhen
      .map((condition, originalIndex) => ({
        source: condition.source === "network" ? "network" : "dom",
        originalIndex,
        matchType: condition.matchType || "urlContains",
        value: typeof condition.value === "string" ? condition.value.trim() : "",
        method: condition.method || "ANY",
        resourceKind: condition.resourceKind || "any"
      }))
      .filter((condition) => condition.source === "network" && condition.value);

    return normalized;
  });
}

// When a Service Worker makes a fetch on behalf of a page, Chrome assigns
// tabId = -1 to the request.  We only recover the real tab when the SW's
// origin (details.initiator) maps to exactly one tracked tab.  If multiple
// same-origin tabs are open, keeping the request unassigned is safer than
// attributing it to the wrong tab.
function findUniqueTabByOrigin(origin) {
  const matchingTabIds = [];

  for (const [tabId, tabUrl] of tabUrls.entries()) {
    try {
      if (new URL(tabUrl).origin === origin) {
        matchingTabIds.push(tabId);
        if (matchingTabIds.length > 1) {
          return -1;
        }
      }
    } catch {}
  }

  return matchingTabIds.length === 1 ? matchingTabIds[0] : -1;
}

async function handleRequestStarted(details) {
  let tabId = details.tabId;

  if (tabId < 0 && details.initiator) {
    tabId = findUniqueTabByOrigin(details.initiator);
  }
  if (tabId < 0) return;

  let tabUrl = tabUrls.get(tabId);
  if (!tabUrl) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab?.url) {
        tabUrl = tab.url;
        tabUrls.set(tabId, tabUrl);
      }
    } catch {
      return;
    }
    if (!tabUrl) return;
  }

  const matchingConditions = [];
  for (const rule of rulesCache) {
    if (!rule.enabled) continue;
    if (!rule.matches.some((pattern) => wildcardMatch(pattern, tabUrl))) continue;

    rule.busyWhen.forEach((condition) => {
      if (networkConditionMatches(condition, details)) {
        matchingConditions.push({
          ruleId: rule.id,
          conditionIndex: String(condition.originalIndex)
        });
      }
    });
  }

  if (!matchingConditions.length) return;

  const diagnosticEntryId = appendDiagnosticEntry(tabId, details, matchingConditions);

  requestMatches.set(details.requestId, {
    tabId,
    matches: matchingConditions,
    diagnosticEntryId
  });

  const counts = tabConditionCounts.get(tabId) || new Map();
  matchingConditions.forEach(({ ruleId, conditionIndex }) => {
    const key = `${ruleId}:${conditionIndex}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  tabConditionCounts.set(tabId, counts);
  sendSnapshotToTab(tabId);
}

function handleRequestFinished(requestId, finalStatus = "completed") {
  const record = requestMatches.get(requestId);
  if (!record) return;
  requestMatches.delete(requestId);

  updateDiagnosticEntry(record.tabId, record.diagnosticEntryId, finalStatus);

  const counts = tabConditionCounts.get(record.tabId);
  if (!counts) return;

  record.matches.forEach(({ ruleId, conditionIndex }) => {
    const key = `${ruleId}:${conditionIndex}`;
    const nextValue = (counts.get(key) || 0) - 1;
    if (nextValue > 0) {
      counts.set(key, nextValue);
    } else {
      counts.delete(key);
    }
  });

  if (counts.size) {
    tabConditionCounts.set(record.tabId, counts);
  } else {
    tabConditionCounts.delete(record.tabId);
  }

  sendSnapshotToTab(record.tabId);
}

function networkConditionMatches(condition, details) {
  if (condition.method !== "ANY" && (details.method || "").toUpperCase() !== condition.method) {
    return false;
  }

  if (!resourceKindMatches(condition.resourceKind, details.type)) {
    return false;
  }

  const url = details.url || "";
  if (condition.matchType === "pathPrefix") {
    try {
      return new URL(url).pathname.startsWith(condition.value);
    } catch {
      return false;
    }
  }

  if (condition.matchType === "regex") {
    try {
      return new RegExp(condition.value).test(url);
    } catch {
      return false;
    }
  }

  return url.includes(condition.value);
}

function resourceKindMatches(resourceKind, requestType) {
  if (resourceKind === "any") return true;
  // Service Worker fetches surface as "fetch" in webRequest; treat same as XHR
  if (resourceKind === "fetch-xhr") return requestType === "xmlhttprequest" || requestType === "fetch";
  if (resourceKind === "websocket") return requestType === "websocket";
  if (resourceKind === "other") return requestType !== "xmlhttprequest" && requestType !== "fetch" && requestType !== "websocket";
  return true;
}

function buildSnapshotForTab(tabId) {
  const counts = tabConditionCounts.get(tabId);
  if (!counts) return {};

  const snapshot = {};
  for (const [key, value] of counts.entries()) {
    if (value <= 0) continue;
    const [ruleId, conditionIndex] = key.split(":");
    snapshot[ruleId] ||= {};
    snapshot[ruleId][conditionIndex] = true;
  }
  return snapshot;
}

function appendDiagnosticEntry(tabId, details, matches) {
  const entries = tabDiagnosticEntries.get(tabId) || [];
  const entry = {
    id: createDiagnosticEntryId(),
    requestId: details.requestId,
    url: details.url || "",
    method: (details.method || "GET").toUpperCase(),
    requestType: details.type || "unknown",
    startedAt: Date.now(),
    finishedAt: null,
    status: "inflight",
    matches: matches.map(({ ruleId, conditionIndex }) => ({
      ruleId,
      conditionIndex
    }))
  };

  entries.unshift(entry);
  if (entries.length > MAX_DIAGNOSTIC_ENTRIES) {
    entries.length = MAX_DIAGNOSTIC_ENTRIES;
  }
  tabDiagnosticEntries.set(tabId, entries);
  return entry.id;
}

function updateDiagnosticEntry(tabId, diagnosticEntryId, finalStatus) {
  if (!diagnosticEntryId) return;
  const entries = tabDiagnosticEntries.get(tabId);
  if (!entries?.length) return;

  const entry = entries.find((item) => item.id === diagnosticEntryId);
  if (!entry) return;

  entry.status = finalStatus;
  entry.finishedAt = Date.now();
}

function clearDiagnosticHistoryForTab(tabId) {
  const entries = tabDiagnosticEntries.get(tabId) || [];
  const activeOnly = entries.filter((entry) => entry.status === "inflight");
  if (activeOnly.length) {
    tabDiagnosticEntries.set(tabId, activeOnly);
  } else {
    tabDiagnosticEntries.delete(tabId);
  }
}

function buildDiagnosticsForTab(tabId) {
  const entries = tabDiagnosticEntries.get(tabId) || [];
  return {
    tabId,
    tabUrl: tabUrls.get(tabId) || "",
    activeRequestCount: entries.filter((entry) => entry.status === "inflight").length,
    matchedConditionCount: Array.from((tabConditionCounts.get(tabId) || new Map()).keys()).length,
    snapshot: buildSnapshotForTab(tabId),
    entries: entries.map((entry) => ({
      id: entry.id,
      requestId: entry.requestId,
      url: entry.url,
      method: entry.method,
      requestType: entry.requestType,
      startedAt: entry.startedAt,
      finishedAt: entry.finishedAt,
      status: entry.status,
      matches: entry.matches
    }))
  };
}

function resolveRequestedTabId(message, sender) {
  if (typeof message.tabId === "number" && message.tabId >= 0) {
    return message.tabId;
  }
  if (sender.tab?.id >= 0) {
    return sender.tab.id;
  }
  return -1;
}

function createDiagnosticEntryId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sendSnapshotToTab(tabId) {
  const message = {
    type: "tab-beacon/network-state",
    snapshot: buildSnapshotForTab(tabId)
  };

  chrome.tabs.sendMessage(tabId, message, () => {
    void chrome.runtime.lastError;
  });
}

function wildcardMatch(pattern, href) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(href);
}
