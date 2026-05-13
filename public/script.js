let chart = null;

function daysLeft(date){
  if(!date) return null;
  return Math.ceil((new Date(date)-new Date())/86400000);
}

function status(date){

  if(!date){
    return {date:"N/A",text:"EXPIRED",class:"tax-red"};
  }

  const d = daysLeft(date);

  if(d < 0){
    return {
      date:new Date(date).toLocaleDateString("en-GB"),
      text:"EXPIRED",
      class:"tax-red"
    };
  }

  return {
    date:new Date(date).toLocaleDateString("en-GB"),
    text:`${d} days left`,
    class:"tax-green"
  };
}

/* =========================
   GRAPH
========================= */
function renderGraph(data){

  const el =
    document.getElementById("motChart");

  if(!el || !data?.length) return;

  const sorted =
    [...data].sort((a,b)=>
      new Date(a.completedDate)-new Date(b.completedDate)
    );

  const labels =
    sorted.map(x =>
      new Date(x.completedDate).toLocaleDateString("en-GB")
    );

  const mileage =
    sorted.map(x => x.odometerValue || 0);

  if(chart) chart.destroy();

  chart = new Chart(el,{
    type:"line",
    data:{
      labels,
      datasets:[{
        label:"Mileage",
        data:mileage,
        borderColor:"#60a5fa",
        tension:0.3
      }]
    }
  });
}

/* =========================
   MAIN
========================= */
async function checkVehicle(){

  const reg =
    document.getElementById("regInput")
    .value
    .toUpperCase()
    .replace(/\s/g,"");

  const res =
    await fetch("/api/check",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({registrationNumber:reg})
    });

  const d = await res.json();

  const mot = status(d.motExpiryDate);
  const tax = status(d.taxDueDate);

  document.getElementById("result").innerHTML = `

    <div class="grid">

      <div class="info-box">
        MOT<br>${mot.date}<br>
        <span class="${mot.class}">${mot.text}</span>
      </div>

      <div class="info-box">
        TAX<br>${tax.date}<br>
        <span class="${tax.class}">${tax.text}</span>
      </div>

    </div>

    <div class="chart-wrap">
      <canvas id="motChart"></canvas>
    </div>

  `;

  setTimeout(()=>{
    renderGraph(d.motHistory);
  },100);
}
