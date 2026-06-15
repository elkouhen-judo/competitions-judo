function createSessionAuth({ getSupabaseConfig }) {
  function getResponsePreview(body) {
    return String(body || "").replace(/\s+/g, " ").trim().slice(0, 160);
  }

  function parseJsonBody(body, invalidMessage) {
    if (!body) {
      return {};
    }

    try {
      return JSON.parse(body);
    } catch (_error) {
      const preview = getResponsePreview(body);
      throw new Error(preview ? `${invalidMessage} ${preview}` : invalidMessage);
    }
  }

  async function verifySupabaseUser(accessToken) {
    if (!accessToken) {
      throw new Error("Utilisateur non identifié.");
    }

    const config = getSupabaseConfig();
    const response = await fetch(`${config.url}/auth/v1/user`, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${accessToken}`
      }
    });
    const body = await response.text();

    if (!response.ok) {
      throw new Error(`Session Supabase invalide : ${body}`);
    }

    const authUser = parseJsonBody(body, "Réponse Supabase invalide pendant la vérification de session.");
    if (!authUser.email) {
      throw new Error("Utilisateur non identifié.");
    }

    return authUser.email;
  }

  return {
    verifySupabaseUser
  };
}

module.exports = createSessionAuth;
