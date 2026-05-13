function daysLeft(date){
  if(!date) return null;
  return Math.ceil((new Date(date)-new Date())/86400000);
}

function formatStatus(date){

  if(!date){
    return {text:"EXPIRED",class:"bad",date:"N/A"};
  }

  const d = daysLeft(date);

  if(d < 0){
    return {
      text:"EXPIRED",
      class:"bad",
      date:new Date(date).toLocaleDateString("en-GB")
    };
  }

  return {
    text:`${d} days left`,
    class:"good",
    date:new Date(date).toLocaleDateString("en-GB")
  };
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
      headers:{ "Content-Type":"application/json" },
      body:JSON.stringify({registrationNumber:reg})
    });

  const d = await res.json();

  const mot = formatStatus(d.motExpiryDate);
  const tax = formatStatus(d.taxDueDate);

  document.getElementById("result").innerHTML = `

    <div class="grid">

      <div class="card-box">
        <h3>MOT</h3>
        <p>${mot.date}</p>
        <p class="${mot.class}">${mot.text}</p>
      </div>

      <div class="card-box">
        <h3>TAX</h3>
        <p>${tax.date}</p>
        <p class="${tax.class}">${tax.text}</p>
      </div>

    </div>

    <div class="grid">

      <div class="card-box">
        Engine<br>
        ${d.engineCapacity || "N/A"}cc
      </div>

      <div class="card-box">
        Fuel<br>
        ${d.fuelType || "N/A"}
      </div>

    </div>

  `;
}
