(() => {
  type RuntimeConfig = import("./types").RuntimeConfig;
  type SessionLike = import("./types").SessionLike;

  interface SupabaseAuthResponse {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  }

  const sessionStorageKey = "kiroku_supabase_session";

  function createKirokuAuth({
    runtimeConfig,
    onInvitationRequired,
    onError
  }: {
    runtimeConfig: RuntimeConfig;
    onInvitationRequired: () => void;
    onError: (error: unknown) => void;
  }) {
    function getResponsePreview(body: unknown) {
      return String(body || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 160);
    }

    async function readJsonResponse(
      response: Response,
      invalidMessage: string
    ): Promise<SupabaseAuthResponse | null> {
      const body = await response.text();
      if (!body) {
        return null;
      }

      try {
        return JSON.parse(body) as SupabaseAuthResponse;
      } catch (_error) {
        const preview = getResponsePreview(body);
        throw new Error(preview ? `${invalidMessage} ${preview}` : invalidMessage);
      }
    }

    function readVercelSession(): SessionLike | null {
      try {
        return JSON.parse(localStorage.getItem(sessionStorageKey) || "null") as SessionLike | null;
      } catch (_error) {
        return null;
      }
    }

    function saveVercelSession(session: SessionLike) {
      localStorage.setItem(sessionStorageKey, JSON.stringify(session));
    }

    function clearVercelSession() {
      localStorage.removeItem(sessionStorageKey);
    }

    function hasLocalVercelSession() {
      const session = readVercelSession();
      return Boolean(session && session.access_token);
    }

    function getVercelAuthRedirectUrl() {
      const baseUrl = runtimeConfig.appUrl || window.location.origin;
      return new URL(window.location.pathname || "/", baseUrl).toString();
    }

    function wait(delayMs: number) {
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

    async function exchangeVercelAuthCode(authCode: string) {
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

      const session = await readJsonResponse(
        response,
        "Connexion Google impossible : réponse Supabase invalide."
      );
      if (!session || !session.access_token) {
        throw new Error("Connexion Google impossible : session Supabase incomplète.");
      }
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

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return session;
      }

      if (!session.refresh_token) {
        clearVercelSession();
        return null;
      }

      let response: Response;
      try {
        response = await fetch(
          `${runtimeConfig.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
          {
            method: "POST",
            headers: getSupabaseAnonymousAuthHeaders(),
            body: JSON.stringify({ refresh_token: session.refresh_token })
          }
        );
      } catch (error) {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          return session;
        }

        throw error;
      }

      if (!response.ok) {
        clearVercelSession();
        return null;
      }

      const refreshed = await readJsonResponse(
        response,
        "Connexion Google impossible : réponse Supabase invalide."
      );
      if (!refreshed || !refreshed.access_token) {
        throw new Error("Connexion Google impossible : session Supabase incomplète.");
      }
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
        apikey: runtimeConfig.supabaseAnonKey || "",
        Authorization: "Bearer " + runtimeConfig.supabaseAnonKey,
        "Content-Type": "application/json"
      };
    }

    async function waitForSupabaseSessionReadiness(accessToken: string) {
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

    async function readSupabaseAuthError(response: Response): Promise<string> {
      const body = await response.text();
      if (!body) {
        return "";
      }

      try {
        const payload = JSON.parse(body) as {
          msg?: string;
          message?: string;
          error_description?: string;
          error?: string;
        };
        return payload.msg || payload.message || payload.error_description || payload.error || "";
      } catch (_error) {
        return getResponsePreview(body);
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
      hasLocalVercelSession,
      logoutSupabaseSession,
      parseVercelAuthCallback,
      startGoogleLogin
    };
  }

  window.createKirokuAuth = createKirokuAuth;
})();
