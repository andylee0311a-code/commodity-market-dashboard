const ASSETS = {
  gold: { name: "黃金", symbol: "GC=F", unit: "USD / oz", colorVar: "--asset-gold", decimals: 2 },
  silver: { name: "白銀", symbol: "SI=F", unit: "USD / oz", colorVar: "--asset-silver", decimals: 3 },
  brent: { name: "布蘭特原油", symbol: "BZ=F", unit: "USD / bbl", colorVar: "--asset-brent", decimals: 2 },
};

const FONT_SIZES = {
  small: { label: "小字級", chartSize: 11 },
  medium: { label: "標準字級", chartSize: 12 },
  large: { label: "大字級", chartSize: 14 },
};

const DAY = 24 * 60 * 60 * 1000;

const state = {
  raw: null,
  selected: new Set(Object.keys(ASSETS)),
  range: "1Y",
  mode: "price",
  customStart: null,
  customEnd: null,
  chart: null,
};

const $ = (id) => document.getElementById(id);
const rootStyles = () => getComputedStyle(document.documentElement);
const cssVar = (name) => rootStyles().getPropertyValue(name).trim();

function formatDate(date) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatPrice(value, asset) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: asset.decimals,
    maximumFractionDigits: asset.decimals,
  }).format(value);
}

function rangeStart(range, latest) {
  const date = new Date(latest);
  if (range === "MAX") return new Date("1900-01-01");
  if (range === "YTD") return new Date(date.getFullYear(), 0, 1);
  const months = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12, "3Y": 36, "5Y": 60 };
  date.setMonth(date.getMonth() - months[range]);
  return date;
}

function filteredPoints(key) {
  const points = state.raw?.assets[key]?.prices || [];
  if (!points.length) return [];

  const latest = new Date(`${points.at(-1).date}T00:00:00`);
  const start = state.customStart
    ? new Date(`${state.customStart}T00:00:00`)
    : rangeStart(state.range, latest);
  const end = state.customEnd
    ? new Date(`${state.customEnd}T23:59:59`)
    : latest;

  return points.filter((point) => {
    const date = new Date(`${point.date}T00:00:00`);
    return date >= start && date <= end;
  });
}

function summarize(points) {
  if (!points.length) return null;
  const first = points[0].close;
  const last = points.at(-1).close;
  const prior = points.length > 1 ? points.at(-2).close : last;
  const daily = prior ? ((last - prior) / prior) * 100 : 0;
  const period = first ? ((last - first) / first) * 100 : 0;
  const values = points.map((point) => point.close);
  return {
    first,
    last,
    daily,
    period,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

function changeClass(value) {
  return value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
}

function signedPct(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function syncAssetToggleButtons() {
  document.querySelectorAll("#assetToggles button[data-asset]").forEach((button) => {
    const isSelected = state.selected.has(button.dataset.asset);
    button.classList.toggle("active", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
}

function toggleAsset(key) {
  if (!ASSETS[key]) return;
  if (state.selected.has(key)) {
    if (state.selected.size === 1) return;
    state.selected.delete(key);
  } else {
    state.selected.add(key);
  }
  syncAssetToggleButtons();
  renderAll();
}

function renderAssetToggles() {
  const container = $("assetToggles");
  container.innerHTML = Object.entries(ASSETS).map(([key, asset]) => `
    <button class="asset-toggle active" data-asset="${key}" aria-pressed="true">
      <span class="dot" style="background:var(${asset.colorVar})"></span>${asset.name}
    </button>
  `).join("");

  container.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-asset]");
    if (button) toggleAsset(button.dataset.asset);
  });
}

function renderCards() {
  $("summaryCards").innerHTML = Object.entries(ASSETS).map(([key, asset]) => {
    const summary = summarize(filteredPoints(key));
    const selectedClass = state.selected.has(key) ? "" : " style=\"opacity:.48\"";

    if (!summary) {
      return `<article class="summary-card"${selectedClass}><h3 class="asset-name">${asset.name}</h3><p class="neutral">此區間沒有資料</p></article>`;
    }

    return `
      <article class="summary-card"${selectedClass}>
        <div class="summary-top">
          <div><h3 class="asset-name">${asset.name}</h3><span class="asset-symbol">${asset.symbol} · ${asset.unit}</span></div>
          <span class="daily-change ${changeClass(summary.daily)}">${signedPct(summary.daily)}</span>
        </div>
        <div class="latest-price">${formatPrice(summary.last, asset)}</div>
        <div class="asset-symbol">最新收盤價</div>
        <div class="period-stats">
          <span>區間漲跌<strong class="${changeClass(summary.period)}">${signedPct(summary.period)}</strong></span>
          <span>區間低點<strong>${formatPrice(summary.min, asset)}</strong></span>
          <span>區間高點<strong>${formatPrice(summary.max, asset)}</strong></span>
        </div>
      </article>`;
  }).join("");
}

function chartDatasets() {
  return Object.entries(ASSETS).map(([key, asset]) => {
    const color = cssVar(asset.colorVar);
    const points = filteredPoints(key);
    const base = points[0]?.close || 1;

    return {
      assetKey: key,
      label: asset.name,
      data: points.map((point) => ({
        x: point.date,
        y: state.mode === "normalized" ? (point.close / base) * 100 : point.close,
      })),
      yAxisID: state.mode === "normalized" ? "y" : `y-${key}`,
      borderColor: color,
      backgroundColor: `${color}22`,
      borderWidth: 2.2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.16,
      fill: false,
      hidden: !state.selected.has(key),
    };
  });
}

function buildYScales(chartText, chartGrid) {
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
  const axisPositions = { gold: "left", silver: "right", brent: "left" };

  return Object.fromEntries(Object.entries(ASSETS).map(([key, asset]) => {
    const isSelected = state.selected.has(key);
    const visibleIndex = selectedKeys.indexOf(key);
    const isPrimary = visibleIndex === 0;
    const color = cssVar(asset.colorVar);

    return [`y-${key}`, {
      type: "linear",
      position: axisPositions[key],
      display: isSelected,
      weight: isSelected ? selectedKeys.length - visibleIndex : 0,
      grid: {
        display: isSelected,
        drawOnChartArea: isPrimary,
        color: isPrimary ? chartGrid : "transparent",
      },
      border: {
        display: isSelected,
        color,
      },
      ticks: {
        display: isSelected,
        color,
        callback: (value) => formatPrice(Number(value), asset),
      },
      title: {
        display: isSelected,
        color,
        text: isSelected ? `${asset.name} (${asset.unit})` : "",
      },
    }];
  }));
}

function currentChart() {
  return state.chart || window.Chart?.getChart("priceChart");
}

function updateResetButton(chart = currentChart()) {
  const button = $("resetZoom");
  if (!button) return;
  const isZoomed = Boolean(chart?.isZoomedOrPanned?.());
  button.disabled = !isZoomed;
  button.setAttribute("aria-disabled", String(!isZoomed));
}

function resizeChartSoon() {
  requestAnimationFrame(() => {
    currentChart()?.resize();
    window.setTimeout(() => currentChart()?.resize(), 120);
  });
}

function zoomPluginOptions() {
  return {
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
}

function handleLegendClick(_event, legendItem, legend) {
  const dataset = legend.chart.data.datasets[legendItem.datasetIndex];
  if (dataset?.assetKey) toggleAsset(dataset.assetKey);
}

function renderChart() {
  const canvas = $("priceChart");
  const attachedChart = window.Chart.getChart(canvas);
  if (attachedChart) attachedChart.destroy();
  if (state.chart && state.chart !== attachedChart) {
    try {
      state.chart.destroy();
    } catch (error) {
      console.debug("Previous chart instance was already destroyed.", error);
    }
  }
  state.chart = null;

  const chartText = cssVar("--chart-text");
  const chartLegend = cssVar("--chart-legend");
  const chartGrid = cssVar("--chart-grid");
  const chartGridSoft = cssVar("--chart-grid-soft");

  state.chart = new window.Chart(canvas, {
    type: "line",
    data: { datasets: chartDatasets() },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "nearest", axis: "x" },
      animation: { duration: 260 },
      plugins: {
        legend: {
          onClick: handleLegendClick,
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
            label: (context) => {
              const asset = ASSETS[context.dataset.assetKey];
              return state.mode === "normalized"
                ? ` ${asset.name}: ${context.parsed.y.toFixed(2)}`
                : ` ${asset.name}: ${formatPrice(context.parsed.y, asset)} ${asset.unit}`;
            },
          },
        },
        zoom: zoomPluginOptions(),
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
    $("chartRangeLabel").textContent = `${formatDate(new Date(`${dates[0]}T00:00:00`))} — ${formatDate(new Date(`${dates.at(-1)}T00:00:00`))}`;
  } else {
    $("chartRangeLabel").textContent = "—";
  }

  updateResetButton(state.chart);
  resizeChartSoon();
}

function renderAll() {
  renderCards();
  renderChart();
}

function setTheme(theme, persist = true) {
  document.documentElement.dataset.theme = theme;
  if (persist) localStorage.setItem("commodity-theme", theme);

  const nextTheme = theme === "dark" ? "light" : "dark";
  const nextLabel = nextTheme === "light" ? "淺色模式" : "深色模式";
  $("themeIcon").textContent = nextTheme === "light" ? "☀" : "☾";
  $("themeLabel").textContent = nextLabel;
  $("themeToggle").setAttribute("aria-label", `切換至${nextLabel}`);
  $("themeToggle").setAttribute("title", `切換至${nextLabel}`);
  $("themeToggle").setAttribute("aria-pressed", String(theme === "light"));

  if (state.raw) renderChart();
}

function applyFontSize(size, persist = true) {
  const safeSize = FONT_SIZES[size] ? size : "medium";
  document.documentElement.dataset.fontSize = safeSize;
  if (persist) localStorage.setItem("commodity-font-size", safeSize);

  document.querySelectorAll("#fontSizeControl button[data-font-size]").forEach((button) => {
    const isActive = button.dataset.fontSize === safeSize;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  $("fontSizeControl").setAttribute("title", `目前使用${FONT_SIZES[safeSize].label}`);
  window.Chart.defaults.font.size = FONT_SIZES[safeSize].chartSize;
  if (state.raw) renderChart();
}

function bindUtilityControls() {
  const currentTheme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  setTheme(currentTheme, false);
  applyFontSize(document.documentElement.dataset.fontSize, false);

  $("themeToggle").addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  });

  $("fontSizeControl").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-font-size]");
    if (button) applyFontSize(button.dataset.fontSize);
  });

  const topButton = $("topButton");
  const updateTopButton = () => topButton.classList.toggle("visible", window.scrollY > 360);
  window.addEventListener("scroll", updateTopButton, { passive: true });
  updateTopButton();

  topButton.addEventListener("click", () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  });

  const systemTheme = window.matchMedia("(prefers-color-scheme: light)");
  systemTheme.addEventListener?.("change", (event) => {
    if (!localStorage.getItem("commodity-theme")) {
      setTheme(event.matches ? "light" : "dark", false);
    }
  });
}

function bindChartTools() {
  const chartCard = document.querySelector(".chart-card");
  const fullscreenButton = $("fullscreenChart");
  const fullscreenIcon = $("fullscreenIcon");
  const fullscreenLabel = $("fullscreenLabel");

  const isPseudoFullscreen = () => chartCard.classList.contains("pseudo-fullscreen");
  const isNativeFullscreen = () => (
    document.fullscreenElement === chartCard
    || document.webkitFullscreenElement === chartCard
  );

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
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) await exit.call(document);
      return;
    }

    const request = chartCard.requestFullscreen || chartCard.webkitRequestFullscreen;
    if (!request) {
      enterPseudoFullscreen();
      return;
    }

    try {
      const result = request.call(chartCard, { navigationUI: "hide" });
      if (result?.then) await result;
    } catch (error) {
      console.debug("Native fullscreen unavailable; using app fullscreen mode.", error);
      enterPseudoFullscreen();
    }
  }

  $("resetZoom").addEventListener("click", () => {
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

  updateFullscreenButton();
  updateResetButton();
}

function bindControls() {
  $("rangeButtons").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-range]");
    if (!button) return;
    state.range = button.dataset.range;
    state.customStart = null;
    state.customEnd = null;
    $("startDate").value = "";
    $("endDate").value = "";
    document.querySelectorAll("#rangeButtons button").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
    renderAll();
  });

  $("viewMode").addEventListener("change", (event) => {
    state.mode = event.target.value;
    renderAll();
  });

  $("applyCustom").addEventListener("click", () => {
    const start = $("startDate").value;
    const end = $("endDate").value;
    if (!start || !end || start > end) {
      window.alert("請輸入有效的開始與結束日期。");
      return;
    }
    state.customStart = start;
    state.customEnd = end;
    document.querySelectorAll("#rangeButtons button").forEach((button) => {
      button.classList.remove("active");
    });
    renderAll();
  });
}

function showFatalError(message, error) {
  console.error(error);
  document.body.innerHTML = `
    <main class="shell">
      <div class="notice" role="alert">${message}</div>
    </main>`;
}

async function init() {
  if (!window.Chart) {
    showFatalError("圖表元件載入失敗，請重新整理頁面。", new Error("Chart.js is unavailable"));
    return;
  }

  bindUtilityControls();
  bindChartTools();

  try {
    const response = await fetch("data/commodities.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.raw = await response.json();
  } catch (error) {
    showFatalError("無法載入市場資料，請稍後再試。", error);
    return;
  }

  try {
    $("updatedAt").textContent = state.raw.updated_at
      ? new Intl.DateTimeFormat("zh-TW", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Taipei",
      }).format(new Date(state.raw.updated_at))
      : "—";
    $("demoBanner").classList.toggle("hidden", !state.raw.is_demo);
    renderAssetToggles();
    bindControls();
    renderAll();
  } catch (error) {
    showFatalError("圖表初始化失敗，請重新整理頁面。", error);
  }
}

init();

