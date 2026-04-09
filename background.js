try {
  importScripts("shared/tab-beacon-selector-utils.js");
} catch (error) {
  console.warn("[TabBeacon:bg] failed to load shared selector utils", error);
}

const STORAGE_KEY = "tabBeaconRules";
const MAX_DIAGNOSTIC_ENTRIES = 80;
const NETWORK_IDLE_COOLDOWN_MS = 1200;
const sharedSelectorUtils = globalThis.TabBeaconSelectorUtils || null;

let rulesCache = [];
const tabUrls = new Map();
const requestMatches = new Map();
const cooldownMatches = new Map();
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
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["shared/tab-beacon-selector-utils.js", "content-indicator-renderer.js"]
    }).catch(() => {});
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

  for (const [cooldownId, record] of cooldownMatches.entries()) {
    if (record.tabId === tabId) {
      clearTimeout(record.timerId);
      cooldownMatches.delete(cooldownId);
    }
  }

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

  if (message.type === "tab-beacon/get-networkstate" || message.type === "tab-beacon/get-network-state") {
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
  for (const record of cooldownMatches.values()) {
    clearTimeout(record.timerId);
  }
  cooldownMatches.clear();
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

  for (const [cooldownId, record] of cooldownMatches.entries()) {
    const nextMatches = filterRelevantMatches(record.tabId, record.matches, ruleById, validConditionKeys);
    if (!nextMatches.length) {
      clearTimeout(record.timerId);
      cooldownMatches.delete(cooldownId);
      continue;
    }
    record.matches = nextMatches;
  }

  for (const [tabId, entries] of tabDiagnosticEntries.entries()) {
    const nextEntries = entries
      .map((entry) => {
        if (entry.kind === "ignored") {
          return entry;
        }
        return {
          ...entry,
          matches: filterRelevantMatches(tabId, entry.matches, ruleById, validConditionKeys)
        };
      })
      .filter((entry) => entry.kind === "ignored" || entry.matches.length);

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

  const applyRecordCounts = (record) => {
    if (!record?.matches?.length) return;

    const counts = tabConditionCounts.get(record.tabId) || new Map();
    record.matches.forEach(({ ruleId, conditionIndex }) => {
      const key = `${ruleId}:${conditionIndex}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    tabConditionCounts.set(record.tabId, counts);
  };

  for (const record of requestMatches.values()) {
    applyRecordCounts(record);
  }

  for (const record of cooldownMatches.values()) {
    applyRecordCounts(record);
  }
}

function broadcastSnapshotsToTrackedTabs() {
  const tabIds = new Set([
    ...tabUrls.keys(),
    ...tabConditionCounts.keys(),
    ...Array.from(requestMatches.values(), (record) => record.tabId),
    ...Array.from(cooldownMatches.values(), (record) => record.tabId)
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

function findTabsByOrigin(origin) {
  const matchingTabIds = [];

  for (const [tabId, tabUrl] of tabUrls.entries()) {
    try {
      if (new URL(tabUrl).origin === origin) {
        matchingTabIds.push(tabId);
      }
    } catch {}
  }

  return matchingTabIds;
}

function resolveRequestAttribution(details) {
  if (details.tabId >= 0) {
    return {
      tabId: details.tabId,
      source: "direct-tab-id",
      note: "Attributed directly from webRequest tabId.",
      candidateTabIds: []
    };
  }

  if (!details.initiator) {
    return {
      tabId: -1,
      source: "missing-tab-context",
      note: "Skipped attribution because the request had no tabId and no initiator.",
      candidateTabIds: []
    };
  }

  const candidateTabIds = findTabsByOrigin(details.initiator);
  if (candidateTabIds.length === 1) {
    return {
      tabId: candidateTabIds[0],
      source: "initiator-origin",
      note: "Recovered tab from a unique initiator origin match.",
      candidateTabIds
    };
  }

  if (candidateTabIds.length > 1) {
    return {
      tabId: -1,
      source: "ambiguous-initiator-origin",
      note: "Skipped attribution because multiple tracked tabs share this initiator origin.",
      candidateTabIds
    };
  }

  return {
    tabId: -1,
    source: "untracked-initiator-origin",
    note: "Skipped attribution because no tracked tab matched the initiator origin.",
    candidateTabIds: []
  };
}

async function handleRequestStarted(details) {
  const attribution = resolveRequestAttribution(details);

  if (attribution.tabId < 0) {
    if (attribution.source === "ambiguous-initiator-origin" && attribution.candidateTabIds.length) {
      attribution.candidateTabIds.forEach((candidateTabId) => {
        appendIgnoredDiagnosticEntry(candidateTabId, details, attribution);
      });
    }
    return;
  }

  const tabId = attribution.tabId;
  let tabUrl = tabUrls.get(tabId);
  if (!tabUrl) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab?.url) {
        tabUrl = tab.url;
        tabUrls.set(tabId, tabUrl);
      }
    } catch {
      appendIgnoredDiagnosticEntry(tabId, details, {
        ...attribution,
        note: "Skipped diagnostics because the tab URL could not be resolved."
      });
      return;
    }
    if (!tabUrl) {
      appendIgnoredDiagnosticEntry(tabId, details, {
        ...attribution,
        note: "Skipped diagnostics because the tab URL could not be resolved."
      });
      return;
    }
  }

  const candidateRules = rulesCache.filter((rule) => {
    return rule.enabled && rule.matches.some((pattern) => wildcardMatch(pattern, tabUrl));
  });
  const candidateNetworkRules = candidateRules.filter((rule) => {
    return rule.busyWhen.some((condition) => condition.source === "network");
  });

  if (!candidateNetworkRules.length) {
    return;
  }

  const matchingConditions = [];
  for (const rule of candidateNetworkRules) {
    rule.busyWhen.forEach((condition) => {
      if (networkConditionMatches(condition, details)) {
        matchingConditions.push({
          ruleId: rule.id,
          conditionIndex: String(condition.originalIndex)
        });
      }
    });
  }

  if (!matchingConditions.length) {
    appendIgnoredDiagnosticEntry(tabId, details, {
      ...attribution,
      note: `${attribution.note} No enabled network condition matched this request.`
    });
    return;
  }

  const diagnosticEntryId = appendDiagnosticEntry(tabId, details, matchingConditions, {
    kind: "match",
    attributionSource: attribution.source,
    attributionNote: attribution.note,
    initiator: details.initiator || "",
    originalTabId: typeof details.tabId === "number" ? details.tabId : null,
    candidateTabIds: attribution.candidateTabIds
  });

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

  const cooldownUntil = finalStatus !== "error" && NETWORK_IDLE_COOLDOWN_MS > 0
    ? Date.now() + NETWORK_IDLE_COOLDOWN_MS
    : null;

  updateDiagnosticEntry(record.tabId, record.diagnosticEntryId, finalStatus, { cooldownUntil });

  if (!record.matches?.length) {
    sendSnapshotToTab(record.tabId);
    return;
  }

  if (NETWORK_IDLE_COOLDOWN_MS > 0) {
    scheduleCooldown(record);
    sendSnapshotToTab(record.tabId);
    return;
  }

  decrementConditionCounts(record.tabId, record.matches);
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
  if (resourceKind === "fetch-xhr") return requestType === "xmlhttprequest" || requestType === "fetch";
  if (resourceKind === "websocket") return requestType === "websocket";
  if (resourceKind === "other") return requestType !== "xmlhttprequest" && requestType !== "fetch" && requestType !== "websocket";
  return true;
}

function scheduleCooldown(record) {
  const cooldownId = createDiagnosticEntryId();
  const timerId = setTimeout(() => {
    expireCooldown(cooldownId);
  }, NETWORK_IDLE_COOLDOWN_MS);

  cooldownMatches.set(cooldownId, {
    tabId: record.tabId,
    matches: record.matches,
    timerId
  });
}

function expireCooldown(cooldownId) {
  const record = cooldownMatches.get(cooldownId);
  if (!record) return;

  cooldownMatches.delete(cooldownId);
  decrementConditionCounts(record.tabId, record.matches);
  sendSnapshotToTab(record.tabId);
}

function decrementConditionCounts(tabId, matches) {
  const counts = tabConditionCounts.get(tabId);
  if (!counts) return;

  matches.forEach(({ ruleId, conditionIndex }) => {
    const key = `${ruleId}:${conditionIndex}`;
    const nextValue = (counts.get(key) || 0) - 1;
    if (nextValue > 0) {
      counts.set(key, nextValue);
    } else {
      counts.delete(key);
    }
  });

  if (counts.size) {
    tabConditionCounts.set(tabId, counts);
  } else {
    tabConditionCounts.delete(tabId);
  }
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

function appendDiagnosticEntry(tabId, details, matches, extras = {}) {
  const entries = tabDiagnosticEntries.get(tabId) || [];
  const entry = {
    id: createDiagnosticEntryId(),
    kind: extras.kind || "match",
    requestId: details.requestId,
    url: details.url || "",
    method: (details.method || "GET").toUpperCase(),
    requestType: details.type || "unknown",
    initiator: extras.initiator || details.initiator || "",
    originalTabId: typeof extras.originalTabId === "number"
      ? extras.originalTabId
      : (typeof details.tabId === "number" ? details.tabId : null),
    attributionSource: extras.attributionSource || "direct-tab-id",
    attributionNote: extras.attributionNote || "",
    candidateTabIds: Array.isArray(extras.candidateTabIds) ? extras.candidateTabIds : [],
    startedAt: extras.startedAt || Date.now(),
    finishedAt: extras.finishedAt || null,
    cooldownUntil: extras.cooldownUntil || null,
    status: extras.status || "inflight",
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

function appendIgnoredDiagnosticEntry(tabId, details, attribution) {
  return appendDiagnosticEntry(tabId, details, [], {
    kind: "ignored",
    status: "ignored",
    finishedAt: Date.now(),
    attributionSource: attribution.source,
    attributionNote: attribution.note,
    initiator: details.initiator || "",
    originalTabId: typeof details.tabId === "number" ? details.tabId : null,
    candidateTabIds: attribution.candidateTabIds || []
  });
}

function updateDiagnosticEntry(tabId, diagnosticEntryId, finalStatus, extras = {}) {
  if (!diagnosticEntryId) return;
  const entries = tabDiagnosticEntries.get(tabId);
  if (!entries?.length) return;

  const entry = entries.find((item) => item.id === diagnosticEntryId);
  if (!entry) return;

  entry.status = finalStatus;
  entry.finishedAt = Date.now();
  entry.cooldownUntil = extras.cooldownUntil || null;
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
    ignoredRequestCount: entries.filter((entry) => entry.status === "ignored").length,
    cooldownRequestCount: Array.from(cooldownMatches.values()).filter((record) => record.tabId === tabId).length,
    matchedConditionCount: Array.from((tabConditionCounts.get(tabId) || new Map()).keys()).length,
    snapshot: buildSnapshotForTab(tabId),
    entries: entries.map((entry) => ({
      id: entry.id,
      kind: entry.kind,
      requestId: entry.requestId,
      url: entry.url,
      method: entry.method,
      requestType: entry.requestType,
      initiator: entry.initiator,
      originalTabId: entry.originalTabId,
      attributionSource: entry.attributionSource,
      attributionNote: entry.attributionNote,
      candidateTabIds: entry.candidateTabIds,
      startedAt: entry.startedAt,
      finishedAt: entry.finishedAt,
      cooldownUntil: entry.cooldownUntil,
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
  if (typeof sharedSelectorUtils?.wildcardMatch === "function") {
    return sharedSelectorUtils.wildcardMatch(pattern, href);
  }

  const escaped = String(pattern || "")
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(String(href || ""));
}
