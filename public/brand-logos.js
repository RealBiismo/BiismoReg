(() => {
  const BRAND_LOGOS = Object.freeze({
    BMW: "/brands/bmw.svg",
    AUDI: "/brands/audi.svg",
    VOLKSWAGEN: "/brands/volkswagen.svg",
    VW: "/brands/volkswagen.svg",
    TOYOTA: "/brands/toyota.svg",
  });

  const MAKE_ALIASES = Object.freeze({
    "MERCEDES BENZ": "MERCEDES-BENZ",
    "MERCEDES-BENZ": "MERCEDES-BENZ",
    "LANDROVER": "LAND ROVER",
    "RANGE ROVER": "LAND ROVER",
    "ALFA-ROMEO": "ALFA ROMEO",
  });

  function normaliseMake(value) {
    const normalised = String(value || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");
    return MAKE_ALIASES[normalised] || normalised;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function initials(make) {
    return normaliseMake(make)
      .split(/[\s-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("") || "CAR";
  }

  function logoMarkup(make) {
    const normalised = normaliseMake(make);
    const localLogo = BRAND_LOGOS[normalised];

    if (localLogo) {
      return `<img class="vehicle-brand-logo" src="${localLogo}" alt="${escapeHtml(normalised)} logo" loading="eager">`;
    }

    return `<span class="vehicle-brand-fallback" aria-hidden="true">${escapeHtml(initials(normalised))}</span>`;
  }

  function resolveMakeFromTitle(title) {
    const text = normaliseMake(title);
    const candidates = [
      ...Object.keys(BRAND_LOGOS),
      "MERCEDES-BENZ",
      "LAND ROVER",
      "RANGE ROVER",
      "ALFA ROMEO",
      "VAUXHALL",
      "FORD",
      "HONDA",
      "NISSAN",
      "KIA",
      "HYUNDAI",
      "VOLVO",
      "PEUGEOT",
      "RENAULT",
      "CITROEN",
      "SKODA",
      "SEAT",
      "CUPRA",
      "FIAT",
      "MINI",
      "JAGUAR",
      "TESLA",
      "PORSCHE",
      "MAZDA",
      "MITSUBISHI",
      "SUZUKI",
      "LEXUS",
      "BENTLEY",
      "FERRARI",
      "LAMBORGHINI",
      "MASERATI",
      "MCLAREN",
    ].sort((a, b) => b.length - a.length);

    return candidates.find((candidate) => text === candidate || text.startsWith(`${candidate} `)) || text.split(" ")[0] || "CAR";
  }

  function decorateResult() {
    const title = document.querySelector("#result .car-title");
    if (!title || title.closest(".vehicle-title-row")) return;

    const make = title.dataset.make || resolveMakeFromTitle(title.textContent || "");
    const row = document.createElement("div");
    row.className = "vehicle-title-row";
    row.innerHTML = `<span class="vehicle-brand-mark">${logoMarkup(make)}</span>`;
    title.parentNode.insertBefore(row, title);
    row.appendChild(title);
  }

  const result = document.getElementById("result");
  if (!result) return;

  const observer = new MutationObserver(decorateResult);
  observer.observe(result, { childList: true, subtree: true });
  decorateResult();
})();
