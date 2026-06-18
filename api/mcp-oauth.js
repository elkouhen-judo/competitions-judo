const {
  mcpAuthService,
  signMcpClient,
  verifyMcpClient,
  verifySupabaseUser,
  verifyMcpAuthorizationCode,
  signMcpToken,
  getMcpTokenTtlSeconds,
  sha256Base64Url
} = require("./_core");
const { getRuntimeAppUrl } = require("./app.js").__internal;
const { readRawBody } = require("./_read-body");

const MCP_SCOPES = ["judokas:read", "competitions:read", "competitions:write", "combats:read", "combats:write"];

function getPathname(req) {
  return new URL(req.url, "http://localhost").pathname;
}

// --- /.well-known/oauth-protected-resource ---

function handleProtectedResourceMetadata(req, res) {
  const origin = getRuntimeAppUrl(req);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).json({
    resource: `${origin}/mcp`,
    authorization_servers: [origin]
  });
}

// --- /.well-known/oauth-authorization-server ---

function handleAuthorizationServerMetadata(req, res) {
  const origin = getRuntimeAppUrl(req);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).json({
    issuer: origin,
    authorization_endpoint: `${origin}/mcp/authorize`,
    token_endpoint: `${origin}/mcp/token`,
    registration_endpoint: `${origin}/mcp/register`,
    scopes_supported: MCP_SCOPES,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"]
  });
}

// --- /mcp/register (Dynamic Client Registration, RFC 7591) ---

function isLoopbackHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname === "::1";
}

function isAllowedRedirectUri(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:") {
      return true;
    }
    return url.protocol === "http:" && isLoopbackHost(url.hostname);
  } catch (_error) {
    return false;
  }
}

async function handleRegister(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "invalid_request", error_description: "Méthode non autorisée." });
    return;
  }

  let payload;
  try {
    const raw = await readRawBody(req);
    payload = raw ? JSON.parse(raw) : {};
  } catch (_error) {
    res.status(400).json({ error: "invalid_request", error_description: "Corps JSON invalide." });
    return;
  }

  const redirectUris = Array.isArray(payload.redirect_uris) ? payload.redirect_uris : [];
  if (redirectUris.length === 0 || !redirectUris.every(isAllowedRedirectUri)) {
    res.status(400).json({
      error: "invalid_redirect_uri",
      error_description: "redirect_uris doit contenir au moins une URI https (ou loopback http)."
    });
    return;
  }

  const clientName = String(payload.client_name || "Client MCP");
  const clientId = signMcpClient({ redirectUris, clientName });

  res.status(201).json({
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1e3),
    redirect_uris: redirectUris,
    client_name: clientName,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code"],
    response_types: ["code"]
  });
}

// --- /mcp/authorize (browser-facing consent screen) ---

function escapeScriptString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/</g, "\\u003c");
}

function renderErrorPage(res, statusCode, message) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(statusCode).send(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Accès MCP</title></head>
<body><p>${escapeScriptString(message)}</p></body></html>`);
}

const MCP_AUTHORIZE_CLIENT_SCRIPT = `(function () {
  var STORAGE_KEY = "kiroku_supabase_session";
  var config = window.KIROKU_RUNTIME_CONFIG;
  var oauth = window.KIROKU_MCP_OAUTH_REQUEST;
  var statusEl = document.getElementById("mcp-authorize-status");
  var consentEl = document.getElementById("mcp-authorize-consent");
  var identityEl = document.getElementById("mcp-authorize-identity");

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function readSession() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (_error) {
      return null;
    }
  }

  function saveSession(session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  function denyAndReturn(error) {
    var url = new URL(oauth.redirectUri);
    url.searchParams.set("error", "access_denied");
    if (error) url.searchParams.set("error_description", error);
    if (oauth.state) url.searchParams.set("state", oauth.state);
    window.location.href = url.toString();
  }

  function startGoogleLogin() {
    var authorizeUrl = new URL(config.supabaseUrl + "/auth/v1/authorize");
    authorizeUrl.searchParams.set("provider", "google");
    authorizeUrl.searchParams.set("redirect_to", oauth.authorizeUrl + window.location.search);
    window.location.href = authorizeUrl.toString();
  }

  function parseHashSession() {
    if (!window.location.hash) return null;
    var params = new URLSearchParams(window.location.hash.slice(1));
    var accessToken = params.get("access_token");
    if (!accessToken) return null;
    var session = {
      access_token: accessToken,
      refresh_token: params.get("refresh_token") || "",
      expires_at: Math.floor(Date.now() / 1000) + Number(params.get("expires_in") || "3600")
    };
    history.replaceState(null, document.title, window.location.pathname + window.location.search);
    return session;
  }

  function showConsent(email, role) {
    setStatus("");
    identityEl.textContent = "Connecté comme " + email + " (" + role + ").";
    consentEl.style.display = "block";
  }

  document.getElementById("mcp-authorize-deny").addEventListener("click", function () {
    denyAndReturn("L'utilisateur a refusé l'accès.");
  });

  document.getElementById("mcp-authorize-allow").addEventListener("click", function () {
    setStatus("Autorisation en cours…");
    var session = readSession();
    fetch("/mcp/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify({
        client_id: oauth.clientId,
        redirect_uri: oauth.redirectUri,
        code_challenge: oauth.codeChallenge
      })
    })
      .then(function (response) {
        return response.json().then(function (body) {
          return { ok: response.ok, body: body };
        });
      })
      .then(function (result) {
        if (!result.ok) {
          denyAndReturn(result.body.error_description || "Accès MCP refusé.");
          return;
        }
        var url = new URL(oauth.redirectUri);
        url.searchParams.set("code", result.body.code);
        if (oauth.state) url.searchParams.set("state", oauth.state);
        window.location.href = url.toString();
      })
      .catch(function (error) {
        denyAndReturn(error.message || "Erreur réseau.");
      });
  });

  var hashSession = parseHashSession();
  if (hashSession) {
    saveSession(hashSession);
  }

  var session = readSession();
  if (!session || !session.access_token) {
    setStatus("Redirection vers la connexion Google…");
    startGoogleLogin();
    return;
  }

  fetch(config.supabaseUrl + "/auth/v1/user", {
    headers: { apikey: config.supabaseAnonKey, Authorization: "Bearer " + session.access_token }
  })
    .then(function (response) {
      if (!response.ok) {
        localStorage.removeItem(STORAGE_KEY);
        setStatus("Redirection vers la connexion Google…");
        startGoogleLogin();
        return null;
      }
      return response.json();
    })
    .then(function (user) {
      if (!user) return;
      showConsent(user.email, oauth.scope || "coach/admin");
    })
    .catch(function (error) {
      setStatus("Erreur de connexion : " + error.message);
    });
})();`;

function renderAuthorizePage(res, { runtimeConfig, oauthRequest }) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Autoriser un client MCP — Kiroku</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
  <main style="max-width:480px;margin:48px auto;font-family:system-ui,sans-serif;padding:0 16px;">
    <h1>Accès MCP Kiroku</h1>
    <div id="mcp-authorize-status">Vérification de la session…</div>
    <div id="mcp-authorize-consent" style="display:none;">
      <p id="mcp-authorize-identity"></p>
      <p>Ce client souhaite accéder à votre compte Kiroku (lecture/écriture des compétitions et combats que vous gérez).</p>
      <button id="mcp-authorize-allow" type="button">Autoriser</button>
      <button id="mcp-authorize-deny" type="button">Annuler</button>
    </div>
  </main>
  <script>
    window.KIROKU_RUNTIME_CONFIG = {
      supabaseUrl: ${JSON.stringify(escapeScriptString(runtimeConfig.supabaseUrl))},
      supabaseAnonKey: ${JSON.stringify(escapeScriptString(runtimeConfig.supabaseAnonKey))}
    };
    window.KIROKU_MCP_OAUTH_REQUEST = ${escapeScriptString(JSON.stringify(oauthRequest))};
  </script>
  <script>${MCP_AUTHORIZE_CLIENT_SCRIPT}</script>
</body>
</html>`);
}

async function handleAuthorizeGet(req, res) {
  const params = new URL(req.url, "http://localhost").searchParams;
  const clientId = params.get("client_id") || "";
  const redirectUri = params.get("redirect_uri") || "";
  const responseType = params.get("response_type") || "";
  const codeChallenge = params.get("code_challenge") || "";
  const codeChallengeMethod = params.get("code_challenge_method") || "";
  const state = params.get("state") || "";
  const scope = params.get("scope") || "";

  if (responseType !== "code") {
    renderErrorPage(res, 400, "response_type non supporté (seul 'code' est accepté).");
    return;
  }
  if (codeChallengeMethod !== "S256" || !codeChallenge) {
    renderErrorPage(res, 400, "PKCE S256 est requis (code_challenge_method doit être 'S256').");
    return;
  }

  let client;
  try {
    client = verifyMcpClient(clientId);
  } catch (_error) {
    renderErrorPage(res, 400, "client_id MCP invalide ou expiré.");
    return;
  }

  if (!Array.isArray(client.redirectUris) || !client.redirectUris.includes(redirectUri)) {
    renderErrorPage(res, 400, "redirect_uri non enregistrée pour ce client MCP.");
    return;
  }

  renderAuthorizePage(res, {
    runtimeConfig: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY
    },
    oauthRequest: {
      authorizeUrl: getRuntimeAppUrl(req) + "/mcp/authorize",
      clientId,
      redirectUri,
      state,
      codeChallenge,
      codeChallengeMethod,
      scope
    }
  });
}

async function handleAuthorizePost(req, res) {
  let payload;
  try {
    const raw = await readRawBody(req);
    payload = raw ? JSON.parse(raw) : {};
  } catch (_error) {
    res.status(400).json({ error: "invalid_request", error_description: "Corps JSON invalide." });
    return;
  }

  const authorization = req.headers.authorization || "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const clientId = String(payload.client_id || "");
  const redirectUri = String(payload.redirect_uri || "");
  const codeChallenge = String(payload.code_challenge || "");

  let client;
  try {
    client = verifyMcpClient(clientId);
  } catch (_error) {
    res.status(400).json({ error: "invalid_client", error_description: "client_id MCP invalide ou expiré." });
    return;
  }
  if (!Array.isArray(client.redirectUris) || !client.redirectUris.includes(redirectUri)) {
    res
      .status(400)
      .json({ error: "invalid_request", error_description: "redirect_uri non enregistrée pour ce client MCP." });
    return;
  }

  try {
    const email = await verifySupabaseUser(accessToken);
    const code = await mcpAuthService.issueAuthorizationCode({ email, clientId, redirectUri, codeChallenge });
    res.status(200).json({ code });
  } catch (error) {
    res.status(403).json({ error: "access_denied", error_description: error.message || "Accès refusé." });
  }
}

async function handleAuthorize(req, res) {
  if (req.method === "GET") {
    await handleAuthorizeGet(req, res);
    return;
  }
  if (req.method === "POST") {
    await handleAuthorizePost(req, res);
    return;
  }
  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ error: "invalid_request", error_description: "Méthode non autorisée." });
}

// --- /mcp/token (OAuth token endpoint) ---

function sendOAuthError(res, statusCode, error, errorDescription) {
  res.status(statusCode).json({ error, error_description: errorDescription });
}

async function readTokenRequestParams(req) {
  const raw = await readRawBody(req);
  const contentType = String(req.headers["content-type"] || "");
  if (contentType.includes("application/json")) {
    return raw ? JSON.parse(raw) : {};
  }
  const params = new URLSearchParams(raw);
  return Object.fromEntries(params.entries());
}

async function handleToken(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendOAuthError(res, 405, "invalid_request", "Méthode non autorisée.");
    return;
  }

  let params;
  try {
    params = await readTokenRequestParams(req);
  } catch (_error) {
    sendOAuthError(res, 400, "invalid_request", "Corps de requête invalide.");
    return;
  }

  if (params.grant_type !== "authorization_code") {
    sendOAuthError(res, 400, "unsupported_grant_type", "Seul authorization_code est supporté.");
    return;
  }

  const code = String(params.code || "");
  const codeVerifier = String(params.code_verifier || "");
  const redirectUri = String(params.redirect_uri || "");
  const clientId = String(params.client_id || "");

  let claims;
  try {
    claims = verifyMcpAuthorizationCode(code);
  } catch (_error) {
    sendOAuthError(res, 400, "invalid_grant", "Code d'autorisation invalide ou expiré.");
    return;
  }

  if (claims.redirectUri !== redirectUri || claims.clientId !== clientId) {
    sendOAuthError(res, 400, "invalid_grant", "redirect_uri ou client_id ne correspond pas au code.");
    return;
  }

  if (!codeVerifier || sha256Base64Url(codeVerifier) !== claims.codeChallenge) {
    sendOAuthError(res, 400, "invalid_grant", "code_verifier PKCE invalide.");
    return;
  }

  const accessToken = signMcpToken({
    sub: claims.email,
    email: claims.email,
    role: claims.role,
    scopes: claims.scopes
  });

  res.status(200).json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: getMcpTokenTtlSeconds(),
    scope: claims.scopes.join(" ")
  });
}

// --- top-level dispatch ---

module.exports = async function handler(req, res) {
  const pathname = getPathname(req);

  if (pathname === "/.well-known/oauth-protected-resource") {
    handleProtectedResourceMetadata(req, res);
    return;
  }
  if (pathname === "/.well-known/oauth-authorization-server") {
    handleAuthorizationServerMetadata(req, res);
    return;
  }
  if (pathname === "/mcp/register") {
    await handleRegister(req, res);
    return;
  }
  if (pathname === "/mcp/authorize") {
    await handleAuthorize(req, res);
    return;
  }
  if (pathname === "/mcp/token") {
    await handleToken(req, res);
    return;
  }

  res.status(404).json({ error: "not_found", error_description: "Route MCP OAuth inconnue." });
};
