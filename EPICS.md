# EPICS

This file is a quick-view checklist for the current Tab Beacon refactor plan.
It mirrors the current roadmap, but groups work strictly by Epic so it is easier to review progress at a glance.

## Epic 1: content runtime consolidation

### Status
- [ ] Not complete

### Completed
- [x] Remove the unused legacy `content.js`
- [x] Align reinjection script order with the manifest
- [x] Make `content-indicator-renderer.js` reuse shared selector helpers where safe

### Remaining
- [ ] Recheck sandbox behavior after content-side consolidation
- [ ] Decide whether any remaining content-only helpers should stay local

## Epic 2: shared rule / selector core extraction

### Status
- [ ] Not complete

### Completed
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

### Status
- [ ] Not complete

### Completed
- [x] Preserve diagnostics and network state across autosave / storage changes
- [x] Stop assigning service-worker-origin requests when multiple same-origin tabs are open
- [x] Add network idle cooldown handling
- [x] Expose cooldown count through diagnostics data
- [x] Show cooldown count in diagnostics UI
- [x] Localize cooldown diagnostics label strings
- [x] Add clearer diagnostics about why a request was or was not attributed to a tab
- [x] Show attribution source / note / initiator details in diagnostics UI
- [x] Refine same-origin attribution by rule-filtering ambiguous candidates

### Remaining
- [ ] Verify cooldown behavior on real AI sites and tune the duration if needed
- [ ] Decide whether this Epic is complete after real-site verification

## Epic 4: indicator settings cleanup

### Status
- [ ] Not complete

### Completed
- [x] Decide that indicator style is global-only, not rule-specific
- [x] Stop persisting stale `iconMode` in the options/editor save path
- [x] Strip historical `iconMode` from content-side rule reads before bootstrap

### Remaining
- [ ] Remove any remaining large-file source leftovers for `iconMode` when a full-file cleanup pass is practical
- [ ] Simplify related storage / migration code further now that the direction is fixed
- [ ] Decide whether Epic 4 is complete after one more cleanup pass

## Epic 5: docs / handoff synchronization

### Status
- [x] Complete

### Completed
- [x] Update README to reflect current runtime entry points
- [x] Document current architecture and responsibility boundaries
- [x] Synchronize ROADMAP with implemented features and current priorities
- [x] Rewrite ROADMAP into a clean UTF-8 progress view
- [x] Add a per-Epic checklist overview

### Remaining
- [ ] Keep the checklist current as other Epics move forward

## Epic 6: permissions / security cleanup

### Status
- [ ] Not complete

### Completed
- [ ] None yet

### Remaining
- [ ] Review current `"<all_urls>"` usage in content scripts and host permissions
- [ ] Decide whether optional permissions are practical for the current UX
- [ ] Tighten permissions without breaking presets and user-defined rules

## Epic 7: real-site verification

### Status
- [ ] Not complete

### Completed
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
