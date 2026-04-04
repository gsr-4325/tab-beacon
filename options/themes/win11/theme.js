(() => {
  const THEME_STORAGE_KEY = window.TabBeaconThemeBootstrap?.THEME_STORAGE_KEY || "tabBeaconOptionsTheme";
  const MODE_STORAGE_KEY = "tabBeaconWin11ColorMode";
  const CURRENT_THEME = "win11";
  const AVAILABLE_THEMES = [
    { value: "default", labelKey: "optionsThemeDefault", fallback: "Default" },
    { value: "plain", labelKey: "optionsThemePlain", fallback: "Plain" },
    { value: "win11", labelKey: "optionsThemeWin11", fallback: "Win11" }
  ];
  const COLOR_MODES = ["dark", "light"];

  let rulesObserver = null;

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

  function resolveMode(mode) {
    if (mode === "dark" || mode === "light") return mode;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function getStoredMode() {
    try {
      const value = window.localStorage.getItem(MODE_STORAGE_KEY);
      return resolveMode(value);
    } catch {
      return resolveMode("auto");
    }
  }

  function setStoredMode(mode) {
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, COLOR_MODES.includes(mode) ? mode : resolveMode("auto"));
    } catch {
      // ignore storage access failures
    }
  }

  function applyMode(mode) {
    const resolved = resolveMode(mode);
    document.documentElement.dataset.win11Mode = resolved;

    document.querySelectorAll("[data-win11-mode-button]").forEach((button) => {
      const active = button.dataset.win11ModeButton === resolved;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
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

  function moonIconSvg() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M14.6 3.8a8.8 8.8 0 1 0 5.6 15.6 8.2 8.2 0 0 1-3.5.7A8.8 8.8 0 0 1 14.6 3.8Z"></path>
        <path d="M18.8 7.3l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5.5-1.2Z"></path>
        <path d="M6.9 11.7l.4 1 .9.4-.9.4-.4 1-.4-1-.9-.4.9-.4.4-1Z"></path>
      </svg>
    `;
  }

  function sunIconSvg() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="4.4"></circle>
        <path d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6M18.8 18.8l-1.6-1.6M6.8 6.8 5.2 5.2"></path>
      </svg>
    `;
  }

  function helpIconSvg() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M9.4 9.2a2.7 2.7 0 1 1 4.8 1.7c-.6.7-1.4 1.1-1.9 1.7-.3.4-.4.7-.4 1.4"></path>
        <circle cx="12" cy="17.2" r=".9"></circle>
      </svg>
    `;
  }

  function createModeButton(mode) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "win11-mode-button";
    button.dataset.win11ModeButton = mode;
    button.title = message(mode === "dark" ? "win11ModeDarkTooltip" : "win11ModeLightTooltip", mode === "dark" ? "Dark mode" : "Light mode");
    button.setAttribute("aria-label", button.title);
    button.innerHTML = mode === "dark" ? moonIconSvg() : sunIconSvg();
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
    switcher.setAttribute("role", "group");
    switcher.setAttribute("aria-label", "Display mode");
    COLOR_MODES.forEach((mode) => switcher.appendChild(createModeButton(mode)));
    heroActions.prepend(switcher);
  }

  function shouldIgnoreHeaderToggle(target) {
    return !!target.closest("input, textarea, select, button, a, label");
  }

  function decorateRemoveButton(button) {
    if (!button || button.dataset.win11RemoveEnhanced === "true") return;
    button.classList.add("win11-remove-icon-button");
    button.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4L4 12"/></svg>';
    button.title = message("remove", "Remove");
    button.setAttribute("aria-label", message("remove", "Remove"));
    button.dataset.win11RemoveEnhanced = "true";
  }

  function createHelpButton(labelKey, textKey, fallbackLabel, fallbackText) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "win11-help-button";
    button.innerHTML = helpIconSvg();
    button.title = message(textKey, fallbackText);
    button.setAttribute("aria-label", message(labelKey, fallbackLabel));
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    return button;
  }

  function ensureRuleHelp(root) {
    const urlLabelText = root.querySelector('label > span[data-i18n="urlPatterns"]');
    if (urlLabelText && !urlLabelText.parentElement.querySelector('.win11-help-button[data-help="url-patterns"]')) {
      const button = createHelpButton(
        "urlPatternsHelpLabel",
        "urlPatternsHelpTooltip",
        "Help for URL patterns",
        "Enter one URL pattern per line.\nExamples:\nhttps://chatgpt.com/*\nhttps://claude.ai/*\nOnly tabs whose URL matches one of these patterns are evaluated by this rule."
      );
      button.dataset.help = "url-patterns";
      urlLabelText.insertAdjacentElement("afterend", button);
    }

    const conditionsHeading = root.querySelector('.conditions-panel > .section-header > h3');
    if (conditionsHeading && !conditionsHeading.querySelector('.win11-help-button[data-help="conditions"]')) {
      const button = createHelpButton(
        "conditionsHelpLabel",
        "conditionsHelpTooltip",
        "Help for conditions",
        "Conditions can mix DOM and network checks.\nDOM example: [aria-busy=\"true\"] or //button[contains(@aria-label, \"Stop\")]\nNetwork example: urlContains: /backend-api/ or pathPrefix: /backend-api/conversation\nCondition join ANY matches when one condition is true. ALL matches only when every condition is true."
      );
      button.dataset.help = "conditions";
      conditionsHeading.appendChild(button);
    }
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
    const header = condition.querySelector(".condition-header");
    const toggle = condition.querySelector(".condition-toggle");

    decorateRemoveButton(removeButton);

    if (header && toggle) {
      header.addEventListener("click", (event) => {
        if (shouldIgnoreHeaderToggle(event.target)) return;
        toggle.click();
      });
    }

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
    ensureRuleHelp(rule);

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

  function syncDebugToggleIcon() {
    const icon = document.querySelector('#debugToggle .section-toggle-icon');
    if (icon) {
      icon.textContent = '▾';
    }
  }

  function ensureDebugHeaderBehavior() {
    const header = document.querySelector(".debug-card .section-header");
    const toggle = document.getElementById("debugToggle");
    if (!header || !toggle || header.dataset.win11Clickable === "true") return;

    syncDebugToggleIcon();

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
    const debugCard = page?.querySelector(".debug-card");
    const examplesCard = Array.from(page?.querySelectorAll(":scope > .card") || []).find((card) => card.querySelector(".examples"));
    const footer = document.querySelector(".app-footer");

    if (!page || !hero) return false;

    page.classList.add("win11-page");
    hero.classList.add("win11-hero");
    if (debugCard) debugCard.classList.add("win11-section-card", "win11-debug-card");
    if (footer) footer.classList.add("win11-footer");

    if (examplesCard) {
      examplesCard.classList.add("win11-hidden-section");
      examplesCard.remove();
    }

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
    syncDebugToggleIcon();

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
    if (document.readyState === "complete") {
      activate();
    } else {
      window.addEventListener("load", activate, { once: true });
    }
  }

  init();
})();
