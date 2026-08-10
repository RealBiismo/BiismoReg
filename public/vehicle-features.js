(() => {
  const originalFetch = window.fetch.bind(window);
  let lastVehicle = null;
  let enrichedRegistration = null;

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    try {
      const target = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      if (target.includes("/api/check") && response.ok) {
        const data = await response.clone().json();
        if (data?.registration) lastVehicle = data;
      }
    } catch {
      // Vehicle intelligence is optional; never interrupt a normal check.
    }
    return response;
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function readings(history) {
    return (history || [])
      .map((test) => ({
        date: new Date(test.completedDate),
        mileage: Number.parseInt(String(test.mileage ?? "").replace(/[^\d]/g, ""), 10),
      }))
      .filter((item) => !Number.isNaN(item.date.getTime()) && Number.isFinite(item.mileage))
      .sort((a, b) => a.date - b.date);
  }

  function mileageAnalysis(history) {
    const list = readings(history);
    const anomalies = [];
    for (let i = 1; i < list.length; i += 1) {
      const previous = list[i - 1];
      const current = list[i];
      if (current.mileage < previous.mileage) {
        anomalies.push({
          from: previous.mileage,
          to: current.mileage,
          date: current.date,
          drop: previous.mileage - current.mileage,
        });
      }
    }
    const first = list[0];
    const latest = list.at(-1);
    let annual = null;
    if (first && latest && latest.mileage >= first.mileage && latest.date > first.date) {
      const years = (latest.date - first.date) / 31_557_600_000;
      if (years > 0.2) annual = Math.round((latest.mileage - first.mileage) / years);
    }
    return { list, anomalies, latest: latest?.mileage ?? null, annual };
  }

  function defectStats(history) {
    const tests = history || [];
    const buckets = new Map();
    let dangerous = 0;
    let major = 0;
    let advisory = 0;
    let failed = 0;

    const categories = [
      ["Brakes", /brake|disc|pad|caliper|servo/i],
      ["Tyres & wheels", /tyre|tire|wheel|rim/i],
      ["Suspension", /suspension|spring|shock|damper|wishbone|bush|ball joint/i],
      ["Steering", /steering|track rod|rack|power steering/i],
      ["Lights & electrics", /lamp|light|headlamp|indicator|electrical|battery/i],
      ["Corrosion & structure", /corrosion|corroded|rust|structure|chassis|subframe/i],
      ["Exhaust & emissions", /exhaust|emission|lambda|catalyst|smoke/i],
      ["Visibility", /wiper|windscreen|washer|mirror/i],
    ];

    tests.forEach((test) => {
      if (String(test.result).toUpperCase() === "FAILED") failed += 1;
      (test.defects || []).forEach((defect) => {
        const type = String(defect.type || "ADVISORY").toUpperCase();
        if (type === "DANGEROUS") dangerous += 1;
        if (type === "MAJOR") major += 1;
        if (type === "ADVISORY" || type === "MINOR") advisory += 1;
        const text = String(defect.text || "");
        const category = categories.find(([, pattern]) => pattern.test(text))?.[0] || "Other recorded issues";
        buckets.set(category, (buckets.get(category) || 0) + 1);
      });
    });

    const common = [...buckets.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, count]) => ({ label, count }));
    return { dangerous, major, advisory, failed, common };
  }

  function vehicleAge(vehicle) {
    const year = Number.parseInt(vehicle.year, 10);
    return Number.isFinite(year) ? Math.max(new Date().getFullYear() - year, 0) : null;
  }

  function activeStatus(value, badWords) {
    const text = String(value || "").toLowerCase();
    return !badWords.some((word) => text.includes(word));
  }

  function analyse(vehicle) {
    const mileage = mileageAnalysis(vehicle.motHistory);
    const defects = defectStats(vehicle.motHistory);
    const age = vehicleAge(vehicle);
    const motHealthy = activeStatus(vehicle.motStatus, ["expired", "not valid"]);
    const taxHealthy = activeStatus(vehicle.taxStatus, ["untaxed", "expired"]);
    let score = 100;
    const reasons = [];

    if (!motHealthy) { score -= 30; reasons.push("MOT is not currently valid"); }
    if (!taxHealthy && !String(vehicle.taxStatus || "").toLowerCase().includes("sorn")) { score -= 15; reasons.push("Tax status needs attention"); }
    if (mileage.anomalies.length) { score -= Math.min(30, 18 + mileage.anomalies.length * 6); reasons.push("Mileage history contains a backwards reading"); }
    if (defects.dangerous) { score -= Math.min(18, defects.dangerous * 6); reasons.push("Dangerous MOT defects appear in the history"); }
    if (defects.major) score -= Math.min(16, defects.major * 2);
    if (defects.failed) score -= Math.min(16, defects.failed * 4);
    if (defects.advisory > 8) score -= Math.min(10, Math.floor(defects.advisory / 3));
    if (age !== null && age >= 15) score -= 5;
    if (mileage.latest !== null && mileage.latest > 150000) score -= 6;
    score = Math.max(0, Math.min(100, Math.round(score)));

    let verdict = "Strong record";
    let verdictTone = "good";
    if (score < 55) { verdict = "Higher-risk history"; verdictTone = "bad"; }
    else if (score < 75) { verdict = "Worth investigating"; verdictTone = "warning"; }
    else if (score < 90) { verdict = "Generally healthy"; verdictTone = "good"; }

    if (!reasons.length) {
      reasons.push(defects.common[0] ? `Most repeated MOT area: ${defects.common[0].label}` : "No major red flags found in the supplied records");
    }

    const annualMiles = mileage.annual ?? 7000;
    const fuel = String(vehicle.fuelType || "").toLowerCase();
    const engine = Number(vehicle.engineCapacity) || 1600;
    let pencePerMile = fuel.includes("electric") ? 7 : fuel.includes("diesel") ? 14 : 16;
    if (engine > 2200) pencePerMile += 3;
    if (engine > 3200) pencePerMile += 4;
    const ageFactor = age === null ? 550 : 350 + Math.min(age, 20) * 35;
    const low = Math.round((annualMiles * pencePerMile / 100 + ageFactor) / 50) * 50;
    const high = Math.round((low * 1.45) / 50) * 50;

    return { score, verdict, verdictTone, reasons, mileage, defects, age, annualCost: { low, high, annualMiles } };
  }

  function timelineHtml(vehicle) {
    const tests = [...(vehicle.motHistory || [])]
      .sort((a, b) => new Date(b.completedDate) - new Date(a.completedDate))
      .slice(0, 8);
    if (!tests.length) return '<p class="feature-empty">No MOT timeline is available for this registration.</p>';
    return `<div class="mot-timeline">${tests.map((test) => {
      const defects = test.defects || [];
      const result = String(test.result || "UNKNOWN").toUpperCase();
      const date = test.completedDate ? new Date(test.completedDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "Unknown";
      const mileage = test.mileage ? `${Number(String(test.mileage).replace(/[^\d]/g, "")).toLocaleString()} mi` : "Mileage N/A";
      return `<div class="timeline-item is-${result === "PASSED" ? "pass" : "fail"}"><span class="timeline-dot"></span><div><strong>${escapeHtml(result)}</strong><small>${escapeHtml(date)} · ${escapeHtml(mileage)} · ${defects.length} issue${defects.length === 1 ? "" : "s"}</small></div></div>`;
    }).join("")}</div>`;
  }

  function insightHtml(vehicle, analysis) {
    const anomalyHtml = analysis.mileage.anomalies.length
      ? `<div class="feature-alert is-bad"><strong>Mileage anomaly detected</strong><p>${analysis.mileage.anomalies.map((item) => `Reading dropped by ${item.drop.toLocaleString()} miles (${item.from.toLocaleString()} → ${item.to.toLocaleString()}).`).join(" ")}</p></div>`
      : '<div class="feature-alert is-good"><strong>Mileage sequence looks consistent</strong><p>No backwards mileage readings were detected in the supplied MOT history.</p></div>';

    const commonHtml = analysis.defects.common.length
      ? analysis.defects.common.map((item) => `<div class="fault-chip"><strong>${escapeHtml(item.label)}</strong><span>${item.count} recorded</span></div>`).join("")
      : '<p class="feature-empty">No recurring MOT fault category stands out yet.</p>';

    return `
      <section class="biismo-intelligence" aria-label="BIISMO vehicle intelligence">
        <div class="intelligence-top">
          <article class="score-card"><span>BIISMO SCORE</span><strong>${analysis.score}</strong><small>/ 100</small></article>
          <article class="verdict-card is-${analysis.verdictTone}"><span>WOULD I BUY IT?</span><strong>${escapeHtml(analysis.verdict)}</strong><p>${analysis.reasons.map(escapeHtml).join(" · ")}</p></article>
        </div>

        ${anomalyHtml}

        <div class="feature-grid">
          <article class="feature-panel"><span class="feature-kicker">MOT HEALTH TIMELINE</span><h3>Recent history at a glance</h3>${timelineHtml(vehicle)}</article>
          <article class="feature-panel"><span class="feature-kicker">FAULT INTELLIGENCE</span><h3>Repeated areas in this vehicle’s record</h3><div class="fault-grid">${commonHtml}</div><p class="feature-disclaimer">Based only on this registration’s recorded MOT defects and advisories — not generic model rumours.</p></article>
        </div>

        <article class="cost-panel"><div><span class="feature-kicker">OWNERSHIP COST ESTIMATE</span><h3>Rough annual running budget</h3><p>Using ${analysis.annualCost.annualMiles.toLocaleString()} estimated annual miles, fuel type, engine size and age.</p></div><strong>£${analysis.annualCost.low.toLocaleString()}–£${analysis.annualCost.high.toLocaleString()}</strong><small>Fuel/energy + routine maintenance estimate. Excludes insurance, finance and exact VED.</small></article>

        <div class="feature-actions">
          <button id="biismoWatchButton" class="secondary-button" type="button">☆ Watch this vehicle</button>
          <button id="biismoShareButton" class="secondary-button" type="button">↗ Share BIISMO report</button>
        </div>
        <p id="biismoFeatureStatus" class="feature-status" role="status"></p>
      </section>`;
  }

  async function watchVehicle(vehicle, button, status) {
    await window.biismoAuth.ready;
    if (!window.biismoAuth.getUser()) {
      window.biismoAuth.openAuthDialog("signin");
      return;
    }
    const latestMileage = readings(vehicle.motHistory).at(-1)?.mileage ?? null;
    button.disabled = true;
    status.textContent = "Adding to your watchlist…";
    try {
      const response = await window.biismoAuth.authorizedFetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration: vehicle.registration,
          make: vehicle.make,
          model: vehicle.model,
          taxStatus: vehicle.taxStatus,
          taxDueDate: vehicle.taxDueDate,
          motStatus: vehicle.motStatus,
          motExpiryDate: vehicle.motExpiryDate,
          lastMileage: latestMileage,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Watchlist could not be updated.");
      button.textContent = "★ Watching for changes";
      status.textContent = "BIISMO will monitor official MOT/tax changes for this registration.";
    } catch (error) {
      button.disabled = false;
      status.textContent = error.message || "Watchlist could not be updated.";
    }
  }

  async function shareVehicle(vehicle, analysis, button, status) {
    await window.biismoAuth.ready;
    if (!window.biismoAuth.getUser()) {
      window.biismoAuth.openAuthDialog("signin");
      return;
    }
    button.disabled = true;
    status.textContent = "Creating a shareable BIISMO snapshot…";
    try {
      const response = await window.biismoAuth.authorizedFetch("/api/share-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot: { ...vehicle, biismoAnalysis: { score: analysis.score, verdict: analysis.verdict, verdictTone: analysis.verdictTone, annualCost: analysis.annualCost, reasons: analysis.reasons } } }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Report could not be shared.");
      const url = data.url;
      if (navigator.share) {
        await navigator.share({ title: `${vehicle.registration} · BIISMO REG`, text: `${vehicle.make} ${vehicle.model} — BIISMO Score ${analysis.score}/100`, url });
        status.textContent = "Report shared.";
      } else {
        await navigator.clipboard.writeText(url);
        status.textContent = "Share link copied to your clipboard.";
      }
      button.textContent = "Share report ✓";
    } catch (error) {
      if (error?.name === "AbortError") status.textContent = "Share cancelled.";
      else status.textContent = error.message || "Report could not be shared.";
      button.disabled = false;
    }
  }

  function enrichResult() {
    const card = document.querySelector("#result .result-card:not(.error-state)");
    if (!card || !lastVehicle?.registration || enrichedRegistration === lastVehicle.registration) return;
    const analysis = analyse(lastVehicle);
    const detailGrid = card.querySelector(".detail-grid");
    if (!detailGrid) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = insightHtml(lastVehicle, analysis);
    detailGrid.before(wrapper.firstElementChild);
    enrichedRegistration = lastVehicle.registration;

    const status = document.getElementById("biismoFeatureStatus");
    document.getElementById("biismoWatchButton")?.addEventListener("click", (event) => watchVehicle(lastVehicle, event.currentTarget, status));
    document.getElementById("biismoShareButton")?.addEventListener("click", (event) => shareVehicle(lastVehicle, analysis, event.currentTarget, status));
  }

  function extractRegistration(text) {
    const normalized = String(text || "").toUpperCase().replace(/[^A-Z0-9\s]/g, " ");
    const candidates = normalized.match(/[A-Z0-9]{2,4}\s?[A-Z0-9]{2,4}/g) || [];
    const compact = candidates.map((value) => value.replace(/\s/g, "")).filter((value) => value.length >= 5 && value.length <= 8 && /[A-Z]/.test(value) && /\d/.test(value));
    return compact.sort((a, b) => Math.abs(a.length - 7) - Math.abs(b.length - 7))[0] || null;
  }

  async function scanPlate(file, button) {
    const regInput = document.getElementById("regInput");
    const formError = document.getElementById("formError");
    if (!file || !regInput) return;
    button.disabled = true;
    button.textContent = "Reading plate…";
    formError.textContent = "Analysing the number plate image on your device…";
    try {
      if (!window.Tesseract) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
          script.onload = resolve;
          script.onerror = () => reject(new Error("Plate scanner could not load."));
          document.head.appendChild(script);
        });
      }
      const result = await window.Tesseract.recognize(file, "eng", {
        workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
        corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js",
        langPath: "https://tessdata.projectnaptha.com/4.0.0",
      });
      const registration = extractRegistration(result?.data?.text);
      if (!registration) throw new Error("I couldn't confidently read a UK registration from that photo. Try a closer, straighter shot.");
      regInput.value = registration;
      regInput.dispatchEvent(new Event("input", { bubbles: true }));
      formError.textContent = `Plate detected: ${registration}. Check it, then tap Check vehicle.`;
    } catch (error) {
      formError.textContent = error.message || "The number plate could not be read.";
    } finally {
      button.disabled = false;
      button.textContent = "📷 Scan number plate";
    }
  }

  function initScanner() {
    const plate = document.querySelector("#vehicleForm .plate");
    if (!plate || document.getElementById("plateScannerButton")) return;
    const input = document.createElement("input");
    input.id = "plateScannerInput";
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("capture", "environment");
    input.hidden = true;
    const button = document.createElement("button");
    button.id = "plateScannerButton";
    button.type = "button";
    button.className = "plate-scanner-button";
    button.textContent = "📷 Scan number plate";
    plate.after(input);
    input.after(button);
    button.addEventListener("click", () => input.click());
    input.addEventListener("change", () => scanPlate(input.files?.[0], button));
  }

  const observer = new MutationObserver(enrichResult);
  window.addEventListener("DOMContentLoaded", () => {
    initScanner();
    const result = document.getElementById("result");
    if (result) observer.observe(result, { childList: true, subtree: true });
  });

  window.biismoVehicleFeatures = { analyse };
})();