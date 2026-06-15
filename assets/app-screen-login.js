(() => {
  function createKirokuLoginScreen(app) {
    const {
      runtimeConfig,
      auth,
      applyInitialData,
      runServer,
      screens,
      ui,
      notifications
    } = app;
    const {
      showView
    } = ui;
    const {
      clearMessage,
      showError,
      showSuccess
    } = notifications;
    const {
      clearVercelSession,
      parseVercelAuthCallback
    } = auth;
    const defaultLoginState = {
      text: "Connectez-vous avec le compte Google associé à votre fiche judoka ou enfant.",
      hint: "",
      showHint: false,
      showOAuth: false,
      showRegistration: false,
      registration: {
        firstName: "",
        lastName: ""
      }
    };
    let loginViewModel = null;

    function startGoogleLogin() {
      clearMessage();
      auth.startGoogleLogin();
    }

    function submitProfileRegistration() {
      clearMessage();

      const profile = {
        firstName: loginViewModel ? loginViewModel.registration.firstName : "",
        lastName: loginViewModel ? loginViewModel.registration.lastName : ""
      };

      runServer(
        "registerProfile",
        [profile],
        response => {
          showSuccess(response.message);
          init();
        },
        showError
      );
    }

    function showVercelLogin() {
      showLoginState({
        text: "Connectez-vous avec le compte Google associé à votre fiche judoka ou enfant. Les droits sont ensuite appliqués à partir du profil judoka correspondant.",
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
        text: "Votre invitation est validée. Créez maintenant votre profil judoka.",
        hint: "Si vous avez déjà une fiche enfant, un parent doit d'abord y renseigner cet email au lieu de créer un nouveau profil.",
        showHint: true,
        showOAuth: false,
        showRegistration: true
      });
    }

    function showLoginState({ text, hint, showHint, showOAuth, showRegistration }) {
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
        startGoogleLogin,
        submitProfileRegistration
      });
    }

    async function init() {
      if (!runtimeConfig.supabaseUrl || !runtimeConfig.supabaseAnonKey) {
        showError({ message: "Configuration Vercel manquante : SUPABASE_URL et SUPABASE_ANON_KEY sont obligatoires." });
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

      app.runServerWithOptions(
        "getInitialData",
        [],
        data => {
          if (!data) {
            showError({ message: "getInitialData() a renvoyé null." });
            return;
          }

          if (data.error) {
            showError({ message: data.error });
            return;
          }

          applyInitialData(data);
          screens.home.showHome();
        },
        showError,
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
