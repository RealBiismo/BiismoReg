
function toggleMot() {
  const el = document.getElementById("mot");
  if (!el) return;

  if (el.style.display === "none") {
    el.style.display = "block";
  } else {
    el.style.display = "none";
  }
}

async function checkVehicle() {

  const reg = document.getElementById("reg").value.trim();

  const res = await fetch("/api/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registrationNumber: reg })
  });

  const d = await res.json();

  const mot = d.motHistory || [];

  document.getElementById("result").innerHTML = `

    <div class="resultBox">

      <h2>${d.make} ${d.model}</h2>

      <p>Engine: ${d.engineCapacity}cc</p>
      <p>Fuel: ${d.fuelType}</p>
      <p>MOT Expiry: ${d.motExpiryDate}</p>

      <button onclick="toggleMot()">
        Show MOT History
      </button>

      <div id="mot">

        ${
          mot.length
            ? mot.map(m => `
              <div class="box">
                <b>${m.completedDate}</b><br>
                ${m.result} - ${m.mileage} miles
              </div>
            `).join("")
            : `<p>No MOT history found</p>`
        }

      </div>

    </div>

  `;

  // IMPORTANT: ensure hidden state resets every render
  document.getElementById("mot").style.display = "none";
}
