(() => {
  const CARDOG_BASE = "https://cdn.jsdelivr.net/npm/@cardog-icons/core@1.2.0/optimized/";
  const OTHER_LOGOS = Object.freeze({
    VAUXHALL: "https://cdn.jsdelivr.net/npm/@thesvg/icons/icons/vauxhall.svg",
    OPEL: "https://cdn.jsdelivr.net/npm/@thesvg/icons/icons/opel.svg",
    PEUGEOT: "https://cdn.jsdelivr.net/npm/@thesvg/icons/icons/peugeot.svg",
    RENAULT: "https://cdn.jsdelivr.net/npm/@thesvg/icons/icons/renault.svg",
    CITROEN: "https://cdn.jsdelivr.net/npm/@thesvg/icons/icons/citroen.svg",
    SKODA: "https://cdn.jsdelivr.net/npm/@thesvg/icons/icons/skoda.svg",
    SEAT: "https://cdn.jsdelivr.net/npm/@thesvg/icons/icons/seat.svg",
    CUPRA: "https://cdn.jsdelivr.net/npm/@thesvg/icons/icons/cupra.svg",
    SUZUKI: "https://cdn.jsdelivr.net/npm/@thesvg/icons/icons/suzuki.svg",
    DACIA: "https://cdn.jsdelivr.net/npm/@thesvg/icons/icons/dacia.svg",
    MG: "https://cdn.jsdelivr.net/npm/@thesvg/icons/icons/mg.svg",
  });

  const CARDOG_FILES = Object.freeze({
    ACURA: "Acura Icon.svg",
    "ALFA ROMEO": "Alfa Romeo Icon.svg",
    "ASTON MARTIN": "Aston Martin Icon.svg",
    AUDI: "Audi Icon.svg",
    BENTLEY: "Bentley Icon.svg",
    BMW: "BMW Icon.svg",
    BUGATTI: "Bugatti Icon.svg",
    BUICK: "Buick Icon.svg",
    BYD: "BYD Icon.svg",
    CADILLAC: "Cadillac Icon.svg",
    CHEVROLET: "Chevrolet Icon.svg",
    CHRYSLER: "Chrysler Icon.svg",
    DODGE: "Dodge Icon.svg",
    FERRARI: "Ferrari Icon.svg",
    FIAT: "Fiat Icon.svg",
    FORD: "Ford Icon.svg",
    GENESIS: "Genesis Icon.svg",
    GMC: "GMC Icon.svg",
    HONDA: "Honda Icon.svg",
    HUMMER: "Hummer Icon.svg",
    HYUNDAI: "Hyundai Icon.svg",
    INFINITI: "Infiniti Icon.svg",
    JAGUAR: "Jaguar Icon.svg",
    JEEP: "Jeep Icon.svg",
    KIA: "Kia Icon.svg",
    KOENIGSEGG: "Koenigsegg Icon.svg",
    LAMBORGHINI: "Lamborghini Icon.svg",
    "LAND ROVER": "Landrover Icon.svg",
    LEXUS: "Lexus Icon.svg",
    LINCOLN: "Lincoln Icon.svg",
    LOTUS: "Lotus Icon.svg",
    LUCID: "Lucid Icon.svg",
    MASERATI: "Maserati Icon.svg",
    MAZDA: "Mazda Icon.svg",
    "MERCEDES-BENZ": "MB Icon.svg",
    MCLAREN: "McLaren Icon.svg",
    MINI: "Mini Icon.svg",
    MITSUBISHI: "Mitsubishi Icon.svg",
    NISSAN: "Nissan Icon.svg",
    PAGANI: "Pagani Icon.svg",
    POLESTAR: "Polestar Icon.svg",
    PORSCHE: "Porsche Icon.svg",
    RAM: "RAM Icon.svg",
    RIVIAN: "Rivian Icon.svg",
    "ROLLS-ROYCE": "RollsRoyce Icon.svg",
    SUBARU: "Subaru Icon.svg",
    TESLA: "Tesla Icon.svg",
    TOYOTA: "Toyota Icon.svg",
    VINFAST: "Vinfast Icon.svg",
    VOLKSWAGEN: "Volkswagen Icon.svg",
    VOLVO: "Volvo Icon.svg",
  });

  const MAKE_ALIASES = Object.freeze({
    "MERCEDES BENZ": "MERCEDES-BENZ",
    MERCEDES: "MERCEDES-BENZ",
    "LANDROVER": "LAND ROVER",
    "RANGE ROVER": "LAND ROVER",
    "ALFA-ROMEO": "ALFA ROMEO",
    "ROLLS ROYCE": "ROLLS-ROYCE",
    "VW": "VOLKSWAGEN",
    "MG MOTOR": "MG",
  });

  const KNOWN_MAKES = Object.freeze(
    [...new Set([...Object.keys(CARDOG_FILES), ...Object.keys(OTHER_LOGOS), ...Object.keys(MAKE_ALIASES)])]
      .sort((a, b) => b.length - a.length)
  );

  function normaliseMake(value) {
    const normalised = String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[._]/g, " ")
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

  function logoUrl(make) {
    const normalised = normaliseMake(make);
    const cardogFile = CARDOG_FILES[normalised];
    if (cardogFile) return `${CARDOG_BASE}${encodeURIComponent(cardogFile).replaceAll("%2F", "/")}`;
    return OTHER_LOGOS[normalised] || null;
  }

  function logoMarkup(make) {
    const normalised = normaliseMake(make);
    const url = logoUrl(normalised);
    if (!url) return `<span class="vehicle-brand-fallback" aria-hidden="true">${escapeHtml(initials(normalised))}</span>`;
    return `<img class="vehicle-brand-logo" src="${escapeHtml(url)}" alt="${escapeHtml(normalised)} logo" loading="eager" referrerpolicy="no-referrer">`;
  }

  function resolveMakeFromTitle(title) {
    const text = normaliseMake(title);
    const candidate = KNOWN_MAKES.find((make) => text === make || text.startsWith(`${make} `));
    return normaliseMake(candidate || text.split(" ")[0] || "CAR");
  }

  function installStyles() {
    if (document.getElementById("vehicleBrandLogoStyles")) return;
    const style = document.createElement("style");
    style.id = "vehicleBrandLogoStyles";
    style.textContent = `
      .vehicle-title-row{display:flex;align-items:center;gap:14px;min-width:0}
      .vehicle-brand-mark{width:54px;height:54px;flex:0 0 54px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.10);border-radius:15px;background:rgba(255,255,255,.055);overflow:hidden}
      .vehicle-brand-logo{display:block;max-width:42px;max-height:42px;width:auto;height:auto;object-fit:contain}
      .vehicle-brand-fallback{font-size:13px;font-weight:900;letter-spacing:.08em;color:#fff}
      .vehicle-identity-meta{display:flex;gap:22px;margin:10px 0 0 68px;color:var(--muted,#9da4b2);font-size:12px}
      .vehicle-identity-meta span{display:flex;gap:6px;align-items:baseline}.vehicle-identity-meta small{text-transform:uppercase;letter-spacing:.08em}.vehicle-identity-meta strong{color:#fff;font-size:12px}
      @media(max-width:640px){.vehicle-brand-mark{width:46px;height:46px;flex-basis:46px;border-radius:13px}.vehicle-brand-logo{max-width:36px;max-height:36px}.vehicle-identity-meta{margin-left:60px;gap:12px;flex-wrap:wrap}}
    `;
    document.head.appendChild(style);
  }

  function attachImageFallbacks(root = document) {
    root.querySelectorAll?.("img.vehicle-brand-logo:not([data-brand-fallback])").forEach((image) => {
      image.dataset.brandFallback = "true";
      image.addEventListener("error", () => {
        const mark = image.closest(".vehicle-brand-mark");
        if (!mark) return;
        const make = image.alt.replace(/ logo$/i, "");
        mark.innerHTML = `<span class="vehicle-brand-fallback" aria-hidden="true">${escapeHtml(initials(make))}</span>`;
      }, { once: true });
    });
  }

  function decorateResult() {
    const title = document.querySelector("#result .car-title");
    if (!title || title.closest(".vehicle-title-row")) return;

    const fullTitle = String(title.textContent || "").trim();
    const make = resolveMakeFromTitle(fullTitle);
    const normalisedTitle = normaliseMake(fullTitle);
    const normalisedMake = normaliseMake(make);
    const model = normalisedTitle.startsWith(`${normalisedMake} `)
      ? fullTitle.slice(normalisedMake.length).trim()
      : fullTitle.split(/\s+/).slice(1).join(" ");

    const row = document.createElement("div");
    row.className = "vehicle-title-row";
    row.innerHTML = `<span class="vehicle-brand-mark">${logoMarkup(make)}</span>`;
    title.parentNode.insertBefore(row, title);
    row.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "vehicle-identity-meta";
    meta.innerHTML = `
      <span><small>Make</small><strong>${escapeHtml(make)}</strong></span>
      <span><small>Model</small><strong>${escapeHtml(model || "Unknown")}</strong></span>
    `;
    row.insertAdjacentElement("afterend", meta);
    attachImageFallbacks(row);
  }

  installStyles();
  const result = document.getElementById("result");
  if (!result) return;
  const observer = new MutationObserver(decorateResult);
  observer.observe(result, { childList: true, subtree: true });
  decorateResult();
})();
