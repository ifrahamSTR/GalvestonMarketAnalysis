/**
 * Bootstraps underwritten.html: loads the data, restores filters / selection
 * from the URL hash, starts the map, panel, cards, add-listing dialog and
 * data checks, and wires the re-render events between them.
 */
(function () {
  const UW = window.UW, F = UW.fmt;

  function renderHero() {
    const props = UW.properties(), uw = props.filter((p) => p.kind !== "new");
    const meets = uw.filter((p) => UW.cocStatus(UW.activeVersion(p).outputs.cases.low.coc) === "good").length;
    const screen = uw.filter((p) => { const v = UW.activeVersion(p); return v.inputs.price && v.inputs.revenue.mid / v.inputs.price >= UW.SCREEN; }).length;
    const n90 = UW.listings.filter((l) => l.revenue >= 90000).length;
    const tile = (v, l) => '<div class="uw-hstat"><strong>' + v + "</strong><span>" + l + "</span></div>";
    document.getElementById("uw-hero-stats").innerHTML =
      tile(uw.length, "acquisition targets underwritten") + tile(meets + " of " + uw.length, "meet the 4% low-case cash-on-cash target") +
      tile(screen + " of " + uw.length, "pass the 20% revenue-to-price screen (mid case)") + tile(n90, "Airbnb comps earning $90k+, of " + UW.listings.length + " entire homes");
    document.getElementById("uw-footer").innerHTML = "Underwriting from the “New Market UW’ing” Google Sheets (files " + UW.data.uw.generatedFrom.files.map((f) => f.match(/- (\d+)/)[1]).filter((x, i, a) => a.indexOf(x) === i).join(", ") +
      "). Comps from " + UW.esc(UW.data.comps.source.split(",")[0]) + ", snapshot " + UW.esc(UW.data.comps.snapshot) + ", entire homes only. Revenue figures are gross Revenue Potential; the revenue cases are the analyst’s own. " +
      'Map data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>.';
  }

  function initNav() {
    const links = [...document.querySelectorAll(".site-nav a[href^='#']")];
    const obs = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((l) => l.classList.toggle("site-nav__link--active", l.getAttribute("href") === "#" + en.target.id));
    }), { rootMargin: "-40% 0px -55% 0px" });
    links.forEach((l) => { const s = document.querySelector(l.getAttribute("href")); if (s) obs.observe(s); });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      await UW.load();
    } catch (e) {
      document.getElementById("uw-boot").innerHTML = '<p class="uw-error">The page data didn’t load (' + UW.esc(e.message) + "). If you opened the file directly, serve the folder instead: <code>python -m http.server</code>.</p>";
      return;
    }
    UW._hashLock = true;
    UW.readHash();
    UW._hashLock = false;
    // A link that only names a target (e.g. from the main page) ranks comps like it; a shared view keeps its own filters.
    if (UW.ui.selected && !UW._hashHadFilters) UW.ui.filters = UW.matchFilters(UW.property(UW.ui.selected));
    UW.matchSet = new Set(UW.listings.filter((l) => UW.matches(l)).map((l) => l.id));
    document.getElementById("uw-boot").remove();

    UW.mapApi.init();
    UW.panelApi.init();
    UW.cardsApi.init();
    UW.addApi.init();
    UW.checksApi.init();
    renderHero();
    initNav();

    let t = null;
    const refresh = () => { clearTimeout(t); t = setTimeout(() => UW.mapApi.refresh(), 40); };
    ["filters", "near", "comps", "places", "listings"].forEach((ev) => UW.on(ev, refresh));
    UW.on("property", refresh);
    UW.on("property", () => renderHero());
    UW.on("listings", () => renderHero());
    UW.on("select", (e) => {
      UW.mapApi.refresh();
      if (e.pid) UW.mapApi.focus(e.pid);  // from the map or a card: zoom to it and its nearest comps
      UW.panelApi.showTab("comps");
    });
    window.addEventListener("hashchange", () => {
      if (!location.hash.includes("=")) return;  // a plain section anchor (nav link), not a shared view
      UW._hashLock = true; UW.readHash(); UW._hashLock = false;
      UW.matchSet = new Set(UW.listings.filter((l) => UW.matches(l)).map((l) => l.id));
      UW.panelApi.renderAll(); UW.mapApi.refresh();
      if (UW.ui.selected) UW.mapApi.focus(UW.ui.selected);
    });
    window.addEventListener("resize", () => UW.mapApi.invalidate());
    // Arriving from a property link (main page) opens on the map; "#uw-checks" lands on the checks.
    if (UW.ui.selected) {
      document.getElementById("uw-map").scrollIntoView({ block: "start" });
      setTimeout(() => UW.mapApi.focus(UW.ui.selected), 200);
    } else if (location.hash === "#uw-checks") document.getElementById("uw-checks").scrollIntoView({ block: "start" });
  });
})();
