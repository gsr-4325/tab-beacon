(() => {
  const THEME_STORAGE_KEY = window.TabBeaconThemeBootstrap?.THEME_STORAGE_KEY || "tabBeaconOptionsTheme";
  const MODE_STORAGE_KEY = "tabBeaconWin11ColorMode";
  const CURRENT_THEME = "win11";
  const AVAILABLE_THEMES = [
    { value: "default", labelKey: "optionsThemeDefault", fallback: "Default" },
    { value: "plain", labelKey: "optionsThemePlain", fallback: "Plain" },
    { value: "win11", labelKey: "optionsThemeWin11", fallback: "Win11" }
  ];
  const COLOR_MODES = ["dark", "auto", "light"];

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

  function getStoredMode() {
    try {
      const value = window.localStorage.getItem(MODE_STORAGE_KEY);
      return COLOR_MODES.includes(value) ? value : "auto";
    } catch {
      return "auto";
    }
  }

  function setStoredMode(mode) {
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, COLOR_MODES.includes(mode) ? mode : "auto");
    } catch {
      // ignore storage access failures
    }
  }

  function resolveMode(mode) {
    if (mode === "dark" || mode === "light") return mode;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyMode(mode) {
    const preference = COLOR_MODES.includes(mode) ? mode : "auto";
    const resolved = resolveMode(preference);
    document.documentElement.dataset.win11ModePreference = preference;
    document.documentElement.dataset.win11Mode = resolved;

    document.querySelectorAll("[data-win11-mode-button]").forEach((button) => {
      const isActive = button.dataset.win11ModeButton === preference;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function bindSystemPreferenceListener() {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (getStoredMode() === "auto") applyMode("auto");
    };
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleChange);
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

  function createModeButton(mode) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "win11-mode-button";
    button.dataset.win11ModeButton = mode;
    button.textContent = message(
      mode === "dark"
        ? "win11ModeDark"
        : mode === "light"
          ? "win11ModeLight"
          : "win11ModeAuto",
      mode.charAt(0).toUpperCase() + mode.slice(1)
    );
    button.addEventListener("click", () => {
      setStoredMode(mode);
      applyMode(mode);
    });
    return button;
  }

  function createMetricCard(id, labelText) {
    const card = document.createElement("article");
    card.className = "win11-metric-card";
    card.dataset.metricId = id;

    const label = document.createElement("div");
    label.className = "win11-metric-label";
    label.textContent = labelText;

    const value = document.createElement("div");
    value.className = "win11-metric-value";
    value.textContent = "0";

    const detail = document.createElement("div");
    detail.className = "win11-metric-detail";
    detail.textContent = "—";

    card.append(label, value, detail);
    return { card, value, detail };
  }

  function ensureLayout() {
    if (document.body.dataset.win11Enhanced === "true") return true;

    const page = document.querySelector(".page");
    const hero = page?.querySelector(".hero");
    const cards = Array.from(page?.querySelectorAll(":scope > .card") || []);
    const rulesCard = cards.find((card) => card.querySelector("#rulesContainer"));
    const debugCard = cards.find((card) => card.classList.contains("debug-card"));
    const examplesCard = cards.find((card) => card.querySelector(".examples"));
    const footer = document.querySelector(".app-footer");

    if (!page || !hero || !rulesCard) return false;

    const shell = document.createElement("div");
    shell.className = "win11-shell";

    const sidebar = document.createElement("aside");
    sidebar.className = "win11-sidebar";
    sidebar.innerHTML = `
      <div class="win11-sidebar-top">
        <div class="win11-app-caption">${message("win11SettingsCaption", "Settings")}</div>
        <div class="win11-profile-card">
          <div class="win11-avatar">TB</div>
          <div>
            <div class="win11-profile-name">Tab Beacon</div>
            <div class="win11-profile-mail">busy-signal@local</div>
          </div>
        </div>
        <label class="win11-search-box">
          <span class="win11-search-icon">⌕</span>
          <input type="text" value="Find a setting" readonly aria-label="Find a setting" />
        </label>
      </div>
      <nav class="win11-sidebar-nav" aria-label="Settings navigation">
        <button type="button" class="win11-nav-item"><span class="win11-nav-dot"></span><span>${message("win11NavSystem", "System")}</span></button>
        <button type="button" class="win11-nav-item"><span class="win11-nav-dot"></span><span>${message("win11NavBluetooth", "Bluetooth & devices")}</span></button>
        <button type="button" class="win11-nav-item"><span class="win11-nav-dot"></span><span>${message("win11NavNetwork", "Network & internet")}</span></button>
        <button type="button" class="win11-nav-item active"><span class="win11-nav-dot"></span><span>${message("win11NavPersonalization", "Personalization")}</span></button>
        <button type="button" class="win11-nav-item"><span class="win11-nav-dot"></span><span>${message("win11NavApps", "Apps")}</span></button>
        <button type="button" class="win11-nav-item"><span class="win11-nav-dot"></span><span>${message("win11NavAccounts", "Accounts")}</span></button>
      </nav>
    `;

    const main = document.createElement("section");
    main.className = "win11-main";

    const content = document.createElement("div");
    content.className = "win11-main-content";

    const heroCopy = hero.querySelector(".hero-copy");
    const heroActions = hero.querySelector(".hero-actions");
    const title = heroCopy?.querySelector("h1");
    const subtitle = heroCopy?.querySelector(".subtitle");
    const principles = heroCopy?.querySelector(".hero-principles");

    if (heroCopy && !heroCopy.querySelector(".win11-breadcrumbs")) {
      const breadcrumbs = document.createElement("div");
      breadcrumbs.className = "win11-breadcrumbs";
      breadcrumbs.textContent = `${message("win11CrumbPersonalization", "Personalization")} › ${message("win11CrumbTaskbar", "Taskbar")}`;
      heroCopy.insertBefore(breadcrumbs, heroCopy.firstChild);
    }

    if (title) title.textContent = message("win11HeroTitle", "Tab Beacon");
    if (subtitle) subtitle.textContent = message("win11HeroSubtitle", "Control how your busy-signal rules look and behave across watched tabs.");
    if (principles) principles.classList.add("win11-principles");

    if (heroActions && !heroActions.querySelector(".win11-mode-switch")) {
      const switcher = document.createElement("div");
      switcher.className = "win11-mode-switch";
      COLOR_MODES.forEach((mode) => switcher.appendChild(createModeButton(mode)));
      heroActions.prepend(switcher);
    }

    const metrics = document.createElement("section");
    metrics.className = "win11-metrics-grid";
    metricMap = new Map();
    [
      ["rules", message("win11MetricRules", "Installed rules")],
      ["enabled", message("win11MetricEnabled", "Enabled rules")],
      ["conditions", message("win11MetricConditions", "Conditions")],
      ["patterns", message("win11MetricPatterns", "URL patterns")]
    ].forEach(([id, labelText]) => {
      const metric = createMetricCard(id, labelText);
      metrics.appendChild(metric.card);
      metricMap.set(id, metric);
    });

    page.innerHTML = "";
    shell.append(sidebar, main);
    main.append(hero, metrics, content);
    content.append(rulesCard);
    if (debugCard) content.append(debugCard);
    if (examplesCard) content.append(examplesCard);
    if (footer) content.append(footer);
    page.appendChild(shell);

    hero.classList.add("win11-hero-card");
    rulesCard.classList.add("win11-section-card", "win11-rules-card");
    if (debugCard) debugCard.classList.add("win11-section-card", "win11-debug-card");
    if (examplesCard) examplesCard.classList.add("win11-section-card", "win11-examples-card");
    if (footer) footer.classList.add("win11-footer");

    document.body.dataset.win11Enhanced = "true";
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

    setMetric("rules", totalRules, totalRules === 1 ? "1 rule installed" : `${totalRules} rules installed`);
    setMetric("enabled", enabledRules, enabledRules === 1 ? "1 rule enabled" : `${enabledRules} rules enabled`);
    setMetric("conditions", conditions, smartBusyRules === 1 ? "1 smart busy rule" : `${smartBusyRules} smart busy rules`);
    setMetric("patterns", patterns, patterns === 1 ? "1 URL pattern" : `${patterns} URL patterns`);
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

  function activate() {
    if (!ensureLayout()) return;
    ensureThemeSelector();
    bindMetricUpdates();
    updateMetrics();
    applyMode(getStoredMode());
    window.setTimeout(updateMetrics, 120);
    window.TabBeaconOptionsTheme = {
      name: CURRENT_THEME,
      refresh: updateMetrics,
      setMode: (mode) => {
        setStoredMode(mode);
        applyMode(mode);
      }
    };
  }

  function init() {
    bindSystemPreferenceListener();
    if (document.readyState === "complete") {
      activate();
    } else {
      window.addEventListener("load", activate, { once: true });
    }
  }

  init();
})();
