(() => {
  const shared = window.TabBeaconSelectorUtils;
  if (typeof shared?.resolveSelectorType !== "function") {
    return;
  }

  const localFallback = typeof window.resolveSelectorType === "function"
    ? window.resolveSelectorType.bind(window)
    : null;

  const refreshSelectorInputs = (root = document) => {
    for (const input of root.querySelectorAll(".condition-query, .scope-query")) {
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  window.resolveSelectorType = function resolveSelectorTypeBridge(query, selectorType) {
    try {
      return shared.resolveSelectorType(query, selectorType, document);
    } catch (error) {
      if (typeof localFallback === "function") {
        return localFallback(query, selectorType);
      }
      console.warn("[Tab Beacon] selector bridge fallback failed", error);
      return selectorType || "auto";
    }
  };

  refreshSelectorInputs(document);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.(".condition-query, .scope-query")) {
          node.dispatchEvent(new Event("input", { bubbles: true }));
          continue;
        }
        refreshSelectorInputs(node);
      }
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
      refreshSelectorInputs(document);
    }, { once: true });
  }
})();
