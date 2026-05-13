import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * MIDDLEWARE
 */
app.use(cors());
app.use(express.json());

/**
 * SERVE FRONTEND
 */
app.use(express.static(path.join(__dirname, 'public')));

/**
 * DVLA VEHICLE API
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
 * DVSA MOT HISTORY API
 */
async function fetchMotHistory(reg) {

  try {

    /**
     * STEP 1 - GET OAuth TOKEN
     */
    const tokenResponse = await fetch(
      'https://login.microsoftonline.com/a455b827-244f-4c97-b5b4-ce5d13b4d00c/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: process.env.MOT_CLIENT_ID,
          client_secret: process.env.MOT_CLIENT_SECRET,
          scope: 'https://tapi.dvsa.gov.uk/.default',
          grant_type: 'client_credentials'
        })
      }
    );

    const tokenData = await tokenResponse.json();

    console.log('TOKEN RESPONSE:', tokenData);

    if (!tokenData.access_token) {
      console.log('Failed to get MOT token');
      return { motTests: [] };
    }

    /**
     * STEP 2 - CALL MOT API
     */
    const response = await fetch(
      `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${reg}`,
      {
        method: 'GET',
        headers: {
          'x-api-key': process.env.MOT_API_KEY,
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json+v6'
        }
      }
    );

    if (!response.ok) {
      console.log('MOT API STATUS:', response.status);

      const errorText = await response.text();
      console.log('MOT API ERROR:', errorText);

      return { motTests: [] };
    }

    const motData = await response.json();

    return motData;

  } catch (err) {

    console.log('MOT FETCH ERROR:', err.message);

    return { motTests: [] };
  }
}

/**
 * MAIN API ROUTE
 */
app.post('/api/check', async (req, res) => {

  try {

    const reg = (req.body.registrationNumber || '')
      .replace(/\s+/g, '')
      .toUpperCase();

    if (!reg) {
      return res.status(400).json({
        error: 'Invalid registration'
      });
    }

    /**
     * FETCH DVLA
     */
    const vehicleData = await fetchVehicle(reg);

    /**
     * FETCH MOT
     */
    let motData = { motTests: [] };

    try {
      motData = await fetchMotHistory(reg);
    } catch (e) {
      console.log('Using empty MOT fallback');
    }

    /**
     * RESPONSE
     */
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

      /**
       * MOT HISTORY
       */
      motHistory: motData.motTests || []
    });

  } catch (err) {

    console.log('SERVER ERROR:', err.message);

    res.status(500).json({
      error: 'Server error'
    });
  }
});

/**
 * HOMEPAGE
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * PORT
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
