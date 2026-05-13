function daysLeft(dateStr){

  if(!dateStr) return null;

  const now = new Date();
  const target = new Date(dateStr);

  const diff =
    Math.ceil(
      (target - now) /
      (1000 * 60 * 60 * 24)
    );

  return diff;
}

/* =========================
   MOT STATUS (ROBUST)
========================= */
function getMotStatus(dateStr){

  if(!dateStr){
    return {
      text: "EXPIRED",
      class: "tax-red"
    };
  }

  const days = daysLeft(dateStr);

  if(isNaN(days) || days === null || days < 0){
    return {
      text: "EXPIRED",
      class: "tax-red"
    };
  }

  return {
    text: `${days} days left`,
    class: "tax-green"
  };
}

/* =========================
   TAX STATUS (DVLA SAFE PARSER)
========================= */
function getTaxStatus(d){

  const today = new Date();

  const taxDate =
    d.taxDueDate
      ? new Date(d.taxDueDate)
      : null;

  /* ✅ PRIMARY RULE: DATE BASED */
  if(taxDate){

    if(taxDate < today){
      return {
        text: "UNTAXED",
        class: "tax-red"
      };
    }

    return {
      text: "TAXED",
      class: "tax-green"
    };
  }

  /* FALLBACK TO STRING (if API doesn't give date) */
  const raw =
    (
      d.taxStatus ||
      d.taxStatusDescription ||
      d.vehicleTax?.status ||
      ""
    ).toLowerCase();

  if(raw.includes("taxed")){
    return { text:"TAXED", class:"tax-green" };
  }

  if(raw.includes("sorn")){
    return { text:"SORN", class:"tax-red" };
  }

  return { text:"UNKNOWN", class:"tax-red" };
}
/* =========================
   MOT TOGGLE
========================= */
function toggleMot(){

  const el =
    document.getElementById("motContainer");

  const btn =
    document.getElementById("motBtn");

  const open =
    el.style.display === "block";

  el.style.display =
    open ? "none" : "block";

  btn.innerText =
    open
      ? "Show MOT History"
      : "Hide MOT History";
}

/* =========================
   DEFECT GROUPING
========================= */
function buildDefects(defects){

  if(!defects || !defects.length){
    return `
      <div class="clean-pass">
        No advisories or defects
      </div>
    `;
  }

  const groups = {
    DANGEROUS: [],
    MAJOR: [],
    MINOR: [],
    ADVISORY: []
  };

  defects.forEach(d => {

    const type =
      (d.type || "ADVISORY").toUpperCase();

    if(groups[type]){
      groups[type].push(d.text || d.description || d.comment || "Issue found");
    }else{
      groups.ADVISORY.push(d.text || d.description || d.comment || "Issue found");
    }

  });

  return Object.entries(groups)
    .map(([type, items]) => {

      if(!items.length) return "";

      return `
        <div class="defect-group ${type.toLowerCase()}">

          <b>${type}</b>

          ${items.map(i => `
            <div class="defect-item">
              ${i}
            </div>
          `).join("")}

        </div>
      `;

    }).join("");
}

/* =========================
   MAIN VEHICLE CHECK
========================= */
async function checkVehicle(){

  const reg =
    document
      .getElementById("regInput")
      .value
      .trim()
      .toUpperCase()
      .replace(/\s/g,"");

  if(!reg){
    alert("Enter registration");
    return;
  }

  document.getElementById("result").innerHTML = `
    <div class="result-card glass">
      Loading vehicle data...
    </div>
  `;

  try{

    const res =
      await fetch("/api/check",{
        method:"POST",
        headers:{
          "Content-Type":"application/json"
        },
        body:JSON.stringify({
          registrationNumber:reg
        })
      });

    const d =
      await res.json();

    if(d.error){
      throw new Error(d.error);
    }

    const motStatus =
      getMotStatus(d.motExpiryDate);

    const taxStatus =
      getTaxStatus(d);

    document.getElementById("result").innerHTML = `

      <div class="result-card glass">

        <!-- PLATE -->
        <div class="result-plate">

          <div class="gb">GB</div>

          <div class="result-reg">
            ${d.registration || reg}
          </div>

        </div>

        <!-- TITLE -->
        <div class="car-title">
          ${d.make || "Unknown"} ${d.model || ""}
        </div>

        <!-- GRID -->
        <div class="grid">

          <div class="info-box">
            <div class="info-title">MOT</div>
            <div class="info-value">
              ${d.motExpiryDate || "N/A"}
            </div>
            <div class="${motStatus.class}">
              ${motStatus.text}
            </div>
          </div>

          <div class="info-box">
            <div class="info-title">Tax Status</div>
            <div class="info-value ${taxStatus.class}">
              ${taxStatus.text}
            </div>
          </div>

          <div class="info-box">
            <div class="info-title">Engine</div>
            <div class="info-value">
              ${d.engineCapacity || "N/A"}cc
            </div>
          </div>

          <div class="info-box">
            <div class="info-title">Fuel</div>
            <div class="info-value">
              ${d.fuelType || "N/A"}
            </div>
          </div>

        </div>

        <!-- MOT BUTTON -->
        <button
          id="motBtn"
          class="mot-button"
          onclick="toggleMot()"
        >
          Show MOT History
        </button>

        <!-- MOT HISTORY -->
        <div id="motContainer">

          ${
            d.motHistory && d.motHistory.length

            ? d.motHistory.map(m => `

              <div class="mot-card">

                <div class="${m.result === "PASSED" ? "pass" : "fail"}">
                  ${m.result || "UNKNOWN"}
                </div>

                <div>
                  ${m.completedDate
                    ? new Date(m.completedDate).toLocaleDateString("en-GB")
                    : "Unknown date"}
                </div>

                <div>
                  ${m.mileage || "N/A"} ${m.mileageUnit || ""}
                </div>

                ${buildDefects(m.defects || [])}

              </div>

            `).join("")

            : `
              <div class="mot-card">
                No MOT history found
              </div>
            `
          }

        </div>

      </div>

    `;

  }catch(e){

    document.getElementById("result").innerHTML = `
      <div class="result-card glass">
        Error: ${e.message}
      </div>
    `;
  }
}
