import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

/* =========================
   MOT TOKEN
========================= */
let motToken = null;
let motTokenExpiry = 0;

async function getMotToken(){

  if(motToken && Date.now() < motTokenExpiry){
    return motToken;
  }

  const res = await fetch(
    "https://login.microsoftonline.com/a455b827-244f-4c97-b5b4-ce5d13b4d00c/oauth2/v2.0/token",
    {
      method:"POST",
      headers:{
        "Content-Type":"application/x-www-form-urlencoded"
      },
      body:new URLSearchParams({
        client_id: process.env.MOT_CLIENT_ID,
        client_secret: process.env.MOT_CLIENT_SECRET,
        scope: "https://tapi.dvsa.gov.uk/.default",
        grant_type: "client_credentials"
      })
    }
  );

  const data = await res.json();

  if(!data.access_token){
    throw new Error("MOT token failed");
  }

  motToken = data.access_token;
  motTokenExpiry = Date.now() + 50 * 60 * 1000;

  return motToken;
}

/* =========================
   DVLA VEHICLE DATA
========================= */
async function getVehicle(reg){

  const res = await fetch(
    "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles",
    {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "x-api-key": process.env.DVLA_API_KEY
      },
      body:JSON.stringify({
        registrationNumber: reg
      })
    }
  );

  return await res.json();
}

/* =========================
   MOT HISTORY
========================= */
async function getMotHistory(reg){

  try{

    const token = await getMotToken();

    const res = await fetch(
      `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${reg}`,
      {
        headers:{
          "Authorization":`Bearer ${token}`,
          "x-api-key": process.env.MOT_API_KEY
        }
      }
    );

    const data = await res.json();

    return data?.motTests || [];

  }catch(e){
    return [];
  }
}

/* =========================
   MAIN API
========================= */
app.post("/api/check", async (req,res)=>{

  try{

    const reg =
      req.body.registrationNumber
        ?.toUpperCase()
        ?.replace(/\s/g,"");

    const vehicle =
      await getVehicle(reg);

    const motHistory =
      await getMotHistory(reg);

    res.json({
      registration: reg,
      make: vehicle?.make || "Unknown",
      model: vehicle?.model || "",
      fuelType: vehicle?.fuelType || "Unknown",
      engineCapacity: vehicle?.engineCapacity || "N/A",

      taxDueDate: vehicle?.taxDueDate || null,
      motExpiryDate: vehicle?.motExpiryDate || null,

      motHistory
    });

  }catch(err){
    res.json({ error: err.message });
  }
});

app.listen(PORT, ()=>{
  console.log("Server running on", PORT);
});
