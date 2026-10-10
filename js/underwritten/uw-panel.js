/**
 * Map side panel. Acquisition targets are the Zillow houses being bought;
 * Airbnb comps are only workbook (Cleaned_Data) entire homes.
 *   Targets: every target, underwritten and new, with its Zillow link, price,
 *     low-case cash on cash, comp-error badge and a "no pin" tag.
 *   Airbnb comps: the selected target's header (Zillow link, key numbers),
 *     "Match this property" applied as removable chips, and either its nearest
 *     comps or every comp passing the filters. Rows can be ticked, copied as
 *     sheet rows (always revenue high -> low) or added to the comp set.
 *   Filters / Map layers.
 */
(function () {
  const UW = window.UW, F = UW.fmt, E = UW.esc;
  const P = (UW.panelApi = {});
  const CAP = 50;
  let root, editingNote = null;

  UW.addComp = (pid, label, l) => UW.actions.addComps(pid, label, [l]) > 0;

  // Re-render a host (after any click in flight) and put keyboard focus back on the same control.
  function render(host, html) { UW.afterPointer(() => renderNow(host, html)); }
  function renderNow(host, html) {
    const a = document.activeElement, key = a && host.contains(a) ? a.getAttribute("data-focus") : null;
    const top = host.scrollTop;
    host.innerHTML = html;
    host.scrollTop = top;
    if (key) { const n = host.querySelector('[data-focus="' + CSS.escape(key) + '"]'); if (n) n.focus(); }
  }
  P.render = render;

  P.init = function () {
    root = document.getElementById("uw-panel");
    const tab = (id, label, extra) => '<button type="button" role="tab" class="uw-tab" id="uw-t-' + id + '" aria-controls="uw-p-' + id + '" aria-selected="false" tabindex="-1">' + label + (extra || "") + "</button>";
    root.innerHTML = '<div class="uw-tabs" role="tablist" aria-label="Map panel">' + tab("targets", "Targets") + tab("comps", "Airbnb comps") +
      tab("filters", "Filters", ' <span class="uw-tab__n" id="uw-filter-n"></span>') + tab("layers", "Layers") + "</div>" +
      ["targets", "comps", "filters", "layers"].map((id) => '<div class="uw-tabpanel" role="tabpanel" id="uw-p-' + id + '" aria-labelledby="uw-t-' + id + '" hidden></div>').join("");
    const tabs = [...root.querySelectorAll(".uw-tab")];
    const show = (t) => tabs.forEach((x) => { const on = x === t; x.setAttribute("aria-selected", on); x.tabIndex = on ? 0 : -1; document.getElementById(x.getAttribute("aria-controls")).hidden = !on; });
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
    root.addEventListener("input", onInput);
    P.showTab(UW.ui.selected ? "comps" : "targets");
    P.renderAll();
  };
  P.renderAll = function () { renderTargets(); renderComps(); renderFilters(); renderLayers(); };

  // ---------------------------------------------------------------------------
  // Shared bits
  // ---------------------------------------------------------------------------
  const zillow = (p, cls) => (p.url ? '<a class="uw-zl' + (cls ? " " + cls : "") + '" href="' + E(p.url) + '" target="_blank" rel="noopener" aria-label="Open the Zillow listing for ' + E(p.street) + ' (new tab)">Zillow ↗</a>' : "");
  UW.zillowLink = zillow;
  UW.errorBadge = (v) => { const n = UW.compErrors(v).length; return n ? '<span class="uw-badge uw-badge--err" title="Rows in the comp table that are not Cleaned_Data entire homes">' + n + " comp error" + (n === 1 ? "" : "s") + "</span>" : ""; };
  UW.targetBadges = function (p, v) {
    const rev = v.inputs.revenue || {}, price = v.inputs.price, low = v.outputs.cases.low.coc;
    const ratio = price && UW.isNum(rev.mid) ? rev.mid / price : null, st = UW.cocStatus(low);
    return UW.errorBadge(v) +
      (ratio == null ? '<span class="uw-badge uw-badge--none">Mid revenue not set</span>' : '<span class="uw-badge uw-badge--' + (ratio >= UW.SCREEN ? "good" : "warn") + '">' + (ratio >= UW.SCREEN ? "✓ " : "") + F.pct(ratio, 1) + " of price · 20% screen</span>") +
      (UW.isNum(low) ? '<span class="uw-badge uw-badge--' + st + '">' + (st === "good" ? "✓ " : "") + "Low case " + F.pct(low) + " vs 4%</span>" : "");
  };

  // ---------------------------------------------------------------------------
  // Targets
  // ---------------------------------------------------------------------------
  function renderTargets() {
    const host = document.getElementById("uw-p-targets");
    const all = UW.properties();
    const row = (p) => {
      const v = UW.activeVersion(p), low = v.outputs.cases.low.coc;
      return '<li class="uw-trow' + (p.id === UW.ui.selected ? " is-sel" : "") + '">' +
        '<button type="button" class="uw-trow__main" data-act="select" data-pid="' + E(p.id) + '" data-focus="t-' + E(p.id) + '"><span class="uw-dot" style="background:' + UW.COC_COLORS[UW.cocStatus(low)] + '"></span>' +
        '<span class="uw-trow__name">' + E(p.street) + "</span>" +
        '<span class="uw-trow__meta">' + F.money(v.inputs.price) + " · low case " + F.pct(low) + (p.versions.length > 1 ? " · " + E(UW.scenarioName(v)) : "") + (p.place ? " · " + E(p.place.areaName) : "") + "</span></button>" +
        '<span class="uw-trow__side">' + UW.errorBadge(v) + (p.geo ? "" : '<span class="uw-tag uw-tag--nopin">no pin</span>') + zillow(p) + "</span></li>";
    };
    const uw = all.filter((p) => p.kind !== "new"), nl = all.filter((p) => p.kind === "new");
    render(host, '<p class="uw-panel__intro">Acquisition targets: the houses being underwritten. Pick one to rank its nearest Airbnb comps.</p>' +
      '<p class="uw-tgroup">Underwritten <span class="uw-count">' + uw.length + '</span></p><ul class="uw-tlist">' + uw.map(row).join("") + "</ul>" +
      '<p class="uw-tgroup">New listings <span class="uw-count">' + nl.length + '</span></p>' + (nl.length ? '<ul class="uw-tlist">' + nl.map(row).join("") + "</ul>" :
        '<p class="uw-empty">None yet. <button type="button" class="uw-linkbtn" data-act="add-listing">Add a Zillow listing</button></p>'));
  }

  // ---------------------------------------------------------------------------
  // Airbnb comps
  // ---------------------------------------------------------------------------
  function chips() {
    const f = UW.ui.filters, out = [];
    const chip = (key, text, val) => out.push('<span class="uw-fchip">' + E(text) + '<button type="button" data-act="unchip" data-k="' + key + '"' + (val != null ? ' data-v="' + E(val) + '"' : "") + ' aria-label="Remove filter: ' + E(text) + '">×</button></span>');
    if (f.minRev != null) chip("minRev", "Revenue ≥ " + F.k(f.minRev));
    if (f.maxRev != null) chip("maxRev", "Revenue ≤ " + F.k(f.maxRev));
    if (f.beds.length) { const b = f.beds.slice().sort((a, c) => a - c), lab = (x) => (x === 1 ? "Studio–1" : x === 7 ? "7+" : String(x)); chip("beds", (b.length > 1 && b[b.length - 1] - b[0] === b.length - 1 ? lab(b[0]) + "–" + lab(b[b.length - 1]) : b.map(lab).join(", ")) + " BR"); }
    if (f.minSleeps != null) chip("minSleeps", "Sleeps ≥ " + f.minSleeps);
    if (f.minBaths != null) chip("minBaths", "Baths ≥ " + f.minBaths);
    Object.entries(f.am).forEach(([k, v]) => { if (v) chip("am", (UW.AMEN_LABEL[k] || k) + ": " + (v === 1 ? "must have" : "exclude"), k); });
    if (f.zone) chip("zone", f.zone);
    if (f.loc.length) chip("loc", f.loc.join(" or "));
    if (f.area.length) chip("area", f.area.map((a) => UW.areaById[a].name).join(", "));
    if (f.sizeTop.length) chip("sizeTop", f.sizeTop.map((x) => UW.TIER_LABEL[x]).join(", "));
    if (f.quality.length) chip("quality", "Data: " + f.quality.join(", "));
    if (f.fav) chip("fav", "Guest favourite: " + f.fav);
    return out.join("");
  }

  function shownListings(p) {
    if (UW.ui.compsView === "nearest" && p && p.geo) {
      const near = UW.nearest(p);
      return near.slice().sort((a, b) => (UW.ui.sort === "revenue" ? b.l.revenue - a.l.revenue || b.l.adr - a.l.adr : a.d - b.d));
    }
    const all = UW.listings.filter((l) => UW.matchSet.has(l.id)).sort((a, b) => b.revenue - a.revenue || b.adr - a.adr);
    return all.slice(0, CAP).map((l, i) => ({ l, d: p && p.geo ? UW.geoMiles(p.geo, l) : null, rank: i + 1 }));
  }
  P.shownListings = () => shownListings(UW.ui.selected ? UW.property(UW.ui.selected) : null).map((x) => x.l);

  function renderComps() {
    const host = document.getElementById("uw-p-comps");
    const p = UW.ui.selected ? UW.property(UW.ui.selected) : null;
    if ((!p || !p.geo) && UW.ui.compsView === "nearest") UW.ui.compsView = "filtered";
    let head = "";
    if (p) {
      const v = UW.activeVersion(p), o = v.outputs, t = v.target, rev = v.inputs.revenue || {};
      const all = UW.properties(), idx = all.findIndex((x) => x.id === p.id);
      head = '<div class="uw-sel"><div class="uw-sel__top"><div class="uw-sel__id"><p class="uw-sel__kicker">Acquisition target' + (p.versions.length > 1 ? " · " + E(UW.scenarioName(v)) : "") + (p.kind !== "underwritten" ? " · new listing" : "") + "</p>" +
        '<h3 class="uw-sel__name">' + E(p.street) + "</h3>" + zillow(p, "uw-zl--big") + "</div>" +
        '<button type="button" class="uw-btn uw-btn--icon" data-act="clear" aria-label="Clear the selection" data-focus="clear">×</button></div>' +
        '<p class="uw-sel__meta"><strong>' + F.money(v.inputs.price) + "</strong> · target " + F.num(t.beds) + " bd / " + F.num(t.baths) + " ba" + (t.sleeps ? " / sleeps " + t.sleeps : "") +
        (p.place ? " · " + E(p.place.areaName) + " · " + E(p.place.loc) + " · " + E(p.place.zone) : " · no map pin yet") + "</p>" +
        '<p class="uw-sel__kpi"><span>Revenue <b>' + ["low", "mid", "high"].map((c) => F.k(rev[c])).join(" · ") + "</b></span><span>Cash on cash <b>" +
        ["low", "mid", "high"].map((c) => '<span class="uw-coc--' + UW.cocStatus(o.cases[c].coc) + '">' + F.pct(o.cases[c].coc) + "</span>").join(" · ") + "</b></span></p>" +
        '<div class="uw-head__badges">' + UW.targetBadges(p, v) + "</div>" +
        '<div class="uw-switch"><button type="button" class="uw-btn uw-btn--icon" data-act="step" data-v="-1" aria-label="Previous target" data-focus="sw-prev">‹</button>' +
        '<select data-k="switch" aria-label="Go to another target" data-focus="sw-sel">' + all.map((x) => '<option value="' + E(x.id) + '"' + (x.id === p.id ? " selected" : "") + ">" + E(x.street) + (x.kind === "new" ? " (new listing)" : "") + "</option>").join("") + "</select>" +
        '<button type="button" class="uw-btn uw-btn--icon" data-act="step" data-v="1" aria-label="Next target" data-focus="sw-next">›</button><span class="uw-switch__n">' + (idx + 1) + " of " + all.length + "</span></div>" +
        '<div class="uw-btnrow"><button type="button" class="uw-btn uw-btn--small uw-btn--ghost" data-act="card" data-focus="card">Open its card ↓</button>' +
        '<button type="button" class="uw-btn uw-btn--small uw-btn--ghost" data-act="copy-comps" data-focus="cc">Copy its comp set</button></div></div>' +
        '<div class="uw-match"><label class="uw-check uw-check--inline"><input type="checkbox" data-k="matchZoneWater"' + (UW.ui.matchZoneWater ? " checked" : "") + ' data-focus="mzw"> Same zone &amp; water type</label>' +
        (UW.ui.pure ? '<button type="button" class="uw-linkbtn" data-act="rematch">Match this property again</button>' : '<button type="button" class="uw-linkbtn" data-act="pure" data-focus="pure">Show pure nearest</button>') +
        '<div class="uw-fchips">' + (chips() || '<span class="muted">No filters: plain straight-line nearest.</span>') + "</div></div>";
    } else {
      head = '<p class="uw-panel__intro">No target selected. Pick one in <button type="button" class="uw-linkbtn" data-act="tab-targets">Targets</button> to rank its nearest comps, or copy from every Airbnb comp that passes the filters.</p>' +
        '<div class="uw-fchips">' + chips() + "</div>";
    }
    const f = UW.ui.filters;
    const ctl = p ? '<div class="uw-sel__ctl"><label>Nearest <input type="number" min="1" max="50" step="1" value="' + UW.ui.n + '" data-k="n" data-focus="n" inputmode="numeric"></label>' +
      '<label>within <input type="number" min="0.1" step="0.5" value="' + (UW.ui.radius == null ? "" : UW.ui.radius) + '" placeholder="any" data-k="radius" data-focus="radius" inputmode="decimal"> mi</label>' +
      '<label>revenue ≥ <span class="uw-money-in"><span>$</span><input type="number" min="0" step="5000" value="' + (f.minRev == null ? "" : f.minRev) + '" placeholder="any" data-k="minRev" data-focus="minRev2" inputmode="numeric"></span></label></div>' : "";
    const view = '<div class="uw-seg uw-seg--wide" role="group" aria-label="Which comps">' +
      '<button type="button" data-act="view" data-v="nearest" aria-pressed="' + (UW.ui.compsView === "nearest") + '"' + (p && p.geo ? "" : " disabled") + ' data-focus="vn">Nearest to the target</button>' +
      '<button type="button" data-act="view" data-v="filtered" aria-pressed="' + (UW.ui.compsView === "filtered") + '" data-focus="vf">All filtered · ' + UW.matchSet.size + "</button></div>";
    const rows = shownListings(p);
    const v = p && UW.activeVersion(p);
    const inSet = new Set(v ? v.comps.map((c) => UW.compId(c)).filter(Boolean) : []);
    const picked = [...UW.ui.picked].filter((id) => UW.byId.has(id));
    const filtered = UW.ui.compsView === "filtered";
    const tools = '<div class="uw-picktools"><button type="button" class="uw-btn uw-btn--small uw-btn--ghost" data-act="pickall" data-focus="pa">Select all shown</button>' +
      '<button type="button" class="uw-btn uw-btn--small uw-btn--ghost" data-act="pickclear"' + (picked.length ? "" : " disabled") + ' data-focus="pc">Clear</button>' +
      '<span class="uw-picktools__n" id="uw-pick-n">' + picked.length + " selected</span>" +
      '<button type="button" class="uw-btn uw-btn--small uw-btn--primary" data-act="copypicked"' + (picked.length ? "" : " disabled") + ' data-focus="cp">Copy selected</button>' +
      (p ? '<button type="button" class="uw-btn uw-btn--small" data-act="addpicked"' + (picked.length ? "" : " disabled") + ' data-focus="ap">Add selected to comp set</button>' : "") +
      (filtered ? '<button type="button" class="uw-btn uw-btn--small uw-btn--ghost" data-act="copyall"' + (rows.length ? "" : " disabled") + ' data-focus="ca">Copy all shown (' + rows.length + ")</button>" : "") + "</div>" +
      '<p class="uw-hint">Copies are the sheet’s 15 columns, tab-separated, no header, always revenue high to low. Notes are filled from the workbook; edit one with ✎ (kept for this session).' +
      (filtered ? " " + (UW.matchSet.size > CAP ? "Showing the top " + CAP + " of " + UW.matchSet.size + " by revenue; “Copy all shown” is capped at " + CAP + " rows." : "Showing all " + UW.matchSet.size + ", highest revenue first.") : "") + "</p>" +
      (!filtered && p && p.geo ? '<div class="uw-seg" role="group" aria-label="Order the list"><button type="button" data-act="sort" data-v="distance" aria-pressed="' + (UW.ui.sort === "distance") + '" data-focus="sd">Nearest first</button>' +
        '<button type="button" data-act="sort" data-v="revenue" aria-pressed="' + (UW.ui.sort === "revenue") + '" data-focus="sr">Highest revenue first</button></div>' : "");
    const body = !rows.length ? '<p class="uw-empty">No Airbnb comp passes the filters' + (UW.ui.radius != null && !filtered ? " within " + UW.ui.radius + " mi" : "") + ". Remove a chip or raise the radius.</p>" :
      '<ol class="uw-near-list">' + rows.map((x) => nearRow(x, p, inSet.has(x.l.id), v && v.comps.length >= 15)).join("") + "</ol>";
    render(host, head + (p && !p.geo ? '<p class="uw-empty">This target has no map pin, so “nearest” can’t be measured yet. Place it on the map first.</p>' : "") + ctl + view + tools + body);
  }

  function nearRow(x, p, inSet, full) {
    const l = x.l, a = UW.areaById[l.area], picked = UW.ui.picked.has(l.id);
    const note = UW.noteFor(l, p);
    const noteHtml = editingNote === l.id ?
      '<span class="uw-note uw-note--edit"><input type="text" value="' + E(note) + '" data-note="' + l.id + '" aria-label="Note for ' + E(l.title) + '" data-focus="ne' + l.id + '">' +
      '<button type="button" class="uw-linkbtn" data-act="note-done" data-id="' + l.id + '">done</button><button type="button" class="uw-linkbtn" data-act="note-reset" data-id="' + l.id + '">reset</button></span>' :
      '<span class="uw-note"><span class="uw-note__t">' + E(note) + "</span>" + (UW.noteEdited(l, p) ? '<span class="uw-tag uw-tag--edit">edited</span>' : "") +
      '<button type="button" class="uw-linkbtn" data-act="note-edit" data-id="' + l.id + '" aria-label="Edit the note for ' + E(l.title) + '" data-focus="nb' + l.id + '">✎</button></span>';
    return '<li class="uw-near' + (inSet ? " is-in" : "") + (picked ? " is-picked" : "") + '">' +
      '<span class="uw-near__pick"><input type="checkbox" data-pick="' + l.id + '"' + (picked ? " checked" : "") + ' aria-label="Select ' + E(l.title) + '" data-focus="pk' + l.id + '">' +
      '<button type="button" class="uw-near__rank" data-act="open" data-id="' + l.id + '" aria-label="Show listing ' + x.rank + ' on the map" data-focus="o' + l.id + '">' + x.rank + "</button></span>" +
      '<div class="uw-near__main"><a class="uw-near__title" href="' + E(l.url) + '" target="_blank" rel="noopener">' + E(l.title) + "</a>" +
      '<p class="uw-near__meta"><strong>' + F.money(l.revenue) + "</strong> · " + F.beds(l.bedrooms) + " · " + F.num(l.baths) + " ba · sleeps " + F.num(l.sleeps) +
      " · " + F.money(l.adr) + "/night · " + F.pct(l.occ, 0) + " occupied" + (l.quality === "Possibly Good" ? ' · <span class="uw-tag uw-tag--possibly">possibly good</span>' : "") + "</p>" +
      '<p class="uw-near__meta2"><span class="uw-icons">' + UW.amenityIcons(l.flagSet) + "</span>" + E(l.loc) + ' · <span class="region-dot" style="background:' + a.color + '"></span>' + E(a.name) +
      (x.d != null ? " · <strong>" + F.mi(x.d) + "</strong>" : "") + "</p>" + noteHtml + "</div>" +
      '<div class="uw-near__act">' + (p ? (inSet ? '<span class="uw-inset" title="In the comp set">✓ In set</span><button type="button" class="uw-linkbtn" data-act="remove" data-id="' + l.id + '" data-focus="r' + l.id + '">remove</button>' :
        '<button type="button" class="uw-btn uw-btn--small' + (full ? '" disabled title="15 rows is the sheet\'s limit"' : '"') + ' data-act="add" data-id="' + l.id + '" data-focus="a' + l.id + '">+ Add</button>') : "") +
      '<button type="button" class="uw-linkbtn" data-act="copyrow" data-id="' + l.id + '" data-focus="cr' + l.id + '">Copy row</button></div></li>';
  }

  // ---------------------------------------------------------------------------
  // Filters
  // ---------------------------------------------------------------------------
  const chip = (group, value, label, on, extra) => '<button type="button" class="uw-chip" aria-pressed="' + on + '" data-act="chip" data-g="' + group + '" data-v="' + E(value) + '" data-focus="c-' + group + "-" + E(value) + '">' + (extra || "") + E(label) + "</button>";
  function renderFilters() {
    const host = document.getElementById("uw-p-filters");
    const f = UW.ui.filters, C = UW.data.comps;
    const n = UW.countActiveFilters();
    document.getElementById("uw-filter-n").textContent = UW.matchSet.size;
    const p = UW.ui.selected ? UW.property(UW.ui.selected) : null;
    const am = UW.AMENITIES.map(([k, lab]) => {
      const v = f.am[k] || 0;
      const seg = [[0, "Any"], [1, "Must have"], [-1, "Exclude"]].map(([val, t]) => '<button type="button" data-act="am" data-k="' + k + '" data-v="' + val + '" aria-pressed="' + (v === val) + '" data-focus="am-' + k + val + '">' + t + "</button>").join("");
      return '<div class="uw-amrow"><span class="uw-amrow__l">' + UW.icon(k) + E(lab) + '</span><span class="uw-seg uw-seg--sm" role="group" aria-label="' + E(lab) + '">' + seg + "</span></div>";
    }).join("");
    const bedOpts = [[1, "Studio–1"], [2, "2"], [3, "3"], [4, "4"], [5, "5"], [6, "6"], [7, "7+"]];
    render(host,
      '<p class="uw-fcount"><strong>' + UW.matchSet.size + "</strong> of " + UW.listings.length + " Airbnb comps match" + (n ? " · " + n + " filter" + (n === 1 ? "" : "s") + " set" : "") + "</p>" +
      '<div class="uw-fbtns"><button type="button" class="uw-btn uw-btn--small" data-act="match" ' + (p ? "" : 'disabled title="Select a target first"') + ' data-focus="fmatch">Match ' + (p ? E(p.street) : "this property") + "</button>" +
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
      '<fieldset class="uw-fs"><legend>Colour the Airbnb comps by</legend>' +
      radio("revenue", "Revenue potential", "Five bands, lightest under $60k") +
      radio("tier", "Against same-size homes", "Top 10% / top 11–25% / the rest, for its bedroom size") +
      radio("area", "Area", "The seven reference areas on the main page") +
      radio("loc", "Beach position", "Gulf-front, beach walk, bay or canal, inland") + "</fieldset>" +
      '<fieldset class="uw-fs"><legend>Show</legend>' + tog("uw", "Acquisition targets: underwritten") + tog("newl", "Acquisition targets: new listings") + tog("areas", "Area outlines") + tog("labels", "Area names") +
      tog("shoreline", "Gulf shoreline (what “distance to the Gulf” is measured to)") + tog("ghosts", "Filtered-out comps, as faint grey dots") + "</fieldset>" +
      '<p class="uw-fnote">' + UW.listings.length + " Airbnb entire homes from " + E(UW.data.comps.source.split(",")[0]) + " (Cleaned_Data), snapshot " + E(UW.data.comps.snapshot) +
      ". Airbnb pins are approximate, and whole complexes can share one pin.</p>");
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------
  const listingsOf = (ids) => ids.map((id) => UW.byId.get(id)).filter(Boolean);
  function onClick(e) {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    const act = b.dataset.act, f = UW.ui.filters;
    const p = UW.ui.selected ? UW.property(UW.ui.selected) : null;
    const v = p && UW.activeVersion(p);
    if (act === "select") { UW.select(b.dataset.pid, { from: "panel" }); P.showTab("comps"); }
    else if (act === "clear") UW.select(null);
    else if (act === "tab-targets") P.showTab("targets");
    else if (act === "add-listing") UW.addApi.open();
    else if (act === "step" && p) { const all = UW.properties(), i = all.findIndex((x) => x.id === p.id); UW.select(all[(i + +b.dataset.v + all.length) % all.length].id, { from: "panel" }); }
    else if (act === "match" && p) { UW.matchProperty(p); UW.toast("Filters set to match " + p.street + ". Remove any chip to widen."); }
    else if (act === "rematch" && p) UW.matchProperty(p);
    else if (act === "pure") UW.pureNearest();
    else if (act === "reset") UW.resetFilters();
    else if (act === "card") UW.actions.openCard(p.id);
    else if (act === "copy-comps" && p) UW.actions.copyComps(p.id, v.label);
    else if (act === "view") { UW.ui.compsView = b.dataset.v; renderComps(); }
    else if (act === "sort") { UW.ui.sort = b.dataset.v; UW.writeHash(); renderComps(); }
    else if (act === "open") UW.mapApi.openListing(b.dataset.id);
    else if (act === "add" && p) UW.actions.addComps(p.id, v.label, listingsOf([b.dataset.id]));
    else if (act === "remove" && p) UW.actions.removeComp(p.id, v.label, b.dataset.id);
    else if (act === "copyrow") UW.copyListings(listingsOf([b.dataset.id]), p, "");
    else if (act === "pickall") { P.shownListings().forEach((l) => UW.ui.picked.add(l.id)); renderComps(); }
    else if (act === "pickclear") { UW.ui.picked.clear(); renderComps(); }
    else if (act === "copypicked") UW.copyListings(listingsOf([...UW.ui.picked]), p, "selected");
    else if (act === "copyall") UW.copyListings(P.shownListings().slice(0, CAP), p, "(all shown" + (UW.matchSet.size > CAP ? ", capped at " + CAP : "") + ")");
    else if (act === "addpicked" && p) { if (UW.actions.addComps(p.id, v.label, listingsOf([...UW.ui.picked]))) { UW.ui.picked.clear(); renderComps(); } }
    else if (act === "note-edit") { editingNote = b.dataset.id; renderComps(); setTimeout(() => { const n = root.querySelector('[data-note="' + b.dataset.id + '"]'); if (n) { n.focus(); n.select(); } }, 30); }
    else if (act === "note-done") { editingNote = null; renderComps(); }
    else if (act === "note-reset") { UW.setSessionNote(UW.byId.get(b.dataset.id), p, null); editingNote = null; renderComps(); }
    else if (act === "unchip") {
      const k = b.dataset.k, d = UW.defaultFilters();
      if (k === "am") { const am = Object.assign({}, f.am); delete am[b.dataset.v]; UW.setFilters({ am }); }
      else if (k === "minRev") UW.setFilters({ minRev: null });
      else UW.setFilters({ [k]: d[k] });
      if ((k === "zone" || k === "loc") && !UW.ui.filters.zone && !UW.ui.filters.loc.length) { UW.ui.matchZoneWater = false; renderComps(); }
    }
    else if (act === "chip") {
      const g = b.dataset.g, val = g === "beds" ? +b.dataset.v : b.dataset.v;
      const arr = f[g].includes(val) ? f[g].filter((x) => x !== val) : f[g].concat([val]);
      UW.setFilters({ [g]: arr });
    } else if (act === "am") {
      const am = Object.assign({}, f.am);
      const val = +b.dataset.v;
      if (val) am[b.dataset.k] = val; else delete am[b.dataset.k];
      UW.setFilters({ am });
    } else if (act === "zone") UW.setFilters({ zone: b.dataset.v });
    else if (act === "fav") UW.setFilters({ fav: b.dataset.v });
  }
  function onInput(e) {
    const t = e.target;
    if (t.dataset.note) UW.setSessionNote(UW.byId.get(t.dataset.note), UW.ui.selected ? UW.property(UW.ui.selected) : null, t.value);
  }
  function onChange(e) {
    const t = e.target;
    if (t.dataset.pick) {
      if (t.checked) UW.ui.picked.add(t.dataset.pick); else UW.ui.picked.delete(t.dataset.pick);
      renderComps();
      return;
    }
    if (t.dataset.layer) { UW.ui.layers[t.dataset.layer] = t.checked; UW.mapApi.layers(); return; }
    const k = t.dataset.k;
    if (!k) return;
    const val = t.value === "" ? null : Number(t.value);
    if (k === "switch") { UW.select(t.value, { from: "panel" }); return; }
    if (k === "matchZoneWater") {
      UW.ui.matchZoneWater = t.checked;
      const p = UW.ui.selected ? UW.property(UW.ui.selected) : null;
      if (p) UW.setFilters(t.checked ? { zone: p.place ? p.place.zone : "", loc: (UW.WATERFRONT_LOC[p.waterfront] || []).slice() } : { zone: "", loc: [] });
      return;
    }
    if (k === "colorBy") { UW.ui.colorBy = t.value; UW.writeHash(); UW.mapApi.refresh(); return; }
    if (k === "n") { UW.ui.n = Math.max(1, Math.min(50, Math.round(val || 12))); UW.writeHash(); UW.emit("near"); return; }
    if (k === "radius") { UW.ui.radius = val != null && val > 0 ? val : null; UW.writeHash(); UW.emit("near"); return; }
    if (["minRev", "maxRev", "minSleeps", "minBaths"].includes(k)) UW.setFilters({ [k]: val != null && val >= 0 ? val : null });
  }

  UW.on("filters", () => { renderFilters(); renderComps(); });
  UW.on("select", () => { const p = UW.ui.selected && UW.property(UW.ui.selected); if (p && p.geo) UW.ui.compsView = "nearest"; editingNote = null; renderComps(); renderTargets(); });
  UW.on("near", () => renderComps());
  UW.on("comps", () => { renderComps(); renderTargets(); });
  UW.on("property", () => { renderComps(); renderTargets(); });
  UW.on("listings", () => { renderComps(); renderTargets(); });
  UW.on("places", () => { renderComps(); renderTargets(); });
})();
