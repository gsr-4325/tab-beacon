(() => {
  const themeBootstrap = window.TabBeaconThemeBootstrap || {};
  const THEME_STORAGE_KEY = window.TabBeaconThemeBootstrap?.THEME_STORAGE_KEY || "tabBeaconOptionsTheme";
  const MODE_STORAGE_KEY = "tabBeaconDefaultColorMode";
  const LEGACY_MODE_STORAGE_KEY = "tabBeaconWin11ColorMode";
  const CURRENT_THEME = "default";
  const COLOR_MODES = ["dark", "light"];

  let helpDialog = null;

  function message(key, fallback) {
    try {
      return chrome.i18n.getMessage(key) || fallback || key;
    } catch {
      return fallback || key;
    }
  }

  function uiLanguage() {
    try {
      return chrome.i18n.getUILanguage() || navigator.language || "en";
    } catch {
      return navigator.language || "en";
    }
  }

  function isJapanese() {
    return /^ja\b/i.test(uiLanguage());
  }

  function localizedHelpContent(kind) {
    const ja = {
      urlPatterns: `
        <p>このルールを評価する対象 URL を、1 行に 1 つずつ入力します。</p>
        <h3>ワイルドカード <code>*</code> の意味</h3>
        <p><code>*</code> は任意の文字列に一致します。ホスト名の一部、パスの末尾、その両方に使えます。</p>
        <h3>入力例</h3>
        <ul>
          <li><code>https://chatgpt.com/*</code></li>
          <li><code>https://claude.ai/*</code></li>
          <li><code>https://example.com/projects/*</code></li>
        </ul>
      `,
      conditions: `
        <p>Conditions では、ページが busy かどうかを判定する条件を組み合わせます。</p>
        <ul>
          <li><strong>DOM</strong>: <code>[aria-busy="true"]</code> や stop ボタンのようなページ状態を見ます。</li>
          <li><strong>Network</strong>: API や streaming request を busy シグナルとして見ます。</li>
        </ul>
        <p>DOM と Network は同じルールの中で混在できます。</p>
      `,
      matchMode: `
        <p>複数条件をどう結合するかを選びます。</p>
        <ul>
          <li><strong>ANY</strong>: どれか 1 つでも true なら一致</li>
          <li><strong>ALL</strong>: すべて true のときだけ一致</li>
        </ul>
      `,
      smartBusy: `
        <p>明示的な Conditions に加えて、拡張側の smart busy detection を補助シグナルとして使います。</p>
        <p>条件だけでは拾い切れない busy 状態を補完したいときに向いています。</p>
      `,
      scope: `
        <p>Scope では、DOM 条件や smart busy detection が参照する範囲を決めます。</p>
        <ul>
          <li><strong>Automatic</strong>: 通常向けの既定値です。</li>
          <li><strong>Whole page</strong>: ページ全体を対象にします。</li>
          <li><strong>Specific area(s)</strong>: CSS または XPath で複数の候補領域を指定できます。</li>
        </ul>
        <p>複数の候補を入れた場合は、一致した領域を監視対象として使います。</p>
      `,
      indicatorStyleSpinner: `
        <p>タブアイコンの右下に、回転する busy インジケーターを表示します。</p>
        <p>進行中の処理をアニメーションで分かりやすく伝えたいときに向いています。</p>
      `,
      indicatorStyleStaticBadge: `
        <p>タブアイコンの右下に、アニメーションしない静的バッジを表示します。</p>
        <p>より控えめで落ち着いた busy 表示にしたいときに向いています。</p>
      `,
      busyEndGracePeriod: `
        <p>すべての条件が false になったあとも、busy 表示を少しだけ残します。</p>
        <p>短いちらつきを吸収して、表示の安定感を高めるための余裕時間です。</p>
      `,
      networkDiagnostics: `
        <p>最近観測した request を確認して、どの network 条件に一致したかを見られます。</p>
        <p>ルール調整中に network 条件が正しく拾えているかを確認するときに使います。</p>
      `
    };

    const en = {
      urlPatterns: `
        <p>Enter the URLs this rule should watch, one pattern per line.</p>
        <h3>What <code>*</code> means</h3>
        <p><code>*</code> matches any sequence of characters across the hostname, path, or both.</p>
        <h3>Examples</h3>
        <ul>
          <li><code>https://chatgpt.com/*</code></li>
          <li><code>https://claude.ai/*</code></li>
          <li><code>https://example.com/projects/*</code></li>
        </ul>
      `,
      conditions: `
        <p>Conditions describe what Tab Beacon should treat as a busy signal.</p>
        <ul>
          <li><strong>DOM</strong>: watch page state such as <code>[aria-busy="true"]</code> or a stop button.</li>
          <li><strong>Network</strong>: watch API or streaming requests as the busy signal.</li>
        </ul>
        <p>You can mix DOM and network conditions inside the same rule.</p>
      `,
      matchMode: `
        <p>Choose how multiple conditions inside one rule are combined.</p>
        <ul>
          <li><strong>ANY</strong>: the rule matches when at least one condition is true.</li>
          <li><strong>ALL</strong>: the rule matches only when every condition is true.</li>
        </ul>
      `,
      smartBusy: `
        <p>Also use the built-in smart busy detection as an additional signal for the rule.</p>
        <p>This is useful when your explicit conditions are helpful but still miss some busy states.</p>
      `,
      scope: `
        <p>Scope defines where DOM conditions and smart busy detection should look.</p>
        <ul>
          <li><strong>Automatic</strong>: the safe default for most rules.</li>
          <li><strong>Whole page</strong>: search across the full document.</li>
          <li><strong>Specific area(s)</strong>: provide multiple CSS or XPath target areas.</li>
        </ul>
        <p>If more than one area is listed, any matching area can be used as the watch target.</p>
      `,
      indicatorStyleSpinner: `
        <p>Show a spinning busy indicator on the tab icon.</p>
        <p>Use it when you want an obvious animated signal for in-progress work.</p>
      `,
      indicatorStyleStaticBadge: `
        <p>Show a non-animated badge on the tab icon.</p>
        <p>Use it when you want a quieter, more minimal busy signal.</p>
      `,
      busyEndGracePeriod: `
        <p>Keep the busy indicator visible for a short time after all conditions become false.</p>
        <p>This helps absorb short flickers and makes the signal feel steadier.</p>
      `,
      networkDiagnostics: `
        <p>Inspect recently captured requests and see which network conditions matched them.</p>
        <p>Use it while tuning rules to verify that your network signals are being detected correctly.</p>
      `
    };

    return (isJapanese() ? ja : en)[kind] || "";
  }

  function setStoredTheme(themeName) {
    try {
      window.localStorage.setItem(
        THEME_STORAGE_KEY,
        themeBootstrap.normalizeThemeName?.(themeName) || CURRENT_THEME
      );
    } catch {}
  }

  function getAvailableThemes() {
    return (themeBootstrap.getThemes?.() || []).map((theme) => ({
      value: theme.id,
      labelKey: theme.labelKey,
      fallback: theme.fallback
    }));
  }

  function resolveMode(mode) {
    if (mode === "dark" || mode === "light") return mode;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function getStoredMode() {
    try {
      return resolveMode(window.localStorage.getItem(MODE_STORAGE_KEY) || window.localStorage.getItem(LEGACY_MODE_STORAGE_KEY));
    } catch {
      return resolveMode("auto");
    }
  }

  function setStoredMode(mode) {
    try {
      const resolved = COLOR_MODES.includes(mode) ? mode : resolveMode("auto");
      window.localStorage.setItem(MODE_STORAGE_KEY, resolved);
      window.localStorage.removeItem(LEGACY_MODE_STORAGE_KEY);
    } catch {}
  }

  function applyMode(mode) {
    const resolved = resolveMode(mode);
    document.documentElement.dataset.defaultMode = resolved;
    document.querySelectorAll("[data-default-mode-button]").forEach((button) => {
      const active = button.dataset.defaultModeButton === resolved;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function toggleMode() {
    const currentMode = resolveMode(document.documentElement.dataset.defaultMode || getStoredMode());
    const nextMode = currentMode === "dark" ? "light" : "dark";
    setStoredMode(nextMode);
    applyMode(nextMode);
  }

  function ensureThemeSelector() {
    if (document.getElementById("themeDebugControl")) return;
    const themes = getAvailableThemes();
    if (themes.length <= 1) return;

    const debugPanel = document.getElementById("debugPanel");
    if (!debugPanel) return;

    const wrapper = document.createElement("div");
    wrapper.id = "themeDebugControl";
    wrapper.className = "surface-panel";
    wrapper.innerHTML = `<label class="theme-debug-label"><span class="theme-debug-title"></span><select id="optionsThemeSelect"></select></label>`;

    const title = wrapper.querySelector(".theme-debug-title");
    const select = wrapper.querySelector("#optionsThemeSelect");
    title.textContent = message("optionsThemeSelectorLabel", "Options theme");

    themes.forEach((theme) => {
      const option = document.createElement("option");
      option.value = theme.value;
      option.textContent = message(theme.labelKey, theme.fallback);
      select.appendChild(option);
    });

    select.value = document.documentElement.dataset.theme || CURRENT_THEME;
    select.addEventListener("change", () => {
      setStoredTheme(select.value);
      window.location.reload();
    });

    debugPanel.prepend(wrapper);
  }

  function ensureHelpDialog() {
    if (helpDialog) return helpDialog;
    const dialog = document.createElement("dialog");
    dialog.className = "default-help-dialog";
    dialog.innerHTML = `
      <div class="default-help-dialog-header">
        <h2 class="default-help-dialog-title"></h2>
      </div>
      <div class="default-help-dialog-content" role="document"></div>
    `;
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    document.body.appendChild(dialog);
    helpDialog = dialog;
    return dialog;
  }

  function openHelpDialog(titleText, bodyHtml) {
    const dialog = ensureHelpDialog();
    dialog.querySelector(".default-help-dialog-title").textContent = titleText;
    dialog.querySelector(".default-help-dialog-content").innerHTML = bodyHtml;
    if (dialog.open) dialog.close();
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "open");
    }
  }

  function bindHelpButtons(root = document) {
    root.querySelectorAll("[data-help-kind]:not([data-help-bound])").forEach((button) => {
      const titleKey = button.dataset.helpTitleKey;
      const titleText = message(titleKey, titleKey || "Help");
      button.setAttribute("title", titleText);
      button.setAttribute("aria-label", titleText);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openHelpDialog(titleText, localizedHelpContent(button.dataset.helpKind));
      });
      button.dataset.helpBound = "true";
    });
  }

  function bindModeSwitch() {
    const switcher = document.querySelector(".default-mode-switch");
    if (!switcher || switcher.dataset.bound === "true") return;
    const toggleTitle = message("defaultModeToggle", "Toggle color mode");

    switcher.setAttribute("aria-label", toggleTitle);

    switcher.querySelectorAll("[data-default-mode-button]").forEach((button) => {
      button.title = toggleTitle;
      button.setAttribute("aria-label", button.title);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleMode();
      });
    });

    switcher.addEventListener("click", (event) => {
      if (event.target.closest("[data-default-mode-button]")) return;
      event.preventDefault();
      toggleMode();
    });

    switcher.dataset.bound = "true";
  }

  function observeBody() {
    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(() => {
        bindHelpButtons(document);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function activate() {
    bindModeSwitch();
    bindHelpButtons(document);
    ensureThemeSelector();
    observeBody();
    applyMode(getStoredMode());
    window.TabBeaconOptionsTheme = {
      name: CURRENT_THEME,
      setMode: (mode) => {
        setStoredMode(mode);
        applyMode(mode);
      }
    };
  }

  if (document.readyState === "complete") {
    activate();
  } else {
    window.addEventListener("load", activate, { once: true });
  }
})();
