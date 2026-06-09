const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const code = fs.readFileSync(path.join(__dirname, "..", "Code.js"), "utf8");

test("web app output declares the mobile viewport through HtmlOutput", () => {
  assert.match(code, /\.addMetaTag\(\s*"viewport"\s*,\s*"width=device-width, initial-scale=1"\s*\)/);
});
