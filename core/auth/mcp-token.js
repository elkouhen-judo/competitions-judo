const crypto = require("node:crypto");

function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signHmac(unsignedToken, secret) {
  return crypto.createHmac("sha256", secret).update(unsignedToken).digest("base64url");
}

function createMcpTokenAuth({ getSecret, getIssuer, getAudience, getTtlSeconds }) {
  function signToken(claims) {
    const secret = getSecret();
    if (!secret) {
      throw new Error("Secret MCP manquant.");
    }

    const now = Math.floor(Date.now() / 1e3);
    const header = { alg: "HS256", typ: "JWT" };
    const payload = {
      ...claims,
      iss: getIssuer(),
      aud: getAudience(),
      iat: now,
      exp: now + getTtlSeconds()
    };
    const unsignedToken = `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(
      JSON.stringify(payload)
    )}`;
    const signature = signHmac(unsignedToken, secret);

    return `${unsignedToken}.${signature}`;
  }

  function verifyToken(token) {
    const secret = getSecret();
    if (!secret) {
      throw new Error("Secret MCP manquant.");
    }

    const [headerPart, payloadPart, signaturePart] = String(token || "").split(".");
    if (!headerPart || !payloadPart || !signaturePart) {
      throw new Error("Token MCP invalide.");
    }

    const unsignedToken = `${headerPart}.${payloadPart}`;
    const expectedSignature = signHmac(unsignedToken, secret);
    const expectedBuffer = Buffer.from(expectedSignature);
    const actualBuffer = Buffer.from(signaturePart);
    const signatureMatches =
      expectedBuffer.length === actualBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    if (!signatureMatches) {
      throw new Error("Token MCP invalide.");
    }

    const payload = JSON.parse(decodeBase64Url(payloadPart));
    const now = Math.floor(Date.now() / 1e3);
    if (payload.iss !== getIssuer() || payload.aud !== getAudience() || payload.exp <= now) {
      throw new Error("Token MCP invalide.");
    }

    return payload;
  }

  return {
    signToken,
    verifyToken
  };
}

function sha256Base64Url(value) {
  return crypto.createHash("sha256").update(value).digest("base64url");
}

module.exports = {
  createMcpTokenAuth,
  sha256Base64Url
};
