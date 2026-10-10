/**
 * Map side panel: three tabs.
 *   Nearest comps: the selected property's nearest listings that pass the
 *     filters (revenue at least $90k by default), rank = distance order.
 *   Filters: apply to the dots and the nearest list; live count; kept in
 *     the URL hash so a view can be shared. "Match this property" presets
 *     projected bedrooms +/- 1, the same Town / West End zone and the same
 *     waterfront type, then every filter stays editable.
 *   Map layers: colour mode and layer toggles.
 */
/* global UWCsv */
(function () {
  const UW = window.UW;
  const P = (UW.panelApi = {});
  let root;

  UW.addComp = function (pid, label, l) {
    const p = UW.property(pid), v = p.versions.find((x) => x.label === label);
    if (v.comps.some((c) => UW.compId(c) === l.id)) { UW.toast("Already in the comp set"); return false; }
    if (v.comps.length >= 15) { UW.toast("The comp table holds 15 rows, the sheet's limit. Remove one first.", "warn"); return false; }
    UW.setComps(pid, label, v.comps.concat([UW.compFromListing(l)]));
    UW.toast("Added to the comp set for " + p.street);
    return true;
  };

  // Re-render a host and put keyboard focus back on the same control.
  function render(host, html) {
    UW.afterPointer(() => renderNow(host, html));
  }
  function renderNow(host, html) {
    const a = document.activeElement, key = a && host.contains(a) ? a.getAttribute("data-focus") : null;
    host.innerHTML = html;
    if (key) { const n = host.querySelector('[data-focus="' + CSS.escape(key) + '"]'); if (n) n.focus(); }
  }
  P.render = render;

  P.init = function () {
    root = document.getElementById("uw-panel");
    root.innerHTML =
      '<div class="uw-tabs" role="tablist" aria-label="Map panel">' +
      '<button type="button" role="tab" class="uw-tab" id="uw-t-comps" aria-controls="uw-p-comps" aria-selected="true">Nearest comps</button>' +
      '<button type="button" role="tab" class="uw-tab" id="uw-t-filters" aria-controls="uw-p-filters" aria-selected="false" tabindex="-1">Filters <span class="uw-tab__n" id="uw-filter-n"></span></button>' +
      '<button type="button" role="tab" class="uw-tab" id="uw-t-layers" aria-controls="uw-p-layers" aria-selected="false" tabindex="-1">Map layers</button></div>' +
      '<div class="uw-tabpanel" role="tabpanel" id="uw-p-comps" aria-labelledby="uw-t-comps"></div>' +
      '<div class="uw-tabpanel" role="tabpanel" id="uw-p-filters" aria-labelledby="uw-t-filters" hidden></div>' +
      '<div class="uw-tabpanel" role="tabpanel" id="uw-p-layers" aria-labelledby="uw-t-layers" hidden></div>';
    const tabs = [...root.querySelectorAll(".uw-tab")];
    const show = (t) => {
      tabs.forEach((x) => { const on = x === t; x.setAttribute("aria-selected", on); x.tabIndex = on ? 0 : -1; document.getElementById(x.getAttribute("aria-controls")).hidden = !on; });
    };
    P.showTab = (id) => show(document.getElementById("uw-t-" + id));
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => show(t));
      t.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
        show(n); n.focus();
      });
    });
    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    P.renderAll();
  };
  P.renderAll = function () { renderComps(); renderFilters(); renderLayers(); };

  // ---------------------------------------------------------------------------
  // Nearest comps
  // ---------------------------------------------------------------------------
  function renderComps() {
    const host = document.getElementById("uw-p-comps");
    const p = UW.ui.selected ? UW.property(UW.ui.selected) : null;
    if (!p) {
      const props = UW.properties().filter((x) => x.geo);
      render(host, '<p class="uw-panel__intro">Pick a property to see the Airbnb listings nearest to it that pass the filters (by default, revenue of at least ' + UW.fmt.money(UW.defaultFilters().minRev) +
        "). Click a house on the map, or choose one here:</p>" +
        '<div class="uw-quickpick">' + props.map((x) => {
          const low = UW.activeVersion(x).outputs.cases.low.coc;
          return '<button type="button" class="uw-quick" data-act="select" data-pid="' + UW.esc(x.id) + '" data-focus="q-' + UW.esc(x.id) + '"><span class="uw-dot" style="background:' + UW.COC_COLORS[UW.cocStatus(low)] + '"></span>' +
            UW.esc(x.street) + '<small>' + UW.esc(x.place ? x.place.areaName : "") + "</small></button>";
        }).join("") + "</div>");
      return;
    }
    const v = UW.activeVersion(p);
    const near = UW.nearest(p);
    const inSet = new Set(v.comps.map((c) => UW.compId(c)).filter(Boolean));
    const f = UW.ui.filters;
    const rows = near.slice().sort((a, b) => (UW.ui.sort === "revenue" ? b.l.revenue - a.l.revenue : a.d - b.d));
    const head =
      '<div class="uw-sel"><div class="uw-sel__top"><div><p class="uw-sel__kicker">' + (p.kind === "underwritten" ? "Underwritten" : "New listing") + (p.versions.length > 1 ? " · file " + UW.esc(v.label) : "") + "</p>" +
      '<h3 class="uw-sel__name">' + UW.esc(p.street) + "</h3>" +
      '<p class="uw-sel__meta">' + (p.place ? UW.esc(p.place.areaName) + " · " + UW.esc(p.place.loc) + " · " + UW.esc(p.place.zone) + " · waterfront: " + UW.esc({ "Bay-canal": "bay / canal", None: "none", "Gulf-front": "Gulf-front" }[p.waterfront] || p.waterfront) : "No map pin yet") + "</p></div>" +
      '<button type="button" class="uw-btn uw-btn--icon" data-act="clear" aria-label="Clear the selection" data-focus="clear">×</button></div>' +
      switcher(p) +
      '<div class="uw-sel__ctl">' +
      '<label>Nearest <input type="number" min="1" max="50" step="1" value="' + UW.ui.n + '" data-k="n" data-focus="n" inputmode="numeric"></label>' +
      '<label>within <input type="number" min="0.1" step="0.5" value="' + (UW.ui.radius == null ? "" : UW.ui.radius) + '" placeholder="any" data-k="radius" data-focus="radius" inputmode="decimal"> mi</label>' +
      '<label>revenue at least <span class="uw-money-in"><span>$</span><input type="number" min="0" step="5000" value="' + (f.minRev == null ? "" : f.minRev) + '" placeholder="any" data-k="minRev" data-focus="minRev2" inputmode="numeric"></span></label></div>' +
      '<div class="uw-sel__btns"><button type="button" class="uw-btn uw-btn--small" data-act="match" data-focus="match">Match this property</button>' +
      '<button type="button" class="uw-btn uw-btn--small uw-btn--ghost" data-act="reset" data-focus="reset">Reset filters</button>' +
      '<button type="button" class="uw-btn uw-btn--small uw-btn--ghost" data-act="card" data-focus="card">Open its card ↓</button></div>' +
      '<p class="uw-sel__count">' + UW.matchSet.size + " listings pass the filters" + (UW.countActiveFilters() ? ' (<button type="button" class="uw-linkbtn" data-act="filters">' + UW.countActiveFilters() + " set</button>)" : "") +
      "; " + (p.geo ? "showing the nearest " + near.length : "place a pin to rank them by distance") + ". " + v.comps.length + " of 15 comp rows used.</p>" +
      '<div class="uw-seg" role="group" aria-label="Sort the list"><button type="button" data-act="sort" data-v="distance" aria-pressed="' + (UW.ui.sort === "distance") + '" data-focus="sd">Nearest first</button>' +
      '<button type="button" data-act="sort" data-v="revenue" aria-pressed="' + (UW.ui.sort === "revenue") + '" data-focus="sr">Highest revenue first</button></div></div>';
    const body = !p.geo ? '<p class="uw-empty">This property has no map pin, so there is nothing to measure from. Use “Place pin” on its card.</p>' :
      !rows.length ? '<p class="uw-empty">No listing passes the filters' + (UW.ui.radius != null ? " within " + UW.ui.radius + " mi" : "") + ". Loosen a filter or raise the radius.</p>" :
      '<ol class="uw-near-list">' + rows.map((x) => nearRow(x, inSet.has(x.l.id), v.comps.length >= 15)).join("") + "</ol>";
    render(host, head + body);
  }

  // Step from one property to the next without going back to the list.
  function switcher(p) {
    const all = UW.properties();
    return '<div class="uw-switch"><button type="button" class="uw-btn uw-btn--icon" data-act="step" data-v="-1" aria-label="Previous property" data-focus="sw-prev">‹</button>' +
      '<select data-k="switch" aria-label="Go to another property" data-focus="sw-sel">' + all.map((x) => '<option value="' + UW.esc(x.id) + '"' + (x.id === p.id ? " selected" : "") + ">" +
        UW.esc(x.street) + (x.kind === "new" ? " (new listing)" : "") + "</option>").join("") + "</select>" +
      '<button type="button" class="uw-btn uw-btn--icon" data-act="step" data-v="1" aria-label="Next property" data-focus="sw-next">›</button>' +
      '<span class="uw-switch__n">' + (all.findIndex((x) => x.id === p.id) + 1) + " of " + all.length + "</span></div>";
  }

  function nearRow(x, inSet, full) {
    const l = x.l, a = UW.areaById[l.area];
    return '<li class="uw-near' + (inSet ? " is-in" : "") + '">' +
      '<button type="button" class="uw-near__rank" data-act="open" data-id="' + l.id + '" aria-label="Show listing ' + x.rank + ' on the map" data-focus="o' + l.id + '">' + x.rank + "</button>" +
      '<div class="uw-near__main"><a class="uw-near__title" href="' + UW.esc(l.url) + '" target="_blank" rel="noopener">' + UW.esc(l.title) + "</a>" +
      '<p class="uw-near__meta"><strong>' + UW.fmt.money(l.revenue) + "</strong> · " + UW.fmt.beds(l.bedrooms) + " · " + UW.fmt.num(l.baths) + " ba · sleeps " + UW.fmt.num(l.sleeps) +
      " · " + UW.fmt.money(l.adr) + "/night · " + UW.fmt.pct(l.occ, 0) + " occupied</p>" +
      '<p class="uw-near__meta2"><span class="uw-icons">' + UW.amenityIcons(l.flagSet) + "</span>" + UW.esc(l.loc) + ' · <span class="region-dot" style="background:' + a.color + '"></span>' + UW.esc(a.name) +
      " · <strong>" + UW.fmt.mi(x.d) + "</strong></p></div>" +
      '<div class="uw-near__act">' + (inSet ? '<span class="uw-inset" title="In the comp set">✓ In set</span><button type="button" class="uw-linkbtn" data-act="remove" data-id="' + l.id + '" data-focus="r' + l.id + '">remove</button>' :
        '<button type="button" class="uw-btn uw-btn--small' + (full ? '" disabled title="15 rows is the sheet\'s limit"' : '"') + ' data-act="add" data-id="' + l.id + '" data-focus="a' + l.id + '">+ Add</button>') + "</div></li>";
  }

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------
  const chip = (group, value, label, on, extra) => '<button type="button" class="uw-chip" aria-pressed="' + on + '" data-act="chip" data-g="' + group + '" data-v="' + UW.esc(value) + '" data-focus="c-' + group + "-" + UW.esc(value) + '">' + (extra || "") + UW.esc(label) + "</button>";
  function renderFilters() {
    const host = document.getElementById("uw-p-filters");
    const f = UW.ui.filters, C = UW.data.comps;
    const n = UW.countActiveFilters();
    document.getElementById("uw-filter-n").textContent = UW.matchSet.size;
    const p = UW.ui.selected ? UW.property(UW.ui.selected) : null;
    const am = UW.AMENITIES.map(([k, lab]) => {
      const v = f.am[k] || 0;
      const seg = [[0, "Any"], [1, "Must have"], [-1, "Exclude"]].map(([val, t]) => '<button type="button" data-act="am" data-k="' + k + '" data-v="' + val + '" aria-pressed="' + (v === val) + '" data-focus="am-' + k + val + '">' + t + "</button>").join("");
      return '<div class="uw-amrow"><span class="uw-amrow__l">' + UW.icon(k) + UW.esc(lab) + '</span><span class="uw-seg uw-seg--sm" role="group" aria-label="' + UW.esc(lab) + '">' + seg + "</span></div>";
    }).join("");
    const bedOpts = [[1, "Studio–1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"], [6, "6"], [7, "7+"]];
    render(host,
      '<p class="uw-fcount"><strong>' + UW.matchSet.size + "</strong> of " + UW.listings.length + " listings match" + (n ? " · " + n + " filter" + (n === 1 ? "" : "s") + " set" : "") + "</p>" +
      '<div class="uw-fbtns"><button type="button" class="uw-btn uw-btn--small" data-act="match" ' + (p ? "" : 'disabled title="Select a property first"') + ' data-focus="fmatch">Match ' + (p ? UW.esc(p.street) : "this property") + "</button>" +
      '<button type="button" class="uw-btn uw-btn--small uw-btn--ghost" data-act="reset" data-focus="freset">Reset</button></div>' +
      '<fieldset class="uw-fs"><legend>Revenue potential</legend><div class="uw-row2">' +
      '<label>At least <span class="uw-money-in"><span>$</span><input type="number" min="0" step="5000" value="' + (f.minRev == null ? "" : f.minRev) + '" placeholder="any" data-k="minRev" data-focus="minRev" inputmode="numeric"></span></label>' +
      '<label>At most <span class="uw-money-in"><span>$</span><input type="number" min="0" step="5000" value="' + (f.maxRev == null ? "" : f.maxRev) + '" placeholder="any" data-k="maxRev" data-focus="maxRev" inputmode="numeric"></span></label></div>' +
      '<p class="uw-fnote">Also the highlight threshold for nearest comps.</p></fieldset>' +
      '<fieldset class="uw-fs"><legend>Size</legend><p class="uw-flabel">Bedrooms</p><div class="uw-chips">' + bedOpts.map(([v, t]) => chip("beds", v, t, f.beds.includes(v))).join("") + "</div>" +
      '<div class="uw-row2"><label>Sleeps at least <input type="number" min="1" step="1" value="' + (f.minSleeps == null ? "" : f.minSleeps) + '" placeholder="any" data-k="minSleeps" data-focus="minSleeps" inputmode="numeric"></label>' +
      '<label>Baths at least <input type="number" min="1" step="0.5" value="' + (f.minBaths == null ? "" : f.minBaths) + '" placeholder="any" data-k="minBaths" data-focus="minBaths" inputmode="decimal"></label></div></fieldset>' +
      '<fieldset class="uw-fs"><legend>Amenities</legend>' + am + "</fieldset>" +
      '<fieldset class="uw-fs"><legend>Location</legend><p class="uw-flabel">Beach position</p><div class="uw-chips">' + C.locOrder.map((l) => chip("loc", l, l, f.loc.includes(l), '<span class="uw-dot" style="background:' + UW.LOC_COLORS[l] + '"></span>')).join("") + "</div>" +
      '<p class="uw-flabel">Town or West End</p><div class="uw-seg" role="group" aria-label="Town or West End">' + [["", "Either"], ["Town", "Town (behind the Seawall)"], ["West End", "West End"]].map(([v, t]) =>
        '<button type="button" data-act="zone" data-v="' + v + '" aria-pressed="' + (f.zone === v) + '" data-focus="z' + v + '">' + t + "</button>").join("") + "</div>" +
      '<p class="uw-flabel">Area</p><div class="uw-chips">' + UW.areas.map((a) => chip("area", a.id, a.name, f.area.includes(a.id), '<span class="uw-dot" style="background:' + a.color + '"></span>')).join("") + "</div></fieldset>" +
      '<fieldset class="uw-fs"><legend>Performance and data</legend><p class="uw-flabel">Against same-size homes</p><div class="uw-chips">' +
      [["top10", "Top 10%"], ["top25", "Top 11–25%"], ["rest", "Below the top 25%"]].map(([v, t]) => chip("sizeTop", v, t, f.sizeTop.includes(v), '<span class="uw-dot" style="background:' + UW.TIER_COLORS[v] + '"></span>')).join("") + "</div>" +
      '<p class="uw-flabel">Data quality</p><div class="uw-chips">' + [["Good", "Good"], ["Possibly Good", "Possibly good"]].map(([v, t]) => chip("quality", v, t, f.quality.includes(v))).join("") + "</div>" +
      '<p class="uw-flabel">Guest favourite</p><div class="uw-seg" role="group" aria-label="Guest favourite">' + [["", "Any"], ["yes", "Yes"], ["no", "No"]].map(([v, t]) =>
        '<button type="button" data-act="fav" data-v="' + v + '" aria-pressed="' + (f.fav === v) + '" data-focus="fv' + v + '">' + t + "</button>").join("") + "</div>" +
      (C.guestFavoriteAny ? "" : '<p class="uw-fnote">No listing in this workbook is flagged as a guest favourite, so “Yes” matches nothing.</p>') + "</fieldset>");
  }

  function renderLayers() {
    const host = document.getElementById("uw-p-layers"), Ly = UW.ui.layers;
    const radio = (v, t, sub) => '<label class="uw-radio"><input type="radio" name="uw-color" value="' + v + '"' + (UW.ui.colorBy === v ? " checked" : "") + ' data-k="colorBy" data-focus="col' + v + '"> <span>' + t + (sub ? "<small>" + sub + "</small>" : "") + "</span></label>";
    const tog = (k, t) => '<label class="uw-check"><input type="checkbox" data-layer="' + k + '"' + (Ly[k] ? " checked" : "") + ' data-focus="ly' + k + '"> ' + t + "</label>";
    render(host,
      '<fieldset class="uw-fs"><legend>Colour the Airbnb dots by</legend>' +
      radio("revenue", "Revenue potential", "Five bands, lightest under $60k") +
      radio("tier", "Against same-size homes", "Top 10% / top 11–25% / the rest, for its bedroom size") +
      radio("area", "Area", "The seven reference areas on the main page") +
      radio("loc", "Beach position", "Gulf-front, beach walk, bay or canal, inland") + "</fieldset>" +
      '<fieldset class="uw-fs"><legend>Show</legend>' + tog("uw", "Underwritten properties") + tog("newl", "New listings") + tog("areas", "Area outlines") + tog("labels", "Area names") +
      tog("shoreline", "Gulf shoreline (what “distance to the Gulf” is measured to)") + tog("ghosts", "Filtered-out listings, as faint grey dots") + "</fieldset>" +
      '<p class="uw-fnote">' + UW.listings.length + " entire homes from " + UW.esc(UW.data.comps.source.split(",")[0]) + ", snapshot " + UW.esc(UW.data.comps.snapshot) +
      ". Map pins on Airbnb are approximate, and whole complexes can share one pin.</p>");
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------
  function onClick(e) {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const act = b.dataset.act, f = UW.ui.filters;
    const p = UW.ui.selected ? UW.property(UW.ui.selected) : null;
    if (act === "select") UW.select(b.dataset.pid, { from: "panel" });
    else if (act === "clear") UW.select(null);
    else if (act === "step" && p) { const all = UW.properties(), i = all.findIndex((x) => x.id === p.id); UW.select(all[(i + +b.dataset.v + all.length) % all.length].id, { from: "panel" }); }
    else if (act === "match" && p) { UW.matchProperty(p); UW.toast("Filters set to match " + p.street + ". Edit any of them."); }
    else if (act === "reset") UW.resetFilters();
    else if (act === "filters") P.showTab("filters");
    else if (act === "card") UW.cardsApi.open(p.id, true);
    else if (act === "sort") { UW.ui.sort = b.dataset.v; UW.writeHash(); renderComps(); }
    else if (act === "open") UW.mapApi.openListing(b.dataset.id);
    else if (act === "add" && p) UW.addComp(p.id, UW.activeVersion(p).label, UW.byId.get(b.dataset.id));
    else if (act === "remove" && p) { const v = UW.activeVersion(p); UW.setComps(p.id, v.label, v.comps.filter((c) => UW.compId(c) !== b.dataset.id)); }
    else if (act === "chip") {
      const g = b.dataset.g, val = g === "beds" ? +b.dataset.v : b.dataset.v;
      const arr = f[g].includes(val) ? f[g].filter((x) => x !== val) : f[g].concat([val]);
      UW.setFilters({ [g]: arr });
    } else if (act === "am") {
      const am = Object.assign({}, f.am);
      const v = +b.dataset.v;
      if (v) am[b.dataset.k] = v; else delete am[b.dataset.k];
      UW.setFilters({ am });
    } else if (act === "zone") UW.setFilters({ zone: b.dataset.v });
    else if (act === "fav") UW.setFilters({ fav: b.dataset.v });
  }
  function onChange(e) {
    const t = e.target;
    if (t.dataset.layer) { UW.ui.layers[t.dataset.layer] = t.checked; UW.mapApi.layers(); return; }
    const k = t.dataset.k;
    if (!k) return;
    const val = t.value === "" ? null : Number(t.value);
    if (k === "switch") { UW.select(t.value, { from: "panel" }); return; }
    if (k === "colorBy") { UW.ui.colorBy = t.value; UW.writeHash(); UW.mapApi.refresh(); return; }
    if (k === "n") { UW.ui.n = Math.max(1, Math.min(50, Math.round(val || 12))); UW.writeHash(); UW.emit("near"); return; }
    if (k === "radius") { UW.ui.radius = val != null && val > 0 ? val : null; UW.writeHash(); UW.emit("near"); return; }
    if (["minRev", "maxRev", "minSleeps", "minBaths"].includes(k)) UW.setFilters({ [k]: val != null && val >= 0 ? val : null });
  }

  UW.on("filters", () => { renderFilters(); renderComps(); });
  UW.on("select", () => renderComps());
  UW.on("near", () => renderComps());
  UW.on("comps", () => renderComps());
  UW.on("property", () => renderComps());
  UW.on("listings", () => renderComps());
  UW.on("places", () => renderComps());
})();
