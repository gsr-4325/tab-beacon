(() => {
  const shouldLoadTabBeacon = /^(chrome-extension:|extension:)$/i.test(location.protocol);
  const scripts = [];

  if (shouldLoadTabBeacon) {
    scripts.push("../content-indicator-renderer.js");
  }
  scripts.push("tabbeacon-sandbox.js");

  function loadNext(index) {
    if (index >= scripts.length) return;
    const script = document.createElement("script");
    script.src = scripts[index];
    script.onload = () => loadNext(index + 1);
    script.onerror = () => {
      console.error(`[TabBeacon sandbox] failed to load ${scripts[index]}`);
      loadNext(index + 1);
    };
    document.body.appendChild(script);
  }

  loadNext(0);
})();
