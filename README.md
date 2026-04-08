# README

## Overview

Tab Beacon is an experimental Manifest V3 extension for Chrome and Edge that watches state changes on web pages and overlays a busy indicator on the tab favicon. Its first main use case is making it easier to see whether AI chats such as ChatGPT are still thinking, even while you are working in other tabs.

The current manifest version is `0.3.2`.

## Current capabilities

- DOM conditions and network conditions can be mixed within a single rule
- `selectorType` supports `auto / css / xpath`
- With `auto`, CSS and XPath are detected automatically
- Conditions inside a rule can be combined with `ANY / ALL`
- If multiple rules match the same URL, they are evaluated with OR semantics
- Smart busy detection
  - `aria-busy="true"`
  - UI text such as Stop / Cancel / Interrupt / 停止 / 中断
- Animated busy overlay on the favicon
- Static badge indicator style
- Fallback icon restore even on pages that do not provide an original favicon
- Rule editing from the options page
- Collapsible condition cards
- Collapsible rule cards, collapsed by default
- Distinction between `user` and `system preset`
- Debug preset for the local sandbox
- Import / export from the options page
- Network diagnostics UI in the options page
- Base locale files for `_locales/en` and `_locales/ja`
- Version display in the options page footer
- Collapsible Debug section
- Since display in the options page footer
- Review target display in the options page footer when git hooks are installed

## Behavior already confirmed by the user

These behaviors were confirmed directly during the conversation.

- Adding an `aria-busy` element starts the busy overlay
- Removing an `aria-busy` element stops the busy overlay
- Busy and idle favicon updates work correctly in the sandbox
- The visual differentiation in the Rules section behaves as intended
- The current content runtime is unified around `content-indicator-renderer.js`

## Main files

- `manifest.json`: Manifest V3 definition
- `background.js`: per-tab and per-rule network monitoring, diagnostics, and broadcasting network state to content
- `content-indicator-renderer.js`: DOM monitoring, smart busy detection, and favicon indicator rendering
- `shared/tab-beacon-selector-utils.js`: shared selector helpers for wildcard matching and auto CCS / XPath resolution
- `options/`: options UI shell, behaviors, themes, import / export, and diagnostics
- `i18n.js`: i18n helper for the options UI
- `_locales/en/messages.json` / `_locales/ja/messages.json`: locale strings
- `manual-tests/tabbeacon-sandbox.html`: local manual test page
- `ROADMAP.md`: implementation progress and remaining tasks

## Current architecture

Tab Beacon currently splits its responsibilities into three main runtime layers and one small shared utility layer.

- `background.js` is the network runtime. It tracks in-flight requests, maintains diagnostics, and pushes pnet-match snapshots back to tabs.
- `content-indicator-renderer.js` is the DOM and favicon runtime. It evaluates DOM-side conditions, applies smart busy detection, and renders the tab icon state.
- `options/` is the editor and diagnostics surface. It owns schema-edge migration, rule editing, import / export, and diagnostics UI.

- `shared/tab-beacon-selector-utils.js` is the first shared runtime utility. It holds low-risk pure helpers that multiple runtimes can reuse.

## Responsibility boundaries

- `background.js` does not touch page DOM or favicon rendering.
- `content-indicator-renderer.js` does not own the network counters or diagnostics history. It consumes snapshots from `background.js`.
- `options/` should remain the only place where schema-edge migrations and editor-specific normalization live.
- `chared/` should only contain small, pure, read-only helpers with low environment coupling.

## Try it locally

### Load the extension
1. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge
2. Turn on Developer mode
3. Choose **Load unpacked**
4. Load the root of this repository
5. Open the options page

### Enable automatic review target tracking

To show the current local branch and HEAD SHA in the options footer during review:

1. Run `git config core.hooksPath githooks` once in your local clone
2. Run `githooks/update-review-build-info.sh` once to generate the initial file
3. After that, every `git checkout` / `git switch` / `git pull` will refresh `generated/review-build-info.local.js`
4. Reload the unpacked extension from `chrome://extensions`

`generated/review-build-info.local.js` is intentionally ignored by Git, so the review target can change locally without causing merge conflicts between PRs.

### Test the sandbox

1. In the extension details page, enable **Allow access to file URLs**
2. Open **Debug** in the options page
3. Turn **Debug mode** on
4. Open `manual-tests/tabbeacon-sandbox.html` with `file://`
5. Try adding and removing `aria-busy` elements, or run the 5-second busy scenario

## Current trade-offs

- `content_scripts` and `host_permissions` still use `"<all_urls>"`
- Smart busy detection is still heuristic-based and has not yet been optimized strictly per site
- Network monitoring is still a minimal foundation, with cooldowns and exclusion strategies not yet implemented
- i18n for user-facing strings in `content` and `background` is still incomplete
- No license has been chosen yet

## Handoff notes for the next AI
- Start by checking `ROADMAP.md` to see what is complete and what is not
- Issues may be older than the current implementation on `main`, so compare them against the current code and recent commits before starting work
- The current active runtime is `content-indicator-renderer.js` + `background.js`. The legacy `content.js` has been removed.
- The most reasonable next order of work is content/options shared util consolidation, real-world ChatGPT measurement, then permission tightening

## Analyzing dynamic elements on web pages

Use `playwright-observer`, pass the logs to an AI agent, identify the relevant DOM elements and network patterns, and convert them into Tab Beacon rules.

### Install playwright-observer

In your local `tab-beacon` repository directory:

```bash
npm install github:gsr-4325/playwright-observer
```

See the [playwright-observer repository](https://github.com/gsr-4325/playwright-observer) for usage details.

## License

Not set
