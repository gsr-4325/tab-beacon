(() => {
  const originalRenderDiagnosticTabSummary = typeof window.renderDiagnosticTabSummary === "function"
    ? window.renderDiagnosticTabSummary.bind(window)
    : null;

  if (!originalRenderDiagnosticTabSummary) {
    return;
  }

  const i18n = window.TabBeaconI18n || { t: (key) => key };
  const t = (key, substitutions) => i18n.t(key, substitutions);

  function fallbackCooldownLabel(count) {
    const lang = (document.documentElement.lang || navigator.language || "").toLowerCase();
    if (lang.startsWith("ja")) {
      return `クールダウン ${count}`;
    }
    return `Cooldown ${count}`;
  }

  function appendCooldownSummary(diagnostics) {
    if (!diagnostics || typeof diagnostics !== "object") return;

    const count = Number(diagnostics.cooldownRequestCount || 0);
    if (!Number.isFinite(count) || count <= 0) return;

    const summary = document.getElementById("diagnosticSummary");
    if (!summary || !summary.textContent) return;

    const translated = t("networkDiagnosticsCooldownLabel", [String(count)]);
    const label = translated === "networkDiagnosticsCooldownLabel"
      ? fallbackCooldownLabel(count)
      : translated;

    summary.textContent = `${summary.textContent} · ${label}`;
  }

  window.renderDiagnosticTabSummary = function renderDiagnosticTabSummaryWithCooldown(tab, diagnostics) {
    originalRenderDiagnosticTabSummary(tab, diagnostics);
    appendCooldownSummary(diagnostics);
  };
})();
