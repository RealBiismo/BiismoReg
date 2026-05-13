
function toggleMot(){
  const el = document.getElementById("mot");
  el.classList.toggle("hidden");
}

function drawChart(history){

  const ctx = document.getElementById("chart");
  if(!ctx || !history.length) return;

  new Chart(ctx,{
    type:"line",
    data:{
      labels: history.map(x =>
        new Date(x.completedDate).toLocaleDateString("en-GB")
      ),
      datasets:[{
        label:"Mileage",
        data: history.map(x => x.mileage),
        borderColor:"#3b82f6"
      }]
    }
  });
}

function riskScore(data){

  let score = 100;

  const fails = data.motHistory.filter(x => x.result !== "PASS").length;

  let advisories = 0;
  data.motHistory.forEach(x=>{
    advisories += (x.defects.advisories?.length || 0);
  });

  score -= fails * 15;
  score -= advisories * 2;

  return Math.max(0, score);
}

function estimateValue(data){

  let base = 12000;

  const age = new Date().getFullYear() - data.yearOfManufacture;
  base -= age * 700;

  const mileage = data.motHistory.at(-1)?.mileage || 60000;
  base -= (mileage / 1000) * 20;

  if(data.engineCapacity > 2000) base += 800;

  return Math.max(500, Math.round(base));
}

async function checkVehicle(){

  const reg = document.getElementById("reg").value.trim();

  const res = await fetch("/api/check",{
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ registrationNumber: reg })
  });

  const d = await res.json();

  const risk = riskScore(d);
  const value = estimateValue(d);

  setTimeout(()=>drawChart(d.motHistory),200);

  document.getElementById("result").innerHTML = `

    <div class="resultCard">

      <div class="plate">
        <div class="gb">GB</div>
        <div class="reg">${reg}</div>
      </div>

      <h2 style="text-align:center;color:#60a5fa;margin-top:10px">
        ${d.make} ${d.model}
      </h2>

      <h3 style="text-align:center">
        Risk: ${risk}/100 | Value: £${value}
      </h3>

      <div class="grid">

        <div class="box">Engine: ${d.engineCapacity}cc</div>
        <div class="box">Fuel: ${d.fuelType}</div>
        <div class="box">MOT: ${d.motExpiryDate}</div>
        <div class="box">Tax: ${d.taxStatus}</div>

      </div>

      <div style="margin-top:20px">
        <canvas id="chart"></canvas>
      </div>

      <button onclick="toggleMot()" style="margin-top:20px">
        Toggle MOT History
      </button>

      <div id="mot" class="hidden" style="margin-top:15px">

        ${d.motHistory.map(x=>`

          <div class="box" style="margin-bottom:8px">
            <b>${new Date(x.completedDate).toLocaleDateString("en-GB")}</b><br>
            ${x.result} - ${x.mileage} miles
          </div>

        `).join("")}

      </div>

    </div>

  `;
}
