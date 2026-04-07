(function () {
  if (window.__tabBeaconLoaded) return;
  window.__tabBeaconLoaded = true;

  const RULES_STORAGE_KEY = "tabBeaconRules";
  const UI_STATE_KEY = "tabBeaconUiState";
  const INDICATOR_STORAGE_KEY = "tabBeaconIndicatorSettings";
  const EXT_ICON_LINK_ID = "tabbeacon-generated-favicon";
  const FRAME_COUNT = 8;
  const FRAME_INTERVAL_MS = 250;
  const EVALUATE_DEBOUNCE_MS = 120;
  const EVALUATE_MAX_WAIT_MS = 400;
  const EXT_NAME = "TabBeacon";

  const extensionApi = typeof chrome !== "undefined" ? chrome : null;
  const hasStorageApi = !!extensionApi?.storage?.local;
  const hasRuntimeApi = !!extensionApi?.runtime?.id;

  const DEFAULT_INDICATOR_SETTINGS = Object.freeze({
    indicatorStyle: "spinner",
    spinnerStyle: "ring",
    badgeStyle: "dot",
    renderMethod: "frames"
  });

  const ANIMATED_BUSY_ICON_DATA_URL =
    "data:image/gif;base64,R0lGODlhIAAgAPcAAP///+Xr//T2/wAAAP7+/vj5/5SWmvz8/ADQ/wDK/wDS//7//wDW/wDG/wDe//39//n6/93g6+Dh5fHy9P3+/9rc5v7+/vHy8/38/fP09vX2+P///wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACH5BAEAAP8ALAAAAAAgACAAAAj/AP8JHEiwoMGDCBMqXMiwocOHECNKnEixosWLGDNq3Mixo8ePIEOKHElSZEiQJ0+SLEmyJMmTKFOqbMmypcuXMGO+bNmypc2bNEOCHEkypMmTJ1OqXMmypcuXL2PGjOlTZs+gQ4seTZo0adKkSKNKnUq1qtWrWLMmXcq0qdOnUKNKnUq1qtWrWLMuzfo0q1evYMWOHTu2rFu3cOM+bds2rly7duPKnaI279+BgBMnTpzIcR8nW8CIGUPHkCFRWlS4sGHKlClfrlzJdSvRqGjVpoQ5dGnZp0mTLjWqlCk1rly8eOMmXYs2rdq5du/CnatX7+DBgAMHTlzIkKFLly5dypUr2bJmza5du3YjABEAOw==";

  let debugMode = false;
  const state = {
    activeRules: [],
    currentStatus: "idle",
    originalIcons: [],
    animationTimer: null,
    animationFrames: null,
    animationFrameIndex: 0,
    baseIconDataUrl: null,
    observer: null,
    reevaluateTimer: null,
    reevaluateMaxWaitTimer: null,
    historyHooked: false,
    storageHooked: false,
    runtimeHooked: false,
    currentHref: location.href,
    bootstrapToken: 0,
    networkSnapshot: {},
    ruleActivity: new Map(),
    indicatorSettings: { ...DEFAULT_INDICATOR_SETTINGS }
  };

  const dbg = (...args) => {
    if (debugMode) console.log("[TabBeacon:dbg]", ...args);
  };

  function logMissingExtensionApi() {
    console.warn("[TabBeacon] extension APIs are unavailable in this execution context", {
      hasStorageApi,
      hasRuntimeApi,
      href: location.href
    });
  }

  function storageLocalGet(keys) {
    return hasStorageApi
      ? Promise.resolve(extensionApi.storage.local.get(keys))
      : Promise.resolve({});
  }

  async function bootstrap() {
    const bootstrapToken = ++state.bootstrapToken;
    const href = location.href;
    state.currentHref = href;

    if (!hasStorageApi || !hasRuntimeApi) logMissingExtensionApi();
    installRuntimeHooks();
    installHistoryHooks();
    watchStorageChanges();

    const [rulesResult, uiStateResult, indicatorResult] = await Promise.all([
      loadRules(),
      storageLocalGet(UI_STATE_KEY),
      storageLocalGet(INDICATOR_STORAGE_KEY)
    ]);
    if (bootstrapToken !== state.bootstrapToken) return;

    debugMode = !!uiStateResult[UI_STATE_KEY]?.debugMode;
    state.indicatorSettings = normalizeIndicatorSettings(
      indicatorResult[INDICATOR_STORAGE_KEY]
    );

    if (debugMode) {
      try {
        const manifest = extensionApi.runtime?.getManifest?.();
        console.log(`✅ [${EXT_NAME} v${manifest.version}] Content script loaded on ${location.href}`);
      } catch {
        console.log(`✅ [${EXT_NAME}] Content script loaded on ${location.href}`);
      }
      dbg(
        `chrome.dom.openOrClosedShadowRoot available: ${typeof extensionApi?.dom?.openOrClosedShadowRoot === "function"}`
      );
      dbg("indicator settings", state.indicatorSettings);
    }

    cleanup();

    const matchingRules = rulesResult
      .map(normalizeRule)
      .filter(
        (rule) =>
          rule.enabled &&
          rule.matches.some((pattern) => wildcardMatch(pattern, href))
      );

    dbg("bootstrap", {
      url: href,
      totalRules: rulesResult.length,
      matchingRules: matchingRules.length
    });

    if (!matchingRules.length) return;

    state.activeRules = matchingRules;
    state.ruleActivity = new Map();
    state.originalIcons = captureOriginalIcons();
    state.baseIconDataUrl = await resolveBaseIconDataUrl(state.originalIcons);
    if (bootstrapToken !== state.bootstrapToken) return;

    await registerCurrentTabUrl(href);
    if (bootstrapToken !== state.bootstrapToken) return;
    syncBusyStateWithRules({ allowGrace: false });
    installObservers();
  }

  bootstrap().catch((error) =>
    console.error("[TabBeacon] bootstrap failed", error)
  );

  async function loadRules() {
    const result = await storageLocalGet(RULES_STORAGE_KEY);
    return Array.isArray(result[RULES_STORAGE_KEY]) ? result[RULES_STORAGE_KEY] : [];
  }

  function normalizeIndicatorSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      indicatorStyle: source.indicatorStyle === "static-badge" ? "static-badge" : "spinner",
      spinnerStyle: "ring",
      badgeStyle: ["dot", "ring", "corner"].includes(source.badgeStyle)
        ? source.badgeStyle
        : "dot",
      renderMethod: source.renderMethod === "gif" ? "gif" : "frames"
    };
  }

  function normalizeBusyEndGraceMs(value, fallbackMs = 5000) {
    const n = Number(value);
    return Number.isFinite(n)
      ? Math.max(0, Math.min(300000, Math.round(n)))
      : fallbackMs;
  }

  function normalizeRule(rule, index = 0) {
    const normalized = {
      id: rule.id || `rule-${index}`,
      enabled: rule.enabled !== false,
      matches: Array.isArray(rule.matches) ? rule.matches : [],
      matchMode: rule.matchMode === "all" ? "all" : "any",
      busyWhen: [],
      useSmartBusySignals: rule.useSmartBusySignals !== false,
      busyEndGraceMs: normalizeBusyEndGraceMs(rule.busyEndGraceMs),
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

  function wildcardMatch(pattern, href) {
    return new RegExp(
      `^${pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")}$`
    ).test(href);
  }

  function ensureRuleActivityState(ruleId) {
    let entry = state.ruleActivity.get(ruleId);
    if (!entry) {
      entry = { effectiveBusy: false, idleTimer: null };
      state.ruleActivity.set(ruleId, entry);
    }
    return entry;
  }

  function cancelRuleIdleTimer(ruleId, entry = state.ruleActivity.get(ruleId)) {
    if (!entry?.idleTimer) return;
    clearTimeout(entry.idleTimer);
    entry.idleTimer = null;
  }

  function cancelAllRuleIdleTimers() {
    for (const [ruleId, entry] of state.ruleActivity.entries()) {
      cancelRuleIdleTimer(ruleId, entry);
    }
  }

  function hasEffectiveBusyRule() {
    for (const entry of state.ruleActivity.values()) {
      if (entry.effectiveBusy) return true;
    }
    return false;
  }

  function updateRuleActivity(rule, rawBusy, { allowGrace = true } = {}) {
    const entry = ensureRuleActivityState(rule.id);
    if (rawBusy) {
      cancelRuleIdleTimer(rule.id, entry);
      entry.effectiveBusy = true;
      return;
    }
    if (!entry.effectiveBusy) return;

    const graceMs = allowGrace ? normalizeBusyEndGraceMs(rule.busyEndGraceMs) : 0;
    if (graceMs <= 0) {
      cancelRuleIdleTimer(rule.id, entry);
      entry.effectiveBusy = false;
      return;
    }
    if (entry.idleTimer) return;

    dbg(`rule [${rule.id}] busy → idle pending (${graceMs}ms)`);
    entry.idleTimer = window.setTimeout(() => {
      const latest = ensureRuleActivityState(rule.id);
      latest.idleTimer = null;
      if (evaluateRuleBusy(rule)) {
        dbg(`rule [${rule.id}] idle grace canceled because it matched again`);
        latest.effectiveBusy = true;
        applyStatus("busy");
        return;
      }
      dbg(`rule [${rule.id}] busy → idle`);
      latest.effectiveBusy = false;
      applyStatus(hasEffectiveBusyRule() ? "busy" : "idle");
    }, graceMs);
  }

  function syncBusyStateWithRules({ allowGrace = true } = {}) {
    if (!state.activeRules.length) {
      applyStatus("idle");
      return false;
    }
    for (const rule of state.activeRules) {
      updateRuleActivity(rule, evaluateRuleBusy(rule), { allowGrace });
    }
    const busy = hasEffectiveBusyRule();
    applyStatus(busy ? "busy" : "idle");
    return busy;
  }

  function installRuntimeHooks() {
    if (state.runtimeHooked) return;
    state.runtimeHooked = true;
    if (!hasRuntimeApi || !extensionApi.runtime?.onMessage?.addListener) return;

    extensionApi.runtime.onMessage.addListener((message) => {
      if (!message) return;
      if (message.type === "tab-beacon/network-state") {
        state.networkSnapshot = message.snapshot || {};
        scheduleReevaluate();
        return;
      }
      if (message.type === "tab-beacon/apply-indicator-settings") {
        state.indicatorSettings = normalizeIndicatorSettings(message.settings);
        if (state.currentStatus === "busy") {
          startAnimation().catch((err) => console.error("[TabBeacon] startAnimation failed", err));
        } else {
          stopAnimation();
          restoreOriginalIcons();
        }
      }
    });
  }

  async function registerCurrentTabUrl(href = location.href) {
    try {
      if (!hasRuntimeApi || !extensionApi.runtime?.sendMessage) return;
      const response = await extensionApi.runtime.sendMessage({
        type: "tab-beacon/register-tab",
        url: href
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
    state.observer = new MutationObserver((mutations) => {
      scheduleReevaluate();
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            observeShadowRoots(node);
          }
        }
      }
    });
    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: false
    });
    observeShadowRoots(document.body);
    window.addEventListener("beforeunload", cleanup, { once: true });
  }

  function observeShadowRoots(root) {
    const iter = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = iter.nextNode();
    while (node) {
      const shadow = getShadowRoot(node);
      if (shadow) {
        state.observer.observe(shadow, {
          childList: true,
          subtree: true,
          attributes: true,
          characterData: false
        });
        observeShadowRoots(shadow);
      }
      node = iter.nextNode();
    }
  }

  function watchStorageChanges() {
    if (state.storageHooked) return;
    state.storageHooked = true;
    if (!extensionApi?.storage?.onChanged?.addListener) return;
    extensionApi.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;

      if (changes[UI_STATE_KEY]) {
        debugMode = !!changes[UI_STATE_KEY].newValue?.debugMode;
      }

      if (changes[INDICATOR_STORAGE_KEY]) {
        state.indicatorSettings = normalizeIndicatorSettings(
          changes[INDICATOR_STORAGE_KEY].newValue
        );
        if (state.currentStatus === "busy") {
          startAnimation().catch((err) => console.error("[TabBeacon] startAnimation failed", err));
        } else {
          stopAnimation();
          restoreOriginalIcons();
        }
      }

      if (!changes[RULES_STORAGE_KEY]) return;
      bootstrap().catch((error) => console.error("[TabBeacon] reload failed", error));
    });
  }

  function installHistoryHooks() {
    if (state.historyHooked) return;
    state.historyHooked = true;
    for (const name of ["pushState", "replaceState"]) {
      const original = history[name];
      history[name] = function (...args) {
        const result = original.apply(this, args);
        handleLocationChange();
        return result;
      };
    }
    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);
  }

  function handleLocationChange() {
    const href = location.href;
    if (href !== state.currentHref) {
      bootstrap().catch((error) => console.error("[TabBeacon] route reload failed", error));
      return;
    }
    registerCurrentTabUrl(href).finally(() => {
      if (state.activeRules.length) scheduleReevaluate();
    });
  }

  function scheduleReevaluate() {
    if (!state.activeRules.length) return;
    clearTimeout(state.reevaluateTimer);
    state.reevaluateTimer = setTimeout(() => {
      clearTimeout(state.reevaluateMaxWaitTimer);
      state.reevaluateMaxWaitTimer = null;
      syncBusyStateWithRules();
    }, EVALUATE_DEBOUNCE_MS);

    if (!state.reevaluateMaxWaitTimer) {
      state.reevaluateMaxWaitTimer = setTimeout(() => {
        state.reevaluateMaxWaitTimer = null;
        clearTimeout(state.reevaluateTimer);
        state.reevaluateTimer = null;
        syncBusyStateWithRules();
      }, EVALUATE_MAX_WAIT_MS);
    }
  }

  function evaluateRuleBusy(rule) {
    const explicitResults = rule.busyWhen.map((condition, index) =>
      evaluateCondition(rule, condition, index)
    );
    const explicitMatch = explicitResults.length
      ? rule.matchMode === "all"
        ? explicitResults.every(Boolean)
        : explicitResults.some(Boolean)
      : false;
    const smartSignalsMatch = rule.useSmartBusySignals && detectSmartBusySignals();
    const result = explicitMatch || smartSignalsMatch;
    if (debugMode) {
      dbg(`rule [${rule.id}]`, {
        explicit: explicitMatch,
        smart: smartSignalsMatch,
        result,
        conditions: rule.busyWhen.map((condition, i) => ({
          i,
          source: condition.source,
          q: condition.source === "network" ? condition.value : condition.query,
          hit: explicitResults[i]
        }))
      });
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
    if (debugMode) dbg(`dom[${conditionIndex}] "${condition.query}" → ${el ? el.tagName : "null"}`);
    return !!el;
  }

  function queryExistsElement(query, selectorType = "auto") {
    try {
      const type = resolveSelectorType(query, selectorType);
      if (type === "css") {
        return document.querySelector(query) || searchShadowDom(document, query);
      }
      if (type === "xpath") {
        return document.evaluate(
          query,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue;
      }
    } catch (error) {
      console.warn("[TabBeacon] query evaluation failed", { query, selectorType, error });
    }
    return null;
  }

  function resolveSelectorType(query, selectorType) {
    if (selectorType === "css" || selectorType === "xpath") return selectorType;
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

  function getShadowRoot(element) {
    if (!(element instanceof HTMLElement)) return element.shadowRoot ?? null;
    if (typeof extensionApi?.dom?.openOrClosedShadowRoot === "function") {
      try {
        return extensionApi.dom.openOrClosedShadowRoot(element);
      } catch {}
    }
    return element.shadowRoot ?? null;
  }

  function searchShadowDom(root, selector) {
    for (const el of root.querySelectorAll("*")) {
      const shadow = getShadowRoot(el);
      if (!shadow) continue;
      const found = shadow.querySelector(selector) || searchShadowDom(shadow, selector);
      if (found) return found;
    }
    return null;
  }

  function detectSmartBusySignals() {
    if (document.querySelector('[aria-busy="true"]') || searchShadowDom(document, '[aria-busy="true"]')) {
      return true;
    }
    const stopLikePattern = /(\bstop\b|\bcancel\b|\binterrupt\b|停止|中断|生成を停止)/i;
    const isStopLike = (node) => {
      if (node.closest?.('[data-tabbeacon-ignore-smart-busy="true"]')) return false;
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
    };
    if (Array.from(document.querySelectorAll("button,[role='button'],a")).slice(0, 120).some(isStopLike)) {
      return true;
    }
    const shadowMatch = collectShadowElements(document, "button,[role='button'],a", 120).some(isStopLike);
    if (shadowMatch) return true;
    return !!(
      document.querySelector('[aria-live][aria-busy="true"]') ||
      searchShadowDom(document, '[aria-live][aria-busy="true"]')
    );
  }

  function collectShadowElements(root, selector, limit) {
    const results = [];
    const iter = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = iter.nextNode();
    while (node && results.length < limit) {
      const shadow = getShadowRoot(node);
      if (shadow) {
        for (const el of shadow.querySelectorAll(selector)) {
          if (results.length >= limit) break;
          results.push(el);
        }
        for (const el of collectShadowElements(shadow, selector, limit - results.length)) {
          if (results.length >= limit) break;
          results.push(el);
        }
      }
      node = iter.nextNode();
    }
    return results;
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
    if (!preferredHref) return createFallbackBaseIcon();
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
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(0, 0, 32, 32, 8);
    } else {
      ctx.rect(0, 0, 32, 32);
    }
    ctx.fill();
    ctx.fillStyle = "#f9fafb";
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText((document.title || location.hostname || "?").trim().charAt(0).toUpperCase() || "?", 16, 17);
    return canvas.toDataURL("image/png");
  }

  function applyStatus(nextStatus) {
    if (state.currentStatus === nextStatus) return;
    dbg(`status: ${state.currentStatus} → ${nextStatus}`);
    state.currentStatus = nextStatus;
    if (nextStatus === "busy") {
      startAnimation().catch((err) => console.error("[TabBeacon] startAnimation failed", err));
      return;
    }
    stopAnimation();
    restoreOriginalIcons();
  }

  async function startAnimation() {
    stopAnimation();
    if (!state.baseIconDataUrl) {
      state.baseIconDataUrl = await resolveBaseIconDataUrl(state.originalIcons);
    }

    if (state.indicatorSettings.indicatorStyle === "static-badge") {
      setGeneratedIcon(
        await generateStaticBadgeDataUrl(state.baseIconDataUrl, state.indicatorSettings.badgeStyle),
        "image/png"
      );
      return;
    }

    if (state.indicatorSettings.renderMethod === "gif") {
      setGeneratedIcon(ANIMATED_BUSY_ICON_DATA_URL, "image/gif");
      return;
    }

    state.animationFrames = await generateSpinnerFrames(state.baseIconDataUrl);
    state.animationFrameIndex = 0;
    setGeneratedIcon(state.animationFrames[0], "image/png");
    state.animationTimer = window.setInterval(() => {
      if (!state.animationFrames?.length) return;
      state.animationFrameIndex = (state.animationFrameIndex + 1) % state.animationFrames.length;
      setGeneratedIcon(state.animationFrames[state.animationFrameIndex], "image/png");
    }, FRAME_INTERVAL_MS);
  }

  function stopAnimation() {
    if (state.animationTimer) {
      clearInterval(state.animationTimer);
      state.animationTimer = null;
    }
    state.animationFrames = null;
    state.animationFrameIndex = 0;
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
      drawSpinnerOverlay(ctx, frameIndex);
      frames.push(canvas.toDataURL("image/png"));
    }
    return frames;
  }

  function drawSpinnerOverlay(ctx, frameIndex = 0) {
    ctx.fillStyle = "rgba(7, 12, 24, 0.42)";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(0, 0, 32, 32, 8);
    } else {
      ctx.rect(0, 0, 32, 32);
    }
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "rgba(37, 99, 235, 0.16)";
    ctx.arc(16, 16, 10.8, 0, Math.PI * 2);
    ctx.fill();

    for (let dotIndex = 0; dotIndex < FRAME_COUNT; dotIndex += 1) {
      const normalized = (dotIndex - frameIndex + FRAME_COUNT) % FRAME_COUNT;
      const alpha = 1 - normalized / FRAME_COUNT;
      const angle = (Math.PI * 2 * dotIndex) / FRAME_COUNT - Math.PI / 2;
      const x = 16 + Math.cos(angle) * 8.2;
      const y = 16 + Math.sin(angle) * 8.2;
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
  }

  async function generateStaticBadgeDataUrl(baseIconDataUrl, badgeStyle) {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    const img = await loadImage(baseIconDataUrl);
    ctx.drawImage(img, 0, 0, 32, 32);

    if (badgeStyle === "ring") {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(59, 130, 246, 0.98)";
      ctx.lineWidth = 3.4;
      ctx.arc(24.5, 24.5, 5.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.lineWidth = 1.2;
      ctx.arc(24.5, 24.5, 7, 0, Math.PI * 2);
      ctx.stroke();
      return canvas.toDataURL("image/png");
    }

    if (badgeStyle === "corner") {
      ctx.fillStyle = "rgba(59, 130, 246, 0.98)";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(20, 4, 8, 8, 2.5);
      } else {
        ctx.rect(20, 4, 8, 8);
      }
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.lineWidth = 1;
      ctx.stroke();
      return canvas.toDataURL("image/png");
    }

    ctx.beginPath();
    ctx.fillStyle = "rgba(59, 130, 246, 0.98)";
    ctx.arc(24.5, 24.5, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.lineWidth = 1.6;
    ctx.arc(24.5, 24.5, 6.8, 0, Math.PI * 2);
    ctx.stroke();
    return canvas.toDataURL("image/png");
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
    if (link) return link;
    removeAllIconLinks();
    link = document.createElement("link");
    link.id = EXT_ICON_LINK_ID;
    link.rel = "icon";
    document.head.appendChild(link);
    return link;
  }

  function setGeneratedIcon(dataUrl, mimeType = "") {
    const link = ensureGeneratedIconLink();
    if (mimeType) {
      link.type = mimeType;
    } else {
      link.removeAttribute("type");
    }
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
    clearTimeout(state.reevaluateMaxWaitTimer);
    state.reevaluateTimer = null;
    state.reevaluateMaxWaitTimer = null;
    cancelAllRuleIdleTimers();
    state.ruleActivity = new Map();
    stopAnimation();
    if (document.getElementById(EXT_ICON_LINK_ID) || state.originalIcons.length || state.baseIconDataUrl) {
      restoreOriginalIcons();
    }
    state.currentStatus = "idle";
    state.observer?.disconnect();
    state.observer = null;
    state.originalIcons = [];
    state.baseIconDataUrl = null;
    state.animationFrames = null;
    state.animationFrameIndex = 0;
    if (resetRules) {
      state.activeRules = [];
      state.networkSnapshot = {};
    }
  }
})();
