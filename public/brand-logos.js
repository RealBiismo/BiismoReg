(() => {
  const BRAND_ICON_SLUGS = {
    "BMW": "bmw",
    "MERCEDES-BENZ": "mercedesbenz",
    "MERCEDES": "mercedesbenz",
    "AUDI": "audi",
    "VOLKSWAGEN": "volkswagen",
    "VW": "volkswagen",
    "FORD": "ford",
    "TOYOTA": "toyota",
    "HONDA": "honda",
    "NISSAN": "nissan",
    "KIA": "kia",
    "HYUNDAI": "hyundai",
    "VOLVO": "volvo",
    "PEUGEOT": "peugeot",
    "RENAULT": "renault",
    "CITROEN": "citroen",
    "SKODA": "skoda",
    "SEAT": "seat",
    "CUPRA": "cupra",
    "FIAT": "fiat",
    "MINI": "mini",
    "LAND ROVER": "landrover",
    "RANGE ROVER": "landrover",
    "JAGUAR": "jaguar",
    "TESLA": "tesla",
    "PORSCHE": "porsche",
    "MAZDA": "mazda",
    "MITSUBISHI": "mitsubishi",
    "SUZUKI": "suzuki",
    "VAUXHALL": "vauxhall",
    "LEXUS": "lexus",
    "ALFA ROMEO": "alfaromeo",
    "BENTLEY": "bentley",
    "FERRARI": "ferrari",
    "LAMBORGHINI": "lamborghini",
    "MASERATI": "maserati",
    "MCLAREN": "mclaren",
  };

  function normaliseMake(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");
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
    const slug = BRAND_ICON_SLUGS[normalised];
    if (!slug) {
      return `<span class="vehicle-brand-fallback" aria-hidden="true">${initials(normalised)}</span>`;
    }

    const safeMake = normalised.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
    return `<img class="vehicle-brand-logo" src="https://cdn.simpleicons.org/${slug}/FFFFFF" alt="${safeMake} logo" loading="eager" referrerpolicy="no-referrer">`;
  }

  function decorateResult() {
    const title = document.querySelector("#result .car-title");
    if (!title || title.closest(".vehicle-title-row")) return;

    const make = title.textContent?.trim().split(/\s+/)[0] || "";
    const text = title.textContent || "";
    const knownMake = Object.keys(BRAND_ICON_SLUGS)
      .sort((a, b) => b.length - a.length)
      .find((candidate) => normaliseMake(text).startsWith(`${candidate} `) || normaliseMake(text) === candidate);
    const resolvedMake = knownMake || make;

    const row = document.createElement("div");
    row.className = "vehicle-title-row";
    row.innerHTML = `<span class="vehicle-brand-mark">${logoMarkup(resolvedMake)}</span>`;
    title.parentNode.insertBefore(row, title);
    row.appendChild(title);
  }

  const observer = new MutationObserver(decorateResult);
  const result = document.getElementById("result");
  if (result) {
    observer.observe(result, { childList: true, subtree: true });
    decorateResult();
  }
})();
