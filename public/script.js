function daysLeft(dateStr){

  if(!dateStr) return null;

  const now = new Date();
  const target = new Date(dateStr);

  const diff =
    Math.ceil(
      (target - now) /
      (1000*60*60*24)
    );

  return diff;
}

/* =========================
   MOT STATUS (FIXED)
========================= */

function getMotStatus(dateStr){

  const days = daysLeft(dateStr);

  if(!dateStr || days === null || isNaN(days) || days < 0){

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
   TAX STATUS (FIXED)
========================= */

function getTaxStatus(status){

  const s = (status || "").toLowerCase();

  if(s.includes("taxed")){

    return {
      text: "TAXED",
      class: "tax-green"
    };
  }

  if(s.includes("sorn")){

    return {
      text: "SORN",
      class: "tax-red"
    };
  }

  return {
    text: "UNTAXED",
    class: "tax-red"
  };
}

/* =========================
   TOGGLE MOT
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
      groups[type].push(d.text);
    }else{
      groups.ADVISORY.push(d.text);
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
   MAIN CHECK
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
    alert("Enter reg");
    return;
  }

  document.getElementById("result").innerHTML = `
    <div class="result-card glass">
      Loading vehicle...
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

    /* FIXED STATUS */
    const motStatus =
      getMotStatus(d.motExpiryDate);

    const taxStatus =
      getTaxStatus(d.taxStatus);

    document.getElementById("result").innerHTML = `

      <div class="result-card glass">

        <div class="result-plate">

          <div class="gb">GB</div>

          <div class="result-reg">
            ${d.registration}
          </div>

        </div>

        <div class="car-title">
          ${d.make} ${d.model}
        </div>

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
              ${d.engineCapacity}cc
            </div>
          </div>

          <div class="info-box">
            <div class="info-title">Fuel</div>
            <div class="info-value">
              ${d.fuelType}
            </div>
          </div>

        </div>

        <button
          id="motBtn"
          class="mot-button"
          onclick="toggleMot()"
        >
          Show MOT History
        </button>

        <div id="motContainer">

          ${
            d.motHistory?.length

            ? d.motHistory.map(m => `

              <div class="mot-card">

                <div class="${m.result === "PASSED" ? "pass":"fail"}">
                  ${m.result}
                </div>

                <div>
                  ${new Date(m.completedDate)
                    .toLocaleDateString("en-GB")}
                </div>

                <div>
                  ${m.mileage} ${m.mileageUnit}
                </div>

                ${buildDefects(m.defects)}

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
