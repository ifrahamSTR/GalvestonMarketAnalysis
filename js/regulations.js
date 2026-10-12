/**
 * Section 6, STR regulations. Galveston's own file (not part of the shared
 * template): renders STR_REGULATIONS from data.js with the shared regs-card /
 * dd-row styles, the same layout as the Charlotte site's Regulations section
 * (tier pill, short summary, labelled rows of bullets, official sources).
 * Two cities share the island, so the City of Galveston comes first and
 * Jamaica Beach follows with only what differs from Galveston.
 * Uses el() / listHtml() / escapeHtml() from render.js.
 */
(function () {
  function tierPill(c) {
    const tier = el("div", "regs-card__tier" + (c.tierKey === "moderate" ? " regs-card__tier--moderate" : ""));
    tier.innerHTML = '<span class="regs-card__tier-dot"></span>' + escapeHtml(c.tier);
    return tier;
  }

  function sourcesLine(list) {
    const links = list.map((s) => '<a href="' + escapeHtml(s.url) + '" target="_blank" rel="noopener">' + escapeHtml(s.label) + "</a>");
    return el("p", "dd-note regs-card__sources", "<strong>Official sources:</strong> " + links.join(" · "));
  }

  function row(rows, label, valueNode) {
    const r = el("div", "dd-row");
    r.appendChild(el("span", "dd-row__label", label));
    const v = el("div", "dd-row__value");
    if (typeof valueNode === "string") v.innerHTML = valueNode;
    else v.appendChild(valueNode);
    r.appendChild(v);
    rows.appendChild(r);
  }

  // One city: heading, where it applies, then the Charlotte-style card.
  function cityBlock(c, id) {
    const block = el("div", "regs-city");
    block.id = id;
    const head = el("div", "regs-city__head");
    head.appendChild(el("h3", "regs-city__name", escapeHtml(c.name)));
    if (c.badge) head.appendChild(el("span", "regs-city__badge", escapeHtml(c.badge)));
    block.appendChild(head);
    if (c.appliesTo) block.appendChild(el("p", "regs-city__applies", c.appliesTo));
    if (c.alert) block.appendChild(el("p", "watch-outs regs-alert", c.alert));
    const card = el("div", "regs-card");
    card.appendChild(tierPill(c));
    card.appendChild(el("p", "regs-card__summary", c.tierNote));
    block.appendChild(card);
    return { block, card };
  }

  // Jamaica Beach vs Galveston, one row per difference (stacks on phones).
  function diffTable(diffs, names) {
    const t = el("table", "regs-diff");
    t.innerHTML =
      "<thead><tr><th scope=\"col\"><span class=\"visually-hidden\">Rule</span></th><th scope=\"col\">" + escapeHtml(names[0]) + "</th><th scope=\"col\">" + escapeHtml(names[1]) + "</th></tr></thead>" +
      "<tbody>" + diffs.map((d) =>
        '<tr><th scope="row">' + escapeHtml(d.topic) + "</th>" +
        '<td class="regs-diff__jb" data-label="' + escapeHtml(names[0]) + '">' + d.jb + "</td>" +
        '<td class="regs-diff__gal" data-label="' + escapeHtml(names[1]) + '">' + d.gal + "</td></tr>").join("") + "</tbody>";
    return t;
  }

  function render() {
    const host = document.getElementById("regulations-body");
    if (!host || typeof STR_REGULATIONS === "undefined") return;
    const R = STR_REGULATIONS;
    const lede = document.getElementById("regs-lede");
    if (lede && R.lede) lede.innerHTML = R.lede;

    const G = R.galveston;
    const g = cityBlock(G, "regs-galveston");
    const gRows = el("div", "dd-rows");
    row(gRows, "Permit / Residency", listHtml(G.permitResidency));
    row(gRows, "Operating Limits", listHtml(G.operatingLimits));
    row(gRows, "Investor Notes", listHtml(G.investorNotes));
    g.card.appendChild(gRows);
    g.card.appendChild(sourcesLine(G.sources));
    host.appendChild(g.block);

    const J = R.jamaicaBeach;
    const j = cityBlock(J, "regs-jamaica-beach");
    j.block.classList.add("regs-city--diff");
    const jRows = el("div", "dd-rows");
    row(jRows, "Differs from Galveston", diffTable(J.differences, ["Jamaica Beach", "City of Galveston"]));
    if (J.same && J.same.length) row(jRows, "Same as Galveston", listHtml(J.same));
    j.card.appendChild(jRows);
    j.card.appendChild(sourcesLine(J.sources));
    host.appendChild(j.block);

    if (R.note) host.appendChild(el("p", "dd-note regs-note", R.note));
  }

  document.addEventListener("DOMContentLoaded", render);
})();
