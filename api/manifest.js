const manifest = {
  name: "Kiroku - Suivi de compétitions",
  short_name: "Kiroku",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#fbfbfa",
  theme_color: "#111111",
  lang: "fr",
  description: "Suivi mobile-first des compétitions et combats de judo."
};

module.exports = function handler(_req, res) {
  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).send(JSON.stringify(manifest));
};

module.exports.manifest = manifest;
