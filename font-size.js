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

/*
 * Rebuild commodity axes from the current selection on every render.
 * This prevents Chart.js from retaining the previous silver-axis title
 * after an asset is enabled or disabled.
 */
(() => {
  if (typeof Chart === "undefined" || typeof state === "undefined" || typeof ASSETS === "undefined") return;

  const axisPosition = {
    gold: "left",
    silver: "right",
    brent: "left",
  };

  buildYScales = function buildSelectedYScales(chartText, chartGrid) {
    if (state.mode === "normalized") {
      return {
        y: {
          type: "linear",
          position: "left",
          grid: { color: chartGrid },
          ticks: {
            color: chartText,
            callback: (value) => Number(value).toFixed(0),
          },
          title: {
            display: true,
            color: chartText,
            text: "Index (Start = 100)",
          },
        },
      };
    }

    const selectedKeys = Object.keys(ASSETS).filter((key) => state.selected.has(key));

    return Object.fromEntries(selectedKeys.map((key, index) => {
      const asset = ASSETS[key];
      const color = cssVar(asset.colorVar);
      const position = axisPosition[key] || (index % 2 === 0 ? "left" : "right");

      return [`y-${key}`, {
        type: "linear",
        position,
        display: true,
        weight: selectedKeys.length - index,
        grid: {
          drawOnChartArea: index === 0,
          color: index === 0 ? chartGrid : "transparent",
        },
        border: { color },
        ticks: {
          color,
          callback: (value) => formatPrice(Number(value), asset),
        },
        title: {
          display: true,
          color,
          text: `${asset.name} (${asset.unit})`,
        },
      }];
    }));
  };

  renderChart = function renderCommodityChart() {
    const canvas = $("priceChart");
    const datasets = chartDatasets();
    const chartText = cssVar("--chart-text");
    const chartLegend = cssVar("--chart-legend");
    const chartGrid = cssVar("--chart-grid");
    const chartGridSoft = cssVar("--chart-grid-soft");

    const attachedChart = Chart.getChart(canvas);
    if (attachedChart) attachedChart.destroy();
    if (state.chart && state.chart !== attachedChart) {
      try {
        state.chart.destroy();
      } catch (error) {
        console.debug("Previous chart instance was already destroyed.", error);
      }
    }
    state.chart = null;

    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);

    state.chart = new Chart(canvas, {
      type: "line",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: "nearest", axis: "x" },
        animation: { duration: 260 },
        plugins: {
          legend: {
            labels: {
              color: chartLegend,
              usePointStyle: true,
              pointStyle: "circle",
              padding: 20,
            },
          },
          tooltip: {
            backgroundColor: cssVar("--tooltip-bg"),
            borderColor: cssVar("--tooltip-border"),
            titleColor: cssVar("--tooltip-text"),
            bodyColor: cssVar("--tooltip-text"),
            borderWidth: 1,
            padding: 12,
            callbacks: {
              label: (contextItem) => {
                const asset = ASSETS[contextItem.dataset.assetKey];
                return state.mode === "normalized"
                  ? ` ${asset.name}: ${contextItem.parsed.y.toFixed(2)}`
                  : ` ${asset.name}: ${formatPrice(contextItem.parsed.y, asset)} ${asset.unit}`;
              },
            },
          },
        },
        scales: {
          x: {
            type: "time",
            time: { tooltipFormat: "yyyy-MM-dd" },
            grid: { color: chartGridSoft },
            ticks: { color: chartText, maxRotation: 0 },
          },
          ...buildYScales(chartText, chartGrid),
        },
      },
    });

    $("chartTitle").textContent = state.mode === "normalized" ? "區間相對表現" : "商品價格趨勢";
    const activePoints = Object.keys(ASSETS)
      .filter((key) => state.selected.has(key))
      .flatMap(filteredPoints);

    if (activePoints.length) {
      const dates = activePoints.map((point) => point.date).sort();
      $("chartRangeLabel").textContent = `${formatDate(new Date(dates[0] + "T00:00:00"))} — ${formatDate(new Date(dates.at(-1) + "T00:00:00"))}`;
    } else {
      $("chartRangeLabel").textContent = "—";
    }
  };
})();