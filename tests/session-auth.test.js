const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const createSessionAuth = require("../core/auth/session");

// AUTH-1 : la session Supabase est vérifiée dans la fonction, sans appel à /auth/v1/user.

const PROJECT_URL = "https://projet.supabase.co";
const NOW_MS = Date.parse("2026-11-12T10:00:00Z");
const NOW_SECONDS = Math.floor(NOW_MS / 1000);
const LONG_SECRET = "s".repeat(40);

function generateKey(kid) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  return {
    kid,
    privateKey,
    jwk: { ...publicKey.export({ format: "jwk" }), kid, alg: "ES256", use: "sig" }
  };
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function validClaims(overrides = {}) {
  return {
    iss: `${PROJECT_URL}/auth/v1`,
    aud: "authenticated",
    sub: "user-1",
    email: "judoka@example.com",
    iat: NOW_SECONDS - 60,
    exp: NOW_SECONDS + 3600,
    ...overrides
  };
}

function signEs256(key, claims, header = {}) {
  const signedPart = `${encode({ alg: "ES256", typ: "JWT", kid: key.kid, ...header })}.${encode(claims)}`;
  const signature = crypto.sign("sha256", Buffer.from(signedPart), {
    key: key.privateKey,
    dsaEncoding: "ieee-p1363"
  });
  return `${signedPart}.${signature.toString("base64url")}`;
}

function signHs256(secret, claims) {
  const signedPart = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}`;
  const signature = crypto.createHmac("sha256", secret).update(signedPart).digest("base64url");
  return `${signedPart}.${signature}`;
}

// Remplace global.fetch par un faux qui ne sert que le JWKS du projet et note chaque appel.
function installFetch(t, keys) {
  const originalFetch = global.fetch;
  const fetchCalls = [];
  const served = { keys };
  global.fetch = async (url) => {
    fetchCalls.push(String(url));
    if (String(url) === `${PROJECT_URL}/auth/v1/.well-known/jwks.json`) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ keys: served.keys.map((key) => key.jwk) })
      };
    }
    return { ok: false, status: 404, json: async () => ({}), text: async () => "" };
  };
  t.after(() => {
    global.fetch = originalFetch;
  });
  return { fetchCalls, served };
}

function createAuth({ secret = "", clock = { now: NOW_MS } } = {}) {
  return createSessionAuth({
    getSupabaseConfig: () => ({ url: PROJECT_URL, anonKey: "anon", serviceRoleKey: "service" }),
    getJwtSecret: () => secret,
    now: () => clock.now
  });
}

test("AUTH-1 : un jeton ES256 valide donne l'email sans aucun appel à /auth/v1/user", async (t) => {
  const key = generateKey("key-1");
  const { fetchCalls } = installFetch(t, [key]);
  const auth = createAuth();

  const email = await auth.verifySupabaseUser(signEs256(key, validClaims()));

  assert.equal(email, "judoka@example.com");
  assert.deepEqual(fetchCalls, [`${PROJECT_URL}/auth/v1/.well-known/jwks.json`]);
  assert.equal(
    fetchCalls.some((url) => url.includes("/auth/v1/user")),
    false
  );
});

test("AUTH-1 : les clés publiques ne sont lues qu'une fois pour plusieurs vérifications", async (t) => {
  const key = generateKey("key-1");
  const { fetchCalls } = installFetch(t, [key]);
  const auth = createAuth();

  for (const email of ["a@example.com", "b@example.com", "c@example.com"]) {
    assert.equal(await auth.verifySupabaseUser(signEs256(key, validClaims({ email }))), email);
  }

  assert.equal(fetchCalls.length, 1);
});

test("AUTH-1 : une clé inconnue (rotation) relit les clés publiques, puis le jeton est accepté", async (t) => {
  const oldKey = generateKey("key-1");
  const newKey = generateKey("key-2");
  const { fetchCalls, served } = installFetch(t, [oldKey]);
  const auth = createAuth();

  await auth.verifySupabaseUser(signEs256(oldKey, validClaims()));
  served.keys = [oldKey, newKey];
  const email = await auth.verifySupabaseUser(
    signEs256(newKey, validClaims({ email: "new@example.com" }))
  );

  assert.equal(email, "new@example.com");
  assert.equal(fetchCalls.length, 2);
});

test("AUTH-1 : un identifiant de clé inventé ne relit les clés publiques qu'une fois par 30 s", async (t) => {
  const key = generateKey("key-1");
  const forged = generateKey("inconnue");
  const { fetchCalls } = installFetch(t, [key]);
  const clock = { now: NOW_MS };
  const auth = createAuth({ clock });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assert.rejects(
      () => auth.verifySupabaseUser(signEs256(forged, validClaims())),
      /Session Supabase invalide/
    );
  }
  // Une lecture initiale, une seule relecture forcée.
  assert.equal(fetchCalls.length, 2);

  clock.now = NOW_MS + 30 * 1000;
  await assert.rejects(
    () => auth.verifySupabaseUser(signEs256(forged, validClaims())),
    /Session Supabase invalide/
  );
  assert.equal(fetchCalls.length, 3);
});

test("AUTH-1 : un jeton expiré est refusé", async (t) => {
  const key = generateKey("key-1");
  installFetch(t, [key]);
  const auth = createAuth();

  await assert.rejects(
    () => auth.verifySupabaseUser(signEs256(key, validClaims({ exp: NOW_SECONDS - 1 }))),
    /Session Supabase invalide/
  );
  await assert.rejects(
    () => auth.verifySupabaseUser(signEs256(key, validClaims({ exp: NOW_SECONDS }))),
    /Session Supabase invalide/
  );
  const withoutExpiry = validClaims();
  delete withoutExpiry.exp;
  await assert.rejects(
    () => auth.verifySupabaseUser(signEs256(key, withoutExpiry)),
    /Session Supabase invalide/
  );
});

test("AUTH-1 : un jeton valide cesse de l'être à son expiration", async (t) => {
  const key = generateKey("key-1");
  installFetch(t, [key]);
  const clock = { now: NOW_MS };
  const auth = createAuth({ clock });
  const token = signEs256(key, validClaims({ exp: NOW_SECONDS + 60 }));

  assert.equal(await auth.verifySupabaseUser(token), "judoka@example.com");
  clock.now = NOW_MS + 61 * 1000;
  await assert.rejects(() => auth.verifySupabaseUser(token), /Session Supabase invalide/);
});

test("AUTH-1 : un jeton falsifié (charge modifiée) est refusé", async (t) => {
  const key = generateKey("key-1");
  installFetch(t, [key]);
  const auth = createAuth();
  const [header, , signature] = signEs256(key, validClaims()).split(".");
  const forged = `${header}.${encode(validClaims({ email: "admin@example.com" }))}.${signature}`;

  await assert.rejects(() => auth.verifySupabaseUser(forged), /Session Supabase invalide/);
});

test("AUTH-1 : un jeton signé par une autre clé est refusé", async (t) => {
  const key = generateKey("key-1");
  const attackerKey = generateKey("key-1");
  const unknownKey = generateKey("key-inconnue");
  installFetch(t, [key]);
  const auth = createAuth();

  // Même identifiant de clé, mais autre clé privée.
  await assert.rejects(
    () => auth.verifySupabaseUser(signEs256(attackerKey, validClaims())),
    /Session Supabase invalide/
  );
  // Identifiant de clé absent du projet.
  await assert.rejects(
    () => auth.verifySupabaseUser(signEs256(unknownKey, validClaims())),
    /Session Supabase invalide/
  );
});

test("AUTH-1 : un jeton émis pour un autre projet Supabase est refusé", async (t) => {
  const key = generateKey("key-1");
  installFetch(t, [key]);
  const auth = createAuth();

  await assert.rejects(
    () =>
      auth.verifySupabaseUser(
        signEs256(key, validClaims({ iss: "https://autre-projet.supabase.co/auth/v1" }))
      ),
    /Session Supabase invalide/
  );
});

test("AUTH-1 : un jeton sans signature (alg none) ou mal formé est refusé", async (t) => {
  const key = generateKey("key-1");
  const { fetchCalls } = installFetch(t, [key]);
  const auth = createAuth({ secret: LONG_SECRET });
  const unsigned = `${encode({ alg: "none", typ: "JWT" })}.${encode(validClaims())}`;

  await assert.rejects(() => auth.verifySupabaseUser(`${unsigned}.`), /Session Supabase invalide/);
  await assert.rejects(
    () => auth.verifySupabaseUser(`${unsigned}.AAAA`),
    /Session Supabase invalide/
  );
  await assert.rejects(() => auth.verifySupabaseUser("pas-un-jeton"), /Session Supabase invalide/);
  await assert.rejects(() => auth.verifySupabaseUser("a.b.c"), /Session Supabase invalide/);
  await assert.rejects(
    () => auth.verifySupabaseUser(`${signEs256(key, validClaims())}.extra`),
    /Session Supabase invalide/
  );
  await assert.rejects(() => auth.verifySupabaseUser(""), /Utilisateur non identifié/);
  assert.equal(
    fetchCalls.some((url) => url.includes("/auth/v1/user")),
    false
  );
});

test("AUTH-1 : un jeton HS256 n'est accepté qu'avec un secret long", async (t) => {
  const { fetchCalls } = installFetch(t, []);
  const shortSecret = "secret-court";

  // Secret court : refusé, même si la signature correspond.
  await assert.rejects(
    () =>
      createAuth({ secret: shortSecret }).verifySupabaseUser(signHs256(shortSecret, validClaims())),
    /Session Supabase invalide/
  );
  // Aucun secret configuré : refusé.
  await assert.rejects(
    () => createAuth().verifySupabaseUser(signHs256(LONG_SECRET, validClaims())),
    /Session Supabase invalide/
  );
  // Secret long : accepté, sans aucun appel réseau.
  const auth = createAuth({ secret: LONG_SECRET });
  assert.equal(
    await auth.verifySupabaseUser(signHs256(LONG_SECRET, validClaims())),
    "judoka@example.com"
  );
  // Secret long, mais jeton signé avec un autre secret : refusé.
  await assert.rejects(
    () => auth.verifySupabaseUser(signHs256("x".repeat(40), validClaims())),
    /Session Supabase invalide/
  );
  assert.deepEqual(fetchCalls, []);
});

test("AUTH-1 : une clé publique ne sert pas de secret HS256 (confusion d'algorithme)", async (t) => {
  const key = generateKey("key-1");
  installFetch(t, [key]);
  const publicKeyAsSecret = JSON.stringify(key.jwk);

  await assert.rejects(
    () => createAuth().verifySupabaseUser(signHs256(publicKeyAsSecret, validClaims())),
    /Session Supabase invalide/
  );
});

test("AUTH-1 : un jeton valide sans email est refusé", async (t) => {
  const key = generateKey("key-1");
  installFetch(t, [key]);
  const auth = createAuth();
  const claims = validClaims();
  delete claims.email;

  await assert.rejects(
    () => auth.verifySupabaseUser(signEs256(key, claims)),
    /Utilisateur non identifié/
  );
  await assert.rejects(
    () => auth.verifySupabaseUser(signEs256(key, validClaims({ email: "" }))),
    /Utilisateur non identifié/
  );
});
