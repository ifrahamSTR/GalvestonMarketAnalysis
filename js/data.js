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
 * against the notebook output for the 2026-01-28 snapshot.
 */
function photo(relPath, alt, caption) {
  return { file: "assets/" + relPath, alt: alt, caption: caption };
}
const MARKET_NAME = "Galveston, TX";
const _ls = (s, l) => LOCATION.locSize[s][l];
const _area = (name) => LOCATION.areas.find((a) => a.name === name);
const _lad = (s) => LOCATION.ladder.find((r) => r.size === s);
const _x = (c) => fmtX(c.idx);

// ---------------------------------------------------------------------------
// Overview (top of page)
// ---------------------------------------------------------------------------
const HERO = {
  title: "In Galveston, the beach sets the rate",
  sub: (() => {
    const f3 = _ls("3BR", "Gulf-front"), i3 = _ls("3BR", "Inland"), f4 = _ls("4BR", "Gulf-front"), i4 = _ls("4BR", "Inland");
    return "Bedroom count sets the baseline. Where the house sits against the Gulf, and whether it is in town or on the West End, decides whether it beats that baseline. " +
      "A 3BR on the first row earns about " + fmtK(f3.median) + " against " + fmtK(i3.median) + " inland; a 4BR, " + fmtK(f4.median) + " against " + fmtK(i4.median) + ". " +
      "This page covers the market, location by bedroom size, why guests choose each part of the island, and who they are. Buy boxes come next.";
  })(),
};

const FOOTER_NOTE = () =>
  "Preliminary. No property has been underwritten and no buy box has been set. Revenue figures are gross Revenue Potential benchmarks from the market dataset (" +
  MARKET_STATS.n + " entire-home listings, " + MARKET_STATS.snapshot + " snapshot), not a full underwriting model.";

// ---------------------------------------------------------------------------
// Section 2 — Market context (researched; see sources)
// ---------------------------------------------------------------------------
// MARKET_OVERVIEW is defined below the analysis config (research section).

const DISTRIBUTION_NOTE = () => {
  const t = LOCATION.top10BySize, big = LOCATION.sizes[LOCATION.sizes.length - 1];
  const total = Object.values(t).reduce((a, b) => a + b, 0);
  return "Most listings earn well under " + fmtK(REVENUE_DISTRIBUTION.p75) + "; the Top 10% starts at " + fmtCurrency(REVENUE_DISTRIBUTION.p90) + ". Size explains most of that tail: " +
    t[big] + " of the " + total + " Top 10% listings are 5BR+, and no 1–2BR reaches it.";
};

const LADDER_NOTE = () => {
  const s = _lad("1-2BR"), b = _lad("5BR+");
  return "Each step up in bedrooms adds revenue, and a 5BR+ earns about " + Math.round(b.median / s.median) + "× a 1–2BR (" + fmtK(b.median) + " vs " + fmtK(s.median) +
    "). Nightly rates climb with size while occupancy holds near " + _lad("3BR").occ + "%. Because size moves revenue this much, every location comparison below is made within the same size.";
};

const DRIVERS_NOTE =
  "<strong>Screening signals, not proven uplift.</strong> Each row compares listings with and without a feature on two measures: how often they reach the top quarter <em>for their size</em>, and what they earn against a typical home their size (1.00× = typical). Pools and hot tubs cluster on the West End, so part of their signal is location.";

const DRIVER_ROWS = [
  { key: "Gulf-front", label: "Gulf-front (first row)", group: "Location", note: "The strongest location signal on the island." },
  { key: "Bay / canal", label: "On the bay or a canal", group: "Location", note: "Nearly as strong as the first row. Mostly Jamaica Beach and Far West End canal homes." },
  { key: "West End (past the Seawall)", label: "West End (past the Seawall)", group: "Location", note: "Leaving town for the West End pays at every size." },
  { key: "Inland", label: "Inland (600 m+ from the Gulf)", group: "Location", note: "The weakest position: fewer than 1 in 10 reach the top quarter." },
  { key: "pool", label: "Pool", group: "Amenity", note: "A clear signal, partly because pools are concentrated on the West End." },
  { key: "hot_tub", label: "Hot tub", group: "Amenity", note: "A clear signal, strongest for 1–3BR homes." },
  { key: "pool_heater", label: "Heated pool", group: "Amenity", note: "Few homes have one, and they do well: it lengthens the swim season." },
  { key: "outdoor_dining_area", label: "Outdoor dining area", group: "Amenity", note: "Expected: homes without one lag." },
  { key: "game_room", label: "Game room", group: "Amenity", note: "Only a small difference on its own." },
  { key: "Superhost", label: "Superhost", group: "Operations", note: "Little difference in revenue against size." },
];

// ---------------------------------------------------------------------------
// Section 3 — Location by bedroom size
// ---------------------------------------------------------------------------
const MAP_CONFIG = {
  lede:
    "Bedroom count sets the baseline; location decides whether a home beats it. Every comparison here is within the same size: <strong>1.00× = what a typical Galveston home that size earns</strong>. Two things carry the location effect: <strong>where the house sits against the Gulf</strong> (first row, a short walk, on the bay or a canal, or inland), and <strong>town versus West End</strong> (the Seawall ends near 103rd Street).",
  marketInterpretation:
    "<strong>Tick one bedroom size</strong> in the bottom-left panel to see where that size earns. Green = top quarter for its size, grey = bottom quarter; bigger dots = more bedrooms. Click an area outline for its numbers by size. The seven areas are clusters of listing coordinates, used as reference geography only.",
};

const LOC_READS = {
  "1-2BR": "Being near the beach helps; inland homes lag. This is mostly an in-town product, and it never reaches the market's Top 10%.",
  "3BR": "The water is the product: first row or a canal earns about 1.5× typical; the same house inland earns about 0.8×.",
  "4BR": "The biggest first-row premium in the market, from both a higher rate and fuller calendars.",
  "5BR+": "Beach position matters less. Large homes earn on headcount, and the West End address matters more than the first row.",
  "All sizes": "Size-adjusted, so this row isn't just the bigger houses talking.",
};

const AREA_GRID_NOTE = () => {
  const town = ["East End & Downtown", "Midtown", "West Galveston"].map(_area), west = ["Seawall End", "Bermuda & Pirates Beach", "Jamaica Beach", "Far West End"].map(_area);
  const rng = (arr) => fmtX(Math.min(...arr.map((a) => a.idx))) + "–" + fmtX(Math.max(...arr.map((a) => a.idx)));
  return "<strong>Town versus West End is the dividing line.</strong> The three in-town areas (behind the Seawall) earn " + rng(town) + " typical for their sizes; the four West End areas earn " + rng(west) +
    ". Town holds " + town.reduce((n, a) => n + a.n, 0) + " of the " + MARKET_STATS.n + " listings and most of the 1–2BR supply. A dash means fewer than 3 homes.";
};

const SIZE_GUIDE = {
  "1-2BR": {
    head: "An in-town product: buy near the beach, not inland.",
    look: "Near the beach: a short walk to the Seawall in the East End & Downtown (the largest pool of this size, close to the Strand and the cruise terminals), or the West End, where the few 1–2BRs earn well above typical.",
    avoid: "Inland Midtown and West Galveston, the weakest pockets for this size.",
    proof: () => "Beach walk " + fmtK(_ls("1-2BR", "Beach walk").median) + " (" + _x(_ls("1-2BR", "Beach walk")) + ") · inland " + fmtK(_ls("1-2BR", "Inland").median) + " (" + _x(_ls("1-2BR", "Inland")) + ")",
  },
  "3BR": {
    head: "On the water, ideally on the West End.",
    look: "First row on the Gulf, or a bay / canal home. Jamaica Beach is the strongest area for this size.",
    avoid: "Inland 3BRs, especially in West Galveston.",
    proof: () => "Gulf-front " + fmtK(_ls("3BR", "Gulf-front").median) + " (" + _x(_ls("3BR", "Gulf-front")) + ") · canal " + fmtK(_ls("3BR", "Bay / canal").median) + " · inland " + fmtK(_ls("3BR", "Inland").median) + " (" + _x(_ls("3BR", "Inland")) + ")",
  },
  "4BR": {
    head: "First row on the Gulf is most of the story.",
    look: "Gulf-front on the West End: Jamaica Beach, Seawall End or the Far West End.",
    avoid: "Beach-walk or inland 4BRs in town, which earn below typical.",
    proof: () => "Gulf-front " + fmtK(_ls("4BR", "Gulf-front").median) + " (" + _x(_ls("4BR", "Gulf-front")) + ") · beach walk " + fmtK(_ls("4BR", "Beach walk").median) + " · inland " + fmtK(_ls("4BR", "Inland").median),
  },
  "5BR+": {
    head: "A West End address; the first row matters less.",
    look: "Jamaica Beach, Seawall End and the Far West End, where large homes earn above typical for their size.",
    avoid: "Large homes in town, which earn well below typical for their size.",
    proof: () => {
      const j = areaCellOf("Jamaica Beach", "5BR+"), e = areaCellOf("East End & Downtown", "5BR+"), m = areaCellOf("Midtown", "5BR+");
      return "Jamaica Beach " + fmtK(j.median) + " (" + j.n + " homes) · Midtown " + fmtK(m.median) + " · East End " + fmtK(e.median);
    },
  },
};

// ---------------------------------------------------------------------------
// Section 5 — Demographics
// ---------------------------------------------------------------------------
const DEMOGRAPHICS_NOTE = () => {
  const b = DEMOGRAPHICS.byBedroom, one = b.find((r) => r.label === "1BR"), big = b.find((r) => r.label === "5BR");
  const town = DEMOGRAPHICS.byArea.find((r) => r.label === "East End & Downtown"), far = DEMOGRAPHICS.byArea.find((r) => r.label === "Far West End");
  return "These are review-derived signals, not verified demographics. Galveston is a family beach market: kids appear in " + Math.round(DEMOGRAPHICS.marketWide.kids) + "% of reviews. " +
    "Group trips climb with size, from under 1% at 1BR to " + Math.round(big.group) + "% at 5BR. Couples and other trips (the \"Other\" share) dominate small units (" + Math.round(one.other) + "% at 1BR). " +
    "By area, the West End is more family- and pet-heavy (Far West End: " + Math.round(far.kids) + "% kids, " + Math.round(far.pet) + "% pets), while the East End & Downtown has the most \"Other\" trips (" + Math.round(town.other) + "%), consistent with couples, cruise and Strand stays.";
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
    "The Seawall and the Pleasure Pier, Galveston. Photo: Patrick Feller, Wikimedia Commons (CC BY 2.0)."
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
    "🌀 <strong>Hurricane season overlaps the peak (June–November).</strong> Hurricane Beryl (July 2024) cut July hotel-tax revenue by 38%. 2025 brought no direct hit, so the trailing year in this dataset reads like a clean season.",
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
const DEST_LEDE = "Why guests pay more in some parts of the island, and why large homes still work away from the first row. Click an area.";
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
  const ee1 = ac("East End & Downtown", "1-2BR"), eeAll = _area("East End & Downtown"), wg = _area("West Galveston");
  const west = ["Seawall End", "Bermuda & Pirates Beach", "Jamaica Beach", "Far West End"].map(_area);
  const wmin = Math.min(...west.map((a) => a.idx)), wmax = Math.max(...west.map((a) => a.idx));
  return [
    {
      id: "eastend", name: "East End, Downtown & the Strand", kind: "town", tags: ["Strongest in-town area for 1–2BR"],
      zones: [{ lat: 29.3065, lng: -94.7905, r: 1100, tip: "Strand & cruise port", dir: "top" }],
      why: "The Strand, Pier 21 and the Victorian districts, a short ride from the cruise terminals on Harborside Drive.",
      season: "Year-round: one- or two-night stays before and after a cruise, plus festival weekends (Mardi Gras, Lone Star Rally, Dickens on the Strand).",
      matters: "The island's largest pool of 1–2BRs (" + ee1.n + " homes), and the only in-town area where they earn about typical for their size (" + fmtX(ee1.idx) + "). 4BR+ homes here earn below typical.",
    },
    {
      id: "seawall", name: "Central Seawall & Stewart Beach", kind: "seawall", tags: ["Beach walk"],
      zones: [{ lat: 29.2885, lng: -94.7865, r: 1300, tip: "Seawall & Pleasure Pier", dir: "bottom" }],
      why: "The beach directly across Seawall Boulevard: the Pleasure Pier, Stewart Beach, East Beach and the Seawall restaurants.",
      season: "March to September: spring break, summer family weekends and Mardi Gras parades.",
      matters: "In town, the walk to the Seawall is what separates small homes: across the island a 1–2BR within a short walk of the beach earns " + fmtK(ls("1-2BR", "Beach walk").median) + " (" + fmtX(ls("1-2BR", "Beach walk").idx) + "), inland " + fmtK(ls("1-2BR", "Inland").median) + " (" + fmtX(ls("1-2BR", "Inland").idx) + ").",
    },
    {
      id: "moody", name: "Moody Gardens, Schlitterbahn & 61st St", kind: "family", tags: ["Context"],
      zones: [{ lat: 29.2735, lng: -94.8455, r: 1100, tip: "Moody Gardens & Schlitterbahn", dir: "left" }],
      why: "The Moody Gardens pyramids and hotel (open all year), Schlitterbahn waterpark in summer, the convention center and 61st Street services.",
      season: "Summer family weekends; Moody Gardens all year.",
      matters: "Attractions draw families, but they don't lift rates the way the beach does: West Galveston homes nearby earn the least for their size of any area (" + fmtX(wg.idx) + ").",
    },
    {
      id: "westend", name: "West End beaches (Seawall end to San Luis Pass)", kind: "westend", tags: ["3BR+ on the first row", "5BR+"],
      zones: [{ lat: 29.1985, lng: -94.9505, r: 2700, tip: "West End beaches", dir: "bottom", off: [30, 40] }, { lat: 29.1385, lng: -95.0535, r: 2900, tip: "" }],
      why: "Wide, quieter beaches past the end of the Seawall, larger beach houses and Galveston Island State Park. About half the island's registered STRs are here.",
      season: "Memorial Day to Labor Day, plus spring break: week-long family and group stays. Quiet in winter.",
      matters: "Every West End area earns above typical for its size (" + fmtX(wmin) + "–" + fmtX(wmax) + "), and a Gulf-front 4BR reaches " + fmtK(ls("4BR", "Gulf-front").median) + ". Jamaica Beach is a separate city with its own STR registration.",
    },
    {
      id: "bay", name: "Bay side & canals", kind: "bay", tags: ["Bay / canal"],
      zones: [{ lat: 29.2165, lng: -94.9425, r: 800, tip: "" }, { lat: 29.1915, lng: -94.9815, r: 900, tip: "Bay side & canals", dir: "top", off: [-30, -30] }, { lat: 29.1475, lng: -95.0395, r: 900, tip: "" }],
      why: "Canal and dock access to West Bay: fishing (speckled trout, redfish, flounder), boating and kayaking.",
      season: "Spring through fall angler and boater stays; birders during the April migration.",
      matters: "Canal homes earn nearly as much as the first row: a 3BR on a canal earns " + fmtK(ls("3BR", "Bay / canal").median) + " (" + fmtX(ls("3BR", "Bay / canal").idx) + ") against " + fmtK(ls("3BR", "Gulf-front").median) + " on the Gulf.",
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
  ["On the first row, on a canal or on the West End, guests pay for the beach.", "3–4BR homes need the first row or a canal; 5BR+ need the West End."],
  ["In town, the beach is a walk away and the Strand and cruise port fill the calendar.", "1–2BRs work near the Seawall and downtown; inland homes lag."],
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
