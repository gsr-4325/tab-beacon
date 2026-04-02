(() => {
  const DEFAULT_THEME = "default";
  const THEME_STORAGE_KEY = "tabBeaconOptionsTheme";

  function sanitizeThemeName(value) {
    return /^[a-z0-9-]+$/i.test(value || "") ? value : DEFAULT_THEME;
  }

  function readStoredTheme() {
    try {
      return sanitizeThemeName(window.localStorage.getItem(THEME_STORAGE_KEY));
    } catch {
      return DEFAULT_THEME;
    }
  }

  function writeStoredTheme(themeName) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, sanitizeThemeName(themeName));
    } catch {
      // ignore storage access failures
    }
  }

  function resolveThemeName() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("theme")) {
      const themeFromQuery = sanitizeThemeName(params.get("theme"));
      writeStoredTheme(themeFromQuery);
      return themeFromQuery;
    }
    return readStoredTheme();
  }

  function loadStylesheet(href) {
    return new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = () => resolve(link);
      link.onerror = () => reject(new Error(`Failed to load stylesheet: ${href}`));
      document.head.appendChild(link);
    });
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve(script);
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.body.appendChild(script);
    });
  }

  async function init() {
    const requestedTheme = resolveThemeName();

    window.TabBeaconThemeBootstrap = {
      DEFAULT_THEME,
      THEME_STORAGE_KEY,
      sanitizeThemeName,
      getStoredTheme: readStoredTheme,
      setStoredTheme: writeStoredTheme
    };

    document.documentElement.dataset.theme = requestedTheme;

    try {
      await loadStylesheet(`./themes/${requestedTheme}/theme.css`);
      await loadScript(`./themes/${requestedTheme}/theme.js`);
    } catch (error) {
      console.warn("[Tab Beacon] failed to load requested theme, falling back to default", error);
      if (requestedTheme !== DEFAULT_THEME) {
        writeStoredTheme(DEFAULT_THEME);
        document.documentElement.dataset.theme = DEFAULT_THEME;
        await loadStylesheet(`./themes/${DEFAULT_THEME}/theme.css`);
        await loadScript(`./themes/${DEFAULT_THEME}/theme.js`);
      }
    }

    await loadScript("../i18n.js");
    await loadScript("./options-app.js");
    await loadScript("./options-packaged-sandbox.js");
  }

  init().catch((error) => {
    console.error("[Tab Beacon] options bootstrap failed", error);
  });
})();
