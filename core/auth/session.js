const crypto = require("node:crypto");

const INVALID_SESSION_MESSAGE = "Session Supabase invalide.";
const JWKS_TTL_MS = 10 * 60 * 1000;
const JWKS_MIN_REFRESH_MS = 30 * 1000;
const NODE_HASH_BY_ALG = { ES256: "sha256", RS256: "RSA-SHA256" };
// Un secret partagé court se devine : un jeton HS256 n'est accepté qu'avec un secret long.
const MIN_HMAC_SECRET_LENGTH = 32;

function decodeJsonPart(part) {
  try {
    const value = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return value && typeof value === "object" ? value : null;
  } catch (_error) {
    return null;
  }
}

// AUTH-1 : la session est vérifiée dans la fonction (signature, expiration, émetteur),
// sans appel à /auth/v1/user. Une session révoquée reste valide jusqu'à l'expiration du jeton.
function createSessionAuth({ getSupabaseConfig, getJwtSecret = () => "", now = () => Date.now() }) {
  /** @type {{ url: string; keys: Record<string, unknown>[]; fetchedAt: number } | null} */
  let jwksCache = null;
  let lastForcedRefreshAt = -Infinity;

  async function loadJwks(url, forceRefresh) {
    const isFresh = jwksCache && jwksCache.url === url && now() - jwksCache.fetchedAt < JWKS_TTL_MS;
    if (jwksCache && isFresh && !forceRefresh) {
      return jwksCache.keys;
    }

    const response = await fetch(`${url}/auth/v1/.well-known/jwks.json`);
    if (!response.ok) {
      throw new Error("Clés publiques Supabase indisponibles.");
    }
    const body = await response.json();
    jwksCache = { url, keys: Array.isArray(body && body.keys) ? body.keys : [], fetchedAt: now() };
    return jwksCache.keys;
  }

  // Les clés publiques du projet sont gardées en mémoire ; elles ne sont relues que si
  // le jeton porte un identifiant de clé inconnu (rotation) ou après expiration du cache.
  async function findPublicKey(url, kid) {
    const matches = (key) => String(key.kid || "") === String(kid || "");
    let key = (await loadJwks(url, false)).find(matches);
    // Un jeton forgé avec un identifiant de clé inventé ne doit pas relancer la lecture
    // des clés à chaque appel : une relecture forcée a lieu au plus une fois par JWKS_MIN_REFRESH_MS.
    if (!key && now() - lastForcedRefreshAt >= JWKS_MIN_REFRESH_MS) {
      lastForcedRefreshAt = now();
      key = (await loadJwks(url, true)).find(matches);
    }
    return key || null;
  }

  function verifyHmacSignature(signedPart, signature, secret) {
    const expected = crypto.createHmac("sha256", secret).update(signedPart).digest();
    return expected.length === signature.length && crypto.timingSafeEqual(expected, signature);
  }

  function verifyPublicKeySignature(alg, signedPart, signature, jwk) {
    try {
      const key = crypto.createPublicKey({ key: /** @type {any} */ (jwk), format: "jwk" });
      const options =
        alg === "ES256" ? { key, dsaEncoding: /** @type {const} */ ("ieee-p1363") } : key;
      return crypto.verify(NODE_HASH_BY_ALG[alg], Buffer.from(signedPart), options, signature);
    } catch (_error) {
      return false;
    }
  }

  async function isSignatureValid(header, signedPart, signature, config) {
    if (header.alg === "HS256") {
      const secret = String(getJwtSecret() || "");
      return (
        secret.length >= MIN_HMAC_SECRET_LENGTH &&
        verifyHmacSignature(signedPart, signature, secret)
      );
    }
    if (Object.hasOwn(NODE_HASH_BY_ALG, header.alg)) {
      const jwk = await findPublicKey(config.url, header.kid);
      return Boolean(jwk) && verifyPublicKeySignature(header.alg, signedPart, signature, jwk);
    }
    return false;
  }

  async function verifySupabaseUser(accessToken) {
    if (!accessToken) {
      throw new Error("Utilisateur non identifié.");
    }

    const [headerPart, payloadPart, signaturePart, ...extraParts] = String(accessToken).split(".");
    const header = headerPart ? decodeJsonPart(headerPart) : null;
    const claims = payloadPart ? decodeJsonPart(payloadPart) : null;
    if (!header || !claims || !signaturePart || extraParts.length) {
      throw new Error(INVALID_SESSION_MESSAGE);
    }

    const config = getSupabaseConfig();
    const signature = Buffer.from(signaturePart, "base64url");
    const signedPart = `${headerPart}.${payloadPart}`;
    if (!(await isSignatureValid(header, signedPart, signature, config))) {
      throw new Error(INVALID_SESSION_MESSAGE);
    }

    const expiresAt = Number(claims.exp);
    if (!Number.isFinite(expiresAt) || expiresAt * 1000 <= now()) {
      throw new Error(INVALID_SESSION_MESSAGE);
    }
    // Un jeton signé pour un autre projet Supabase porte un autre émetteur.
    if (claims.iss !== `${config.url}/auth/v1`) {
      throw new Error(INVALID_SESSION_MESSAGE);
    }
    if (!claims.email || typeof claims.email !== "string") {
      throw new Error("Utilisateur non identifié.");
    }

    return claims.email;
  }

  return {
    verifySupabaseUser
  };
}

module.exports = createSessionAuth;
