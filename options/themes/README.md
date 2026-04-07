# Options Themes

This directory keeps the options-page theme registry and each theme implementation in its own folder.

## Current structure

- `registry.js`: the single source of truth for theme IDs, labels, and legacy aliases.
- `default/`: the active built-in theme.
- `default/theme.css`: the theme stylesheet loaded by `options/boot.js`.
- `default/theme.js`: the theme-specific behavior hook loaded by `options/boot.js`.

## How to add a new theme

1. Create a new directory under `options/themes/<theme-id>/`.
2. Add `theme.css` for the theme styles.
3. Add `theme.js` for theme-specific DOM enhancements and behavior.
4. Register the new theme in `options/themes/registry.js` by adding a new entry to `themes`.
5. If the new theme replaces or absorbs an old theme name, add a mapping in `aliases` so stored settings can migrate cleanly.
6. Use the new theme ID in selectors such as `html[data-theme="<theme-id>"]` inside the theme stylesheet.
7. Read shared helpers from `window.TabBeaconThemeBootstrap` inside `theme.js` instead of hardcoding the theme list again.
8. Keep the theme selector optional. It appears only when more than one registered theme exists.
9. Open the options page with `?theme=<theme-id>` once to verify loading and stored-theme persistence.

## Design notes

- `options/boot.js` resolves the current theme from the registry, query string, local storage, and legacy aliases.
- Themes should treat the registry as shared infrastructure and avoid duplicating the available-theme list locally.
- Theme-specific storage keys should support legacy migration when renaming an existing theme namespace.
