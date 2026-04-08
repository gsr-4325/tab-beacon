(function () {
  if (window.__tabBeaconLoaded) return;
  window.__tabBeaconLoaded = true;

  const STORAGE_KEY = "tabBeaconRules";
  const UI_STATE_KEY = "tabBeaconUiState";
  const EXT_ICON_LINK_ID = "tabbeacon-generated-favicon";
  const FRAME_COUNT = 8;
  const FRAME_INTERVAL_MS = 250;
  const EVALUATE_DEBOUNCE_MS = 120;
  const EVALUATE_MAX_WAIT_MS = 400;
  const OBSERVER_REBUILD_DEBOUNCE_MS = 120;
  const EXT_NAME = "TabBeacon";
  const OBSERVER_DETAIL_OPTIONS = {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: false
  };
  const OBSERVER_DISCOVERY_OPTIONS = {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: false
  };

  const extensionApi = typeof chrome !== "undefined" ? chrome : null;
  const hasStorageApi = !!extensionApi?.storage?.local;
  const hasRuntimeApi = !!extensionApi?.runtime?.id;

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
    observerRebuildTimer: null,
    reevaluateTimer: null,
    reevaluateMaxWaitTimer: null,
    historyHooked: false,
    storageHooked: false,
    runtimeHooked: false,
    currentHref: location.href,
    bootstrapToken: 0,
    networkSnapshot: {},
    ruleActivity: new Map()
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

  bootstrap().catch((error) => console.error("[TabBeacon] bootstrap failed", error));

  async function bootstrap() {
    const bootstrapToken = ++state.bootstrapToken;
    const href = location.href;
    state.currentHref = href;

    if (!hasStorageApi || !hasRuntimeApi) logMissingExtensionApi();
    installRuntimeHooks();
    installHistoryHooks();
    watchStorageChanges();

    const [rules, uiState] = await Promise.all([
      loadRules(),
      storageLocalGet(UI_STATE_KEY)
    ]);
    if (bootstrapToken !== state.bootstrapToken) return;

    debugMode = !!uiState[UI_STATE_KEY]?.debugMode;
    if (debugMode) {
      try {
        const manifest = extensionApi.runtime?.getManifest?.();
        console.log(`✅ [${EXT_NAME} v${manifest.version}] Content script loaded on ${href}`);
      } catch {
        console.log(`✅ [${EXT_NAME}] Content script loaded on ${href}`);
      }
      dbg(
        `chrome.dom.openOrClosedShadowRoot available: ${typeof extensionApi?.dom?.openOrClosedShadowRoot === "function"}`
      );
    }

    cleanup();

    const matchingRules = rules
      .map(normalizeRule)
      .filter(
        (rule) =>
          rule.enabled &&
          rule.matches.some((pattern) => wildcardMatch(pattern, href))
      );

    dbg("bootstrap", {
      url: href,
      totalRules: rules.length,
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

  async function loadRules() {
    const result = await storageLocalGet(STORAGE_KEY);
    return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  }

  function normalizeBusyEndGraceMs(value, fallbackMs = 5000) {
    const n = Number(value);
    return Number.isFinite(n)
      ? Math.max(0, Math.min(300000, Math.round(n)))
      : fallbackMs;
  }

  function normalizeRule(rule, index = 0) {
    const legacyDomScopeQuery = typeof rule.domScopeQuery === "string"
      ? rule.domScopeQuery
      : (typeof rule.domScopeSelector === "string" ? rule.domScopeSelector : "");
    const domScopes = Array.isArray(rule.domScopes) && rule.domScopes.length
      ? rule.domScopes
      : legacyDomScopeQuery
        ? [{
            selectorType: rule.domScopeSelectorType || "auto",
            query: legacyDomScopeQuery
          }]
        : [];
    const normalized = {
      id: rule.id || `rule-${index}`,
      enabled: rule.enabled !== false,
      matches: Array.isArray(rule.matches) ? rule.matches : [],
      matchMode: rule.matchMode === "all" ? "all" : "any",
      busyWhen: [],
      domScopeMode: ["auto", "document", "selector"].includes(rule.domScopeMode)
        ? rule.domScopeMode
        : (domScopes.length ? "selector" : "auto"),
      domScopes: [],
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

    normalized.domScopes = domScopes
      .map((scope) => ({
        selectorType: scope.selectorType || "auto",
        query: typeof scope.query === "string" ? scope.query.trim() : ""
      }))
      .filter((scope) => scope.query);

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
      if (!message || message.type !== "tab-beacon/network-state") return;
      state.networkSnapshot = message.snapshot || {};
      scheduleReevaluate();
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
      const needsScopedRefresh = hasScopedDomObservationRules();
      for (const mutation of mutations) {
        if (needsScopedRefresh) {
          scheduleObserverRebuild();
        }
        for (const node of mutation.addedNodes) {
          if (!needsScopedRefresh && node.nodeType === Node.ELEMENT_NODE) {
            observeShadowRoots(node, OBSERVER_DETAIL_OPTIONS);
          }
        }
      }
    });

    rebuildObservers();
    window.addEventListener("beforeunload", cleanup, { once: true });
  }

  function scheduleObserverRebuild() {
    if (!state.observer) return;
    clearTimeout(state.observerRebuildTimer);
    state.observerRebuildTimer = setTimeout(() => {
      state.observerRebuildTimer = null;
      rebuildObservers();
    }, OBSERVER_REBUILD_DEBOUNCE_MS);
  }

  function rebuildObservers() {
    if (!state.observer || !document.body) return;
    state.observer.disconnect();

    for (const target of buildObservationTargets()) {
      const options = target.mode === "discovery"
        ? OBSERVER_DISCOVERY_OPTIONS
        : OBSERVER_DETAIL_OPTIONS;
      state.observer.observe(target.root, options);
      observeShadowRoots(target.root, options);
    }
  }

  function buildObservationTargets() {
    const targets = new Map();
    let needsBodyDetail = false;
    let needsBodyDiscovery = false;

    for (const rule of state.activeRules) {
      if (!ruleNeedsDomObservation(rule)) continue;

      if (rule.domScopeMode === "selector") {
        needsBodyDiscovery = true;
        for (const root of getDomSearchRoots(rule)) {
          addObservationTarget(targets, root, "detail");
        }
        continue;
      }

      needsBodyDetail = true;
    }

    if (needsBodyDetail && document.body) {
      addObservationTarget(targets, document.body, "detail");
    } else if (needsBodyDiscovery && document.body) {
      addObservationTarget(targets, document.body, "discovery");
    }

    return Array.from(targets.entries()).map(([root, mode]) => ({ root, mode }));
  }

  function addObservationTarget(targets, root, mode) {
    if (!root) return;
    const current = targets.get(root);
    if (current === "detail" || mode === current) return;
    targets.set(root, mode === "detail" ? "detail" : (current || "discovery"));
  }

  function ruleNeedsDomObservation(rule) {
    return rule.useSmartBusySignals || rule.busyWhen.some((condition) => condition.source === "dom");
  }

  function hasScopedDomObservationRules() {
    return state.activeRules.some((rule) => ruleNeedsDomObservation(rule) && rule.domScopeMode === "selector");
  }

  function observeShadowRoots(root, options) {
    const rootShadow = root instanceof Element ? getShadowRoot(root) : null;
    if (rootShadow) {
      state.observer.observe(rootShadow, options);
      observeShadowRoots(rootShadow, options);
    }

    const iter = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = iter.nextNode();
    while (node) {
      const shadow = getShadowRoot(node);
      if (shadow) {
        state.observer.observe(shadow, options);
        observeShadowRoots(shadow, options);
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
      if (!changes[STORAGE_KEY]) return;
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
    const domRoots = getDomSearchRoots(rule);
    const explicitResults = rule.busyWhen.map((condition, index) =>
      evaluateCondition(rule, condition, index, domRoots)
    );
    const explicitMatch = explicitResults.length
      ? rule.matchMode === "all"
        ? explicitResults.every(Boolean)
        : explicitResults.some(Boolean)
      : false;
    const smartSignalsMatch = rule.useSmartBusySignals && detectSmartBusySignals(rule, domRoots);
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

  function evaluateCondition(rule, condition, conditionIndex, domRoots = getDomSearchRoots(rule)) {
    if (condition.source === "network") {
      const snap = state.networkSnapshot?.[rule.id];
      const val = !!snap?.[String(conditionIndex)];
      if (debugMode && (val || snap)) {
        dbg(`network[${conditionIndex}] snap=${JSON.stringify(snap)} → ${val}`);
      }
      return val;
    }

    const el = queryExistsElement(condition.query, condition.selectorType, domRoots);
    if (debugMode) dbg(`dom[${conditionIndex}] "${condition.query}" → ${el ? el.tagName : "null"}`);
    return !!el;
  }

  function getDomSearchRoots(rule) {
    if (rule?.domScopeMode !== "selector") {
      return [document];
    }
    return resolveDomScopeRoots(rule);
  }

  function resolveDomScopeRoots(rule) {
    const roots = [];
    const seen = new Set();

    for (const scope of rule.domScopes || []) {
      for (const node of queryScopeRoots(scope.query, scope.selectorType)) {
        if (!(node instanceof Element) || !node.isConnected || seen.has(node)) continue;
        seen.add(node);
        roots.push(node);
      }
    }

    return roots;
  }

  function queryScopeRoots(query, selectorType = "auto") {
    try {
      const type = resolveSelectorType(query, selectorType);
      if (type === "css") {
        return collectElementsIncludingShadow(document, query);
      }
      if (type === "xpath") {
        return evaluateXPathElements(query, document);
      }
    } catch (error) {
      console.warn("[TabBeacon] scope query evaluation failed", { query, selectorType, error });
    }
    return [];
  }

  function collectElementsIncludingShadow(root, selector, results = [], seen = new Set()) {
    for (const el of root.querySelectorAll(selector)) {
      if (seen.has(el)) continue;
      seen.add(el);
      results.push(el);
    }

    const rootShadow = root instanceof Element ? getShadowRoot(root) : null;
    if (rootShadow) {
      collectElementsIncludingShadow(rootShadow, selector, results, seen);
    }

    const iter = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = iter.nextNode();
    while (node) {
      const shadow = getShadowRoot(node);
      if (shadow) {
        collectElementsIncludingShadow(shadow, selector, results, seen);
      }
      node = iter.nextNode();
    }

    return results;
  }

  function evaluateXPathElements(query, contextNode) {
    const snapshot = document.evaluate(
      query,
      contextNode,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    const results = [];
    for (let i = 0; i < snapshot.snapshotLength; i += 1) {
      const node = snapshot.snapshotItem(i);
      if (node instanceof Element) results.push(node);
    }
    return results;
  }

  function queryExistsElement(query, selectorType = "auto", roots = [document]) {
    try {
      const type = resolveSelectorType(query, selectorType);
      for (const root of roots) {
        if (type === "css") {
          const found = root.querySelector(query) || searchShadowDom(root, query);
          if (found) return found;
          continue;
        }
        if (type === "xpath") {
          const found = document.evaluate(
            query,
            root,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          ).singleNodeValue;
          if (found) return found;
        }
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
    const rootShadow = root instanceof Element ? getShadowRoot(root) : null;
    if (rootShadow) {
      const found = rootShadow.querySelector(selector) || searchShadowDom(rootShadow, selector);
      if (found) return found;
    }

    for (const el of root.querySelectorAll("*")) {
      const shadow = getShadowRoot(el);
      if (!shadow) continue;
      const found = shadow.querySelector(selector) || searchShadowDom(shadow, selector);
      if (found) return found;
    }
    return null;
  }

  function detectSmartBusySignals(rule, roots = getDomSearchRoots(rule)) {
    if (!roots.length) return false;

    for (const root of roots) {
      if (root.querySelector('[aria-busy="true"]') || searchShadowDom(root, '[aria-busy="true"]')) {
        return true;
      }
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

    let remaining = 120;
    for (const root of roots) {
      const candidates = Array.from(root.querySelectorAll("button,[role='button'],a")).slice(0, remaining);
      if (candidates.some(isStopLike)) return true;
      remaining -= candidates.length;
      if (remaining <= 0) break;
    }

    remaining = 120;
    for (const root of roots) {
      const shadowCandidates = collectShadowElements(root, "button,[role='button'],a", remaining);
      if (shadowCandidates.some(isStopLike)) return true;
      remaining -= shadowCandidates.length;
      if (remaining <= 0) break;
    }

    for (const root of roots) {
      if (root.querySelector('[aria-live][aria-busy="true"]') || searchShadowDom(root, '[aria-live][aria-busy="true"]')) {
        return true;
      }
    }

    return false;
  }

  function collectShadowElements(root, selector, limit) {
    const results = [];
    const rootShadow = root instanceof Element ? getShadowRoot(root) : null;
    if (rootShadow) {
      for (const el of rootShadow.querySelectorAll(selector)) {
        if (results.length >= limit) break;
        results.push(el);
      }
      for (const el of collectShadowElements(rootShadow, selector, limit - results.length)) {
        if (results.length >= limit) break;
        results.push(el);
      }
    }
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
    ctx.roundRect(0, 0, 32, 32, 8);
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
      startAnimation();
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
    if (link) return link;
    removeAllIconLinks();
    link = document.createElement("link");
    link.id = EXT_ICON_LINK_ID;
    link.rel = "icon";
    document.head.appendChild(link);
    return link;
  }

  function setGeneratedIcon(dataUrl) {
    ensureGeneratedIconLink().href = dataUrl;
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
    clearTimeout(state.observerRebuildTimer);
    clearTimeout(state.reevaluateTimer);
    clearTimeout(state.reevaluateMaxWaitTimer);
    state.observerRebuildTimer = null;
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
