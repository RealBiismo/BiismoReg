import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static("public"));

/**
 * 🚗 MOCK DVLA + MOT DATA (replace with real APIs later)
 */
function getMockVehicle(reg) {
  return {
    make: "BMW",
    model: "320D",
    yearOfManufacture: 2017,
    engineCapacity: 1995,
    fuelType: "Diesel",
    colour: "White",
    taxStatus: "Taxed",
    taxDueDate: "2026-10-01",
    motExpiryDate: "2026-04-10",

    motHistory: [
      {
        completedDate: "2025-03-01",
        result: "PASS",
        mileage: 82000,
        defects: {
          advisories: [{ text: "Tyres slightly worn" }],
          major: [],
          minor: []
        }
      },
      {
        completedDate: "2024-03-02",
        result: "FAIL",
        mileage: 74000,
        defects: {
          advisories: [],
          major: [{ text: "Brake imbalance detected" }],
          minor: []
        }
      },
      {
        completedDate: "2023-03-05",
        result: "PASS",
        mileage: 66000,
        defects: {
          advisories: [],
          major: [],
          minor: []
        }
      }
    ]
  };
}

/**
 * 🚗 MAIN API ROUTE
 */
app.post("/api/check", (req, res) => {
  try {
    const { registrationNumber } = req.body;

    const data = getMockVehicle(registrationNumber);

    res.json(data);

  } catch (err) {
    res.json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("Server running: http://localhost:3000");
});
