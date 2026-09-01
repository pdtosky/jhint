const CACHE_NAME = "jhint-production-app-v20260901-06";
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/xlsx-export.js",
  "/sop-seed.js",
  "/sop/index.html",
  "/sop/bridge.js",
  "/sop/xlsx-import.js",
  "/sop/app.js",
  "/sop/identity.js",
  "/sop/styles.css",
  "/config.js",
  "/manifest.webmanifest",
  "/app-icon.png",
  "/company-logo.jpg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseCopy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === "navigate") return caches.match("/index.html");
          return Response.error();
        })
      )
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch (error) {
    payload = { body: event.data?.text() || "생산 작업을 확인해 주세요." };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "생산일정 관리", {
      body: payload.body || "생산 작업을 확인해 주세요.",
      icon: payload.icon || "/app-icon.png",
      badge: payload.badge || "/app-icon.png",
      tag: payload.tag || "jhint-production-reminder",
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: [300, 150, 300, 150, 500],
      data: {
        url: payload.url || "/",
        view: payload.view || "workerView",
        kind: payload.kind || ""
      }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;
  const targetView = event.notification.data?.view || "workerView";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existing) {
        existing.postMessage({ type: "JHINT_OPEN_VIEW", view: targetView });
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
