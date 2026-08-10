(() => {
  const previousFetch = window.fetch.bind(window);

  function compactSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== "object") return snapshot;
    const history = [...(snapshot.motHistory || [])]
      .sort((a, b) => new Date(b.completedDate) - new Date(a.completedDate))
      .slice(0, 10)
      .map((test) => ({
        completedDate: test.completedDate || null,
        result: test.result || "UNKNOWN",
        mileage: test.mileage ?? null,
        mileageUnit: test.mileageUnit || "mi",
        defectCount: Array.isArray(test.defects) ? test.defects.length : 0,
      }));

    const fields = [
      "registration", "make", "model", "colour", "fuelType", "engineCapacity", "year",
      "monthOfFirstRegistration", "taxStatus", "taxDueDate", "motStatus", "motExpiryDate",
      "co2Emissions", "euroStatus", "realDrivingEmissions", "typeApproval", "wheelplan",
      "revenueWeight", "exportMarker", "dateOfLastV5CIssued", "biismoAnalysis"
    ];
    const compact = { motHistory: history };
    fields.forEach((key) => { if (snapshot[key] !== undefined) compact[key] = snapshot[key]; });
    return compact;
  }

  window.fetch = async (input, options = {}) => {
    const target = typeof input === "string" ? input : input?.url || "";
    if (target.includes("/api/share-report") && typeof options.body === "string") {
      try {
        const body = JSON.parse(options.body);
        if (body?.snapshot) {
          options = { ...options, body: JSON.stringify({ ...body, snapshot: compactSnapshot(body.snapshot) }) };
        }
      } catch {
        // Leave the original request untouched if it is not JSON.
      }
    }
    return previousFetch(input, options);
  };

  function cameraIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 7 9 4.8h6L16.5 7H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2.5Z"/><circle cx="12" cy="13" r="3.2"/></svg>';
  }

  window.addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style");
    style.textContent = `
      @media (min-width: 821px) {
        .home-page .site-header.home-header {
          position: relative !important;
          width: min(1180px, calc(100% - 48px)) !important;
          min-height: 116px !important;
          margin: 0 auto !important;
          padding: 18px 0 10px !important;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
        }
        .home-page .site-header.home-header .brand {
          position: static !important;
          margin: 0 auto !important;
        }
        .home-page .site-header.home-header .brand img {
          width: 170px !important;
          max-width: 170px !important;
          height: auto !important;
        }
        .home-page .home-header-actions {
          position: absolute !important;
          right: 0 !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          margin: 0 !important;
          z-index: 5 !important;
        }
        .home-page .home-header-actions .header-action {
          position: static !important;
          transform: none !important;
          margin: 0 !important;
        }
        .home-page .home-main,
        .home-page:not(:has(#result > *)) .home-main {
          width: min(900px, calc(100% - 48px)) !important;
          margin: 0 auto !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 26px !important;
        }
        .home-page .hero-shell,
        .home-page:not(:has(#result > *)) .hero-shell {
          width: 100% !important;
          padding: 18px 0 0 !important;
          margin: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: stretch !important;
          justify-content: flex-start !important;
          gap: 30px !important;
        }
        .home-page .hero-copy {
          width: 100% !important;
          max-width: 820px !important;
          margin: 0 auto !important;
          text-align: center !important;
        }
        .home-page .hero-copy .eyebrow { display: none !important; }
        .home-page .hero-copy h1 {
          margin: 0 !important;
          font-size: clamp(48px, 5vw, 68px) !important;
          line-height: .98 !important;
          letter-spacing: -.035em !important;
          text-align: center !important;
        }
        .home-page .hero-copy > p {
          max-width: 700px !important;
          margin: 16px auto 0 !important;
          font-size: 18px !important;
          line-height: 1.45 !important;
          text-align: center !important;
        }
        .home-page .search-panel {
          width: min(760px, 100%) !important;
          margin: 0 auto !important;
          align-self: center !important;
        }
        .home-page .homepage-footer-note {
          width: min(900px, 100%) !important;
          margin: 6px auto 0 !important;
          padding: 18px 16px !important;
          flex-direction: column !important;
          gap: 7px !important;
          text-align: center !important;
        }
        .home-page .homepage-footer-note > div,
        .home-page .homepage-footer-note p,
        .home-page .homepage-footer-note a {
          text-align: center !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
      }

      #vehicleForm .plate {
        position: relative;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) 52px;
        overflow: hidden;
      }
      #vehicleForm .plate .gb { grid-column: 1; }
      #vehicleForm .plate input {
        grid-column: 2;
        min-width: 0;
        width: 100%;
        padding-left: 8px !important;
        padding-right: 8px !important;
      }
      #vehicleForm .plate .plate-scanner-button {
        grid-column: 3;
        position: static !important;
        width: 52px;
        height: 100%;
        min-height: 0;
        margin: 0;
        padding: 0;
        border: 0;
        border-left: 1px solid rgba(0,0,0,.16);
        border-radius: 0;
        background: rgba(255,255,255,.2);
        color: #181818;
        display: grid;
        place-items: center;
        cursor: pointer;
        z-index: 1;
      }
      #vehicleForm .plate .plate-scanner-button svg {
        width: 23px;
        height: 23px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      #vehicleForm .plate .plate-scanner-button:disabled { opacity: .55; }
      #vehicleForm .plate.is-scanning input::placeholder {
        color: rgba(0,0,0,.68);
        opacity: 1;
      }
      @media (max-width: 820px) {
        .home-page .home-header-actions {
          position: static !important;
          transform: none !important;
          margin: 0 !important;
        }
      }
      @media (max-width: 680px) {
        #vehicleForm .plate { grid-template-columns: auto minmax(0, 1fr) 46px; }
        #vehicleForm .plate .plate-scanner-button { width: 46px; }
        #vehicleForm .plate .plate-scanner-button svg { width: 21px; height: 21px; }
      }
    `;
    document.head.appendChild(style);

    const plate = document.querySelector("#vehicleForm .plate");
    const button = document.getElementById("plateScannerButton");
    const fileInput = document.getElementById("plateScannerInput");
    const regInput = document.getElementById("regInput");
    const formError = document.getElementById("formError");
    if (!plate || !button || !regInput) return;

    if (fileInput) plate.appendChild(fileInput);
    plate.appendChild(button);
    button.innerHTML = cameraIcon();
    button.setAttribute("aria-label", "Scan a number plate with the camera");
    button.title = "Scan number plate";

    let scanning = false;
    let normalPlaceholder = regInput.getAttribute("placeholder") || "PA55 MGN";

    const syncScannerState = () => {
      const nowScanning = button.disabled;
      if (nowScanning && !scanning) {
        scanning = true;
        normalPlaceholder = regInput.value ? normalPlaceholder : (regInput.getAttribute("placeholder") || "PA55 MGN");
        if (!regInput.value) regInput.placeholder = "Searching…";
        plate.classList.add("is-scanning");
      } else if (!nowScanning && scanning) {
        scanning = false;
        plate.classList.remove("is-scanning");
        regInput.placeholder = normalPlaceholder || "PA55 MGN";
      }
      if (button.innerHTML !== cameraIcon()) button.innerHTML = cameraIcon();
    };

    const buttonObserver = new MutationObserver(syncScannerState);
    buttonObserver.observe(button, { attributes: true, childList: true, subtree: true, attributeFilter: ["disabled"] });

    if (formError) {
      const errorObserver = new MutationObserver(() => {
        const text = formError.textContent || "";
        if (/couldn't confidently read|could not be read|no.*registration/i.test(text)) {
          formError.textContent = "Error: no reg found, try again.";
        } else if (/Analysing the number plate/i.test(text)) {
          formError.textContent = "Searching for a registration…";
        }
      });
      errorObserver.observe(formError, { childList: true, characterData: true, subtree: true });
    }

    syncScannerState();
  });
})();