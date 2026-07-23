/* Keep Chart.js legend clicks synchronized with the dashboard asset state. */
(() => {
  if (typeof Chart === "undefined") return;

  function syncAssetToggleButtons() {
    if (typeof state === "undefined") return;

    document.querySelectorAll("#assetToggles button[data-asset]").forEach((button) => {
      const isSelected = state.selected.has(button.dataset.asset);
      button.classList.toggle("active", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    });
  }

  if (typeof chartDatasets === "function") {
    chartDatasets = function chartDatasetsWithPersistentLegend() {
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
    };
  }

  Chart.defaults.plugins.legend.onClick = (_event, legendItem, legend) => {
    if (typeof state === "undefined" || typeof renderAll !== "function") return;

    const dataset = legend.chart.data.datasets[legendItem.datasetIndex];
    const assetKey = dataset?.assetKey;
    if (!assetKey || !ASSETS[assetKey]) return;

    const isSelected = state.selected.has(assetKey);
    if (isSelected && state.selected.size === 1) return;

    if (isSelected) {
      state.selected.delete(assetKey);
    } else {
      state.selected.add(assetKey);
    }

    syncAssetToggleButtons();
    renderAll();
  };
})();
