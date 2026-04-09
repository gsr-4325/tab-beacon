(() => {
  const originalStatusLabel = typeof window.statusLabel === "function"
    ? window.statusLabel.bind(window)
    : null;
  const originalCreateDiagnosticRequestBlock = typeof window.createDiagnosticRequestBlock === "function"
    ? window.createDiagnosticRequestBlock.bind(window)
    : null;
  const originalRenderDiagnosticTabSummary = typeof window.renderDiagnosticTabSummary === "function"
    ? window.renderDiagnosticTabSummary.bind(window)
    : null;

  if (!originalStatusLabel || !originalCreateDiagnosticRequestBlock || !originalRenderDiagnosticTabSummary) {
    return;
  }

  function currentLang() {
    return (document.documentElement.lang || navigator.language || "").toLowerCase();
  }

  function isJapanese() {
    return currentLang().startsWith("ja");
  }

  function ignoredLabel() {
    return isJapanese() ? "無視" : "ignored";
  }

  function ignoredCountLabel(count) {
    return isJapanese() ? `無視 ${count}` : `Ignored ${count}`;
  }

  function attributionLabel(source) {
    const ja = {
      "direct-tab-id": "webRequest の tabId で直接帰属",
      "initiator-origin": "initiator origin から一意に帰属",
      "rule-filtered-initiator-origin": "same-origin 候補をルール適合で絞って帰属",
      "ambiguous-initiator-origin": "同一 origin の複数タブがあり帰属を見送り",
      "ambiguous-initiator-origin-after-rule-filter": "ルールで絞っても複数候補が残り帰属を見送り",
      "missing-tab-context": "tabId / initiator がなく帰属不可",
      "untracked-initiator-origin": "initiator origin に一致する追跡タブなし"
    };
    const en = {
      "direct-tab-id": "Direct webRequest tabId",
      "initiator-origin": "Recovered from initiator origin",
      "rule-filtered-initiator-origin": "Recovered after rule-filtering same-origin candidates",
      "ambiguous-initiator-origin": "Skipped: ambiguous initiator origin",
      "ambiguous-initiator-origin-after-rule-filter": "Skipped: multiple candidates remained after rule filtering",
      "missing-tab-context": "Skipped: missing tab context",
      "untracked-initiator-origin": "Skipped: no tracked tab for initiator origin"
    };
    return (isJapanese() ? ja : en)[source] || source || "—";
  }

  function addMetaLine(wrapper, text, className = "diagnostic-attribution-line") {
    if (!text) return;
    const line = document.createElement("div");
    line.className = className;
    line.textContent = text;
    wrapper.appendChild(line);
  }

  function createAttributionBlock(entry) {
    const wrapper = document.createElement("div");
    wrapper.className = "diagnostic-attribution-block";

    addMetaLine(wrapper, `${isJapanese() ? "帰属" : "Attribution"}: ${attributionLabel(entry.attributionSource)}`);
    addMetaLine(wrapper, entry.attributionNote || "");

    if (entry.initiator) {
      addMetaLine(wrapper, `${isJapanese() ? "Initiator" : "Initiator"}: ${entry.initiator}`);
    }

    if (typeof entry.originalTabId === "number") {
      addMetaLine(wrapper, `${isJapanese() ? "元の tabId" : "Original tabId"}: ${entry.originalTabId}`);
    }

    if (Array.isArray(entry.candidateTabIds) && entry.candidateTabIds.length > 1) {
      addMetaLine(
        wrapper,
        `${isJapanese() ? "候補タブ" : "Candidate tabs"}: ${entry.candidateTabIds.join(", ")}`
      );
    }

    if (Array.isArray(entry.filteredCandidateTabIds) && entry.filteredCandidateTabIds.length) {
      addMetaLine(
        wrapper,
        `${isJapanese() ? "絞り込み後候補" : "Filtered candidates"}: ${entry.filteredCandidateTabIds.join(", ")}`
      );
    }

    if (entry.cooldownUntil) {
      const remainingMs = Math.max(0, entry.cooldownUntil - Date.now());
      if (remainingMs > 0) {
        const seconds = (remainingMs / 1000).toFixed(1);
        addMetaLine(wrapper, isJapanese() ? `クールダウン残り ${seconds}s` : `Cooldown remaining ${seconds}s`);
      }
    }

    return wrapper.childNodes.length ? wrapper : null;
  }

  window.statusLabel = function statusLabelWithIgnored(status) {
    if (status === "ignored") {
      return ignoredLabel();
    }
    return originalStatusLabel(status);
  };

  window.createDiagnosticRequestBlock = function createDiagnosticRequestBlockWithAttribution(entry) {
    const block = originalCreateDiagnosticRequestBlock(entry);
    const attributionBlock = createAttributionBlock(entry || {});
    if (attributionBlock) {
      block.appendChild(attributionBlock);
    }
    return block;
  };

  window.renderDiagnosticTabSummary = function renderDiagnosticTabSummaryWithIgnored(tab, diagnostics) {
    originalRenderDiagnosticTabSummary(tab, diagnostics);
    if (!diagnostics) return;

    const summary = document.getElementById("diagnosticSummary");
    if (!summary || !summary.textContent) return;

    const ignoredCount = Number(diagnostics.ignoredRequestCount || 0);
    if (Number.isFinite(ignoredCount) && ignoredCount > 0) {
      summary.textContent = `${summary.textContent} · ${ignoredCountLabel(ignoredCount)}`;
    }
  };
})();
