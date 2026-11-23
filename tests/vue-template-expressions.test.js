const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Une apostrophe droite dans une chaîne '...' d'une expression Vue casse la compilation du template
// (« Unexpected identifier »). Les textes de ces expressions utilisent l'apostrophe typographique ’.
test("Vue bound attributes keep their single-quoted strings balanced", () => {
  const viewsDir = path.join(__dirname, "..", "assets", "views");
  const broken = [];
  for (const file of fs.readdirSync(viewsDir).filter((name) => name.endsWith(".html"))) {
    const source = fs.readFileSync(path.join(viewsDir, file), "utf8");
    for (const match of source.matchAll(/\s(?::|v-bind:|v-[\w-]+|@)[\w.:-]*="([^"]*)"/g)) {
      const quotes = (match[1].replace(/\\'/g, "").match(/'/g) || []).length;
      if (quotes % 2 !== 0) broken.push(`${file}: ${match[1]}`);
    }
  }
  assert.deepEqual(broken, []);
});
