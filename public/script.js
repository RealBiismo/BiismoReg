function daysLeft(dateStr){

  if(!dateStr) return 0;

  const now = new Date();
  const target = new Date(dateStr);

  const diff =
    Math.ceil(
      (target - now) /
      (1000*60*60*24)
    );

  return diff < 0 ? 0 : diff;
}

/* TOGGLE MOT */
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

/* TAX FIX (NO DUPLICATES + COLOR) */
function getTaxDisplay(d){

  const status =
    (d.taxStatus || "").toLowerCase();

  if(status.includes("taxed")){

    return `
      <div class="info-value tax-green">
        TAXED
      </div>
    `;
  }

  if(status.includes("sorn")){

    return `
      <div class="info-value tax-red">
        SORN
      </div>
    `;
  }

  return `
    <div class="info-value tax-red">
      UNTAXED
    </div>
  `;
}

/* GROUP DEFECTS */
function buildDefects(defects){

  if(!defects.length){

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

/* MAIN */
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
      Loading...
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

    const motDays =
      daysLeft(d.motExpiryDate);

    const taxDays =
      daysLeft(d.taxDueDate);

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
            <div>${motDays} days</div>
          </div>

          <div class="info-box">
            <div class="info-title">Tax Status</div>
            ${getTaxDisplay(d)}
            <div>${taxDays} days</div>
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
            d.motHistory.map(m => `

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
