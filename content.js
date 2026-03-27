const STORAGE_KEY = "tabBeaconRules";
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
    selectorType: "auto",
    busyQuery: '[aria-busy="true"]',
    useSmartBusySignals: true,
    iconMode: "overlaySpinner"
  }
];

let state = {
  activeRule: null,
  currentStatus: "idle",
  originalIcons: [],
  animationTimer: null,
  animationFrames: null,
  animationFrameIndex: 0,
  baseIconDataUrl: null,
  observer: null,
  reevaluateTimer: null,
  historyHooked: false
};

bootstrap().catch((error) => {
  console.error("[TabBeacon] bootstrap failed", error);
});

async function bootstrap() {
  const rules = await loadRules();
  const rule = pickRuleForLocation(rules, location.href);
  if (!rule) return;

  state.activeRule = normalizeRule(rule);
  state.originalIcons = captureOriginalIcons();
  state.baseIconDataUrl = await resolveBaseIconDataUrl(state.originalIcons);

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

function normalizeRule(rule) {
  return {
    selectorType: "auto",
    busyQuery: "",
    useSmartBusySignals: true,
    iconMode: "overlaySpinner",
    ...rule
  };
}

function pickRuleForLocation(rules, href) {
  return rules.find((rule) => {
    if (!rule.enabled) return false;
    return (rule.matches || []).some((pattern) => wildcardMatch(pattern, href));
  }) || null;
}

function wildcardMatch(pattern, href) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(href);
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
    if (areaName !== "local" || !changes[STORAGE_KEY]) return;
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
      scheduleReevaluate();
      return result;
    };
  };

  wrap("pushState");
  wrap("replaceState");
  window.addEventListener("popstate", scheduleReevaluate);
  window.addEventListener("hashchange", scheduleReevaluate);
}

function scheduleReevaluate() {
  if (!state.activeRule) return;
  clearTimeout(state.reevaluateTimer);
  state.reevaluateTimer = setTimeout(() => {
    applyStatus(evaluateBusyState() ? "busy" : "idle");
  }, EVALUATE_DEBOUNCE_MS);
}

function evaluateBusyState() {
  const rule = state.activeRule;
  if (!rule) return false;

  const explicitQueryMatch = rule.busyQuery.trim()
    ? queryExists(rule.busyQuery.trim(), rule.selectorType)
    : false;

  const smartSignalsMatch = rule.useSmartBusySignals && detectSmartBusySignals();

  return explicitQueryMatch || smartSignalsMatch;
}

function queryExists(query, selectorType = "auto") {
  try {
    const resolvedType = resolveSelectorType(query, selectorType);
    if (resolvedType === "css") {
      return !!document.querySelector(query);
    }
    if (resolvedType === "xpath") {
      const result = document.evaluate(
        query,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      return !!result.singleNodeValue;
    }
  } catch (error) {
    console.warn("[TabBeacon] query evaluation failed", { query, selectorType, error });
  }
  return false;
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

  const maybeStopButton = Array.from(document.querySelectorAll("button,[role='button'],a"))
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

      if (!label) return false;
      return /(stop|cancel|interrupt|停止|中断|生成を停止)/i.test(label);
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

    const centerX = 24;
    const centerY = 24;
    const radius = 5.5;

    for (let dotIndex = 0; dotIndex < FRAME_COUNT; dotIndex += 1) {
      const normalized = (dotIndex - frameIndex + FRAME_COUNT) % FRAME_COUNT;
      const alpha = 1 - normalized / FRAME_COUNT;
      const angle = (Math.PI * 2 * dotIndex) / FRAME_COUNT - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      ctx.beginPath();
      ctx.fillStyle = `rgba(37, 99, 235, ${Math.max(0.18, alpha)})`;
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

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

function setGeneratedIcon(dataUrl) {
  let link = document.getElementById(EXT_ICON_LINK_ID);
  if (!link) {
    link = document.createElement("link");
    link.id = EXT_ICON_LINK_ID;
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = dataUrl;
}

function restoreOriginalIcons() {
  const generated = document.getElementById(EXT_ICON_LINK_ID);
  if (generated) generated.remove();

  if (!document.querySelector("link[rel~='icon']") && state.originalIcons.length) {
    for (const icon of state.originalIcons) {
      const link = document.createElement("link");
      link.rel = icon.rel;
      if (icon.type) link.type = icon.type;
      if (icon.sizes) link.sizes = icon.sizes;
      link.href = icon.href;
      document.head.appendChild(link);
    }
  }
}

function cleanup(resetRule = true) {
  clearTimeout(state.reevaluateTimer);
  stopAnimation();
  restoreOriginalIcons();
  state.observer?.disconnect();
  state.observer = null;
  if (resetRule) {
    state.activeRule = null;
  }
}
