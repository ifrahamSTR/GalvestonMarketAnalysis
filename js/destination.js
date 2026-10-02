/**
 * Section 4 — Why location changes the rate. A short destination primer: one
 * clickable Leaflet map of the few demand areas that matter, a side panel
 * (why guests choose it, season / trip type, why it matters here), a
 * one-row season strip and the bridge back to the location analysis.
 *
 * The engine is shared across market sites; the content (DEST_AREAS,
 * DEST_KIND, DEST_POINTS, DEST_SEASON, DEST_BRIDGE, DEST_SOURCES, DEST_LEDE)
 * lives in data.js. "Why it matters here" lines compute their numbers from
 * LOCATION (region_data.js).
 */
function renderDestinationSection() {
  const host = document.getElementById("destination-body");
  if (!host || typeof L === "undefined" || typeof DEST_AREAS !== "function") return;
  const areas = DEST_AREAS();
  const lede = document.getElementById("dest-lede");
  if (lede) lede.innerHTML = DEST_LEDE;
  host.innerHTML =
    '<div class="dest-layout"><div id="dest-map" class="dest-map" role="application" aria-label="Map of ' + MARKET_NAME + ' demand areas"></div>' +
    '<div class="dest-side"><div class="dest-chips">' + areas.map((a) => '<button type="button" class="dest-chip" data-id="' + a.id + '" style="--dot:' + DEST_KIND[a.kind][1] + '">' + a.name + "</button>").join("") +
    '<button type="button" class="dest-chip dest-chip--all" data-id="all" style="--dot:#9aa5ad">Whole market</button></div>' +
    '<div id="dest-panel" class="dest-panel" aria-live="polite"></div></div></div>';

  const map = L.map("dest-map", { scrollWheelZoom: false, zoomSnap: 0.25 });
  const narrow = host.clientWidth < 560;
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 17, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
  const layers = {};
  areas.forEach((a) => {
    const color = DEST_KIND[a.kind][1];
    layers[a.id] = a.zones.map((z) => {
      const c = L.circle([z.lat, z.lng], { radius: z.r, color: color, weight: 2, fillColor: color, fillOpacity: 0.12 }).addTo(map).on("click", () => select(a.id, true));
      const tip = narrow && z.tipShort ? z.tipShort : z.tip;
      if (tip) c.bindTooltip(tip, { permanent: true, direction: z.dir || "top", className: "dest-tip", offset: z.off || [0, 0] });
      return c;
    });
  });
  (typeof DEST_POINTS !== "undefined" ? DEST_POINTS : []).forEach((p) =>
    L.circleMarker([p[0], p[1]], { radius: 4, color: "#fff", weight: 1, fillColor: p[3] || "#C0473F", fillOpacity: 1 }).bindTooltip(p[2]).addTo(map));
  const allBounds = L.latLngBounds(areas.flatMap((a) => a.zones.map((z) => [z.lat, z.lng]))).pad(0.15);
  map.fitBounds(allBounds);

  function select(id, zoom) {
    if (id === "all") {
      map.flyToBounds(allBounds, { duration: 0.6 });
      host.querySelectorAll(".dest-chip").forEach((b) => b.classList.toggle("is-active", b.dataset.id === "all"));
      return;
    }
    const a = areas.find((x) => x.id === id);
    if (zoom) map.flyToBounds(L.latLngBounds(layers[id].map((l) => l.getBounds())).pad(0.6), { maxZoom: 14, duration: 0.6 });
    Object.entries(layers).forEach(([key, ls]) => ls.forEach((l) => l.setStyle({ weight: key === id ? 4 : 2, fillOpacity: key === id ? 0.28 : 0.1 })));
    host.querySelectorAll(".dest-chip").forEach((b) => b.classList.toggle("is-active", b.dataset.id === id));
    document.getElementById("dest-panel").innerHTML =
      '<p class="dest-panel__kind" style="color:' + DEST_KIND[a.kind][1] + '">' + DEST_KIND[a.kind][0] + "</p><h3>" + a.name + "</h3>" +
      "<dl><dt>Why guests choose it</dt><dd>" + a.why + "</dd><dt>Main season / trip type</dt><dd>" + a.season + "</dd><dt>Why it matters here</dt><dd>" + a.matters + "</dd></dl>" +
      (a.tags && a.tags.length ? '<p class="dest-panel__boxes">' + a.tags.map((t) => '<span class="dest-box dest-box--loc">' + t + "</span>").join("") + "</p>" : "");
  }
  host.querySelectorAll(".dest-chip").forEach((b) => b.addEventListener("click", () => select(b.dataset.id, true)));
  select(areas[0].id);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const S = DEST_SEASON;
  document.getElementById("dest-season").innerHTML =
    '<div class="dest-strip">' + months.map((m, i) => '<div class="dest-strip__m dest-strip__m--' + S.months[i] + '">' + (S.marks && S.marks[i] ? "<small>" + S.marks[i] + "</small>" : "") + "<span>" + m + "</span></div>").join("") + "</div>" +
    '<div class="dest-strip__legend">' + S.legend.map((l) => '<span class="dest-key-item"><span class="dest-key dest-key--' + l[0] + '"></span>' + l[1] + "</span>").join("") + "</div>" +
    '<p class="caption">' + S.caption + "</p>";

  const bridge = document.getElementById("dest-bridge");
  if (bridge) bridge.innerHTML = DEST_BRIDGE.map((b) => "<p><strong>" + b[0] + "</strong> → " + b[1] + "</p>").join("");
  document.getElementById("dest-sources").innerHTML = "Sources (researched " + DEST_RESEARCHED + "): " + DEST_SOURCES.map((s) => '<a href="' + s.url + '" target="_blank" rel="noopener">' + s.label + "</a>").join(" · ");
}
