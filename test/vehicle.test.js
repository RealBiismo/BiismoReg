import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVehicleResponse,
  normalizeMotHistory,
  normalizeRegistration,
  ValidationError,
} from "../lib/vehicle.js";
import { app } from "../server.js";

test("normalizes a registration", () => {
  assert.equal(normalizeRegistration("pa55 mgn"), "PA55MGN");
  assert.equal(normalizeRegistration("ab-12-cde"), "AB12CDE");
});

test("rejects malformed registration input", () => {
  assert.throws(() => normalizeRegistration("<script>"), ValidationError);
  assert.throws(() => normalizeRegistration("ABCDEFG"), ValidationError);
  assert.throws(() => normalizeRegistration("1234567"), ValidationError);
});

test("normalizes and deduplicates MOT defects", () => {
  const history = normalizeMotHistory({
    motTests: [
      {
        completedDate: "2025-01-02",
        testResult: "PASSED",
        odometerValue: "45000",
        rfrAndComments: [{ text: "Tyre worn", type: "ADVISORY" }],
        advisories: [{ text: "Tyre worn" }],
        majorDefects: [{ description: "Brake defective" }],
      },
    ],
  });

  assert.equal(history.length, 1);
  assert.deepEqual(history[0].defects, [
    { text: "Tyre worn", type: "ADVISORY" },
    { text: "Brake defective", type: "MAJOR" },
  ]);
});

test("builds a stable response when no MOT history exists", () => {
  const response = buildVehicleResponse(
    "PA55MGN",
    { make: "BMW", taxStatus: "Taxed", engineCapacity: 1995 },
    {}
  );

  assert.equal(response.registration, "PA55MGN");
  assert.equal(response.make, "BMW");
  assert.equal(response.engineCapacity, 1995);
  assert.deepEqual(response.motHistory, []);
});

test("serves health status and rejects unsafe input", async (context) => {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const healthResponse = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { status: "ok" });

  const invalidResponse = await fetch(`${baseUrl}/api/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registrationNumber: "<script>" }),
  });
  assert.equal(invalidResponse.status, 400);
  assert.deepEqual(await invalidResponse.json(), {
    error: "Enter a valid UK registration number.",
  });
});
