(() => {
  const shared = window.TabBeaconSelectorUtils;
  if (typeof shared?.resolveSelectorType !== "function") {
    return;
  }

  const localFallback = typeof window.resolveSelectorType === "function"
    ? window.resolveSelectorType.bind(window)
    : null;

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

  for (const input of document.querySelectorAll(".condition-query, .scope-query")) {
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
})();
