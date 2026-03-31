(function () {
if (window.__tabBeaconLoaded) return;
window.__tabBeaconLoaded = true;

const STORAGE_KEY = "tabBeaconRules";
const UI_STATE_KEY = "tabBeaconUiState";
const EXT_ICON_LINK_ID = "tabbeacon-generated-favicon";
const FRAME_COUNT = 8;
const FRAME_INTERVAL_MS = 250;
const EVALUATE_DEBOUNCE_MS = 120;

const DEFAULT_RULES = [
  {
    id: "default-chat-rule",
    name: "ChatGPT (starter)",
    enabled: true,
    matches: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
    matchMode: "any",
    busyWhen: [
      {
        source: "dom",
        selectorType: "auto",
        query: '[aria-busy="true"]'
      }
    ],
    useSmartBusySignals: true,
    iconMode: "overlaySpinner"
  }
];

let debugMode = false;
function dbg(...args) {
  if (debugMode) console.log("[TabBeacon:dbg]", ...args);
}

let state = {
  activeRules: [],
  currentStatus: "idle",
  originalIcons: [],
  animationTimer: null,
  animationFrames: null,
  animationFrameIndex: 0,
  baseIconDataUrl: null,
  observer: null,
  reevaluateTimer: null,
  historyHooked: false,
  runtimeHooked: false,
  networkSnapshot: {}
};

bootstrap().catch((error) => {
  console.error("[TabBeacon] bootstrap failed", error);
});

async function bootstrap() {
  const [rules, uiState] = await Promise.all([
    loadRules(),
    chrome.storage.local.get(UI_STATE_KEY)
  ]);
  debugMode = !!uiState[UI_STATE_KEY]?.debugMode;

  const normalizedRules = rules.map(normalizeRule).filter((rule) => rule.enabled);
  const matchingRules = pickRulesForLocation(normalizedRules, location.href);

  dbg("bootstrap", { url: location.href, totalRules: normalizedRules.length, matchingRules: matchingRules.length });

  if (!matchingRules.length) {
    dbg("no matching rules for this URL — exiting");
    return;
  }

  state.activeRules = matchingRules;
  state.originalIcons = captureOriginalIcons();
  state.baseIconDataUrl = await resolveBaseIconDataUrl(state.originalIcons);

  dbg("active rules", matchingRules.map(r => ({ name: r.id, conditions: r.busyWhen.length })));

  installRuntimeHooks();
  await registerCurrentTabUrl();
  applyStatus(evaluateBusyState() ? "busy" : "idle");
  installObservers();
  installHistoryHooks();
  watchStorageChanges();
}

async function loadRules() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const rules = Array.isArray(result[STORAGE_KEY]) && result[STORAGE_KEY].length
    ? result[STORAGE_KEY]
    : DEFAULT_RULES;

  if (!result[STORAGE_KEY]) {
    await chrome.storage.local.set({ [STORAGE_KEY]: rules });
  }
  return rules;
}

function normalizeRule(rule, index = 0) {
  const normalized = {
    id: rule.id || `rule-${index}`,
    enabled: rule.enabled !== false,
    matches: Array.isArray(rule.matches) ? rule.matches : [],
    matchMode: rule.matchMode === "all" ? "all" : "any",
    busyWhen: [],
    useSmartBusySignals: rule.useSmartBusySignals !== false,
    iconMode: rule.iconMode || "overlaySpinner"
  };

  if (Array.isArray(rule.busyWhen) && rule.busyWhen.length) {
    normalized.busyWhen = rule.busyWhen;
  } else if (typeof rule.busyQuery === "string" && rule.busyQuery.trim()) {
    normalized.busyWhen = [
      {
        source: "dom",
        selectorType: rule.selectorType || "auto",
        query: rule.busyQuery.trim()
      }
    ];
  }

  normalized.busyWhen = normalized.busyWhen
    .map((condition) => ({
      source: condition.source === "network" ? "network" : "dom",
      selectorType: condition.selectorType || "auto",
      query: typeof condition.query === "string" ? condition.query.trim() : "",
      matchType: condition.matchType || "urlContains",
      value: typeof condition.value === "string" ? condition.value.trim() : "",
      method: condition.method || "ANY",
      resourceKind: condition.resourceKind || "any"
    }))
    .filter((condition) => (condition.source === "network" ? condition.value : condition.query));

  return normalized;
}

function pickRulesForLocation(rules, href) {
  return rules.filter((rule) => rule.matches.some((pattern) => wildcardMatch(pattern, href)));
}

function wildcardMatch(pattern, href) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(href);
}

function installRuntimeHooks() {
  if (state.runtimeHooked) return;
  state.runtimeHooked = true;

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "tab-beacon/network-state") return;
    state.networkSnapshot = message.snapshot || {};
    scheduleReevaluate();
  });
}

async function registerCurrentTabUrl() {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "tab-beacon/register-tab",
      url: location.href
    });
    state.networkSnapshot = response?.snapshot || {};
  } catch (error) {
    console.warn("[TabBeacon] failed to register tab URL", error);
  }
}

function installObservers() {
  if (!document.body) {
    window.addEventListener("DOMContentLoaded", installObservers, { once: true });
    return;
  }

  state.observer = new MutationObserver(scheduleReevaluate);
  state.observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: false
  });

  window.addEventListener("beforeunload", cleanup, { once: true });
}

function watchStorageChanges() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes[UI_STATE_KEY]) {
      debugMode = !!changes[UI_STATE_KEY].newValue?.debugMode;
      dbg("debugMode updated:", debugMode);
    }
    if (!changes[STORAGE_KEY]) return;
    cleanup(false);
    bootstrap().catch((error) => console.error("[TabBeacon] reload failed", error));
  });
}

function installHistoryHooks() {
  if (state.historyHooked) return;
  state.historyHooked = true;

  const wrap = (name) => {
    const original = history[name];
    history[name] = function (...args) {
      const result = original.apply(this, args);
      registerCurrentTabUrl().finally(scheduleReevaluate);
      return result;
    };
  };

  wrap("pushState");
  wrap("replaceState");
  window.addEventListener("popstate", () => {
    registerCurrentTabUrl().finally(scheduleReevaluate);
  });
  window.addEventListener("hashchange", () => {
    registerCurrentTabUrl().finally(scheduleReevaluate);
  });
}

function scheduleReevaluate() {
  if (!state.activeRules.length) return;
  clearTimeout(state.reevaluateTimer);
  state.reevaluateTimer = setTimeout(() => {
    applyStatus(evaluateBusyState() ? "busy" : "idle");
  }, EVALUATE_DEBOUNCE_MS);
}

function evaluateBusyState() {
  if (!state.activeRules.length) return false;
  return state.activeRules.some((rule) => evaluateRuleBusy(rule));
}

function evaluateRuleBusy(rule) {
  const explicitResults = rule.busyWhen.map((condition, conditionIndex) =>
    evaluateCondition(rule, condition, conditionIndex)
  );
  const explicitMatch = explicitResults.length
    ? rule.matchMode === "all"
      ? explicitResults.every(Boolean)
      : explicitResults.some(Boolean)
    : false;

  const smartSignalsMatch = rule.useSmartBusySignals && detectSmartBusySignals();
  const result = explicitMatch || smartSignalsMatch;

  if (debugMode) {
    const conditionSummary = rule.busyWhen.map((c, i) => ({
      i,
      source: c.source,
      q: c.source === "network" ? c.value : c.query,
      hit: explicitResults[i]
    }));
    dbg(`rule [${rule.id}]`, { explicit: explicitMatch, smart: smartSignalsMatch, result, conditions: conditionSummary });
  }

  return result;
}

function evaluateCondition(rule, condition, conditionIndex) {
  if (condition.source === "network") {
    const snap = state.networkSnapshot?.[rule.id];
    const val = !!snap?.[String(conditionIndex)];
    if (debugMode && (val || snap)) {
      dbg(`network[${conditionIndex}] snap=${JSON.stringify(snap)} → ${val}`);
    }
    return val;
  }
  const el = queryExistsElement(condition.query, condition.selectorType);
  if (debugMode) {
    dbg(`dom[${conditionIndex}] "${condition.query}" → ${el ? el.tagName : "null"}`);
  }
  return !!el;
}

function queryExistsElement(query, selectorType = "auto") {
  try {
    const resolvedType = resolveSelectorType(query, selectorType);
    if (resolvedType === "css") {
      return document.querySelector(query);
    }
    if (resolvedType === "xpath") {
      const result = document.evaluate(query, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue;
    }
  } catch (error) {
    console.warn("[TabBeacon] query evaluation failed", { query, selectorType, error });
  }
  return null;
}


function resolveSelectorType(query, selectorType) {
  if (selectorType === "css" || selectorType === "xpath") {
    return selectorType;
  }

  const trimmed = query.trim();
  const xpathHint = /^(\.?\/{1,2}|\(|ancestor::|descendant::|following-sibling::|preceding-sibling::|self::|@)/i;
  if (xpathHint.test(trimmed) || trimmed.includes("::") || trimmed.includes("[@")) {
    return "xpath";
  }

  try {
    document.querySelector(trimmed);
    return "css";
  } catch {
    return "xpath";
  }
}

function detectSmartBusySignals() {
  const ariaBusy = document.querySelector('[aria-busy="true"]');
  if (ariaBusy) return true;

  const stopLikePattern = /(\bstop\b|\bcancel\b|\binterrupt\b|\u505c\u6b62|\u4e2d\u65ad|\u751f\u6210\u3092\u505c\u6b62)/i;
  const maybeStopButton = Array.from(document.querySelectorAll("button,[role='button'],a"))
    .filter((node) => !node.closest('[data-tabbeacon-ignore-smart-busy="true"]'))
    .slice(0, 120)
    .some((node) => {
      const label = [
        node.getAttribute("aria-label"),
        node.getAttribute("title"),
        node.getAttribute("data-testid"),
        node.textContent
      ]
        .filter(Boolean)
        .join(" ")
        .trim()
        .toLowerCase();

      return !!label && stopLikePattern.test(label);
    });

  if (maybeStopButton) return true;

  const liveBusy = document.querySelector('[aria-live][aria-busy="true"]');
  if (liveBusy) return true;

  return false;
}

function captureOriginalIcons() {
  return Array.from(document.querySelectorAll("link[rel~='icon']")).map((link) => ({
    href: link.href,
    rel: link.getAttribute("rel") || "icon",
    type: link.getAttribute("type") || "",
    sizes: link.getAttribute("sizes") || ""
  }));
}

async function resolveBaseIconDataUrl(originalIcons) {
  const preferredHref = pickPreferredIconHref(originalIcons);
  if (!preferredHref) {
    return createFallbackBaseIcon();
  }

  try {
    return await imageUrlToDataUrl(preferredHref);
  } catch (error) {
    console.warn("[TabBeacon] failed to render original favicon, using fallback", error);
    return createFallbackBaseIcon();
  }
}

function pickPreferredIconHref(originalIcons) {
  if (!originalIcons.length) return null;
  const sized = [...originalIcons].reverse().find((icon) => icon.sizes && icon.href);
  return (sized || [...originalIcons].reverse().find((icon) => icon.href) || {}).href || null;
}

function imageUrlToDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, 32, 32);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error(`Could not load image: ${url}`));
    img.src = url;
  });
}

function createFallbackBaseIcon() {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.roundRect(0, 0, 32, 32, 8);
  ctx.fill();

  ctx.fillStyle = "#f9fafb";
  ctx.font = "bold 18px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const initial = (document.title || location.hostname || "?").trim().charAt(0).toUpperCase() || "?";
  ctx.fillText(initial, 16, 17);

  return canvas.toDataURL("image/png");
}

function applyStatus(nextStatus) {
  if (state.currentStatus === nextStatus) return;
  dbg(`status: ${state.currentStatus} → ${nextStatus}`);
  state.currentStatus = nextStatus;

  if (nextStatus === "busy") {
    startAnimation();
  } else {
    stopAnimation();
    restoreOriginalIcons();
  }
}

async function startAnimation() {
  stopAnimation();

  if (!state.baseIconDataUrl) {
    state.baseIconDataUrl = await resolveBaseIconDataUrl(state.originalIcons);
  }

  state.animationFrames = await generateSpinnerFrames(state.baseIconDataUrl);
  state.animationFrameIndex = 0;
  setGeneratedIcon(state.animationFrames[0]);

  state.animationTimer = window.setInterval(() => {
    if (!state.animationFrames?.length) return;
    state.animationFrameIndex = (state.animationFrameIndex + 1) % state.animationFrames.length;
    setGeneratedIcon(state.animationFrames[state.animationFrameIndex]);
  }, FRAME_INTERVAL_MS);
}

function stopAnimation() {
  if (state.animationTimer) {
    clearInterval(state.animationTimer);
    state.animationTimer = null;
  }
}

async function generateSpinnerFrames(baseIconDataUrl) {
  const baseImage = await loadImage(baseIconDataUrl);
  const frames = [];

  for (let frameIndex = 0; frameIndex < FRAME_COUNT; frameIndex += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(baseImage, 0, 0, 32, 32);
    ctx.fillStyle = "rgba(7, 12, 24, 0.42)";
    ctx.beginPath();
    ctx.roundRect(0, 0, 32, 32, 8);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "rgba(37, 99, 235, 0.16)";
    ctx.arc(16, 16, 10.8, 0, Math.PI * 2);
    ctx.fill();

    const centerX = 16;
    const centerY = 16;
    const radius = 8.2;

    for (let dotIndex = 0; dotIndex < FRAME_COUNT; dotIndex += 1) {
      const normalized = (dotIndex - frameIndex + FRAME_COUNT) % FRAME_COUNT;
      const alpha = 1 - normalized / FRAME_COUNT;
      const angle = (Math.PI * 2 * dotIndex) / FRAME_COUNT - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.2, alpha)})`;
      ctx.arc(x, y, 2.45, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.38)";
    ctx.lineWidth = 1.15;
    ctx.arc(16, 16, 11.6, 0, Math.PI * 2);
    ctx.stroke();

    frames.push(canvas.toDataURL("image/png"));
  }

  return frames;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load frame base icon: ${url}`));
    img.src = url;
  });
}

function removeAllIconLinks() {
  document.querySelectorAll("link[rel~='icon']").forEach((link) => link.remove());
}

function ensureGeneratedIconLink() {
  let link = document.getElementById(EXT_ICON_LINK_ID);
  if (link) {
    return link;
  }

  removeAllIconLinks();
  link = document.createElement("link");
  link.id = EXT_ICON_LINK_ID;
  link.rel = "icon";
  document.head.appendChild(link);
  return link;
}

function setGeneratedIcon(dataUrl) {
  const link = ensureGeneratedIconLink();
  link.href = dataUrl;
}

function restoreOriginalIcons() {
  removeAllIconLinks();

  if (state.originalIcons.length) {
    for (const icon of state.originalIcons) {
      const link = document.createElement("link");
      link.rel = icon.rel;
      if (icon.type) link.type = icon.type;
      if (icon.sizes) link.sizes = icon.sizes;
      link.href = icon.href;
      document.head.appendChild(link);
    }
    return;
  }

  if (state.baseIconDataUrl) {
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = state.baseIconDataUrl;
    document.head.appendChild(link);
  }
}

function cleanup(resetRules = true) {
  clearTimeout(state.reevaluateTimer);
  stopAnimation();
  restoreOriginalIcons();
  state.observer?.disconnect();
  state.observer = null;
  if (resetRules) {
    state.activeRules = [];
    state.networkSnapshot = {};
  }
}

})();
