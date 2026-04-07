(() => {
  const themeBootstrap = window.TabBeaconThemeBootstrap || {};
  const THEME_STORAGE_KEY = window.TabBeaconThemeBootstrap?.THEME_STORAGE_KEY || "tabBeaconOptionsTheme";
  const MODE_STORAGE_KEY = "tabBeaconDefaultColorMode";
  const LEGACY_MODE_STORAGE_KEY = "tabBeaconWin11ColorMode";
  const CURRENT_THEME = "default";
  const COLOR_MODES = ["dark", "light"];

  let rulesObserver = null;
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
        <p><code>*</code> は「任意の文字列」を意味します。ホスト名の一部、パスの末尾、その両方に使えます。</p>
        <h3>スキーマは含めてください</h3>
        <p><code>https://</code> や <code>http://</code> など、URL の先頭から書いてください。</p>
        <h3>入力例</h3>
        <ul>
          <li><code>https://chatgpt.com/*</code></li>
          <li><code>https://claude.ai/*</code></li>
          <li><code>https://example.com/projects/*</code></li>
        </ul>
        <p>ここで指定したパターンのどれかに一致したタブだけが、このルールの評価対象になります。</p>
      `,
      conditions: `
        <p>Conditions では、ページが busy かどうかを判定する条件を組み合わせます。</p>
        <h3>DOM condition</h3>
        <p>ページ上の要素の状態を見ます。読み込み中のボタンや busy 属性の変化を拾うときに向いています。</p>
        <ul>
          <li><code>[aria-busy="true"]</code></li>
          <li><code>//button[contains(@aria-label, "Stop")]</code></li>
        </ul>
        <h3>Network condition</h3>
        <p>通信の発生状況を見ます。API リクエストやストリーミングが busy の目印になるページに向いています。</p>
        <ul>
          <li><code>urlContains: /backend-api/</code></li>
          <li><code>pathPrefix: /backend-api/conversation</code></li>
        </ul>
        <p>DOM と Network は同じルールの中で混在できます。</p>
      `,
      matchMode: `
        <p>1 つのルールに複数条件があるとき、それらをどう結合するかを選びます。</p>
        <ul>
          <li><strong>ANY</strong>: どれか 1 つでも true なら、そのルールは一致します。</li>
          <li><strong>ALL</strong>: すべての条件が true のときだけ、そのルールは一致します。</li>
        </ul>
        <p>代替シグナルを並べたいなら <strong>ANY</strong>、すべてのチェックが揃う必要があるなら <strong>ALL</strong> が向いています。</p>
      `,
      smartBusy: `
        <p>これにチェックを入れると、明示的な Conditions に加えて、拡張側の smart busy detection もそのルールの補助シグナルとして使います。</p>
        <ul>
          <li>Conditions だけでは拾い切れない busy 状態を補完したいときに向いています。</li>
          <li>逆に、完全に手動で条件を管理したい場合はオフにしてください。</li>
        </ul>
        <p>つまり、smart busy detection は「ルール全体の追加ヒント」として働きます。</p>
      `,
      indicatorStyleSpinner: `
        <p>タブアイコンの右下に、回転する busy インジケーター（スピナー）を表示します。</p>
        <ul>
          <li>アクティブな処理が進行中であることを直感的に伝えます。</li>
          <li>Spinning style セクションから、スピナーの見た目を選べます。</li>
        </ul>
      `,
      indicatorStyleStaticBadge: `
        <p>タブアイコンの右下に、アニメーションしない静的なバッジを表示します。</p>
        <ul>
          <li>処理中であることを控えめに、アニメーションの煩わしさなしに伝えます。</li>
          <li>Badge style セクションから、バッジの見た目を選べます。</li>
        </ul>
      `
    };

    const en = {
      urlPatterns: `
        <p>Enter the URLs this rule should watch, one pattern per line.</p>
        <h3>What <code>*</code> means</h3>
        <p><code>*</code> means “match any sequence of characters”. You can use it for part of the hostname, the path, or both.</p>
        <h3>Include the scheme</h3>
        <p>Write the pattern from the beginning of the URL, including the scheme such as <code>https://</code> or <code>http://</code>.</p>
        <h3>Examples</h3>
        <ul>
          <li><code>https://chatgpt.com/*</code></li>
          <li><code>https://claude.ai/*</code></li>
          <li><code>https://example.com/projects/*</code></li>
        </ul>
        <p>Only tabs whose URL matches at least one of these patterns are evaluated by this rule.</p>
      `,
      conditions: `
        <p>Conditions describe what Tab Beacon should treat as a busy signal.</p>
        <h3>DOM condition</h3>
        <p>Use this when the page exposes a visible DOM signal, such as a loading button or an <code>aria-busy</code> attribute.</p>
        <ul>
          <li><code>[aria-busy="true"]</code></li>
          <li><code>//button[contains(@aria-label, "Stop")]</code></li>
        </ul>
        <h3>Network condition</h3>
        <p>Use this when a request pattern is the clearest signal, such as API traffic or streaming endpoints.</p>
        <ul>
          <li><code>urlContains: /backend-api/</code></li>
          <li><code>pathPrefix: /backend-api/conversation</code></li>
        </ul>
        <p>You can mix DOM and network conditions inside the same rule.</p>
      `,
      matchMode: `
        <p>Choose how multiple conditions inside one rule are combined.</p>
        <ul>
          <li><strong>ANY</strong>: the rule matches when at least one condition is true.</li>
          <li><strong>ALL</strong>: the rule matches only when every condition is true.</li>
        </ul>
        <p>Use <strong>ANY</strong> when several alternative signals can indicate busy. Use <strong>ALL</strong> when every check must agree before the rule should match.</p>
      `,
      smartBusy: `
        <p>When this is enabled, Tab Beacon also uses the built-in smart busy detection as an additional signal for the rule.</p>
        <ul>
          <li>Enable it when your explicit conditions are useful but still miss some busy states.</li>
          <li>Disable it when you want the rule to depend only on the conditions you configured manually.</li>
        </ul>
        <p>In other words, smart busy detection acts as a rule-wide fallback hint.</p>
      `,
      indicatorStyleSpinner: `
        <p>Show a spinning busy indicator on the tab icon.</p>
        <ul>
          <li>Provides an intuitive animated signal for ongoing processes.</li>
          <li>You can customize the look from the Spinner style section.</li>
        </ul>
      `,
      indicatorStyleStaticBadge: `
        <p>Show a non-animated badge on the tab icon.</p>
        <ul>
          <li>Provides a subtle, distraction-free signal for busy states.</li>
          <li>You can customize the look from the Badge style section.</li>
        </ul>
      `
    };

    const catalog = isJapanese() ? ja : en;
    return catalog[kind] || "";
  }

  function localizedHeroOverview() {
    if (isJapanese()) {
      return {
        summary: "DOM と network の busy シグナルをまとめて監視し、今どのタブが忙しいかをひと目で把握できます。",
        features: [
          "DOM 条件と network 条件を同じルールに混在できます。",
          "ANY / ALL で条件の結合方法を切り替えられます。",
          "smart busy detection を補助シグナルとして使えます。",
          "ページごとにルールを設定してタブアイコンに busy 状態を表示します。"
        ]
      };
    }

    return {
      summary: "Track busy DOM and network signals together so you can see which tabs still need attention at a glance.",
      features: [
        "Mix DOM and network conditions inside the same rule.",
        "Switch condition joins between ANY and ALL.",
        "Use smart busy detection as a fallback signal.",
        "Show a busy state on the tab icon with page-specific rules."
      ]
    };
  }

  function setStoredTheme(themeName) {
    try {
      window.localStorage.setItem(
        THEME_STORAGE_KEY,
        themeBootstrap.normalizeThemeName?.(themeName) || CURRENT_THEME
      );
    } catch {
      // ignore storage access failures
    }
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
      const value =
        window.localStorage.getItem(MODE_STORAGE_KEY) ||
        window.localStorage.getItem(LEGACY_MODE_STORAGE_KEY);
      return resolveMode(value);
    } catch {
      return resolveMode("auto");
    }
  }

  function setStoredMode(mode) {
    try {
      const resolvedMode = COLOR_MODES.includes(mode) ? mode : resolveMode("auto");
      window.localStorage.setItem(MODE_STORAGE_KEY, resolvedMode);
      window.localStorage.removeItem(LEGACY_MODE_STORAGE_KEY);
    } catch {
      // ignore storage access failures
    }
  }

  function toggleMode() {
    const next = getStoredMode() === "dark" ? "light" : "dark";
    setStoredMode(next);
    applyMode(next);
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

  function ensureThemeSelector() {
    if (document.getElementById("themeDebugControl")) return;
    const availableThemes = getAvailableThemes();
    if (availableThemes.length <= 1) return;

    const debugSectionBody = document.getElementById("debugSectionBody");
    if (!debugSectionBody) return;

    const wrapper = document.createElement("div");
    wrapper.id = "themeDebugControl";
    wrapper.className = "theme-debug-control";

    const label = document.createElement("label");
    label.className = "theme-debug-label";

    const title = document.createElement("span");
    title.className = "theme-debug-title";
    title.textContent = message("optionsThemeSelectorLabel", "Options theme");

    const select = document.createElement("select");
    select.id = "optionsThemeSelect";
    select.className = "theme-debug-select";
    select.setAttribute("aria-label", title.textContent);

    availableThemes.forEach((theme) => {
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

    label.append(title, select);
    wrapper.append(label);
    debugSectionBody.prepend(wrapper);
  }

  function moonIconSvg() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M14.6 3.8a8.8 8.8 0 1 0 5.6 15.6 8.2 8.2 0 0 1-3.5.7A8.8 8.8 0 0 1 14.6 3.8Z"></path>
        <path d="M18.8 7.3l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5.5-1.2Z"></path>
        <path d="M6.9 11.7l.4 1 .9.4-.9.4-.4 1-.4-1-.9-.4.9-.4.4-1Z"></path>
      </svg>
    `;
  }

  function sunIconSvg() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="4.4"></circle>
        <path d="M12 2.6v2.2M12 19.2v2.2M21.4 12h-2.2M4.8 12H2.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6M18.8 18.8l-1.6-1.6M6.8 6.8 5.2 5.2"></path>
      </svg>
    `;
  }

  function helpIconSvg() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9"></circle>
        <path d="M9.4 9.2a2.7 2.7 0 1 1 4.8 1.7c-.6.7-1.4 1.1-1.9 1.7-.3.4-.4.7-.4 1.4"></path>
        <circle cx="12" cy="17.2" r=".9"></circle>
      </svg>
    `;
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

  function createModeButton(mode) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "default-mode-button";
    button.dataset.defaultModeButton = mode;
    button.title = message(mode === "dark" ? "win11ModeDarkTooltip" : "win11ModeLightTooltip", mode === "dark" ? "Dark mode" : "Light mode");
    button.setAttribute("aria-label", button.title);
    button.innerHTML = mode === "dark" ? moonIconSvg() : sunIconSvg();
    return button;
  }

  function ensureModeSwitch(heroActions) {
    if (!heroActions || heroActions.querySelector(".default-mode-switch")) return;

    const switcher = document.createElement("div");
    switcher.className = "default-mode-switch";
    switcher.setAttribute("role", "button");
    switcher.setAttribute("tabindex", "0");
    switcher.setAttribute("aria-label", isJapanese() ? "ダーク / ライトの切り替え" : "Toggle dark and light mode");
    switcher.addEventListener("click", (event) => {
      event.preventDefault();
      toggleMode();
    });
    switcher.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleMode();
      }
    });
    COLOR_MODES.forEach((mode) => switcher.appendChild(createModeButton(mode)));
    heroActions.prepend(switcher);
  }

  function shouldIgnoreHeaderToggle(target) {
    return !!target.closest("input, textarea, select, button, a, label");
  }

  function decorateRemoveButton(button) {
    if (!button || button.dataset.defaultRemoveEnhanced === "true") return;
    button.classList.add("default-remove-icon-button");
    button.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4L4 12"/></svg>';
    button.title = message("remove", "Remove");
    button.setAttribute("aria-label", message("remove", "Remove"));
    button.dataset.defaultRemoveEnhanced = "true";
  }

  function createHelpButton(helpKind, titleText) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "default-help-button";
    button.innerHTML = helpIconSvg();
    button.setAttribute("aria-label", titleText);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openHelpDialog(titleText, localizedHelpContent(helpKind));
    });
    return button;
  }

  function attachInlineHelp(labelSpan, helpKind, titleText) {
    const label = labelSpan?.closest("label");
    if (!label || label.querySelector(`.default-inline-label-row[data-help="${helpKind}"]`)) return;

    const row = document.createElement("span");
    row.className = "default-inline-label-row";
    row.dataset.help = helpKind;
    const button = createHelpButton(helpKind, titleText);
    label.insertBefore(row, label.firstChild);
    row.append(labelSpan, button);
  }

  function markHoverButtons(root = document) {
    [
      "#addRule",
      ".add-condition",
      "#installDebugPreset",
      "#openPackagedSandbox",
      "#refreshDiagnosticTabs",
      "#refreshDiagnostics",
      "#clearDiagnostics"
    ].forEach((selector) => {
      root.querySelectorAll(selector).forEach((element) => {
        element.classList.add("default-hover-button");
      });
    });
  }

  function ensureRuleHelp(root) {
    const urlLabelText = root.querySelector('label > span[data-i18n="urlPatterns"]');
    if (urlLabelText) {
      attachInlineHelp(urlLabelText, "urlPatterns", message("urlPatterns", "URL patterns"));
    }

    const matchModeLabelText = root.querySelector('label > span[data-i18n="matchMode"]');
    if (matchModeLabelText) {
      attachInlineHelp(matchModeLabelText, "matchMode", message("matchMode", "Condition join"));
    }

    const smartBusyHelpButton = root.querySelector(".smart-busy-help-button");
    if (smartBusyHelpButton && !smartBusyHelpButton.dataset.defaultHelpBound) {
      smartBusyHelpButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openHelpDialog(message("smartBusyToggle", "Use smart busy detection"), localizedHelpContent("smartBusy"));
      });
      smartBusyHelpButton.dataset.defaultHelpBound = "true";
    }

    const conditionsHeading = root.querySelector('.conditions-panel > .section-header > h3');
    if (conditionsHeading && !conditionsHeading.querySelector('.default-help-button[data-help="conditions"]')) {
      const button = createHelpButton("conditions", message("conditionsTitle", "Conditions"));
      button.dataset.help = "conditions";
      conditionsHeading.appendChild(button);
    }
  }

  function createRuleToggleButton(checkbox) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "default-rule-enable-button";
    button.innerHTML = `
      <span class="default-rule-switch-text">Off</span>
      <span class="default-switch-track"><span class="default-switch-thumb"></span></span>
    `;

    const sync = () => {
      const enabled = !!checkbox.checked;
      button.classList.toggle("active", enabled);
      button.classList.toggle("disabled", !!checkbox.disabled);
      button.querySelector(".default-rule-switch-text").textContent = enabled ? message("win11SwitchOn", "On") : message("win11SwitchOff", "Off");
      button.setAttribute("aria-pressed", String(enabled));
      button.disabled = !!checkbox.disabled;
    };

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (checkbox.disabled) return;
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event("input", { bubbles: true }));
      checkbox.dispatchEvent(new Event("change", { bubbles: true }));
      sync();
    });

    checkbox.addEventListener("change", sync);
    checkbox.addEventListener("input", sync);
    sync();
    return button;
  }

  function enhanceConditionCard(condition) {
    if (!condition || condition.dataset.defaultEnhancedCondition === "true") return;
    const removeButton = condition.querySelector(".remove-condition");
    const header = condition.querySelector(".condition-header");
    const toggle = condition.querySelector(".condition-toggle");

    decorateRemoveButton(removeButton);

    if (header && toggle) {
      header.addEventListener("click", (event) => {
        if (shouldIgnoreHeaderToggle(event.target)) return;
        toggle.click();
      });
    }

    condition.dataset.defaultEnhancedCondition = "true";
  }

  function enhanceRuleCard(rule) {
    if (!rule || rule.dataset.defaultEnhancedRule === "true") return;

    const head = rule.querySelector(".rule-head");
    const actions = rule.querySelector(".rule-head-actions");
    const enableLabel = actions?.querySelector(".inline");
    const checkbox = rule.querySelector(".rule-enabled");
    const ruleToggle = rule.querySelector(".rule-toggle");
    const removeButton = rule.querySelector(".remove-rule");

    if (!head || !actions || !checkbox || !ruleToggle) return;

    if (enableLabel) {
      enableLabel.classList.add("default-enable-label");
      enableLabel.setAttribute("aria-hidden", "true");
    }

    decorateRemoveButton(removeButton);
    ensureRuleHelp(rule);
    markHoverButtons(rule);

    if (!actions.querySelector(".default-rule-enable-button")) {
      const customToggle = createRuleToggleButton(checkbox);
      if (removeButton) {
        actions.insertBefore(customToggle, removeButton);
      } else {
        actions.appendChild(customToggle);
      }
    }

    // Keep the toggle icon on the left (in rule-head-start)
    const ruleHeadStart = rule.querySelector(".rule-head-start");
    if (ruleHeadStart && ruleHeadStart.firstElementChild !== ruleToggle) {
      ruleHeadStart.insertBefore(ruleToggle, ruleHeadStart.firstElementChild);
    }

    head.addEventListener("click", (event) => {
      if (shouldIgnoreHeaderToggle(event.target)) return;
      ruleToggle.click();
    });

    rule.dataset.defaultEnhancedRule = "true";
  }

  function enhanceAllRules() {
    document.querySelectorAll("#rulesContainer .rule").forEach((rule) => {
      enhanceRuleCard(rule);
      rule.querySelectorAll(".condition").forEach(enhanceConditionCard);
    });
    markHoverButtons(document);
  }

  function ensureGlobalHelp() {
    document.querySelectorAll('[data-indicator-help]:not([data-help-bound])').forEach((el) => {
      const kind = el.dataset.indicatorHelp;
      const titleText = el.textContent.trim();
      const button = createHelpButton(kind, titleText);
      button.dataset.help = kind;
      // default-inline-label-row expects the button to be inside the flex row, aligning nicely.
      el.appendChild(button);
      el.dataset.helpBound = "true";
    });
  }

  function observeBody() {
    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(() => {
        ensureGlobalHelp();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function observeRules() {
    const rulesContainer = document.getElementById("rulesContainer");
    if (!rulesContainer || rulesObserver) return;

    rulesObserver = new MutationObserver(() => {
      window.requestAnimationFrame(() => {
        enhanceAllRules();
      });
    });

    rulesObserver.observe(rulesContainer, { childList: true, subtree: true });
  }

  function syncDebugToggleIcon() {
    const icon = document.querySelector('#debugToggle .section-toggle-icon');
    if (icon) {
      icon.textContent = '▾';
    }
  }

  function ensureDebugHeaderBehavior() {
    const header = document.querySelector(".debug-card .section-header");
    const toggle = document.getElementById("debugToggle");
    if (!header || !toggle || header.dataset.defaultClickable === "true") return;

    syncDebugToggleIcon();

    header.addEventListener("click", (event) => {
      if (shouldIgnoreHeaderToggle(event.target)) return;
      toggle.click();
    });

    header.dataset.defaultClickable = "true";
  }

  function updateHeroOverview(principles) {
    if (!principles) return;

    const heroOverview = localizedHeroOverview();

    principles.classList.remove("default-hidden-principles");
    principles.replaceChildren(
      ...heroOverview.features.map((featureText) => {
        const item = document.createElement("li");
        item.textContent = featureText;
        return item;
      })
    );
  }

  function ensureLayout() {
    if (document.body.dataset.defaultEnhanced === "true") return true;

    const page = document.querySelector(".page");
    const hero = page?.querySelector(".hero");
    const heroCopy = hero?.querySelector(".hero-copy");
    const heroActions = hero?.querySelector(".hero-actions");
    const title = heroCopy?.querySelector("h1");
    const subtitle = heroCopy?.querySelector(".subtitle");
    const principles = heroCopy?.querySelector(".hero-principles");
    const debugCard = page?.querySelector(".debug-card");
    const examplesCard = Array.from(page?.querySelectorAll(":scope > .card") || []).find((card) => card.querySelector(".examples"));
    const footer = document.querySelector(".app-footer");

    if (!page || !hero) return false;

    page.classList.add("default-page");
    hero.classList.add("default-hero");
    if (debugCard) debugCard.classList.add("default-section-card", "default-debug-card");
    if (footer) footer.classList.add("default-footer");

    if (examplesCard) {
      examplesCard.classList.add("default-hidden-section");
      examplesCard.remove();
    }

    if (title) {
      title.textContent = message("appName", "Tab Beacon");
    }

    if (subtitle) {
      subtitle.textContent = localizedHeroOverview().summary;
    }

    updateHeroOverview(principles);

    ensureModeSwitch(heroActions);
    syncDebugToggleIcon();
    ensureHelpDialog();
    markHoverButtons(document);

    document.body.dataset.defaultEnhanced = "true";
    return true;
  }

  function activate() {
    if (!ensureLayout()) return;
    ensureThemeSelector();
    enhanceAllRules();
    ensureGlobalHelp();
    observeRules();
    observeBody();
    ensureDebugHeaderBehavior();
    applyMode(getStoredMode());
    window.TabBeaconOptionsTheme = {
      name: CURRENT_THEME,
      setMode: (mode) => {
        setStoredMode(mode);
        applyMode(mode);
      },
      refresh: enhanceAllRules
    };
  }

  function init() {
    if (document.readyState === "complete") {
      activate();
    } else {
      window.addEventListener("load", activate, { once: true });
    }
  }

  init();
})();
