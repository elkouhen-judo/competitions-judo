(() => {
  type KirokuApp = import("./types").KirokuApp;

  function createKirokuLoginScreen(app: KirokuApp) {
    const { runtimeConfig, auth, applyInitialData, screens, ui, notifications } = app;
    const { showView } = ui;
    const { clearMessage, showError } = notifications;
    const { clearVercelSession, parseVercelAuthCallback } = auth;
    const defaultLoginState = {
      text: "Connectez-vous avec le compte Google associé à votre fiche judoka ou enfant.",
      hint: "",
      showHint: false,
      showOAuth: false,
      showRegistration: false
    };
    let loginViewModel: (typeof defaultLoginState) | null = null;

    function startGoogleLogin() {
      clearMessage();
      auth.startGoogleLogin();
    }

    function showVercelLogin() {
      showLoginState({
        text: "Connectez-vous avec le compte Google associé à votre fiche judoka ou enfant. Les droits sont ensuite appliqués à partir du profil judoka correspondant.",
        hint: "",
        showHint: false,
        showOAuth: true,
        showRegistration: false
      });
    }

    function showInvitationRequired() {
      showLoginState({
        text: "Accès non autorisé.",
        hint: "Cette adresse Google n'est pas encore invitée. Demandez à un admin de créer une invitation, ou connectez-vous avec un autre compte autorisé.",
        showHint: true,
        showOAuth: true,
        showRegistration: false
      });
    }

    function showProfileRegistration() {
      showLoginState({
        text: "Activation du profil en cours.",
        hint: "Reconnectez-vous avec le compte Google indiqué dans l'import CSV.",
        showHint: true,
        showOAuth: true,
        showRegistration: false
      });
    }

    function showLoginState({
      text,
      hint,
      showHint,
      showOAuth,
      showRegistration
    }: {
      text?: string;
      hint?: string;
      showHint?: boolean;
      showOAuth?: boolean;
      showRegistration?: boolean;
    }) {
      app.setHeaderVisible(false);
      if (loginViewModel) {
        Object.assign(loginViewModel, {
          text: text || "",
          hint: hint || "",
          showHint: Boolean(showHint),
          showOAuth: Boolean(showOAuth),
          showRegistration: Boolean(showRegistration)
        });
      }
      showView("loginView");
    }

    function bindEvents() {
      if (!window.Vue || loginViewModel) {
        return;
      }

      loginViewModel = ui.createMountedViewModel("loginView", defaultLoginState, {
        startGoogleLogin
      });
    }

    async function init() {
      if (!runtimeConfig.supabaseUrl || !runtimeConfig.supabaseAnonKey) {
        showError({
          message:
            "Configuration Vercel manquante : SUPABASE_URL et SUPABASE_ANON_KEY sont obligatoires."
        });
        showVercelLogin();
        return;
      }

      let callbackResult;
      try {
        callbackResult = await parseVercelAuthCallback();
      } catch (error) {
        clearVercelSession();
        showVercelLogin();
        showError(error);
        return;
      }

      if (callbackResult && callbackResult.handled) {
        return;
      }

      if (!app.state.isOnline && app.loadCachedInitialData()) {
        screens.home.showHome();
        return;
      }

      app.runServerWithOptions(
        "getInitialData",
        [],
        (data) => {
          if (!data) {
            showError({ message: "getInitialData() a renvoyé null." });
            return;
          }

          applyInitialData(data);
          screens.home.showHome();
        },
        (error) => {
          if (app.loadCachedInitialData()) {
            screens.home.showHome();
            return;
          }

          showError(error);
        },
        { retrySessionOnce: Boolean(callbackResult && callbackResult.completedAuth) }
      );
    }

    return {
      bindEvents,
      init,
      showInvitationRequired,
      showProfileRegistration,
      showVercelLogin,
      startGoogleLogin
    };
  }

  window.createKirokuLoginScreen = createKirokuLoginScreen;
})();
