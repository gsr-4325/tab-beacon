# Real-site verification checklist

This checklist is for a human running the unpacked extension in a real browser.
Use it to validate Epics 3, 4, and 7 in a repeatable order.

## Before starting

- Load the unpacked extension from the current working branch.
- Open the options page.
- Turn **Debug mode** on.
- Keep **Network diagnostics** available so you can refresh the tab list and diagnostics after each check.
- If you have an older profile that used previous builds, prefer testing once with that profile too.

## 1. Sandbox sanity check

Goal:
- confirm the recent content-side cleanup did not break the packaged sandbox

Steps:
1. Open the packaged sandbox from the options page.
2. Trigger the short busy scenario.
3. Confirm the favicon changes to the configured busy indicator.
4. Confirm it returns to normal after busy ends and grace period finishes.
5. Refresh diagnostics and confirm matching requests or DOM signals appear when expected.

Record:
- whether favicon animation or badge rendering appears
- whether busy end timing feels correct
- whether diagnostics stay populated after autosave or options edits

## 2. ChatGPT conversation page verification

Goal:
- validate that the default ChatGPT rule still matches current real pages

Suggested URLs:
- `https://chatgpt.com/c/*`
- `https://chatgpt.com/g/*/c/*`
- `https://chatgpt.com/g/*/project*`

Steps:
1. Open a real ChatGPT conversation page.
2. Send a prompt that causes a visible response stream.
3. Confirm the tab enters busy quickly.
4. Confirm the tab leaves busy after the response fully stops and the grace period expires.
5. Open extension options and refresh diagnostics for that tab.
6. Confirm the matched DOM or network conditions look reasonable.

Record:
- whether busy started too late
- whether busy ended too early or too late
- whether diagnostics clearly explain which condition matched
- whether project pages behave differently from conversation pages

## 3. Same-origin multi-tab attribution check

Goal:
- verify ambiguous same-origin requests are not attributed recklessly

Steps:
1. Open two or more ChatGPT tabs at the same time.
2. Make only one tab generate a response.
3. Watch whether the inactive tab incorrectly becomes busy.
4. Refresh diagnostics for both tabs.
5. Repeat with different rules or different page types if needed.

Record:
- whether the correct tab alone became busy
- whether the wrong tab stayed idle
- whether diagnostics attribution source and notes look believable

## 4. Cooldown behavior check

Goal:
- decide whether the current cooldown still feels right on real sites

Current value to judge:
- `1200ms`

Steps:
1. Trigger a short response.
2. Watch whether the tab flickers between busy and idle.
3. Trigger a longer response.
4. Confirm the tab does not remain busy for obviously too long after completion.
5. Refresh diagnostics and inspect active request count and cooldown-related details.

Record:
- whether `1200ms` feels too short, about right, or too long
- whether any flicker is still noticeable

## 5. Legacy `iconMode` cleanup check

Goal:
- verify old stored rules do not keep stale rule-specific indicator state after normal use

Steps:
1. Start from a browser profile that has older stored Tab Beacon rules if available.
2. Open a matched site once so content-side cleanup can run.
3. Open the options page once so options-side cleanup can run.
4. Export settings.
5. Inspect the exported JSON.

Record:
- whether any rule object still contains `iconMode`
- whether ordinary browsing plus opening options is enough to remove it
- whether reset/import/export reintroduces any rule-level indicator field

## 6. Report back format

Please report findings in this shape so the next AI can act quickly.

- Branch tested:
- Browser and version:
- Pages tested:
- Busy indicator mode used:
- Sandbox result:
- ChatGPT result:
- Multi-tab attribution result:
- Cooldown judgement for `1200ms`:
- Any exported settings still containing `iconMode`:
- Screenshots or console errors:
- Recommended next change:
