(() => {
  const DEFAULT_THEME = "win11";
  const THEME_STORAGE_KEY = "tabBeaconOptionsTheme";
  const AVAILABLE_THEMES = new Set(["win11", "vanilla"]);
  const LEGACY_THEME_ALIASES = { default: "vanilla", plain: "win11" };

  function normalizeThemeName(value) {
    const candidate = (value || "").trim();
    const mapped = LEGACY_THEME_ALIASES[candidate] || candidate;
    if (!/^[a-z0-9-]+$/i.test(mapped)) return DEFAULT_THEME;
    return AVAILABLE_THEMES.has(mapped) ? mapped : DEFAULT_THEME;
  }

  function readStoredTheme() {
    try { return normalizeThemeName(window.localStorage.getItem(THEME_STORAGE_KEY)); }
    catch { return DEFAULT_THEME; }
  }

  function writeStoredTheme(themeName) {
    try { window.localStorage.setItem(THEME_STORAGE_KEY, normalizeThemeName(themeName)); }
    catch {}
  }

  function resolveThemeName() {
    const params = new URLSearchParams(window.location.search);
    if (params.has("theme")) {
      const themeFromQuery = normalizeThemeName(params.get("theme"));
      writeStoredTheme(themeFromQuery);
      return themeFromQuery;
    }
    const storedTheme = readStoredTheme();
    writeStoredTheme(storedTheme);
    return storedTheme;
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
      normalizeThemeName,
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
    await loadScript("./rule-behavior.js");
    await loadScript("./options-packaged-sandbox.js");
  }

  init().catch((error) => {
    console.error("[Tab Beacon] options bootstrap failed", error);
  });
})();
