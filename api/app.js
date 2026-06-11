const fs = require("node:fs");
const path = require("node:path");

function escapeScriptString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/</g, "\\u003c");
}

function getRuntimeAppUrl(req) {
  const configuredUrl = String(process.env.PUBLIC_APP_URL || process.env.APP_URL || "").trim();
  if (configuredUrl) {
    return configuredUrl;
  }

  const productionHost = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || "").trim();
  if (productionHost) {
    return `https://${productionHost}`;
  }

  const protocol = String(req.headers["x-forwarded-proto"] || "https").trim();
  const host = String(req.headers.host || "").trim();
  return host ? `${protocol}://${host}` : "";
}

function getCanonicalRedirectUrl(req) {
  const appUrl = getRuntimeAppUrl(req);
  if (!appUrl) {
    return "";
  }

  const canonical = new URL(appUrl);
  const requestHost = String(req.headers.host || "").trim();
  if (!requestHost || requestHost === canonical.host) {
    return "";
  }

  const requestPath = String(req.url || "/").trim() || "/";
  return new URL(requestPath, canonical).toString();
}

module.exports = function handler(req, res) {
  const redirectUrl = getCanonicalRedirectUrl(req);
  if (redirectUrl) {
    res.redirect(308, redirectUrl);
    return;
  }

  const htmlPath = path.join(process.cwd(), "Index.html");
  const html = fs.readFileSync(htmlPath, "utf8");
  const configScript = `<script>
    window.KIROKU_RUNTIME_CONFIG = {
      runtime: "vercel",
      appUrl: ${JSON.stringify(escapeScriptString(getRuntimeAppUrl(req)))},
      supabaseUrl: ${JSON.stringify(escapeScriptString(process.env.SUPABASE_URL))},
      supabaseAnonKey: ${JSON.stringify(escapeScriptString(process.env.SUPABASE_ANON_KEY))}
    };
  </script>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html.replace("</head>", `${configScript}\n</head>`));
};
