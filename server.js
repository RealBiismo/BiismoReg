import express from "express";

const app = express();

app.use(express.json());
app.use(express.static("public"));

/* =========================
   ENV (Render)
========================= */
const DVLA_KEY = process.env.DVLA_API_KEY;
const MOT_CLIENT = process.env.MOT_CLIENT_ID;
const MOT_SECRET = process.env.MOT_CLIENT_SECRET;

/* =========================
   MOT TOKEN (cached)
========================= */
let cachedToken = null;
let tokenTime = 0;

async function getMotToken() {

  const now = Date.now();

  if (cachedToken && now - tokenTime < 3500000) {
    return cachedToken;
  }

  const res = await fetch(
    "https://login.microsoftonline.com/common/oauth2/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: MOT_CLIENT,
        client_secret: MOT_SECRET,
        scope: "https://auth.mot.api.gov.uk/.default"
      })
    }
  );

  const data = await res.json();

  if (!data.access_token) {
    throw new Error("MOT token failed: " + JSON.stringify(data));
  }

  cachedToken = data.access_token;
  tokenTime = now;

  return cachedToken;
}

/* =========================
   DVLA API
========================= */
async function getDvla(reg) {

  const res = await fetch(
    "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles",
    {
      method: "POST",
      headers: {
        "x-api-key": DVLA_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        registrationNumber: reg
      })
    }
  );

  return await res.json();
}

/* =========================
   MOT API
========================= */
async function getMot(reg) {

  const token = await getMotToken();

  const res = await fetch(
    `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${reg}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    }
  );

  return await res.json();
}

/* =========================
   MAP MOT
========================= */
function mapMot(raw = {}) {

  return (raw.motTests || []).map(t => ({
    date: t.completedDate,
    result: t.testResult,
    mileage: t.odometerValue || 0,

    station: t.testStationName || "Unknown",

    defects: (t.rfrAndComments || []).map(x => ({
      text: x.text,
      type: x.type || "ADVISORY"
    }))
  }));
}

/* =========================
   API ROUTE
========================= */
app.post("/api/check", async (req, res) => {

  try {

    const reg = req.body.registrationNumber;

    const dvla = await getDvla(reg);
    const motRaw = await getMot(reg);

    const motHistory = mapMot(motRaw);

    res.json({

      make: dvla.make,
      model: dvla.model,
      yearOfManufacture: dvla.yearOfManufacture,
      engineCapacity: dvla.engineCapacity,
      fuelType: dvla.fuelType,
      colour: dvla.colour,

      taxStatus: dvla.taxStatus,
      taxDueDate: dvla.taxDueDate,
      motExpiryDate: dvla.motExpiryDate,

      motHistory

    });

  } catch (err) {
    console.log(err);
    res.json({ error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
