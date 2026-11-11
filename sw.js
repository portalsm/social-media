// =============================================================================
// sw.js: service worker do portal (PWA).
// REGRA: index.html, app.js, app.css e config.js vêm PRIMEIRO DA REDE (o cache só é
// usado sem internet). Assim o cliente nunca fica preso numa versão antiga.
// Os demais arquivos (ícone, manifest, páginas públicas) podem vir do cache.
// =============================================================================
const CACHE = "portal-v20261111130311";
const ESSENCIAIS = ["./", "./index.html", "./css/app.css", "./js/app.js", "./js/config.js", "./manifest.webmanifest",
  "./img/logo-portal.png", "./img/simbolo-portal.png", "./img/icone-32.png", "./img/icone-192.png"];
const REDE_PRIMEIRO = [/\/$/, /index\.html$/, /app\.js$/, /app\.css$/, /config\.js$/];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ESSENCIAIS)).catch(() => null));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // Supabase, CDN e Meta: direto pela rede

  if (REDE_PRIMEIRO.some((r) => r.test(url.pathname))) {
    // Rede primeiro; se falhar (sem internet), usa o cache
    e.respondWith(
      fetch(req).then((resp) => {
        const copia = resp.clone();
        caches.open(CACHE).then((c) => c.put(req, copia)).catch(() => null);
        return resp;
      }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("./index.html")))
    );
    return;
  }
  // Demais: cache primeiro
  e.respondWith(caches.match(req).then((r) => r || fetch(req)));
});
