/**
 * Content/config layer for the Galveston, TX market & location page
 * (Sections 2-5; no buy boxes yet). Same template as the Park City and
 * Charlotte sites, organised around bedroom size: every location comparison
 * is made within a size bucket ("vs. typical" = revenue / market median for
 * that size).
 *
 * Prose and config only. Every number shown is read from js/region_data.js
 * (generated from notebooks/galveston_overview.ipynb); prose that quotes a
 * number computes it from that data. Qualitative statements were checked
 * against the notebook output for the 2026-10-02 workbook
 * ("Galveston - TX (2).xlsx", 923 entire homes), after the shoreline fix,
 * and against the town / West End cut (LOCATION.zoneLocSize): the first-row
 * premium for 3BRs is a West End effect (town has too few first-row 4BR+
 * homes to compare), so prose never presents the pooled island figure as if
 * it held in town. The studio first-row figure rests largely on one six-unit
 * condo building (same coordinates), so prose doesn't sell a studio premium.
 */
function photo(relPath, alt, caption) {
  return { file: "assets/" + relPath, alt: alt, caption: caption };
}
const MARKET_NAME = "Galveston, TX";
const _ls = (s, l) => LOCATION.locSize[s][l];
const _zl = (z, s, l) => LOCATION.zoneLocSize[z][s][l];
const _zs = (z, s) => LOCATION.zoneSize[z][s];
const _area = (name) => LOCATION.areas.find((a) => a.name === name);
const _lad = (s) => LOCATION.ladder.find((r) => r.size === s);
const _x = (c) => fmtX(c.idx);
const TOWN_AREAS = ["East End & Downtown", "Midtown", "West Galveston"];
const WEST_AREAS = ["Seawall End", "Pirates Beach", "Jamaica & Indian Beach", "Far West End"];

// ---------------------------------------------------------------------------
// Overview (top of page)
// ---------------------------------------------------------------------------
const HERO = {
  title: "In Galveston, the water and the West End set the rate",
  sub: (() => {
    const f3 = _zl("West End", "3BR", "Gulf-front"), w3 = _zl("West End", "3BR", "Beach walk"), f4 = _zl("West End", "4BR", "Gulf-front"), w4 = _zl("West End", "4BR", "Beach walk");
    return "Bedroom count sets the baseline. Where the house sits against the water, and whether it is in town or on the West End, decides whether it beats that baseline. " +
      "On the West End, a 3BR on the first row earns about " + fmtK(f3.median) + " against " + fmtK(w3.median) + " a short walk back; a 4BR, " + fmtK(f4.median) + " against " + fmtK(w4.median) + ". " +
      "In town, the first row lifts 2BRs, but larger homes there mostly earn at or below typical. " +
      "This page covers the market, location by bedroom size, why guests choose each part of the island, and who they are. Buy boxes come next.";
  })(),
};

const FOOTER_NOTE = () =>
  "Preliminary. No property has been underwritten and no buy box has been set. Revenue figures are gross Revenue Potential benchmarks from the market dataset (" +
  MARKET_STATS.n + " entire-home listings, " + MARKET_STATS.snapshot + " snapshot" + (MARKET_STATS.otherRooms ? "; the dataset's " + MARKET_STATS.otherRooms + " private and hotel rooms are left out" : "") + "), not a full underwriting model.";

// ---------------------------------------------------------------------------
// Section 2 — Market context (researched; see sources)
// ---------------------------------------------------------------------------
// MARKET_OVERVIEW is defined below the analysis config (research section).

const DISTRIBUTION_NOTE = () => {
  const t = LOCATION.top10BySize;
  const total = Object.values(t).reduce((a, b) => a + b, 0), big = t["4BR"] + t["5BR+"];
  const two = t["2BR"] === 0 ? "no 2BR" : t["2BR"] === 1 ? "only 1 is a 2BR" : "only " + t["2BR"] + " are 2BRs";
  return "Most listings earn well under " + fmtK(REVENUE_DISTRIBUTION.p75) + "; the Top 10% starts at " + fmtCurrency(REVENUE_DISTRIBUTION.p90) + ". Size explains most of that tail: " +
    big + " of the " + total + " Top 10% listings are 4BR or larger (" + t["5BR+"] + " are 5BR+), " + two + ", and no studio or 1BR reaches it.";
};

const LADDER_NOTE = () => {
  const s = _lad("Studio-1BR"), b = _lad("5BR+"), occ = LOCATION.ladder.map((r) => r.occ);
  return "Each step up in bedrooms adds revenue, and a 5BR+ earns about " + Math.round(b.median / s.median) + "× a studio or 1BR (" + fmtK(b.median) + " vs " + fmtK(s.median) +
    "). Nightly rates climb with size while occupancy stays near half the nights at every size (" + Math.min(...occ) + "–" + Math.max(...occ) + "%). Because size moves revenue this much, every location comparison below is made within the same size.";
};

const DRIVERS_NOTE =
  "<strong>Screening signals, not proven uplift.</strong> Each row compares listings with and without a feature on two measures: how often they reach the top quarter <em>for their size</em>, and what they earn against a typical home their size (1.00× = typical). Pools are most common on the Far West End and in Jamaica Beach, so part of their signal is location: compared within the same zone and size, a pool still stands out in town but adds much less on the West End.";

const DRIVER_ROWS = [
  { key: "Gulf-front", label: "Gulf-front (first row)", group: "Location", note: "The strongest location signal for 2BRs in town and for 3BR and up on the West End; in town, first-row 3BR+ homes earn about typical or below." },
  { key: "Bay / canal", label: "On the bay or a canal", group: "Location", note: "Strong, a step below the first row. Mostly Jamaica Beach and Far West End canal homes." },
  { key: "West End (past the Seawall)", label: "West End (past the Seawall)", group: "Location", note: "Leaving town for the West End pays at every size." },
  { key: "Inland", label: "Inland (600 m+ from the Gulf)", group: "Location", note: "The weakest position on the island." },
  { key: "pool_heater", label: "Heated pool", group: "Amenity", note: "Few homes have one, and most of those reach the top quarter; a heated pool can stretch the swim season." },
  { key: "hot_tub", label: "Hot tub", group: "Amenity", note: "A clear signal at every size." },
  { key: "pool", label: "Pool", group: "Amenity", note: "A clear signal in town at every size. On the West End, where pools are common, the gap is much smaller (pool 3–4BRs earn about a tenth more) and disappears at 5BR+." },
  { key: "outdoor_dining_area", label: "Outdoor dining area", group: "Amenity", note: "Expected: homes without one lag." },
  { key: "game_room", label: "Game room", group: "Amenity", note: "Game-room homes earn a little more overall only because more of them are on the West End; within town or within the West End they earn the same." },
  { key: "Superhost", label: "Superhost", group: "Operations", note: "Superhosts reach the top quarter more often. Island-wide a typical one earns about the same, but only because more of them are in town; within town or within the West End, Superhosts earn somewhat more." },
];

// ---------------------------------------------------------------------------
// Section 3 — Location by bedroom size
// ---------------------------------------------------------------------------
const MAP_CONFIG = {
  lede:
    "Bedroom count sets the baseline; location decides whether a home beats it. Every comparison here is within the same size: <strong>1.00× = what a typical Galveston home that size earns</strong>. Two things carry the location effect: <strong>where the house sits against the water</strong> (first row on the Gulf, a short walk, on the bay or a canal, or inland), and <strong>town versus West End</strong> (the Seawall ends near 103rd Street). “First row” means within about 200 m of the beach; in town that mostly means the first block or two behind Seawall Boulevard. The two work together: for 3BRs the first-row premium is a West End effect, and almost all first-row 4BR and larger homes are on the West End, so town has too few to compare.",
  marketInterpretation:
    "In the bottom-left panel (tap “show” on a phone), <strong>untick all but one bedroom size</strong> to see where that size earns. Green = top quarter for its size, gold = middle half, grey = bottom quarter; bigger dots = more bedrooms. Click an area outline for its numbers by size. The seven areas are clusters of listing coordinates, used as reference geography only.",
};

const LOC_READS = {
  "Studio-1BR": "Mostly an in-town product, and none reach the market's Top 10%. Near the beach is about typical and inland lags; the first-row figure rests largely on one six-unit condo building.",
  "2BR": "In town, the first row pays, a short walk is only typical and inland lags. On the West End, 2BRs on a canal or the first row beat typical; a short walk back is only about typical.",
  "3BR": "On the West End the water is the product: the first row or a canal earns well above typical. In town, even the first row earns below typical for this size.",
  "4BR": "The biggest first-row premium in the market, almost all of it on the West End, and it comes mostly from a higher nightly rate. Canal homes also beat typical, but by less.",
  "5BR+": "The first row still pays, and the address matters too: on the West End large homes hold near typical even off the first row; in town they fall below.",
  "All sizes": "The × figures are size-adjusted; the dollar figures still mix sizes (canal homes run larger).",
};

const AREA_GRID_NOTE = () => {
  const town = TOWN_AREAS.map(_area), west = WEST_AREAS.map(_area);
  const rng = (arr) => fmtX(Math.min(...arr.map((a) => a.idx))) + "–" + fmtX(Math.max(...arr.map((a) => a.idx)));
  return "<strong>Town versus West End is the dividing line.</strong> The three in-town areas (behind the Seawall) earn " + rng(town) + " typical for their sizes; the four West End areas earn " + rng(west) +
    ". Town holds " + town.reduce((n, a) => n + a.n, 0) + " of the " + MARKET_STATS.n + " listings and most of the studio-to-2BR supply. A dash means fewer than 3 homes.";
};

const SIZE_GUIDE = {
  "Studio-1BR": {
    head: "An in-town product: buy near the beach, not inland.",
    look: "The East End & Downtown, a short walk from the beach: the largest pool of this size and its strongest part of town, close to the Strand and the cruise terminals.",
    avoid: "Inland Midtown.",
    proof: () => "Beach walk " + fmtK(_ls("Studio-1BR", "Beach walk").median) + " (" + _x(_ls("Studio-1BR", "Beach walk")) + ") · inland " + fmtK(_ls("Studio-1BR", "Inland").median) + " (" + _x(_ls("Studio-1BR", "Inland")) + "). The first-row figure is mostly one condo building.",
  },
  "2BR": {
    head: "On the water, or on the West End.",
    look: "In town, the first row. On the West End, a canal or the first row; Jamaica & Indian Beach and Pirates Beach have the most 2BRs that beat typical.",
    avoid: "Inland 2BRs in town, especially Midtown.",
    proof: () => "Town first row " + fmtK(_zl("Town", "2BR", "Gulf-front").median) + " (" + _x(_zl("Town", "2BR", "Gulf-front")) + ") · town inland " + fmtK(_zl("Town", "2BR", "Inland").median) + " (" + _x(_zl("Town", "2BR", "Inland")) + ") · West End canal " + fmtK(_zl("West End", "2BR", "Bay / canal").median),
  },
  "3BR": {
    head: "On the water, on the West End.",
    look: "First row or a canal on the West End. Jamaica & Indian Beach is the strongest area with real depth for this size.",
    avoid: "Inland 3BRs in Midtown, which earn well below typical; and the first row in town, which still earns below typical for this size.",
    proof: () => "West End first row " + fmtK(_zl("West End", "3BR", "Gulf-front").median) + " (" + _x(_zl("West End", "3BR", "Gulf-front")) + ") · West End canal " + fmtK(_zl("West End", "3BR", "Bay / canal").median) + " · town first row " + fmtK(_zl("Town", "3BR", "Gulf-front").median) + " (" + _x(_zl("Town", "3BR", "Gulf-front")) + ")",
  },
  "4BR": {
    head: "First row or a canal, on the West End.",
    look: "Gulf-front or canal homes on the West End. Pirates Beach, Seawall End and Jamaica & Indian Beach lead for this size.",
    avoid: "4BRs in town, which earn below typical as a group.",
    proof: () => "West End first row " + fmtK(_zl("West End", "4BR", "Gulf-front").median) + " (" + _x(_zl("West End", "4BR", "Gulf-front")) + ") · West End canal " + fmtK(_zl("West End", "4BR", "Bay / canal").median) + " · town overall " + fmtK(_zs("Town", "4BR").median) + " (" + _x(_zs("Town", "4BR")) + ")",
  },
  "5BR+": {
    head: "A West End address, on the first row if you can.",
    look: "Jamaica & Indian Beach, Seawall End and the Far West End. West End large homes hold near typical even off the first row; Gulf-front ones earn the most.",
    avoid: "Large homes in Midtown and the East End off the first row, which earn below typical for their size.",
    proof: () => "West End first row " + fmtK(_zl("West End", "5BR+", "Gulf-front").median) + " (" + _zl("West End", "5BR+", "Gulf-front").n + " homes) · West End beach walk " + fmtK(_zl("West End", "5BR+", "Beach walk").median) + " · town overall " + fmtK(_zs("Town", "5BR+").median),
  },
};

// ---------------------------------------------------------------------------
// Section 5 — Demographics. Area comparisons are made within the same size
// (DEMOGRAPHICS.byZoneSize), so a bigger-home mix isn't read as a guest mix.
// ---------------------------------------------------------------------------
const DEMOGRAPHICS_NOTE = () => {
  const b = DEMOGRAPHICS.byBedroom, small = b.find((r) => r.label === "Studio-1BR"), big = b.find((r) => r.label === "5BR+");
  const T = DEMOGRAPHICS.byZoneSize["Town"], W = DEMOGRAPHICS.byZoneSize["West End"], r = (v) => Math.round(v);
  return "These are review-derived signals, not verified demographics. Galveston is a family beach market: on the average listing, " + r(DEMOGRAPHICS.marketWide.kids) + "% of reviews come from stays with kids. " +
    "Group trips climb with size, from " + (small.group < 1 ? "under 1%" : r(small.group) + "%") + " at studio–1BR to " + r(big.group) + "% at 5BR+, and stays not tagged as family, group or pet trips (the \"Other\" share) dominate small units (" + r(small.other) + "% at studio–1BR). " +
    "Compared size for size, the most consistent difference between town and the West End is pets: West End 3–4BRs get pet stays about twice as often (" + r(W["3BR"].pet) + "% vs " + r(T["3BR"].pet) + "% at 3BR, " + r(W["4BR"].pet) + "% vs " + r(T["4BR"].pet) + "% at 4BR). " +
    "The family share is about the same at 4BR and up (" + r(W["4BR"].kids) + "% vs " + r(T["4BR"].kids) + "% at 4BR), so the West End's higher overall family share mostly reflects its bigger homes; in-town large homes lean more to group trips (" + r(T["4BR"].group) + "% vs " + r(W["4BR"].group) + "% at 4BR).";
};

// ---------------------------------------------------------------------------
// Section 2 — Market context. Researched 2026-10-02 from the Park Board
// (Tourism Economics 2025 impact study, FY2024 statistical section), the
// Port of Galveston, Visit Galveston, the City of Galveston and the Texas
// Comptroller. Items only found in news summaries are left out.
// ---------------------------------------------------------------------------
const MARKET_OVERVIEW = {
  heroImage: photo(
    "overview/galveston-seawall-pleasure-pier.jpg",
    "The Galveston Seawall walkway and benches with the beach and the Pleasure Pier behind",
    'The Seawall and the Pleasure Pier, Galveston. Photo: Patrick Feller, <a href="https://commons.wikimedia.org/wiki/File:Seawall_Benches_and_Pleasure_Pier,_Galveston,_Texas_1301071119.jpg" target="_blank" rel="noopener">Wikimedia Commons</a>, <a href="https://creativecommons.org/licenses/by/2.0/" target="_blank" rel="noopener">CC BY 2.0</a>.'
  ),
  chips: [
    { label: "9.1M Visitors · $1.3B Spent (2025)" },
    { label: "Texas's Only Cruise Home Port" },
    { label: "32 Miles of Gulf Beaches" },
    { label: "About an Hour from Houston" },
  ],
  attractions: [
    "<strong>Gulf beaches and the Seawall</strong>: 32 miles of beach and the 10.3-mile Seawall, certified by Guinness in 2025 as the world's longest continuous walkway. Stewart Beach and East Beach in town; wider, quieter beaches on the West End.",
    "<strong>The cruise port</strong>: 3.6M passenger movements on 416 sailings in 2025, fourth in the U.S. Carnival, Royal Caribbean, Disney, MSC and Norwegian sail from four terminals on Harborside Drive, which brings pre- and post-cruise nights all year.",
    "<strong>The Strand and historic downtown</strong>: Victorian districts, Pier 21, and the island's big festival weekends (Mardi Gras, Lone Star Rally, Dickens on the Strand).",
    "<strong>Family attractions</strong>: Moody Gardens all year; Schlitterbahn waterpark and the Pleasure Pier rides in season.",
  ],
  visitorStats: {
    headline: "9.1M visitors · $1.32B visitor spending (Galveston, 2025)",
    breakdown: [
      { value: "$1.7B", label: "Total Economic Impact (2025)" },
      { value: "20%", label: "Of Visitors Are Cruise Passengers (1.84M)" },
      { value: "~4,200", label: "Registered STRs (Oct 2025), plus ~690 Unregistered" },
      { value: "46%", label: "Share of the City's Hotel Tax Paid by STRs (FY2024)" },
    ],
  },
  watchOuts: [
    "🌀 <strong>Hurricane season overlaps the peak (June–November).</strong> Hurricane Beryl (July 2024) cut the city's July hotel-tax revenue by 38%. No hurricane has hit Galveston since; a direct hit in peak season would pull a year well below these figures.",
    "🌿 <strong>Sargassum seaweed</strong> was heavy in spring and summer in both 2025 and 2026; the Park Board clears the town beaches ahead of Memorial Day.",
    "🏨 <strong>Hotels softened in 2025</strong> (occupancy fell from about 58% to 52% while their rates rose), and the city's hotel-tax take came in about $1.75M under plan for FY2025. Airbnb revenue rose over the same period.",
    "📋 <strong>The rules changed in late 2025.</strong> The City took over STR registration from the Park Board and adopted an updated ordinance ($250 annual license; registration number required on every listing). Jamaica Beach is a separate city with its own registration.",
  ],
  sources: [
    { label: "Park Board / Tourism Economics (2025 impact)", url: "https://www.galvestonparkboard.org/DocumentCenter/View/3458/Galveston-Tourism-Economic-Impact---2025---CLIENT-FINAL" },
    { label: "Port of Galveston (2026 brochure)", url: "https://portofgalveston.com/wp-content/uploads/2026/03/Galveston-Wharves_Brochure_032026.pdf" },
    { label: "Port of Galveston (2025 review)", url: "https://www.portofgalveston.com/port-reflects-on-a-landmark-2025/" },
    { label: "Visit Galveston (beaches)", url: "https://www.visitgalveston.com/things-to-do/beaches/" },
    { label: "Visit Galveston (Seawall)", url: "https://www.visitgalveston.com/plan-your-trip/maps-neighborhoods/seawall-district/" },
    { label: "Visit Galveston (getting here)", url: "https://www.visitgalveston.com/plan-your-trip/getting-here-transportation/" },
    { label: "Park Board FY2024 statistics", url: "https://www.galvestonparkboard.org/ArchiveCenter/ViewFile/Item/291" },
    { label: "City of Galveston (STR count)", url: "https://galvestontx.gov/DocumentCenter/View/21222/STR-Count-October-1-2025-Source-Rentalscape" },
    { label: "City of Galveston (STR hotel-tax share)", url: "https://galvestontx.gov/DocumentCenter/View/21221/STR-HOT-Data-Source-City-of-Galveston--Park-Board" },
    { label: "City of Galveston (STR ordinance)", url: "https://www.galvestontx.gov/DocumentCenter/View/21313/City-Council-approves-updated-STR-ordinance" },
    { label: "Galveston Daily News (2025 hotel slowdown)", url: "https://www.galvnews.com/news/galveston-hotel-slowdown-drove-dip-in-occupancy-tax-revenue/article_63faa053-d946-4259-a6ea-452dd4d267e5.html" },
  ],
};

// ---------------------------------------------------------------------------
// Section 4 — Why location changes the rate (js/destination.js engine).
// Five combined areas only; "Why it matters here" lines compute from LOCATION.
// ---------------------------------------------------------------------------
const DEST_LEDE = "Why guests pay more in some parts of the island, and why large homes need a West End address, where they hold up even off the first row. Click an area.";
const DEST_RESEARCHED = "2026-10-02";
const DEST_KIND = {
  town: ["Historic town & cruise port", "#C0473F"],
  seawall: ["In-town beach", "#D07A1F"],
  family: ["Attractions", "#8B5FA7"],
  westend: ["West End beach", "#3C6E9E"],
  bay: ["Bay & canals", "#2E7D6B"],
};
function DEST_AREAS() {
  const ac = areaCellOf, ls = _ls;
  const ee1 = ac("East End & Downtown", "Studio-1BR"), mt1 = ac("Midtown", "Studio-1BR"), wg = _area("West Galveston");
  const west = WEST_AREAS.map(_area);
  const wmin = Math.min(...west.map((a) => a.idx)), wmax = Math.max(...west.map((a) => a.idx));
  const c2 = _zl("West End", "2BR", "Bay / canal"), g2 = _zl("West End", "2BR", "Gulf-front");
  return [
    {
      id: "eastend", name: "East End, Downtown & the Strand", kind: "town", tags: ["Strongest part of town for studios & 1BRs"],
      zones: [{ lat: 29.3065, lng: -94.7905, r: 1100, tip: "Strand & cruise port", tipShort: "Strand & port", dir: "top" }],
      why: "The Strand, Pier 21 and the Victorian districts, a short ride from the cruise terminals on Harborside Drive.",
      season: "Year-round: one- or two-night stays before and after a cruise, plus festival weekends (Mardi Gras, Lone Star Rally, Dickens on the Strand).",
      matters: "The island's largest pool of studios and 1BRs (" + ee1.n + " homes) and the strongest part of town for them (" + fmtX(ee1.idx) + ", about typical; Midtown " + fmtX(mt1.idx) + "), helped by one building of first-row condos. 4BR+ homes here earn below typical.",
    },
    {
      id: "seawall", name: "Central Seawall & Stewart Beach", kind: "seawall", tags: ["First row & beach walk"],
      zones: [{ lat: 29.2885, lng: -94.7865, r: 1300, tip: "Seawall & Pleasure Pier", tipShort: "Seawall & Pier", dir: "bottom" }, { lat: 29.3059, lng: -94.767, r: 700, tip: "" }],
      why: "The beach directly across Seawall Boulevard: the Pleasure Pier, Stewart Beach and the Seawall restaurants.",
      season: "March to September: spring break and summer family weekends, plus Mardi Gras parades in February.",
      matters: "In town, closeness to the beach is what separates small homes: a 2BR in town on the first row earns " + fmtK(_zl("Town", "2BR", "Gulf-front").median) + " (" + fmtX(_zl("Town", "2BR", "Gulf-front").idx) + "), a short walk back " + fmtK(_zl("Town", "2BR", "Beach walk").median) + " (" + fmtX(_zl("Town", "2BR", "Beach walk").idx) + "), inland " + fmtK(_zl("Town", "2BR", "Inland").median) + " (" + fmtX(_zl("Town", "2BR", "Inland").idx) + ").",
    },
    {
      id: "moody", name: "Moody Gardens & Schlitterbahn", kind: "family", tags: ["Context"],
      zones: [{ lat: 29.2735, lng: -94.8455, r: 1100, tip: "Moody Gardens & Schlitterbahn", tipShort: "Moody Gardens", dir: "left" }],
      why: "The Moody Gardens pyramids and hotel (open all year), Schlitterbahn waterpark in summer, the convention center and 61st Street services.",
      season: "Summer family weekends; Moody Gardens all year.",
      matters: "Attractions draw families, but they don't lift rates the way the beach does: West Galveston, the area around them, earns below typical for its size (" + fmtX(wg.idx) + ").",
    },
    {
      id: "westend", name: "West End beaches (Seawall end to San Luis Pass)", kind: "westend", tags: ["2BR", "3–4BR on the first row or a canal", "5BR+"],
      zones: [{ lat: 29.1985, lng: -94.9505, r: 2700, tip: "West End beaches", dir: "bottom", off: [30, 40] }, { lat: 29.1385, lng: -95.0535, r: 2900, tip: "" }],
      why: "Wide, quieter beaches past the end of the Seawall, larger beach houses and Galveston Island State Park. The City's District 6, from behind the west Seawall to San Luis Pass, holds about half the City's STRs (Jamaica Beach registers separately).",
      season: "Memorial Day to Labor Day, plus spring break: family and group beach stays. Quiet in winter.",
      matters: "Every West End area earns above typical for its sizes (" + fmtX(wmin) + "–" + fmtX(wmax) + "), and a Gulf-front 4BR here earns " + fmtK(_zl("West End", "4BR", "Gulf-front").median) + ". Jamaica Beach is a separate city with its own STR registration.",
    },
    {
      id: "bay", name: "Bay side & canals", kind: "bay", tags: ["Bay / canal"],
      zones: [{ lat: 29.2165, lng: -94.9425, r: 800, tip: "" }, { lat: 29.1915, lng: -94.9815, r: 900, tip: "Bay side & canals", tipShort: "Canals", dir: "top", off: [-30, -30] }, { lat: 29.1475, lng: -95.0395, r: 900, tip: "" }],
      why: "Canal and dock access to West Bay: fishing (speckled trout, redfish, flounder), boating and kayaking.",
      season: "Spring through fall angler and boater stays; birders during the April migration.",
      matters: "Canal homes are the next-best position after the first row: on the West End a 4BR on a canal earns " + fmtK(_zl("West End", "4BR", "Bay / canal").median) + " against " + fmtK(_zl("West End", "4BR", "Gulf-front").median) + " on the first row" +
        (c2.median > g2.median ? ", and a 2BR on a canal earns more than one on the first row (" + fmtK(c2.median) + " vs " + fmtK(g2.median) + ")" : "") +
        ". For the largest homes the first row pulls well ahead (5BR+: " + fmtK(_zl("West End", "5BR+", "Gulf-front").median) + " vs " + fmtK(_zl("West End", "5BR+", "Bay / canal").median) + " on a canal).",
    },
  ];
}
// Context markers (lat, lng, label, color).
const DEST_POINTS = [
  [29.3159, -94.7827, "Cruise Terminal 10 (Royal Caribbean)"], [29.311, -94.787, "Cruise Terminal 16 (MSC, Norwegian)"],
  [29.3085, -94.7966, "Cruise Terminal 25 (Carnival)"], [29.3078, -94.7998, "Cruise Terminal 28 (Disney)"],
  [29.2866, -94.7899, "Pleasure Pier", "#3C6E9E"], [29.3059, -94.767, "Stewart Beach", "#3C6E9E"],
  [29.3234, -94.7387, "East Beach", "#3C6E9E"], [29.243, -94.866, "West end of the Seawall (~103rd St)", "#3C6E9E"],
  [29.2019, -94.9676, "Galveston Island State Park", "#3C6E9E"], [29.0828, -95.1223, "San Luis Pass", "#3C6E9E"],
  [29.2746, -94.8524, "Moody Gardens", "#8B5FA7"], [29.2709, -94.8514, "Schlitterbahn (seasonal)", "#8B5FA7"],
];
// Month bands from the Park Board's hotel occupancy by month (FY2023, a
// storm-free year: Jun 71%, Jul 74%, Mar 61%, Nov-Jan ~46%) and hotel-tax
// receipts by month (June-August ~40% of the year).
const DEST_SEASON = {
  months: ["low", "mid", "high", "mid", "high", "peak", "peak", "mid", "mid", "mid", "low", "low"],
  marks: ["", "Mardi Gras", "Spring break", "", "Memorial Day", "", "", "", "", "", "Rally", "Dickens"],
  legend: [["peak", "Summer peak"], ["high", "Spring break & early summer"], ["mid", "Shoulder"], ["low", "Winter: cruise nights and festival weekends"]],
  caption: "<strong>Two things to price in:</strong> hurricane season (June–November) overlaps the peak, and Hurricane Beryl cut July 2024 hotel-tax revenue by 38%. Winter runs on cruise nights and a few festival weekends (hotel occupancy around 46%). Bands from Park Board hotel occupancy and hotel-tax receipts by month.",
};
const DEST_BRIDGE = [
  ["On the West End, guests pay for the water: the Gulf or a canal.", "On the West End, 2–4BR homes earn most on the first row or a canal; 5BR+ need the West End, on the first row if possible."],
  ["In town, the Strand and cruise port bring visitors all year, but the beach still sets the rate.", "2BRs earn the most on the first row; studios and 1BRs near the beach earn about typical, and inland homes lag."],
];
const DEST_SOURCES = [
  { label: "Visit Galveston (beaches)", url: "https://www.visitgalveston.com/things-to-do/beaches/" },
  { label: "Visit Galveston (downtown)", url: "https://www.visitgalveston.com/plan-your-trip/maps-neighborhoods/downtown-galveston/" },
  { label: "Port of Galveston (terminals)", url: "https://www.portofgalveston.com/cruise-parking/explore-the-port/" },
  { label: "Visit Galveston (cruise lines)", url: "https://www.visitgalveston.com/cruising/cruise-lines/" },
  { label: "Texas Parks & Wildlife (State Park)", url: "https://tpwd.texas.gov/state-parks/galveston-island" },
  { label: "Park Board FY2024 statistics (monthly occupancy, hotel tax)", url: "https://www.galvestonparkboard.org/ArchiveCenter/ViewFile/Item/291" },
  { label: "Visit Galveston (Lone Star Rally)", url: "https://www.visitgalveston.com/events/annual-events/lone-star-rally/" },
  { label: "City of Galveston (STRs by district)", url: "https://galvestontx.gov/DocumentCenter/View/21222/STR-Count-October-1-2025-Source-Rentalscape" },
];
