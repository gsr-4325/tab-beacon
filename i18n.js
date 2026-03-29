(() => {
  function t(key, substitutions) {
    try {
      return chrome.i18n.getMessage(key, substitutions) || key;
    } catch {
      return key;
    }
  }

  function apply(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((node) => {
      const key = node.dataset.i18n;
      node.textContent = t(key);
    });

    root.querySelectorAll('[data-i18n-html]').forEach((node) => {
      const key = node.dataset.i18nHtml;
      node.innerHTML = t(key);
    });

    root.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
      const key = node.dataset.i18nPlaceholder;
      node.setAttribute('placeholder', t(key));
    });

    root.querySelectorAll('[data-i18n-title]').forEach((node) => {
      const key = node.dataset.i18nTitle;
      node.setAttribute('title', t(key));
    });

    root.querySelectorAll('[data-i18n-value]').forEach((node) => {
      const key = node.dataset.i18nValue;
      node.setAttribute('value', t(key));
    });

    const lang = chrome.i18n.getUILanguage?.() || 'en';
    document.documentElement.lang = lang;
  }

  window.TabBeaconI18n = { t, apply };
})();
