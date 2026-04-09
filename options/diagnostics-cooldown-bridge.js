(() => {
  const originalRenderDiagnosticTabSummary = typeof window.renderDiagnosticTabSummary === "function"
    ? window.renderDiagnosticTabSummary.bind(window)
    : null;

  if (!originalRenderDiagnosticTabSummary) {
    return;
  }

  const i18n = window.TabBeaconI18n || { t: (key) => key };
  const t = (key, substitutions) => i18n.t(key, substitutions);

  function appendCooldownSummary(diagnostics) {
    if (!diagnostics || typeof diagnostics !== "object") return;

    const count = Number(diagnostics.cooldownRequestCount || 0);
    if (!Number.isFinite(count) || count <= 0) return;

    const summary = document.getElementById("diagnosticSummary");
    if (!summary || !summary.textContent) return;

    const label = t("networkDiagnosticsCooldownLabel") === "networkDiagnosticsCooldownLabel"
      ? `Cooldown ${count}`
      : t("networkDiagnosticsCooldownLabel", [String(count)]);

    summary.textContent = `${summary.textContent} · ${label}`;
  }

  window.renderDiagnosticTabSummary = function renderDiagnosticTabSummaryWithCooldown(tab, diagnostics) {
    originalRenderDiagnosticTabSummary(tab, diagnostics);
    appendCooldownSummary(diagnostics);
  };
})();
