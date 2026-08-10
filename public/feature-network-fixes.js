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