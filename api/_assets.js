const fs = require("node:fs");
const path = require("node:path");

// SHELL-2 : le build (scripts/build-assets.js) produit un JS et un CSS minifiés, et leur
// empreinte. Chaque fichier est lu une fois par instance de fonction.
const ONE_YEAR_IMMUTABLE = "public, max-age=31536000, immutable";
const FONT_URLS = [
  "/assets/fonts/plus-jakarta-sans-latin-wght-normal.woff2",
  "/assets/fonts/plus-jakarta-sans-latin-ext-wght-normal.woff2"
];
const cache = new Map();

function readOnce(key, read) {
  if (!cache.has(key)) {
    cache.set(key, read());
  }
  return cache.get(key);
}

function getAssetVersions() {
  return readOnce("versions", () =>
    JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "assets", "dist", "asset-manifest.json"), "utf8")
    )
  );
}

function readClientBundle() {
  return readOnce("client", () =>
    fs.readFileSync(path.join(process.cwd(), "assets", "dist", "client.min.js"), "utf8")
  );
}

function readStylesBundle() {
  return readOnce("styles", () =>
    fs.readFileSync(path.join(process.cwd(), "assets", "dist", "styles.min.css"), "utf8")
  );
}

function getVersionedAssetUrls() {
  const versions = getAssetVersions();
  return {
    client: `/api/client?v=${versions.client}`,
    styles: `/api/styles?v=${versions.styles}`
  };
}

// Une URL qui porte l'empreinte du contenu est mise en cache un an ; sans empreinte
// (ou avec une empreinte périmée), le navigateur revalide à chaque fois.
function sendVersionedAsset(req, res, contentType, version, body) {
  const requested = new URL(String(req.url || "/"), "http://localhost").searchParams.get("v");
  res.setHeader("Content-Type", contentType);
  // Le service worker compare cette empreinte à celle de l'URL avant de mettre en cache.
  res.setHeader("X-Asset-Version", version);
  res.setHeader(
    "Cache-Control",
    requested && requested === version ? ONE_YEAR_IMMUTABLE : "no-cache"
  );
  res.status(200).send(body);
}

module.exports = {
  FONT_URLS,
  getAssetVersions,
  getVersionedAssetUrls,
  readClientBundle,
  readStylesBundle,
  sendVersionedAsset
};
