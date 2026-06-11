function createSessionAuth({ getSupabaseConfig }) {
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

    const authUser = body ? JSON.parse(body) : {};
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
