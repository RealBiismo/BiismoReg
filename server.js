import express from "express";

const app = express();

app.use(express.json());
app.use(express.static("public"));

/* =========================
   ENV
========================= */

const DVLA_API_KEY = process.env.DVLA_API_KEY;
const MOT_CLIENT_ID = process.env.MOT_CLIENT_ID;
const MOT_CLIENT_SECRET = process.env.MOT_CLIENT_SECRET;

/* =========================
   MOT TOKEN CACHE
========================= */

let cachedToken = null;
let tokenExpiry = 0;

async function getMotToken() {

  const now = Date.now();

  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  const tokenRes = await fetch(
    "https://login.microsoftonline.com/common/oauth2/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: MOT_CLIENT_ID,
        client_secret: MOT_CLIENT_SECRET,
        scope: "https://auth.mot.api.gov.uk/.default"
      })
    }
  );

  const tokenData = await tokenRes.json();

  console.log("TOKEN:", tokenData);

  if (!tokenData.access_token) {
    throw new Error(
      "Failed to get MOT token: " +
      JSON.stringify(tokenData)
    );
  }

  cachedToken = tokenData.access_token;

  tokenExpiry =
    Date.now() + ((tokenData.expires_in || 3600) * 1000);

  return cachedToken;
}

/* =========================
   API ROUTE
========================= */

app.post("/api/check", async (req, res) => {

  try {

    const reg = req.body.registrationNumber
      .toUpperCase()
      .replace(/\s/g, "");

    /* =========================
       DVLA
    ========================= */

    const dvlaRes = await fetch(
      "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles",
      {
        method: "POST",
        headers: {
          "x-api-key": DVLA_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          registrationNumber: reg
        })
      }
    );

    const dvla = await dvlaRes.json();

    console.log("DVLA:", dvla);

    /* =========================
       MOT
    ========================= */

    const token = await getMotToken();

    const motRes = await fetch(
      `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${reg}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      }
    );

    const motRaw = await motRes.json();

    console.log("MOT:", motRaw);

    /* =========================
       MOT RETURNS ARRAY
    ========================= */

    const vehicle = Array.isArray(motRaw)
      ? motRaw[0]
      : motRaw;

    /* =========================
       MAP MOT TESTS
    ========================= */

    const motHistory = (vehicle?.motTests || []).map(test => ({

      completedDate: test.completedDate || null,

      result:
        test.testResult ||
        "UNKNOWN",

      mileage:
        test.odometerValue ||
        "Unknown",

      mileageUnit:
        test.odometerUnit ||
        "mi",

      station:
        test.testStationName ||
        "Unknown",

      defects:
        (test.rfrAndComments || []).map(issue => ({

          text:
            issue.text ||
            "Issue",

          type:
            issue.type ||
            "ADVISORY"

        }))

    }));

    /* =========================
       FINAL RESPONSE
    ========================= */

    res.json({

      registration: reg,

      make:
        dvla.make ||
        vehicle?.make ||
        "Unknown",

      model:
        dvla.model ||
        vehicle?.model ||
        "Unknown",

      colour:
        dvla.colour ||
        "Unknown",

      fuelType:
        dvla.fuelType ||
        "Unknown",

      engineCapacity:
        dvla.engineCapacity ||
        "Unknown",

      year:
        dvla.yearOfManufacture ||
        "Unknown",

      taxStatus:
        dvla.taxStatus ||
        "Unknown",

      taxDueDate:
        dvla.taxDueDate ||
        null,

      motExpiryDate:
        dvla.motExpiryDate ||
        null,

      motHistory

    });

  } catch (err) {

    console.log(err);

    res.status(500).json({
      error: err.message
    });
  }
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
});
