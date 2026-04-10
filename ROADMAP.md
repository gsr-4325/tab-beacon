# ROADMAP

## Goal

Make Tab Beacon a practical Chrome/Edge extension that can show whether AI web apps and other busy pages still need attention, by combining DOM and network signals and reflecting that state on the tab favicon.

## Epic status

- [ ] Epic 1: content runtime consolidation
- [ ] Epic 2: shared rule / selector core extraction
- [ ] Epic 3: network attribution and stability improvements
- [x] Epic 5: docs / handoff synchronization
- [ ] Epic 4: indicator settings cleanup
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
- [x] Finalize architecture and handoff notes in docs
- [x] Add a per-Epic checklist overview

## Epic 1: content runtime consolidation

### Done
- [x] Remove the unused legacy `content.js`
- [x] Align reinjection script order with the manifest
- [x] Make `content-indicator-renderer.js` reuse shared selector helpers where safe

### Remaining
- [ ] Recheck sandbox behavior after content-side consolidation
- [ ] Decide whether any remaining content-only helpers should stay local

## Epic 2: shared rule / selector core extraction

### Done
- [x] Add `shared/tab-beacon-selector-utils.js`
- [x] Load shared selector utils in manifest content scripts
- [x] Load shared selector utils in options boot
- [x] Load shared selector utils before reinjection scripts
- [x] Reuse shared `wildcardMatch` in `background.js`
- [x] Bridge shared selector resolution into options runtime
- [x] Reapply selector bridge to dynamically added options inputs
- [x] Make content runtime consume shared `resolveSelectorType`
- [x] Reuse shared `wildcardMatch` in content runtime

### Remaining
- [ ] Replace more local selector helpers with shared helpers where safe
- [ ] Decide whether rule normalization should move into a separate shared module
- [ ] Decide whether Epic 2 is complete after the remaining duplication review

## Epic 3: network attribution and stability improvements

### Done
- [x] Preserve diagnostics and network state across autosave / storage changes
- [x] Stop assigning service-worker-origin requests when multiple same-origin tabs are open
- [x] Add network idle cooldown handling
- [x] Expose cooldown count through diagnostics data
- [x] Show cooldown count in diagnostics UI
- [x] Add cooldown diagnostics label strings to i18n
- [x] Add clearer diagnostics about why a request was or was not attributed to a tab
- [x] Show attribution source / note / initiator details in diagnostics UI
- [x] Refine same-origin attribution by rule-filtering ambiguous candidates

### Remaining
- [ ] Verify cooldown behavior on real AI sites and tune the duration if needed
- [ ] Decide whether this Epic is complete after real-site verification

## Epic 4: indicator settings cleanup

### Done
- [x] Decide that indicator style is global-only, not rule-specific
- [x] Stop persisting stale `iconMode` in the options/editor path
- [x] Strip historical `iconMode` from content-side rule reads before bootstrap

### Remaining
- [ ] Remove any remaining large-file source leftovers for `iconMode` when a full-file cleanup pass is practical
- [ ] Simplify related storage / migration code further now that the direction is fixed
- [ ] Decide whether Epic 4 is complete after one more cleanup pass

## Epic 5: docs / handoff synchronization

### Done
- [x] Update README to reflect current runtime entry points
- [x] Document current architecture and responsibility boundaries
- [x] Synchronize ROADMAP with implemented features and current priorities
- [x] Rewrite ROADMAP into a clean UTF-8 progress view
- [x] Add a per-Epic checklist overview

### Remaining
- [ ] Keep the roadmap current as Epics 1 to 4 and 6 to 7 move forward

## Epic 6: permissions / security cleanup

### Done
- [ ] None yet

### Remaining
- [ ] Review current `"<all_urls>"` usage in content scripts and host permissions
- [ ] Decide whether optional permissions are practical for the current UX
- [ ] Tighten permissions without breaking presets and user-defined rules

## Epic 7: real-site verification

### Done
- [ ] None yet

### Remaining
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

## Next recommended order

1. Keep pushing Epic 4 by removing the last confusing `iconMode` leftovers and simplifying cleanup paths.
2. Do Epic 7 verification on real sites so Epic 3 can be judged complete or tuned further.
3. Attempt Epic 6 permission tightening only after the real-site verification pass.
4. Return to Epic 2 only if the remaining helper duplication still causes maintenance pain.
