function daysLeft(date) {
  if (!date) return null;
  return Math.ceil((new Date(date) - new Date()) / (1000*60*60*24));
}

function toggleMot() {
  const el = document.getElementById("mot");
  if (!el) return;
  el.style.display = el.style.display === "none" ? "block" : "none";
}

async function check() {

  const reg = document.getElementById("reg").value.trim();

  const res = await fetch("/api/check", {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify({ registrationNumber: reg })
  });

  const d = await res.json();

  const mot = d.motHistory || [];

  const motDays = daysLeft(d.motExpiryDate);
  const taxDays = daysLeft(d.taxDueDate);

  document.getElementById("result").innerHTML = `

  <div class="card">

    <!-- UK PLATE -->
    <div class="result-plate">
      <div class="gb">GB</div>
      <div class="reg">${reg}</div>
    </div>

    <h2 style="text-align:center;margin-top:10px">
      ${d.make} ${d.model}
    </h2>

    <div class="grid">

      <div class="box">
        MOT: ${d.motExpiryDate || "N/A"}<br>
        ${motDays ? motDays + " days left" : ""}
      </div>

      <div class="box">
        TAX: ${d.taxStatus}<br>
        ${taxDays ? taxDays + " days left" : ""}
      </div>

      <div class="box">
        Engine: ${d.engineCapacity}cc
      </div>

      <div class="box">
        Fuel: ${d.fuelType}
      </div>

    </div>

    <button onclick="toggleMot()" style="
      margin-top:15px;
      padding:10px;
      width:100%;
      background:#3b82f6;
      color:white;
      border:none;
      border-radius:10px;
      font-weight:bold;
    ">
      Toggle MOT History
    </button>

    <div id="mot" style="display:none;margin-top:15px">

      ${mot.map(m => `

        <div class="box" style="margin-bottom:8px">
          <b>${m.date}</b><br>
          ${m.result} - ${m.mileage} miles<br>
          Station: ${m.station || "Unknown"}

          ${m.defects.map(d => `
            <div style="color:#fbbf24;font-size:12px">
              • ${d.text}
            </div>
          `).join("")}

        </div>

      `).join("")}

    </div>

  </div>

  `;
}
