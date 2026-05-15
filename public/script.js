function daysLeft(dateStr){
  if(!dateStr) return null;
  const now = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

function getStatus(dateStr){
  if(!dateStr){
    return { date:"N/A", text:"EXPIRED", class:"tax-red" };
  }
  const days = daysLeft(dateStr);
  if(isNaN(days) || days < 0){
    return {
      date:new Date(dateStr).toLocaleDateString("en-GB"),
      text:"EXPIRED",
      class:"tax-red"
    };
  }
  return {
    date:new Date(dateStr).toLocaleDateString("en-GB"),
    text:`${days} days left`,
    class:"tax-green"
  };
}

/* FIRST MOT CHECK */
function getFirstMotStatus(d){
  if(!d.monthOfFirstRegistration) return null;

  const firstReg = new Date(d.monthOfFirstRegistration);
  const firstMot = new Date(firstReg);
  firstMot.setFullYear(firstMot.getFullYear() + 3);

  const now = new Date();
  if(now < firstMot){
    return {
      date:firstMot.toLocaleDateString("en-GB"),
      text:"Not yet due",
      class:"tax-green"
    };
  }
  return null;
}

/* TOGGLE MOT */
function toggleMot(){
  const el = document.getElementById("motContainer");
  const btn = document.getElementById("motBtn");
  const open = el.style.display === "block";
  el.style.display = open ? "none" : "block";
  btn.innerText = open ? "Show MOT History" : "Hide MOT History";
}

/* TAX DATE NORMALISER */
function getTaxDate(d){
  return d.taxDueDate || d.taxExpiryDate || d.vehicleTax?.expiryDate || null;
}

/* MILEAGE ANOMALY DETECTION */
function getMileageWarnings(history){
  if(!history || !history.length) return [];
  let warnings = [];
  let last = null;

  history.forEach((m, idx)=>{
    const raw = (m.mileage || "").toString().replace(/[^\d]/g,"");
    const val = parseInt(raw,10);
    if(isNaN(val)) return;

    if(last !== null){
      if(val < last){
        warnings.push(`Mileage decreased between test ${idx} and ${idx+1}. Possible rollback.`);
      }else if(val - last > 60000){
        warnings.push(`Unusually high mileage jump between test ${idx} and ${idx+1}.`);
      }
    }
    last = val;
  });

  return [...new Set(warnings)];
}

/* DEFECT GROUPS */
function buildDefects(defects){
  if(!defects || !defects.length){
    return `<div class="clean-pass">No advisories or defects</div>`;
  }

  const groups = { DANGEROUS:[], MAJOR:[], MINOR:[], ADVISORY:[] };

  defects.forEach(d=>{
    const type = (d.type || "ADVISORY").toUpperCase();
    const text = d.text || d.description || d.comment || "Issue found";
    if(groups[type]) groups[type].push(text);
    else groups.ADVISORY.push(text);
  });

  return Object.entries(groups).map(([type,items])=>{
    if(!items.length) return "";
    return `
      <div class="defect-group ${type.toLowerCase()}">
        <b>${type}</b>
        ${items.map(i=>`<div class="defect-item">${i}</div>`).join("")}
      </div>
    `;
  }).join("");
}

/* MAIN */
async function checkVehicle(){
  const reg = document.getElementById("regInput").value.trim().toUpperCase().replace(/\s/g,"");
  if(!reg) return alert("Enter registration");

  document.getElementById("result").innerHTML = `
    <div class="result-card glass">Loading...</div>
  `;

  try{
    const res = await fetch("/api/check",{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({ registrationNumber:reg })
    });

    const d = await res.json();

    const firstMot = getFirstMotStatus(d);
    const mot = firstMot || getStatus(d.motExpiryDate);
    const tax = getStatus(getTaxDate(d));

    const imageUrl =
      `https://source.unsplash.com/800x400/?car,${encodeURIComponent(d.make || "car")},${encodeURIComponent(d.model || "vehicle")}`;

    // Reverse MOT history so oldest → newest
    const motHistory = [...(d.motHistory || [])].reverse();
    const mileageWarnings = getMileageWarnings(motHistory);

    // Calculate mileage stats
    const mileages = motHistory.map(m => parseInt((m.mileage || "").replace(/[^\d]/g,"")));
    const lastMileage = mileages[mileages.length - 1] || null;
    const firstMileage = mileages[0] || null;
    const yearsBetween = motHistory.length > 1
      ? (new Date(motHistory[motHistory.length - 1].completedDate) - new Date(motHistory[0].completedDate)) / (1000*60*60*24*365)
      : 1;
    const avgMileage = lastMileage && firstMileage ? Math.round((lastMileage - firstMileage) / yearsBetween) : null;

    document.getElementById("result").innerHTML = `
      <div class="result-card glass">

        <img src="${imageUrl}" alt="${d.make || ""} ${d.model || ""}" class="car-image" onerror="this.style.display='none';" />

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

          <div class="info-box">
            <div class="info-title">Avg Annual Mileage</div>
            <div class="info-value">${avgMileage || "N/A"} mi</div>
          </div>

          <div class="info-box">
            <div class="info-title">Last Known Mileage</div>
            <div class="info-value">${lastMileage || "N/A"} mi</div>
          </div>
        </div>

        <div class="scroll-hint">← Swipe for more →</div>

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

        <div class="scroll-hint">← Swipe for more →</div>

        ${
          mileageWarnings.length
            ? `<div class="mileage-warning">⚠️ ${mileageWarnings.join("<br>")}</div>`
            : ""
        }

        <div class="actions-row">
          <button id="motBtn" onclick="toggleMot()">Show MOT History</button>
          <button class="print-only" onclick="window.print()">Print Report</button>
        </div>

        <div id="motContainer">
          ${
            motHistory.length
              ? motHistory.map(m=>`
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

  }catch(e){
    document.getElementById("result").innerHTML = `
      <div class="result-card glass">Error: ${e.message}</div>
    `;
  }
}
