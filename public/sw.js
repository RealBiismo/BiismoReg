const CACHE_NAME = "biismo-reg-v24";
const CANONICAL_ORIGIN = "https://biismoreg.com";
const LEGACY_HOSTS = new Set(["biismoreg-com.onrender.com"]);
const NETWORK_FIRST_ASSETS = new Set([
  "/index.html",
  "/account.html",
  "/report.html",
  "/credits.html",
  "/pwa.js",
  "/admin-controls.js",
  "/ui-overrides.css",
  "/homepage-fix.css",
  "/features.css",
  "/vehicle-features.js",
  "/feature-network-fixes.js",
  "/garage-features.js",
  "/report.js",
  "/manifest.json"
]);
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/classic.css",
  "/pwa-install.css",
  "/ui-overrides.css",
  "/homepage-fix.css",
  "/features.css",
  "/script.js",
  "/vehicle-features.js",
  "/feature-network-fixes.js",
  "/garage-features.js",
  "/report.html",
  "/report.js",
  "/splash.js",
  "/auth.js",
  "/pwa.js",
  "/account.html",
  "/account.js",
  "/admin-controls.js",
  "/credits.html",
  "/credits.js",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();

      if (!LEGACY_HOSTS.has(self.location.hostname)) return;

      let hadPushSubscription = false;
      try {
        const subscription = await self.registration.pushManager.getSubscription();
        if (subscription) {
          hadPushSubscription = true;
          await subscription.unsubscribe();
        }
      } catch {
        // Continue migrating open windows even if the old subscription cannot be removed.
      }

      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await Promise.all(
        windows.map((client) => {
          const current = new URL(client.url);
          const destination = hadPushSubscription
            ? new URL("/account.html?pushMigration=1", CANONICAL_ORIGIN)
            : new URL(`${current.pathname}${current.search}${current.hash}`, CANONICAL_ORIGIN);
          return client.navigate(destination.href).catch(() => null);
        })
      );

      await self.registration.unregister();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== "GET" || requestUrl.origin !== self.location.origin) return;

  if (requestUrl.pathname.startsWith("/api/") || requestUrl.pathname.startsWith("/auth/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (NETWORK_FIRST_ASSETS.has(requestUrl.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkRequest = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkRequest;
    })
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { body: event.data?.text() || "A saved vehicle has an upcoming renewal." };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "BIISMO REG reminder", {
      body: payload.body || "A saved vehicle has an upcoming renewal.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.tag || "biismo-vehicle-reminder",
      data: { url: payload.url || "/account.html" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/account.html", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.navigate(targetUrl);
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
