/**
 * Location rules for underwritten.html, the same as the Python pipeline
 * (../notebooks/market_common.py and scripts/build_underwritten.py):
 *  - distance to the Gulf: nearest point of data/shoreline.json, measured on
 *    market_common's local km projection;
 *  - area: vote of the 3 nearest Airbnb listings (reproduces the main page's
 *    Ward areas for every listing, leave-one-out), ties to the nearest;
 *  - beach position: Gulf-front within 0.2 km (0.8 km when the home is listed
 *    as Gulf-front), beach walk within 0.6 km, bay / canal when waterfront,
 *    else inland;
 *  - Zillow address from the URL slug.
 * Runs in the browser (window.UWGeo) and in Node.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.UWGeo = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const COS = Math.cos((29.2 * Math.PI) / 180);
  const xy = (lat, lng) => [(lng + 95) * 111 * COS, (lat - 29.2) * 111];
  const SAYS_FRONT = /beachfront|beach front|oceanfront|ocean front|gulf front|gulffront|on the beach|on the sand/;
  const SAYS_WATER = /canal|bayfront|bay front|on the bay|waterfront/;
  const TOWN = new Set(["eastend", "midtown", "westgal"]);
  const CITIES = ["Jamaica Beach", "Tiki Island", "Bayou Vista", "La Marque", "Texas City", "Crystal Beach", "Port Bolivar", "Galveston", "Hitchcock", "Kemah"];

  let shore = null, pts = null;
  function init(shoreline, listings) {
    shore = shoreline.points.map((p) => xy(p[0], p[1]));
    pts = listings.map((l) => ({ xy: xy(l.lat, l.lng), area: l.area }));
  }

  function beachKm(lat, lng) {
    const [x, y] = xy(lat, lng);
    let best = Infinity;
    for (let i = 0; i < shore.length; i++) {
      const dx = shore[i][0] - x, dy = shore[i][1] - y, d = dx * dx + dy * dy;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  function areaOf(lat, lng) {
    const [x, y] = xy(lat, lng);
    const near = [];
    pts.forEach((p) => {
      const d = (p.xy[0] - x) ** 2 + (p.xy[1] - y) ** 2;
      if (near.length < 3 || d < near[near.length - 1].d) {
        near.push({ d, area: p.area });
        near.sort((a, b) => a.d - b.d);
        if (near.length > 3) near.pop();
      }
    });
    const votes = near.map((n) => n.area);
    let best = votes[0], bestN = 0;
    votes.forEach((a) => { const c = votes.filter((v) => v === a).length; if (c > bestN) { best = a; bestN = c; } });
    return best;
  }

  /** waterfront: "Gulf-front" | "Bay-canal" | "None" | null (null = read from the notes text). */
  function classify(lat, lng, notesText, waterfront) {
    const km = beachKm(lat, lng);
    const t = String(notesText || "").toLowerCase();
    const front = waterfront ? waterfront === "Gulf-front" : SAYS_FRONT.test(t);
    const water = waterfront ? waterfront === "Bay-canal" : SAYS_WATER.test(t);
    const gulf = km <= 0.2 || (front && km <= 0.8);
    const walk = !gulf && km <= 0.6;
    const loc = gulf ? "Gulf-front" : walk ? "Beach walk" : water ? "Bay / canal" : "Inland";
    const area = areaOf(lat, lng);
    return { beachKm: Math.round(km * 1000) / 1000, area, town: TOWN.has(area), zone: TOWN.has(area) ? "Town" : "West End", loc,
      waterfrontDefault: { "Gulf-front": "Gulf-front", "Bay / canal": "Bay-canal" }[loc] || "None" };
  }

  // Great-circle miles, for the nearest-comp list.
  function miles(lat1, lng1, lat2, lng2) {
    const R = 3958.8, rad = Math.PI / 180;
    const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  function zillowAddress(url) {
    let path = "";
    try { path = new URL(url).pathname; } catch (e) { return null; }
    const m = path.match(/\/homedetails\/([^/]+)\/(\d+)_zpid/);
    if (!m) return null;
    let tok = m[1].split("-");
    let state = "TX", zip = null;
    if (tok.length >= 4 && /^[A-Z]{2}$/.test(tok[tok.length - 2]) && /^\d{5}$/.test(tok[tok.length - 1])) {
      state = tok[tok.length - 2]; zip = tok[tok.length - 1]; tok = tok.slice(0, -2);
    }
    let city = null;
    for (const c of CITIES) {
      const ct = c.split(" ");
      if (tok.slice(-ct.length).map((t) => t.toLowerCase()).join(" ") === c.toLowerCase()) { city = c; tok = tok.slice(0, -ct.length); break; }
    }
    if (!city && tok.length > 1) { city = tok[tok.length - 1]; tok = tok.slice(0, -1); }
    const st = [];
    tok.forEach((t) => { if (st.length && t === "2" && st[st.length - 1] === "1") st[st.length - 1] = "1/2"; else st.push(t); });
    const street = st.join(" ");
    return { zpid: m[2], street, city, state, zip, address: street + ", " + city + ", " + state + (zip ? " " + zip : "") };
  }

  function zillowKey(url) {
    try {
      const u = new URL(url);
      return (u.host.replace(/^www\./, "") + u.pathname.replace(/\/+$/, "")).toLowerCase();
    } catch (e) { return null; }
  }

  return { xy, init, beachKm, areaOf, classify, miles, zillowAddress, zillowKey };
});
