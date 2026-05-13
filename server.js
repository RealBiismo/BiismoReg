import express from "express";

const app = express();

app.use(express.json());
app.use(express.static("public"));

/* ---------------------------
   MOCK DATA (replace with DVLA + MOT APIs)
----------------------------*/
function getVehicle(reg) {
  return {
    make: "BMW",
    model: "320D",
    yearOfManufacture: 2017,
    engineCapacity: 1995,
    fuelType: "Diesel",
    taxStatus: "Taxed",
    motExpiryDate: "2026-04-10",

    motHistory: [
      {
        completedDate: "2025-03-01",
        result: "PASS",
        mileage: 82000,
        defects: [{ text: "Tyres slightly worn", type: "ADVISORY" }]
      },
      {
        completedDate: "2024-03-02",
        result: "FAIL",
        mileage: 74000,
        defects: [{ text: "Brake imbalance", type: "MAJOR" }]
      }
    ]
  };
}

/* ---------------------------
   API
----------------------------*/
app.post("/api/check", (req, res) => {
  const { registrationNumber } = req.body;

  const data = getVehicle(registrationNumber);

  res.json(data);
});

/* ---------------------------
   START
----------------------------*/
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
