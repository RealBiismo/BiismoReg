function daysLeft(dateStr){

  if(!dateStr) return "N/A";

  const now = new Date();

  const target = new Date(dateStr);

  return Math.ceil(
    (target - now) /
    (1000 * 60 * 60 * 24)
  );
}

function toggleMot(){

  const el =
    document.getElementById("motContainer");

  const btn =
    document.getElementById("motBtn");

  if(!el) return;

  const showing =
    el.style.display === "block";

  el.style.display =
    showing ? "none" : "block";

  btn.innerText =
    showing
      ? "Show MOT History"
      : "Hide MOT History";
}

function buildGroupedDefects(defects){

  if(!defects || !defects.length){

    return `
      <div class="clean-pass">
        No advisories or defects
      </div>
    `;
  }

  const grouped = {
    DANGEROUS: [],
    MAJOR: [],
    MINOR: [],
    ADVISORY: []
  };

  defects.forEach(defect => {

    const type =
      defect.type?.toUpperCase() ||
      "ADVISORY";

    if(grouped[type]){
      grouped[type].push(defect.text);
    }else{
      grouped.ADVISORY.push(defect.text);
    }

  });

  let html = "";

  Object.entries(grouped).forEach(([type, items]) => {

    if(!items.length) return;

    const className =
      type === "DANGEROUS"
        ? "dangerous"
        : type === "MAJOR"
        ? "major"
        : type === "MINOR"
        ? "minor"
        : "advisory";

    html += `

      <div class="defect-group ${className}">

        <div class="defect-title">
          ${type}
        </div>

        ${items.map(item => `

          <div class="defect-item">
            ${item}
          </div>

        `).join("")}

      </div>

    `;

  });

  return html;
}

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

      <div class="loading-wrap">

        <div class="loader"></div>

        <p>
          Checking vehicle...
        </p>

      </div>

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

    const motDays =
      daysLeft(d.motExpiryDate);

    const taxDays =
      daysLeft(d.taxDueDate);

    document.getElementById("result").innerHTML = `

      <div class="result-card glass">

        <!-- RESULT REG -->

        <div class="result-plate">

          <div class="gb">
            GB
          </div>

          <div class="result-reg">
            ${d.registration}
          </div>

        </div>

        <!-- TITLE -->

        <div class="car-title">
          ${d.make} ${d.model}
        </div>

        <!-- INFO -->

        <div class="grid">

          <div class="info-box glass-inner">

            <div class="info-title">
              MOT Expiry
            </div>

            <div class="info-value">
              ${d.motExpiryDate || "N/A"}
            </div>

            <div class="info-sub">
              ${motDays} days left
            </div>

          </div>

          <div class="info-box glass-inner">

            <div class="info-title">
              Tax Status
            </div>

            <div class="info-value">
              ${d.taxStatus}
            </div>

            <div class="info-sub">
              ${taxDays} days left
            </div>

          </div>

          <div class="info-box glass-inner">

            <div class="info-title">
              Engine Size
            </div>

            <div class="info-value">
              ${d.engineCapacity}cc
            </div>

          </div>

          <div class="info-box glass-inner">

            <div class="info-title">
              Fuel Type
            </div>

            <div class="info-value">
              ${d.fuelType}
            </div>

          </div>

          <div class="info-box glass-inner">

            <div class="info-title">
              Colour
            </div>

            <div class="info-value">
              ${d.colour}
            </div>

          </div>

          <div class="info-box glass-inner">

            <div class="info-title">
              Year
            </div>

            <div class="info-value">
              ${d.year}
            </div>

          </div>

        </div>

        <!-- BUTTON -->

        <button
          id="motBtn"
          class="mot-button"
          onclick="toggleMot()"
        >
          Show MOT History
        </button>

        <!-- MOT -->

        <div id="motContainer">

          ${
            d.motHistory.length

            ? d.motHistory.map(test => `

              <div class="mot-card glass-inner">

                <div class="mot-top">

                  <div>

                    <div class="mot-date">

                      ${new Date(
                        test.completedDate
                      ).toLocaleDateString("en-GB")}

                    </div>

                    <div class="mileage">

                      ${test.mileage}
                      ${test.mileageUnit}

                    </div>

                  </div>

                  <div class="
                    ${
                      test.result === "PASSED"
                        ? "pass"
                        : "fail"
                    }
                    result-pill
                  ">

                    ${test.result}

                  </div>

                </div>

                <div class="defects-wrap">

                  ${buildGroupedDefects(
                    test.defects
                  )}

                </div>

              </div>

            `).join("")

            : `

              <div class="mot-card glass-inner">

                No MOT history found

              </div>

            `
          }

        </div>

      </div>

    `;

  }catch(err){

    document.getElementById("result").innerHTML = `

      <div class="result-card glass">

        Error: ${err.message}

      </div>

    `;
  }
}
