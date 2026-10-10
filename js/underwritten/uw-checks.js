/**
 * Data checks section: the build's validation report (comps missing from or
 * changed in the current workbook, possible duplicate properties, duplicate
 * files, Mortgage Years vs the amortization block, the Total Paydown column,
 * geocoding), a live formula check (each sheet recalculated in this browser
 * with the same code the page uses), and saved edits: export / import / clear.
 */
/* global UWMath */
(function () {
  const UW = window.UW, F = UW.fmt, E = UW.esc;
  const K = (UW.checksApi = {});

  K.init = function () {
    render();
    const host = document.getElementById("uw-checks-body");
    host.addEventListener("click", onClick);
    host.addEventListener("change", onChange);
    UW.on("saved", renderSaved);
    UW.on("listings", renderSaved);
  };

  const fileLink = (f) => '<span class="uw-filetag">' + E(f) + "</span>";
  const room = (id, url) => '<a href="' + E(url || "https://www.airbnb.com/rooms/" + id) + '" target="_blank" rel="noopener">' + E(id || "—") + "</a>";
  const fmtCh = (c) => {
    const f = (x, field) => (x == null ? "blank" : field === "revenue" ? F.money(x) : field === "adr" ? F.money2(x) : field === "occupancy" ? F.num(x) + "%" : F.num(x));
    return E(c.field.replace(/^HAS_/, "").replace(/_/g, " ")) + " " + f(c.sheet, c.field) + " → " + f(c.current, c.field);
  };

  function render() {
    const V = UW.data.uw.validation, uw = UW.data.uw;
    const versions = uw.properties.flatMap((p) => p.versions.map((v) => ({ p, v })));
    const nComps = versions.reduce((s, x) => s + x.v.comps.length, 0);
    const formula = versions.map(({ p, v }) => {
      const r = UWMath.verify(v);
      const a = v.sheet.amort;
      const fails = r.rows.filter((x) => x.result === "FAIL" && !(x.key === "principal" && Math.abs(v.sheet.cases.mid.principal - a.paid12) <= 1));
      const pFail = r.rows.some((x) => x.key === "principal" && x.result === "FAIL");
      const rounding = r.rows.some((x) => x.result === "rounding");
      return { p, v, r, ok: !fails.length, fails, pFail, rounding };
    });
    const pass = formula.filter((x) => x.ok).length;
    const tile = (val, lab, kind) => '<div class="uw-stat' + (kind ? " uw-stat--" + kind : "") + '"><strong>' + val + "</strong><span>" + lab + "</span></div>";
    const sec = (title, n, body, open) => '<details class="uw-check-sec"' + (open ? " open" : "") + "><summary>" + title + (n == null ? "" : ' <span class="uw-count' + (n ? "" : " uw-count--zero") + '">' + n + "</span>") + "</summary>" + body + "</details>";

    const formulaTable = '<div class="table-scroll"><table class="data-table uw-ftable"><thead><tr><th>File</th><th>Property</th><th>Sheet: cash on cash<br><span class="muted">low · mid · high</span></th><th>Recalculated here<br><span class="muted">low · mid · high</span></th><th>Result</th></tr></thead><tbody>' +
      formula.map((x) => {
        const s = x.v.sheet.cases, c = x.r.calc.cases, coc = (o) => ["low", "mid", "high"].map((k) => F.pct(o[k].coc)).join(" · ");
        const res = !x.ok ? '<span class="uw-badge uw-badge--bad">Doesn’t match: ' + x.fails.map((f) => E(f.label)).join(", ") + "</span>" :
          '<span class="uw-badge uw-badge--good">Matches</span>' + (x.rounding ? ' <span class="muted">within input rounding</span>' : "") + (x.pFail ? ' <span class="muted">· principal: see below</span>' : "");
        return "<tr><td>" + E(x.v.label) + '</td><th scope="row">' + E(x.p.street) + "</th><td>" + coc(s) + "</td><td>" + coc(c) + "</td><td>" + res + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<p class="caption">Every output (down payment through the 5-year total, 38 numbers per sheet) is recalculated from the sheet’s inputs and compared with the sheet. “Within input rounding” means a displayed input hides decimals ' +
      "(for example an HOA of $3.33 shown as $3). Principal Pay Down is the one formula that differs, and the next check explains why.</p>";

    const missing = V.missingComps.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>File</th><th>Property</th><th>Row</th><th>Listing</th><th>In the sheet</th><th>Why</th></tr></thead><tbody>' +
      V.missingComps.map((x) => "<tr><td>" + E(x.file) + '</td><th scope="row">' + E(x.address) + "</th><td>" + x.row + "</td><td>" + room(x.id, x.url) + "</td><td>" + F.money(x.revenue) + " · " + F.beds(x.bedrooms) +
        "</td><td>" + ({ missing: "Not in Cleaned_Data", "other-room": "Private or hotel room", unrecognised: "Not an Airbnb room link" }[x.status]) + "</td></tr>").join("") + "</tbody></table></div>" : '<p class="uw-empty">None.</p>';
    const byFile = {};
    V.changedComps.forEach((x) => (byFile[x.file] = byFile[x.file] || []).push(x));
    const changed = V.changedComps.length ? Object.entries(byFile).map(([f, rows]) => '<h5 class="uw-h5">File ' + E(f) + " · " + E(rows[0].address) + " · " + rows.length + " row" + (rows.length === 1 ? "" : "s") + "</h5>" +
      '<ul class="uw-checklist">' + rows.map((x) => "<li>Row " + x.row + " " + room(x.id) + ": " + x.changes.map(fmtCh).join("; ") + "</li>").join("") + "</ul>").join("") : '<p class="uw-empty">None.</p>';
    const dupes = V.duplicateProperties.length ? '<ul class="uw-checklist">' + V.duplicateProperties.map((d) => "<li>" + d.properties.map((x) => "<strong>" + E(x.address) + "</strong> (file " + E(x.file) + ", " + F.money(x.price) + ")").join(" and ") +
      " list the same " + F.num(d.details.beds) + " / " + F.num(d.details.baths) + " bed / bath, " + Number(d.details.lot).toLocaleString() + " sqft lot and " + Number(d.details.size).toLocaleString() + " sqft size. Possibly the same house under two addresses, or details copied from another sheet.</li>").join("") + "</ul>" : '<p class="uw-empty">None.</p>';
    const files = V.duplicateFiles.length ? '<ul class="uw-checklist">' + V.duplicateFiles.map((d) => "<li>" + d.files.map(fileLink).join(" = ") + ": " + E(d.note) + "</li>").join("") + "</ul>" : '<p class="uw-empty">None.</p>';
    const myears = V.mortgageYears.length ? '<ul class="uw-checklist">' + V.mortgageYears.map((x) => "<li>File " + E(x.file) + " (" + E(x.address) + "): “Mortgage Years” says " + x.mortgageYears + ", but the amortization block and Debt Service use " + x.amortYears + " years. Reported, not changed.</li>").join("") + "</ul>" : '<p class="uw-empty">None.</p>';
    const ds = V.debtService.length ? '<p class="uw-hint">Debt Service matches 12 × the amortization block’s payment on every sheet. The block’s Total Paydown column does not:</p><ul class="uw-checklist">' +
      V.debtService.map((x) => "<li>File " + E(x.file) + " (" + E(x.address) + "): " + E(x.issue) + "</li>").join("") + "</ul><p class=\"uw-hint\">This page’s own calculation uses the principal actually repaid. The sheets and their amortization blocks are left exactly as they are.</p>" : '<p class="uw-empty">None.</p>';
    const geo = V.geocode.length ? '<ul class="uw-checklist">' + V.geocode.map((x) => "<li><strong>" + E(x.address) + "</strong>: " + E(x.issue) + ". On its card, use “Place pin on the map” or “Look up with OpenStreetMap”.</li>").join("") + "</ul>" : '<p class="uw-empty">Every address matched.</p>';
    const C = UW.data.comps;
    const wb = '<ul class="uw-checklist"><li>' + C.n + " entire homes are used as comps, out of " + C.nCleaned + " listings in Cleaned_Data. The " + C.nOtherRooms + " private and hotel rooms are left out, as on the main page.</li>" +
      "<li>Exclude_Comp is 0 on every row, so it filters nothing.</li>" + (C.guestFavoriteAny ? "" : "<li>is_guest_favorite is 0 on every row, so the guest-favourite filter matches nothing on “Yes”.</li>") +
      "<li>Several sheets typed occupancy to one decimal (57.9% for 57.93%). Differences under 0.05 points count as the same value.</li>" +
      "<li>Locations: properties are geocoded with the US Census geocoder, which interpolates along the street. The area is a vote of the 3 nearest Airbnb listings; that rule gives every listing its main-page area. Beach position uses the same distance rules as the listings.</li></ul>";
    const committed = V.committed && V.committed.length ? sec("Committed browser edits (data/underwritten_local.json)", V.committed.length, '<ul class="uw-checklist">' + V.committed.map((x) => "<li>" + E(x.id) + ": " + E(x.issue) + "</li>").join("") + "</ul>") : "";

    document.getElementById("uw-checks-body").innerHTML =
      '<div class="uw-stats uw-stats--wide">' + tile(uw.properties.length, "properties") + tile(versions.length, "sheet versions from " + uw.generatedFrom.files.length + " files") +
      tile(pass + " of " + formula.length, "sheets match the formulas", pass === formula.length ? "good" : "bad") + tile(nComps, "comp rows checked") +
      tile(V.changedComps.length, "rows differ from the workbook", V.changedComps.length ? "warn" : "") + tile(V.missingComps.length, "rows not in the current data", V.missingComps.length ? "bad" : "") + "</div>" +
      sec("Formula check, recalculated in this browser", formula.length, formulaTable, true) +
      sec("Amortization block: the Total Paydown column", V.debtService.length, ds) +
      sec("Comps not in the current workbook", V.missingComps.length, missing) +
      sec("Comps whose current values differ from the sheet", V.changedComps.length, changed) +
      sec("Possible duplicate properties", V.duplicateProperties.length, dupes) +
      sec("Duplicate files", V.duplicateFiles.length, files) +
      sec("Mortgage Years vs. Amortization Years", V.mortgageYears.length, myears) +
      sec("Geocoding", V.geocode.length, geo) +
      sec("About the workbook and the rules", null, wb) + committed +
      '<div class="uw-saved" id="uw-saved"></div>';
    renderSaved();
  }

  function renderSaved() {
    const host = document.getElementById("uw-saved");
    if (!host) return;
    const L = UW.local, ex = UW.exportLocal();
    const nEdits = Object.keys(ex.edits).length, nNew = ex.listings.length;
    const cm = UW.data.uw.committed || { listings: [], edits: {} };
    host.innerHTML = '<h3 class="uw-h3">Your edits and new listings</h3>' +
      "<p>" + (UW.storageOk ? "Saved in this browser only." : '<span class="uw-warn">This browser is blocking storage, so edits last only until the page is closed.</span>') +
      " Right now: <strong>" + nNew + "</strong> new listing" + (nNew === 1 ? "" : "s") + " and edits to <strong>" + nEdits + "</strong> underwritten propert" + (nEdits === 1 ? "y" : "ies") + "." +
      (cm.listings.length || Object.keys(cm.edits).length ? " " + cm.listings.length + " listing(s) and " + Object.keys(cm.edits).length + " edit(s) come from the committed data/underwritten_local.json." : "") + "</p>" +
      '<div class="uw-actions"><button type="button" class="uw-btn uw-btn--primary" data-act="export">Export (JSON)</button>' +
      '<label class="uw-btn uw-btn--ghost uw-filebtn">Import JSON<input type="file" accept="application/json,.json" data-act="import"></label>' +
      '<button type="button" class="uw-btn uw-btn--danger" data-act="clear"' + (L.listings.length || Object.keys(L.edits).length || L.deleted.length ? "" : " disabled") + ">Clear this browser’s edits</button></div>" +
      '<p class="uw-hint">To share them with everyone: Export, save the file as <code>data/underwritten_local.json</code> in the repo, run <code>python scripts/build_underwritten.py</code>, and commit. ' +
      "When a new listing’s CSV is later added to <code>underwriting/source_csv/</code>, the build drops the committed copy in favour of the sheet.</p>";
  }

  function onClick(e) {
    const b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    if (b.dataset.act === "export") {
      UW.download("underwritten_local.json", JSON.stringify(UW.exportLocal(), null, 1) + "\n", "application/json");
      UW.toast("Exported. Commit it as data/underwritten_local.json.");
    } else if (b.dataset.act === "clear") {
      if (confirm("Clear every edit and new listing saved in this browser? Export first if you want to keep them.")) { UW.clearLocal(); UW.cardsApi.renderList(); UW.toast("Cleared"); }
    }
  }
  function onChange(e) {
    const t = e.target;
    if (t.dataset.act !== "import" || !t.files.length) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const js = JSON.parse(fr.result);
        const n = UW.importLocal(js);
        UW.cardsApi.renderList();
        UW.toast("Imported " + n.listings + " listing(s) and edits to " + n.edits + " propert" + (n.edits === 1 ? "y" : "ies"));
      } catch (err) { UW.toast("Import failed: " + err.message, "warn"); }
      t.value = "";
    };
    fr.readAsText(t.files[0]);
  }
})();
