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
- **From the main page:** its "Underwriting" section, right under the hero (`js/underwritten/uw-strip.js`, `css/uw-strip.css`), has one card per property. Each card opens `underwritten.html#p=<zpid>` with that property selected on the map.
- **On the map page:** a ‹ / › switcher steps from one property to the next, and "← Market analysis" returns to the main page.

**Pipeline:**

1. Drop the Google Sheets CSV exports ("New Market UW'ing - NN.csv") into `underwriting/source_csv/`.
2. Run `python scripts/build_underwritten.py`. Add `--offline` to skip the geocoder; cached addresses still resolve. Use the same Python env as `generate_webpage_data.py` (pandas, scipy, scikit-learn). It writes:
   - `data/comps.json`: the 923 entire homes from `market_common.load()`, so areas, beach position, Town / West End, size bucket, vs-size index and tiers match the main page exactly. It adds "Top 10% / 11–25% / rest for its size" (same quantile method as the main page's top-25% tier) and the area outlines the overview map draws.
   - `data/shoreline.json`: the Gulf shoreline points `market_common.gulf_shoreline()` measures to.
   - `data/underwritten.json`: the sheets, read by label, grouped by Zillow URL (query string ignored) into properties with one version per file number (highest = default; byte-identical files collapse into one). Also the validation report, and `data/underwritten_local.json` merged in when present.
   - `data/amortization.json`: each sheet's amortization block, raw rows, verbatim.
   - `data/geocode_cache.json`: US Census geocoder results. Manual pins go in `data/geocode_overrides.json`, keyed by Zillow zpid.
3. The build prints the validation report, then runs `node tests/test_underwritten.mjs`. That test recomputes every sheet from its inputs (pass/fail table), diffs the amortization block of exported CSVs against their sources byte for byte, and checks that the browser's location rules match the build's. It exits non-zero on any failure.

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

Existing properties show the sheet's own numbers. The page recalculates only once a financial input is edited.

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
  - `uw-app.js` (state, filters, hash), `uw-map.js` (canvas map), `uw-panel.js`, `uw-cards.js`, `uw-add.js`, `uw-checks.js`, `uw-main.js`.
- `scripts/build_underwritten.py` and `tests/test_underwritten.mjs`.
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
