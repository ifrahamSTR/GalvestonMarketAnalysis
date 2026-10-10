// Browser tests for underwritten.html (the rendered page, real clipboard).
//   NODE_PATH=<dir with playwright-core> node tests/test_underwritten_browser.mjs
// Uses the system Chrome (CHROME=/path/to/chrome to override) and serves this
// folder on a free local port. Skips, with a message, if playwright-core is missing.
//  - every comp table: the sheet's 15 headers, exactly; the amenity cells equal
//    the sheet's 0/1 values (all 12 scenarios); rows revenue high to low
//  - copy outputs (copy selected, copy all shown, copy comps, copy row) are revenue high to low,
//    and copy from the map list, a popup and a card give identical lines for one listing
//  - the comp picker never offers a listing outside Cleaned_Data
//  - a Zillow URL in a comp table is flagged; error badges; remove flagged comps; copy warnings
//  - scenarios: labels, default, side-by-side table with comp errors, "start from" / "find no-pool comps"
//  - target profile: prefill sources, 1/0 toggles marked "manual", matching reruns, "Reset to sheet"
//  - two matching modes, each with its own filters: location (same zone and water, beds +/-1,
//    distance order) and amenities (the whole island ranked best to worst, nothing excluded);
//    the target popup's buttons; add from both modes = one row tagged Both; the Match column
//    filter; "Append distance to notes"
//  - no console errors
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let chromium;
try { ({ chromium } = require("playwright-core")); } catch (e) {
  console.log("SKIPPED: playwright-core not found (npm install playwright-core, then run with NODE_PATH pointing at its node_modules).");
  process.exit(0);
}
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const UWJ = JSON.parse(readFileSync(join(ROOT, "data/underwritten.json"), "utf8"));
const COMPS = JSON.parse(readFileSync(join(ROOT, "data/comps.json"), "utf8"));
const HEADER = UWJ.compHeader;
const FLAGS = UWJ.sheetFlags;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".csv": "text/csv", ".webp": "image/webp", ".png": "image/png" };

const server = createServer(async (req, res) => {
  try {
    const path = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
    const file = join(ROOT, path === "/" ? "underwritten.html" : path);
    if (!(await stat(file)).isFile()) throw new Error("not a file");
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch (e) { res.writeHead(404); res.end("not found"); }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = "http://127.0.0.1:" + server.address().port + "/";

let failures = 0;
const check = (ok, msg) => { console.log("  " + (ok ? "ok  " : "FAIL") + " " + msg); if (!ok) failures++; };
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 950 }, locale: "en-US", permissions: ["clipboard-read", "clipboard-write"] });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.text())) errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(e.message));
const ev = (f, a) => page.evaluate(f, a);
const clip = () => ev(() => navigator.clipboard.readText());
const revOfLine = (l) => +l.split("\t")[1];
const isDesc = (xs) => xs.every((x, i) => !i || x <= xs[i - 1]);
async function chooseIfAsked(value) {
  const d = page.locator("#uw-choice[open]");
  if (await d.count()) await d.locator('[data-v="' + value + '"]').click();
}

await page.goto(BASE + "underwritten.html", { waitUntil: "networkidle" });
await ev(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(600);
if (errors.length) console.log("LOAD ERRORS: " + errors.join(" | "));

// ---------------------------------------------------------------------------
console.log("1. Comp tables mirror the sheet (all " + UWJ.properties.reduce((s, p) => s + p.versions.length, 0) + " scenarios)");
let headerOk = true, flagRows = 0, flagBad = 0, orderBad = 0, tables = 0;
for (const p of UWJ.properties) {
  for (const v of p.versions) {
    await ev(([pid, label]) => { UW.ui.versions[pid] = label; UW.ui.expanded.add(pid); UW.cardsApi.renderCard(pid); }, [p.id, v.label]);
    await page.waitForTimeout(40);
    const t = await ev((pid) => {
      const card = document.getElementById("uw-card-" + pid), tbl = card.querySelector(".uw-comps");
      if (!tbl) return null;
      return { head: [...tbl.querySelectorAll("thead th")].slice(0, 15).map((th) => th.textContent.trim()),
        rows: [...tbl.querySelectorAll("tbody tr")].map((tr) => ({ url: tr.dataset.url, rev: tr.dataset.rev === "" ? null : +tr.dataset.rev, adr: tr.dataset.adr === "" ? null : +tr.dataset.adr,
          flags: [...tr.querySelectorAll(".uw-comp__flag .uw-flag")].map((s) => s.textContent.trim()) })) };
    }, p.id);
    if (!v.comps.length) { if (t) { headerOk = false; } continue; }
    tables++;
    if (!t || t.head.join("|") !== HEADER.join("|")) { headerOk = false; console.log("    header mismatch " + p.street + " " + v.label + ": " + (t && t.head.join("|"))); }
    for (const r of t.rows) {
      const sheet = v.comps.find((c) => (c.url || "").trim() === (r.url || "").trim());
      flagRows++;
      const want = FLAGS.map((f) => String(sheet && sheet.flags[f] ? 1 : 0));
      if (!sheet || want.join("") !== r.flags.join("")) { flagBad++; console.log("    flags differ " + p.street + " " + v.label + " " + r.url + ": " + r.flags.join("") + " vs " + want.join("")); }
    }
    const revs = t.rows.map((r) => (r.rev == null ? -Infinity : r.rev));
    if (!isDesc(revs) || t.rows.some((r, i) => i && r.rev === t.rows[i - 1].rev && (r.adr || 0) > (t.rows[i - 1].adr || 0))) { orderBad++; console.log("    order " + p.street + " " + v.label + ": " + revs.join(", ")); }
  }
}
check(headerOk && tables === 11, "every comp table's first 15 headers are exactly the sheet's: " + HEADER.join(" | ") + " (" + tables + " tables; file 97 has none)");
check(flagBad === 0 && flagRows === UWJ.audit.rows.length, "amenity cells equal the sheet's 0/1 values in all " + flagRows + " comp rows");
check(orderBad === 0, "every rendered comp table is sorted by the sheet's revenue, high to low (ties by ADR)");

// ---------------------------------------------------------------------------
console.log("2. Copying from the map");
const OP = "113253500";
await ev(() => UW.cardsApi.renderList());
await ev((pid) => { UW.ui.versions[pid] = "97"; UW.select(pid, { from: "panel" }); UW.panelApi.showTab("comps"); }, OP);
await page.waitForTimeout(700);
const shownIds = await ev(() => [...document.querySelectorAll("#uw-p-comps [data-pick]")].map((i) => i.dataset.pick));
const allowed = new Set(COMPS.listings.map((l) => l.id));
check(shownIds.length > 0 && shownIds.every((id) => allowed.has(id)), "the nearest list offers only Cleaned_Data entire homes (" + shownIds.length + " shown)");
const locRes = await ev((pid) => {
  const p = UW.property(pid), water = UWRules.WATER_LOC[p.waterfront] || [], beds = UW.activeVersion(p).profile.beds;
  const r = UW.mapApi.lastNearest;
  return { mode: UW.ui.mode, n: r.length, zone: p.place.zone, water: p.waterfront, beds,
    ok: r.every((x, i) => (p.place.zone === "Town") === !!x.l.town && water.includes(x.l.loc) && Math.abs(x.l.bedrooms - beds) <= 1 && x.l.revenue >= 90000 && (!i || x.d >= r[i - 1].d)) };
}, OP);
check(locRes.mode === "location" && locRes.n > 0 && locRes.ok, "selecting a target opens Match by location: " + locRes.n + " homes, all " + locRes.zone + " / " + locRes.water + ", " + locRes.beds + " beds ±1, $90k+, nearest first");
await page.click('#uw-p-comps [data-act="pickall"]');
await page.waitForTimeout(200);
await page.click('#uw-p-comps [data-act="copypicked"]');
await page.waitForTimeout(300);
let lines = (await clip()).split("\n");
check(lines.length === shownIds.length && lines.every((l) => l.split("\t").length === 15) && isDesc(lines.map(revOfLine)), "Copy selected: " + lines.length + " rows, 15 columns, revenue high to low (the list itself is in distance order)");
const toast = await ev(() => [...document.querySelectorAll(".uw-toast")].map((t) => t.textContent).pop() || "");
check(/revenue high to low/.test(toast) && /\d+ comp rows/.test(toast), "the toast says how many rows were copied and in which order: “" + toast + "”");
// one listing, three paths
const X = shownIds[0];
await page.click('#uw-p-comps [data-act="copyrow"][data-id="' + X + '"]');
await page.waitForTimeout(200);
const fromList = await clip();
await ev((id) => UW.mapApi.openListing(id), X);
await page.waitForTimeout(500);
await page.click('.leaflet-popup [data-act="pop-copy"][data-id="' + X + '"]');
await page.waitForTimeout(200);
const fromPopup = await clip();
await ev(() => UW.mapApi.map.closePopup());
await page.click('#uw-p-comps [data-act="add"][data-id="' + X + '"]');
await page.waitForTimeout(300);
await ev((pid) => { UW.ui.expanded.add(pid); UW.cardsApi.renderCard(pid); }, OP);
await page.waitForTimeout(200);
await page.click("#uw-card-" + OP + ' [data-act="copy-comps"]');
await page.waitForTimeout(300);
await chooseIfAsked("without");
const fromCard = await clip();
check(fromList === fromPopup && fromPopup === fromCard && fromList.split("\t").length === 15, "copy from the map list, the popup and the card give the identical line for " + X);
// edit a note in the list (session), then copy
await ev(() => UW.panelApi.showTab("comps"));
const Y = shownIds[1];
await page.click('#uw-p-comps [data-act="note-edit"][data-id="' + Y + '"]');
await page.waitForTimeout(150);
await page.fill('#uw-p-comps [data-note="' + Y + '"]', "edited for this session");
await page.click('#uw-p-comps [data-act="note-done"][data-id="' + Y + '"]');
await page.waitForTimeout(150);
await page.click('#uw-p-comps [data-act="copyrow"][data-id="' + Y + '"]');
await page.waitForTimeout(200);
check((await clip()).split("\t")[14] === "edited for this session", "a note edited inline is what gets copied (kept for the session)");
// whole filtered list, no target needed
await ev(() => { UW.select(null); UW.resetFilters(); });
await page.waitForTimeout(300);
await page.click('#uw-p-comps [data-act="copyall"]');
await page.waitForTimeout(300);
lines = (await clip()).split("\n");
const nMatch = await ev(() => UW.matchSet.size);
check(lines.length === Math.min(50, nMatch) && isDesc(lines.map(revOfLine)) && !/ mi from /.test(lines[0]), "Copy all shown with no target: " + lines.length + " of " + nMatch + " rows (capped at 50), revenue high to low, no distance in the note");
const capText = await ev(() => document.querySelector("#uw-p-comps .uw-hint").textContent);
check(/capped at 50/.test(capText), "the cap is stated on the page");

// ---------------------------------------------------------------------------
console.log("3. Audit errors in the UI");
const P95 = "27668637";
await ev((pid) => { UW.ui.expanded.add(pid); UW.cardsApi.renderCard(pid); }, P95);
await page.waitForTimeout(200);
const badge95 = await ev((pid) => document.querySelector("#uw-card-" + pid + " .uw-head__badges .uw-badge--err").textContent, P95);
const firstBadge = await ev((pid) => document.querySelector("#uw-card-" + pid + " .uw-head__badges").firstElementChild.className, P95);
check(badge95 === "2 comp errors" && /uw-badge--err/.test(firstBadge), "16538 Jean Lafitte Rd card: “" + badge95 + "”, ahead of the 20% and 4% badges");
const err95 = await ev((pid) => [...document.querySelectorAll("#uw-card-" + pid + " .uw-comps tbody tr.uw-comp--error")].map((tr) => tr.dataset.cls), P95);
check(err95.length === 2 && err95.includes("badurl") && err95.includes("excluded"), "its comp table keeps both error rows in place, marked red (" + err95.join(", ") + ")");
const listBadge = await ev((pid) => { const b = document.querySelector('#uw-p-targets .uw-trow__main[data-pid="' + pid + '"]').parentElement.querySelector(".uw-badge--err"); return b && b.textContent; }, P95);
check(listBadge === "2 comp errors", "the panel's target list shows the error badge");
await page.click("#uw-card-" + P95 + ' [data-act="copy-comps"]');
await page.waitForTimeout(200);
const dlgShown = await page.locator("#uw-choice[open]").count();
const defBtn = await ev(() => document.activeElement && document.activeElement.dataset.v);
await chooseIfAsked("without");
await page.waitForTimeout(200);
check(dlgShown === 1 && defBtn === "without" && (await clip()).split("\n").length === 1, "Copy comps with errors asks first; the default (focused) choice copies without them");
await page.click("#uw-card-" + P95 + ' [data-act="remove-flagged"]');
await page.waitForTimeout(200);
const lists = await ev(() => document.querySelector("#uw-choice[open]").textContent);
await chooseIfAsked("remove");
await page.waitForTimeout(300);
check(/1639279944613147395/.test(lists) && (await ev((pid) => UW.activeVersion(UW.property(pid)).comps.length, P95)) === 1, "Remove flagged comps lists the rows, then removes only them");
// stats exclude error rows
const ibis = "27700825";
await ev((pid) => { UW.ui.expanded.add(pid); UW.cardsApi.renderCard(pid); }, ibis);
await page.waitForTimeout(150);
const excl = await ev((pid) => (document.querySelector("#uw-card-" + pid + " .uw-excl") || {}).textContent, ibis);
check(excl === "1 excluded", "comp-set stats leave the error row out and say so (5525 Ibis Dr: “" + excl + "”)");
// a Zillow URL dropped into a comp table
await ev((pid) => { const p = UW.property(pid), v = UW.activeVersion(p); UW.setComps(pid, v.label, v.comps.concat([{ url: "https://www.zillow.com/homedetails/6513-Golf-Crest-Dr-Galveston-TX-77551/27662294_zpid/", revenue: 150000, flags: {}, notes: "" }])); }, ibis);
await page.waitForTimeout(300);
const zrow = await ev((pid) => { const tr = document.querySelector('#uw-card-' + pid + ' tr[data-cls="zillow"]'); return tr && tr.querySelector(".uw-comp__st").textContent; }, ibis);
check(!!zrow && /Zillow URL in a comp table/.test(zrow), "a Zillow URL in a comp table is an error row: “" + (zrow || "").slice(0, 60) + "”");
const fake = await ev(() => UW.actions.addComps(UW.data.uw.properties[0].id, UW.data.uw.properties[0].versions[0].label, [{ id: "942992914336390867", url: "https://www.airbnb.com/rooms/942992914336390867", revenue: 1, adr: 1, occ: 0.5, flags: [], flagSet: new Set() }]));
check(fake === 0, "add-to-set refuses a listing outside Cleaned_Data (942992914336390867, Not Good Data)");

// ---------------------------------------------------------------------------
console.log("4. Scenarios");
await ev((pid) => { delete UW.ui.versions[pid]; UW.ui.expanded.add(pid); UW.cardsApi.renderCard(pid); }, OP);
await page.waitForTimeout(200);
const sel = await ev((pid) => { const s = document.querySelector("#uw-card-" + pid + ' select[data-act="version"]'); return [...s.options].map((o) => (o.selected ? "*" : "") + o.textContent); }, OP);
check(sel[0] === "*With pool · file 96" && sel[1] === "Without pool · file 97", "the scenario select reads " + JSON.stringify(sel) + " and opens on With pool (no “latest”)");
const scenCols = await ev((pid) => [...document.querySelectorAll("#uw-card-" + pid + " .uw-scen__t thead th")].map((th) => th.childNodes[0].textContent), OP);
check(scenCols.join("|") === "Scenario|With pool|Without pool", "the card shows the scenarios side by side");
const errRow = await ev((pid) => { const r = [...document.querySelectorAll("#uw-card-" + pid + " .uw-scen__t tbody tr")].find((tr) => /Comp errors/.test(tr.querySelector("th").textContent)); return r && [...r.querySelectorAll("td")].map((td) => td.textContent.trim()); }, OP);
check(!!errRow && errRow.length === 2, "the side-by-side table has a Comp errors row: " + JSON.stringify(errRow));
await ev((pid) => UW.mapApi.openTarget(pid), OP);
await page.waitForTimeout(500);
const pop = await ev(() => { const t = document.querySelector(".uw-tpop"); return t && { zl: !!t.querySelector(".uw-tpop__zl[href*='zillow.com']"), scen: t.querySelectorAll('[data-act="tp-ver"]').length, table: !!t.querySelector(".uw-scen__t"), err: (t.querySelector(".uw-badge--err") || {}).textContent }; });
check(pop && pop.zl && pop.scen === 2 && pop.table && pop.err === "1 comp error", "the target popup: Zillow link, scenario switch, side-by-side table, error badge");
await ev(() => UW.mapApi.map.closePopup());
// file 97: empty state. (Reset this browser's 97 edits first: the copy test above added one comp.)
await ev((pid) => { UW.revert(pid, "97"); UW.ui.versions[pid] = "97"; UW.cardsApi.renderCard(pid); }, OP);
await page.waitForTimeout(200);
const emptyBtns = await ev((pid) => [...document.querySelectorAll("#uw-card-" + pid + " .uw-empty-comps button")].map((b) => b.textContent), OP);
check(emptyBtns.join("|") === "Start from the With pool comp set|Find no-pool comps", "file 97 (no comps) offers: " + emptyBtns.join(" / "));
await page.click("#uw-card-" + OP + ' [data-act="find-nopool"]');
await page.waitForTimeout(600);
const np = await ev(() => ({ mode: UW.ui.mode, pool: UW.ui.amRules.pool, island: UW.matchSet.size, rows: UW.mapApi.lastNearest.map((x) => x.l.flagSet.has("pool")) }));
check(np.mode === "amenity" && np.pool === 0 && np.island === COMPS.listings.length && np.rows.length > 0 && !np.rows[0],
  "“Find no-pool comps” opens Match by amenities with pool = 0: the whole island (" + np.island + ") ranked, no-pool homes first (" + np.rows.filter((h) => !h).length + " of the best " + np.rows.length + " have no pool)");
await page.click("#uw-card-" + OP + ' [data-act="start-from"]');
await page.waitForTimeout(300);
const n97 = await ev((pid) => UW.property(pid).versions.find((v) => v.label === "97").comps.length, OP);
check(n97 === UWJ.properties.find((p) => p.id === OP).versions.find((v) => v.label === "96").comps.length, "“Start from the With pool comp set” copies its " + n97 + " rows into file 97");

// ---------------------------------------------------------------------------
console.log("5. Target profile and the two matching modes");
const GC = "27662294";
await ev((pid) => { UW.ui.expanded.add(pid); UW.select(pid, { from: "panel" }); UW.cardsApi.renderCard(pid); UW.panelApi.showTab("comps"); }, GC);
await page.waitForTimeout(500);
const prof = await ev((pid) => { const box = document.getElementById("uw-profile-" + pid); const pr = UW.activeVersion(UW.property(pid)).profile; return { box: !!box, pool: pr.flags.pool, src: pr.src.flags.pool, hot: pr.src.flags.hot_tub, text: box && box.textContent }; }, GC);
check(prof.box && prof.pool === 1 && /^notes:/.test(prof.src) && /^notes:/.test(prof.hot) && /Comes with pool/.test(prof.text), "6513 Golf Crest Dr profile: pool and hot tub = 1 from the notes, the source shown next to each");
await page.click('#uw-p-comps [data-act="mode"][data-v="amenity"]');
await page.waitForTimeout(500);
const am = await ev(() => ({ mode: UW.ui.mode, n: UW.mapApi.lastNearest.length, island: UW.matchSet.size, minRev: UW.ui.filters.minRev, rows: document.querySelectorAll("#uw-p-comps .uw-near--am .uw-mbreak").length,
  top: UW.mapApi.lastNearest.slice(0, 3).map((x) => x.l.bedrooms + "BR/" + x.l.sleeps + (x.poolOk ? " pool ✓ " : " pool ✗ ") + x.info.prefMatched + "/" + x.info.prefTotal) }));
check(am.mode === "amenity" && am.island === COMPS.listings.length && am.minRev === null && am.n === 25 && am.rows === 25,
  "Match by amenities ranks all " + am.island + " island homes (no revenue floor, nothing excluded); the best 25 shown with a breakdown each: " + am.top.join(", "));
await page.click('#uw-p-comps [data-act="more"]');
await page.waitForTimeout(400);
const more = await ev(() => UW.mapApi.lastNearest.length);
check(more === 75, "“Show 50 more” continues down the ranking (" + more + " shown)");
const before = await ev(() => UW.mapApi.lastNearest.slice(0, 10).map((x) => x.l.id).join(","));
await page.click("#uw-profile-" + GC + ' [data-act="pflag"][data-f="pool"][data-v="0"]');
await page.waitForTimeout(500);
const flipped = await ev((pid) => { const pr = UW.activeVersion(UW.property(pid)).profile; return { pool: pr.flags.pool, src: pr.src.flags.pool, top: UW.mapApi.lastNearest.slice(0, 10).map((x) => x.l.id).join(","), nopool: UW.mapApi.lastNearest.slice(0, 5).every((x) => !x.l.flagSet.has("pool")) }; }, GC);
check(flipped.pool === 0 && flipped.src === "manual" && flipped.top !== before && flipped.nopool, "a 1/0 toggle marks the flag “manual” and the matching reruns (pool = 0: no-pool homes now rank first)");
await page.click("#uw-profile-" + GC + ' [data-act="profile-reset"]');
await page.waitForTimeout(500);
const reset = await ev((pid) => { const pr = UW.activeVersion(UW.property(pid)).profile; return { pool: pr.flags.pool, src: pr.src.flags.pool, top: UW.mapApi.lastNearest.slice(0, 10).map((x) => x.l.id).join(",") }; }, GC);
check(reset.pool === 1 && /^notes:/.test(reset.src) && reset.top === before, "“Reset to sheet” restores the prefill and the original ranking");
// Each mode keeps its own filters.
await ev(() => { UW.ui.filters.minSleeps = 12; UW.refilter(); UW.emit("filters"); });
await page.click('#uw-p-comps [data-act="mode"][data-v="location"]');
await page.waitForTimeout(400);
const locF = await ev(() => ({ mode: UW.ui.mode, minRev: UW.ui.filters.minRev, minSleeps: UW.ui.filters.minSleeps }));
await page.click('#uw-p-comps [data-act="mode"][data-v="amenity"]');
await page.waitForTimeout(400);
const amF = await ev(() => ({ minSleeps: UW.ui.filters.minSleeps, chips: [...document.querySelectorAll("#uw-p-comps .uw-fchip")].map((c) => c.textContent) }));
check(locF.mode === "location" && locF.minRev === 90000 && locF.minSleeps == null && amF.minSleeps === 12 && amF.chips.some((c) => /12/.test(c)),
  "each mode keeps its own filters (location: $90k floor, no sleeps filter; amenities: the sleeps 12+ filter added there, shown as a removable chip)");
await ev(() => { UW.ui.filters.minSleeps = null; UW.refilter(); UW.emit("filters"); });
// The target popup's buttons.
await ev(() => window.scrollTo(0, document.getElementById("uw-map").getBoundingClientRect().top + window.scrollY - 70));
await page.waitForTimeout(300);
await ev((pid) => UW.mapApi.openTarget(pid), GC);
await page.waitForTimeout(500);
const btns = await ev(() => [...document.querySelectorAll(".uw-tpop__acts button")].map((b) => b.textContent));
check(btns.join("|") === "Match by location|Match by amenities|Open card|Copy comps|Copy revenue cases|Download UW CSV", "the target popup offers: " + btns.join(" / "));
await page.click('.uw-tpop [data-act="tp-rank"][data-mode="location"]');
await page.waitForTimeout(500);
const viaPop = await ev(() => ({ mode: UW.ui.mode, n: UW.mapApi.lastNearest.length, first: UW.mapApi.lastNearest[0] && UW.mapApi.lastNearest[0].l.id }));
check(viaPop.mode === "location" && viaPop.n > 0, "“Match by location” in the popup switches the panel to location matches (" + viaPop.n + ")");
// Add from location, then the same home from amenities: one row, tagged Both.
const rowsBefore = await ev((pid) => UW.activeVersion(UW.property(pid)).comps.length, GC);
await page.click('#uw-p-comps [data-act="add"][data-id="' + viaPop.first + '"]');
await page.waitForTimeout(300);
await ev(([pid, id]) => UW.actions.addComps(pid, UW.activeVersion(UW.property(pid)).label, [UW.byId.get(id)], "amenity"), [GC, viaPop.first]);
await page.waitForTimeout(300);
const tagged = await ev(([pid, id]) => { const cs = UW.activeVersion(UW.property(pid)).comps; const c = cs.filter((x) => UW.compId(x) === id); return { n: cs.length, dup: c.length, match: c[0] && c[0].match, notes: c[0] && c[0].notes }; }, [GC, viaPop.first]);
check(tagged.n === rowsBefore + 1 && tagged.dup === 1 && tagged.match === "both" && /^\[Location \+ Amenity match\] \d+\.\d mi from 6513 Golf Crest Dr · /.test(tagged.notes), "added from both modes: one row, “" + tagged.notes + "”");
await ev((pid) => { UW.ui.expanded.add(pid); UW.cardsApi.renderCard(pid); }, GC);
await page.selectOption("#uw-card-" + GC + " select[data-cmatch]", "both");
await page.waitForTimeout(300);
const vis = await ev((pid) => [...document.querySelectorAll("#uw-card-" + pid + " .uw-comps tbody tr")].filter((tr) => !tr.hidden && tr.offsetParent).map((tr) => tr.dataset.match), GC);
check(vis.length === 1 && vis[0] === "both", "the Match column filter shows only the Both row (" + vis.join(", ") + ")");
await page.selectOption("#uw-card-" + GC + " select[data-cmatch]", "");
await page.waitForTimeout(200);
const sheetNotes = await ev((pid) => UW.activeVersion(UW.property(pid)).comps.filter((c) => (c.match || "sheet") === "sheet").map((c) => c.notes), GC);
const baseNotes = UWJ.properties.find((p) => p.id === GC).versions.find((v) => v.label === "101").comps.map((c) => c.notes);
check(sheetNotes.length === baseNotes.length && sheetNotes.every((n) => baseNotes.includes(n)), "sheet rows keep their notes as written until asked");
await page.click("#uw-card-" + GC + ' [data-act="append-distance"]');
await page.waitForTimeout(300);
const appended = await ev((pid) => UW.activeVersion(UW.property(pid)).comps.map((c) => [c.match || "sheet", c.notes]), GC);
check(appended.filter((x) => x[0] === "sheet").every((x) => / · \d+\.\d mi from 6513 Golf Crest Dr$/.test(x[1]) || !/\S/.test(x[1]) || / mi from 6513 Golf Crest Dr$/.test(x[1])) && appended.find((x) => x[0] === "both")[1] === tagged.notes,
  "“Append distance to notes” adds “· X.X mi from 6513 Golf Crest Dr” to sheet rows only");
await ev((pid) => UW.revert(pid, "101"), GC);

console.log("6. Console");
check(errors.length === 0, "no console errors" + (errors.length ? ": " + errors.join(" | ") : ""));
await browser.close();
server.close();
console.log(failures ? "\n" + failures + " FAILURE(S)" : "\nALL BROWSER TESTS PASSED");
process.exit(failures ? 1 : 0);
