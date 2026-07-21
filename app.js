const ASSETS = {
  gold: { name: "黃金", symbol: "GC=F", unit: "USD / oz", color: "#f5c451", decimals: 2 },
  silver: { name: "白銀", symbol: "SI=F", unit: "USD / oz", color: "#c8d2df", decimals: 3 },
  brent: { name: "布蘭特原油", symbol: "BZ=F", unit: "USD / bbl", color: "#55c2a5", decimals: 2 },
};

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

function formatDate(date) {
  return new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
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
  const map = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12, "3Y": 36, "5Y": 60 };
  date.setMonth(date.getMonth() - map[range]);
  return date;
}

function filteredPoints(key) {
  const points = state.raw.assets[key]?.prices || [];
  if (!points.length) return [];
  const latest = new Date(points.at(-1).date + "T00:00:00");
  const start = state.customStart ? new Date(state.customStart + "T00:00:00") : rangeStart(state.range, latest);
  const end = state.customEnd ? new Date(state.customEnd + "T23:59:59") : latest;
  return points.filter((p) => {
    const d = new Date(p.date + "T00:00:00");
    return d >= start && d <= end;
  });
}

function renderAssetToggles() {
  const container = $("assetToggles");
  container.innerHTML = Object.entries(ASSETS).map(([key, asset]) => `
    <button class="asset-toggle active" data-asset="${key}" aria-pressed="true">
      <span class="dot" style="background:${asset.color}"></span>${asset.name}
    </button>
  `).join("");

  container.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-asset]");
    if (!button) return;
    const key = button.dataset.asset;
    if (state.selected.has(key)) {
      if (state.selected.size === 1) return;
      state.selected.delete(key);
      button.classList.remove("active");
      button.setAttribute("aria-pressed", "false");
    } else {
      state.selected.add(key);
      button.classList.add("active");
      button.setAttribute("aria-pressed", "true");
    }
    renderAll();
  });
}

function summarize(points) {
  if (!points.length) return null;
  const first = points[0].close;
  const last = points.at(-1).close;
  const prior = points.length > 1 ? points.at(-2).close : last;
  const daily = prior ? ((last - prior) / prior) * 100 : 0;
  const period = first ? ((last - first) / first) * 100 : 0;
  const values = points.map((p) => p.close);
  return { first, last, daily, period, min: Math.min(...values), max: Math.max(...values) };
}

function changeClass(value) {
  return value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
}

function signedPct(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
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
  return [...state.selected].map((key) => {
    const asset = ASSETS[key];
    const points = filteredPoints(key);
    const base = points[0]?.close || 1;
    return {
      label: asset.name,
      data: points.map((p) => ({ x: p.date, y: state.mode === "normalized" ? (p.close / base) * 100 : p.close })),
      borderColor: asset.color,
      backgroundColor: `${asset.color}22`,
      borderWidth: 2.2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.16,
      fill: false,
    };
  });
}

function renderChart() {
  const ctx = $("priceChart");
  const datasets = chartDatasets();
  if (state.chart) state.chart.destroy();

  state.chart = new Chart(ctx, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      animation: { duration: 260 },
      plugins: {
        legend: { labels: { color: "#dce7f2", usePointStyle: true, pointStyle: "circle", padding: 20 } },
        tooltip: {
          backgroundColor: "rgba(5, 14, 26, .95)",
          borderColor: "rgba(151,180,211,.28)",
          borderWidth: 1,
          padding: 12,
          callbacks: {
            label: (context) => {
              const key = [...state.selected][context.datasetIndex];
              const asset = ASSETS[key];
              return state.mode === "normalized"
                ? ` ${asset.name}: ${context.parsed.y.toFixed(2)}`
                : ` ${asset.name}: ${formatPrice(context.parsed.y, asset)} ${asset.unit}`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "time",
          time: { tooltipFormat: "yyyy-MM-dd" },
          grid: { color: "rgba(151,180,211,.08)" },
          ticks: { color: "#8fa4ba", maxRotation: 0 },
        },
        y: {
          grid: { color: "rgba(151,180,211,.1)" },
          ticks: {
            color: "#8fa4ba",
            callback: (value) => state.mode === "normalized" ? Number(value).toFixed(0) : Number(value).toLocaleString(),
          },
          title: {
            display: true,
            color: "#8fa4ba",
            text: state.mode === "normalized" ? "Index (Start = 100)" : "Price (USD)",
          },
        },
      },
    },
  });

  $("chartTitle").textContent = state.mode === "normalized" ? "區間相對表現" : "商品價格趨勢";
  const activePoints = [...state.selected].flatMap(filteredPoints);
  if (activePoints.length) {
    const dates = activePoints.map((p) => p.date).sort();
    $("chartRangeLabel").textContent = `${formatDate(new Date(dates[0] + "T00:00:00"))} — ${formatDate(new Date(dates.at(-1) + "T00:00:00"))}`;
  }
}

function renderAll() {
  renderCards();
  renderChart();
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
    document.querySelectorAll("#rangeButtons button").forEach((b) => b.classList.toggle("active", b === button));
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
    document.querySelectorAll("#rangeButtons button").forEach((b) => b.classList.remove("active"));
    renderAll();
  });
}

async function init() {
  try {
    const response = await fetch("data/commodities.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.raw = await response.json();
    $("updatedAt").textContent = state.raw.updated_at
      ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Taipei" }).format(new Date(state.raw.updated_at))
      : "—";
    $("demoBanner").classList.toggle("hidden", !state.raw.is_demo);
    renderAssetToggles();
    bindControls();
    renderAll();
  } catch (error) {
    console.error(error);
    document.body.innerHTML = `<main class="shell"><div class="notice">無法載入資料檔，請確認 data/commodities.json 是否存在。</div></main>`;
  }
}

init();
