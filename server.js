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

const adminActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many admin requests. Please try again shortly." },
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

function getBearerToken(req) {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    const error = new Error("Sign in to check a vehicle.");
    error.statusCode = 401;
    throw error;
  }

  return match[1];
}

function assertAuthConfigured() {
  if (!authConfig.supabaseUrl || !authConfig.supabaseAnonKey) {
    const error = new Error("Account services are not configured yet.");
    error.statusCode = 503;
    throw error;
  }
}

async function authenticateRequest(req) {
  const token = getBearerToken(req);
  assertAuthConfigured();

  let response;
  try {
    response = await fetch(`${authConfig.supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: authConfig.supabaseAnonKey,
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(8_000),
    });
  } catch (cause) {
    const error = new Error("Account services could not be reached.", { cause });
    error.statusCode = 502;
    throw error;
  }

  const user = await readJsonResponse(response, "Supabase Auth");
  if (!response.ok || !user?.id) {
    const error = new Error("Your session has expired. Sign in again.");
    error.statusCode = 401;
    throw error;
  }

  return { token, user };
}

async function callSupabaseRpc(token, functionName, parameters = {}) {
  assertAuthConfigured();

  let response;
  try {
    response = await fetch(
      `${authConfig.supabaseUrl}/rest/v1/rpc/${encodeURIComponent(functionName)}`,
      {
        method: "POST",
        headers: {
          apikey: authConfig.supabaseAnonKey,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parameters),
        signal: AbortSignal.timeout(8_000),
      }
    );
  } catch (cause) {
    const error = new Error("Account services could not be reached.", { cause });
    error.statusCode = 502;
    throw error;
  }

  const data = await readJsonResponse(response, "Supabase Data API");
  if (!response.ok) {
    const message = data?.message || "The account operation could not be completed.";
    const error = new Error(message);
    error.statusCode = response.status === 401 || response.status === 403 ? response.status : 502;
    if (message.includes("No verified BIISMO REG account")) error.statusCode = 404;
    if (message.includes("credit amount")) error.statusCode = 400;
    if (message.includes("credit balance")) error.statusCode = 400;
    throw error;
  }

  return Array.isArray(data) ? data[0] : data;
}

async function safelyCancelReservation(token, reservationId) {
  if (!reservationId) return;

  try {
    await callSupabaseRpc(token, "cancel_vehicle_search", {
      p_reservation_id: reservationId,
    });
  } catch (error) {
    console.error(`Could not refund vehicle-search reservation: ${error.message}`);
  }
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

app.get("/api/allowance", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  try {
    const { token } = await authenticateRequest(req);
    const allowance = await callSupabaseRpc(token, "get_search_allowance");
    return res.json(allowance);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) console.error(error.message);
    return res.status(statusCode).json({
      error: statusCode >= 500 ? "Your allowance could not be loaded." : error.message,
    });
  }
});

app.post("/api/grant-credits", adminActionLimiter, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const email = String(req.body?.email || "").trim().toLowerCase();
  const amount = Number(req.body?.amount);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: "Enter a complete account email address." });
  }
  if (!Number.isInteger(amount) || amount < 1 || amount > 100000) {
    return res.status(400).json({ error: "Enter a credit amount between 1 and 100,000." });
  }

  try {
    const { token } = await authenticateRequest(req);
    const grant = await callSupabaseRpc(token, "admin_grant_credits", {
      p_target_email: email,
      p_amount: amount,
    });
    return res.json(grant);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) console.error(error.message);
    return res.status(statusCode).json({
      error: statusCode >= 500 ? "Credits could not be granted." : error.message,
    });
  }
});

app.post("/api/admin/user-credits", adminActionLimiter, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: "Enter a complete account email address." });
  }

  try {
    const { token } = await authenticateRequest(req);
    const account = await callSupabaseRpc(token, "admin_get_user_credits", {
      p_target_email: email,
    });
    return res.json(account);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) console.error(error.message);
    return res.status(statusCode).json({
      error: statusCode >= 500 ? "That user could not be loaded." : error.message,
    });
  }
});

app.post("/api/admin/set-credits", adminActionLimiter, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  const email = String(req.body?.email || "").trim().toLowerCase();
  const amount = Number(req.body?.amount);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return res.status(400).json({ error: "Enter a complete account email address." });
  }
  if (!Number.isInteger(amount) || amount < 0 || amount > 100000) {
    return res.status(400).json({ error: "Enter a credit balance between 0 and 100,000." });
  }

  try {
    const { token } = await authenticateRequest(req);
    const account = await callSupabaseRpc(token, "admin_set_user_credits", {
      p_target_email: email,
      p_amount: amount,
    });
    return res.json(account);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) console.error(error.message);
    return res.status(statusCode).json({
      error: statusCode >= 500 ? "That credit balance could not be changed." : error.message,
    });
  }
});

app.post("/api/check", vehicleCheckLimiter, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  let token = null;
  let reservationId = null;

  try {
    const registration = normalizeRegistration(req.body?.registrationNumber);
    ({ token } = await authenticateRequest(req));
    assertConfigured();

    const reservation = await callSupabaseRpc(token, "reserve_vehicle_search", {
      p_registration: registration,
    });

    if (!reservation?.allowed) {
      return res.status(402).json({
        error: reservation?.message || "You have no searches available.",
        allowance: reservation,
      });
    }

    reservationId = reservation.reservationId;
    const dvla = await fetchDvlaVehicle(registration);
    const mot = await fetchMotHistory(registration);

    let allowance;
    try {
      allowance = await callSupabaseRpc(token, "complete_vehicle_search", {
        p_reservation_id: reservationId,
      });
      reservationId = null;
    } catch (cause) {
      await safelyCancelReservation(token, reservationId);
      reservationId = null;
      const error = new Error("The search could not be recorded. Please try again.", { cause });
      error.statusCode = 502;
      throw error;
    }

    res.json({
      ...buildVehicleResponse(registration, dvla, mot),
      allowance,
    });
  } catch (error) {
    await safelyCancelReservation(token, reservationId);
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
