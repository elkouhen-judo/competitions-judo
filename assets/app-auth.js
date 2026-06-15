(() => {
  const sessionStorageKey = "kiroku_supabase_session";

  function createKirokuAuth({ runtimeConfig, onInvitationRequired, onError }) {
    function readVercelSession() {
      try {
        return JSON.parse(localStorage.getItem(sessionStorageKey) || "null");
      } catch (_error) {
        return null;
      }
    }

    function saveVercelSession(session) {
      localStorage.setItem(sessionStorageKey, JSON.stringify(session));
    }

    function clearVercelSession() {
      localStorage.removeItem(sessionStorageKey);
    }

    function getVercelAuthRedirectUrl() {
      const baseUrl = runtimeConfig.appUrl || window.location.origin;
      return new URL(window.location.pathname || "/", baseUrl).toString();
    }

    function wait(delayMs) {
      return new Promise((resolve) => window.setTimeout(resolve, delayMs));
    }

    function startGoogleLogin() {
      if (!runtimeConfig.supabaseUrl || !runtimeConfig.supabaseAnonKey) {
        onError({
          message:
            "Configuration Vercel manquante : SUPABASE_URL et SUPABASE_ANON_KEY sont obligatoires."
        });
        return;
      }

      const authorizeUrl = new URL(`${runtimeConfig.supabaseUrl}/auth/v1/authorize`);
      authorizeUrl.searchParams.set("provider", "google");
      authorizeUrl.searchParams.set("redirect_to", getVercelAuthRedirectUrl());
      window.location.href = authorizeUrl.toString();
    }

    async function parseVercelAuthCallback() {
      const hashParams = window.location.hash
        ? new URLSearchParams(window.location.hash.slice(1))
        : new URLSearchParams();
      const queryParams = window.location.search
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
      const error =
        hashParams.get("error_description") ||
        hashParams.get("error") ||
        queryParams.get("error_description") ||
        queryParams.get("error");
      if (error) {
        const normalizedError = String(error || "").toLowerCase();
        history.replaceState(null, document.title, window.location.pathname);
        clearVercelSession();
        if (normalizedError.includes("invitation") || normalizedError.includes("non autorisé")) {
          onInvitationRequired();
          return { handled: true, completedAuth: false };
        }
        onError({ message: "Connexion Google impossible : " + error });
        return { handled: true, completedAuth: false };
      }

      const params = hashParams;
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      const expiresIn = Number(params.get("expires_in") || "3600");
      const authCode = queryParams.get("code");

      if (accessToken) {
        saveVercelSession({
          access_token: accessToken,
          refresh_token: refreshToken || "",
          expires_at: Math.floor(Date.now() / 1000) + expiresIn
        });
        await waitForSupabaseSessionReadiness(accessToken);
        history.replaceState(null, document.title, window.location.pathname);
        return { handled: false, completedAuth: true };
      } else if (authCode) {
        await exchangeVercelAuthCode(authCode);
        history.replaceState(null, document.title, window.location.pathname);
        return { handled: false, completedAuth: true };
      }

      return { handled: false, completedAuth: false };
    }

    async function exchangeVercelAuthCode(authCode) {
      const response = await fetch(
        `${runtimeConfig.supabaseUrl}/auth/v1/token?grant_type=authorization_code`,
        {
          method: "POST",
          headers: getSupabaseAnonymousAuthHeaders(),
          body: JSON.stringify({
            auth_code: authCode,
            redirect_to: getVercelAuthRedirectUrl()
          })
        }
      );

      if (!response.ok) {
        const authError = await readSupabaseAuthError(response);
        throw new Error("Connexion Google impossible : " + (authError || "code OAuth invalide."));
      }

      const session = await response.json();
      saveVercelSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token || "",
        expires_at: Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600)
      });
      await waitForSupabaseSessionReadiness(session.access_token);
    }

    async function getValidVercelSession() {
      let session = readVercelSession();
      if (!session) return null;

      const expiresAt = Number(session.expires_at || 0);
      if (expiresAt && expiresAt > Math.floor(Date.now() / 1000) + 60) {
        return session;
      }

      if (!session.refresh_token) {
        clearVercelSession();
        return null;
      }

      const response = await fetch(
        `${runtimeConfig.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
        {
          method: "POST",
          headers: getSupabaseAnonymousAuthHeaders(),
          body: JSON.stringify({ refresh_token: session.refresh_token })
        }
      );

      if (!response.ok) {
        clearVercelSession();
        return null;
      }

      const refreshed = await response.json();
      session = {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token || session.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + Number(refreshed.expires_in || 3600)
      };
      saveVercelSession(session);
      return session;
    }

    function getSupabaseAnonymousAuthHeaders() {
      return {
        apikey: runtimeConfig.supabaseAnonKey,
        Authorization: "Bearer " + runtimeConfig.supabaseAnonKey,
        "Content-Type": "application/json"
      };
    }

    async function waitForSupabaseSessionReadiness(accessToken) {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const response = await fetch(`${runtimeConfig.supabaseUrl}/auth/v1/user`, {
          headers: {
            ...getSupabaseAnonymousAuthHeaders(),
            Authorization: "Bearer " + accessToken
          }
        });

        if (response.ok) {
          return;
        }

        const authError = await readSupabaseAuthError(response);
        if (attempt === 3) {
          throw new Error(
            "Connexion Google impossible : " + (authError || "session OAuth non prête.")
          );
        }

        await wait(300 * (attempt + 1));
      }
    }

    async function readSupabaseAuthError(response) {
      try {
        const payload = await response.json();
        return payload.msg || payload.message || payload.error_description || payload.error || "";
      } catch (_error) {
        return response.text();
      }
    }

    async function logoutSupabaseSession() {
      const session = readVercelSession();

      if (
        session &&
        session.access_token &&
        runtimeConfig.supabaseUrl &&
        runtimeConfig.supabaseAnonKey
      ) {
        try {
          await fetch(`${runtimeConfig.supabaseUrl}/auth/v1/logout`, {
            method: "POST",
            headers: {
              ...getSupabaseAnonymousAuthHeaders(),
              Authorization: "Bearer " + session.access_token
            }
          });
        } catch (_error) {
          // Local logout must still happen if the remote session is already invalid.
        }
      }

      clearVercelSession();
    }

    return {
      clearVercelSession,
      getValidVercelSession,
      logoutSupabaseSession,
      parseVercelAuthCallback,
      startGoogleLogin
    };
  }

  window.createKirokuAuth = createKirokuAuth;
})();
