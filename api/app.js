const fs = require("node:fs");
const path = require("node:path");

function escapeScriptString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/</g, "\\u003c");
}

module.exports = function handler(req, res) {
  const htmlPath = path.join(process.cwd(), "Index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const configScript = `<script>
    window.KIROKU_RUNTIME_CONFIG = {
      runtime: "vercel",
      supabaseUrl: ${JSON.stringify(escapeScriptString(process.env.SUPABASE_URL))},
      supabaseAnonKey: ${JSON.stringify(escapeScriptString(process.env.SUPABASE_ANON_KEY))}
    };
  </script>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html.replace("</head>", `${configScript}\n</head>`));
};
