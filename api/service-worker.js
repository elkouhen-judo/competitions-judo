const CACHE_NAME = "kiroku-app-shell-v4";
const APP_SHELL_URLS = ["/", "/api/styles", "/api/client", "/manifest.webmanifest"];
const BYPASS_URLS = ["/sample-users-import.csv"];

function renderServiceWorker() {
  return `
const CACHE_NAME = ${JSON.stringify(CACHE_NAME)};
const APP_SHELL_URLS = ${JSON.stringify(APP_SHELL_URLS)};
const BYPASS_URLS = ${JSON.stringify(BYPASS_URLS)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
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

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.pathname === "/api/rpc" ||
    BYPASS_URLS.includes(url.pathname)
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }

  if (APP_SHELL_URLS.includes(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.open(CACHE_NAME).then((cache) => cache.match(request)))
    );
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
