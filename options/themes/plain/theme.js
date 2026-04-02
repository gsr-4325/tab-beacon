(() => {
  const THEME_STORAGE_KEY = window.TabBeaconThemeBootstrap?.THEME_STORAGE_KEY || "tabBeaconOptionsTheme";
  const MODE_STORAGE_KEY = "tabBeaconPlainColorMode";
  const CURRENT_THEME = "plain";
  const AVAILABLE_THEMES = [
    { value: "default", labelKey: "optionsThemeDefault", fallback: "Default" },
    { value: "plain", labelKey: "optionsThemePlain", fallback: "Plain" }
  ];
  const COLOR_MODES = ["auto", "light", "dark"];

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
    if (mode === "light" || mode === "dark") return mode;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyMode(mode) {
    const preference = COLOR_MODES.includes(mode) ? mode : "auto";
    const resolvedMode = resolveMode(preference);
    document.documentElement.dataset.plainModePreference = preference;
    document.documentElement.dataset.plainMode = resolvedMode;

    const modeToggle = document.getElementById("plainModeToggle");
    if (modeToggle) {
      modeToggle.textContent = message(
        preference === "auto"
          ? "plainModeAuto"
          : preference === "light"
            ? "plainModeLight"
            : "plainModeDark",
        preference
      );
      modeToggle.setAttribute("title", message("plainModeToggleHint", "Cycle Auto → Light → Dark"));
      modeToggle.setAttribute(
        "aria-label",
        `${message("plainModeToggleLabel", "Color mode")}: ${modeToggle.textContent}`
      );
    }
  }

  function cycleMode() {
    const current = getStoredMode();
    const nextIndex = (COLOR_MODES.indexOf(current) + 1) % COLOR_MODES.length;
    const nextMode = COLOR_MODES[nextIndex];
    setStoredMode(nextMode);
    applyMode(nextMode);
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

  function ensureModeToggle() {
    if (document.getElementById("plainModeToggle")) return;

    const heroActions = document.querySelector(".hero-actions");
    if (!heroActions) return;

    const button = document.createElement("button");
    button.type = "button";
    button.id = "plainModeToggle";
    button.className = "plain-mode-toggle";
    button.addEventListener("click", cycleMode);

    heroActions.prepend(button);
    applyMode(getStoredMode());
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

  function init() {
    ensureThemeSelector();
    ensureModeToggle();
    applyMode(getStoredMode());
    bindSystemPreferenceListener();
    window.TabBeaconOptionsTheme = {
      name: CURRENT_THEME,
      setMode: (mode) => {
        setStoredMode(mode);
        applyMode(mode);
      }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
