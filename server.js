import "dotenv/config";

import express from "express";
import rateLimit from "express-rate-limit";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import webpush from "web-push";

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

const pushConfig = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: process.env.VAPID_SUBJECT || "https://biismoreg-com.onrender.com",
  cronSecret: process.env.REMINDER_CRON_SECRET,
};

if (pushConfig.publicKey && pushConfig.privateKey) {
  webpush.setVapidDetails(pushConfig.subject, pushConfig.publicKey, pushConfig.privateKey);
}

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

const pushActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many reminder requests. Please try again shortly." },
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

function pushIsConfigured() {
  return Boolean(pushConfig.publicKey && pushConfig.privateKey && pushConfig.cronSecret);
}

function secretsMatch(received, expected) {
  const receivedBuffer = Buffer.from(String(received || ""));
  const expectedBuffer = Buffer.from(String(expected || ""));
  return (
    receivedBuffer.length === expectedBuffer.length &&
    receivedBuffer.length > 0 &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

function validPushSubscription(subscription) {
  return Boolean(
    subscription &&
      typeof subscription.endpoint === "string" &&
      subscription.endpoint.startsWith("https://") &&
      subscription.endpoint.length <= 2048 &&
      typeof subscription.keys?.p256dh === "string" &&
      subscription.keys.p256dh.length >= 40 &&
      subscription.keys.p256dh.length <= 256 &&
      typeof subscription.keys?.auth === "string" &&
      subscription.keys.auth.length >= 8 &&
      subscription.keys.auth.length <= 128
  );
}

function reminderPayload(reminder) {
  const days = Number(reminder.daysRemaining);
  const dueText =
    days === 0
      ? "is due today"
      : days === 1
        ? "is due tomorrow"
        : `is due in ${days} days`;
  const type = String(reminder.reminderType || "vehicle").toUpperCase();
  const vehicle = [reminder.make, reminder.model].filter(Boolean).join(" ");

  return JSON.stringify({
    title: `${type} reminder · ${reminder.registration}`,
    body: `${vehicle || "Your vehicle"} ${type} ${dueText}.`,
    tag: `biismo-${reminder.reminderType}-${reminder.vehicleId}-${reminder.dueDate}`,
    url: `/account.html?vehicle=${encodeURIComponent(reminder.registration)}`,
  });
}

async function recordReminderAttempt(reminder, success, permanentFailure = false, errorMessage = null) {
  await callSupabaseRpc(authConfig.supabaseAnonKey, "record_push_reminder", {
    p_cron_secret: pushConfig.cronSecret,
    p_subscription_id: reminder.subscriptionId,
    p_vehicle_id: reminder.vehicleId,
    p_reminder_type: reminder.reminderType,
    p_due_date: reminder.dueDate,
    p_success: success,
    p_disable_subscription: permanentFailure,
    p_error: errorMessage ? String(errorMessage).slice(0, 500) : null,
  });
}

async function dispatchDueReminders() {
  const response =
    (await callSupabaseRpc(authConfig.supabaseAnonKey, "get_due_push_reminders", {
      p_cron_secret: pushConfig.cronSecret,
    })) || [];
  const items = Array.isArray(response.reminders) ? response.reminders : [];
  let sent = 0;
  let failed = 0;

  for (const reminder of items) {
    try {
      await webpush.sendNotification(
        {
          endpoint: reminder.endpoint,
          keys: { p256dh: reminder.p256dh, auth: reminder.authKey },
        },
        reminderPayload(reminder),
        { TTL: 60 * 60 * 24 }
      );
      await recordReminderAttempt(reminder, true);
      sent += 1;
    } catch (error) {
      const permanentFailure = error?.statusCode === 404 || error?.statusCode === 410;
      try {
        await recordReminderAttempt(reminder, false, permanentFailure, error?.message);
      } catch (recordError) {
        console.error(`Could not record reminder failure: ${recordError.message}`);
      }
      failed += 1;
      console.error(`Push reminder failed (${error?.statusCode || "unknown"}).`);
    }
  }

  return { checked: items.length, sent, failed };
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

app.get("/api/push/public-key", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!pushConfig.publicKey) {
    return res.status(503).json({ error: "Vehicle reminders are not configured yet." });
  }
  return res.json({ publicKey: pushConfig.publicKey });
});

app.post("/api/push/subscribe", pushActionLimiter, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const subscription = req.body?.subscription;
  if (!validPushSubscription(subscription)) {
    return res.status(400).json({ error: "That notification subscription is invalid." });
  }

  try {
    const { token } = await authenticateRequest(req);
    const result = await callSupabaseRpc(token, "upsert_push_subscription", {
      p_endpoint: subscription.endpoint,
      p_p256dh: subscription.keys.p256dh,
      p_auth: subscription.keys.auth,
      p_user_agent: String(req.get("user-agent") || "").slice(0, 500),
    });
    return res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) console.error(error.message);
    return res.status(statusCode).json({
      error: statusCode >= 500 ? "Reminders could not be enabled." : error.message,
    });
  }
});

app.delete("/api/push/subscribe", pushActionLimiter, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const endpoint = String(req.body?.endpoint || "");
  if (!endpoint.startsWith("https://") || endpoint.length > 2048) {
    return res.status(400).json({ error: "That notification subscription is invalid." });
  }

  try {
    const { token } = await authenticateRequest(req);
    const result = await callSupabaseRpc(token, "delete_push_subscription", {
      p_endpoint: endpoint,
    });
    return res.json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) console.error(error.message);
    return res.status(statusCode).json({
      error: statusCode >= 500 ? "Reminders could not be disabled." : error.message,
    });
  }
});

app.post("/api/cron/reminders", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!pushIsConfigured()) {
    return res.status(503).json({ error: "Vehicle reminders are not configured yet." });
  }
  if (!secretsMatch(req.get("x-cron-secret"), pushConfig.cronSecret)) {
    return res.status(401).json({ error: "Invalid reminder job credentials." });
  }

  try {
    return res.json(await dispatchDueReminders());
  } catch (error) {
    console.error(`Reminder dispatch failed: ${error.message}`);
    return res.status(502).json({ error: "Vehicle reminders could not be dispatched." });
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
