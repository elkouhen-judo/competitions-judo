const test = require("node:test");
const assert = require("node:assert/strict");
const { createMcpTokenAuth, sha256Base64Url } = require("../core/auth/mcp-token");
const createMcpAuthService = require("../core/services/mcp-auth.service.js");
const permissions = require("../core/auth/permissions.js");

test("mcp token auth signs and verifies a short-lived token", () => {
  const auth = createMcpTokenAuth({
    getSecret: () => "test-secret",
    getIssuer: () => "kiroku",
    getAudience: () => "kiroku-mcp",
    getTtlSeconds: () => 900
  });

  const token = auth.signToken({
    sub: "judoka_1",
    email: "coach@example.com",
    role: "COACH",
    scopes: ["competitions:read"]
  });

  const claims = auth.verifyToken(token);
  assert.equal(claims.sub, "judoka_1");
  assert.equal(claims.email, "coach@example.com");
  assert.equal(claims.role, "COACH");
  assert.deepEqual(claims.scopes, ["competitions:read"]);
});

test("mcp token auth signs arbitrary claim shapes (authorization codes, client registrations)", () => {
  const auth = createMcpTokenAuth({
    getSecret: () => "test-secret",
    getIssuer: () => "kiroku",
    getAudience: () => "kiroku-mcp-client",
    getTtlSeconds: () => 60
  });

  const token = auth.signToken({ redirectUris: ["https://client.example/callback"], clientName: "Test client" });
  const claims = auth.verifyToken(token);
  assert.deepEqual(claims.redirectUris, ["https://client.example/callback"]);
  assert.equal(claims.clientName, "Test client");
});

test("mcp token auth rejects tokens signed with another secret", () => {
  const authA = createMcpTokenAuth({
    getSecret: () => "secret-a",
    getIssuer: () => "kiroku",
    getAudience: () => "kiroku-mcp",
    getTtlSeconds: () => 900
  });
  const authB = createMcpTokenAuth({
    getSecret: () => "secret-b",
    getIssuer: () => "kiroku",
    getAudience: () => "kiroku-mcp",
    getTtlSeconds: () => 900
  });

  const token = authA.signToken({
    sub: "judoka_1",
    email: "coach@example.com",
    role: "COACH",
    scopes: ["competitions:read"]
  });

  assert.throws(() => authB.verifyToken(token), /Token MCP invalide/);
});

test("mcp token auth rejects tokens minted for another audience", () => {
  const accessAuth = createMcpTokenAuth({
    getSecret: () => "test-secret",
    getIssuer: () => "kiroku",
    getAudience: () => "kiroku-mcp",
    getTtlSeconds: () => 900
  });
  const codeAuth = createMcpTokenAuth({
    getSecret: () => "test-secret",
    getIssuer: () => "kiroku",
    getAudience: () => "kiroku-mcp-code",
    getTtlSeconds: () => 120
  });

  const accessToken = accessAuth.signToken({ sub: "judoka_1" });
  assert.throws(() => codeAuth.verifyToken(accessToken), /Token MCP invalide/);
});

test("sha256Base64Url computes the PKCE S256 code challenge from a verifier", () => {
  const challenge = sha256Base64Url("test-code-verifier");
  assert.equal(typeof challenge, "string");
  assert.ok(challenge.length > 0);
  assert.equal(sha256Base64Url("test-code-verifier"), challenge);
  assert.notEqual(sha256Base64Url("another-verifier"), challenge);
});

test("mcp auth service allows coaches to mint read/write sports scopes", async () => {
  const service = createMcpAuthService({
    userContextService: {
      async getCurrentUser() {
        return { judokaId: "judoka_1", email: "coach@example.com", role: "COACH" };
      }
    },
    isCoach: (user) => user.accessRole === "COACH",
    isAdmin: (user) => user.accessRole === "ADMIN",
    signMcpToken: (claims) => claims,
    signAuthorizationCode: (claims) => claims
  });

  const result = await service.issueTokenForUser("coach@example.com");
  assert.equal(result.email, "coach@example.com");
  assert.equal(result.role, "COACH");
  assert.deepEqual(result.scopes, [
    "judokas:read",
    "competitions:read",
    "competitions:write",
    "combats:read",
    "combats:write",
    "coach-dashboard:read"
  ]);
});

test("mcp auth service grants admins access-governance scopes without sports scopes", async () => {
  const service = createMcpAuthService({
    userContextService: {
      async getCurrentUser() {
        return { judokaId: "judoka_3", email: "admin@example.com", role: "ADMIN" };
      }
    },
    isCoach: () => false,
    isAdmin: (user) => user.accessRole === "ADMIN",
    signMcpToken: (claims) => claims,
    signAuthorizationCode: (claims) => claims
  });

  const result = await service.issueTokenForUser("admin@example.com");
  assert.equal(result.email, "admin@example.com");
  assert.equal(result.role, "ADMIN");
  assert.deepEqual(result.scopes, ["access:read"]);
});

test("mcp auth service grants parents a scoped read/write subset limited to their own perimeter", async () => {
  const service = createMcpAuthService({
    userContextService: {
      async getCurrentUser() {
        return { judokaId: "judoka_2", email: "parent@example.com", role: "PARENT" };
      }
    },
    isCoach: () => false,
    isAdmin: () => false,
    signMcpToken: (claims) => claims,
    signAuthorizationCode: (claims) => claims
  });

  const result = await service.issueTokenForUser("parent@example.com");
  assert.equal(result.email, "parent@example.com");
  assert.deepEqual(result.scopes, [
    "judokas:read",
    "competitions:read",
    "competitions:write",
    "combats:read",
    "combats:write"
  ]);
});

test("mcp auth service issues an authorization code carrying client/redirect/PKCE binding for coaches", async () => {
  const service = createMcpAuthService({
    userContextService: {
      async getCurrentUser() {
        return { judokaId: "judoka_1", email: "coach@example.com", role: "COACH" };
      }
    },
    isCoach: (user) => user.accessRole === "COACH",
    isAdmin: (user) => user.accessRole === "ADMIN",
    signMcpToken: (claims) => claims,
    signAuthorizationCode: (claims) => claims
  });

  const result = await service.issueAuthorizationCode({
    email: "coach@example.com",
    clientId: "client-123",
    redirectUri: "https://client.example/callback",
    codeChallenge: "challenge-value"
  });

  assert.equal(result.email, "coach@example.com");
  assert.equal(result.role, "COACH");
  assert.equal(result.clientId, "client-123");
  assert.equal(result.redirectUri, "https://client.example/callback");
  assert.equal(result.codeChallenge, "challenge-value");
  assert.deepEqual(result.scopes, [
    "judokas:read",
    "competitions:read",
    "competitions:write",
    "combats:read",
    "combats:write",
    "coach-dashboard:read"
  ]);
});

test("mcp auth service recognizes a coach from a raw repository row (role, not accessRole) using the real permission policy", async () => {
  const service = createMcpAuthService({
    userContextService: {
      async getCurrentUser() {
        // Raw judokas-table row shape: snake_case `role`, not the canonical `accessRole`.
        return { id_judoka: "judoka_1", email: "coach@example.com", role: "coach" };
      }
    },
    isCoach: permissions.isCoach,
    isAdmin: permissions.isAdmin,
    signMcpToken: (claims) => claims,
    signAuthorizationCode: (claims) => claims
  });

  const result = await service.issueTokenForUser("coach@example.com");
  assert.equal(result.email, "coach@example.com");
  assert.equal(result.role, "COACH");
  assert.ok(result.scopes.includes("judokas:read"));
});

test("mcp auth service issues an authorization code with the scoped subset for parents", async () => {
  const service = createMcpAuthService({
    userContextService: {
      async getCurrentUser() {
        return { judokaId: "judoka_2", email: "parent@example.com", role: "PARENT" };
      }
    },
    isCoach: () => false,
    isAdmin: () => false,
    signMcpToken: (claims) => claims,
    signAuthorizationCode: (claims) => claims
  });

  const result = await service.issueAuthorizationCode({
    email: "parent@example.com",
    clientId: "client-123",
    redirectUri: "https://client.example/callback",
    codeChallenge: "challenge-value"
  });

  assert.equal(result.email, "parent@example.com");
  assert.deepEqual(result.scopes, [
    "judokas:read",
    "competitions:read",
    "competitions:write",
    "combats:read",
    "combats:write"
  ]);
});
