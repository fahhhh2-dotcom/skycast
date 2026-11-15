// SkyCast service worker
// - keeps the app itself (page, icons, map library, fonts) saved so it opens without internet
// - always tries the network first for the page, so updates show up right away
// - weather data is saved by the page itself (localStorage), not here
const CACHE = "skycast-v28";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon.svg", "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const isAsset = url => url.origin === self.location.origin || /unpkg\.com|fonts\.(googleapis|gstatic)\.com/.test(url.hostname);

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!isAsset(url)) return;               // weather APIs and map tiles go straight to the network
  if (url.origin === self.location.origin && !url.pathname.includes("/weather/")) return;
  if (url.pathname.endsWith("version.json")) return;
  // the page itself: always ask GitHub for the newest copy (no 10-minute saved copy)
  const fresh = req.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith("/");
  e.respondWith(
    fetch(fresh ? req.url : req, fresh ? { cache: "no-cache", credentials: "same-origin" } : undefined).then(res => {
      if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: req.mode === "navigate" }).then(r => r || (req.mode === "navigate" ? caches.match("./index.html") : Response.error())))
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window" }).then(list => {
    for (const c of list) if ("focus" in c) return c.focus();
    return self.clients.openWindow("./");
  }));
});
