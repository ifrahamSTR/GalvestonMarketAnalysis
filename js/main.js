/**
 * Bootstraps everything on DOMContentLoaded; nav scroll-spy; lightbox wiring.
 * Shared across market sites.
 */
function initNav() {
  const links = Array.from(document.querySelectorAll(".site-nav a"));
  const targets = links
    .map((link) => ({ link, section: document.querySelector(link.getAttribute("href")) }))
    .filter((t) => t.section);
  if (!targets.length) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((l) => l.classList.remove("site-nav__link--active"));
        const match = targets.find((t) => t.section === entry.target);
        if (match) match.link.classList.add("site-nav__link--active");
      });
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  targets.forEach((t) => observer.observe(t.section));
}

function initLightbox() {
  const lightbox = document.getElementById("lightbox");
  if (!lightbox) return;
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lightbox.classList.contains("lightbox--open")) closeLightbox();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderHero();
  renderMarketOverview();
  renderRevenueDistributionChart();
  renderLocationSection();
  renderLocSizeChart();
  if (typeof renderDestinationSection === "function") renderDestinationSection();
  renderDemographics();
  renderDemographicsPieChart();
  renderDemographicsStackedBarChart();
  initNav();
  initLightbox();
});
