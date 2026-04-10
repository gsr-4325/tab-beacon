# Real-site verification report template

Copy this template after running `docs/real-site-verification-checklist.md`.
Keep each section short and concrete so the next AI can turn it into code or roadmap updates quickly.

## Run metadata

- Branch tested:
- Browser and version:
- Extension load mode:
- Profile type:
  - clean profile / upgraded profile / unknown
- Indicator settings used:
  - indicatorStyle:
  - renderMethod:
  - badgeStyle:
  - badgeColor:

## 1. Sandbox sanity check

- Result:
  - pass / partial / fail
- What happened:
- Diagnostics notes:
- Screenshots or console errors:

## 2. ChatGPT conversation page verification

- URLs tested:
- Result:
  - pass / partial / fail
- Busy start timing:
  - too early / about right / too late
- Busy end timing:
  - too early / about right / too late
- Diagnostics clarity:
  - clear / mixed / unclear
- Notes:
- Screenshots or console errors:

## 3. Same-origin multi-tab attribution

- Tabs opened:
- Result:
  - pass / partial / fail
- Correct tab became busy:
- Wrong tab stayed idle:
- Diagnostics attribution looked believable:
- Notes:
- Screenshots or console errors:

## 4. Cooldown behavior

- Current value judged:
  - `1200ms`
- Result:
  - too short / about right / too long
- Flicker observed:
  - none / slight / obvious
- Notes:

## 5. Legacy `iconMode` cleanup

- Old profile available:
  - yes / no
- Any exported rule still contained `iconMode`:
  - yes / no
- Ordinary browsing plus opening options removed it:
  - yes / no / not tested
- Reset, import, or export reintroduced it:
  - yes / no / not tested
- Notes:

## 6. Overall judgement

- Epic 3 status suggestion:
  - keep open / ready to close
- Epic 4 status suggestion:
  - keep open / ready to close
- Most important next code change:
- Most important next human verification:
- Anything surprising:
