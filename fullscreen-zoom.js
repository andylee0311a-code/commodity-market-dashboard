/* Fullscreen chart mode plus Chart.js zoom/pan interactions. */
(() => {
  if (typeof Chart === "undefined") return;

  const chartCard = document.querySelector(".chart-card");
  const fullscreenButton = document.getElementById("fullscreenChart");
  const fullscreenIcon = document.getElementById("fullscreenIcon");
  const fullscreenLabel = document.getElementById("fullscreenLabel");
  const resetZoomButton = document.getElementById("resetZoom");

  if (!chartCard || !fullscreenButton || !resetZoomButton) return;

  const DAY = 24 * 60 * 60 * 1000;

  const zoomOptions = {
    limits: {
      x: {
        min: "original",
        max: "original",
        minRange: 7 * DAY,
      },
    },
    pan: {
      enabled: true,
      mode: "x",
      threshold: 5,
      onPanComplete: ({ chart }) => updateResetButton(chart),
    },
    zoom: {
      wheel: {
        enabled: true,
        speed: 0.08,
      },
      drag: {
        enabled: false,
      },
      pinch: {
        enabled: true,
      },
      mode: "x",
      onZoomComplete: ({ chart }) => updateResetButton(chart),
    },
  };

  /*
   * Preserve chartjs-plugin-zoom's required nested defaults. Replacing the
   * complete defaults object removed zoom.drag and caused beforeUpdate to read
   * `enabled` from undefined while the chart was being constructed.
   */
  const existingDefaults = Chart.defaults.plugins.zoom || {};
  const existingZoomDefaults = existingDefaults.zoom || {};

  Chart.defaults.plugins.zoom = {
    ...existingDefaults,
    limits: {
      ...(existingDefaults.limits || {}),
      ...zoomOptions.limits,
    },
    pan: {
      ...(existingDefaults.pan || {}),
      ...zoomOptions.pan,
    },
    zoom: {
      ...existingZoomDefaults,
      ...zoomOptions.zoom,
      wheel: {
        ...(existingZoomDefaults.wheel || {}),
        ...zoomOptions.zoom.wheel,
      },
      drag: {
        ...(existingZoomDefaults.drag || {}),
        ...zoomOptions.zoom.drag,
      },
      pinch: {
        ...(existingZoomDefaults.pinch || {}),
        ...zoomOptions.zoom.pinch,
      },
    },
  };

  function currentChart() {
    if (typeof state !== "undefined" && state.chart) return state.chart;
    return Chart.getChart("priceChart");
  }

  function updateResetButton(chart = currentChart()) {
    const isZoomed = Boolean(chart?.isZoomedOrPanned?.());
    resetZoomButton.disabled = !isZoomed;
    resetZoomButton.setAttribute("aria-disabled", String(!isZoomed));
  }

  function resizeChartSoon() {
    requestAnimationFrame(() => {
      currentChart()?.resize();
      setTimeout(() => currentChart()?.resize(), 120);
    });
  }

  function isPseudoFullscreen() {
    return chartCard.classList.contains("pseudo-fullscreen");
  }

  function isNativeFullscreen() {
    return document.fullscreenElement === chartCard || document.webkitFullscreenElement === chartCard;
  }

  function updateFullscreenButton() {
    const active = isNativeFullscreen() || isPseudoFullscreen();
    fullscreenIcon.textContent = active ? "⤡" : "⛶";
    fullscreenLabel.textContent = active ? "退出全螢幕" : "全螢幕";
    fullscreenButton.setAttribute("aria-pressed", String(active));
    fullscreenButton.setAttribute("aria-label", active ? "退出圖表全螢幕" : "開啟圖表全螢幕");
    fullscreenButton.setAttribute("title", active ? "退出圖表全螢幕" : "開啟圖表全螢幕");
  }

  function enterPseudoFullscreen() {
    chartCard.classList.add("pseudo-fullscreen");
    document.body.classList.add("chart-fullscreen-open");
    updateFullscreenButton();
    resizeChartSoon();
  }

  function exitPseudoFullscreen() {
    chartCard.classList.remove("pseudo-fullscreen");
    document.body.classList.remove("chart-fullscreen-open");
    updateFullscreenButton();
    resizeChartSoon();
  }

  async function toggleFullscreen() {
    if (isPseudoFullscreen()) {
      exitPseudoFullscreen();
      return;
    }

    if (isNativeFullscreen()) {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
      return;
    }

    const requestFullscreen = chartCard.requestFullscreen || chartCard.webkitRequestFullscreen;
    if (!requestFullscreen) {
      enterPseudoFullscreen();
      return;
    }

    try {
      const result = requestFullscreen.call(chartCard, { navigationUI: "hide" });
      if (result?.then) await result;
    } catch (error) {
      console.debug("Native fullscreen unavailable; using app fullscreen mode.", error);
      enterPseudoFullscreen();
    }
  }

  resetZoomButton.addEventListener("click", () => {
    const chart = currentChart();
    if (!chart?.resetZoom) return;
    chart.resetZoom("default");
    updateResetButton(chart);
  });

  fullscreenButton.addEventListener("click", toggleFullscreen);

  document.addEventListener("fullscreenchange", () => {
    if (!isNativeFullscreen()) document.body.classList.remove("chart-fullscreen-open");
    updateFullscreenButton();
    resizeChartSoon();
  });

  document.addEventListener("webkitfullscreenchange", () => {
    updateFullscreenButton();
    resizeChartSoon();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isPseudoFullscreen()) exitPseudoFullscreen();
  });

  window.addEventListener("orientationchange", resizeChartSoon);
  window.addEventListener("resize", resizeChartSoon, { passive: true });

  if (typeof renderChart === "function") {
    const baseRenderChart = renderChart;
    renderChart = function renderChartWithZoom() {
      baseRenderChart();
      const chart = currentChart();
      updateResetButton(chart);
      resizeChartSoon();
    };
  }

  updateFullscreenButton();
  updateResetButton();
})();