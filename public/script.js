function daysLeft(dateStr) {
  if (!dateStr) return null;
  const now = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

/* =========================
   UNIFIED STATUS (MOT + TAX)
========================= */
function getStatus(dateStr) {
  if (!dateStr) {
    return { date: "N/A", text: "EXPIRED", class: "tax-red" };
  }

  const days = daysLeft(dateStr);
  if (isNaN(days) || days < 0) {
    return {
      date: new Date(dateStr).toLocaleDateString("en-GB"),
      text: "EXPIRED",
      class: "tax-red"
    };
  }

  return {
    date: new Date(dateStr).toLocaleDateString("en-GB"),
    text: `${days} days left`,
    class: "tax-green"
  };
}

/* =========================
   FIRST MOT CHECK
========================= */
function getFirstMotStatus(d) {
  if (!d.monthOfFirstRegistration) return null;

  const firstReg = new Date(d.monthOfFirstRegistration);
  const firstMot = new Date(firstReg);
  firstMot.setFullYear(firstMot.getFullYear() + 3);

  const now = new Date();

  if (now < firstMot) {
    return {
      date: firstMot.toLocaleDateString("en-GB"),
      text: "Not yet due",
      class: "tax-green"
    };
  }

  return null;
}

/* =========================
   TOGGLE MOT
========================= */
function toggleMot() {
  const el = document.getElementById("motContainer");
  const btn = document.getElementById("motBtn");
  const open = el.style.display === "block";
  el.style.display = open ? "none" : "block";
  btn.innerText = open ? "Show MOT History" : "Hide MOT History";
}

/* =========================
   TAX NORMALISER
========================= */
function getTaxDate(d) {
  return d.taxDueDate || d.taxExpiryDate || d.vehicleTax?.expiryDate || null;
}

/* =========================
   MOT DEFECT GROUPS
========================= */
function buildDefects(defects) {
  if (!defects || !defects.length) {
    return `<div class="clean-pass">No advisories or defects</div>`;
  }

  const groups = { DANGEROUS: [], MAJOR: [], MINOR: [], ADVISORY: [] };

  defects.forEach(d => {
    const type = (d.type || "ADVISORY").toUpperCase();
    const text = d.text || d.description || d.comment || "Issue found";
    if (groups[type]) groups[type].push(text);
    else groups.ADVISORY.push(text);
  });

  return Object.entries(groups)
    .map(([type, items]) => {
      if (!items.length) return "";
      return `
        <div class="defect-group ${type.toLowerCase()}">
          <b>${type}</b>
          ${items.map(i => `<div class="defect-item">${i}</div>`).join("")}
        </div>
      `;
    })
    .join("");
}

/* =========================
   MAIN
========================= */
async function checkVehicle() {
  const reg = document.getElementById("regInput").value.trim().toUpperCase().replace(/\s/g, "");
  if (!reg) return alert("Enter registration");

  document.getElementById("result").innerHTML = `
    <div class="result-card glass">Loading...</div>
  `;

  try {
    const res = await fetch("/api/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationNumber: reg })
    });

    const d = await res.json();

    const firstMot = getFirstMotStatus(d);
    const mot = firstMot || getStatus(d.motExpiryDate);
    const tax = getStatus(getTaxDate(d));

    document.getElementById("result").innerHTML = `
      <div class="result-card glass">

        <div class="result-plate">
          <div class="gb">GB</div>
          <div class="result-reg">${d.registration || reg}</div>
        </div>

        <div class="car-title">${d.make || ""} ${d.model || ""}</div>

        <div class="grid">
          <div class="info-box">
            <div class="info-title">MOT</div>
            <div class="info-value">${mot.date}</div>
            <div class="${mot.class}">MOT • ${mot.text}</div>
          </div>

          <div class="info-box">
            <div class="info-title">TAX</div>
            <div class="info-value">${tax.date}</div>
            <div class="${tax.class}">TAX • ${tax.text}</div>
          </div>

          <div class="info-box">
            <div class="info-title">Engine</div>
            <div class="info-value">${d.engineCapacity || "N/A"}cc</div>
          </div>

          <div class="info-box">
            <div class="info-title">Fuel</div>
            <div class="info-value">${d.fuelType || "N/A"}</div>
          </div>
        </div>

        <!-- NEW DETAILS SECTION -->
        <div class="grid">
          <div class="info-box"><div class="info-title">CO₂ Emissions</div><div class="info-value">${d.co2Emissions || "N/A"}</div></div>
          <div class="info-box"><div class="info-title">Euro Status</div><div class="info-value">${d.euroStatus || "N/A"}</div></div>
          <div class="info-box"><div class="info-title">RDE</div><div class="info-value">${d.realDrivingEmissions || "N/A"}</div></div>
          <div class="info-box"><div class="info-title">Type Approval</div><div class="info-value">${d.typeApproval || "N/A"}</div></div>
          <div class="info-box"><div class="info-title">Wheelplan</div><div class="info-value">${d.wheelplan || "N/A"}</div></div>
          <div class="info-box"><div class="info-title">Revenue Weight</div><div class="info-value">${d.revenueWeight || "N/A"}</div></div>
          <div class="info-box"><div class="info-title">First Registered</div><div class="info-value">${d.monthOfFirstRegistration || "N/A"}</div></div>
          <div class="info-box"><div class="info-title">V5C Issued</div><div class="info-value">${d.dateOfLastV5CIssued || "N/A"}</div></div>
          <div class="info-box"><div class="info-title">Export Marker</div><div class="info-value">${d.exportMarker ? "Yes" : "No"}</div></div>
        </div>

        <button id="motBtn" onclick="toggleMot()">Show MOT History</button>

        <div id="motContainer">
          ${
            d.motHistory?.length
              ? d.motHistory.map(m => `
                  <div class="mot-card">
                    <div class="${m.result === "PASSED" ? "pass" : "fail"}">${m.result}</div>
                    <div>${m.completedDate ? new Date(m.completedDate).toLocaleDateString("en-GB") : "Unknown"}</div>
                    <div>${m.mileage || "N/A"}</div>
                    ${buildDefects(m.defects || [])}
                  </div>
                `).join("")
              : `<div class="mot-card">No MOT history found</div>`
          }
        </div>

      </div>
    `;
  } catch (e) {
    document.getElementById("result").innerHTML = `
      <div class="result-card glass">Error: ${e.message}</div>
    `;
  }
}
