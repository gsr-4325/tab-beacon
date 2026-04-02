(() => {
  const THEME_STORAGE_KEY = window.TabBeaconThemeBootstrap?.THEME_STORAGE_KEY || "tabBeaconOptionsTheme";
  const CURRENT_THEME = "win10";
  const AVAILABLE_THEMES = [
    { value: "default", labelKey: "optionsThemeDefault", fallback: "Default" },
    { value: "plain", labelKey: "optionsThemePlain", fallback: "Plain" },
    { value: "win10", labelKey: "optionsThemeWin10", fallback: "Win10" }
  ];

  let metricMap = null;
  let metricsBound = false;

  function message(key, fallback) {
    try {
      return chrome.i18n.getMessage(key) || fallback || key;
    } catch {
      return fallback || key;
    }
  }

  function setStoredTheme(themeName) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeName);
    } catch {
      // ignore storage access failures
    }
  }

  function ensureThemeSelector() {
    if (document.getElementById("themeDebugControl")) return;

    const debugSectionBody = document.getElementById("debugSectionBody");
    if (!debugSectionBody) return;

    const wrapper = document.createElement("div");
    wrapper.id = "themeDebugControl";
    wrapper.className = "theme-debug-control";

    const label = document.createElement("label");
    label.className = "theme-debug-label";

    const title = document.createElement("span");
    title.className = "theme-debug-title";
    title.textContent = message("optionsThemeSelectorLabel", "Options theme");

    const select = document.createElement("select");
    select.id = "optionsThemeSelect";
    select.className = "theme-debug-select";
    select.setAttribute("aria-label", title.textContent);

    AVAILABLE_THEMES.forEach((theme) => {
      const option = document.createElement("option");
      option.value = theme.value;
      option.textContent = message(theme.labelKey, theme.fallback);
      select.appendChild(option);
    });

    select.value = document.documentElement.dataset.theme || CURRENT_THEME;
    select.addEventListener("change", () => {
      setStoredTheme(select.value);
      window.location.reload();
    });

    const hint = document.createElement("p");
    hint.className = "hint theme-debug-hint";
    hint.textContent = message(
      "optionsThemeSelectorHint",
      "Temporary theme switcher for comparing settings page concepts."
    );

    label.append(title, select);
    wrapper.append(label, hint);
    debugSectionBody.prepend(wrapper);
  }

  function createMetricCard(id, labelText) {
    const card = document.createElement("article");
    card.className = "win10-metric-card";
    card.dataset.metricId = id;

    const label = document.createElement("div");
    label.className = "win10-metric-label";
    label.textContent = labelText;

    const value = document.createElement("div");
    value.className = "win10-metric-value";
    value.textContent = "0";

    const detail = document.createElement("div");
    detail.className = "win10-metric-detail";
    detail.textContent = "—";

    card.append(label, value, detail);
    return { card, value, detail };
  }

  function ensureLayout() {
    if (document.body.dataset.win10Enhanced === "true") return true;

    const page = document.querySelector(".page");
    const hero = page?.querySelector(".hero");
    const rulesCard = Array.from(page?.querySelectorAll(".card") || []).find((card) => card.querySelector("#rulesContainer"));
    const debugCard = page?.querySelector(".debug-card");
    const examplesCard = Array.from(page?.querySelectorAll(".card") || []).find((card) => card.querySelector(".examples"));
    const footer = document.querySelector(".app-footer");

    if (!page || !hero || !rulesCard) return false;

    const summaryGrid = document.createElement("section");
    summaryGrid.className = "win10-summary-grid";
    metricMap = new Map();

    [
      ["rules", message("win10MetricRules", "Installed Rules")],
      ["enabled", message("win10MetricEnabled", "Active Rules")],
      ["conditions", message("win10MetricConditions", "Conditions")],
      ["patterns", message("win10MetricPatterns", "URL Patterns")]
    ].forEach(([id, labelText]) => {
      const metric = createMetricCard(id, labelText);
      summaryGrid.appendChild(metric.card);
      metricMap.set(id, metric);
    });

    page.insertBefore(summaryGrid, hero);

    hero.classList.add("win10-system-card");
    rulesCard.classList.add("win10-section-card", "win10-rules-card");
    if (debugCard) debugCard.classList.add("win10-section-card", "win10-debug-card");
    if (examplesCard) examplesCard.classList.add("win10-section-card", "win10-examples-card");

    const heroCopy = hero.querySelector(".hero-copy");
    const heroActions = hero.querySelector(".hero-actions");
    const title = heroCopy?.querySelector("h1");
    const subtitle = heroCopy?.querySelector(".subtitle");
    const principles = heroCopy?.querySelector(".hero-principles");

    if (heroCopy && !hero.querySelector(".win10-product-meta")) {
      const productMeta = document.createElement("div");
      productMeta.className = "win10-product-meta";
      productMeta.innerHTML = `
        <div class="win10-product-name">${message("win10ProductName", "One-PC")}</div>
        <div class="win10-product-subname">${message("win10ProductSubname", "System Product Name")}</div>
      `;
      heroCopy.insertBefore(productMeta, title || heroCopy.firstChild);
    }

    if (title) title.textContent = message("appName", "Tab Beacon");
    if (subtitle) subtitle.textContent = message("win10HeroSubtitle", "System-level busy signal configuration for the tabs you care about.");
    if (principles) principles.classList.add("win10-principles");
    if (heroActions) heroActions.classList.add("win10-hero-actions");

    if (footer && heroCopy && !heroCopy.contains(footer)) {
      heroCopy.appendChild(footer);
      footer.classList.add("win10-inline-footer");
    }

    document.body.dataset.win10Enhanced = "true";
    return true;
  }

  function collectRules() {
    return Array.from(document.querySelectorAll("#rulesContainer .rule"));
  }

  function countEnabledRules(rules) {
    return rules.filter((rule) => rule.querySelector(".rule-enabled")?.checked).length;
  }

  function countConditions(rules) {
    return rules.reduce((total, rule) => total + rule.querySelectorAll(".condition").length, 0);
  }

  function countUrlPatterns(rules) {
    return rules.reduce((total, rule) => {
      const value = rule.querySelector(".rule-matches")?.value || "";
      return total + value.split("\n").map((line) => line.trim()).filter(Boolean).length;
    }, 0);
  }

  function countSmartBusyRules(rules) {
    return rules.filter((rule) => rule.querySelector(".rule-smart-busy")?.checked).length;
  }

  function setMetric(id, value, detail) {
    const metric = metricMap?.get(id);
    if (!metric) return;
    metric.value.textContent = String(value);
    metric.detail.textContent = detail;
  }

  function updateMetrics() {
    if (!metricMap) return;
    const rules = collectRules();
    const totalRules = rules.length;
    const enabledRules = countEnabledRules(rules);
    const conditions = countConditions(rules);
    const patterns = countUrlPatterns(rules);
    const smartBusyRules = countSmartBusyRules(rules);

    setMetric("rules", totalRules, totalRules === 1 ? "1 rule loaded" : `${totalRules} rules loaded`);
    setMetric("enabled", enabledRules, `${totalRules} total rules`);
    setMetric("conditions", conditions, smartBusyRules === 1 ? "1 smart busy rule" : `${smartBusyRules} smart busy rules`);
    setMetric("patterns", patterns, enabledRules === 1 ? "1 active rule" : `${enabledRules} active rules`);
  }

  function bindMetricUpdates() {
    if (metricsBound) return;
    const rulesContainer = document.getElementById("rulesContainer");
    if (!rulesContainer) return;

    rulesContainer.addEventListener("input", updateMetrics);
    rulesContainer.addEventListener("change", updateMetrics);

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(updateMetrics);
    });
    observer.observe(rulesContainer, { childList: true, subtree: true });

    metricsBound = true;
  }

  function init() {
    ensureThemeSelector();

    const activate = () => {
      if (!ensureLayout()) return;
      bindMetricUpdates();
      updateMetrics();
      window.setTimeout(updateMetrics, 120);
      window.TabBeaconOptionsTheme = {
        name: CURRENT_THEME,
        refresh: updateMetrics
      };
    };

    if (document.readyState === "complete") {
      activate();
    } else {
      window.addEventListener("load", activate, { once: true });
    }
  }

  init();
})();
