(() => {
  const themes = [
    { id: "default", labelKey: "optionsThemeDefault", fallback: "Default" }
  ];
  const themeMap = new Map(themes.map((theme) => [theme.id, Object.freeze({ ...theme })]));

  function getTheme(themeId) {
    return themeMap.get(themeId) || themeMap.get(themes[0].id) || null;
  }

  const registry = {
    defaultTheme: themes[0].id,
    getTheme,
    getThemes() {
      return Array.from(themeMap.values());
    },
    hasTheme(themeId) {
      return themeMap.has(themeId);
    }
  };

  window.TabBeaconThemeRegistry = Object.freeze(registry);
})();
