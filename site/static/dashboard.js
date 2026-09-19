(function () {
  const DATA = JSON.parse(document.getElementById("datos-gastos").textContent);

  const elAnio = document.getElementById("f-anio");
  const elMes = document.getElementById("f-mes");
  const elSector = document.getElementById("f-sector");
  const tbody = document.querySelector("#tabla-presupuesto tbody");
  const canvas = document.getElementById("chart-presupuesto");
  const chartContainer = document.getElementById("chart-container");

  const fmtMoney = new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 });
  const seriesColor = (name) =>
    getComputedStyle(document.querySelector(".viz-root")).getPropertyValue(name).trim();

  let chart = null;

  function aggregateBySector(rows) {
    const bySector = new Map();
    for (const r of rows) {
      const acc = bySector.get(r.sector) || { sector: r.sector, apropiacion_vigente: 0, pagos: 0 };
      acc.apropiacion_vigente += r.apropiacion_vigente;
      acc.pagos += r.pagos;
      bySector.set(r.sector, acc);
    }
    return [...bySector.values()]
      .map((s) => ({ ...s, pct_pagado: s.apropiacion_vigente ? (s.pagos / s.apropiacion_vigente) * 100 : 0 }))
      .sort((a, b) => b.apropiacion_vigente - a.apropiacion_vigente);
  }

  function renderTable(rows, labelKey) {
    tbody.replaceChildren();
    for (const r of rows) {
      const tr = document.createElement("tr");
      const cells = [r[labelKey], fmtMoney.format(r.apropiacion_vigente), fmtMoney.format(r.pagos), r.pct_pagado.toFixed(1) + "%"];
      for (const value of cells) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
  }

  function renderBarBySector(rows) {
    const labels = rows.map((r) => r.sector);
    chartContainer.style.height = `${rows.length * 24 + 60}px`;
    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Apropiación vigente", data: rows.map((r) => r.apropiacion_vigente), backgroundColor: seriesColor("--series-1"), borderRadius: 4, barPercentage: 0.6 },
          { label: "Pagos", data: rows.map((r) => r.pagos), backgroundColor: seriesColor("--series-2"), borderRadius: 4, barPercentage: 0.6 },
        ],
      },
      options: {
        indexAxis: "y",
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { callback: (v) => fmtMoney.format(v) }, grid: { color: seriesColor("--gridline") } },
          y: { grid: { display: false }, ticks: { autoSkip: false, font: { size: 10 } } },
        },
        plugins: {
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtMoney.format(ctx.parsed.x)}` } },
        },
      },
    });
    renderTable(rows, "sector");
  }

  function renderTrend(rows, sector) {
    rows = [...rows].sort((a, b) => a.mes_num - b.mes_num);
    const labels = rows.map((r) => r.mes);
    chartContainer.style.height = "380px";
    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Apropiación vigente", data: rows.map((r) => r.apropiacion_vigente), borderColor: seriesColor("--series-1"), backgroundColor: seriesColor("--series-1"), borderWidth: 2, pointRadius: 4, tension: 0 },
          { label: "Pagos", data: rows.map((r) => r.pagos), borderColor: seriesColor("--series-2"), backgroundColor: seriesColor("--series-2"), borderWidth: 2, pointRadius: 4, tension: 0 },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: sector, color: seriesColor("--text-primary") },
          tooltip: { mode: "index", intersect: false, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtMoney.format(ctx.parsed.y)}` } },
        },
        interaction: { mode: "index", intersect: false },
        scales: {
          y: { ticks: { callback: (v) => fmtMoney.format(v) }, grid: { color: seriesColor("--gridline") } },
          x: { grid: { display: false } },
        },
      },
    });
    renderTable(rows, "mes");
  }

  function render() {
    const anio = elAnio.value;
    const mes = elMes.value;
    const sector = elSector.value;

    let rows = DATA.filter((r) => r.anio === anio);

    if (sector) {
      renderTrend(rows.filter((r) => r.sector === sector), sector);
      elMes.disabled = true;
    } else {
      elMes.disabled = false;
      if (mes) rows = rows.filter((r) => r.mes === mes);
      renderBarBySector(aggregateBySector(rows));
    }
  }

  for (const el of [elAnio, elMes, elSector]) el.addEventListener("change", render);
  render();
})();
