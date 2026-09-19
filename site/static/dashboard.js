function initGovDashboard(config) {
  const { dataElId, elIds, tableSelector, canvasId, containerId, dimField, series, pct } = config;

  const DATA = JSON.parse(document.getElementById(dataElId).textContent);
  const elAnio = document.getElementById(elIds.anio);
  const elMes = document.getElementById(elIds.mes);
  const elDim = document.getElementById(elIds.dim);
  const tbody = document.querySelector(`${tableSelector} tbody`);
  const canvas = document.getElementById(canvasId);
  const chartContainer = document.getElementById(containerId);

  const fmt = new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 });
  const seriesColor = (varName) =>
    getComputedStyle(document.querySelector(".viz-root")).getPropertyValue(varName).trim();

  let chart = null;

  function withPct(row) {
    if (!pct) return row;
    const denom = row[pct.denominatorKey];
    return { ...row, [pct.key]: denom ? (row[pct.numeratorKey] / denom) * 100 : 0 };
  }

  function aggregateByDim(rows) {
    const grouped = new Map();
    for (const r of rows) {
      const acc = grouped.get(r[dimField]) || Object.fromEntries([[dimField, r[dimField]], ...series.map((s) => [s.key, 0])]);
      for (const s of series) acc[s.key] += r[s.key];
      grouped.set(r[dimField], acc);
    }
    return [...grouped.values()]
      .map(withPct)
      .sort((a, b) => b[series[0].key] - a[series[0].key]);
  }

  function renderTable(rows, labelKey) {
    tbody.replaceChildren();
    for (const r of rows) {
      const tr = document.createElement("tr");
      const cells = [r[labelKey], ...series.map((s) => fmt.format(r[s.key]))];
      if (pct) cells.push(r[pct.key].toFixed(1) + "%");
      for (const value of cells) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }

  function renderBarByDim(rows) {
    const labels = rows.map((r) => r[dimField]);
    chartContainer.style.height = `${rows.length * 24 + 60}px`;
    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: series.map((s) => ({
          label: s.label,
          data: rows.map((r) => r[s.key]),
          backgroundColor: seriesColor(s.colorVar),
          borderRadius: 4,
          barPercentage: 0.6,
        })),
      },
      options: {
        indexAxis: "y",
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { callback: (v) => fmt.format(v) }, grid: { color: seriesColor("--gridline") } },
          y: { grid: { display: false }, ticks: { autoSkip: false, font: { size: 10 } } },
        },
        plugins: {
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt.format(ctx.parsed.x)}` } },
        },
      },
    });
    renderTable(rows, dimField);
  }

  function renderTrend(rows, dimValue) {
    rows = [...rows].sort((a, b) => a.mes_num - b.mes_num);
    const labels = rows.map((r) => r.mes);
    chartContainer.style.height = "380px";
    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: series.map((s) => ({
          label: s.label,
          data: rows.map((r) => r[s.key]),
          borderColor: seriesColor(s.colorVar),
          backgroundColor: seriesColor(s.colorVar),
          borderWidth: 2,
          pointRadius: 4,
          tension: 0,
        })),
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: dimValue, color: seriesColor("--text-primary") },
          tooltip: { mode: "index", intersect: false, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt.format(ctx.parsed.y)}` } },
        },
        interaction: { mode: "index", intersect: false },
        scales: {
          y: { ticks: { callback: (v) => fmt.format(v) }, grid: { color: seriesColor("--gridline") } },
          x: { grid: { display: false } },
        },
      },
    });
    renderTable(rows, "mes");
  }

  function render() {
    const anio = elAnio.value;
    const mes = elMes.value;
    const dim = elDim.value;

    let rows = DATA.filter((r) => r.anio === anio);

    if (dim) {
      renderTrend(rows.filter((r) => r[dimField] === dim).map(withPct), dim);
      elMes.disabled = true;
    } else {
      elMes.disabled = false;
      if (mes) rows = rows.filter((r) => r.mes === mes);
      renderBarByDim(aggregateByDim(rows));
    }
  }

  for (const el of [elAnio, elMes, elDim]) el.addEventListener("change", render);
  render();
}
