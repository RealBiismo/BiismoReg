import express from "express";

const app = express();
app.use(express.json());
app.use(express.static("public"));

/* -------------------------
   ENV VARIABLES (RENDER)
--------------------------*/
const DVLA_KEY = process.env.DVLA_API_KEY;
const MOT_CLIENT = process.env.MOT_CLIENT_ID;
const MOT_SECRET = process.env.MOT_CLIENT_SECRET;

/* -------------------------
   GET MOT TOKEN (cached idea)
--------------------------*/
let motTokenCache = null;
let motTokenTime = 0;

async function getMotToken() {

  const now = Date.now();

  if (motTokenCache && now - motTokenTime < 3500000) {
    return motTokenCache;
  }

  const res = await fetch("https://login.microsoftonline.com/common/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: MOT_CLIENT,
      client_secret: MOT_SECRET,
      scope: "mot-history-api"
    })
  });

  const data = await res.json();

  motTokenCache = data.access_token;
  motTokenTime = Date.now();

  return motTokenCache;
}

/* -------------------------
   DVLA API CALL
--------------------------*/
async function getDvlaData(reg) {

  const res = await fetch("https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles", {
    method: "POST",
    headers: {
      "x-api-key": DVLA_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      registrationNumber: reg
    })
  });

  return await res.json();
}

/* -------------------------
   MOT API CALL
--------------------------*/
async function getMotData(reg) {

  const token = await getMotToken();

  const res = await fetch(`https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${reg}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json"
    }
  });

  return await res.json();
}

/* -------------------------
   MAP MOT DATA (IMPORTANT)
--------------------------*/
function mapMot(history = []) {

  return (history.motTests || []).map(t => ({
    completedDate: t.completedDate,
    result: t.testResult,
    mileage: t.odometerValue || 0,

    defects: {
      advisories: (t.rfrAndComments || []).filter(x =>
        (x.type || "").toLowerCase().includes("advis")
      ),
      major: (t.rfrAndComments || []).filter(x =>
        (x.type || "").toLowerCase().includes("major")
      ),
      minor: (t.rfrAndComments || []).filter(x =>
        (x.type || "").toLowerCase().includes("minor")
      )
    }
  }));
}

/* -------------------------
   MAIN ROUTE
--------------------------*/
app.post("/api/check", async (req, res) => {

  try {

    const { registrationNumber } = req.body;

    /* ---------------- DVLA ---------------- */
    const dvla = await getDvlaData(registrationNumber);

    /* ---------------- MOT ---------------- */
    const motRaw = await getMotData(registrationNumber);

    const motHistory = mapMot(motRaw);

    /* ---------------- RESPONSE ---------------- */
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
