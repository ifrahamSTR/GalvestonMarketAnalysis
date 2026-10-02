/**
 * Section 2 (revenue by bedroom size, screening signals) and Section 3
 * (location analysis by bedroom size). Every number comes from LOCATION
 * (region_data.js, generated from the overview notebook); prose and the
 * choice of rows come from data.js (LADDER_NOTE, DRIVER_ROWS, LOC_READS,
 * SIZE_GUIDE, MAP_CONFIG). Shared, unchanged, across market sites.
 *
 * "vs. typical" = a listing's revenue divided by the market median for its
 * bedroom size (1.00× = what a typical home that size earns). Cells resting
 * on fewer than THIN_N listings are muted and tagged "few homes".
 */
const THIN_N = 8;
const HIDE_N = 3;

function fewTag() {
  return ' <span class="tag-directional" title="Fewer than ' + THIN_N + ' listings">few homes</span>';
}
function idxClass(idx, n) {
  if (n < THIN_N) return "is-thin";
  if (idx >= 1.2) return "loc-hot";
  if (idx >= 1.07) return "loc-warm";
  if (idx <= 0.85) return "loc-cold";
  return "";
}
function locCell(c) {
  const homes = (n) => n + (n === 1 ? " home" : " homes");
  if (!c || c.n < HIDE_N) return '<td class="loc-cell is-empty"><span class="loc-cell__big">—</span><span class="loc-cell__sub">' + homes(c ? c.n : 0) + "</span></td>";
  return '<td class="loc-cell ' + idxClass(c.idx, c.n) + '"><span class="loc-cell__big">' + fmtK(c.median) + '</span><span class="loc-cell__sub">' +
    fmtX(c.idx) + " · " + homes(c.n) + (c.n < THIN_N ? fewTag() : "") + "</span></td>";
}

// ---------------------------------------------------------------------------
// Section 2 — revenue by bedroom size
// ---------------------------------------------------------------------------
function renderLadder() {
  const host = document.getElementById("size-ladder");
  if (!host) return;
  const L = LOCATION;
  let html = '<div class="table-scroll"><table class="data-table ladder-table"><thead><tr><th>Bedrooms</th><th>Listings</th><th>Median revenue</th><th>Middle half</th><th>Nightly rate</th><th>Occupancy</th><th>Sleeps</th><th>Top 10% listings</th></tr></thead><tbody>';
  L.ladder.forEach((r) => {
    html += '<tr><th scope="row">' + sizeLabel(r.size) + "</th><td>" + r.n + ' <span class="muted">(' + r.share + "%)</span></td><td><strong>" + fmtK(r.median) +
      "</strong></td><td>" + fmtK(r.p25) + "–" + fmtK(r.p75) + "</td><td>" + fmtCurrency(r.adr) + "</td><td>" + r.occ + "%</td><td>" + r.sleeps + "</td><td>" + r.top10N + "</td></tr>";
  });
  html += "</tbody></table></div>";
  host.innerHTML = html;
  const note = document.getElementById("size-ladder-note");
  if (note) note.innerHTML = typeof LADDER_NOTE === "function" ? LADDER_NOTE() : LADDER_NOTE;
}

// Section 2 — screening signals, each compared within the same bedroom size.
function renderDrivers() {
  const host = document.getElementById("drivers-table");
  if (!host) return;
  const byKey = {};
  LOCATION.drivers.forEach((d) => (byKey[d.driver] = d));
  let html = '<div class="table-scroll"><table class="data-table data-table--wrap"><thead><tr><th>Feature</th><th>Reach the top 25% for their size<br><span class="muted">with · without</span></th><th>Earn vs. a typical home their size<br><span class="muted">with · without</span></th><th>Listings with it</th><th>What it means</th></tr></thead><tbody>';
  DRIVER_ROWS.forEach((row) => {
    const d = byKey[row.key];
    if (!d) return;
    const thin = Math.min(d.nWith, d.nWithout) < 15;
    html += "<tr" + (thin ? ' class="is-thin"' : "") + '><th scope="row">' + row.label + (thin ? fewTag() : "") + "<span class=\"cell-sub\">" + row.group + "</span></th><td><strong>" + d.topWith + "%</strong> · " + d.topWithout +
      "%</td><td><strong>" + fmtX(d.idxWith) + "</strong> · " + fmtX(d.idxWithout) + "</td><td>" + d.nWith + '</td><td class="cell-note">' + row.note + "</td></tr>";
  });
  html += "</tbody></table></div>";
  host.innerHTML = html;
  const note = document.getElementById("drivers-note");
  if (note) note.innerHTML = DRIVERS_NOTE;
}

// ---------------------------------------------------------------------------
// Section 3 — location within size
// ---------------------------------------------------------------------------
function renderLocationIntro() {
  const m = document.getElementById("map-interpretation");
  if (m) m.innerHTML = MAP_CONFIG.marketInterpretation;
  const lede = document.getElementById("location-lede");
  if (lede) lede.innerHTML = MAP_CONFIG.lede;
}

// Bedroom size x the market's main location variable (the centerpiece).
function renderLocSizeTable() {
  const host = document.getElementById("loc-size-table");
  if (!host) return;
  const L = LOCATION;
  let html = '<div class="table-scroll"><table class="data-table loc-table"><thead><tr><th>Bedrooms</th>' +
    L.locs.map((l) => "<th>" + l + '<span class="cell-sub">' + L.locDef[l] + "</span></th>").join("") + "<th>What location does</th></tr></thead><tbody>";
  L.sizes.concat(["All sizes"]).forEach((s) => {
    const row = L.locSize[s];
    html += '<tr class="' + (s === "All sizes" ? "loc-total" : "") + '"><th scope="row">' + sizeLabel(s) + "</th>" + L.locs.map((l) => locCell(row[l])).join("") +
      '<td class="cell-note">' + (LOC_READS[s] || "") + "</td></tr>";
  });
  html += "</tbody></table></div>";
  host.innerHTML = html;
}

// Reference areas x bedroom size.
function renderAreaGrid() {
  const host = document.getElementById("area-grid");
  if (!host) return;
  const L = LOCATION;
  let html = '<div class="table-scroll"><table class="data-table loc-table area-grid"><thead><tr><th>Area</th>' + L.sizes.map((s) => "<th>" + sizeLabel(s) + "</th>").join("") +
    "<th>All sizes</th></tr></thead><tbody>";
  L.areas.forEach((a) => {
    html += '<tr><th scope="row"><span class="region-dot" style="background:' + a.color + '"></span>' + a.name + '<span class="cell-sub">' + a.sub + "</span></th>" +
      L.sizes.map((s) => locCell(a.bySize[s])).join("") + locCell({ n: a.n, median: a.medianRev, idx: a.idx }) + "</tr>";
  });
  html += "</tbody></table></div>";
  host.innerHTML = html;
  const note = document.getElementById("area-grid-note");
  if (note) note.innerHTML = typeof AREA_GRID_NOTE === "function" ? AREA_GRID_NOTE() : AREA_GRID_NOTE;
}

// Conclusion: one card per bedroom size.
function renderSizeGuide() {
  const host = document.getElementById("size-guide");
  if (!host) return;
  const L = LOCATION;
  host.innerHTML = '<div class="size-guide">' + L.sizes.map((s) => {
    const g = SIZE_GUIDE[s], lr = L.ladder.find((r) => r.size === s);
    return '<div class="size-card"><p class="size-card__size">' + sizeLabel(s) + ' <span>' + lr.n + " listings · median " + fmtK(lr.median) + "</span></p>" +
      '<h4 class="size-card__head">' + g.head + "</h4>" +
      '<dl><dt>Look</dt><dd>' + g.look + "</dd><dt>Avoid</dt><dd>" + g.avoid + "</dd></dl>" +
      (g.proof ? '<p class="size-card__proof">' + g.proof() + "</p>" : "") + "</div>";
  }).join("") + "</div>";
}

// Collapsed reference table (same numbers as the map popups).
function renderAreaTable() {
  const host = document.getElementById("area-table");
  if (!host) return;
  const L = LOCATION;
  let html = '<div class="table-scroll"><table class="data-table"><thead><tr><th>Area</th><th>Listings</th><th>Median revenue</th><th>vs. typical for size</th><th>Nightly rate</th><th>Occupancy</th><th>Top 10% listings</th><th>' +
    sizeLabel(L.sizes[0]) + " share</th><th>" + sizeLabel(L.sizes[L.sizes.length - 1]) + " share</th></tr></thead><tbody>";
  L.areas.forEach((a) => {
    html += '<tr><th scope="row"><span class="region-dot" style="background:' + a.color + '"></span>' + a.name + "</th><td>" + a.n + "</td><td>" + fmtCurrency(a.medianRev) +
      '</td><td class="' + (a.idx >= 1.1 ? "idx-up" : a.idx <= 0.9 ? "idx-down" : "") + '">' + fmtX(a.idx) + "</td><td>" + fmtCurrency(a.adr) + "</td><td>" + a.occ + "%</td><td>" + a.top10N +
      "</td><td>" + a.smallShare + "%</td><td>" + a.bigShare + "%</td></tr>";
  });
  html += "</tbody></table></div>";
  host.innerHTML = html;
}

function renderLocationSection() {
  renderLadder();
  renderDrivers();
  renderLocationIntro();
  renderLocSizeTable();
  renderAreaGrid();
  renderSizeGuide();
  renderAreaTable();
}

// Lookups used by data.js prose functions.
function locCellOf(size, loc) {
  return LOCATION.locSize[size][loc];
}
function areaCellOf(areaName, size) {
  const a = LOCATION.areas.find((x) => x.name === areaName);
  return a ? a.bySize[size] : null;
}
