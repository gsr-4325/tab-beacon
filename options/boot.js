(() => {
  const themeRegistry = window.TabBeaconThemeRegistry;
  const DEFAULT_THEME = themeRegistry?.defaultTheme || "default";
  const THEME_STORAGE_KEY = "tabBeaconOptionsTheme";
  const AVAILABLE_THEMES = new Set(
    themeRegistry?.getThemes?.().map((theme) => theme.id) || [DEFAULT_THEME]
  );
  const LEGACY_THEME_ALIASES = {
    default: DEFAULT_THEME,
    ...(themeRegistry?.aliases || {})
  };

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
      const target = document.body || document.head || document.documentElement;
      target.appendChild(script);
    });
  }

  async function loadOptionalScript(src) {
    try {
      await loadScript(src);
      return true;
    } catch (error) {
      console.info("[Tab Beacon] optional script not loaded", src, error);
      return false;
    }
  }

  function normalizeReviewTarget(value) {
    const branch = typeof value?.branch === "string" && value.branch.trim() ? value.branch.trim() : "unknown";
    const commit = typeof value?.commit === "string" && value.commit.trim() ? value.commit.trim() : "unknown";
    const base = typeof value?.base === "string" ? value.base.trim() : "";
    const updatedAt = typeof value?.updatedAt === "string" ? value.updatedAt.trim() : "";
    const source = typeof value?.source === "string" && value.source.trim() ? value.source.trim() : "unavailable";
    return { branch, commit, base, updatedAt, source };
  }

  async function init() {
    const requestedTheme = resolveThemeName();

    window.TabBeaconThemeBootstrap = {
      DEFAULT_THEME,
      THEME_STORAGE_KEY,
      getThemeDefinition: (themeId) => themeRegistry?.getTheme?.(normalizeThemeName(themeId)) || null,
      getThemes: () => themeRegistry?.getThemes?.() || [],
      normalizeThemeName,
      getStoredTheme: readStoredTheme,
      setStoredTheme: writeStoredTheme
    };

    window.TabBeaconReviewTarget = normalizeReviewTarget(window.TabBeaconReviewTarget);
    await loadOptionalScript("../generated/review-build-info.local.js");
    window.TabBeaconReviewTarget = normalizeReviewTarget(window.TabBeaconReviewTarget);

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
    await loadScript("../shared/tab-beacon-selector-utils.js");
    await loadScript("./options-app.js");
    await loadScript("./selector-utils-bridge.js");
    await loadScript("./diagnostics-cooldown-bridge.js");
    await loadScript("./rule-behavior.js");
    await loadScript("./indicator-style.js");
    await loadScript("./options-packaged-sandbox.js");
    await loadScript("./review-target.js");
  }

  init().catch((error) => {
    console.error("[Tab Beacon] options bootstrap failed", error);
  });
})();
