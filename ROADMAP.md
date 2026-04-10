# ROADMAP

This is the single source of truth for planning and AI handoff.
If a future AI needs project context, it should read this file first.

## Current working branch

- `chore/runtime-doc-sync-pass2`

## What Tab Beacon is trying to become

Tab Beacon should become a practical Chrome/Edge extension that tells the user, at a glance, whether an AI tab or another long-running web app tab still needs attention.

The product direction is:
- combine DOM signals and network signals
- reflect busy state on the tab favicon
- make diagnostics good enough that rule behavior can be explained, not guessed
- keep the settings model understandable and avoid stale legacy state

## Non-goals right now

These are not current priorities and should not pull the next AI off course.
- Adding many new end-user features unrelated to busy detection quality
- Making indicator style rule-specific
- Tightening permissions before real-site verification is complete
- Large cosmetic refactors that do not reduce ambiguity or technical debt

## Architecture snapshot

Main runtime pieces at the moment:
- `background.js`
  - owns network request tracking
  - owns attribution logic from requests to tabs
  - owns diagnostics history for network events
- `content-indicator-renderer.js`
  - evaluates DOM-side busy conditions
  - receives network snapshots from background
  - controls favicon rendering on the page side
- `shared/tab-beacon-selector-utils.js`
  - shared selector/wildcard helpers used across runtimes
- `options/options-app.js` plus boot-time bridge scripts
  - settings editor and diagnostics UI
  - bridge scripts now sanitize legacy `iconMode` both before and after options runtime bootstrap

## Important product decisions already made

These are decisions the next AI should preserve unless the user explicitly changes direction.

- Indicator style is global-only, not rule-specific.
- Busy detection can combine DOM and network conditions inside the same rule.
- Same-origin ambiguous request attribution should not guess recklessly; it may recover attribution only when rule filtering narrows it to one tab.
- `ROADMAP.md` is the canonical planning and handoff document.
- `EPICS.md` should not duplicate the plan anymore.

## Why each Epic exists

### Epic 1: content runtime consolidation
Purpose:
- reduce confusion in the page-side runtime
- remove legacy paths so content behavior is easier to reason about
- make later verification and cleanup less risky

### Epic 2: shared rule / selector core extraction
Purpose:
- stop repeating selector and wildcard logic across background, content, and options
- reduce drift where the editor and runtime interpret the same rule differently
- make future maintenance less fragile

### Epic 3: network attribution and stability improvements
Purpose:
- make network-based busy detection trustworthy
- explain why requests were or were not counted
- reduce flicker and hidden attribution errors on real AI sites

### Epic 4: indicator settings cleanup
Purpose:
- remove stale legacy indicator state such as `iconMode`
- keep the settings model aligned with the product decision that indicator style is global-only
- reduce confusing storage and migration paths

### Epic 5: docs / handoff synchronization
Purpose:
- keep future AI work aligned with the actual architecture and priorities
- prevent drift caused by outdated docs

### Epic 6: permissions / security cleanup
Purpose:
- reduce scope and risk once runtime behavior is proven on real sites
- tighten permissions without breaking the current UX

### Epic 7: real-site verification
Purpose:
- validate the behavior on actual targets such as ChatGPT
- decide whether Epics 3 and 4 are truly done in practice, not just in code

## Epic status

- [ ] Epic 1: content runtime consolidation
- [ ] Epic 2: shared rule / selector core extraction
- [ ] Epic 3: network attribution and stability improvements
- [ ] Epic 4: indicator settings cleanup
- [x] Epic 5: docs / handoff synchronization
- [ ] Epic 6: permissions / security cleanup
- [ ] Epic 7: real-site verification

## Recent completed work

- [x] Align existing-tab reinjection with the manifest content script target
- [x] Remove unused legacy `content.js`
- [x] Add shared selector utility groundwork
- [x] Reuse shared wildcard matcher in `background.js`
- [x] Bridge shared selector utils into the options runtime
- [x] Refresh selector bridge for dynamically added options inputs
- [x] Reuse shared selector helpers in content runtime
- [x] Preserve network diagnostics across rule autosave
- [x] Avoid ambiguous same-origin tab attribution
- [x] Add network idle cooldown handling
- [x] Show network cooldown count in diagnostics
- [x] Add cooldown diagnostics label strings to i18n
- [x] Add request attribution diagnostics details
- [x] Refine same-origin request attribution with rule filtering
- [x] Stop persisting stale `iconMode` in the options/editor path
- [x] Strip historical `iconMode` from content-side rule reads before bootstrap
- [x] Persist stripped historical `iconMode` from the content cleanup bridge on load
- [x] Patch options cleanup helpers so migrated/default/editor rules stay `iconMode`-free end-to-end
- [x] Add a real-site verification checklist for the human browser pass
- [x] Remove the remaining `iconMode` source leftover from content runtime rule normalization
- [x] Add an options preload cleanup shim so storage reads and writes are sanitized before `options-app.js` initializes

## Epic details

### Epic 1: content runtime consolidation

#### Done
- [x] Remove the unused legacy `content.js`
- [x] Align reinjection script order with the manifest
- [x] Make `content-indicator-renderer.js` reuse shared selector helpers where safe

#### Remaining
- [ ] Recheck sandbox behavior after content-side consolidation
- [ ] Decide whether any remaining content-only helpers should stay local

### Epic 2: shared rule / selector core extraction

#### Done
- [x] Add `shared/tab-beacon-selector-utils.js`
- [x] Load shared selector utils in manifest content scripts
- [x] Load shared selector utils in options boot
- [x] Load shared selector utils before reinjection scripts
- [x] Reuse shared `wildcardMatch` in `background.js`
- [x] Bridge shared selector resolution into options runtime
- [x] Reapply selector bridge to dynamically added options inputs
- [x] Make content runtime consume shared `resolveSelectorType`
- [x] Reuse shared `wildcardMatch` in content runtime

#### Remaining
- [ ] Replace more local selector helpers with shared helpers where safe
- [ ] Decide whether rule normalization should move into a separate shared module
- [ ] Decide whether Epic 2 is complete after the remaining duplication review

### Epic 3: network attribution and stability improvements

#### Done
- [x] Preserve diagnostics and network state across autosave / storage changes
- [x] Stop assigning service-worker-origin requests when multiple same-origin tabs are open
- [x] Add network idle cooldown handling
- [x] Expose cooldown count through diagnostics data
- [x] Show cooldown count in diagnostics UI
- [x] Add cooldown diagnostics label strings to i18n
- [x] Add clearer diagnostics about why a request was or was not attributed to a tab
- [x] Show attribution source / note / initiator details in diagnostics UI
- [x] Refine same-origin attribution by rule-filtering ambiguous candidates

#### Remaining
- [ ] Verify cooldown behavior on real AI sites and tune the duration if needed
- [ ] Decide whether this Epic is complete after real-site verification

### Epic 4: indicator settings cleanup

#### Done
- [x] Decide that indicator style is global-only, not rule-specific
- [x] Stop persisting stale `iconMode` in the options/editor path
- [x] Strip historical `iconMode` from content-side rule reads before bootstrap
- [x] Simplify related storage / migration cleanup via the dedicated `iconMode` cleanup bridges
- [x] Remove the remaining `iconMode` source leftover from content runtime rule normalization
- [x] Sanitize options-side storage reads and writes before `options-app.js` boot using a dedicated preload cleanup shim

#### Remaining
- [ ] Remove the textual `iconMode` leftovers still present in `options/options-app.js` when the connector allows a safe large-file rewrite
- [ ] Decide whether Epic 4 is complete after one more verification pass

### Epic 5: docs / handoff synchronization

#### Done
- [x] Update README to reflect current runtime entry points
- [x] Document current architecture and responsibility boundaries
- [x] Synchronize roadmap with implemented features and current priorities
- [x] Rewrite planning into a clean UTF-8 progress view
- [x] Make this file the canonical handoff document

#### Remaining
- [ ] Keep this file current as work continues

### Epic 6: permissions / security cleanup

#### Done
- [ ] None yet

#### Remaining
- [ ] Review current `"<all_urls>"` usage in content scripts and host permissions
- [ ] Decide whether optional permissions are practical for the current UX
- [ ] Tighten permissions without breaking presets and user-defined rules

### Epic 7: real-site verification

#### Done
- [x] Add `docs/real-site-verification-checklist.md` for the human browser pass

#### Remaining
- [ ] Verify ChatGPT behavior with current DOM and network rules
- [ ] Verify same-origin multi-tab behavior on real sites
- [ ] Verify cooldown behavior and diagnostics usefulness on real sites
- [ ] Measure whether any remaining content-side duplication causes practical issues

## Human tasks backlog

These are the tasks that are best done later by a human with the unpacked extension loaded in a real browser.

- [ ] Check sandbox behavior after the recent content-side consolidation
- [ ] Verify ChatGPT behavior on real conversation pages with the current DOM and network rules
- [ ] Verify same-origin multi-tab behavior on real sites and confirm the new rule-filtered attribution looks correct
- [ ] Verify cooldown behavior in diagnostics and tune whether `1200ms` still feels right
- [ ] Decide whether Epic 3 can be marked complete after the real-site pass
- [ ] Verify that upgraded profiles with legacy stored rules no longer retain `iconMode` after ordinary browsing and opening the options page
- [ ] Run through `docs/real-site-verification-checklist.md` and report findings in the provided format

## What the next AI should do first

1. Read this file fully before changing direction.
2. Support the human real-site pass using `docs/real-site-verification-checklist.md`.
3. Treat the remaining `options/options-app.js` `iconMode` text as low-risk textual debt unless the connector safely allows the large-file rewrite.
4. Do not start Epic 6 permission tightening before Epic 7 has validated the current runtime.

## Drift prevention notes

The next AI should avoid these mistakes.
- Do not recreate a second planning file that duplicates this one.
- Do not reintroduce rule-specific indicator style unless the user explicitly asks for that direction.
- Do not treat unresolved real-site verification as already complete.
- Do not chase unrelated UI polish while Epics 3, 4, and 7 still affect correctness.
