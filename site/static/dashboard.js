function initGovDashboard(config) {
  const { dataElId, elIds, tableSelector, canvasId, containerId, dimField, series, pct, acumulado } = config;

  const DATA = JSON.parse(document.getElementById(dataElId).textContent);
  const elAnio = document.getElementById(elIds.anio);
  const elMes = document.getElementById(elIds.mes);
  const elDim = document.getElementById(elIds.dim);
  const elCmpAnio = document.getElementById(elIds.cmpAnio);
  const elCmpLimpiar = document.getElementById(elIds.cmpLimpiar);
  const elCmpAnioScope = document.getElementById(elIds.cmpAnioScope);
  const elCmpTotales = document.getElementById(elIds.cmpTotales);
  const tabla = document.querySelector(tableSelector);
  const thead = tabla.querySelector("thead");
  const tbody = tabla.querySelector("tbody");
  const defaultTheadHTML = thead.innerHTML;
  const canvas = document.getElementById(canvasId);
  const chartContainer = document.getElementById(containerId);

  const fmt = new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 });
  const seriesColor = (varName) =>
    getComputedStyle(document.querySelector(".viz-root")).getPropertyValue(varName).trim();
  const compareColor = (i) => seriesColor(`--series-${(i % 8) + 1}`);

  const MES_LABEL = new Map(DATA.map((r) => [r.mes_num, r.mes]));
  const MES_NUMS = [...MES_LABEL.keys()].sort((a, b) => a - b);

  let chart = null;

  function withPct(row) {
    if (!pct) return row;
    const denom = row[pct.denominatorKey];
    return { ...row, [pct.key]: denom ? (row[pct.numeratorKey] / denom) * 100 : 0 };
  }

  function aggregateByDim(rows) {
    const grouped = new Map();
    for (const r of rows) {
      const key = r[dimField];
      if (acumulado) {
        const acc = grouped.get(key);
        if (!acc || r.mes_num > acc.mes_num) grouped.set(key, r);
      } else {
        const acc = grouped.get(key) || Object.fromEntries([[dimField, key], ...series.map((s) => [s.key, 0])]);
        for (const s of series) acc[s.key] += r[s.key];
        grouped.set(key, acc);
      }
    }
    return [...grouped.values()]
      .map(withPct)
      .sort((a, b) => b[series[0].key] - a[series[0].key]);
  }

  function restoreThead() {
    thead.innerHTML = defaultTheadHTML;
  }

  function valuesFor(anio, dim, seriesKey) {
    const rows = DATA.filter((r) => r.anio === anio && (!dim || r[dimField] === dim));
    const byMes = new Map();
    for (const r of rows) byMes.set(r.mes_num, (byMes.get(r.mes_num) || 0) + r[seriesKey]);
    return MES_NUMS.map((n) => byMes.get(n) || 0);
  }

  function totalFor(anio, dim, seriesKey) {
    const rows = DATA.filter((r) => r.anio === anio && (!dim || r[dimField] === dim));
    if (!rows.length) return 0;
    if (!acumulado) return rows.reduce((sum, r) => sum + r[seriesKey], 0);
    const maxMes = Math.max(...rows.map((r) => r.mes_num));
    return rows
      .filter((r) => r.mes_num === maxMes)
      .reduce((sum, r) => sum + r[seriesKey], 0);
  }

  function totalesPorSerie(anio, dim) {
    return series.map((s) => ({ label: s.label, value: totalFor(anio, dim, s.key) }));
  }

  function renderCompareTotales(totalesMeta) {
    elCmpTotales.textContent = totalesMeta
      .map(
        (d) =>
          `${d.label} — ` +
          d.totales.map((t) => `${t.label}: ${fmt.format(t.value)}`).join(", ")
      )
      .join("    ·    ");
  }

  function renderCompareTable(lines, labels) {
    thead.innerHTML = "";
    const trHead = document.createElement("tr");
    const thMes = document.createElement("th");
    thMes.scope = "col";
    thMes.textContent = "Mes";
    trHead.appendChild(thMes);
    for (const l of lines) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = l.label;
      trHead.appendChild(th);
    }
    thead.appendChild(trHead);

    tbody.replaceChildren();
    labels.forEach((label, idx) => {
      const tr = document.createElement("tr");
      const tdMes = document.createElement("td");
      tdMes.textContent = label;
      tr.appendChild(tdMes);
      for (const l of lines) {
        const td = document.createElement("td");
        td.textContent = fmt.format(l.values[idx]);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
  }

  function renderCompareChart(lines, totalesMeta, tituloContexto) {
    const labels = MES_NUMS.map((n) => MES_LABEL.get(n));
    chartContainer.style.height = "380px";
    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: "line",
      data: {
        labels,
        datasets: lines.map((l) => ({
          label: l.label,
          data: l.values,
          borderColor: compareColor(l.colorIdx),
          backgroundColor: compareColor(l.colorIdx),
          borderDash: l.dash ? [6, 4] : [],
          borderWidth: 2,
          pointRadius: 2,
          tension: 0,
        })),
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: `Comparación por año — ${tituloContexto}`, color: seriesColor("--text-primary") },
          tooltip: { mode: "index", intersect: false, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmt.format(ctx.parsed.y)}` } },
        },
        interaction: { mode: "index", intersect: false },
        scales: {
          y: { ticks: { callback: (v) => fmt.format(v) }, grid: { color: seriesColor("--gridline") } },
          x: { grid: { display: false } },
        },
      },
    });
    renderCompareTable(lines, labels);
    renderCompareTotales(totalesMeta);
  }

  function renderTable(rows, labelKey) {
    restoreThead();
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
    const cmpAnios = [...elCmpAnio.querySelectorAll("input:checked")].map((i) => i.value);

    if (cmpAnios.length >= 2) {
      const scopeDim = elCmpAnioScope.value || null;
      const lineSeries = acumulado ? [series[series.length - 1]] : series;
      const lines = [];
      cmpAnios.forEach((a, yearIdx) => {
        lineSeries.forEach((s, serieIdx) => {
          lines.push({
            label: lineSeries.length > 1 ? `${a} — ${s.label}` : a,
            values: valuesFor(a, scopeDim, s.key),
            colorIdx: yearIdx,
            dash: serieIdx > 0,
          });
        });
      });
      const totalesMeta = cmpAnios.map((a) => ({ label: a, totales: totalesPorSerie(a, scopeDim) }));
      renderCompareChart(lines, totalesMeta, scopeDim || "todos");
      return;
    }

    elCmpTotales.textContent = "";
    let rows = DATA.filter((r) => r.anio === anio);

    if (dim) {
      restoreThead();
      renderTrend(rows.filter((r) => r[dimField] === dim).map(withPct), dim);
      elMes.disabled = true;
    } else {
      elMes.disabled = false;
      if (mes) rows = rows.filter((r) => r.mes === mes);
      restoreThead();
      renderBarByDim(aggregateByDim(rows));
    }
  }

  elCmpLimpiar.addEventListener("click", () => {
    for (const i of elCmpAnio.querySelectorAll("input")) i.checked = false;
    render();
  });

  for (const el of [elAnio, elMes, elDim, elCmpAnio, elCmpAnioScope]) {
    el.addEventListener("change", render);
  }
  render();
}
