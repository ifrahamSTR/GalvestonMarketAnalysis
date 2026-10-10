/**
 * Acquisition-target cards (the Zillow houses), one per target, in two
 * groups (underwritten, new listings). The collapsed header carries the
 * decision numbers (price, revenue cases, cash on cash, comp errors first,
 * then the 20% revenue-to-price screen and the 4% low-case target); the
 * expanded body holds the scenario comparison, every input, the returns /
 * taxes / 5-year blocks, the comp table (the sheet's 15 columns, in revenue
 * order, Airbnb comps only) and the actions.
 *
 * Editing never re-renders the field being typed in: inputs update the state,
 * and only the derived numbers ([data-d] slots) are redrawn.
 */
/* global UWCsv, UWMath, UWRules */
(function () {
  const UW = window.UW, F = UW.fmt, E = UW.esc;
  const C = (UW.cardsApi = {});
  const SORTS = { area: "Island order (town → West End)", price: "Price", lowCoc: "Low-case cash on cash", ratio: "Mid revenue ÷ price" };

  C.init = function () {
    const ctl = document.getElementById("uw-list-ctl");
    ctl.innerHTML =
      '<label class="uw-sortsel">Sort by <select id="uw-sort" data-focus="sort">' + Object.entries(SORTS).map(([k, t]) => '<option value="' + k + '">' + t + "</option>").join("") + "</select></label>" +
      '<button type="button" class="uw-btn uw-btn--small uw-btn--ghost" id="uw-sortdir" aria-label="Reverse the order">↓ High to low</button>' +
      '<span class="uw-ctl-gap"></span>' +
      '<button type="button" class="uw-btn uw-btn--small uw-btn--ghost" id="uw-expand">Expand all</button>' +
      '<button type="button" class="uw-btn uw-btn--small uw-btn--ghost" id="uw-collapse">Collapse all</button>' +
      '<button type="button" class="uw-btn uw-btn--small uw-btn--primary" id="uw-add-btn">+ Add listing</button>';
    const sel = document.getElementById("uw-sort"), dir = document.getElementById("uw-sortdir");
    const syncDir = () => { dir.textContent = UW.ui.listSort.dir > 0 ? (UW.ui.listSort.key === "area" ? "↓ Town first" : "↓ High to low") : UW.ui.listSort.key === "area" ? "↑ West End first" : "↑ Low to high"; };
    sel.addEventListener("change", () => { UW.ui.listSort.key = sel.value; UW.ui.listSort.dir = 1; syncDir(); C.renderList(); });
    dir.addEventListener("click", () => { UW.ui.listSort.dir *= -1; syncDir(); C.renderList(); });
    syncDir();
    document.getElementById("uw-expand").addEventListener("click", () => { UW.properties().forEach((p) => UW.ui.expanded.add(p.id)); C.renderList(); });
    document.getElementById("uw-collapse").addEventListener("click", () => { UW.ui.expanded.clear(); C.renderList(); });
    document.getElementById("uw-add-btn").addEventListener("click", () => UW.addApi.open());
    const lists = document.getElementById("uw-lists");
    lists.addEventListener("click", onClick);
    lists.addEventListener("input", onInput);
    lists.addEventListener("change", onChange);
    lists.addEventListener("toggle", onToggle, true);
    C.renderList();
  };

  function sortKey(p) {
    const v = UW.activeVersion(p), o = v.outputs, price = v.inputs.price;
    const k = UW.ui.listSort.key;
    if (k === "price") return price;
    if (k === "lowCoc") return o.cases.low.coc;
    if (k === "ratio") return price && UW.isNum(v.inputs.revenue.mid) ? v.inputs.revenue.mid / price : null;
    return null;
  }
  C.renderList = function () {
    const all = UW.properties();
    const order = UW.areas.map((a) => a.id);
    const sorted = (arr) => {
      const k = UW.ui.listSort.key, d = UW.ui.listSort.dir;
      if (k === "area") return arr.slice().sort((a, b) => d * ((order.indexOf(a.place ? a.place.area : "zz") + 99 * !a.place) - (order.indexOf(b.place ? b.place.area : "zz") + 99 * !b.place)) || a.street.localeCompare(b.street));
      return arr.slice().sort((a, b) => { const x = sortKey(a), y = sortKey(b); if (x == null) return 1; if (y == null) return -1; return d * (y - x); });
    };
    const uw = sorted(all.filter((p) => p.kind !== "new")), nl = sorted(all.filter((p) => p.kind === "new"));
    document.getElementById("uw-n-uw").textContent = uw.length;
    document.getElementById("uw-n-new").textContent = nl.length;
    document.getElementById("uw-cards-uw").innerHTML = uw.map(cardHtml).join("");
    document.getElementById("uw-cards-new").innerHTML = nl.length ? nl.map(cardHtml).join("") :
      '<div class="uw-empty-card"><p><strong>No new listings yet.</strong> Add a Zillow listing to place it on the map, pull its nearest comps and underwrite it from a template.</p><button type="button" class="uw-btn uw-btn--primary" data-act="add-listing">+ Add listing</button></div>';
    markSelected();
  };

  C.open = function (pid, scroll) {
    UW.ui.expanded.add(pid);
    C.renderCard(pid);
    const el = document.getElementById("uw-card-" + pid);
    if (el && scroll) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  function cardHtml(p) {
    const open = UW.ui.expanded.has(p.id);
    return '<article class="uw-card' + (open ? " is-open" : "") + (p.kind !== "underwritten" ? " uw-card--new" : "") + '" id="uw-card-' + E(p.id) + '" data-pid="' + E(p.id) + '">' +
      '<div class="uw-card__head" data-region="head">' + headHtml(p) + "</div>" +
      '<div class="uw-card__body" id="uw-body-' + E(p.id) + '"' + (open ? "" : " hidden") + ">" + (open ? bodyHtml(p) : "") + "</div></article>";
  }

  C.renderCard = function (pid) { UW.afterPointer(() => renderCardNow(pid)); };
  function renderCardNow(pid) {
    const el = document.getElementById("uw-card-" + pid);
    if (!el) { C.renderList(); return; }
    const p = UW.property(pid);
    if (!p) { C.renderList(); return; }
    const tmp = document.createElement("div");
    tmp.innerHTML = cardHtml(p);
    el.replaceWith(tmp.firstChild);
    markSelected();
  }
  // Redraw only the derived numbers; leave the fields being edited alone.
  C.refresh = function (pid) {
    const el = document.getElementById("uw-card-" + pid);
    if (!el) return;
    const p = UW.property(pid);
    if (!p) return;
    el.querySelector('[data-region="head"]').innerHTML = headHtml(p);
    if (!UW.ui.expanded.has(pid)) return;
    const d = derived(p, UW.activeVersion(p));
    el.querySelectorAll("[data-d]").forEach((n) => { if (d[n.dataset.d] != null) n.innerHTML = d[n.dataset.d]; });
    markSelected();
  };
  function markSelected() {
    document.querySelectorAll(".uw-card").forEach((c) => c.classList.toggle("is-selected", c.dataset.pid === UW.ui.selected));
  }

  // ---------------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------------
  function checkCount(p, v) {
    let n = v.checks.length + v.comps.filter((c) => c.valid && c.status === "changed").length;
    if (!p.geo) n++;
    return n;
  }
  function headHtml(p) {
    const v = UW.activeVersion(p), o = v.outputs, inp = v.inputs, d = v.details, open = UW.ui.expanded.has(p.id);
    const rev = inp.revenue || {};
    const ratio = inp.price && UW.isNum(rev.mid) ? rev.mid / inp.price : null;
    const low = o.cases.low.coc;
    const st = UW.cocStatus(low);
    const beds = d.beds != null ? F.num(d.beds) + " / " + F.num(d.baths) : p.listing ? F.num(p.listing.facts.projBeds || p.listing.facts.beds) + " / " + F.num(p.listing.facts.projBaths || p.listing.facts.baths) : "—";
    const t = v.profile, tgt = t.beds != null ? '<span class="uw-fact"><b>' + F.num(t.beds) + " / " + F.num(t.baths) + (t.sleeps ? " / " + t.sleeps : "") + "</b> target</span>" : "";
    const nErr = UW.compErrors(v).length;
    const kind = p.kind === "new" ? '<span class="uw-tag uw-tag--new">New listing</span>' : p.kind === "promoted" ? '<span class="uw-tag uw-tag--new">Promoted · from this browser</span>' : "";
    const edited = v.edited.inputs && p.kind === "underwritten" ? '<span class="uw-tag uw-tag--edit" title="Numbers recalculated from edited inputs">Edited · recalculated</span>' :
      UW.editSource(p.id, v.label) && p.kind === "underwritten" ? '<span class="uw-tag uw-tag--edit">Edited</span>' : "";
    const nChecks = checkCount(p, v);
    const versionSel = p.versions.length > 1 ? '<label class="uw-vsel"><span>Scenario</span><select data-act="version" data-focus="ver-' + E(p.id) + '" aria-label="Scenario for ' + E(p.street) + '">' +
      p.versions.map((x) => '<option value="' + E(x.label) + '"' + (x.label === v.label ? " selected" : "") + ">" + E(UW.scenarioName(x)) + " · file " + E(x.label) + "</option>").join("") + "</select></label>" :
      p.kind === "underwritten" ? '<span class="uw-vfile">File ' + E(v.label) + "</span>" : "";
    const cocs = ["low", "mid", "high"].map((c) => '<span class="uw-coc uw-coc--' + UW.cocStatus(o.cases[c].coc) + '">' + F.pct(o.cases[c].coc) + "</span>").join('<span class="uw-sep">·</span>');
    const revs = ["low", "mid", "high"].map((c) => F.k(rev[c])).join('<span class="uw-sep">·</span>');
    const screen = ratio == null ? '<span class="uw-badge uw-badge--none">Mid revenue not set</span>' :
      '<span class="uw-badge uw-badge--' + (ratio >= UW.SCREEN ? "good" : "warn") + '" title="Mid revenue ÷ price, against the 20% screen">' + (ratio >= UW.SCREEN ? "✓ " : "") + "Mid revenue " + F.pct(ratio, 1) + " of price · " + (ratio >= UW.SCREEN ? "passes" : "below") + " the 20% screen</span>";
    const target = !UW.isNum(low) ? '<span class="uw-badge uw-badge--none">Low-case cash on cash not set</span>' :
      '<span class="uw-badge uw-badge--' + st + '">' + (st === "good" ? "✓ " : "") + "Low case " + F.pct(low) + " · " + (st === "good" ? "meets" : "below") + " the 4% target</span>";
    return '<div class="uw-head__top">' +
      '<button type="button" class="uw-card__toggle" data-act="toggle" aria-expanded="' + open + '" aria-controls="uw-body-' + E(p.id) + '" data-focus="tog-' + E(p.id) + '">' +
      '<span class="uw-chev" aria-hidden="true"></span><span class="uw-card__addr">' + E(p.street) + '</span><span class="uw-card__city">' + E([p.address.split(", ")[1], p.zip].filter(Boolean).join(" ")) + "</span></button>" +
      '<div class="uw-head__right"><span class="uw-price">' + F.money(inp.price) + "</span>" + versionSel + "</div></div>" +
      '<div class="uw-head__facts">' + kind + edited +
      (p.url ? '<a class="uw-zlink" href="' + E(p.url) + '" target="_blank" rel="noopener">Zillow ↗</a>' : "") +
      '<span class="uw-fact"><b>' + beds + "</b> bed / bath as listed</span>" + tgt +
      (p.place ? '<span class="uw-fact"><span class="region-dot" style="background:' + (UW.areaById[p.place.area] || {}).color + '"></span>' + E(p.place.areaName) + "</span>" +
        '<span class="uw-fact"><span class="uw-dot" style="background:' + UW.LOC_COLORS[p.place.loc] + '"></span>' + E(p.place.loc) + " · " + E(p.place.zone) + "</span>" : '<span class="uw-fact uw-fact--warn">No map pin</span>') + "</div>" +
      '<div class="uw-head__kpis"><div class="uw-kpi"><span class="uw-kpi__l">Revenue · low / mid / high</span><span class="uw-kpi__v">' + revs + "</span></div>" +
      '<div class="uw-kpi"><span class="uw-kpi__l">Cash on cash · low / mid / high</span><span class="uw-kpi__v">' + cocs + "</span></div>" +
      '<div class="uw-head__badges">' + (nErr ? '<button type="button" class="uw-badge uw-badge--err" data-act="goto-comps">' + nErr + " comp error" + (nErr === 1 ? "" : "s") + "</button>" : "") + screen + target + (nChecks ? '<button type="button" class="uw-badge uw-badge--check" data-act="goto-checks">' + nChecks + " data check" + (nChecks === 1 ? "" : "s") + "</button>" : "") + "</div></div>";
  }

  // ---------------------------------------------------------------------------
  // Body
  // ---------------------------------------------------------------------------
  const num = (v, scale) => (v == null ? "" : String(Math.round(v * (scale || 1) * 10000) / 10000));
  const moneyIn = (val, attrs, label) => '<span class="uw-money-in"><span>$</span><input type="number" inputmode="decimal" step="any" value="' + num(val) + '" ' + attrs + (label ? ' aria-label="' + E(label) + '"' : "") + "></span>";
  const pctIn = (val, attrs, label) => '<span class="uw-pct-in"><input type="number" inputmode="decimal" step="any" value="' + num(val, 100) + '" ' + attrs + (label ? ' aria-label="' + E(label) + '"' : "") + "><span>%</span></span>";

  function derived(p, v) {
    const o = v.outputs, inp = v.inputs, out = {};
    const R = [["revenue", "Forecasted revenue", "$"], ["opex", "Operating expenses", "$"], ["pm", "Property management fee", "$"], ["noi", "Net operating income", "$"],
      ["ds", "Debt service", "$"], ["fcf", "Free cash flow", "$"], ["coc", "Cash on cash", "%"], ["principal", "Principal pay down", "$"], ["appr", "Annual appreciation", "$"],
      ["totalReturn", "Total return", "%"], ["totalReturnTax", "Total return + year-1 tax savings", "%"]];
    const cell = (c, k, t) => { const x = o.cases[c][k]; return t === "%" ? F.pct(x) : F.money(x); };
    const src = v.source === "sheet" ? '<span class="uw-src uw-src--sheet">The sheet’s own numbers</span>' :
      p.kind === "underwritten" ? '<span class="uw-src uw-src--calc">Recalculated from your edits</span> <button type="button" class="uw-linkbtn" data-act="revert">Back to the sheet’s numbers</button>' :
        '<span class="uw-src uw-src--calc">Calculated on this page</span>';
    out.returns = '<div class="uw-ret-head"><h4>Returns</h4>' + src + "</div>" +
      '<div class="table-scroll"><table class="data-table uw-ret"><thead><tr><th></th><th>Low</th><th>Mid</th><th>High</th></tr></thead><tbody>' +
      R.map(([k, lab, t]) => '<tr class="uw-ret--' + k + '"><th scope="row">' + lab + (k === "opex" && inp.opexRangePct ? ' <span class="muted">(±' + F.pct(inp.opexRangePct, 0) + ")</span>" : "") +
        (k === "pm" ? ' <span class="muted">(' + F.pct(inp.pmPct || 0, 0) + ")</span>" : "") + (k === "appr" ? ' <span class="muted">(' + F.pct(inp.apprPct, 1) + ")</span>" : "") + "</th>" +
        ["low", "mid", "high"].map((c) => "<td" + (k === "coc" ? ' class="uw-coc uw-coc--' + UW.cocStatus(o.cases[c].coc) + '"' : "") + ">" + cell(c, k, t) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
    const T = o.taxes, Y = o.fiveYear;
    out.taxes = '<table class="uw-mini"><tbody>' +
      [["Land share", F.pct(T.landPct, 0)], ["Improvement basis", F.money(T.basis)], ["Short-life assets (" + F.pct(inp.slaPct == null ? 0.35 : inp.slaPct, 0) + ")", F.money(T.slas)],
        ["Bonus depreciation", F.pct(T.bonusPct, 0)], ["Tax rate", F.pct(T.taxRate, 0)], ["Year-1 depreciation", F.money(T.y1Loss)], ["Tax savings", "<strong>" + F.money(T.taxSavings) + "</strong>"]]
        .map((r) => '<tr><th scope="row">' + r[0] + "</th><td>" + r[1] + "</td></tr>").join("") + "</tbody></table>";
    out.five = '<table class="uw-mini"><tbody>' + [["Cash flow", F.money(Y.cashFlow)], ["Equity (principal repaid)", F.money(Y.equity)], ["Appreciation", F.money(Y.appreciation)], ["Total", "<strong>" + F.money(Y.total) + "</strong>"]]
      .map((r) => '<tr><th scope="row">' + r[0] + "</th><td>" + r[1] + "</td></tr>").join("") + "</tbody></table>";
    out.down = F.money(o.down);
    out.loan = F.money(o.loan);
    out.closing = F.money(o.closing);
    out.setupTotal = F.money(o.setupTotal);
    out.setupTotal2 = F.money(UWMath.setupTotal(inp));
    out.oop = F.money(o.oop);
    out.payment = F.money(o.payment) + "/mo";
    out.opexMonthly = F.money(UWMath.opexMonthly(inp)) + "/mo";
    out.opexAnnual = F.money(UWMath.opexMonthly(inp) * 12) + " a year (mid case)";
    out.clean = F.money(UWMath.cleaningMonthly(inp));
    out.stats = statsHtml(p, v);
    out.details = detailsHtml(p, v);
    out.setupCount = inp.setup.length + " of 15 rows";
    ["beds", "baths", "sleeps"].forEach((k) => { out["psrc-" + k] = srcLabel(v.profile.src[k]); });
    return out;
  }

  // Target profile: the house as it will be run, per scenario. Every value shows where it came from.
  const srcShort = (s) => E(String(s || "").replace(/ \$[\d,]+$/, (m) => m).slice(0, 80));
  function profileFlagsHtml(p, v) {
    const pr = v.profile, pid = E(p.id);
    const row = (f) => {
      const on = pr.flags[f] ? 1 : 0, src = pr.src.flags[f];
      return '<div class="uw-pflag' + (src === "manual" ? " is-manual" : "") + '"><span class="uw-pflag__l">' + E(UWRules.PROFILE_LABEL[f]) + "</span>" +
        '<span class="uw-seg uw-seg--sm uw-pflag__t" role="group" aria-label="' + E(UWRules.PROFILE_LABEL[f]) + '">' +
        [1, 0].map((x) => '<button type="button" data-act="pflag" data-f="' + f + '" data-v="' + x + '" aria-pressed="' + (on === x) + '" data-focus="' + pid + "-pf" + f + x + '">' + x + "</button>").join("") +
        '</span><span class="uw-pflag__s" title="' + E(src || "") + '">' + (src === "manual" ? '<span class="uw-tag uw-tag--edit">manual</span>' : srcShort(src)) + "</span></div>";
    };
    return '<div class="uw-pflags"><p class="uw-flabel">The sheet’s 8 amenity columns</p>' + UWRules.PROFILE_FLAGS.filter((f) => !UWRules.MATCH_ONLY.includes(f)).map(row).join("") +
      '<p class="uw-flabel">Matching only <span class="muted">(never copied into the sheet)</span></p>' + UWRules.MATCH_ONLY.map(row).join("") + "</div>";
  }
  function profileHtml(p, v) {
    const pr = v.profile, pid = E(p.id);
    const nin = (k, lab) => '<label class="uw-pnum"><span>' + lab + '</span><input type="number" min="0" step="' + (k === "baths" ? "0.5" : "1") + '" inputmode="decimal" value="' + (pr[k] == null ? "" : pr[k]) +
      '" data-pnum="' + k + '" aria-label="Target ' + lab.toLowerCase() + '" placeholder="—" data-focus="' + pid + "-pn" + k + '"><small data-d="psrc-' + k + '">' + srcLabel(pr.src[k]) + "</small></label>";
    return '<section class="uw-box uw-box--profile" id="uw-profile-' + pid + '"><div class="uw-box__head"><h4>Target profile' + (p.versions.length > 1 ? " · " + E(UW.scenarioName(v)) : "") +
      ' <span class="muted">what the house will be after the plan</span></h4>' +
      '<button type="button" class="uw-btn uw-btn--small uw-btn--ghost" data-act="profile-reset"' + (v.profileEdit ? "" : " disabled") + ">Reset to sheet</button></div>" +
      '<p class="uw-hint">As listed: <strong>' + (pr.asListed.beds == null ? "—" : F.num(pr.asListed.beds) + " / " + F.num(pr.asListed.baths)) + "</strong> bed / bath. " +
      "Amenities are read from this scenario’s setup items (being added), the notes (already there) and the beach position (waterfront); anything not mentioned is 0. Both matching modes rerun as you edit.</p>" +
      '<div class="uw-pnums">' + nin("beds", "Bedrooms") + nin("baths", "Baths") + nin("sleeps", "Sleeps") + "</div>" +
      '<div data-d="pflags">' + profileFlagsHtml(p, v) + "</div></section>";
  }
  const srcLabel = (s) => (s === "manual" ? '<span class="uw-tag uw-tag--edit">manual</span>' : /^default/.test(s || "") ? '<span class="uw-tag uw-tag--possibly">default: edit</span> ' + E(String(s).replace(/^default: edit\s*/, "")) : E(s || "—"));

  function statsHtml(p, v) {
    const s = UW.compStats(p, v);
    if (!s.total) return '<p class="uw-empty">No comps in this scenario yet. Add Airbnb comps from the map or the nearest-comps list.</p>';
    const tile = (val, lab) => '<div class="uw-stat"><strong>' + val + "</strong><span>" + lab + "</span></div>";
    if (!s.n) return '<p class="uw-empty">All ' + s.total + " rows are comp errors, so there are no stats.</p>";
    return '<div class="uw-stats">' + tile(s.n + (s.excluded ? '<small class="uw-excl">' + s.excluded + " excluded</small>" : ""), "valid comps") + tile(F.k(s.median), "median revenue") + tile(F.k(s.p25) + "–" + F.k(s.p75), "middle half") +
      tile(F.k(s.max), "highest") + tile(s.sameArea == null ? "—" : s.sameArea + " of " + s.known, "in the same area") + tile(s.sameLoc == null ? "—" : s.sameLoc + " of " + s.known, "same beach position") + "</div>" +
      '<p class="uw-hint">The valid comps’ revenue as it sits in the comp table' + (s.excluded ? " (" + s.excluded + " error row" + (s.excluded === 1 ? "" : "s") + " left out)" : "") + ". It is there to help you set the cases; the page never sets them.</p>";
  }

  function detailsHtml(p, v) {
    const d = v.details, L = p.listing && p.listing.facts;
    const row = (k, val) => (val == null || val === "" ? "" : "<dt>" + k + "</dt><dd>" + val + "</dd>");
    const comment = (c) => (c ? ' <span class="muted">' + E(c) + "</span>" : "");
    const geo = p.geo ? F.num(+p.geo.lat.toFixed(5)) + ", " + F.num(+p.geo.lng.toFixed(5)) + ' <span class="muted">(' + E(p.pinEdited ? "placed by hand" : p.geoNote || "") + ")</span>" : '<span class="uw-warn">No pin yet</span>';
    return '<dl class="uw-dl">' +
      row("Bed / bath (as listed)", d.beds != null ? F.num(d.beds) + " / " + F.num(d.baths) + comment(d.bedBathComment) : E(d.bedBathText || "")) +
      (L ? row("Bed / bath now", F.num(L.beds) + " / " + F.num(L.baths)) : "") +
      row("Lot size", d.lot != null ? Number(d.lot).toLocaleString("en-US") + " sqft" + comment(d.lotComment) : E(d.lotText || "")) +
      row("Property size", d.size != null ? Number(d.size).toLocaleString("en-US") + " sqft" + comment(d.sizeComment) : E(d.sizeText || "")) +
      (L && (L.pool || L.hotTub) ? row("Already has", [L.pool && "pool", L.hotTub && "hot tub"].filter(Boolean).join(" and ")) : "") +
      row("Why this property", d.why.length ? "<ul>" + d.why.map((w) => "<li>" + E(w) + "</li>").join("") + "</ul>" : '<span class="muted">Nothing listed yet</span>') +
      row("Pin", geo) +
      (p.place ? row("Distance to the Gulf", F.km(p.place.beachKm) + ' <span class="muted">(to the shoreline the market analysis uses)</span>') +
        row("Area · zone", E(p.place.areaName) + " · " + E(p.place.zone)) + row("Beach position", E(p.place.loc)) : "") + "</dl>";
  }

  function bodyHtml(p) {
    const v = UW.activeVersion(p), inp = v.inputs, d = derived(p, v), pid = E(p.id);
    const isUW = p.kind === "underwritten";
    const extras = (v.base && v.base.extras) || (UW.data.uw.properties[0].versions[0].extras || []);
    const myears = v.sheet && v.sheet.mortgageYears;
    const mismatch = myears != null && inp.amortYears != null && myears !== inp.amortYears;

    const purchase = '<section class="uw-box"><h4>Purchase &amp; financing</h4><div class="uw-form">' +
      '<label>Purchase price</label>' + moneyIn(inp.price, 'data-in="price" data-focus="' + pid + '-price"', "Purchase price") +
      '<label>Down payment</label><div class="uw-pair">' + pctIn(inp.dpPct, 'data-in="dpPct" data-focus="' + pid + '-dp"', "Down payment percent") + '<output data-d="down">' + d.down + "</output></div>" +
      '<label>Loan amount</label><output data-d="loan">' + d.loan + "</output>" +
      '<label>Interest rate</label>' + pctIn(inp.rate, 'data-in="rate" data-focus="' + pid + '-rate"', "Interest rate") +
      '<label>Closing costs</label><div class="uw-pair">' + pctIn(inp.closingPct, 'data-in="closingPct" data-focus="' + pid + '-cc"', "Closing costs percent") + '<output data-d="closing">' + d.closing + "</output></div>" +
      '<label>Setup (renovation, amenities, furniture)</label><output data-d="setupTotal">' + d.setupTotal + "</output>" +
      '<label class="uw-strong">Total out of pocket</label><output class="uw-strong" data-d="oop">' + d.oop + "</output>" +
      '<label>Payment</label><output data-d="payment">' + d.payment + "</output>" +
      "</div>" +
      '<p class="uw-hint">Debt service uses a ' + (inp.amortYears || 30) + "-year amortization, as the sheet’s amortization block does." +
      (mismatch ? ' <span class="uw-warn">The sheet’s “Mortgage Years” says ' + myears + ", but its debt service uses " + inp.amortYears + " years. Not changed here.</span>" : "") + "</p>" +
      '<p class="uw-hint">Fixed by the sheet: OPEX range ±' + F.pct(inp.opexRangePct, 0) + ", management fee " + F.pct(inp.pmPct || 0, 0) + ", appreciation " + F.pct(inp.apprPct, 1) +
      ", land " + F.pct(inp.landPct, 0) + ", short-life assets " + F.pct(inp.slaPct == null ? 0.35 : inp.slaPct, 0) + ", bonus " + F.pct(inp.bonusPct, 0) + ", tax rate " + F.pct(inp.taxRate, 0) + ".</p></section>";

    const setup = '<section class="uw-box" data-region="setup"><div class="uw-box__head"><h4>Setup items</h4><span class="muted" data-d="setupCount">' + d.setupCount + "</span></div>" +
      '<ul class="uw-items">' + inp.setup.map((s, i) => '<li><input type="text" value="' + E(s.label) + '" data-setup-label="' + i + '" aria-label="Setup item ' + (i + 1) + '" data-focus="' + pid + "-sl" + i + '">' +
        moneyIn(s.amount, 'data-setup-amt="' + i + '" data-focus="' + pid + "-sa" + i + '"', "Cost of setup item " + (i + 1)) +
        '<button type="button" class="uw-btn uw-btn--icon" data-act="setup-del" data-i="' + i + '" aria-label="Remove ' + E(s.label || "item") + '">×</button></li>').join("") + "</ul>" +
      '<div class="uw-items__foot"><button type="button" class="uw-btn uw-btn--small uw-btn--ghost" data-act="setup-add"' + (inp.setup.length >= 15 ? " disabled" : "") + ">+ Add item</button>" +
      '<span class="uw-total">Total <strong data-d="setupTotal2">' + d.setupTotal2 + "</strong></span></div>" +
      (extras.length ? '<p class="uw-extras"><span class="muted">The sheet’s common extras:</span> ' + extras.map((x, i) => '<button type="button" class="uw-chip uw-chip--sm" data-act="setup-extra" data-i="' + i + '"' + (inp.setup.length >= 15 ? " disabled" : "") + ">+ " + E(x.label) + " " + F.k(x.amount) + "</button>").join("") + "</p>" : "") + "</section>";

    const opex = '<section class="uw-box"><h4>Operating expenses <span class="muted">monthly</span></h4><ul class="uw-items uw-items--opex">' +
      inp.opex.map((o, i) => o.cleaning ?
        '<li class="uw-clean"><span class="uw-items__l">Cleaning</span><span class="uw-clean__calc">' + moneyIn(inp.cleaningCost, 'data-clean="cost" data-focus="' + pid + '-cc1"', "Cost per clean") +
        '<span class="muted">× turns</span><input type="number" step="any" inputmode="decimal" value="' + num(inp.cleaningTurns) + '" data-clean="turns" aria-label="Turns per month" data-focus="' + pid + '-cc2"><span class="muted">=</span><output data-d="clean">' + d.clean + "</output></span></li>" :
        '<li><span class="uw-items__l">' + E(o.label) + (o.note ? ' <span class="muted">(' + E(o.note) + ")</span>" : "") + "</span>" + moneyIn(o.amount, 'data-opex="' + i + '" data-focus="' + pid + "-ox" + i + '"', o.label + " per month") + "</li>").join("") + "</ul>" +
      '<div class="uw-items__foot"><span class="uw-total">Total <strong data-d="opexMonthly">' + d.opexMonthly + '</strong> · <span data-d="opexAnnual">' + d.opexAnnual + "</span></span></div>" +
      (p.kind !== "underwritten" ? '<p class="uw-hint">Copied from ' + E(p.listing.templateLabel ? "file " + p.listing.templateLabel : "the template") + ". Check property taxes and insurance for this price.</p>" : "") + "</section>";

    const revenue = '<section class="uw-box uw-box--rev"><h4>Revenue cases <span class="muted">you set these</span></h4><div class="uw-rev">' +
      ["low", "mid", "high"].map((c) => '<label><span>' + c[0].toUpperCase() + c.slice(1) + "</span>" + moneyIn(inp.revenue[c], 'data-rev="' + c + '" data-focus="' + pid + "-rv" + c + '"', c + " revenue") + "</label>").join("") + "</div>" +
      '<div data-d="stats">' + d.stats + "</div></section>";

    const notes = '<section class="uw-box"><h4>Analyst notes</h4><textarea rows="9" data-notes="1" aria-label="Analyst notes" data-focus="' + pid + '-notes">' + E(v.notes) + "</textarea>" +
      '<p class="uw-hint">Same format as the sheet’s Analyst Notes cell. Bed / bath, lot and size are read from it.</p></section>';
    const profile = profileHtml(p, v);
    const details = '<section class="uw-box"><h4>Property details</h4><div data-d="details">' + d.details + "</div>" +
      '<div class="uw-form uw-form--tight"><label for="wf-' + pid + '">Waterfront type</label><select id="wf-' + pid + '" data-wf="1" data-focus="' + pid + '-wf">' +
      UW.WATERFRONT_TYPES.map((t) => '<option value="' + t + '"' + (p.waterfront === t ? " selected" : "") + ">" + (t === "Bay-canal" ? "Bay / canal" : t === "None" ? "Not on the water" : t) + "</option>").join("") + "</select></div>" +
      '<p class="uw-hint">Can’t be read reliably from an address, so it defaults to the beach position and you can change it. Match by location uses it.</p>' +
      '<div class="uw-actions uw-actions--tight">' + (p.geo ? '<button type="button" class="uw-btn uw-btn--small uw-btn--ghost" data-act="pin">Adjust pin</button>' :
        '<button type="button" class="uw-btn uw-btn--small" data-act="pin">Place pin on the map</button><button type="button" class="uw-btn uw-btn--small uw-btn--ghost" data-act="osm">Look up with OpenStreetMap</button>') +
      (p.pinEdited && isUW ? '<button type="button" class="uw-linkbtn" data-act="pin-reset">Use the geocoded pin</button>' : "") + "</div></section>";

    const comps = compsHtml(p, v);
    const checks = checksHtml(p, v);
    const amort = isUW ? '<details class="uw-amort" data-amort="' + E(v.file) + '"><summary>Amortization schedule, copied from the sheet (file ' + E(v.label) + ")</summary><div class=\"uw-amort__body\"><p class=\"uw-hint\">Loading…</p></div></details>" : "";
    const scen = p.versions.length > 1 ? '<section class="uw-box uw-box--scen"><h4>Scenarios side by side <span class="muted">the same house, underwritten ' + p.versions.length + " ways</span></h4>" + UW.scenarioTable(p) + "</section>" : "";
    const actions = '<div class="uw-actions">' +
      '<button type="button" class="uw-btn" data-act="show"' + (p.geo ? "" : " disabled") + ">Show on map</button>" +
      '<button type="button" class="uw-btn uw-btn--ghost" data-act="copy-comps"' + (v.comps.length ? "" : " disabled") + ">Copy comps</button>" +
      '<button type="button" class="uw-btn uw-btn--ghost" data-act="copy-rev">Copy revenue cases</button>' +
      '<button type="button" class="uw-btn uw-btn--primary" data-act="csv">Download UW CSV</button>' +
      (p.kind === "new" ? '<button type="button" class="uw-btn uw-btn--ghost" data-act="edit-listing">Edit listing details</button><button type="button" class="uw-btn uw-btn--ghost" data-act="promote"' +
        (p.listing.downloaded ? "" : ' disabled title="Download the UW CSV first"') + ">Promote to underwritten</button>" : "") +
      (p.kind === "promoted" ? '<button type="button" class="uw-btn uw-btn--ghost" data-act="edit-listing">Edit listing details</button><button type="button" class="uw-btn uw-btn--ghost" data-act="demote">Move back to new listings</button>' : "") +
      (p.kind !== "underwritten" ? '<button type="button" class="uw-btn uw-btn--danger" data-act="delete">Delete listing</button>' : "") +
      (isUW && UW.editSource(p.id, v.label) ? '<button type="button" class="uw-btn uw-btn--ghost" data-act="revert">Discard edits to file ' + E(v.label) + "</button>" : "") + "</div>" +
      (p.kind === "new" && !p.listing.downloaded ? '<p class="uw-hint">“Promote to underwritten” unlocks once this listing’s UW CSV has been downloaded.</p>' : "") +
      '<p class="uw-hint">The CSV starts from ' + (isUW ? "this target’s own sheet (" + E(v.file) + ")" : E(UW.data.uw.templateFile)) + " and replaces only the input cells: notes, URL, price, down payment, rate, closing, setup items, OPEX items, revenue cases and comp rows (written in revenue order). " +
      "Totals and returns keep the source’s values until the inputs are entered in the Google Sheet; the amortization block is copied unchanged.</p>";

    return scen + '<div class="uw-grid uw-grid--top">' + revenue + '<section class="uw-box uw-box--ret" data-d="returns">' + d.returns + "</section></div>" +
      '<div class="uw-grid uw-grid--2"><section class="uw-box"><h4>Taxes</h4><div data-d="taxes">' + d.taxes + '</div></section><section class="uw-box"><h4>5-year</h4><div data-d="five">' + d.five + "</div></section></div>" +
      '<div class="uw-grid uw-grid--3">' + purchase + setup + opex + "</div>" +
      '<div class="uw-grid uw-grid--2">' + notes + details + "</div>" + profile +
      comps + checks + amort + actions;
  }

  // ---------------------------------------------------------------------------
  // Comp set builder
  // ---------------------------------------------------------------------------
  const HEADER = UWCsv.COMP_HEADER;
  const fmtVal = (x, t) => (x == null ? "—" : t === "money" ? F.money(x) : t === "money2" ? F.money2(x) : t === "pctpts" ? Number(x).toFixed(2) + "%" : F.num(x));
  // A sheet value, with the workbook's current value beneath it in a small tag when they differ.
  function cellWithChange(c, field, sheetHtml, fmt) {
    const ch = c.changes.find((x) => x.field === field);
    return sheetHtml + (ch ? '<span class="uw-chg" title="Current workbook value">now ' + fmtVal(ch.current, fmt) + "</span>" : "");
  }
  function compsHtml(p, v) {
    const pid = E(p.id);
    const errs = v.comps.filter((c) => !c.valid);
    const rows = v.comps.map((c, i) => {
      const l = c.valid ? UW.byId.get(c.id) : null;
      const title = l ? l.title : c.title || (UW.ruleCtx.index[c.id] || {}).title || "";
      const dist = l && p.geo ? F.mi(UW.geoMiles(p.geo, l)) : "—";
      const urlCell = c.cls === "badurl" ? '<span class="uw-comp__bad">' + E(c.url || "(empty)") + "</span>" :
        '<a href="' + E(c.url) + '" target="_blank" rel="noopener">' + E(c.url) + "</a>" + (title ? '<span class="cell-sub">' + E(title) + "</span>" : "");
      const flags = UWCsv.SHEET_FLAGS.map((f) => { const on = c.flags && c.flags[f] ? 1 : 0; return '<td class="uw-comp__flag">' + cellWithChange(c, "HAS_" + f, '<span class="uw-flag uw-flag--' + on + '">' + on + "</span>", "num") + "</td>"; }).join("");
      const occ = c.occupancy == null ? "—" : (c.occupancy * 100).toFixed(2) + "%";
      const status = '<span class="uw-badge uw-badge--' + (c.valid ? (c.status === "changed" ? "warn" : "good") : "err") + '">' + E(c.valid ? (c.status === "changed" ? "Values changed" : c.label) : c.label) + "</span>" +
        (c.cls === "possibly" ? ' <span class="uw-tag uw-tag--possibly">possibly good</span>' : "") +
        (!c.valid ? '<span class="uw-comp__ch">' + E(c.reason) + "</span>" : "") +
        (c.candidates && c.candidates.length ? '<span class="uw-comp__ch">Same title in the workbook: ' + c.candidates.map((x) => '<a href="' + E(x.url) + '" target="_blank" rel="noopener">' + E(x.id) + "</a> (" + E(UWRules.CLASSES[x.cls].label) + ")").join(", ") + ". Not substituted.</span>" : "") +
        (c.valid && (c.bigRevenue || c.bedroomsChanged) ? '<span class="uw-comp__big">' + [c.bigRevenue && "revenue " + (c.revenueChangePct > 0 ? "+" : "") + c.revenueChangePct + "%", c.bedroomsChanged && "bedroom count changed"].filter(Boolean).join(" · ") + "</span>" : "") +
        (c.valid && c.status === "changed" ? '<button type="button" class="uw-linkbtn" data-act="comp-update" data-id="' + E(c.id) + '">Use current workbook values</button>' : "");
      return '<tr class="uw-comp uw-comp--' + (c.valid ? c.status : "error") + (c.valid && (c.bigRevenue || c.bedroomsChanged) ? " uw-comp--big" : "") + '" data-url="' + E(c.url || "") + '" data-rev="' + (c.revenue == null ? "" : c.revenue) + '" data-adr="' + (c.adr == null ? "" : c.adr) + '" data-cls="' + c.cls + '" data-match="' + (c.match || "sheet") + '"' + (UW.ui.cmatch[p.id] && UW.ui.cmatch[p.id] !== (c.match || "sheet") ? " hidden" : "") + ">" +
        '<td class="uw-comp__url">' + urlCell + "</td>" +
        '<td class="uw-comp__num">' + cellWithChange(c, "revenue", F.money(c.revenue), "money") + "</td>" +
        '<td class="uw-comp__num">' + cellWithChange(c, "bedrooms", F.num(c.bedrooms), "num") + "</td>" +
        '<td class="uw-comp__num">' + cellWithChange(c, "sleeps", F.num(c.sleeps), "num") + "</td>" +
        '<td class="uw-comp__num">' + cellWithChange(c, "adr", F.money2(c.adr), "money2") + "</td>" +
        '<td class="uw-comp__num">' + cellWithChange(c, "occupancy", occ, "pctpts") + "</td>" + flags +
        '<td class="uw-comp__notes"><textarea rows="2" data-cnote="' + i + '" aria-label="Notes for comp ' + (i + 1) + '" data-focus="' + pid + "-cn" + i + '">' + E(c.notes) + "</textarea></td>" +
        '<td class="uw-x">' + (l ? F.num(l.baths) : "—") + '</td><td class="uw-x">' + (l ? E(UW.areaById[l.area].name) : "—") + '</td><td class="uw-x">' + (l ? E(l.loc) : "—") + '</td><td class="uw-x">' + dist + "</td>" +
        '<td class="uw-x uw-comp__match"><span class="uw-mtag uw-mtag--' + (c.match || "sheet") + '">' + ({ location: "Location", amenity: "Amenity", both: "Both" }[c.match] || "Sheet") + "</span></td>" +
        '<td class="uw-x uw-comp__st">' + status + "</td>" +
        '<td class="uw-x uw-comp__act"><button type="button" class="uw-btn uw-btn--icon" data-act="comp-del" data-id="' + E(UW.compId(c) || "") + '" data-i="' + i + '" aria-label="Remove comp ' + (i + 1) + '">×</button></td></tr>';
    }).join("");
    // Rows sort by the sheet's revenue; say so when the workbook's current revenue would order them differently.
    const curRev = (c) => (c.valid && c.current ? c.current.revenue : c.revenue);
    const curOrder = v.comps.map((c, i) => [i, curRev(c), c.current ? c.current.adr : c.adr]).sort((a, b) => b[1] - a[1] || (b[2] || 0) - (a[2] || 0)).map((x) => x[0]);
    const orderDiffers = curOrder.some((x, i) => x !== i);
    const others = p.versions.filter((x) => x.label !== v.label && x.comps.length);
    const noPool = /without pool|no pool/i.test(UW.scenarioName(v));
    const empty = '<div class="uw-empty-comps"><p class="uw-empty">No comps in ' + (p.versions.length > 1 ? "the " + E(UW.scenarioName(v)) + " scenario" : "this comp set") + " yet.</p>" +
      others.map((x) => '<button type="button" class="uw-btn uw-btn--small" data-act="start-from" data-from="' + E(x.label) + '">Start from the ' + E(UW.scenarioName(x)) + " comp set</button>").join("") +
      (noPool ? '<button type="button" class="uw-btn uw-btn--small uw-btn--ghost" data-act="find-nopool" title="Match by amenities: the whole island, no-pool homes ranked first">Find no-pool comps</button>' :
        '<button type="button" class="uw-btn uw-btn--small uw-btn--ghost" data-act="show"' + (p.geo ? "" : " disabled") + ">Find comps on the map</button>") + "</div>";
    return '<section class="uw-box uw-box--comps" id="uw-comps-' + pid + '"><div class="uw-box__head"><h4>Airbnb comp set' + (p.versions.length > 1 ? " · " + E(UW.scenarioName(v)) : "") + ' <span class="muted">' + v.comps.length + " of 15 rows · revenue high to low</span></h4>" +
      '<div class="uw-comps__tools">' + (errs.length ? '<button type="button" class="uw-btn uw-btn--small uw-btn--danger" data-act="remove-flagged">Remove flagged comps (' + errs.length + ")</button>" : "") +
      (v.comps.length ? '<label class="uw-cmatch">Show <select data-cmatch="1" aria-label="Show comps by how they were added">' + [["", "All"], ["sheet", "Sheet"], ["location", "Location"], ["amenity", "Amenity"], ["both", "Both"]].map(([k, t]) =>
        '<option value="' + k + '"' + ((UW.ui.cmatch[p.id] || "") === k ? " selected" : "") + ">" + t + "</option>").join("") + "</select></label>" : "") +
      (p.geo && v.comps.some((c) => (c.match || "sheet") === "sheet" && c.valid && !/ mi from /.test(c.notes || "")) ? '<button type="button" class="uw-btn uw-btn--small uw-btn--ghost" data-act="append-distance" title="Adds “· 0.8 mi from ' + E(p.street) + '” to the notes of rows from the sheet">Append distance to notes</button>' : "") +
      '<button type="button" class="uw-btn uw-btn--small" data-act="show"' + (p.geo ? "" : " disabled") + ">Find comps on the map</button></div></div>" +
      (v.comps.length ? '<p class="uw-hint">' + E(compSummary(v)) + " Rows are never changed or removed automatically.</p>" +
        '<div class="table-scroll"><table class="data-table uw-comps"><thead><tr>' + HEADER.map((h) => '<th scope="col" class="uw-sheetcol">' + E(h) + "</th>").join("") +
        '<th scope="col" class="uw-x">Baths</th><th scope="col" class="uw-x">Area</th><th scope="col" class="uw-x">Beach position</th><th scope="col" class="uw-x">Distance to target</th><th scope="col" class="uw-x">Match</th><th scope="col" class="uw-x">Audit</th><th scope="col" class="uw-x"><span class="uw-sr">Remove</span></th></tr></thead><tbody>' +
        rows + "</tbody></table></div>" + (orderDiffers ? '<p class="uw-hint uw-order-note">Order differs on current data: sorted by the sheet’s revenue (what each row carries into the sheet); the workbook’s current revenue would order some rows differently.</p>' : "") : empty) + "</section>";
  }
  function compSummary(v) {
    const n = v.comps.length, cnt = {};
    v.comps.forEach((c) => (cnt[c.cls] = (cnt[c.cls] || 0) + 1));
    const errs = v.comps.filter((c) => !c.valid);
    const big = v.comps.filter((c) => c.valid && c.bigRevenue).length, beds = v.comps.filter((c) => c.valid && c.bedroomsChanged).length;
    const errParts = Object.keys(UWRules.CLASSES).filter((k) => !UWRules.CLASSES[k].valid && cnt[k]).map((k) => cnt[k] + " " + UWRules.CLASSES[k].short);
    return n + " comps: " + (cnt.usable || 0) + " usable, " + (cnt.possibly || 0) + " possibly good, " + errs.length + " error" + (errs.length === 1 ? "" : "s") + (errParts.length ? " (" + errParts.join(", ") + ")" : "") +
      ", " + big + " changed by more than 15%" + (beds ? ", " + beds + " with a different bedroom count" : "") + ".";
  }
  UW.geoMiles = (g, l) => window.UWGeo.miles(g.lat, g.lng, l.lat, l.lng);

  function checksHtml(p, v) {
    const items = v.checks.map((c) => "<li>" + E(c.text) + "</li>");
    if (!p.geo) items.unshift('<li class="uw-warn">No map pin: the geocoder could not match ' + E(p.address) + ". Place it on the map, or add it to data/geocode_overrides.json.</li>");
    else if (p.geo.approximate) items.unshift("<li>The geocoder only matched a shortened address (" + E(p.geo.query || "") + "). Check the pin.</li>");
    if (v.comps.length) items.unshift("<li><strong>Comp audit:</strong> " + E(compSummary(v)) + "</li>");
    if (p.kind === "underwritten" && v.source === "sheet") {
      const res = UWMath.verify(v.base);
      const fails = res.rows.filter((r) => r.result === "FAIL" && r.key !== "principal");
      items.push("<li>Formula check: recalculating this sheet from its inputs " + (fails.length ? "<strong>does not match</strong> on " + fails.map((r) => E(r.label)).join(", ") : "matches its own outputs") +
        (res.rows.some((r) => r.key === "principal" && r.result === "FAIL") ? " (apart from Principal Pay Down; see the note above)" : "") + ".</li>");
    }
    return '<section class="uw-box uw-box--checks" id="uw-checks-' + E(p.id) + '"><h4>Data checks</h4>' + (items.length ? '<ul class="uw-checklist">' + items.join("") + "</ul>" : '<p class="uw-empty">Nothing to flag.</p>') + "</section>";
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------
  const ctx = (el) => {
    const card = el.closest(".uw-card");
    if (!card) return null;
    const p = UW.property(card.dataset.pid);
    return p ? { p, v: UW.activeVersion(p), card } : null;
  };
  const val = (t) => (t.value === "" ? null : Number(t.value));

  function onInput(e) {
    const t = e.target, c = ctx(t);
    if (!c) return;
    const { p, v } = c;
    const inputs = UW.clone(v.inputs);
    if (t.dataset.in) inputs[t.dataset.in] = ["dpPct", "rate", "closingPct"].includes(t.dataset.in) ? (val(t) == null ? null : val(t) / 100) : val(t);
    else if (t.dataset.rev) inputs.revenue[t.dataset.rev] = val(t);
    else if (t.dataset.setupAmt != null) inputs.setup[+t.dataset.setupAmt].amount = val(t);
    else if (t.dataset.setupLabel != null) inputs.setup[+t.dataset.setupLabel].label = t.value;
    else if (t.dataset.opex != null) inputs.opex[+t.dataset.opex].amount = val(t);
    else if (t.dataset.clean) inputs[t.dataset.clean === "cost" ? "cleaningCost" : "cleaningTurns"] = val(t);
    else if (t.dataset.notes) { UW.setNotes(p.id, v.label, t.value.replace(/\r\n/g, "\n")); return; }
    else if (t.dataset.cnote != null) { const comps = v.comps.map((x) => Object.assign({}, x)); comps[+t.dataset.cnote].notes = t.value; UW.setComps(p.id, v.label, comps, { quiet: true }); return; }
    else if (t.dataset.pnum) {
      const e = Object.assign({}, v.profileEdit || {});
      if (t.value === "") delete e[t.dataset.pnum]; else e[t.dataset.pnum] = Number(t.value);
      UW.setProfile(p.id, v.label, e);
      return;
    }
    else return;
    UW.setInputs(p.id, v.label, inputs);
  }
  function onChange(e) {
    const t = e.target, c = ctx(t);
    if (!c) return;
    if (t.dataset.act === "version") { UW.setVersion(c.p.id, t.value); C.renderCard(c.p.id); return; }
    if (t.dataset.wf) { UW.setPropertyField(c.p.id, "waterfront", t.value); C.renderCard(c.p.id); }
    if (t.dataset.cmatch) { UW.ui.cmatch[c.p.id] = t.value; C.renderCard(c.p.id); }
    // Comp notes were saved as typed and feed nothing else on the card: no re-render.
  }
  function onToggle(e) {
    const d = e.target;
    if (!d.matches || !d.matches("details[data-amort]") || !d.open) return;
    const body = d.querySelector(".uw-amort__body");
    UW.amortization().then((A) => {
      const blk = A[d.dataset.amort];
      if (!blk) { body.innerHTML = '<p class="uw-empty">Not found.</p>'; return; }
      const cols = [9, 10, 11, 12, 13, 14, 15, 16];
      const rows = blk.rows.filter((r) => cols.some((j) => (r[j] || "").trim()));
      body.innerHTML = '<p class="uw-hint">Rows ' + blk.startRow + "–" + blk.endRow + " of " + E(d.dataset.amort) + ", shown as written. This block is never recalculated or edited, and the CSV download copies it byte for byte.</p>" +
        '<div class="uw-amort__scroll"><table class="uw-amort__t"><tbody>' + rows.map((r) => "<tr>" + cols.map((j) => "<td>" + E(r[j] || "") + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
    }).catch(() => { body.innerHTML = '<p class="uw-empty">Couldn’t load the schedule.</p>'; });
  }

  async function onClick(e) {
    const b = e.target.closest("[data-act]");
    if (b && b.dataset.act === "add-listing") { UW.addApi.open(); return; }
    const c = ctx(e.target);
    if (!c) return;
    const { p, v } = c;
    if (!b) {
      // A click on the bare header toggles the card too.
      if (e.target.closest(".uw-card__head") && !e.target.closest("a,button,select,input,label")) toggle(p.id);
      return;
    }
    if (b.disabled) return;
    const act = b.dataset.act, i = +b.dataset.i;
    const comps = () => v.comps.map((x) => Object.assign({}, x));
    switch (act) {
      case "toggle": toggle(p.id); break;
      case "goto-comps":
        UW.ui.expanded.add(p.id); C.renderCard(p.id);
        UW.afterPointer(() => { const n = document.getElementById("uw-comps-" + p.id); if (n) n.scrollIntoView({ behavior: "smooth", block: "start" }); });
        break;
      case "goto-checks":
        UW.ui.expanded.add(p.id); C.renderCard(p.id);
        document.getElementById("uw-checks-" + p.id).scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      case "setup-add": case "setup-extra": case "setup-del": {
        const inputs = UW.clone(v.inputs);
        if (act === "setup-del") inputs.setup.splice(i, 1);
        else if (inputs.setup.length < 15) {
          const ex = (v.base && v.base.extras) || UW.data.uw.properties[0].versions[0].extras || [];
          inputs.setup.push(act === "setup-extra" ? { label: ex[i].label, amount: ex[i].amount } : { label: "", amount: null });
        }
        UW.setInputs(p.id, v.label, inputs);
        C.renderCard(p.id);
        if (act === "setup-add") UW.afterPointer(() => { const n = document.querySelector('#uw-card-' + CSS.escape(p.id) + ' [data-setup-label="' + (inputs.setup.length - 1) + '"]'); if (n) n.focus(); });
        break;
      }
      case "comp-del": { const a = comps(); a.splice(i, 1); UW.setComps(p.id, v.label, a); break; }
      case "comp-update": {
        const a = comps(), k = a.findIndex((x) => UW.compId(x) === b.dataset.id), l = UW.byId.get(b.dataset.id);
        if (l && k >= 0) { a[k] = Object.assign(UW.compFromListing(l, a[k].notes, p), { url: a[k].url }); UW.setComps(p.id, v.label, a); UW.toast("That row now uses the current workbook values"); }
        break;
      }
      case "remove-flagged": UW.actions.removeFlagged(p.id, v.label); break;
      case "start-from": UW.actions.startFrom(p.id, v.label, b.dataset.from); break;
      case "find-nopool": UW.actions.findComps(p.id, v.label, "amenity", 0); break;
      case "append-distance": UW.actions.appendDistance(p.id, v.label); break;
      case "pflag": {
        const e = Object.assign({}, v.profileEdit || {});
        e.flags = Object.assign({}, e.flags || {}, { [b.dataset.f]: +b.dataset.v });
        UW.setProfile(p.id, v.label, e);
        C.renderCard(p.id);
        break;
      }
      case "profile-reset": UW.setProfile(p.id, v.label, null); C.renderCard(p.id); UW.toast("Profile back to what the sheet says"); break;
      case "show": UW.select(p.id, { from: "card", focus: true }); document.getElementById("uw-map").scrollIntoView({ behavior: "smooth", block: "start" }); UW.panelApi.showTab("comps"); break;
      case "copy-comps": UW.actions.copyComps(p.id, v.label); break;
      case "copy-rev": UW.actions.copyRevenue(p.id, v.label); break;
      case "csv": UW.actions.downloadCsv(p.id, v.label); break;
      case "revert":
        if (confirm("Discard the edits to file " + v.label + " for " + p.street + " and go back to the sheet’s own numbers and comps?")) { UW.revert(p.id, v.label); C.renderCard(p.id); }
        break;
      case "pin": UW.mapApi.startPlace(p.id); break;
      case "pin-reset": UW.setPropertyField(p.id, "pin", null); C.renderCard(p.id); break;
      case "osm": UW.addApi.lookupFor(p); break;
      case "edit-listing": UW.addApi.open(p.id); break;
      case "promote":
        UW.updateListing(p.id, { promoted: true }); C.renderList(); UW.toast(p.street + " moved to the underwritten targets. Export your edits to share it."); break;
      case "demote": UW.updateListing(p.id, { promoted: false }); C.renderList(); break;
      case "delete":
        if (confirm("Delete " + p.street + "? This removes it from this browser" + (p.local ? "" : " (it stays in data/underwritten_local.json until that file changes)") + ".")) { UW.deleteListing(p.id); C.renderList(); }
        break;
    }
  }

  function toggle(pid) {
    if (UW.ui.expanded.has(pid)) UW.ui.expanded.delete(pid); else UW.ui.expanded.add(pid);
    C.renderCard(pid);
    UW.afterPointer(() => { const t = document.querySelector("#uw-card-" + CSS.escape(pid) + " .uw-card__toggle"); if (t) t.focus({ preventScroll: true }); });
  }

  // Re-render on state changes.
  let refreshTimer = {};
  UW.on("property", (pid) => { clearTimeout(refreshTimer[pid]); refreshTimer[pid] = setTimeout(() => C.refresh(pid), 30); });
  UW.on("comps", (pid) => { if (pid) C.renderCard(pid); });
  UW.on("listings", () => C.renderList());
  UW.on("select", () => markSelected());
})();
