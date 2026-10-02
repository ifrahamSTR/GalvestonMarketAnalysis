/**
 * Presentation helpers plus the Section 2 market card and Section 5 prose.
 * Builds DOM from data.js (prose/config) and region_data.js (generated);
 * never hardcodes market content. Shared, unchanged, across market sites.
 */

// ---------------------------------------------------------------------------
// Formatting / DOM helpers
// ---------------------------------------------------------------------------
function fmtCurrency(n) {
  if (n == null || isNaN(n)) return "—";
  return "$" + Math.round(n).toLocaleString("en-US");
}
function fmtK(n) {
  if (n == null || isNaN(n)) return "—";
  return "$" + Math.round(n / 1000) + "k";
}
function fmtX(n) {
  return n == null || isNaN(n) ? "—" : n.toFixed(2) + "×";
}
function el(tag, className, html) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html != null) node.innerHTML = html;
  return node;
}
function listHtml(items) {
  return "<ul>" + items.map((i) => "<li>" + i + "</li>").join("") + "</ul>";
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function sizeLabel(s) {
  return s.replace("Studio-1BR", "Studio–1BR").replace("1-2BR", "1–2BR");
}

// ---------------------------------------------------------------------------
// Images + lightbox
// ---------------------------------------------------------------------------
function photoFigure(p) {
  const figure = el("figure", "photo-figure");
  const button = el("button", "photo-figure__trigger");
  button.type = "button";
  const img = el("img");
  img.src = p.file;
  img.alt = p.alt || "";
  img.loading = "lazy";
  img.decoding = "async";
  button.appendChild(img);
  button.addEventListener("click", () => openLightbox(p.file, p.alt, p.caption));
  figure.appendChild(button);
  if (p.caption) figure.appendChild(el("figcaption", null, p.caption));
  return figure;
}

function openLightbox(src, alt, caption) {
  const lightbox = document.getElementById("lightbox");
  document.getElementById("lightbox-image").src = src;
  document.getElementById("lightbox-image").alt = alt || "";
  document.getElementById("lightbox-caption").innerHTML = caption || "";  // captions are author-written (credit links)
  lightbox.classList.add("lightbox--open");
  lightbox.setAttribute("aria-hidden", "false");
}
function closeLightbox() {
  const lightbox = document.getElementById("lightbox");
  lightbox.classList.remove("lightbox--open");
  lightbox.setAttribute("aria-hidden", "true");
  document.getElementById("lightbox-image").src = "";
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------
function renderHero() {
  const t = document.getElementById("hero-title"), s = document.getElementById("hero-sub");
  if (t) t.innerHTML = HERO.title;
  if (s) s.innerHTML = HERO.sub;
  const f = document.getElementById("footer-note");
  if (f) f.innerHTML = typeof FOOTER_NOTE === "function" ? FOOTER_NOTE() : FOOTER_NOTE;
}

// ---------------------------------------------------------------------------
// Section 2 — Market context card
// ---------------------------------------------------------------------------
function renderMarketOverview() {
  const host = document.getElementById("market-overview-body");
  if (!host) return;
  host.innerHTML = "";
  const hero = el("div", "bb2-hero");
  if (MARKET_OVERVIEW.heroImage) {
    const media = el("div", "bb2-hero__media");
    media.appendChild(photoFigure(MARKET_OVERVIEW.heroImage));
    hero.appendChild(media);
  } else {
    hero.classList.add("bb2-hero--no-media");
  }
  const body = el("div", "bb2-hero__body");
  body.appendChild(el("h3", null, MARKET_NAME));
  const chipRow = el("div", "bb2-chip-row");
  MARKET_OVERVIEW.chips.forEach((c) => chipRow.appendChild(el("span", "bb2-chip", c.label)));
  body.appendChild(chipRow);
  body.appendChild(el("h3", "subsection-title", "Demand Drivers"));
  body.appendChild(el("div", null, listHtml(MARKET_OVERVIEW.attractions)));
  hero.appendChild(body);
  host.appendChild(hero);

  const below = el("div", "market-below");
  const stats = el("div");
  stats.appendChild(el("p", "market-below__head", "<strong>" + MARKET_OVERVIEW.visitorStats.headline + "</strong>"));
  const statRow = el("div", "bb2-stat-row");
  MARKET_OVERVIEW.visitorStats.breakdown.forEach((s) => {
    const card = el("div", "bb2-stat");
    card.appendChild(el("div", "bb2-stat__value", s.value));
    card.appendChild(el("div", "bb2-stat__label", s.label));
    statRow.appendChild(card);
  });
  stats.appendChild(statRow);
  below.appendChild(stats);
  const watch = el("div");
  watch.appendChild(el("p", "market-below__head", "<strong>Demand watch-outs</strong>"));
  watch.appendChild(el("div", "watch-outs", listHtml(MARKET_OVERVIEW.watchOuts)));
  below.appendChild(watch);
  host.appendChild(below);
  const sources = el("p", "market-sources");
  sources.innerHTML = "Sources: " + MARKET_OVERVIEW.sources.map((s) => '<a href="' + s.url + '" target="_blank" rel="noopener">' + s.label + "</a>").join(" · ");
  host.appendChild(sources);
}

// ---------------------------------------------------------------------------
// Section 5 — Traveller demographics prose (charts live in charts.js)
// ---------------------------------------------------------------------------
function renderDemographics() {
  const host = document.getElementById("demographics-intro-body");
  if (!host) return;
  host.innerHTML = "<p>" + (typeof DEMOGRAPHICS_NOTE === "function" ? DEMOGRAPHICS_NOTE() : DEMOGRAPHICS_NOTE) + "</p>";
}
