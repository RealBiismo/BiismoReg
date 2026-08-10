(() => {
  const knownMakes = [
    "MERCEDES-BENZ",
    "MERCEDES BENZ",
    "LAND ROVER",
    "ALFA ROMEO",
    "ROLLS-ROYCE",
    "ASTON MARTIN",
    "VOLKSWAGEN",
    "VAUXHALL",
    "PEUGEOT",
    "RENAULT",
    "CITROEN",
    "HYUNDAI",
    "TOYOTA",
    "NISSAN",
    "SKODA",
    "VOLVO",
    "JAGUAR",
    "PORSCHE",
    "FERRARI",
    "LAMBORGHINI",
    "BENTLEY",
    "MASERATI",
    "LEXUS",
    "HONDA",
    "MAZDA",
    "SUBARU",
    "SUZUKI",
    "MITSUBISHI",
    "TESLA",
    "CUPRA",
    "DACIA",
    "SEAT",
    "FIAT",
    "FORD",
    "MINI",
    "AUDI",
    "BMW",
    "KIA",
    "MG",
  ];

  function escapeXml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function normalizeMake(value) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");
  }

  function identifyMake(title) {
    const normalized = normalizeMake(title);
    return knownMakes.find((make) => normalized === make || normalized.startsWith(`${make} `)) || normalized.split(" ")[0] || "CAR";
  }

  function svgData(svg) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function genericBadge(make) {
    const short = make.length <= 6 ? make : make.split(/[\s-]+/).map((part) => part[0]).join("").slice(0, 4);
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
        <rect width="96" height="96" rx="24" fill="#101216"/>
        <rect x="4" y="4" width="88" height="88" rx="21" fill="none" stroke="#ffffff" stroke-opacity=".22" stroke-width="4"/>
        <text x="48" y="55" fill="#fff" font-family="Arial,Helvetica,sans-serif" font-size="${short.length > 4 ? 20 : 25}" font-weight="800" text-anchor="middle">${escapeXml(short)}</text>
      </svg>`;
  }

  function badgeSvg(make) {
    switch (make) {
      case "BMW":
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="48" cy="48" r="44" fill="#111" stroke="#ddd" stroke-width="4"/><circle cx="48" cy="51" r="25" fill="#fff"/><path d="M48 26a25 25 0 0 1 25 25H48Z" fill="#1686d9"/><path d="M48 76a25 25 0 0 1-25-25h25Z" fill="#1686d9"/><text x="48" y="22" fill="#fff" font-family="Arial" font-size="15" font-weight="800" text-anchor="middle">BMW</text></svg>`;
      case "AUDI":
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 64"><rect width="128" height="64" rx="16" fill="#111"/><g fill="none" stroke="#fff" stroke-width="6"><circle cx="34" cy="32" r="18"/><circle cx="54" cy="32" r="18"/><circle cx="74" cy="32" r="18"/><circle cx="94" cy="32" r="18"/></g></svg>`;
      case "MERCEDES-BENZ":
      case "MERCEDES BENZ":
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="48" cy="48" r="42" fill="#111" stroke="#e7e7e7" stroke-width="4"/><path d="M48 16v31M48 47 22 66M48 47l26 19" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>`;
      case "VOLKSWAGEN":
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="48" cy="48" r="42" fill="#0d2744" stroke="#fff" stroke-width="4"/><path d="M24 25 39 49 48 35l9 14 15-24M27 61l12-12 9 17 9-17 12 12" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round"/></svg>`;
      case "FORD":
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 72"><ellipse cx="64" cy="36" rx="58" ry="29" fill="#1554a0" stroke="#fff" stroke-width="4"/><text x="64" y="45" fill="#fff" font-family="Georgia,serif" font-size="31" font-style="italic" font-weight="700" text-anchor="middle">Ford</text></svg>`;
      case "LAND ROVER":
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 72"><ellipse cx="64" cy="36" rx="57" ry="29" fill="#173f2b" stroke="#fff" stroke-width="3"/><text x="64" y="32" fill="#fff" font-family="Arial" font-size="17" font-weight="800" text-anchor="middle">LAND</text><text x="64" y="50" fill="#fff" font-family="Arial" font-size="17" font-weight="800" text-anchor="middle">ROVER</text></svg>`;
      case "NISSAN":
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="48" cy="48" r="31" fill="none" stroke="#fff" stroke-width="6"/><rect x="12" y="35" width="72" height="26" rx="4" fill="#111" stroke="#fff" stroke-width="4"/><text x="48" y="53" fill="#fff" font-family="Arial" font-size="15" font-weight="800" text-anchor="middle">NISSAN</text></svg>`;
      case "TESLA":
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="24" fill="#151515"/><path d="M24 27c16-9 32-9 48 0-6 2-11 4-16 7-2 23-4 35-8 43-4-8-6-20-8-43-5-3-10-5-16-7Z" fill="#e82127"/></svg>`;
      default:
        return genericBadge(make);
    }
  }

  function decorateTitle(title) {
    if (!title || title.dataset.brandDecorated === "1") return;
    const make = identifyMake(title.textContent);
    if (!make || make === "UNKNOWN") return;

    const wrapper = document.createElement("span");
    wrapper.className = "vehicle-brand-title";

    const badge = document.createElement("img");
    badge.className = "vehicle-brand-badge";
    badge.src = svgData(badgeSvg(make));
    badge.alt = `${make} logo`;
    badge.width = 52;
    badge.height = 52;

    title.parentNode.insertBefore(wrapper, title);
    wrapper.append(badge, title);
    title.dataset.brandDecorated = "1";
  }

  function decorateResults() {
    document.querySelectorAll("#result .car-title").forEach(decorateTitle);
  }

  const result = document.getElementById("result");
  if (!result) return;

  decorateResults();
  new MutationObserver(decorateResults).observe(result, { childList: true, subtree: true });
})();
