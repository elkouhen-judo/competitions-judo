const manifest = {
  name: "Ayumi - Suivi de compétitions",
  short_name: "Ayumi",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#f3f5fa",
  theme_color: "#f3f5fa",
  lang: "fr",
  description: "Suivi mobile-first des compétitions et combats de judo.",
  icons: [
    { src: "/assets/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/assets/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/assets/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
  ]
};

module.exports = function handler(_req, res) {
  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).send(JSON.stringify(manifest));
};

module.exports.manifest = manifest;
