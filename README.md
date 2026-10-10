# Galveston, TX — STR Market & Location Analysis

Static site (no build step), same template as the Park City and Charlotte market sites. It covers **Sections 2–5 only**: Market, Location Analysis by Bedroom Size, Why Location Changes the Rate, and Traveller Demographics. **No buy boxes yet.**

## Pipeline

1. `../notebooks/market_common.py` holds the market specifics:
   - workbook `../Galveston - TX (2).xlsx` (snapshot 2026-10-02) → `Cleaned_Data`, kept to entire homes via `Base_Table.roomType` (923 of 942; 18 private rooms and 1 hotel room dropped);
   - the 7 Ward-clustered reference areas, named from centroids;
   - the bedroom-size buckets;
   - the main location variable: beach position (Gulf-front / beach walk / bay or canal / inland, from an OpenStreetMap Gulf shoreline) and town vs. West End.
2. `python ../notebooks/build_overview_notebook.py`, then `jupyter nbconvert --to notebook --execute --inplace ../notebooks/galveston_overview.ipynb`. This writes:
   - `region_stats.json`;
   - the interactive folium map `galveston_overview_map.html`.
   The builder is identical across markets.
3. `python scripts/generate_webpage_data.py` writes:
   - `js/region_data.js`;
   - `assets/overview/galveston_overview_map.html`;
   - `data/listings.json`.
   Don't hand-edit these files.

## Underwritten Properties page (`underwritten.html`)

A second page that puts the underwriting sheets on one map with the Airbnb comps, with no build step.

**Terminology.** Zillow listings are **acquisition targets**: the houses being underwritten, never comps. **Airbnb comps** are only the entire homes in the workbook's `Cleaned_Data`. Anything else in a sheet's comp table, a Zillow URL included, is an audit error.
- **From the main page:** its "Underwriting" section, right under the hero (`js/underwritten/uw-strip.js`, `css/uw-strip.css`), has one card per property. Each card opens `underwritten.html#p=<zpid>` with that property selected on the map.
- **On the map page:** a ‹ / › switcher steps from one property to the next, and "← Market analysis" returns to the main page.

**Pipeline:**

1. Drop the Google Sheets CSV exports ("New Market UW'ing - NN.csv") into `underwriting/source_csv/`.
2. Run `python scripts/build_underwritten.py`. Add `--offline` to skip the geocoder; cached addresses still resolve. Use the same Python env as `generate_webpage_data.py` (pandas, scipy, scikit-learn). It writes:
   - `data/comps.json`: the 923 entire homes from `market_common.load()`, so areas, beach position, Town / West End, size bucket, vs-size index and tiers match the main page exactly. It adds "Top 10% / 11–25% / rest for its size" (same quantile method as the main page's top-25% tier) and the area outlines the overview map draws.
   - `data/shoreline.json`: the Gulf shoreline points `market_common.gulf_shoreline()` measures to.
   - `data/underwritten.json`: the sheets, read by label, grouped by Zillow URL (query string ignored) into properties with one version per file number (highest = default; byte-identical files collapse into one). Also the validation report, and `data/underwritten_local.json` merged in when present.
   - `data/amortization.json`: each sheet's amortization block, raw rows, verbatim.
   - `data/geocode_cache.json`: US Census geocoder results. If Census finds nothing, the build tries OpenStreetMap Nominatim: one request a second, with an identifying User-Agent, and hits and misses are cached. Only a house-level match is used.
   - **Manual pins:** go in `data/geocode_overrides.json`, keyed by Zillow zpid. A target with no pin gets a "Place this target on the map" prompt at the top of the map. To share a pin:
     1. Place the pin on the map.
     2. Click **Export pins** (Data checks section) to download `geocode_overrides.json`.
     3. Save it over `data/geocode_overrides.json` and rebuild.
   - `data/version_labels.json`: scenario names for targets underwritten in more than one file, keyed by file number, e.g. `{"96": "With pool", "97": "Without pool"}`.
     - A value can be `{"label": "...", "default": true}` to open that scenario first.
     - Otherwise the **lowest** file number opens first. The highest file number is never assumed to be the latest.
     - Unnamed files show as "File NN".
   - `reports/comp_audit.csv` and the audit inside `underwritten.json`: every comp row in every sheet, matched by Airbnb room ID against `../Galveston - TX (2).xlsx`, the source of truth. Any other `Galveston*.xlsx` in `../` or `../archive/` is scanned too, only to report where else a comp appears. Each row gets exactly one class:

     | Class | Valid comp? | Rule |
     |---|---|---|
     | Usable | Yes | `Cleaned_Data`, entire home, "Good Data" |
     | Usable, possibly good | Yes | `Cleaned_Data`, entire home, "Possibly Good Data" |
     | Excluded for data quality | No | `Base_Table` "Not Good Data"; the `Quality Rating Reason` is shown in plain words |
     | Never scored | No | In `Base_Table` with a blank quality category |
     | Not an entire home | No | Private or hotel room |
     | In Removed_Listings | No | Listed in `Removed_Listings` |
     | Not in any workbook | No | Not found in any workbook scanned |
     | Not a valid Airbnb URL | No | Not an airbnb.com/rooms/ link. Exact title matches in the workbook are listed as candidates, never substituted |
     | Zillow URL in a comp table | No | A Zillow link in a comp row |

     - **Valid rows** also get the value-change check (revenue, ADR, occupancy, bedrooms, sleeps, flags). Revenue changes over 15% and bedroom-count changes are highlighted.
     - **Nothing is removed automatically.** "Remove flagged comps" asks first. Copying or downloading a set with errors offers to leave them out, which is the default.
3. The build prints the comp audit and the sheet checks, then runs `node tests/test_underwritten.mjs`. It exits non-zero on any failure. The Node test:
   - recomputes every sheet from its inputs (pass/fail table);
   - diffs the amortization block of exported CSVs against their sources byte for byte;
   - checks that the browser's location rules and comp classes match the build's, for all 125 rows;
   - covers the known audit cases, the Zillow-URL check, the comp picker (only `Cleaned_Data` entire homes), scenario labels and defaults, target bedrooms, copy-row identity and revenue order.
4. Browser test: `NODE_PATH=<folder with playwright-core> node tests/test_underwritten_browser.mjs`. It uses the system Chrome and serves the folder itself. It checks:
   - that every rendered comp table has the sheet's exact 15-column header and the sheet's 0/1 amenity cells (all 12 scenarios), and is revenue-descending;
   - that every copy output is revenue-descending, and that map, popup and card copies give identical lines;
   - error badges, removing flagged comps, copy warnings and the scenario tools;
   - no console errors.

The script is idempotent: the same inputs give byte-identical outputs. It never edits a sheet value. Mismatches are reported, on the page and in the console.

**Location of a property** (the same rules as the listings):
- **Distance to the Gulf:** the nearest shoreline point.
- **Beach position:** Gulf-front within 0.2 km, or within 0.8 km if the notes say beachfront. Beach walk within 0.6 km. Bay / canal if the notes say canal, bayfront or waterfront. Otherwise inland.
- **Area:** a vote of the 3 nearest Airbnb listings. In a leave-one-out test this gives every listing its main-page Ward area; nearest centroid gets 97.7%.
- **Waterfront type:** an editable field that defaults from the beach position.

**Maths** (`js/underwritten/uw-math.js`, mirrors the sheet; verified against all 12 sheet versions):
- Down = Price × DP%; Loan = Price − Down; Closing = Price × Closing%.
- Out of pocket = Down + Closing + Setup.
- OPEX: Mid = monthly × 12; Low / High = Mid ∓ 4%.
- PM fee = Revenue × PM%.
- NOI = Revenue − OPEX − PM fee.
- Debt service = 12 × the payment over the block's 30-year amortization.
- FCF = NOI − Debt service; CoC = FCF ÷ Out of pocket.
- Total return = (FCF + year-1 principal + Price × 3.5%) ÷ Out of pocket.
- Taxes: basis = Price × 80% + Setup; SLAs 35%; bonus 100%; tax rate 37%.
- 5-year: 5 × Mid FCF + principal through month 60 + 5 × appreciation.

Existing targets show the sheet's own numbers. The page recalculates only once a financial input is edited.

**Comps on the page.**
- **Comp tables** in every card and scenario show the sheet's 15 columns in the sheet's order:
  - `Listing URL … HAS_waterfront, Notes`, with the HAS_* flags as 1 / 0;
  - where the workbook's current value differs from the sheet's, a "now …" tag sits beneath the sheet value;
  - baths, area, beach position, distance and the audit status follow as secondary columns.
- **Order:** every table, list copy and CSV download is in revenue order: the sheet's Revenue Potential high to low, ties by ADR. When the workbook's current revenue would order rows differently, a note says so.
- **Copy rows.** Any Airbnb comp can be copied as a sheet row from the map:
  - a popup's "Copy row";
  - the nearest list or the filtered list, by tick, "Select all shown" or "Copy all shown" (top 50);
  - every path builds the row with `uw-rules.js` and `compsTSV`, so the lines are identical.
- **Notes** are filled from workbook data, e.g. `5BR/3BA · sleeps 16 · pool + hot tub · Bay / canal · West Galveston · 0.8 mi from 6513 Golf Crest Dr`. You can edit one before copying; the edit lasts for the session.
- **Selecting a target** applies "Match this property":
  - its target bedrooms ±1 (from the notes' converted count, e.g. "I want 5", or the editable target configuration), plus the target's sleeps when set;
  - the same Town / West End zone and waterfront type, unless "Same zone & water type" is off;
  - removable chips show the active filters, and "Show pure nearest" is one click away.

One sheet error is reported and left as is. The amortization block's "Total Paydown" column runs $1–9 ahead of the principal actually repaid, from its month-2 row on (file 97's block is the only clean one). The sheet's Principal Pay Down reads that column; 5-year Equity uses the true figure. The page uses the true figure.

**CSV download** (`js/underwritten/uw-csv.js`):
- Starts from the property's own source CSV, or from `New Market UW'ing - 101.csv` for a new listing.
- Replaces only the input cells: notes, URL, price, DP%, rate, closing %, setup items, OPEX items, revenue cases and comp rows. Unused setup and comp rows are cleared.
- Copies every other row byte for byte, the whole amortization block included.
- Calculated cells keep the source's values until the inputs are entered in the Google Sheet.

**Edits and new listings:**
- Saved in the browser (localStorage).
- *Export* writes a JSON file. Commit it as `data/underwritten_local.json` and rebuild, and everyone sees the listings and edits.
- When a committed listing's own CSV later lands in `source_csv/`, the build drops the committed copy.
- New listings are geocoded in the browser with OpenStreetMap Nominatim: one request at a time, at least 1.1 s apart, cached. If that fails, place the pin by hand.

**Files:**
- `underwritten.html` and `css/underwritten.css`.
- `js/underwritten/`:
  - `uw-math.js`, `uw-csv.js` and `uw-geo.js` run in the browser and in Node.
  - `uw-rules.js` (comp classes, auto notes, comp rows, notes parsing) also runs in both.
  - `uw-app.js` (state, filters, hash), `uw-map.js` (canvas map, target popups), `uw-actions.js` (copy / download / add / remove, shared by cards, popups and the panel), `uw-panel.js`, `uw-cards.js`, `uw-add.js`, `uw-checks.js` (comp audit), `uw-main.js`.
- `scripts/build_underwritten.py`, `tests/test_underwritten.mjs` and `tests/test_underwritten_browser.mjs`.
- `data/version_labels.json`, `reports/comp_audit.csv`.
- On the main page: `js/underwritten/uw-strip.js` and `css/uw-strip.css`.

None of the shared template files below were changed for this page.

## Files

| File | Role |
|---|---|
| `js/data.js` | Market-specific prose and config: hero, market card (researched, with sources), screening-signal rows, location reads, size guide, destination areas, season strip, bridge. Prose that quotes a number computes it from `region_data.js`. |
| `js/location.js` | Section 2 size ladder and screening signals; Section 3 bedroom × location table, area × bedroom grid, size cards, reference table. |
| `js/destination.js` | Section 4 Leaflet map with side panel, season strip, bridge. |
| `js/render.js`, `js/charts.js`, `js/main.js` | Helpers, market card, Chart.js charts, bootstrap. |

`location.js`, `destination.js`, `render.js`, `charts.js`, `main.js` and `css/styles.css` are shared, unchanged, across the market sites.

## Method notes

- **Location is always compared within the same bedroom size.**
  - "vs. typical" = a listing's Revenue Potential ÷ the market median for its size bucket. 1.00× means it earns what its size predicts.
  - Cells under 8 listings are muted ("few homes"); under 3 are hidden.
- **Map colours show performance against same-size homes.**
  - Top 25% for its size, Middle 50%, Bottom 25%.
  - Filters: bedrooms × band × area (AND).
- **Screening signals are not proven uplift.**
  - They compare the share reaching the top quarter for their size, with vs. without a feature.
  - Features with fewer than 10 listings on either side are dropped.
- **Presentation rules:** plain English, no statistical notation on the page, and conclusions → evidence → what to look for.
