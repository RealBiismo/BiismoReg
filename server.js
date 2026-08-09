import "dotenv/config";

import express from "express";
import rateLimit from "express-rate-limit";
import { pathToFileURL } from "node:url";

import {
  buildVehicleResponse,
  normalizeRegistration,
  ValidationError,
} from "./lib/vehicle.js";

const app = express();
const PORT = process.env.PORT || 3000;

const config = {
  dvlaApiKey: process.env.DVLA_API_KEY,
  motClientId: process.env.MOT_CLIENT_ID,
  motClientSecret: process.env.MOT_CLIENT_SECRET,
  motApiKey: process.env.MOT_API_KEY,
  motScope: process.env.MOT_SCOPE,
  motTokenUrl: process.env.MOT_TOKEN_URL,
};

const authConfig = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
};

let cachedMotToken = null;
let motTokenExpiry = 0;

app.disable("x-powered-by");
app.use(express.json({ limit: "10kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data: https://files.catbox.moe https://*.googleusercontent.com; style-src 'self'; script-src 'self' https://cdn.jsdelivr.net; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src https://accounts.google.com; object-src 'none'; base-uri 'self'; form-action 'self'"
  );
  next();
});
app.use(express.static("public"));

const vehicleCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many vehicle checks. Please try again shortly." },
});

function assertConfigured() {
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    const error = new Error("The vehicle data service is not configured.");
    error.statusCode = 503;
    error.logMessage = `Missing environment settings: ${missing.join(", ")}`;
    throw error;
  }
}

async function readJsonResponse(response, serviceName) {
  const rawBody = await response.text();
  let data = {};

  if (rawBody) {
    try {
      data = JSON.parse(rawBody);
    } catch {
      const error = new Error(`${serviceName} returned an invalid response.`);
      error.statusCode = 502;
      error.logMessage = `${serviceName} returned non-JSON data (${response.status}).`;
      throw error;
    }
  }

  return data;
}

async function fetchDvlaVehicle(registration) {
  let response;

  try {
    response = await fetch(
      "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles",
      {
        method: "POST",
        headers: {
          "x-api-key": config.dvlaApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ registrationNumber: registration }),
        signal: AbortSignal.timeout(10_000),
      }
    );
  } catch (cause) {
    const error = new Error("The DVLA service could not be reached.", { cause });
    error.statusCode = 502;
    throw error;
  }

  const data = await readJsonResponse(response, "DVLA");

  if (!response.ok) {
    const notFound = response.status === 400 || response.status === 404;
    const error = new Error(
      notFound
        ? "Vehicle not found. Check the registration and try again."
        : "The DVLA service is temporarily unavailable."
    );
    error.statusCode = notFound ? 404 : 502;
    error.logMessage = `DVLA request failed with status ${response.status}.`;
    throw error;
  }

  return data;
}

async function getMotToken() {
  const now = Date.now();

  if (cachedMotToken && now < motTokenExpiry) {
    return cachedMotToken;
  }

  let response;

  try {
    response = await fetch(config.motTokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.motClientId,
        client_secret: config.motClientSecret,
        scope: config.motScope,
        grant_type: "client_credentials",
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (cause) {
    const error = new Error("The MOT service could not be reached.", { cause });
    error.statusCode = 502;
    throw error;
  }

  const data = await readJsonResponse(response, "MOT authentication");

  if (!response.ok || !data.access_token) {
    const error = new Error("The MOT service is temporarily unavailable.");
    error.statusCode = 502;
    error.logMessage = `MOT authentication failed with status ${response.status}.`;
    throw error;
  }

  cachedMotToken = data.access_token;
  const expiresInMs = (Number(data.expires_in) || 3600) * 1000;
  motTokenExpiry = now + Math.max(expiresInMs - 30_000, 30_000);

  return cachedMotToken;
}

async function fetchMotHistory(registration) {
  const token = await getMotToken();
  let response;

  try {
    response = await fetch(
      `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${encodeURIComponent(registration)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-api-key": config.motApiKey,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      }
    );
  } catch (cause) {
    const error = new Error("The MOT service could not be reached.", { cause });
    error.statusCode = 502;
    throw error;
  }

  const data = await readJsonResponse(response, "MOT history");

  if (response.status === 404) {
    return {};
  }

  if (!response.ok) {
    const error = new Error("The MOT service is temporarily unavailable.");
    error.statusCode = 502;
    error.logMessage = `MOT history request failed with status ${response.status}.`;
    throw error;
  }

  return data;
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/config", (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (!authConfig.supabaseUrl || !authConfig.supabaseAnonKey) {
    return res.status(503).json({
      error: "Account services have not been configured yet.",
    });
  }

  return res.json(authConfig);
});

app.post("/api/check", vehicleCheckLimiter, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  try {
    const registration = normalizeRegistration(req.body?.registrationNumber);
    assertConfigured();
    const dvla = await fetchDvlaVehicle(registration);
    const mot = await fetchMotHistory(registration);

    res.json(buildVehicleResponse(registration, dvla, mot));
  } catch (error) {
    const statusCode =
      error instanceof ValidationError ? 400 : error.statusCode || 500;

    if (statusCode >= 500) {
      console.error(error.logMessage || error.message);
    }
    res.status(statusCode).json({
      error:
        statusCode >= 500 && statusCode !== 503
          ? error.message || "Vehicle check failed."
          : error.message,
    });
  }
});

app.use((req, res) => {
  if (req.path.startsWith("/api/") || req.path.startsWith("/auth/")) {
    return res.status(404).json({ error: "Endpoint not found." });
  }

  return res.status(404).sendFile("index.html", { root: "public" });
});

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  app.listen(PORT, () => {
    console.log(`BIISMO REG listening on port ${PORT}.`);
  });
}

export { app };
