# Manual Tests

This directory contains utility pages for manual testing of TabBeacon. These are kept in `manual-tests/` separately from the main application code due to their distinct purpose.

## Prerequisites

If you are opening these pages via `file://`, you must enable **Allow access to file URLs** in the extension settings for Edge or Chrome.

For Edge:

1. Open `edge://extensions/`
2. Go to the `Details` of TabBeacon
3. Toggle `Allow access to file URLs` to ON
4. Reload the extension

## Available Pages

- `tabbeacon-sandbox.html`
  - Manual testing for DOM conditions
  - Manual testing for network conditions
  - Verification of icon state changes

## Recommended First Rule

### URL Pattern

```text
file:///*manual-tests/*
```

### Condition 1

- source: `dom`
- selectorType: `css`
- query: `[aria-busy="true"]`

### Condition 2

- source: `network`
- matchType: `urlContains`
- value: `postman-echo.com`
- method: `GET`
- resourceKind: `fetch/xhr`

### Join Mode

- `ANY`

## Notes

- Network tests from `file://` pages may be affected by browser security policies or CORS.
- DOM tests are still verifiable even in those cases.
- If network tests are unstable, you can consider using a simple local server (e.g., `http://localhost`).
