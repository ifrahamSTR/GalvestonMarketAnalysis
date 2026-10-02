/**
 * Chart.js charts: market revenue distribution (Section 2), median revenue by
 * location at each bedroom size (Section 3), and review composition
 * (Section 5). All data from region_data.js. Shared across market sites.
 */
const CHART_PALETTE = { bottom75: "#8b94a3", top25: "#075646", top10: "#d99132" };
const DEMOGRAPHICS_PALETTE = { kids: "#d99132", group: "#e0b34c", pet: "#075646", other: "#8b94a3" };
// One color per location band, strongest location first.
const LOC_PALETTE = ["#075646", "#5f9e8f", "#d99132", "#a8b2bd"];

Chart.defaults.font.family = "'Inter', 'Segoe UI', system-ui, sans-serif";
Chart.defaults.font.size = 13;
Chart.defaults.color = "#485a55";
// Long Chart.js titles get squeezed sideways on phones; split them instead.
const NARROW_CHARTS = typeof window !== "undefined" && window.innerWidth < 600;
function chartTitle(text, splitAt) {
  if (!NARROW_CHARTS) return text;
  const i = splitAt ? text.indexOf(splitAt) : text.lastIndexOf(" (");
  return i > 0 ? [text.slice(0, i).trim(), text.slice(i).replace(/^,\s*/, "").trim()] : text;
}

function renderRevenueDistributionChart() {
  const ctx = document.getElementById("chart-revenue-distribution");
  if (!ctx) return;
  const dist = REVENUE_DISTRIBUTION;
  const label = (b) => (b.overflow ? "$" + Math.round(b.binStart / 1000) + "k+" : "$" + Math.round(b.binStart / 1000) + "k");
  // Bars are stacked by market tier (counts from the notebook), so a bin that
  // straddles the P75 or P90 threshold is split rather than mis-coloured.
  const series = [["bottom75", "Bottom 75%", CHART_PALETTE.bottom75], ["top25", "Top 25%", CHART_PALETTE.top25], ["top10", "Top 10%", CHART_PALETTE.top10]];
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: dist.histogram.map(label),
      datasets: series.map(([k, name, color]) => ({ label: name, data: dist.histogram.map((b) => b[k]), backgroundColor: color, borderWidth: 0 })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: chartTitle("Market-wide Revenue Potential distribution (" + dist.totalCount + " listings)"), font: { size: 14, weight: "600" } },
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => { const b = dist.histogram[items[0].dataIndex]; return b.overflow ? "$" + Math.round(b.binStart / 1000) + "k and up" : "$" + Math.round(b.binStart / 1000) + "k–$" + Math.round(b.binEnd / 1000) + "k"; },
            label: (c) => (c.parsed.y ? c.dataset.label + ": " + c.parsed.y + " listings" : null),
          },
        },
      },
      scales: { x: { stacked: true, ticks: { maxRotation: 60, minRotation: 45 } }, y: { stacked: true, title: { display: true, text: "Listings" } } },
    },
  });
  const legend = document.getElementById("chart-revenue-distribution-legend");
  if (legend) {
    legend.innerHTML =
      '<span class="legend-row"><span class="legend-swatch" style="background:' + CHART_PALETTE.bottom75 + '"></span>Bottom 75% (below ' + fmtCurrency(dist.p75) + ")</span>" +
      '<span class="legend-row"><span class="legend-swatch" style="background:' + CHART_PALETTE.top25 + '"></span>Top 25% (' + fmtCurrency(dist.p75) + "–" + fmtCurrency(dist.p90) + ")</span>" +
      '<span class="legend-row"><span class="legend-swatch" style="background:' + CHART_PALETTE.top10 + '"></span>Top 10% (' + fmtCurrency(dist.p90) + "+)</span>";
  }
  const interp = document.getElementById("chart-revenue-distribution-interpretation");
  if (interp) interp.innerHTML = typeof DISTRIBUTION_NOTE === "function" ? DISTRIBUTION_NOTE() : DISTRIBUTION_NOTE;
}

// Section 3: median revenue by location band, grouped by bedroom size.
function renderLocSizeChart() {
  const ctx = document.getElementById("chart-loc-size");
  if (!ctx) return;
  const L = LOCATION;
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: L.sizes.map(sizeLabel),
      datasets: L.locs.map((l, i) => ({
        label: l,
        data: L.sizes.map((s) => { const c = L.locSize[s][l]; return c && c.n >= HIDE_N ? c.median : null; }),
        counts: L.sizes.map((s) => (L.locSize[s][l] || {}).n || 0),
        idx: L.sizes.map((s) => (L.locSize[s][l] || {}).idx),
        // Bars resting on fewer than THIN_N homes are faded, matching the table.
        backgroundColor: L.sizes.map((s) => { const c = L.locSize[s][l]; return c && c.n >= HIDE_N && c.n < THIN_N ? LOC_PALETTE[i % LOC_PALETTE.length] + "55" : LOC_PALETTE[i % LOC_PALETTE.length]; }),
        legendColor: LOC_PALETTE[i % LOC_PALETTE.length],
        borderWidth: 0,
        borderRadius: 3,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: chartTitle("Median revenue by " + L.locName.charAt(0).toLowerCase() + L.locName.slice(1) + ", within each bedroom size", ", within"), font: { size: 14, weight: "600" } },
        legend: {
          position: "bottom",
          labels: {
            generateLabels: (chart) => Chart.defaults.plugins.legend.labels.generateLabels(chart).map((it) => {
              const col = chart.data.datasets[it.datasetIndex].legendColor; return Object.assign(it, { fillStyle: col, strokeStyle: col });
            }),
          },
        },
        tooltip: {
          callbacks: {
            label: (c) => { const n = c.dataset.counts[c.dataIndex]; return c.dataset.label + ": " + fmtK(c.parsed.y) + " (" + fmtX(c.dataset.idx[c.dataIndex]) + " typical, " + n + " homes" + (n < THIN_N ? " – few homes" : "") + ")"; },
          },
        },
      },
      scales: { y: { title: { display: true, text: "Median Revenue Potential" }, ticks: { callback: (v) => "$" + v / 1000 + "k" } } },
    },
  });
}

function renderDemographicsPieChart() {
  const ctx = document.getElementById("chart-demographics-pie");
  if (!ctx) return;
  const m = DEMOGRAPHICS.marketWide;
  new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Stayed with kids", "Group trip", "Stayed with a pet", "Other"],
      datasets: [{ data: [m.kids, m.group, m.pet, m.other], backgroundColor: [DEMOGRAPHICS_PALETTE.kids, DEMOGRAPHICS_PALETTE.group, DEMOGRAPHICS_PALETTE.pet, DEMOGRAPHICS_PALETTE.other], borderWidth: 0 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: chartTitle("Average review composition — all listings (" + m.n + " listings)", " — "), font: { size: 14, weight: "600" } },
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: (c) => c.label + ": " + c.parsed + "%" } },
      },
    },
  });
}

function renderDemographicsStackedBarChart() {
  const ctx = document.getElementById("chart-demographics-bedroom");
  if (!ctx) return;
  const rows = DEMOGRAPHICS.byBedroom;
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: rows.map((r) => (NARROW_CHARTS ? sizeLabel(r.label).replace("–", "–\n").split("\n") : [sizeLabel(r.label), r.n + " listings"])),
      datasets: [
        { label: "Stayed with kids", data: rows.map((r) => r.kids), backgroundColor: DEMOGRAPHICS_PALETTE.kids },
        { label: "Group trip", data: rows.map((r) => r.group), backgroundColor: DEMOGRAPHICS_PALETTE.group },
        { label: "Stayed with a pet", data: rows.map((r) => r.pet), backgroundColor: DEMOGRAPHICS_PALETTE.pet },
        { label: "Other", data: rows.map((r) => r.other), backgroundColor: DEMOGRAPHICS_PALETTE.other },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: { display: true, text: "Guest composition by bedroom size", font: { size: 14, weight: "600" } },
        legend: { position: "bottom" },
        tooltip: { callbacks: { title: (items) => { const r = rows[items[0].dataIndex]; return sizeLabel(r.label) + " (" + r.n + " listings)"; }, label: (c) => c.dataset.label + ": " + c.parsed.y + "%" } },
      },
      scales: { x: { stacked: true, ticks: { maxRotation: 0, autoSkip: false, font: { size: NARROW_CHARTS ? 10 : 12 } } }, y: { stacked: true, title: { display: true, text: "% of reviews" }, max: 100 } },
    },
  });
}
