import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

/**
 * 🔧 Convert DVSA MOT format → frontend format
 */
function mapMotHistory(tests = []) {
  return tests.map(t => ({
    completedDate: t.completedDate,
    result: t.testResult,
    mileage: t.odometerValue || 0,

    defects: {
      advisories: (t.rfrAndComments || []).filter(x =>
        (x.type || "").toUpperCase().includes("ADVIS")
      ),
      major: (t.rfrAndComments || []).filter(x =>
        (x.type || "").toUpperCase().includes("MAJOR")
      ),
      minor: (t.rfrAndComments || []).filter(x =>
        (x.type || "").toUpperCase().includes("MINOR")
      )
    }
  }));
}

/**
 * 🚗 MAIN API
 */
app.post("/api/check", async (req, res) => {

  try {

    const { registrationNumber } = req.body;

    // -----------------------------
    // 🔵 DVLA DATA (replace with real API)
    // -----------------------------
    const dvla = {
      make: "BMW",
      model: "320D",
      yearOfManufacture: 2017,
      engineCapacity: 1995,
      fuelType: "Diesel",
      colour: "White",
      taxStatus: "Taxed",
      taxDueDate: "2026-10-01",
      motExpiryDate: "2026-04-10"
    };

    // -----------------------------
    // 🔴 DVSA MOT DATA (replace with real API)
    // -----------------------------
    const motRaw = {
      motTests: [
        {
          completedDate: "2025-03-01",
          testResult: "PASS",
          odometerValue: 82000,
          rfrAndComments: [
            { type: "ADVISORY", text: "Tyres slightly worn" }
          ]
        },
        {
          completedDate: "2024-03-02",
          testResult: "FAIL",
          odometerValue: 74000,
          rfrAndComments: [
            { type: "MAJOR", text: "Brake imbalance detected" }
          ]
        },
        {
          completedDate: "2023-03-05",
          testResult: "PASS",
          odometerValue: 66000,
          rfrAndComments: []
        }
      ]
    };

    const motHistory = mapMotHistory(motRaw.motTests);

    res.json({
      ...dvla,
      motHistory
    });

  } catch (err) {
    res.json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log("Running on http://localhost:3000");
});
