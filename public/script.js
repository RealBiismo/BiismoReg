function daysLeft(dateStr){

  if(!dateStr) return "N/A";

  const now = new Date();

  const target = new Date(dateStr);

  const diff =
    Math.ceil(
      (target - now) /
      (1000 * 60 * 60 * 24)
    );

  return diff;
}

function toggleMot(){

  const el =
    document.getElementById("motContainer");

  if(!el) return;

  el.style.display =
    el.style.display === "block"
      ? "none"
      : "block";
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

    const d = await res.json();

    console.log(d);

    if(d.error){
      throw new Error(d.error);
    }

    const motDays =
      daysLeft(d.motExpiryDate);

    const taxDays =
      daysLeft(d.taxDueDate);

    document.getElementById("result").innerHTML = `

      <div class="result-card glass">

        <!-- RESULT PLATE -->
        <div class="result-plate">

          <div class="gb">
            GB
          </div>

          <div class="result-reg">
            ${d.registration}
          </div>

        </div>

        <h2 style="
          text-align:center;
          margin-top:18px;
          font-size:32px;
        ">
          ${d.make} ${d.model}
        </h2>

        <!-- INFO GRID -->
        <div class="grid">

          <div class="info-box">

            <div class="info-title">
              MOT Status
            </div>

            <div class="info-value">
              ${d.motExpiryDate || "N/A"}
            </div>

            <div>
              ${motDays} days left
            </div>

          </div>

          <div class="info-box">

            <div class="info-title">
              Tax Status
            </div>

            <div class="info-value">
              ${d.taxStatus}
            </div>

            <div>
              ${taxDays} days left
            </div>

          </div>

          <div class="info-box">

            <div class="info-title">
              Engine
            </div>

            <div class="info-value">
              ${d.engineCapacity}cc
            </div>

          </div>

          <div class="info-box">

            <div class="info-title">
              Fuel
            </div>

            <div class="info-value">
              ${d.fuelType}
            </div>

          </div>

          <div class="info-box">

            <div class="info-title">
              Colour
            </div>

            <div class="info-value">
              ${d.colour}
            </div>

          </div>

          <div class="info-box">

            <div class="info-title">
              Year
            </div>

            <div class="info-value">
              ${d.year}
            </div>

          </div>

        </div>

        <!-- MOT BUTTON -->
        <button
          class="mot-btn"
          onclick="toggleMot()"
        >
          Show MOT History
        </button>

        <!-- MOT HISTORY -->
        <div id="motContainer">

          ${
            d.motHistory.length

            ? d.motHistory.map(test => `

              <div class="mot-item">

                <h3>
                  ${new Date(
                    test.completedDate
                  ).toLocaleDateString("en-GB")}
                </h3>

                <p>
                  <b>${test.result}</b>
                </p>

                <p>
                  Mileage:
                  ${test.mileage}
                  ${test.mileageUnit}
                </p>

                <p>
                  Station:
                  ${test.station}
                </p>

                ${
                  test.defects.length

                  ? test.defects.map(defect => `

                    <div class="defect
                      ${
                        defect.type === "DANGEROUS"
                          ? "dangerous"
                          : defect.type === "MAJOR"
                          ? "major"
                          : "advisory"
                      }
                    ">

                      ${defect.type}:
                      ${defect.text}

                    </div>

                  `).join("")

                  : `
                    <div class="defect">
                      No advisories
                    </div>
                  `
                }

              </div>

            `).join("")

            : `
              <div class="mot-item">
                No MOT history found
              </div>
            `
          }

        </div>

      </div>

    `;

  }catch(err){

    console.log(err);

    document.getElementById("result").innerHTML = `
      <div class="result-card glass">
        Error: ${err.message}
      </div>
    `;
  }
}
