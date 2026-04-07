(() => {
  function normalizeReviewTarget(value) {
    const branch = typeof value?.branch === "string" && value.branch.trim() ? value.branch.trim() : "unknown";
    const commit = typeof value?.commit === "string" && value.commit.trim() ? value.commit.trim() : "unknown";
    const base = typeof value?.base === "string" ? value.base.trim() : "";
    const updatedAt = typeof value?.updatedAt === "string" ? value.updatedAt.trim() : "";
    return { branch, commit, base, updatedAt };
  }

  function formatReviewTarget(info) {
    let label = `Review target: ${info.branch} @ ${info.commit}`;
    if (info.base) {
      label += ` (base: ${info.base})`;
    }
    return label;
  }

  function applyReviewTarget() {
    const element = document.getElementById("reviewTargetText");
    if (!element) return;

    const info = normalizeReviewTarget(window.TabBeaconReviewTarget);
    element.textContent = formatReviewTarget(info);

    const details = [
      `branch: ${info.branch}`,
      `commit: ${info.commit}`
    ];

    if (info.base) {
      details.push(`base: ${info.base}`);
    }

    if (info.updatedAt) {
      details.push(`updated: ${info.updatedAt}`);
    }

    element.title = details.join(" | ");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyReviewTarget, { once: true });
  } else {
    applyReviewTarget();
  }
})();
