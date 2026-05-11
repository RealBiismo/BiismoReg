const form = document.getElementById('lookupForm');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const loader = document.getElementById('loader');
  const error = document.getElementById('error');
  const results = document.getElementById('results');

  loader.style.display = 'block';
  error.style.display = 'none';
  results.style.display = 'none';

  const reg = document.getElementById('regInput').value.replace(/\s+/g,'').toUpperCase();

  try {

    const res = await fetch('/api/check', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ registrationNumber: reg })
    });

    const data = await res.json();

    loader.style.display = 'none';

    if(!data || data.error){
      error.style.display = 'block';
      return;
    }

    results.style.display = 'block';

    // BASIC INFO
    document.getElementById('registration').textContent = data.registrationNumber || 'N/A';
    document.getElementById('make').textContent = data.make || 'N/A';
    document.getElementById('model').textContent = data.model || 'N/A';
    document.getElementById('fuel').textContent = data.fuelType || 'N/A';
    document.getElementById('year').textContent = data.yearOfManufacture || 'N/A';
    document.getElementById('engine').textContent = data.engineCapacity || 'N/A';
    document.getElementById('co2').textContent = data.co2Emissions || 'N/A';
    document.getElementById('colour').textContent = data.colour || 'N/A';
    document.getElementById('euro').textContent = data.euroStatus || 'N/A';

    // STATUS
    const motValid = data.motStatus === 'Valid';
    const taxed = data.taxStatus === 'Taxed';

    document.getElementById('motBox').className = 'status ' + (motValid ? 'green' : 'red');
    document.getElementById('taxBox').className = 'status ' + (taxed ? 'green' : 'red');

    document.getElementById('motText').textContent = motValid ? 'Valid MOT' : 'No MOT';

    document.getElementById('taxText').textContent = taxed ? 'Taxed' : 'Untaxed';

    // EXPIRY (ONLY IF EXISTS)
    const motExp = data.motExpiryDate;
    const taxExp = data.taxDueDate;

    if(motExp){
      const d = Math.ceil((new Date(motExp) - new Date()) / 86400000);
      document.getElementById('motExpiry').textContent =
        `Expires: ${motExp} (${d} days)`;
    } else {
      document.getElementById('motExpiry').textContent = '';
    }

    if(taxExp){
      const d = Math.ceil((new Date(taxExp) - new Date()) / 86400000);
      document.getElementById('taxExpiry').textContent =
        `Expires: ${taxExp} (${d} days)`;
    } else {
      document.getElementById('taxExpiry').textContent = '';
    }

  } catch(err){
    loader.style.display = 'none';
    error.style.display = 'block';
  }

});