/* Cadence service worker: lets the app open with no signal.
   Network first (so updates arrive as soon as they're published), falling back to the last copy seen.
   Voice files are handled separately by piper-worker.js. */
const SHELL = "cadence-shell-v1";
const FILES = ["./", "index.html", "piper-worker.js", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(SHELL);
    try {
      const r = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(() => no(new Error("slow")), 4000))]);
      if (r.ok) c.put(req, r.clone());
      return r;
    } catch (err) {
      return (await c.match(req, { ignoreSearch: true })) || (req.mode === "navigate" && await c.match("./")) || Response.error();
    }
  })());
});
