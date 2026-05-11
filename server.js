import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Helper: safe DVLA fetch wrapper
 */
async function fetchVehicle(reg) {
  const response = await fetch(
    'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles',
    {
      method: 'POST',
      headers: {
        'x-api-key': process.env.DVLA_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        registrationNumber: reg
      })
    }
  );

  if (!response.ok) {
    throw new Error('DVLA API error');
  }

  return await response.json();
}

app.post('/api/check', async (req, res) => {

  try {

    const reg = (req.body.registrationNumber || '')
      .replace(/\s+/g, '')
      .toUpperCase();

    if (!reg) {
      return res.status(400).json({ error: 'Invalid registration' });
    }

    const data = await fetchVehicle(reg);

    /**
     * NORMALISED RESPONSE (this is what your frontend should use)
     */
    const result = {
      registrationNumber: data.registrationNumber || reg,

      make: data.make || null,
      model: data.model || null,
      colour: data.colour || null,
      fuelType: data.fuelType || null,
      yearOfManufacture: data.yearOfManufacture || null,

      engineCapacity: data.engineCapacity || null,
      co2Emissions: data.co2Emissions || null,
      euroStatus: data.euroStatus || null,

      motStatus: data.motStatus || null,
      taxStatus: data.taxStatus || null,

      motExpiryDate: data.motExpiryDate || null,
      taxDueDate: data.taxDueDate || null,

      // computed helpers (clean for UI)
      isTaxed: data.taxStatus === 'Taxed',
      hasMot: data.motStatus === 'Valid'
    };

    res.json(result);

  } catch (err) {
    console.log('API ERROR:', err.message);

    res.status(500).json({
      error: 'Server error'
    });
  }

});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
console.log("STATIC PATH:", path.join(__dirname, 'public'));