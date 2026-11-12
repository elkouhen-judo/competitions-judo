const { FONT_URLS, getAssetVersions, getVersionedAssetUrls } = require("./_assets");

const SHELL_URL = "/";
const ASSET_PATHS = ["/api/styles", "/api/client", "/manifest.webmanifest"];
const BYPASS_URLS = ["/sample-users-import.csv"];

// SHELL-1 : la coquille s'affiche depuis le cache, puis se met à jour en arrière-plan ;
// une nouvelle version s'applique au lancement suivant. Le nom du cache porte l'empreinte
// du JS et du CSS : un déploiement installe un nouveau cache et supprime l'ancien.
function renderServiceWorker() {
  const versions = getAssetVersions();
  const assetUrls = getVersionedAssetUrls();
  const cacheName = `kiroku-app-shell-v9-${versions.client}-${versions.styles}`;
  const precacheUrls = [SHELL_URL, assetUrls.styles, assetUrls.client, "/manifest.webmanifest"];

  return `
const CACHE_NAME = ${JSON.stringify(cacheName)};
const SHELL_URL = ${JSON.stringify(SHELL_URL)};
const PRECACHE_URLS = ${JSON.stringify(precacheUrls)};
const FONT_URLS = ${JSON.stringify(FONT_URLS)};
const ASSET_PATHS = ${JSON.stringify(ASSET_PATHS)};
const BYPASS_URLS = ${JSON.stringify(BYPASS_URLS)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(PRECACHE_URLS).then(() =>
          // La police est une amélioration : son absence n'empêche pas l'installation.
          Promise.all(FONT_URLS.map((url) => cache.add(url).catch(() => undefined)))
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function refreshShell() {
  return fetch(SHELL_URL, { cache: "no-store" }).then((response) => {
    if (!response.ok || response.redirected) {
      return response;
    }
    const copy = response.clone();
    return caches.open(CACHE_NAME)
      .then((cache) => cache.put(SHELL_URL, copy))
      .then(() => response);
  });
}

function cacheFirst(request) {
  return caches.open(CACHE_NAME).then((cache) =>
    cache.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then((response) => {
        // Après un déploiement, ?v=ancienne-empreinte reçoit le nouveau fichier : on ne
        // le range pas sous l'ancienne adresse.
        const version = new URL(request.url).searchParams.get("v");
        const isExpectedVersion = !version || response.headers.get("X-Asset-Version") === version;
        if (response.ok && isExpectedVersion) {
          cache.put(request, response.clone());
        }
        return response;
      });
    })
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname === "/api/rpc" ||
    BYPASS_URLS.includes(url.pathname)
  ) {
    return;
  }

  if (request.mode === "navigate") {
    if (url.pathname !== SHELL_URL) {
      event.respondWith(fetch(request).catch(() => caches.match(SHELL_URL)));
      return;
    }
    const cachedShell = caches.open(CACHE_NAME).then((cache) => cache.match(SHELL_URL));
    const refreshedShell = refreshShell();
    event.waitUntil(refreshedShell.catch(() => undefined));
    // Une réponse redirigée est refusée pour une navigation : on laisse alors le
    // navigateur suivre la redirection lui-même.
    event.respondWith(
      cachedShell.then(
        (cached) => cached || refreshedShell.then((response) => (response.redirected ? fetch(request) : response))
      )
    );
    return;
  }

  if (ASSET_PATHS.includes(url.pathname) || url.pathname.startsWith("/assets/fonts/")) {
    event.respondWith(cacheFirst(request));
  }
});
`.trim();
}

module.exports = function handler(_req, res) {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(renderServiceWorker());
};

module.exports.renderServiceWorker = renderServiceWorker;
