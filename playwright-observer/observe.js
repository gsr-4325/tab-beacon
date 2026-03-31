#!/usr/bin/env node

'use strict';

const fs   = require('fs');
const path = require('path');
const pw   = require('playwright');

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const c = {
  reset:   '\x1b[0m',
  gray:    '\x1b[90m',
  cyan:    '\x1b[36m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  bold:    '\x1b[1m',
  magenta: '\x1b[35m',
};
const ts = () => `${c.gray}[${new Date().toISOString()}]${c.reset}`;

// ─── CLI args ─────────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  let urlPattern = null;
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--url-pattern' || args[i] === '-p') && args[i + 1]) {
      urlPattern = args[++i];
    }
  }
  return { urlPattern: urlPattern || process.env.TARGET_URL || null };
}

function matchesUrlPattern(url, pattern) {
  if (pattern.includes('*')) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(escaped).test(url);
  }
  return url.includes(pattern);
}

// ─── Noise filter ──────────────────────────────────────────────────────────────
const SILENT_TYPES = new Set([
  'image','stylesheet','font','media','object','script',
  'main_frame','sub_frame','ping','other',
]);
const NOISE_RE = [
  /google-analytics\.com/, /googletagmanager\.com/, /sentry\.io/,
  /datadog/, /amplitude\.com/, /segment\.io/, /mixpanel\.com/,
  /bugsnag\.com/, /intercom\.io/, /featureflag/,
  /\/ping$/, /\/heartbeat/, /\/metrics/, /\/telemetry/,
];
const isNoise = (url, type) =>
  SILENT_TYPES.has(type) || NOISE_RE.some(r => r.test(url));

// ─── DOM poll function (runs inside browser via page.evaluate) ─────────────────
// Returns a serializable snapshot of "interesting" DOM state.
const DOM_POLL_FN = () => {
  function isStopLike(el) {
    const combined = [
      el.textContent,
      el.getAttribute('aria-label'),
      el.getAttribute('title'),
      el.getAttribute('data-testid'),
    ].join(' ').toLowerCase();
    return ['stop','cancel','interrupt','停止','中断','生成を停止']
      .some(k => combined.includes(k));
  }

  function summarise(el) {
    const attrs = {};
    for (const a of el.attributes) attrs[a.name] = a.value;
    return {
      tagName:     el.tagName,
      id:          el.id   || undefined,
      className:   el.className || undefined,
      attrs,
      textSnippet: el.textContent?.trim().slice(0, 120) || undefined,
    };
  }

  const busyEls = [...document.querySelectorAll('[aria-busy="true"]')].map(summarise);

  const stopBtns = [...document.querySelectorAll('button,[role="button"]')]
    .filter(isStopLike)
    .map(el => ({
      ...summarise(el),
      disabled: el.disabled,
      visible:  el.offsetParent !== null,
    }));

  const ariaLiveEls = [...document.querySelectorAll('[aria-live]')].map(el => ({
    tagName:   el.tagName,
    ariaLive:  el.getAttribute('aria-live'),
    id:        el.id,
    className: el.className,
  }));

  return { busyEls, stopBtns, ariaLiveEls, url: location.href };
};

// ─── Automation-masking init script (injected before page loads) ───────────────
const STEALTH_SCRIPT = `
Object.defineProperty(navigator, 'webdriver',  { get: () => false });
Object.defineProperty(navigator, 'plugins',    { get: () => [1,2,3] });
Object.defineProperty(navigator, 'languages',  { get: () => ['en-US','en'] });
`;

// ─── Main observer ─────────────────────────────────────────────────────────────
class ChatGPTObserver {
  constructor({ edgeProfilePath, outputDir }) {
    this.edgeProfilePath = edgeProfilePath;
    this.outputDir       = outputDir;

    this.domEvents        = [];  // change records
    this.networkRequests  = {};  // keyed by requestId
    this.timeline         = [];

    this._page       = null;
    this._context    = null;
    this._cdp        = null;
    this._pollTimer  = null;
    this._prevState  = null;   // last poll result for diffing
  }

  _now() { return new Date().toISOString(); }
  _rec(entry) { this.timeline.push({ ...entry, timestamp: this._now() }); }

  // ── Connect to running Edge via CDP ───────────────────────────────────────
  async init() {
    fs.mkdirSync(this.outputDir, { recursive: true });

    const cdpUrl = process.env.CDP_URL || 'http://localhost:9222';
    const { urlPattern } = parseArgs();
    console.log(`${ts()} ${c.cyan}Connecting to Edge via CDP:${c.reset} ${cdpUrl}`);
    if (urlPattern) {
      console.log(`${ts()} ${c.cyan}URL pattern:${c.reset} "${urlPattern}"`);
    }

    this._browser = await pw.chromium.connectOverCDP(cdpUrl);
    this._context = this._browser.contexts()[0];

    if (!this._context) {
      throw new Error('No browser context found. Make sure Edge is open with --remote-debugging-port=9222');
    }

    // Track pages
    const attachPage = async (page) => {
      this._page = page;
      await this._attachCDP(page);
      page.on('load', async () => {
        console.log(`${ts()} ${c.cyan}[load]${c.reset} ${page.url()}`);
        await this._attachCDP(page);
        this._prevState = null;
      });
    };

    this._context.on('page', attachPage);

    // Attach to active pages
    const pages = this._context.pages();
    console.log(`${ts()} ${c.cyan}Open pages:${c.reset} ${pages.length}`);
    for (const page of pages) {
      console.log(`  ${page.url()}`);
    }

    // Attach to target page: --url-pattern > TARGET_URL env var, or first real https:// page
    const isRealPage = (url) =>
      url.startsWith('https://') &&
      !url.startsWith('chrome-extension://') &&
      !url.startsWith('devtools://');
    const target = urlPattern
      ? pages.find(p => matchesUrlPattern(p.url(), urlPattern)) || pages.find(p => isRealPage(p.url()))
      : pages.find(p => isRealPage(p.url()));
    if (target) {
      console.log(`${ts()} ${c.cyan}Attaching to:${c.reset} ${target.url()}`);
      await attachPage(target);
    }

    // Start DOM polling every 300 ms
    this._startPolling();
    this._rec({ event: 'observer.init' });
  }

  // ── CDP network monitoring ─────────────────────────────────────────────────
  async _attachCDP(page) {
    if (this._cdp) {
      try { await this._cdp.detach(); } catch (_) {}
    }
    this._cdp = await this._context.newCDPSession(page);
    await this._cdp.send('Network.enable');

    this._cdp.on('Network.requestWillBeSent', ({ requestId, request, type }) => {
      const rt  = (type || 'unknown').toLowerCase();
      const req = { requestId, method: request.method, url: request.url,
                    resourceType: rt, startTime: this._now(), status: 'pending' };
      this.networkRequests[requestId] = req;

      if (!isNoise(req.url, rt)) {
        const short = req.url.replace(/^https?:\/\/[^/]+/, '');
        console.log(
          `${ts()} ${c.green}[→]${c.reset} ${c.bold}${req.method}${c.reset} ${short}` +
          ` ${c.gray}(${rt})${c.reset}`
        );
        this._rec({ event: 'net.req', method: req.method, url: req.url, resourceType: rt });
      }
    });

    this._cdp.on('Network.responseReceived', ({ requestId, response }) => {
      const req = this.networkRequests[requestId];
      if (!req) return;
      req.status      = response.status;
      req.contentType = response.headers?.['content-type'] || '';
      req.mimeType    = response.mimeType;
      req.responseTime = this._now();

      if (!isNoise(req.url, req.resourceType)) {
        const short    = req.url.replace(/^https?:\/\/[^/]+/, '');
        const ct       = req.contentType;
        const isStream = ct.includes('event-stream') || ct.includes('stream');
        const streamTag = isStream ? ` ${c.magenta}[SSE]${c.reset}` : '';
        console.log(
          `${ts()} ${c.green}[←]${c.reset} ${response.status} ${short}` +
          ` ${c.gray}${ct}${c.reset}${streamTag}`
        );
        this._rec({ event: 'net.res', status: response.status, url: req.url, contentType: ct });
      }
    });

    this._cdp.on('Network.webSocketCreated', ({ url }) => {
      console.log(`${ts()} ${c.magenta}[WebSocket]${c.reset} ${url}`);
      this._rec({ event: 'net.ws', url });
    });

    this._cdp.on('Network.webSocketFrameSent', ({ response }) => {
      const p = response?.payloadData?.slice(0, 120) || '';
      if (p) console.log(`${ts()} ${c.magenta}[WS →]${c.reset} ${p}`);
    });

    this._cdp.on('Network.webSocketFrameReceived', ({ response }) => {
      const p = response?.payloadData?.slice(0, 120) || '';
      if (p) console.log(`${ts()} ${c.magenta}[WS ←]${c.reset} ${p}`);
    });
  }

  // ── DOM polling ────────────────────────────────────────────────────────────
  _startPolling() {
    this._pollTimer = setInterval(() => this._poll(), 300);
  }

  async _poll() {
    if (!this._page) return;
    let state;
    try {
      state = await this._page.evaluate(DOM_POLL_FN);
    } catch (_) {
      return; // page navigating / closed
    }

    const prev = this._prevState;
    this._prevState = state;
    if (!prev) return;

    // ── diff busy elements ──
    const prevBusyKey = prev.busyEls.map(e => e.tagName + e.className).join('|');
    const currBusyKey = state.busyEls.map(e => e.tagName + e.className).join('|');
    if (prevBusyKey !== currBusyKey) {
      const added   = state.busyEls.filter(e =>
        !prev.busyEls.some(p => p.tagName === e.tagName && p.className === e.className));
      const removed = prev.busyEls.filter(e =>
        !state.busyEls.some(c => c.tagName === e.tagName && c.className === e.className));

      for (const el of added) {
        console.log(
          `${ts()} ${c.red}${c.bold}[BUSY+]${c.reset}` +
          ` <${el.tagName}> class="${el.className || ''}"` +
          ` id="${el.id || ''}"` +
          ` testid="${el.attrs?.['data-testid'] || ''}"` +
          ` ${c.gray}${el.textSnippet || ''}${c.reset}`
        );
        const ev = { kind: 'busy.added', el };
        this.domEvents.push({ ...ev, timestamp: this._now() });
        this._rec({ event: 'dom', ...ev });
      }
      for (const el of removed) {
        console.log(
          `${ts()} ${c.red}[BUSY-]${c.reset}` +
          ` <${el.tagName}> class="${el.className || ''}"`
        );
        const ev = { kind: 'busy.removed', el };
        this.domEvents.push({ ...ev, timestamp: this._now() });
        this._rec({ event: 'dom', ...ev });
      }
    }

    // ── diff stop buttons ──
    const prevStopKey = prev.stopBtns.map(e => (e.attrs?.['data-testid'] || e.className)).join('|');
    const currStopKey = state.stopBtns.map(e => (e.attrs?.['data-testid'] || e.className)).join('|');
    if (prevStopKey !== currStopKey) {
      const added   = state.stopBtns.filter(e =>
        !prev.stopBtns.some(p => p.className === e.className));
      const removed = prev.stopBtns.filter(e =>
        !state.stopBtns.some(c => c.className === e.className));

      for (const el of added) {
        console.log(
          `${ts()} ${c.yellow}[STOP+]${c.reset}` +
          ` text="${el.textSnippet || ''}"` +
          ` label="${el.attrs?.['aria-label'] || ''}"` +
          ` testid="${el.attrs?.['data-testid'] || ''}"` +
          ` class="${el.className || ''}"`
        );
        const ev = { kind: 'stop.added', el };
        this.domEvents.push({ ...ev, timestamp: this._now() });
        this._rec({ event: 'dom', ...ev });
      }
      for (const el of removed) {
        console.log(
          `${ts()} ${c.yellow}[STOP-]${c.reset}` +
          ` testid="${el.attrs?.['data-testid'] || ''}"` +
          ` class="${el.className || ''}"`
        );
        const ev = { kind: 'stop.removed', el };
        this.domEvents.push({ ...ev, timestamp: this._now() });
        this._rec({ event: 'dom', ...ev });
      }
    }
  }

  // ── Snapshot ───────────────────────────────────────────────────────────────
  async snapshot(label = 'snap') {
    if (!this._page) { console.log('No active page'); return null; }
    const state = await this._page.evaluate(DOM_POLL_FN);
    const full  = {
      ...state,
      html: (await this._page.evaluate(
        () => document.documentElement.outerHTML
      )).slice(0, 100000),
    };
    const file = path.join(
      this.outputDir,
      `snapshot-${label}-${this._now().replace(/[:.]/g, '-')}.json`
    );
    fs.writeFileSync(file, JSON.stringify(full, null, 2));
    console.log(`${ts()} ${c.green}[Saved]${c.reset} ${path.basename(file)}`);
    console.log(`  busy elements : ${state.busyEls.length}`);
    console.log(`  stop buttons  : ${state.stopBtns.length}`);
    console.log(`  aria-live els : ${state.ariaLiveEls.length}`);
    return full;
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  async report() {
    const nets = Object.values(this.networkRequests);
    const interesting = nets.filter(r => !isNoise(r.url, r.resourceType));

    const report = {
      metadata: { timestamp: this._now(), url: this._page?.url() },
      summary: {
        domEvents:            this.domEvents.length,
        busyAddedEvents:      this.domEvents.filter(e => e.kind === 'busy.added').length,
        busyRemovedEvents:    this.domEvents.filter(e => e.kind === 'busy.removed').length,
        stopAddedEvents:      this.domEvents.filter(e => e.kind === 'stop.added').length,
        networkRequests:      nets.length,
        interestingRequests:  interesting.length,
        webSockets:           this.timeline.filter(e => e.event === 'net.ws').length,
      },
      timeline:                 this.timeline,
      busyDOMEvents:            this.domEvents.filter(e => e.kind?.startsWith('busy')),
      stopBtnEvents:            this.domEvents.filter(e => e.kind?.startsWith('stop')),
      interestingNetworkRequests: interesting,
    };

    const file = path.join(
      this.outputDir,
      `report-${this._now().replace(/[:.]/g, '-')}.json`
    );
    fs.writeFileSync(file, JSON.stringify(report, null, 2));
    console.log(`${ts()} ${c.green}[Report]${c.reset} ${path.basename(file)}`);
    console.log(`  busy+  : ${report.summary.busyAddedEvents}`);
    console.log(`  busy-  : ${report.summary.busyRemovedEvents}`);
    console.log(`  stop+  : ${report.summary.stopAddedEvents}`);
    console.log(`  net    : ${report.summary.interestingRequests} interesting`);
    return report;
  }

  async close() {
    clearInterval(this._pollTimer);
    if (this._cdp)     await this._cdp.detach().catch(() => {});
    // Don't close context/browser — Edge is managed externally
    if (this._browser) await this._browser.close().catch(() => {});
  }
}

// ─── REPL ──────────────────────────────────────────────────────────────────────
async function main() {
  const observer = new ChatGPTObserver({
    edgeProfilePath: process.env.EDGE_PROFILE_PATH ||
      'C:\\Users\\One\\AppData\\Local\\Microsoft\\Edge\\User Data - Playwright',
    outputDir: path.join(process.cwd(), 'observations'),
  });

  try {
    await observer.init();
  } catch (err) {
    console.error('Init failed:', err.message);
    process.exit(1);
  }

  console.log(`
${c.bold}=== TabBeacon Observer ===${c.reset}

DOM 変化・Network はリアルタイムで出力されます。

  ${c.bold}s${c.reset} / snapshot  現在のページ状態をキャプチャ
  ${c.bold}r${c.reset} / report    observations/ にレポート保存
  ${c.bold}q${c.reset} / exit      レポート保存して終了
`);

  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const prompt = () => rl.question(`${c.gray}> ${c.reset}`, async (input) => {
    const cmd = input.trim().toLowerCase();
    if (['s','snap','snapshot'].includes(cmd)) {
      await observer.snapshot('manual');
    } else if (['r','report'].includes(cmd)) {
      await observer.report();
    } else if (['q','exit'].includes(cmd)) {
      rl.close();
      await observer.report();
      await observer.close();
      process.exit(0);
    } else if (cmd !== '') {
      console.log(`Unknown: ${cmd}  (s / r / q)`);
    }
    prompt();
  });

  prompt();
}

main();
