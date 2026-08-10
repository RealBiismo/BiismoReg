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

  window.addEventListener("DOMContentLoaded", () => {
    const style = document.createElement("style");
    style.textContent = `
      #vehicleForm .plate { position: relative; }
      #vehicleForm .plate .plate-scanner-button {
        position: absolute; right: 8px; top: 8px; z-index: 4;
        width: 38px; height: 38px; min-height: 38px; margin: 0;
        padding: 0; border-radius: 10px; border: 1px solid rgba(0,0,0,.18);
        background: rgba(255,255,255,.72); color: #111; font-size: 18px;
        display: grid; place-items: center; backdrop-filter: blur(8px);
      }
      #vehicleForm .plate input { padding-right: 54px; }
      @media (max-width: 680px) {
        #vehicleForm .plate .plate-scanner-button { width: 34px; height: 34px; min-height: 34px; right: 7px; top: 7px; font-size: 16px; }
        #vehicleForm .plate input { padding-right: 48px; }
      }
    `;
    document.head.appendChild(style);

    const plate = document.querySelector("#vehicleForm .plate");
    const button = document.getElementById("plateScannerButton");
    const input = document.getElementById("plateScannerInput");
    if (!plate || !button) return;
    if (input) plate.appendChild(input);
    plate.appendChild(button);
    button.textContent = "📷";
    button.setAttribute("aria-label", "Scan a number plate with the camera");
    button.title = "Scan number plate";
  });
})();