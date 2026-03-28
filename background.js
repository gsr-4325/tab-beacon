const STORAGE_KEY = "tabBeaconRules";

let rulesCache = [];
const tabUrls = new Map();
const requestMatches = new Map();
const tabConditionCounts = new Map();

initialize().catch((error) => {
  console.error("[TabBeacon:bg] initialize failed", error);
});

chrome.runtime.onInstalled.addListener(() => {
  initialize().catch((error) => console.error("[TabBeacon:bg] install init failed", error));
});

chrome.runtime.onStartup.addListener(() => {
  initialize().catch((error) => console.error("[TabBeacon:bg] startup init failed", error));
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[STORAGE_KEY]) return;
  initialize().catch((error) => console.error("[TabBeacon:bg] storage init failed", error));
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabUrls.delete(tabId);
  tabConditionCounts.delete(tabId);
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
});

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    handleRequestStarted(details);
  },
  { urls: ["<all_urls>"] }
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    handleRequestFinished(details.requestId);
  },
  { urls: ["<all_urls>"] }
);

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    handleRequestFinished(details.requestId);
  },
  { urls: ["<all_urls>"] }
);

async function initialize() {
  rulesCache = normalizeRules(await loadRules());
  requestMatches.clear();
  tabConditionCounts.clear();
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
      busyWhen: Array.isArray(rule.busyWhen) ? rule.busyWhen : [],
      selectorType: rule.selectorType || "auto",
      busyQuery: typeof rule.busyQuery === "string" ? rule.busyQuery.trim() : ""
    };

    if (!normalized.busyWhen.length && normalized.busyQuery) {
      normalized.busyWhen = [
        {
          source: "dom",
          selectorType: normalized.selectorType,
          query: normalized.busyQuery
        }
      ];
    }

    normalized.busyWhen = normalized.busyWhen
      .map((condition) => ({
        source: condition.source === "network" ? "network" : "dom",
        matchType: condition.matchType || "urlContains",
        value: typeof condition.value === "string" ? condition.value.trim() : "",
        method: condition.method || "ANY",
        resourceKind: condition.resourceKind || "any"
      }))
      .filter((condition) => condition.source === "network" && condition.value);

    return normalized;
  });
}

function handleRequestStarted(details) {
  if (details.tabId < 0) return;

  const tabUrl = tabUrls.get(details.tabId);
  if (!tabUrl) return;

  const matchingConditions = [];
  for (const rule of rulesCache) {
    if (!rule.enabled) continue;
    if (!rule.matches.some((pattern) => wildcardMatch(pattern, tabUrl))) continue;

    rule.busyWhen.forEach((condition, conditionIndex) => {
      if (networkConditionMatches(condition, details)) {
        matchingConditions.push({
          ruleId: rule.id,
          conditionIndex: String(conditionIndex)
        });
      }
    });
  }

  if (!matchingConditions.length) return;

  requestMatches.set(details.requestId, {
    tabId: details.tabId,
    matches: matchingConditions
  });

  const counts = tabConditionCounts.get(details.tabId) || new Map();
  matchingConditions.forEach(({ ruleId, conditionIndex }) => {
    const key = `${ruleId}:${conditionIndex}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  tabConditionCounts.set(details.tabId, counts);
  sendSnapshotToTab(details.tabId);
}

function handleRequestFinished(requestId) {
  const record = requestMatches.get(requestId);
  if (!record) return;
  requestMatches.delete(requestId);

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
  if (resourceKind === "fetch-xhr") return requestType === "xmlhttprequest";
  if (resourceKind === "websocket") return requestType === "websocket";
  if (resourceKind === "other") return requestType !== "xmlhttprequest" && requestType !== "websocket";
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
