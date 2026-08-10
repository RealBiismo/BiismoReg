const CACHE_NAME = "biismo-reg-v34";
const CANONICAL_ORIGIN = "https://biismoreg.com";
const LEGACY_HOSTS = new Set(["biismoreg-com.onrender.com"]);
const NETWORK_FIRST_ASSETS = new Set([
  "/index.html",
  "/account.html",
  "/credits.html",
  "/notifications.html",
  "/notifications.js",
  "/notifications.css",
  "/pwa.js",
  "/brand-logos.js",
  "/brand-logos.css",
  "/admin-controls.js",
  "/staff-dashboard-organizer.js",
  "/staff-dashboard-organizer.css",
  "/moderator-controls.js",
  "/moderator-controls.css",
  "/ui-overrides.css",
  "/homepage-fix.css",
  "/full-history-preview.js",
  "/full-history-preview.css",
  "/pwa-install.css",
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
  "/brand-logos.css",
  "/full-history-preview.css",
  "/script.js",
  "/full-history-preview.js",
  "/splash.js",
  "/auth.js",
  "/pwa.js",
  "/brand-logos.js",
  "/account.html",
  "/account.js",
  "/admin-controls.js",
  "/credits.html",
  "/credits.js",
  "/notifications.html",
  "/notifications.js",
  "/notifications.css",
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

  const reader = new URL("/notifications.html", self.location.origin);
  const details = new URLSearchParams();
  details.set("title", event.notification.title || "BIISMO REG notification");
  details.set("message", event.notification.body || "Open your inbox for the latest BIISMO REG update.");
  details.set("tag", event.notification.tag || "");
  details.set("source", event.notification.data?.url || "/account.html");
  reader.hash = details.toString();
  const targetUrl = reader.href;

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
