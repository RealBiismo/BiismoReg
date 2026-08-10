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