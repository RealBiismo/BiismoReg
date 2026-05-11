import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// middleware
app.use(cors());
app.use(express.json());

// serve frontend
app.use(express.static(path.join(__dirname, 'public')));

/**
 * DVLA API helper
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
 * API route
 */
app.post('/api/check', async (req, res) => {
  try {
    const reg = (req.body.registrationNumber || '')
      .replace(/\s+/g, '')
      .toUpperCase();

    if (!reg) {
      return res.status(400).json({ error: 'Invalid registration' });
    }

    const data = await fetchVehicle(reg);

    res.json({
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
      isTaxed: data.taxStatus === 'Taxed',
      hasMot: data.motStatus === 'Valid'
    });

  } catch (err) {
    console.log('API ERROR:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * fallback homepage (fixes "Cannot GET /")
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * IMPORTANT for Render
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
