const fs = require("node:fs");
const path = require("node:path");

const CANONICAL_PRODUCTION_APP_URL = "https://competitions-judo.vercel.app";

function escapeScriptString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/</g, "\\u003c");
}

function readRequestHost(req) {
  return String(req.headers.host || "").trim();
}

function readRequestProtocol(req) {
  return String(req.headers["x-forwarded-proto"] || "https").trim();
}

function isLocalHost(host) {
  return host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]");
}

function isVercelDeploymentHost(host) {
  return host.endsWith(".vercel.app");
}

const VIEW_PARTIAL_FILES = {
  header: "header.html",
  toasts: "toasts.html",
  login: "login.html",
  home: "home.html",
  judoka: "judoka.html",
  admins: "admins.html",
  "coach-dashboard": "coach-dashboard.html",
  competition: "competition.html",
  "club-competition-detail": "club-competition-detail.html",
  "club-competition-form": "club-competition-form.html",
  "competition-form": "competition-form.html",
  "competition-finalization": "competition-finalization.html",
  "combat-form": "combat-form.html"
};

function readViewPartial(name) {
  const viewsDir = path.join(process.cwd(), "assets", "views");
  return fs.readFileSync(path.join(viewsDir, VIEW_PARTIAL_FILES[name]), "utf8");
}

function renderIndexHtml() {
  const htmlPath = path.join(process.cwd(), "Index.html");
  let html = fs.readFileSync(htmlPath, "utf8");
  for (const name of Object.keys(VIEW_PARTIAL_FILES)) {
    html = html.replace(`<!-- view:${name} -->`, readViewPartial(name).trimEnd());
  }

  return html;
}

function getRuntimeAppUrl(req) {
  const host = readRequestHost(req);
  const protocol = readRequestProtocol(req);
  const requestOrigin = host ? `${protocol}://${host}` : "";
  if (isLocalHost(host)) {
    return requestOrigin;
  }

  const configuredUrl = String(process.env.PUBLIC_APP_URL || process.env.APP_URL || "").trim();
  if (configuredUrl) {
    return configuredUrl;
  }

  const productionHost = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || "").trim();
  if (productionHost) {
    return `https://${productionHost}`;
  }

  if (isVercelDeploymentHost(host)) {
    return CANONICAL_PRODUCTION_APP_URL;
  }

  return requestOrigin;
}

function getCanonicalRedirectUrl(req) {
  const appUrl = getRuntimeAppUrl(req);
  if (!appUrl) {
    return "";
  }

  const canonical = new URL(appUrl);
  const requestHost = readRequestHost(req);
  if (!requestHost || requestHost === canonical.host) {
    return "";
  }

  const requestPath = String(req.url || "/").trim() || "/";
  return new URL(requestPath, canonical).toString();
}

function handler(req, res) {
  const redirectUrl = getCanonicalRedirectUrl(req);
  if (redirectUrl) {
    res.redirect(308, redirectUrl);
    return;
  }

  const html = renderIndexHtml();
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
}

module.exports = handler;
module.exports.renderIndexHtml = renderIndexHtml;
module.exports.__internal = {
  CANONICAL_PRODUCTION_APP_URL,
  getCanonicalRedirectUrl,
  getRuntimeAppUrl,
  isLocalHost,
  isVercelDeploymentHost
};
