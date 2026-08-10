const CACHE_PREFIX = "biismo-reg-";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

// Deliberately do not intercept normal page/CSS/JS requests. BIISMO pages load
// directly from the network so a stale or stalled service-worker cache can never
// block the site. This worker exists only for push notifications.

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
