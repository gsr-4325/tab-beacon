(() => {
  function wildcardMatch(pattern, href) {
    const escaped = String(pattern || "")
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`).test(String(href || ""));
  }

  function resolveSelectorType(query, selectorType = "auto", queryContext = document) {
    if (!query) return selectorType;
    if (selectorType === "css" || selectorType === "xpath") {
      return selectorType;
    }

    const trimmed = String(query).trim();
    const xpathHint = /^(\.?\/{1,2}|\(|ancestor::|descendant::|following-sibling::|preceding-sibling::|self::|@)/i;
    if (xpathHint.test(trimmed) || trimmed.includes("::") || trimmed.includes("[@")) {
      return "xpath";
    }

    const context = queryContext?.querySelector ? queryContext : document;
    try {
      context.querySelector(trimmed);
      return "css";
    } catch {
      return "xpath";
    }
  }

  globalThis.TabBeaconSelectorUtils = Object.freeze({
    wildcardMatch,
    resolveSelectorType
  });
})();
