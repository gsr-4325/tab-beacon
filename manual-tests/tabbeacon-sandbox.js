const busyContainer = document.getElementById('busyContainer');
const logEl = document.getElementById('log');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const networkUrlEl = document.getElementById('networkUrl');
const runDomScenarioButton = document.getElementById('runDomScenario');
let busyNode = null;
let stopNode = null;
let domScenarioTimer = null;

function log(message) {
  const line = `[${new Date().toLocaleTimeString()}] ${message}`;
  logEl.textContent = `${line}\n${logEl.textContent}`.trim();
}

function setStatus(isBusy, reason) {
  statusDot.classList.toggle('busy', isBusy);
  statusText.textContent = isBusy ? `busy (${reason})` : 'idle';
}

function updateScenarioButtonState() {
  runDomScenarioButton.disabled = !!domScenarioTimer;
}

function renderBusyNode() {
  if (busyNode) return;
  busyNode = document.createElement('div');
  busyNode.setAttribute('aria-busy', 'true');
  busyNode.setAttribute('aria-live', 'polite');
  busyNode.textContent = 'Sandbox busy element is active';
  busyNode.className = 'busy-pill';
  busyContainer.appendChild(busyNode);
  setStatus(true, 'DOM');
  log('aria-busy element added');
}

function removeBusyNode() {
  if (busyNode) {
    busyNode.remove();
    busyNode = null;
    log('aria-busy element removed');
  }
  if (!stopNode) setStatus(false, 'none');
}

function toggleBusyActionButton() {
  if (stopNode) {
    stopNode.remove();
    stopNode = null;
    log('busy action button removed');
    if (!busyNode) setStatus(false, 'none');
    return;
  }

  stopNode = document.createElement('button');
  stopNode.textContent = 'Stop generating';
  stopNode.setAttribute('aria-label', 'Stop generating');
  stopNode.dataset.testid = 'stop-button';
  busyContainer.appendChild(stopNode);
  setStatus(true, 'DOM');
  log('busy action button added');
}

function clearDomScenarioTimer() {
  if (domScenarioTimer) {
    clearTimeout(domScenarioTimer);
    domScenarioTimer = null;
    updateScenarioButtonState();
  }
}

function resetSandboxState({ silent = false } = {}) {
  clearDomScenarioTimer();
  if (busyNode) {
    busyNode.remove();
    busyNode = null;
  }
  if (stopNode) {
    stopNode.remove();
    stopNode = null;
  }
  setStatus(false, 'none');
  if (!silent) {
    log('sandbox state reset');
  }
}

function finishDomScenario() {
  clearDomScenarioTimer();
  removeBusyNode();
  if (stopNode) toggleBusyActionButton();
  setStatus(false, 'none');
  log('5-second DOM busy scenario ended');
}

function runDomScenario() {
  if (domScenarioTimer) {
    log('DOM busy scenario is already running');
    return;
  }
  renderBusyNode();
  if (!stopNode) toggleBusyActionButton();
  log('5-second DOM busy scenario started');
  domScenarioTimer = window.setTimeout(finishDomScenario, 5000);
  updateScenarioButtonState();
}

async function runFetch(method) {
  const url = networkUrlEl.value.trim();
  if (!url) return;
  log(`fetch ${method} started: ${url}`);
  try {
    const response = await fetch(url, {
      method,
      mode: 'cors',
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: method === 'POST' ? JSON.stringify({ source: 'tabbeacon-sandbox', ts: Date.now() }) : undefined
    });
    log(`fetch ${method} completed: status ${response.status}`);
  } catch (error) {
    log(`fetch ${method} failed: ${error.message}`);
  }
}

function runXhrGet() {
  const url = networkUrlEl.value.trim();
  if (!url) return;
  log(`XHR GET started: ${url}`);
  const xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.onreadystatechange = () => {
    if (xhr.readyState === 4) {
      log(`XHR GET completed: status ${xhr.status}`);
    }
  };
  xhr.onerror = () => {
    log('XHR GET failed');
  };
  xhr.send();
}

async function copyLog() {
  try {
    await navigator.clipboard.writeText(logEl.textContent || '');
    log('log copied to clipboard');
  } catch (error) {
    log(`failed to copy log: ${error.message}`);
  }
}

document.getElementById('addBusy').addEventListener('click', renderBusyNode);
document.getElementById('removeBusy').addEventListener('click', removeBusyNode);
document.getElementById('toggleBusyAction').addEventListener('click', toggleBusyActionButton);
document.getElementById('runDomScenario').addEventListener('click', runDomScenario);
document.getElementById('resetSandbox').addEventListener('click', () => resetSandboxState());
document.getElementById('runFetchGet').addEventListener('click', () => runFetch('GET'));
document.getElementById('runFetchPost').addEventListener('click', () => runFetch('POST'));
document.getElementById('runXhrGet').addEventListener('click', runXhrGet);
document.getElementById('copyLog').addEventListener('click', copyLog);
updateScenarioButtonState();
