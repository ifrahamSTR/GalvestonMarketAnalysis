/**
 * Rules shared by the page and the Node tests (window.UWRules / require):
 *  - comp audit classes. Comps are only Airbnb listings in the workbook's
 *    Cleaned_Data sheet (entire homes). Zillow listings are acquisition
 *    targets and never comps; a Zillow URL in a comp table is an error.
 *  - the auto-filled comp note, built from workbook data only;
 *  - comp rows built from a listing (the one path every copy and add uses);
 *  - Analyst Notes parsing, including the target (after-conversion) bedrooms.
 * The build (scripts/build_underwritten.py) classifies the sheets' rows with
 * the same rules; tests/test_underwritten.mjs checks the two agree.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.UWRules = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const SHEET_FLAGS = ["hot_tub", "pool", "game_room", "pickleball", "mini_golf", "sauna", "playground", "waterfront"];
  const FLAG_LABEL = { hot_tub: "Hot tub", pool: "Pool", game_room: "Game room", pickleball: "Pickleball", mini_golf: "Mini golf", sauna: "Sauna", playground: "Playground", waterfront: "Waterfront" };
  const CLASSES = {
    usable: { label: "Usable", valid: true, short: "usable" },
    possibly: { label: "Usable, possibly good", valid: true, short: "possibly good" },
    excluded: { label: "Excluded for data quality", valid: false, short: "Not Good Data" },
    never: { label: "Never scored", valid: false, short: "never scored" },
    room: { label: "Not an entire home", valid: false, short: "not an entire home" },
    removed: { label: "In Removed_Listings", valid: false, short: "in Removed_Listings" },
    missing: { label: "Not in any workbook", valid: false, short: "not in any workbook" },
    badurl: { label: "Not a valid Airbnb URL", valid: false, short: "not a valid URL" },
    zillow: { label: "Zillow URL in a comp table", valid: false, short: "Zillow URL" },
  };
  const ROOM_RE = /airbnb\.[a-z.]+\/rooms\/(?:plus\/)?(\d+)/i;
  const roomId = (url) => { const m = String(url || "").match(ROOM_RE); return m ? m[1] : null; };
  const isZillow = (url) => /(^|[/.@])zillow\.com/i.test(String(url || ""));
  const round2 = (v) => Math.round(v * 100) / 100;
  const num = (v) => (v == null || isNaN(v) ? "—" : String(Math.round(v * 100) / 100));

  function valueChanges(c, cur) {
    const ch = [];
    const cmp = (field, label, old, neu, tol, fmt) => { if (old == null || neu == null || Math.abs(old - neu) > tol) ch.push({ field, label, sheet: old, current: neu, fmt }); };
    cmp("revenue", "Revenue", c.revenue, cur.revenue, 0.51, "money");
    cmp("bedrooms", "Bedrooms", c.bedrooms, cur.bedrooms, 0.01, "num");
    cmp("sleeps", "Sleeps", c.sleeps, cur.sleeps, 0.01, "num");
    cmp("adr", "ADR", c.adr, round2(cur.adr), 0.006, "money2");
    // Several sheets typed occupancy to one decimal (57.9 for 57.93): within 0.05 points is the same value.
    cmp("occupancy", "Occupancy", c.occupancy == null ? null : round2(c.occupancy * 100), round2(cur.occ * 100), 0.051, "pctpts");
    SHEET_FLAGS.forEach((f) => cmp("HAS_" + f, "HAS_" + f, c.flags && c.flags[f] ? 1 : 0, cur.flagSet.has(f) ? 1 : 0, 0, "flag"));
    return ch;
  }

  /**
   * Exactly one class per comp row.
   * ctx: { byId: Map(id -> listing in comps.json, i.e. Cleaned_Data entire homes),
   *        index: {id: {cls, reason}} from the build, badUrls: {cell text: {reason, candidates}} }
   */
  function classify(c, ctx) {
    const url = String(c.url || "").trim();
    const make = (cls, extra) => Object.assign({ cls, label: CLASSES[cls].label, valid: CLASSES[cls].valid, reason: "", id: null, changes: [],
      bigRevenue: false, bedroomsChanged: false, revenueChangePct: null, current: null }, extra || {});
    if (isZillow(url)) return make("zillow", { reason: "A Zillow listing is an acquisition target, never a comp" });
    const id = roomId(url);
    if (!id) {
      const b = (ctx.badUrls || {})[url];
      return make("badurl", { reason: b ? b.reason : url ? "The cell holds text, not an airbnb.com/rooms/ link" : "The cell is empty", candidates: b ? b.candidates : [] });
    }
    const cur = ctx.byId.get(id);
    if (cur) {
      const changes = valueChanges(c, cur);
      const pct = c.revenue ? (cur.revenue - c.revenue) / c.revenue : null;
      return make(cur.quality === "Good" ? "usable" : "possibly", { id, reason: cur.quality === "Good" ? "Good Data" : "Possibly Good Data", changes, current: cur,
        revenueChangePct: pct == null ? null : Math.round(pct * 1000) / 10, bigRevenue: pct != null && Math.abs(pct) > 0.15,
        bedroomsChanged: c.bedrooms != null && Math.abs(cur.bedrooms - c.bedrooms) > 0.01 });
    }
    const ix = (ctx.index || {})[id];
    if (ix && CLASSES[ix.cls] && !CLASSES[ix.cls].valid) return make(ix.cls, { id, reason: ix.reason, title: ix.title, appearsIn: ix.appearsIn || [] });
    return make("missing", { id, reason: "Not among the entire homes in the current workbook's Cleaned_Data" });
  }

  // The comp picker (map, lists, add-to-set) only ever offers Cleaned_Data entire homes.
  const canPick = (id, byId) => !!id && byId.has(String(id));

  function miles(lat1, lng1, lat2, lng2) {
    const R = 3958.8, rad = Math.PI / 180;
    const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /** "5BR/3BA · sleeps 16 · pool + hot tub · Bay / canal · West Galveston · 0.8 mi from 6513 Golf Crest Dr" (workbook data only). */
  function autoNote(l, areaName, target) {
    const f = l.flagSet || new Set(l.flags || []);
    const am = [];
    if (f.has("pool")) am.push(f.has("pool_heater") ? "heated pool" : "pool");
    [["hot_tub", "hot tub"], ["game_room", "game room"], ["pickleball", "pickleball"], ["mini_golf", "mini golf"], ["sauna", "sauna"], ["playground", "playground"]]
      .forEach(([k, t]) => { if (f.has(k)) am.push(t); });
    const parts = [(l.bedrooms === 0 ? "Studio" : num(l.bedrooms) + "BR") + "/" + num(l.baths) + "BA", "sleeps " + num(l.sleeps)];
    if (am.length) parts.push(am.join(" + "));
    parts.push(l.loc);
    if (areaName) parts.push(areaName);
    if (target && target.lat != null) parts.push(Math.max(0.1, Math.round(miles(target.lat, target.lng, l.lat, l.lng) * 10) / 10).toFixed(1) + " mi from " + target.street);
    return parts.join(" · ");
  }

  /** The comp row a listing becomes, in the sheet's units (every copy and add path goes through here). */
  function rowFromListing(l, notes) {
    const f = l.flagSet || new Set(l.flags || []);
    return { url: l.url, id: l.id, revenue: l.revenue, bedrooms: l.bedrooms, sleeps: l.sleeps, adr: round2(l.adr), occupancy: Math.round(l.occ * 10000) / 10000,
      flags: Object.fromEntries(SHEET_FLAGS.map((k) => [k, f.has(k) ? 1 : 0])), notes: notes || "" };
  }

  /** Analyst Notes -> as-listed bed / bath, lot, size, "why" bullets, and the target bedrooms after conversion. */
  function parseNotes(text) {
    const t = text || "";
    const grab = (re) => { const m = t.match(re); return m ? m[1].trim() : null; };
    const bb = grab(/Bed\s*\/\s*Bath\s*\(projected\)\s*:\s*([^\n]*)/i), lot = grab(/Lot Size\s*\(sqft\)\s*:\s*([^\n]*)/i), size = grab(/Prop Size\s*\(sqft\)\s*:\s*([^\n]*)/i);
    const out = { bedBathText: bb, lotText: lot, sizeText: size, beds: null, baths: null, lot: null, size: null, targetBeds: null, targetBaths: null, targetFrom: null };
    const m = bb && bb.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*(.*)$/);
    if (m) { out.beds = +m[1]; out.baths = +m[2]; out.bedBathComment = m[3].trim() || null; }
    // "(I want 5)", "(5 BR with garage to bunk conversion)", "(4 BR ...)": the converted count is the target.
    const cm = out.bedBathComment || "";
    const w = cm.match(/\bwant\s+(\d+)/i) || cm.match(/(\d+)\s*(?:BR|bed(?:room)?s?)\b/i);
    out.targetBeds = w ? +w[1] : out.beds;
    out.targetFrom = w ? "notes: " + cm.replace(/^\(|\)$/g, "") : out.beds != null ? "as listed" : null;
    out.targetBaths = out.baths;
    [["lot", lot], ["size", size]].forEach(([k, s]) => { const n = (s || "").match(/^([\d,]+(?:\.\d+)?)\s*(.*)$/); if (n) { out[k] = +n[1].replace(/,/g, ""); out[k + "Comment"] = n[2].replace(/^[\s,]+|[\s,]+$/g, "") || null; } });
    const why = t.includes("Why This Property?") ? t.split("Why This Property?")[1] : "";
    out.why = why.split("\n").map((s) => s.trim()).filter((s) => s.startsWith("--")).map((s) => s.slice(2).replace(/^[\s,]+|[\s,]+$/g, "")).filter(Boolean);
    return out;
  }

  return { SHEET_FLAGS, FLAG_LABEL, CLASSES, roomId, isZillow, valueChanges, classify, canPick, miles, autoNote, rowFromListing, parseNotes };
});
