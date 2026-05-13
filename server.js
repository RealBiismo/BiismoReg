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
 * DVLA API
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

/**
 * MOT API (SAFE VERSION)
 */
async function fetchMotHistory(reg) {
  try {
    const response = await fetch(
      `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${reg}`,
      {
        method: 'GET',
        headers: {
          'x-api-key': process.env.MOT_API_KEY,
          'Accept': 'application/json+v6'
        }
      }
    );

    if (!response.ok) {
      return { motTests: [] };
    }

    return await response.json();
  } catch (err) {
    console.log('MOT API error:', err.message);
    return { motTests: [] };
  }
}

/**
 * MAIN API
 */
app.post('/api/check', async (req, res) => {
  try {
    const reg = (req.body.registrationNumber || '')
      .replace(/\s+/g, '')
      .toUpperCase();

    if (!reg) {
      return res.status(400).json({ error: 'Invalid registration' });
    }

    const vehicleData = await fetchVehicle(reg);

    let motData = { motTests: [] };
    try {
      motData = await fetchMotHistory(reg);
    } catch (e) {
      console.log('MOT fallback used');
    }

    res.json({
      registrationNumber: vehicleData.registrationNumber || reg,
      make: vehicleData.make || null,
      model: vehicleData.model || null,
      colour: vehicleData.colour || null,
      fuelType: vehicleData.fuelType || null,
      yearOfManufacture: vehicleData.yearOfManufacture || null,
      engineCapacity: vehicleData.engineCapacity || null,
      co2Emissions: vehicleData.co2Emissions || null,
      euroStatus: vehicleData.euroStatus || null,
      motStatus: vehicleData.motStatus || null,
      taxStatus: vehicleData.taxStatus || null,
      motExpiryDate: vehicleData.motExpiryDate || null,
      taxDueDate: vehicleData.taxDueDate || null,

      isTaxed: vehicleData.taxStatus === 'Taxed',
      hasMot: vehicleData.motStatus === 'Valid',

      motHistory: motData.motTests || []
    });

  } catch (err) {
    console.log('API ERROR:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
