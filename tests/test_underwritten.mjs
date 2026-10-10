// Tests for the Underwritten Properties page. Run: node tests/test_underwritten.mjs
// (scripts/build_underwritten.py runs it automatically.)
//  1. Formula acceptance: every sheet recomputed from its inputs vs its own outputs.
//  2. CSV export: the amortization block of an exported file is byte-for-byte the
//     source's; every non-input row is unchanged; inputs land where the sheet expects.
//  3. Location rules in the browser match the Python build.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const M = require(join(ROOT, "js/underwritten/uw-math.js"));
const C = require(join(ROOT, "js/underwritten/uw-csv.js"));
const G = require(join(ROOT, "js/underwritten/uw-geo.js"));
const UW = JSON.parse(readFileSync(join(ROOT, "data/underwritten.json"), "utf8"));
const COMPS = JSON.parse(readFileSync(join(ROOT, "data/comps.json"), "utf8"));
const SHORE = JSON.parse(readFileSync(join(ROOT, "data/shoreline.json"), "utf8"));
const src = (f) => readFileSync(join(ROOT, "underwriting/source_csv", f), "utf8");

let failures = 0;
const fail = (msg) => { failures++; console.log("  FAIL " + msg); };
const pc = (v) => (v == null ? "  —   " : (v * 100).toFixed(2).padStart(6) + "%");
const pad = (s, n) => String(s).padEnd(n);

// ---------------------------------------------------------------------------
console.log("1. FORMULA CHECK: each sheet recomputed from its own inputs (Low / Mid / High cash on cash)\n");
console.log(pad("file", 6) + pad("property", 24) + pad("sheet CoC", 27) + pad("recomputed CoC", 27) + "result");
const versions = UW.properties.flatMap((p) => p.versions.map((v) => ({ p, v })));
const notes = [];
for (const { p, v } of versions) {
  const res = M.verify(v);
  const sh = v.sheet.cases, ca = res.calc.cases;
  // The Total Paydown column error (see the validation report) explains a Principal Pay Down
  // gap when the sheet's principal is that column's month-12 value.
  const a = v.sheet.amort, excess = (a.paidLast || 0) - a.loan;
  let result = "PASS";
  for (const r of res.rows) {
    if (r.result !== "FAIL") continue;
    const explained = r.key === "principal" && Math.abs(v.sheet.cases.mid.principal - a.paid12) <= 1 && Math.abs(r.diff) <= Math.abs(excess) + 1.5;
    if (explained) {
      r.result = "sheet error";
      if (r.group === "mid") notes.push(`  file ${v.label}: Principal Pay Down $${Math.round(r.sheet).toLocaleString()} reads the block's Total Paydown column, which runs ` +
        `$${Math.round(excess)} ahead from its month-2 row; the principal actually repaid in year 1 is $${Math.round(r.calc).toLocaleString()} (difference $${Math.abs(r.diff).toFixed(2)}).`);
    } else {
      result = "FAIL";
      fail(`file ${v.label} ${r.group} ${r.label}: sheet ${r.sheet} vs recomputed ${r.calc}`);
    }
  }
  const rounding = res.rows.filter((r) => r.result === "rounding");
  const se = res.rows.some((r) => r.result === "sheet error");
  if (result === "PASS" && (rounding.length || se)) result = "PASS" + (rounding.length ? " (rounding)" : "") + (se ? " *" : "");
  if (rounding.length) notes.push(`  file ${v.label}: within input rounding on ${[...new Set(rounding.map((r) => r.label))].join(", ")} ` +
    `(largest gap $${Math.max(...rounding.filter((r) => r.kind === "$").map((r) => Math.abs(r.diff)), 0).toFixed(2)}; a displayed input hides decimals)`);
  console.log(pad(v.label, 6) + pad(p.street.slice(0, 22), 24) + pad(["low", "mid", "high"].map((c) => pc(sh[c].coc)).join(" "), 27) +
    pad(["low", "mid", "high"].map((c) => pc(ca[c].coc)).join(" "), 27) + result);
}
console.log("\n" + notes.join("\n"));
console.log("  * = only Principal Pay Down differs, by the sheet's Total Paydown column error; every other output matches.");
const coc = (label) => { const v = versions.find((x) => x.v.label === label).v; const c = M.compute(v.inputs).cases; return ["low", "mid", "high"].map((k) => (c[k].coc * 100).toFixed(2)); };
const expect = { 101: ["1.54", "6.67", "11.81"], 92: ["8.72", "12.06", "16.26"] };
for (const [f, want] of Object.entries(expect)) {
  const got = coc(f);
  console.log(`  acceptance example file ${f}: recomputed CoC ${got.join("% / ")}% (expected ${want.join("% / ")}%) ${got.join() === want.join() ? "OK" : "MISMATCH"}`);
  if (got.join() !== want.join()) fail(`file ${f} CoC ${got} vs ${want}`);
}

// ---------------------------------------------------------------------------
console.log("\n2. CSV EXPORT: amortization block byte-for-byte, non-input rows unchanged\n");
const modelOf = (v) => ({ notes: v.notes, url: v.url, ...v.inputs, comps: v.comps.map((c) => ({ ...c })) });
const amortSpan = (text) => { const p = C.parse(text), L = C.locate(p.rows); return [L.amort.first, L.amort.last]; };
function checkExport(name, sourceText, model, expectInputs) {
  const out = C.exportSheet(sourceText, model);
  const a = C.amortBlock(sourceText), b = C.amortBlock(out);
  const [f, l] = amortSpan(sourceText);
  let ok = true;
  if (a !== b) { ok = false; fail(`${name}: amortization block differs from the source`); }
  if (Buffer.byteLength(a) !== Buffer.byteLength(b)) { ok = false; fail(`${name}: amortization block length differs`); }
  const S = C.parse(sourceText), O = C.parse(out);
  if (S.rows.length !== O.rows.length) { ok = false; fail(`${name}: row count ${O.rows.length} vs ${S.rows.length}`); }
  if (O.rows.some((r) => r.length !== 22)) { ok = false; fail(`${name}: a row lost its 22 columns`); }
  const L = C.locate(S.rows);
  const inputRows = new Set([L.notes[0], L.url[0], L.price[0], L.dpPct[0], L.rate[0], L.closingPct[0], L.cleaningCost[0], L.cleaningTurns[0], L.revenue[0][0]]);
  for (let i = L.setup.first; i <= L.setup.last; i++) inputRows.add(i);
  for (let i = L.opex.first; i <= L.opex.last; i++) inputRows.add(i);
  for (let i = L.comps.first; i <= L.comps.last; i++) inputRows.add(i);
  let changedOther = 0;
  S.spans.forEach((s, i) => { if (!inputRows.has(i) && s !== O.spans[i]) changedOther++; });
  if (changedOther) { ok = false; fail(`${name}: ${changedOther} non-input rows changed`); }
  // Non-input cells inside input rows must be untouched too.
  const inputCells = new Set();
  const addc = (rc) => inputCells.add(rc[0] + ":" + rc[1]);
  [L.notes, L.url, L.price, L.dpPct, L.rate, L.closingPct, L.cleaningCost, L.cleaningTurns, ...L.revenue].forEach(addc);
  for (let i = L.setup.first; i <= L.setup.last; i++) { addc([i, L.setup.col]); addc([i, L.setup.col + 1]); }
  for (let i = L.opex.first; i <= L.opex.last; i++) addc([i, L.opex.col + 1]);
  for (let i = L.comps.first; i <= L.comps.last; i++) for (let j = 0; j < 15; j++) addc([i, L.comps.col + j]);
  let strayCells = 0;
  S.rows.forEach((r, i) => { if (inputRows.has(i)) r.forEach((c, j) => { if (!inputCells.has(i + ":" + j) && c !== O.rows[i][j]) strayCells++; }); });
  if (strayCells) { ok = false; fail(`${name}: ${strayCells} calculated cells in input rows changed`); }
  if (expectInputs) ok = expectInputs(O.rows, L) && ok;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}: amortization rows ${f + 1}-${l + 1} identical (${Buffer.byteLength(a)} bytes)`);
  return out;
}
for (const { p, v } of versions) {
  for (const f of v.files) {
    const text = src(f);
    // Unchanged model: the whole file must come back unchanged except compacted setup / comp rows.
    const same = C.exportSheet(text, modelOf(v));
    const S = C.parse(text), O = C.parse(same), L = C.locate(S.rows);
    const skip = (i) => (i >= L.setup.first && i <= L.setup.last) || (i >= L.comps.first && i <= L.comps.last);
    const diffs = S.spans.filter((s, i) => !skip(i) && s !== O.spans[i]).length;
    const listOf = (rows, first, last, col, w) => rows.slice(first, last + 1).map((r) => r.slice(col, col + w).join("|")).filter((s) => s.replace(/\|/g, "").trim());
    const sameLists = listOf(S.rows, L.setup.first, L.setup.last, L.setup.col, 2).join("\n") === listOf(O.rows, L.setup.first, L.setup.last, L.setup.col, 2).join("\n") &&
      listOf(S.rows, L.comps.first, L.comps.last, L.comps.col, 15).join("\n") === listOf(O.rows, L.comps.first, L.comps.last, L.comps.col, 15).join("\n");
    if (diffs || !sameLists) fail(`${f}: unchanged export differs (${diffs} rows${sameLists ? "" : ", setup/comp lists"})`);
    else console.log(`  ok   ${f}: unchanged inputs give back the same file${same === text ? " (byte-identical)" : " (setup / comp rows compacted)"}`);
    // Edited model.
    const m = modelOf(v);
    m.notes = 'Property Details:\n-- Bed / Bath (projected): 5 / 3\nWhy This Property?\n-- test, with "quotes", commas';
    m.price = 512345; m.dpPct = 0.25; m.rate = 0.0699; m.closingPct = 0.025;
    m.setup = m.setup.slice(0, 3).concat([{ label: "New item, with comma", amount: 1234 }]);
    m.opex = m.opex.map((o) => ({ ...o, amount: o.label === "Internet" ? 150 : o.amount }));
    m.cleaningCost = 300; m.cleaningTurns = 5;
    m.revenue = { low: 101000, mid: 121000, high: 141000 };
    m.comps = (COMPS.listings.slice(0, 3)).map((l) => ({ url: l.url, revenue: l.revenue, bedrooms: l.bedrooms, sleeps: l.sleeps, adr: l.adr, occupancy: l.occ,
      flags: Object.fromEntries(C.SHEET_FLAGS.map((k) => [k, l.flags.includes(k) ? 1 : 0])), notes: "note\twith tab" }));
    checkExport(f + " (edited)", text, m, (rows, L) => {
      const want = [[L.price, " $ 512,345 "], [L.dpPct, "25%"], [L.rate, "6.99%"], [L.closingPct, "2.50%"], [L.revenue[1], " $ 121,000 "],
        [[L.setup.first + 3, L.setup.col], "New item, with comma"], [[L.setup.first + 4, L.setup.col], ""], [L.cleaningTurns, "5"], [L.cleaningCost, " $ 300 "],
        [[L.comps.first, L.comps.col], COMPS.listings[0].url], [[L.comps.first + 3, L.comps.col], ""], [L.notes, m.notes]];
      let ok = true;
      for (const [rc, val] of want) if (rows[rc[0]][rc[1]] !== val) { ok = false; fail(`${f}: cell ${rc} = ${JSON.stringify(rows[rc[0]][rc[1]])}, expected ${JSON.stringify(val)}`); }
      const clean = rows.find((r) => (r[L.opex.col] || "").trim() === "Cleaning");
      if (clean[L.opex.col + 1] !== " $ 1,500 ") { ok = false; fail(`${f}: cleaning line ${clean[L.opex.col + 1]}`); }
      return ok;
    });
  }
}
// A new listing starts from the 101 template.
const tpl = src(UW.templateFile);
checkExport("new listing from " + UW.templateFile, tpl, { notes: "Property Details:\n-- Bed / Bath (projected): 4 / 3", url: "https://www.zillow.com/homedetails/1-Test-St-Galveston-TX-77554/1_zpid/",
  price: 400000, setup: [], revenue: { low: null, mid: null, high: null }, comps: [] });
// The test must catch a tampered block.
{
  const out = C.exportSheet(tpl, { price: 1 });
  const L = C.locate(C.parse(tpl).rows);
  const spans = C.parse(out).spans; spans[L.amort.first + 10] = spans[L.amort.first + 10].replace("$", "$ ");
  const tampered = spans.join("\r\n");
  if (C.amortBlock(tampered) === C.amortBlock(tpl)) fail("tamper check: a changed amortization row was not detected");
  else console.log("  ok   tamper check: a one-character change inside the amortization block is detected");
}

// ---------------------------------------------------------------------------
console.log("\n3. LOCATION RULES: browser vs Python build\n");
G.init(SHORE, COMPS.listings);
let maxKm = 0;
for (const l of COMPS.listings) maxKm = Math.max(maxKm, Math.abs(G.beachKm(l.lat, l.lng) - l.beachKm));
console.log(`  ${maxKm < 0.002 ? "ok  " : "FAIL"} distance to the Gulf for all ${COMPS.listings.length} listings: largest gap ${(maxKm * 1000).toFixed(1)} m`);
if (maxKm >= 0.002) fail("beachKm differs from market_common");
for (const p of UW.properties) {
  if (!p.place) { console.log(`  --   ${p.street}: no map pin (geocode failed)`); continue; }
  const v = p.versions.find((x) => x.label === p.defaultVersion);
  const js = G.classify(p.geo.lat, p.geo.lng, v.notes, null);
  const ok = js.area === p.place.area && js.loc === p.place.loc && Math.abs(js.beachKm - p.place.beachKm) < 0.002 && js.zone === p.place.zone;
  if (!ok) fail(`${p.street}: browser ${JSON.stringify(js)} vs build ${JSON.stringify(p.place)}`);
  else console.log(`  ok   ${p.street}: ${js.loc}, ${js.area}, ${js.zone}, ${js.beachKm.toFixed(2)} km`);
  const za = G.zillowAddress(p.url);
  if (!za || za.street !== p.street || za.zip !== p.zip) fail(`${p.street}: address from URL ${JSON.stringify(za)}`);
}

console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL TESTS PASSED");
process.exit(failures ? 1 : 0);
