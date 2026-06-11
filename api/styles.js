const fs = require("node:fs");
const path = require("node:path");

module.exports = function handler(_req, res) {
  const cssPath = path.join(process.cwd(), "assets", "app.css");
  const css = fs.readFileSync(cssPath, "utf8");

  res.setHeader("Content-Type", "text/css; charset=utf-8");
  res.status(200).send(css);
};
