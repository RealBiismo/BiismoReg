const express = require('express');
const webpush = require('web-push');

const originalListen = express.application.listen;
let motToken = null;
let motTokenExpiry = 0;

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const cronSecret = process.env.REMINDER_CRON_SECRET;
const vapidPublic = process.env.VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'https://biismoreg.com';

if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
}

function bearer(req) {
  const match = String(req.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error('Sign in to continue.');
    error.statusCode = 401;
    throw error;
  }
  return match[1];
}

async function rpc(token, name, params = {}) {
  if (!supabaseUrl || !anonKey) throw Object.assign(new Error('Account services are unavailable.'), { statusCode: 503 });
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(10000),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || 'That operation could not be completed.');
    error.statusCode = response.status === 401 || response.status === 403 ? response.status : 502;
    if (/limit reached|invalid registration|invalid report/i.test(error.message)) error.statusCode = 400;
    throw error;
  }
  return Array.isArray(data) ? data[0] : data;
}

function errorResponse(res, error, fallback) {
  const status = error.statusCode || 500;
  if (status >= 500) console.error(`[BIISMO feature] ${error.message}`);
  return res.status(status).json({ error: status >= 500 ? fallback : error.message });
}

async function getMotToken() {
  if (motToken && Date.now() < motTokenExpiry) return motToken;
  const response = await fetch(process.env.MOT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MOT_CLIENT_ID,
      client_secret: process.env.MOT_CLIENT_SECRET,
      scope: process.env.MOT_SCOPE,
      grant_type: 'client_credentials',
    }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error('MOT authentication failed.');
  motToken = data.access_token;
  motTokenExpiry = Date.now() + Math.max((Number(data.expires_in) || 3600) * 1000 - 30000, 30000);
  return motToken;
}

async function officialVehicle(registration) {
  const [dvlaResponse, motAccessToken] = await Promise.all([
    fetch('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles', {
      method: 'POST',
      headers: { 'x-api-key': process.env.DVLA_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ registrationNumber: registration }),
      signal: AbortSignal.timeout(10000),
    }),
    getMotToken(),
  ]);
  if (!dvlaResponse.ok) throw new Error(`DVLA refresh failed (${dvlaResponse.status}).`);
  const dvla = await dvlaResponse.json();
  const motResponse = await fetch(`https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${encodeURIComponent(registration)}`, {
    headers: { Authorization: `Bearer ${motAccessToken}`, 'x-api-key': process.env.MOT_API_KEY, Accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });
  const motRaw = motResponse.status === 404 ? {} : await motResponse.json();
  if (!motResponse.ok && motResponse.status !== 404) throw new Error(`MOT refresh failed (${motResponse.status}).`);
  const vehicleModule = await import('./lib/vehicle.js');
  return vehicleModule.buildVehicleResponse(registration, dvla, motRaw);
}

function latestMileage(vehicle) {
  return [...(vehicle.motHistory || [])]
    .map((test) => ({ date: new Date(test.completedDate), mileage: Number.parseInt(String(test.mileage || '').replace(/[^\d]/g, ''), 10) }))
    .filter((item) => !Number.isNaN(item.date.getTime()) && Number.isFinite(item.mileage))
    .sort((a, b) => b.date - a.date)[0]?.mileage ?? null;
}

async function refreshOneWatch(item) {
  try {
    const vehicle = await officialVehicle(item.registration);
    const recorded = await rpc(anonKey, 'record_watch_refresh', {
      p_cron_secret: cronSecret,
      p_watch_id: item.watchId,
      p_make: vehicle.make,
      p_model: vehicle.model,
      p_tax_status: vehicle.taxStatus,
      p_tax_due_date: vehicle.taxDueDate,
      p_mot_status: vehicle.motStatus,
      p_mot_expiry_date: vehicle.motExpiryDate,
      p_last_mileage: latestMileage(vehicle),
    });
    if (!recorded?.changed) return { changed: false };
    const subscriptions = Array.isArray(item.subscriptions) ? item.subscriptions : [];
    let sent = 0;
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.authKey } },
          JSON.stringify({ title: recorded.title || `Watchlist update · ${item.registration}`, body: recorded.message || 'Official vehicle information changed.', tag: `biismo-watch-${item.watchId}`, url: recorded.url || `/?reg=${encodeURIComponent(item.registration)}` }),
          { TTL: 86400 }
        );
        sent += 1;
      } catch (error) {
        console.error(`[BIISMO watch push] ${error?.statusCode || 'unknown'}`);
      }
    }
    return { changed: true, sent };
  } catch (error) {
    console.error(`[BIISMO watch refresh ${item.registration}] ${error.message}`);
    return { changed: false, failed: true };
  }
}

async function dispatchWatchRefreshes() {
  if (!cronSecret || !vapidPublic || !vapidPrivate || !process.env.DVLA_API_KEY) return;
  const data = await rpc(anonKey, 'get_due_watch_refreshes', { p_cron_secret: cronSecret });
  const items = Array.isArray(data?.items) ? data.items.slice(0, 10) : [];
  if (!items.length) return;
  await Promise.all(items.map(refreshOneWatch));
}

function featureRouter() {
  const router = express.Router();

  router.get('/api/watchlist', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try { return res.json(await rpc(bearer(req), 'get_vehicle_watchlist')); }
    catch (error) { return errorResponse(res, error, 'Your watchlist could not be loaded.'); }
  });

  router.post('/api/watchlist', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      return res.json(await rpc(bearer(req), 'upsert_vehicle_watch', {
        p_registration: req.body?.registration,
        p_make: req.body?.make || null,
        p_model: req.body?.model || null,
        p_tax_status: req.body?.taxStatus || null,
        p_tax_due_date: req.body?.taxDueDate || null,
        p_mot_status: req.body?.motStatus || null,
        p_mot_expiry_date: req.body?.motExpiryDate || null,
        p_last_mileage: Number.isFinite(Number(req.body?.lastMileage)) ? Number(req.body.lastMileage) : null,
      }));
    } catch (error) { return errorResponse(res, error, 'That vehicle could not be added to your watchlist.'); }
  });

  router.delete('/api/watchlist/:id', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid watchlist item.' });
    try { return res.json(await rpc(bearer(req), 'remove_vehicle_watch', { p_watch_id: req.params.id })); }
    catch (error) { return errorResponse(res, error, 'That watchlist item could not be removed.'); }
  });

  router.post('/api/share-report', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const shared = await rpc(bearer(req), 'create_shared_vehicle_report', { p_snapshot: req.body?.snapshot });
      const origin = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
      return res.json({ ...shared, url: `${String(origin).replace(/\/$/, '')}/report.html?token=${encodeURIComponent(shared.token)}` });
    } catch (error) { return errorResponse(res, error, 'That report could not be shared.'); }
  });

  router.get('/api/shared-report/:token', async (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=60');
    try {
      const report = await rpc(anonKey, 'get_shared_vehicle_report', { p_token: req.params.token });
      if (!report) return res.status(404).json({ error: 'This shared report is unavailable or has expired.' });
      return res.json(report);
    } catch (error) { return errorResponse(res, error, 'This shared report could not be loaded.'); }
  });

  return router;
}

function patchSecurityHeaders(app) {
  const stack = app?._router?.stack || [];
  const layer = stack.find((entry) => !entry.route && String(entry.handle).includes('Content-Security-Policy'));
  if (!layer) return;
  const original = layer.handle;
  layer.handle = function biismoFeatureHeaders(req, res, next) {
    return original(req, res, () => {
      res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
      res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob: https://*.googleusercontent.com; style-src 'self'; script-src 'self' https://cdn.jsdelivr.net; worker-src 'self' blob: https://cdn.jsdelivr.net; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net https://tessdata.projectnaptha.com; frame-src https://accounts.google.com; object-src 'none'; base-uri 'self'; form-action 'self'");
      next();
    });
  };
}

function patchReminderRoute(app) {
  const routeLayer = (app?._router?.stack || []).find((entry) => entry.route?.path === '/api/cron/reminders');
  const handlerLayer = routeLayer?.route?.stack?.[0];
  if (!handlerLayer) return;
  const original = handlerLayer.handle;
  handlerLayer.handle = async function biismoWatchRefresh(req, res, next) {
    if (cronSecret && req.get('x-cron-secret') === cronSecret) {
      try { await dispatchWatchRefreshes(); } catch (error) { console.error(`[BIISMO watch dispatch] ${error.message}`); }
    }
    return original(req, res, next);
  };
}

express.application.listen = function patchedListen(...args) {
  if (!this.__biismoFeaturesInstalled) {
    this.__biismoFeaturesInstalled = true;
    patchSecurityHeaders(this);
    patchReminderRoute(this);
    const stack = this._router?.stack;
    if (stack) {
      const router = featureRouter();
      stack.splice(Math.max(stack.length - 1, 0), 0, ...router.stack);
    }
  }
  return originalListen.apply(this, args);
};
