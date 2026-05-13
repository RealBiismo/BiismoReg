function daysLeft(dateStr){

  if(!dateStr) return null;

  return Math.ceil(
    (new Date(dateStr) - new Date()) /
    (1000*60*60*24)
  );
}

function status(dateStr){

  if(!dateStr){
    return {date:"N/A",text:"EXPIRED",class:"tax-red"};
  }

  const days = daysLeft(dateStr);

  if(days < 0){
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

let chartInstance = null;

function renderGraph(history){

  const ctx =
    document.getElementById("motChart");

  if(!ctx || !history?.length) return;

  const sorted =
    [...history].sort((a,b)=>
      new Date(a.completedDate)-new Date(b.completedDate)
    );

  const labels =
    sorted.map(x =>
      new Date(x.completedDate).toLocaleDateString("en-GB")
    );

  const data =
    sorted.map(x => x.odometerValue || 0);

  if(chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx,{
    type:"line",
    data:{
      labels,
      datasets:[{
        label:"Mileage",
        data,
        borderColor:"#60a5fa",
        tension:0.3
      }]
    }
  });
}

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

    <div class="result-plate">${reg}</div>

    <div class="grid">

      <div class="info-box">
        MOT<br>${mot.date}<br>
        <span class="${mot.class}">
          ${mot.text}
        </span>
      </div>

      <div class="info-box">
        TAX<br>${tax.date}<br>
        <span class="${tax.class}">
          ${tax.text}
        </span>
      </div>

    </div>

    <canvas id="motChart"></canvas>

  `;

  setTimeout(()=>{
    renderGraph(d.motHistory);
  },100);
}
