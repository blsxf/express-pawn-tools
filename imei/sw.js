// Express Pawn IMEI Tool — Offline-First Service Worker
const CACHE_PREFIX = "imei-tool-";
const CACHE_NAME = "imei-tool-v1";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./carriers.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isCarriers = url.pathname.endsWith("/carriers.json") || url.pathname === "carriers.json";

  if (isCarriers) {
    // Network-first (with cache fallback) for ./carriers.json
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("./carriers.json", copy));
          }
          return res;
        })
        .catch(() => caches.match("./carriers.json", { ignoreSearch: true }))
    );
    return;
  }

  // Cache-first for ./index.html, ./manifest.json, ./, and same-origin shell assets
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          if (req.mode === "navigate") {
            return caches.match("./index.html", { ignoreSearch: true });
          }
          return caches.match("./", { ignoreSearch: true });
        });
    })
  );
});
