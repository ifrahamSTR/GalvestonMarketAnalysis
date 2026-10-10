/**
 * Main page: the "Underwriting" section near the top. One card per acquisition
 * target (the Zillow houses); each opens underwritten.html with that target
 * selected on the map. Numbers are each sheet's own (the default scenario from
 * data/version_labels.json, else the lowest file number), recalculated
 * only where inputs were edited, either in this browser (localStorage) or in
 * the committed data/underwritten_local.json, the same as underwritten.html.
 */
/* global UWMath */
(function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ok = (v) => v != null && isFinite(v);
  const k = (n) => (ok(n) ? "$" + Math.round(n / 1000) + "k" : "—");
  const money = (n) => (ok(n) ? "$" + Math.round(n).toLocaleString("en-US") : "—");
  const pct = (v) => (ok(v) ? (v * 100).toFixed(2).replace("-", "−") + "%" : "—");
  const st = (v) => (!ok(v) ? "none" : v >= 0.04 ? "good" : v >= 0 ? "warn" : "bad");

  function local() {
    try { return JSON.parse(localStorage.getItem("galvestonUW.v1") || "{}") || {}; } catch (e) { return {}; }
  }

  async function render() {
    const host = document.getElementById("uwx-cards");
    if (!host) return;
    let uw;
    try {
      uw = await fetch("data/underwritten.json?v=20261011-uw4").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
    } catch (e) {
      host.innerHTML = '<p class="caption">The underwriting didn’t load here. <a href="underwritten.html">Open the Underwritten Properties page</a>.</p>';
      return;
    }
    const L = local(), C = uw.committed || { listings: [], edits: {} };
    const verEdit = (pid, label) => {
      const c = ((C.edits[pid] || {}).versions || {})[label], l = (((L.edits || {})[pid] || {}).versions || {})[label];
      if (l && l.reverted) return null;
      return c || l ? Object.assign({}, c || {}, l || {}) : null;
    };
    const AREA = { eastend: "East End & Downtown", midtown: "Midtown", westgal: "West Galveston", seawallend: "Seawall End", pirates: "Pirates Beach", jamaica: "Jamaica & Indian Beach", farwest: "Far West End" };
    // A comp row is an error unless the audit (or, for rows added on the map, the picker) says it is a Cleaned_Data entire home.
    const IX = (uw.audit || {}).index || {}, VALID = new Set((uw.audit || {}).valid || ["usable", "possibly"]);
    const isErr = (c) => { const m = String(c.url || "").match(/airbnb\.[a-z.]+\/rooms\/(?:plus\/)?(\d+)/i); if (!m) return true; const ix = IX[m[1]]; return ix ? !VALID.has(ix.cls) : false; };
    const cards = uw.properties.map((p) => {
      const v = p.versions.find((x) => x.label === p.defaultVersion);
      const e = verEdit(p.id, v.label);
      const inputs = (e && e.inputs) || v.inputs;
      const out = e && e.inputs ? UWMath.compute(inputs).cases : v.sheet.cases;
      const comps = (e && e.comps) || v.comps;
      return { id: p.id, street: p.street, sub: p.place ? (p.place.areaName || AREA[p.place.area]) + " · " + p.place.loc : "No map pin yet",
        file: p.versions.length > 1 ? (v.scenario || "File " + v.label) + " · " + p.versions.length + " scenarios" : "File " + v.label,
        price: inputs.price, rev: inputs.revenue, cases: out, edited: !!(e && e.inputs), kind: "uw", errors: comps.filter(isErr).length };
    });
    const del = new Set(L.deleted || []);
    const listings = new Map();
    (C.listings || []).forEach((l) => { if (!del.has(l.id)) listings.set(l.id, l); });
    (L.listings || []).forEach((l) => listings.set(l.id, l));
    listings.forEach((l) => cards.push({ id: l.id, street: l.street, sub: l.promoted ? "Promoted listing" : "New listing", file: l.templateLabel ? "From file " + l.templateLabel : "",
      price: l.inputs.price, rev: l.inputs.revenue, cases: UWMath.compute(l.inputs).cases, edited: false, kind: l.promoted ? "uw" : "new", errors: (l.comps || []).filter(isErr).length }));

    const uwCards = cards.filter((c) => c.kind === "uw");
    const meets = uwCards.filter((c) => st(c.cases.low.coc) === "good").length;
    const screen = uwCards.filter((c) => c.price && ok(c.rev.mid) && c.rev.mid / c.price >= 0.2).length;
    const lede = document.getElementById("uwx-lede");
    if (lede) lede.innerHTML = "<strong>" + uwCards.length + " acquisition targets</strong> underwritten so far. " + meets + " of " + uwCards.length + " meet the 4% low-case cash-on-cash target, and " + screen +
      " pass the 20% revenue-to-price screen in the mid case. Pick one to open it on the map with its nearest $90k+ Airbnb comps, its comp set and the full underwriting.";
    const nErr = cards.reduce((s, c) => s + (c.errors || 0), 0);
    if (lede && nErr) lede.innerHTML += " " + nErr + " comp rows across the sheets are not valid comps (see Data checks).";

    host.innerHTML = cards.map((c) => {
      const ratio = c.price && ok(c.rev.mid) ? c.rev.mid / c.price : null;
      return '<a class="uwx-card uwx-card--' + st(c.cases.low.coc) + (c.kind === "new" ? " uwx-card--new" : "") + '" href="underwritten.html#p=' + encodeURIComponent(c.id) + '">' +
        '<span class="uwx-card__top"><span class="uwx-card__name">' + esc(c.street) + '</span><span class="uwx-card__price">' + money(c.price) + "</span></span>" +
        '<span class="uwx-card__sub">' + esc(c.sub) + (c.file ? " · " + esc(c.file) : "") + (c.edited ? ' · <em>edited</em>' : "") + "</span>" +
        '<span class="uwx-card__row"><span class="uwx-card__l">Revenue · low / mid / high</span><span>' + ["low", "mid", "high"].map((x) => k(c.rev[x])).join(" · ") + "</span></span>" +
        '<span class="uwx-card__row"><span class="uwx-card__l">Cash on cash · low / mid / high</span><span>' + ["low", "mid", "high"].map((x) => '<b class="uwx-coc--' + st(c.cases[x].coc) + '">' + pct(c.cases[x].coc) + "</b>").join(" · ") + "</span></span>" +
        '<span class="uwx-card__badges">' + (c.errors ? '<span class="uwx-b uwx-b--err">' + c.errors + " comp error" + (c.errors === 1 ? "" : "s") + "</span>" : "") +
        (ratio == null ? '<span class="uwx-b uwx-b--none">Revenue not set</span>' : '<span class="uwx-b uwx-b--' + (ratio >= 0.2 ? "good" : "warn") + '">' + (ratio >= 0.2 ? "✓ " : "") + (ratio * 100).toFixed(1) + "% of price</span>") +
        (ok(c.cases.low.coc) ? '<span class="uwx-b uwx-b--' + st(c.cases.low.coc) + '">' + (st(c.cases.low.coc) === "good" ? "✓ meets" : "below") + " 4% low case</span>" : "") +
        '<span class="uwx-card__go" aria-hidden="true">Open →</span></span></a>';
    }).join("");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();
