const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { sha256Base64Url } = require("../core/auth/mcp-token");

const corePath = require.resolve("../api/_core.js");

function loadHandler(modulePath, stubCore) {
  const resolvedPath = require.resolve(modulePath);
  delete require.cache[resolvedPath];
  if (stubCore) {
    require.cache[corePath] = {
      id: corePath,
      filename: corePath,
      loaded: true,
      exports: stubCore
    };
  } else {
    delete require.cache[corePath];
  }

  return require(resolvedPath);
}

function createRequest({ method = "GET", url = "/", headers = {}, body } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = { host: "kiroku.example", ...headers };
  process.nextTick(() => {
    if (body != null) {
      req.emit("data", body);
    }
    req.emit("end");
  });
  return req;
}

function createResponse() {
  const captured = { headers: {} };
  const res = {
    setHeader(name, value) {
      captured.headers[name] = value;
    },
    status(code) {
      captured.statusCode = code;
      return {
        json(body) {
          captured.body = body;
        },
        send(body) {
          captured.body = body;
        },
        end() {
          captured.body = undefined;
        }
      };
    }
  };
  return { res, captured };
}

test("oauth-protected-resource advertises the mcp resource and authorization server", async () => {
  const handler = loadHandler("../api/mcp-oauth.js");
  const req = createRequest({ url: "/.well-known/oauth-protected-resource" });
  const { res, captured } = createResponse();
  await handler(req, res);
  assert.equal(captured.statusCode, 200);
  assert.equal(captured.body.resource, "https://kiroku.example/mcp");
  assert.deepEqual(captured.body.authorization_servers, ["https://kiroku.example"]);
});

test("oauth-authorization-server advertises PKCE-only discovery metadata", async () => {
  const handler = loadHandler("../api/mcp-oauth.js");
  const req = createRequest({ url: "/.well-known/oauth-authorization-server" });
  const { res, captured } = createResponse();
  await handler(req, res);
  assert.equal(captured.statusCode, 200);
  assert.equal(captured.body.authorization_endpoint, "https://kiroku.example/mcp/authorize");
  assert.equal(captured.body.token_endpoint, "https://kiroku.example/mcp/token");
  assert.equal(captured.body.registration_endpoint, "https://kiroku.example/mcp/register");
  assert.deepEqual(captured.body.code_challenge_methods_supported, ["S256"]);
  assert.deepEqual(captured.body.grant_types_supported, ["authorization_code"]);
});

test("mcp-register rejects requests without valid redirect_uris", async () => {
  const handler = loadHandler("../api/mcp-oauth.js", {
    signMcpClient: () => "unused"
  });
  const req = createRequest({
    method: "POST",
    url: "/mcp/register",
    body: JSON.stringify({ redirect_uris: ["not-a-url"] })
  });
  const { res, captured } = createResponse();
  await handler(req, res);
  assert.equal(captured.statusCode, 400);
  assert.equal(captured.body.error, "invalid_redirect_uri");
});

test("mcp-register mints a client_id encoding the registered redirect_uris", async () => {
  const handler = loadHandler("../api/mcp-oauth.js", {
    signMcpClient: (claims) => `signed:${JSON.stringify(claims)}`
  });
  const req = createRequest({
    method: "POST",
    url: "/mcp/register",
    body: JSON.stringify({ redirect_uris: ["https://client.example/callback"], client_name: "Test client" })
  });
  const { res, captured } = createResponse();
  await handler(req, res);
  assert.equal(captured.statusCode, 201);
  assert.match(captured.body.client_id, /^signed:/);
  assert.deepEqual(captured.body.redirect_uris, ["https://client.example/callback"]);
  assert.equal(captured.body.token_endpoint_auth_method, "none");
});

test("mcp-authorize GET rejects an unregistered redirect_uri", async () => {
  const handler = loadHandler("../api/mcp-oauth.js", {
    verifyMcpClient: () => ({ redirectUris: ["https://client.example/callback"] })
  });
  const req = createRequest({
    url:
      "/mcp/authorize?response_type=code&code_challenge=abc&code_challenge_method=S256&client_id=client-1&redirect_uri=https://evil.example/callback"
  });
  const { res, captured } = createResponse();
  await handler(req, res);
  assert.equal(captured.statusCode, 400);
});

test("mcp-authorize GET renders the consent page for a valid request", async () => {
  const handler = loadHandler("../api/mcp-oauth.js", {
    verifyMcpClient: () => ({ redirectUris: ["https://client.example/callback"] })
  });
  const req = createRequest({
    url:
      "/mcp/authorize?response_type=code&code_challenge=abc&code_challenge_method=S256&client_id=client-1&redirect_uri=https://client.example/callback&state=xyz"
  });
  const { res, captured } = createResponse();
  await handler(req, res);
  assert.equal(captured.statusCode, 200);
  assert.match(captured.body, /Autoriser/);
});

test("mcp-authorize POST mints an authorization code for an authorized coach", async () => {
  const handler = loadHandler("../api/mcp-oauth.js", {
    verifyMcpClient: () => ({ redirectUris: ["https://client.example/callback"] }),
    verifySupabaseUser: async (token) => {
      assert.equal(token, "supabase-token");
      return "coach@example.com";
    },
    mcpAuthService: {
      async issueAuthorizationCode(params) {
        assert.equal(params.email, "coach@example.com");
        return "minted-code";
      }
    }
  });
  const req = createRequest({
    method: "POST",
    url: "/mcp/authorize",
    headers: { authorization: "Bearer supabase-token" },
    body: JSON.stringify({
      client_id: "client-1",
      redirect_uri: "https://client.example/callback",
      code_challenge: "abc"
    })
  });
  const { res, captured } = createResponse();
  await handler(req, res);
  assert.equal(captured.statusCode, 200);
  assert.deepEqual(captured.body, { code: "minted-code" });
});

test("mcp-authorize POST maps an mcpAuthService rejection to a 403 access_denied response", async () => {
  const handler = loadHandler("../api/mcp-oauth.js", {
    verifyMcpClient: () => ({ redirectUris: ["https://client.example/callback"] }),
    verifySupabaseUser: async () => "unknown@example.com",
    mcpAuthService: {
      async issueAuthorizationCode() {
        throw new Error("Utilisateur introuvable.");
      }
    }
  });
  const req = createRequest({
    method: "POST",
    url: "/mcp/authorize",
    headers: { authorization: "Bearer supabase-token" },
    body: JSON.stringify({
      client_id: "client-1",
      redirect_uri: "https://client.example/callback",
      code_challenge: "abc"
    })
  });
  const { res, captured } = createResponse();
  await handler(req, res);
  assert.equal(captured.statusCode, 403);
  assert.equal(captured.body.error, "access_denied");
});

test("mcp-token exchanges a valid authorization_code + PKCE verifier for an access token", async () => {
  const codeChallenge = sha256Base64Url("correct-verifier");
  const handler = loadHandler("../api/mcp-oauth.js", {
    verifyMcpAuthorizationCode: () => ({
      email: "coach@example.com",
      role: "COACH",
      scopes: ["competitions:read"],
      clientId: "client-1",
      redirectUri: "https://client.example/callback",
      codeChallenge
    }),
    signMcpToken: (claims) => `token:${claims.email}`,
    getMcpTokenTtlSeconds: () => 900,
    sha256Base64Url
  });
  const req = createRequest({
    method: "POST",
    url: "/mcp/token",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: "auth-code",
      code_verifier: "correct-verifier",
      redirect_uri: "https://client.example/callback",
      client_id: "client-1"
    })
  });
  const { res, captured } = createResponse();
  await handler(req, res);
  assert.equal(captured.statusCode, 200);
  assert.equal(captured.body.access_token, "token:coach@example.com");
  assert.equal(captured.body.token_type, "Bearer");
  assert.equal(captured.body.expires_in, 900);
});

test("mcp-token rejects a mismatched PKCE verifier", async () => {
  const codeChallenge = sha256Base64Url("correct-verifier");
  const handler = loadHandler("../api/mcp-oauth.js", {
    verifyMcpAuthorizationCode: () => ({
      email: "coach@example.com",
      role: "COACH",
      scopes: ["competitions:read"],
      clientId: "client-1",
      redirectUri: "https://client.example/callback",
      codeChallenge
    }),
    signMcpToken: () => "unused",
    getMcpTokenTtlSeconds: () => 900,
    sha256Base64Url
  });
  const req = createRequest({
    method: "POST",
    url: "/mcp/token",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: "auth-code",
      code_verifier: "wrong-verifier",
      redirect_uri: "https://client.example/callback",
      client_id: "client-1"
    })
  });
  const { res, captured } = createResponse();
  await handler(req, res);
  assert.equal(captured.statusCode, 400);
  assert.equal(captured.body.error, "invalid_grant");
});

test("mcp-token rejects a redirect_uri that doesn't match the authorization code", async () => {
  const codeChallenge = sha256Base64Url("correct-verifier");
  const handler = loadHandler("../api/mcp-oauth.js", {
    verifyMcpAuthorizationCode: () => ({
      email: "coach@example.com",
      role: "COACH",
      scopes: ["competitions:read"],
      clientId: "client-1",
      redirectUri: "https://client.example/callback",
      codeChallenge
    }),
    signMcpToken: () => "unused",
    getMcpTokenTtlSeconds: () => 900,
    sha256Base64Url
  });
  const req = createRequest({
    method: "POST",
    url: "/mcp/token",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body:
      "grant_type=authorization_code&code=auth-code&code_verifier=correct-verifier&redirect_uri=https://other.example/callback&client_id=client-1"
  });
  const { res, captured } = createResponse();
  await handler(req, res);
  assert.equal(captured.statusCode, 400);
  assert.equal(captured.body.error, "invalid_grant");
});

test("mcp rejects requests without a bearer token and advertises discovery via WWW-Authenticate", async () => {
  const handler = loadHandler("../api/mcp.js", {
    verifyMcpToken() {
      throw new Error("should not be called");
    },
    mcpServerService: {
      async handleRequest() {
        throw new Error("should not be called");
      }
    }
  });
  const req = createRequest({ method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }) });
  const { res, captured } = createResponse();
  await handler(req, res);
  assert.equal(captured.statusCode, 401);
  assert.match(captured.headers["WWW-Authenticate"], /oauth-protected-resource/);
});

test("mcp completes the initialize handshake for an authenticated caller", async () => {
  const handler = loadHandler("../api/mcp.js", {
    verifyMcpToken: () => ({ email: "coach@example.com", scopes: ["competitions:read"] }),
    mcpServerService: { async handleRequest() {} }
  });
  const req = createRequest({
    method: "POST",
    headers: { authorization: "Bearer mcp-token" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" })
  });
  const { res, captured } = createResponse();
  await handler(req, res);
  assert.equal(captured.statusCode, 200);
  assert.equal(captured.body.jsonrpc, "2.0");
  assert.equal(captured.body.id, 1);
  assert.ok(captured.body.result.protocolVersion);
  assert.equal(captured.body.result.serverInfo.name, "kiroku-mcp");
});

test("mcp accepts notifications with no JSON-RPC response body", async () => {
  const handler = loadHandler("../api/mcp.js", {
    verifyMcpToken: () => ({ email: "coach@example.com", scopes: [] }),
    mcpServerService: { async handleRequest() {} }
  });
  const req = createRequest({
    method: "POST",
    headers: { authorization: "Bearer mcp-token" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })
  });
  const { res, captured } = createResponse();
  await handler(req, res);
  assert.equal(captured.statusCode, 202);
});

test("mcp returns the tool registry for an authenticated caller", async () => {
  const handler = loadHandler("../api/mcp.js", {
    verifyMcpToken(token) {
      assert.equal(token, "mcp-bearer-token");
      return { sub: "judoka_1", scopes: ["competitions:read"] };
    },
    mcpServerService: {
      async handleRequest(claims, body) {
        assert.deepEqual(claims, { sub: "judoka_1", scopes: ["competitions:read"] });
        assert.equal(body.method, "tools/list");
        return {
          tools: [
            {
              name: "competitions.list",
              description: "Liste les compétitions visibles pour le coach connecté.",
              inputSchema: { type: "object", properties: {} }
            }
          ]
        };
      }
    }
  });
  const req = createRequest({
    method: "POST",
    headers: { authorization: "Bearer mcp-bearer-token" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/list" })
  });
  const { res, captured } = createResponse();
  await handler(req, res);
  assert.equal(captured.statusCode, 200);
  assert.deepEqual(captured.body, {
    jsonrpc: "2.0",
    id: 7,
    result: {
      tools: [
        {
          name: "competitions.list",
          description: "Liste les compétitions visibles pour le coach connecté.",
          inputSchema: { type: "object", properties: {} }
        }
      ]
    }
  });
});

test("mcp maps an unknown method to a JSON-RPC method-not-found error", async () => {
  const handler = loadHandler("../api/mcp.js", {
    verifyMcpToken: () => ({ email: "coach@example.com", scopes: [] }),
    mcpServerService: {
      async handleRequest() {
        throw new Error("Méthode MCP inconnue.");
      }
    }
  });
  const req = createRequest({
    method: "POST",
    headers: { authorization: "Bearer mcp-token" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "not/a/real/method" })
  });
  const { res, captured } = createResponse();
  await handler(req, res);
  assert.equal(captured.statusCode, 200);
  assert.equal(captured.body.error.code, -32601);
});
