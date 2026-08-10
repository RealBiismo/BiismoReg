(() => {
  const BRAND_FILES = Object.freeze({
    ABARTH: "abarth-logo.svg",
    ACURA: "acura-logo.svg",
    "ALFA ROMEO": "alfa-romeo-logo.svg",
    ALPINE: "alpine-logo.svg",
    "ASTON MARTIN": "aston-martin-logo.svg",
    AUDI: "audi-logo.svg",
    BENTLEY: "bentley-logo.svg",
    BMW: "bmw-logo.svg",
    BUGATTI: "bugatti-logo.svg",
    BYD: "byd-logo.svg",
    CHEVROLET: "chevrolet-logo.png",
    CHRYSLER: "chrysler-logo.svg",
    CITROEN: "citroen-logo.svg",
    CUPRA: "cupra-logo.svg",
    DACIA: "dacia-logo.svg",
    DAIHATSU: "daihatsu-logo.svg",
    DODGE: "dodge-logo.png",
    DS: "ds-logo.svg",
    FERRARI: "ferrari-logo.svg",
    FIAT: "fiat-logo.svg",
    FORD: "ford-logo.png",
    GENESIS: "genesis-logo.svg",
    GMC: "gmc-logo.png",
    HONDA: "honda-logo.png",
    HUMMER: "hummer-logo.svg",
    HYUNDAI: "hyundai-logo.svg",
    INEOS: "ineos-logo.svg",
    INFINITI: "infiniti-logo.svg",
    ISUZU: "isuzu-logo.svg",
    JAECOO: "jaecoo-logo.svg",
    JAGUAR: "jaguar-logo.svg",
    JEEP: "jeep-logo.svg",
    KGM: "kgm-logo.svg",
    KIA: "kia-logo.svg",
    KOENIGSEGG: "koenigsegg-logo.svg",
    LAMBORGHINI: "lamborghini-logo.png",
    "LAND ROVER": "land-rover-logo.svg",
    LEXUS: "lexus-logo.png",
    LOTUS: "lotus-logo.svg",
    LUCID: "lucid-logo.png",
    MASERATI: "maserati-logo.png",
    MAXUS: "maxus-logo.png",
    MAZDA: "mazda-logo.svg",
    MCLAREN: "mclaren-logo.svg",
    "MERCEDES-BENZ": "mercedes-benz-logo.svg",
    MG: "mg-logo.png",
    MINI: "mini-logo.svg",
    MITSUBISHI: "mitsubishi-logo.svg",
    MORGAN: "morgan-logo.png",
    NISSAN: "nissan-logo.svg",
    OMODA: "omoda-logo.png",
    OPEL: "opel-logo.svg",
    ORA: "ora-logo.png",
    PAGANI: "pagani-logo.png",
    PEUGEOT: "peugeot-logo.svg",
    POLESTAR: "polestar-logo.png",
    PORSCHE: "porsche-logo.svg",
    RAM: "ram-logo.svg",
    RENAULT: "renault-logo.svg",
    RIVIAN: "rivian-logo.svg",
    "ROLLS-ROYCE": "rolls-royce-logo.svg",
    ROVER: "rover-logo.png",
    SAAB: "saab-logo.png",
    SEAT: "seat-logo.svg",
    SKODA: "skoda-logo.svg",
    SMART: "smart-logo.png",
    SSANGYONG: "ssangyong-logo.png",
    SUBARU: "subaru-logo.png",
    SUZUKI: "suzuki-logo.svg",
    TESLA: "tesla-logo.svg",
    TOYOTA: "toyota-logo.svg",
    TVR: "tvr-logo.png",
    VAUXHALL: "vauxhall-logo.png",
    VINFAST: "vinfast-logo.png",
    VOLKSWAGEN: "volkswagen-logo.svg",
    VOLVO: "volvo-logo.svg",
    XPENG: "xpeng-logo.png"
  });

  const MAKE_ALIASES = Object.freeze({
    "MERCEDES BENZ": "MERCEDES-BENZ",
    MERCEDES: "MERCEDES-BENZ",
    LANDROVER: "LAND ROVER",
    "RANGE ROVER": "LAND ROVER",
    "ALFA-ROMEO": "ALFA ROMEO",
    "ROLLS ROYCE": "ROLLS-ROYCE",
    VW: "VOLKSWAGEN",
    "MG MOTOR": "MG",
    CITROËN: "CITROEN",
    ŠKODA: "SKODA"
  });

  const KNOWN_MAKES = Object.freeze(
    [...new Set([...Object.keys(BRAND_FILES), ...Object.keys(MAKE_ALIASES)])]
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
    const filename = BRAND_FILES[normaliseMake(make)];
    return filename ? `/brands/${encodeURIComponent(filename)}` : null;
  }

  function logoMarkup(make) {
    const normalised = normaliseMake(make);
    const url = logoUrl(normalised);
    if (!url) return `<span class="vehicle-brand-fallback" aria-hidden="true">${escapeHtml(initials(normalised))}</span>`;
    return `<img class="vehicle-brand-logo" src="${escapeHtml(url)}" alt="${escapeHtml(normalised)} logo" loading="eager">`;
  }

  function resolveMakeFromTitle(title) {
    const text = normaliseMake(title);
    const candidate = KNOWN_MAKES.find((make) => text === make || text.startsWith(`${make} `));
    return normaliseMake(candidate || text.split(" ")[0] || "CAR");
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

  const result = document.getElementById("result");
  if (!result) return;
  const observer = new MutationObserver(decorateResult);
  observer.observe(result, { childList: true, subtree: true });
  decorateResult();
})();
