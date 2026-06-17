const fs = require("node:fs");
const path = require("node:path");

module.exports = function handler(_req, res) {
  const content = fs.readFileSync(
    path.join(process.cwd(), "assets", "sample-users-import.csv"),
    "utf8"
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="exemple-import-utilisateurs.csv"');
  res.status(200).send(content);
};
