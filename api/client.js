const fs = require("node:fs");
const path = require("node:path");

module.exports = function handler(_req, res) {
  const clientFiles = [
    "app-ui.js",
    "app.js"
  ];
  const client = clientFiles
    .map(file => fs.readFileSync(path.join(process.cwd(), "assets", file), "utf8"))
    .join("\n\n");

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.status(200).send(client);
};
