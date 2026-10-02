# Galveston, TX — STR Market & Location Analysis

Static site (no build step), same template as the Park City and Charlotte market sites. It covers **Sections 2–5 only**: Market, Location Analysis by Bedroom Size, Why Location Changes the Rate, and Traveller Demographics. **No buy boxes yet.**

## Pipeline

1. `../notebooks/market_common.py` holds the market specifics:
   - workbook `../Galveston - TX.xlsx` → `Cleaned_Data`;
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
