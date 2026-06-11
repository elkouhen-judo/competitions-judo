const fs = require("node:fs");
const path = require("node:path");

module.exports = function handler(_req, res) {
  const clientPath = path.join(process.cwd(), "assets", "app.js");
  const client = fs.readFileSync(clientPath, "utf8");

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.status(200).send(client);
};
