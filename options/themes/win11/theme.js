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

  let rulesObserver = null;
  let systemModeBound = false;

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
      const active = button.dataset.win11ModeButton === preference;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function bindSystemPreferenceListener() {
    if (systemModeBound) return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (getStoredMode() === "auto") {
        applyMode("auto");
      }
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleChange);
    }

    systemModeBound = true;
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

    label.append(title, select);
    wrapper.append(label);
    debugSectionBody.prepend(wrapper);
  }

  function createModeButton(mode) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "win11-mode-button";
    button.dataset.win11ModeButton = mode;
    button.textContent = message(
      mode === "dark" ? "win11ModeDark" : mode === "light" ? "win11ModeLight" : "win11ModeAuto",
      mode.charAt(0).toUpperCase() + mode.slice(1)
    );
    button.addEventListener("click", () => {
      setStoredMode(mode);
      applyMode(mode);
    });
    return button;
  }

  function ensureModeSwitch(heroActions) {
    if (!heroActions || heroActions.querySelector(".win11-mode-switch")) return;

    const switcher = document.createElement("div");
    switcher.className = "win11-mode-switch";
    COLOR_MODES.forEach((mode) => switcher.appendChild(createModeButton(mode)));
    heroActions.prepend(switcher);
  }

  function shouldIgnoreHeaderToggle(target) {
    return !!target.closest("input, textarea, select, button, a, label");
  }

  function decorateRemoveButton(button) {
    if (!button || button.dataset.win11RemoveEnhanced === "true") return;
    button.classList.add("win11-remove-icon-button");
    button.textContent = "×";
    button.title = message("remove", "Remove");
    button.setAttribute("aria-label", message("remove", "Remove"));
    button.dataset.win11RemoveEnhanced = "true";
  }

  function createRuleToggleButton(checkbox) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "win11-rule-enable-button";
    button.innerHTML = `
      <span class="win11-rule-switch-text">Off</span>
      <span class="win11-switch-track"><span class="win11-switch-thumb"></span></span>
    `;

    const sync = () => {
      const enabled = !!checkbox.checked;
      button.classList.toggle("active", enabled);
      button.classList.toggle("disabled", !!checkbox.disabled);
      button.querySelector(".win11-rule-switch-text").textContent = enabled ? message("win11SwitchOn", "On") : message("win11SwitchOff", "Off");
      button.setAttribute("aria-pressed", String(enabled));
      button.disabled = !!checkbox.disabled;
    };

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (checkbox.disabled) return;
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("input", { bubbles: true }));
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      sync();
    });

    checkbox.addEventListener("change", sync);
    checkbox.addEventListener("input", sync);
    sync();
    return button;
  }

  function enhanceConditionCard(condition) {
    if (!condition || condition.dataset.win11EnhancedCondition === "true") return;
    const removeButton = condition.querySelector(".remove-condition");
    decorateRemoveButton(removeButton);
    condition.dataset.win11EnhancedCondition = "true";
  }

  function enhanceRuleCard(rule) {
    if (!rule || rule.dataset.win11EnhancedRule === "true") return;

    const head = rule.querySelector(".rule-head");
    const actions = rule.querySelector(".rule-head-actions");
    const enableLabel = actions?.querySelector(".inline");
    const checkbox = rule.querySelector(".rule-enabled");
    const ruleToggle = rule.querySelector(".rule-toggle");
    const removeButton = rule.querySelector(".remove-rule");

    if (!head || !actions || !checkbox || !ruleToggle) return;

    if (enableLabel) {
      enableLabel.classList.add("win11-enable-label");
      enableLabel.setAttribute("aria-hidden", "true");
    }

    decorateRemoveButton(removeButton);

    if (!actions.querySelector(".win11-rule-enable-button")) {
      const customToggle = createRuleToggleButton(checkbox);
      if (removeButton) {
        actions.insertBefore(customToggle, removeButton);
      } else {
        actions.appendChild(customToggle);
      }
    }

    if (actions.lastElementChild !== ruleToggle) {
      actions.appendChild(ruleToggle);
    }

    head.addEventListener("click", (event) => {
      if (shouldIgnoreHeaderToggle(event.target)) return;
      ruleToggle.click();
    });

    rule.dataset.win11EnhancedRule = "true";
  }

  function enhanceAllRules() {
    document.querySelectorAll("#rulesContainer .rule").forEach((rule) => {
      enhanceRuleCard(rule);
      rule.querySelectorAll(".condition").forEach(enhanceConditionCard);
    });
  }

  function observeRules() {
    const rulesContainer = document.getElementById("rulesContainer");
    if (!rulesContainer || rulesObserver) return;

    rulesObserver = new MutationObserver(() => {
      window.requestAnimationFrame(() => {
        enhanceAllRules();
      });
    });

    rulesObserver.observe(rulesContainer, { childList: true, subtree: true });
  }

  function ensureDebugHeaderBehavior() {
    const header = document.querySelector(".debug-card .section-header");
    const toggle = document.getElementById("debugToggle");
    if (!header || !toggle || header.dataset.win11Clickable === "true") return;

    header.addEventListener("click", (event) => {
      if (shouldIgnoreHeaderToggle(event.target)) return;
      toggle.click();
    });

    header.dataset.win11Clickable = "true";
  }

  function ensureLayout() {
    if (document.body.dataset.win11Enhanced === "true") return true;

    const page = document.querySelector(".page");
    const hero = page?.querySelector(".hero");
    const heroCopy = hero?.querySelector(".hero-copy");
    const heroActions = hero?.querySelector(".hero-actions");
    const title = heroCopy?.querySelector("h1");
    const subtitle = heroCopy?.querySelector(".subtitle");
    const principles = heroCopy?.querySelector(".hero-principles");
    const rulesCard = Array.from(page?.querySelectorAll(":scope > .card") || []).find((card) => card.querySelector("#rulesContainer"));
    const debugCard = page?.querySelector(".debug-card");
    const examplesCard = Array.from(page?.querySelectorAll(":scope > .card") || []).find((card) => card.querySelector(".examples"));
    const footer = document.querySelector(".app-footer");

    if (!page || !hero || !rulesCard) return false;

    page.classList.add("win11-page");
    hero.classList.add("win11-hero");
    rulesCard.classList.add("win11-section-card", "win11-rules-card");
    if (debugCard) debugCard.classList.add("win11-section-card", "win11-debug-card");
    if (examplesCard) examplesCard.classList.add("win11-section-card", "win11-examples-card");
    if (footer) footer.classList.add("win11-footer");

    if (title) {
      title.textContent = message("appName", "Tab Beacon");
    }

    if (subtitle) {
      subtitle.textContent = message("win11HeroSubtitle", "Configure your tab busy rules with a compact Windows 11 style layout.");
    }

    if (principles) {
      principles.classList.add("win11-hidden-principles");
    }

    ensureModeSwitch(heroActions);

    document.body.dataset.win11Enhanced = "true";
    return true;
  }

  function activate() {
    if (!ensureLayout()) return;
    ensureThemeSelector();
    enhanceAllRules();
    observeRules();
    ensureDebugHeaderBehavior();
    applyMode(getStoredMode());
    window.TabBeaconOptionsTheme = {
      name: CURRENT_THEME,
      setMode: (mode) => {
        setStoredMode(mode);
        applyMode(mode);
      },
      refresh: enhanceAllRules
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
