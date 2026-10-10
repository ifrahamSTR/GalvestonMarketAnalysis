/**
 * Property cards: one expandable card per property, in two groups
 * (Underwritten, New listings). The collapsed header carries the decision
 * numbers (price, revenue cases, cash on cash, the 20% revenue-to-price
 * screen and the 4% low-case target); the expanded body holds every input,
 * the returns / taxes / 5-year blocks, the comp-set builder and the actions.
 *
 * Editing never re-renders the field being typed in: inputs update the state,
 * and only the derived numbers ([data-d] slots) are redrawn.
 */
/* global UWCsv, UWMath */
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
    let n = v.checks.length + v.comps.filter((c) => c.status !== "match").length;
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
    const kind = p.kind === "new" ? '<span class="uw-tag uw-tag--new">New listing</span>' : p.kind === "promoted" ? '<span class="uw-tag uw-tag--new">Promoted · from this browser</span>' : "";
    const edited = v.edited.inputs && p.kind === "underwritten" ? '<span class="uw-tag uw-tag--edit" title="Numbers recalculated from edited inputs">Edited · recalculated</span>' :
      UW.editSource(p.id, v.label) && p.kind === "underwritten" ? '<span class="uw-tag uw-tag--edit">Edited</span>' : "";
    const nChecks = checkCount(p, v);
    const versionSel = p.versions.length > 1 ? '<label class="uw-vsel"><span>Version</span><select data-act="version" data-focus="ver-' + E(p.id) + '" aria-label="Sheet version for ' + E(p.street) + '">' +
      p.versions.map((x) => '<option value="' + E(x.label) + '"' + (x.label === v.label ? " selected" : "") + ">File " + E(x.label) + (x.label === p.defaultVersion ? " (latest)" : "") + "</option>").join("") + "</select></label>" :
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
      '<span class="uw-fact"><b>' + beds + "</b> bed / bath projected</span>" +
      (p.place ? '<span class="uw-fact"><span class="region-dot" style="background:' + (UW.areaById[p.place.area] || {}).color + '"></span>' + E(p.place.areaName) + "</span>" +
        '<span class="uw-fact"><span class="uw-dot" style="background:' + UW.LOC_COLORS[p.place.loc] + '"></span>' + E(p.place.loc) + " · " + E(p.place.zone) + "</span>" : '<span class="uw-fact uw-fact--warn">No map pin</span>') + "</div>" +
      '<div class="uw-head__kpis"><div class="uw-kpi"><span class="uw-kpi__l">Revenue · low / mid / high</span><span class="uw-kpi__v">' + revs + "</span></div>" +
      '<div class="uw-kpi"><span class="uw-kpi__l">Cash on cash · low / mid / high</span><span class="uw-kpi__v">' + cocs + "</span></div>" +
      '<div class="uw-head__badges">' + screen + target + (nChecks ? '<button type="button" class="uw-badge uw-badge--check" data-act="goto-checks">' + nChecks + " data check" + (nChecks === 1 ? "" : "s") + "</button>" : "") + "</div></div>";
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
    return out;
  }

  function statsHtml(p, v) {
    const s = UW.compStats(p, v);
    if (!s.n) return '<p class="uw-empty">No comps chosen yet. Add them from the map or the nearest-comps list.</p>';
    const tile = (val, lab) => '<div class="uw-stat"><strong>' + val + "</strong><span>" + lab + "</span></div>";
    return '<div class="uw-stats">' + tile(s.n, "comps chosen") + tile(F.k(s.median), "median revenue") + tile(F.k(s.p25) + "–" + F.k(s.p75), "middle half") +
      tile(F.k(s.max), "highest") + tile(s.sameArea == null ? "—" : s.sameArea + " of " + s.known, "in the same area") + tile(s.sameLoc == null ? "—" : s.sameLoc + " of " + s.known, "same beach position") + "</div>" +
      '<p class="uw-hint">These are the chosen comps’ revenue figures as they sit in the comp table. They are there to help you set the cases; the page never sets them.</p>';
  }

  function detailsHtml(p, v) {
    const d = v.details, L = p.listing && p.listing.facts;
    const row = (k, val) => (val == null || val === "" ? "" : "<dt>" + k + "</dt><dd>" + val + "</dd>");
    const comment = (c) => (c ? ' <span class="muted">' + E(c) + "</span>" : "");
    const geo = p.geo ? F.num(+p.geo.lat.toFixed(5)) + ", " + F.num(+p.geo.lng.toFixed(5)) + ' <span class="muted">(' + E(p.pinEdited ? "placed by hand" : p.geoNote || "") + ")</span>" : '<span class="uw-warn">No pin yet</span>';
    return '<dl class="uw-dl">' +
      row("Bed / bath (projected)", d.beds != null ? F.num(d.beds) + " / " + F.num(d.baths) + comment(d.bedBathComment) : E(d.bedBathText || "")) +
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
    const details = '<section class="uw-box"><h4>Property details</h4><div data-d="details">' + d.details + "</div>" +
      '<div class="uw-form uw-form--tight"><label for="wf-' + pid + '">Waterfront type</label><select id="wf-' + pid + '" data-wf="1" data-focus="' + pid + '-wf">' +
      UW.WATERFRONT_TYPES.map((t) => '<option value="' + t + '"' + (p.waterfront === t ? " selected" : "") + ">" + (t === "Bay-canal" ? "Bay / canal" : t === "None" ? "Not on the water" : t) + "</option>").join("") + "</select></div>" +
      '<p class="uw-hint">Can’t be read reliably from an address, so it defaults to the beach position and you can change it. It drives “Match this property”.</p>' +
      '<div class="uw-actions uw-actions--tight">' + (p.geo ? '<button type="button" class="uw-btn uw-btn--small uw-btn--ghost" data-act="pin">Adjust pin</button>' :
        '<button type="button" class="uw-btn uw-btn--small" data-act="pin">Place pin on the map</button><button type="button" class="uw-btn uw-btn--small uw-btn--ghost" data-act="osm">Look up with OpenStreetMap</button>') +
      (p.pinEdited && isUW ? '<button type="button" class="uw-linkbtn" data-act="pin-reset">Use the geocoded pin</button>' : "") + "</div></section>";

    const comps = compsHtml(p, v);
    const checks = checksHtml(p, v);
    const amort = isUW ? '<details class="uw-amort" data-amort="' + E(v.file) + '"><summary>Amortization schedule, copied from the sheet (file ' + E(v.label) + ")</summary><div class=\"uw-amort__body\"><p class=\"uw-hint\">Loading…</p></div></details>" : "";
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
      '<p class="uw-hint">The CSV starts from ' + (isUW ? "this property’s own sheet (" + E(v.file) + ")" : E(UW.data.uw.templateFile)) + " and replaces only the input cells: notes, URL, price, down payment, rate, closing, setup items, OPEX items, revenue cases and comp rows. " +
      "Totals and returns keep the source’s values until the inputs are entered in the Google Sheet; the amortization block is copied unchanged.</p>";

    return '<div class="uw-grid uw-grid--top">' + revenue + '<section class="uw-box uw-box--ret" data-d="returns">' + d.returns + "</section></div>" +
      '<div class="uw-grid uw-grid--2"><section class="uw-box"><h4>Taxes</h4><div data-d="taxes">' + d.taxes + '</div></section><section class="uw-box"><h4>5-year</h4><div data-d="five">' + d.five + "</div></section></div>" +
      '<div class="uw-grid uw-grid--3">' + purchase + setup + opex + "</div>" +
      '<div class="uw-grid uw-grid--2">' + notes + details + "</div>" +
      comps + checks + amort + actions;
  }

  // ---------------------------------------------------------------------------
  // Comp set builder
  // ---------------------------------------------------------------------------
  const STATUS = {
    match: ["good", "Matches the workbook"], changed: ["warn", "Workbook values changed"], missing: ["bad", "Not in the current data"],
    "other-room": ["bad", "A private or hotel room"], unrecognised: ["bad", "Not an Airbnb room link"],
  };
  function changeText(c) {
    const f = (x, t) => (x == null ? "blank" : t === "money" ? F.money(x) : t === "money2" ? F.money2(x) : t === "pctpts" ? F.num(x) + "%" : F.num(x));
    return c.changes.map((ch) => E(ch.label) + " " + f(ch.sheet, ch.fmt) + " → " + f(ch.current, ch.fmt)).join("; ");
  }
  function compsHtml(p, v) {
    const pid = E(p.id);
    const rows = v.comps.map((c, i) => {
      const l = UW.byId.get(c.id);
      const st = STATUS[c.status];
      const dist = l && p.geo ? F.mi(UW.geoMiles(p.geo, l)) : "";
      const sub = l ? E(l.loc) + " · " + E(UW.areaById[l.area].name) + (dist ? " · " + dist : "") : "";
      return '<tr class="uw-comp uw-comp--' + c.status + '"><td class="uw-comp__n">' + (i + 1) + "</td>" +
        '<th scope="row" class="uw-comp__l"><a href="' + E(c.url) + '" target="_blank" rel="noopener">' + E(l ? l.title : c.url.replace(/^https?:\/\/(www\.)?/, "")) + '</a><span class="cell-sub">' + sub + "</span></th>" +
        "<td>" + F.money(c.revenue) + "</td><td>" + F.num(c.bedrooms) + "</td><td>" + F.num(c.sleeps) + "</td><td>" + F.money2(c.adr) + "</td><td>" + (c.occupancy == null ? "—" : F.pct(c.occupancy)) + "</td>" +
        '<td class="uw-comp__flags">' + UWCsv.SHEET_FLAGS.map((f) => UW.icon(f, UW.AMEN_LABEL[f], !!(c.flags && c.flags[f]))).join("") + "</td>" +
        '<td class="uw-comp__notes"><textarea rows="2" data-cnote="' + i + '" aria-label="Notes for comp ' + (i + 1) + '" data-focus="' + pid + "-cn" + i + '">' + E(c.notes) + "</textarea></td>" +
        '<td class="uw-comp__st"><span class="uw-badge uw-badge--' + st[0] + '">' + st[1] + "</span>" +
        (c.status === "changed" ? '<span class="uw-comp__ch">' + changeText(c) + '</span><button type="button" class="uw-linkbtn" data-act="comp-update" data-i="' + i + '">Use current workbook values</button>' : "") +
        (c.status === "missing" ? '<span class="uw-comp__ch">Not among the ' + UW.listings.length + " entire homes in the " + E(UW.data.comps.snapshot) + " workbook.</span>" : "") +
        (c.status === "other-room" ? '<span class="uw-comp__ch">In Cleaned_Data, but not an entire home, so it is left out of the comps.</span>' : "") + "</td>" +
        '<td class="uw-comp__act"><button type="button" class="uw-btn uw-btn--icon" data-act="comp-up" data-i="' + i + '" aria-label="Move comp ' + (i + 1) + ' up"' + (i ? "" : " disabled") + ">↑</button>" +
        '<button type="button" class="uw-btn uw-btn--icon" data-act="comp-down" data-i="' + i + '" aria-label="Move comp ' + (i + 1) + ' down"' + (i < v.comps.length - 1 ? "" : " disabled") + ">↓</button>" +
        '<button type="button" class="uw-btn uw-btn--icon" data-act="comp-del" data-i="' + i + '" aria-label="Remove comp ' + (i + 1) + '">×</button></td></tr>';
    }).join("");
    const counts = {};
    v.comps.forEach((c) => (counts[c.status] = (counts[c.status] || 0) + 1));
    return '<section class="uw-box uw-box--comps"><div class="uw-box__head"><h4>Comp set <span class="muted">' + v.comps.length + " of 15 rows</span></h4>" +
      '<div class="uw-comps__tools"><button type="button" class="uw-btn uw-btn--small uw-btn--ghost" data-act="comp-sort"' + (v.comps.length > 1 ? "" : " disabled") + ">Sort by revenue, high to low</button>" +
      '<button type="button" class="uw-btn uw-btn--small" data-act="show"' + (p.geo ? "" : " disabled") + ">Find comps on the map</button></div></div>" +
      (v.comps.length ? '<p class="uw-hint">' + Object.entries(counts).map(([k, n]) => n + " " + STATUS[k][1].toLowerCase()).join(" · ") + ". Rows are never updated automatically.</p>" +
        '<div class="table-scroll"><table class="data-table uw-comps"><thead><tr><th>#</th><th>Listing</th><th>Revenue</th><th>Beds</th><th>Sleeps</th><th>Nightly rate</th><th>Occupancy</th><th>Flags in the sheet</th><th>Notes</th><th>Against the workbook</th><th></th></tr></thead><tbody>' +
        rows + "</tbody></table></div>" : '<p class="uw-empty">No comps yet. Select this property on the map, then add listings from the nearest-comps list or a listing’s popup.</p>') + "</section>";
  }
  UW.geoMiles = (g, l) => window.UWGeo.miles(g.lat, g.lng, l.lat, l.lng);

  function checksHtml(p, v) {
    const items = v.checks.map((c) => "<li>" + E(c.text) + "</li>");
    if (!p.geo) items.unshift('<li class="uw-warn">No map pin: the geocoder could not match ' + E(p.address) + ". Place it on the map, or add it to data/geocode_overrides.json.</li>");
    else if (p.geo.approximate) items.unshift("<li>The geocoder only matched a shortened address (" + E(p.geo.query || "") + "). Check the pin.</li>");
    const bad = v.comps.filter((c) => c.status !== "match");
    if (bad.length) items.push("<li>" + bad.length + " comp row" + (bad.length === 1 ? "" : "s") + " differ from the current workbook or are missing from it (see the comp set).</li>");
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
    else return;
    UW.setInputs(p.id, v.label, inputs);
  }
  function onChange(e) {
    const t = e.target, c = ctx(t);
    if (!c) return;
    if (t.dataset.act === "version") { UW.setVersion(c.p.id, t.value); C.renderCard(c.p.id); return; }
    if (t.dataset.wf) { UW.setPropertyField(c.p.id, "waterfront", t.value); C.renderCard(c.p.id); }
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
      case "comp-up": case "comp-down": { const a = comps(), j = act === "comp-up" ? i - 1 : i + 1; [a[i], a[j]] = [a[j], a[i]]; UW.setComps(p.id, v.label, a); break; }
      case "comp-del": { const a = comps(); a.splice(i, 1); UW.setComps(p.id, v.label, a); break; }
      case "comp-sort": UW.setComps(p.id, v.label, comps().sort((x, y) => (y.revenue || 0) - (x.revenue || 0))); break;
      case "comp-update": {
        const a = comps(), l = UW.byId.get(a[i].id);
        if (l) { a[i] = Object.assign(UW.compFromListing(l, a[i].notes), { url: a[i].url }); UW.setComps(p.id, v.label, a); UW.toast("Row " + (i + 1) + " now uses the current workbook values"); }
        break;
      }
      case "show": UW.select(p.id, { from: "card", focus: true }); document.getElementById("uw-map").scrollIntoView({ behavior: "smooth", block: "start" }); UW.panelApi.showTab("comps"); break;
      case "copy-comps": UW.copy(UWCsv.compsTSV(v.comps), v.comps.length + " comp row" + (v.comps.length === 1 ? "" : "s") + " (15 columns, tab-separated, no header)"); break;
      case "copy-rev": UW.copy(["low", "mid", "high"].map((k) => (UW.isNum(v.inputs.revenue[k]) ? Math.round(v.inputs.revenue[k]) : "")).join("\t"), "the revenue cases (low, mid, high)"); break;
      case "csv": downloadCsv(p, v); break;
      case "revert":
        if (confirm("Discard the edits to file " + v.label + " for " + p.street + " and go back to the sheet’s own numbers and comps?")) { UW.revert(p.id, v.label); C.renderCard(p.id); }
        break;
      case "pin": UW.mapApi.startPlace(p.id); break;
      case "pin-reset": UW.setPropertyField(p.id, "pin", null); C.renderCard(p.id); break;
      case "osm": UW.addApi.lookupFor(p); break;
      case "edit-listing": UW.addApi.open(p.id); break;
      case "promote":
        UW.updateListing(p.id, { promoted: true }); C.renderList(); UW.toast(p.street + " moved to Underwritten. Export your edits to share it."); break;
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

  async function downloadCsv(p, v) {
    const isUW = p.kind === "underwritten";
    const file = isUW ? v.file : UW.data.uw.templateFile;
    try {
      const text = await UW.sourceCsv(file);
      const model = Object.assign({}, UW.clone(v.inputs), { notes: v.notes, url: isUW ? v.url : p.url, comps: v.comps });
      const out = UWCsv.exportSheet(text, model);
      const stamp = new Date().toISOString().slice(0, 10);
      const name = isUW ? file.replace(/( \(\d+\))?\.csv$/, "") + " - from site " + stamp + ".csv" : "New Market UW'ing - " + p.street.replace(/[\\/:*?"<>|]+/g, "-") + " " + stamp + ".csv";
      UW.download(name, out);
      if (!isUW && !p.listing.downloaded) { UW.updateListing(p.id, { downloaded: true }); C.renderCard(p.id); }
      UW.toast("Downloaded " + name);
    } catch (err) {
      UW.toast("CSV not written: " + err.message, "warn");
    }
  }

  // Re-render on state changes.
  let refreshTimer = {};
  UW.on("property", (pid) => { clearTimeout(refreshTimer[pid]); refreshTimer[pid] = setTimeout(() => C.refresh(pid), 30); });
  UW.on("comps", (pid) => { if (pid) C.renderCard(pid); });
  UW.on("listings", () => C.renderList());
  UW.on("select", () => markSelected());
})();
