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
- [x] Preserve network diagnostics across rule autosave
- [x] Avoid ambiguous same-origin tab attribution
- [x] Add network idle cooldown handling
- [x] Show network cooldown count in diagnostics
- [x] Localize the cooldown diagnostics fallback label
- [x] Finalize architecture and handoff notes in docs

## Epic 1: content runtime consolidation

### Done
- [x] Remove the unused legacy `content.js`
- [x] Align reinjection script order with the manifest

### Remaining
- [ ] Make `content-indicator-renderer.js` use shared selector helpers directly
- [ ] Reduce remaining duplicated selector / matching helpers in content runtime
- [ ] Recheck sandbox behavior after content-side consolidation

## Epic 2: shared rule / selector core extraction

### Done
- [x] Add `shared/tab-beacon-selector-utils.js`
- [x] Load shared selector utils in manifest content scripts
- [x] Load shared selector utils in options boot
- [x] Load shared selector utils before reinjection scripts
- [x] Reuse shared `wildcardMatch` in `background.js`
- [x] Bridge shared selector resolution into options runtime
- [x] Reapply selector bridge to dynamically added options inputs

### Remaining
- [ ] Make content runtime consume shared `resolveSelectorType`
- [ ] Replace more local selector helpers with shared helpers where safe
- [ ] Decide whether rule normalization should move into a separate shared module

## Epic 3: network attribution and stability improvements

### Done
- [x] Preserve diagnostics and network state across autosave / storage changes
- [x] Stop assigning service-worker-origin requests when multiple same-origin tabs are open
- [x] Add network idle cooldown handling
- [x] Expose cooldown count through diagnostics data
- [x] Show cooldown count in diagnostics UI

### Remaining
- [ ] Add clearer diagnostics about why a request was or was not attributed to a tab
- [ ] Revisit same-origin attribution with a more precise strategy than current conservative skip
- [ ] Verify cooldown behavior on real AI sites and tune the duration if needed
- [ ] Decide whether this Epic is complete after real-site verification

## Epic 4: indicator settings cleanup

### Done
- [ ] None yet

### Remaining
- [ ] Decide whether indicator style is global-only or can be rule-specific
- [ ] Remove or revive stale `iconMode` style state consistently across runtime and options
- [ ] Simplify related UI and storage shape after the direction is fixed

## Epic 5: docs / handoff synchronization

### Done
- [x] Update README to reflect current runtime entry points
- [x] Document current architecture and responsibility boundaries
- [x] Synchronize ROADMAP with implemented features and current priorities

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

## Next recommended order

1. Finish more of Epic 2 by making content runtime consume shared selector helpers.
2. Continue Epic 3 by improving request attribution diagnostics and tuning cooldown.
3. Revisit Epic 4 once runtime consolidation reduces ambiguity in the current settings model.
4. Do Epic 7 verification before attempting Epic 6 permission tightening.
