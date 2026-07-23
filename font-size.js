(() => {
  const FONT_SIZES = {
    small: { label: "小字級", chartSize: 11 },
    medium: { label: "標準字級", chartSize: 12 },
    large: { label: "大字級", chartSize: 14 },
  };

  const root = document.documentElement;
  const control = document.getElementById("fontSizeControl");
  if (!control) return;

  function applyFontSize(size, persist = true) {
    const safeSize = FONT_SIZES[size] ? size : "medium";
    root.dataset.fontSize = safeSize;

    if (persist) {
      localStorage.setItem("commodity-font-size", safeSize);
    }

    control.querySelectorAll("button[data-font-size]").forEach((button) => {
      const isActive = button.dataset.fontSize === safeSize;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    control.setAttribute("title", `目前使用${FONT_SIZES[safeSize].label}`);

    if (window.Chart?.defaults?.font) {
      window.Chart.defaults.font.size = FONT_SIZES[safeSize].chartSize;
    }

    if (typeof renderChart === "function" && typeof state !== "undefined" && state.raw) {
      renderChart();
    }
  }

  applyFontSize(root.dataset.fontSize, false);

  control.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-font-size]");
    if (!button) return;
    applyFontSize(button.dataset.fontSize);
  });
})();
