    let currentUser = null;
    let isAdmin = false;
    let isParent = false;
    let canManageChildren = false;
    let competitions = [];
    let currentCompetition = null;
    let judokas = [];
    let currentCombats = [];
    let currentJudokaProfile = null;
    let managedAdmins = [];
    let managedAccessInvitations = [];
    let managedChildren = [];
    let canEditCurrentCompetition = false;
    let previousView = "homeView";
    let accessInvitationSearch = "";
    let accessInvitationVisibleCount = 8;
    let toastSequence = 0;
    const activeToastTimers = new Map();
    const runtimeConfig = window.KIROKU_RUNTIME_CONFIG || {};
    const sessionStorageKey = "kiroku_supabase_session";
    const defaultAccessInvitationVisibleCount = 8;
    const viewIds = [
      "loginView",
      "homeView",
      "judokaView",
      "adminsView",
      "childrenView",
      "competitionView",
      "competitionFormView",
      "competitionFinalizationView",
      "combatFormView"
    ];
    const icons = {
      edit: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
      shieldOff: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z"></path><path d="M9 9l6 6"></path><path d="M15 9l-6 6"></path></svg>`,
      trash: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`
    };

    function $(id) {
      return document.getElementById(id);
    }

    function setValue(id, value) {
      $(id).value = value || "";
    }

    function getValue(id) {
      return $(id).value;
    }

    function setText(id, value) {
      $(id).innerText = value || "";
    }

    function setTexts(valuesById) {
      Object.entries(valuesById).forEach(([id, value]) => setText(id, value));
    }

    function setValues(valuesById) {
      Object.entries(valuesById).forEach(([id, value]) => setValue(id, value));
    }

    function setHidden(id, hidden) {
      $(id).classList.toggle("hidden", hidden);
    }

    function emptyState(message) {
      return `<div class="empty-state">${escapeHtml(message)}</div>`;
    }

    async function runServer(method, args, success, failure) {
      try {
        const session = await getValidVercelSession();
        if (!session) {
          showVercelLogin();
          return;
        }

        const response = await fetch("/api/rpc", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + session.access_token,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ method, args })
        });
        const payload = await response.json();

        if (!response.ok || payload.error) {
          throw new Error(payload.error || "Erreur serveur.");
        }

        success && success(payload.result);
      } catch (error) {
        if (String(error.message || "").includes("Session Supabase invalide") || String(error.message || "").includes("Utilisateur non identifié")) {
          clearVercelSession();
          showVercelLogin();
        } else if (method === "getInitialData" && String(error.message || "").includes("Invitation trouvée")) {
          showProfileRegistration();
          return;
        } else if (method === "getInitialData" && String(error.message || "").includes("invitation est requise")) {
          clearVercelSession();
          showInvitationRequired();
          return;
        }
        failure ? failure(error) : showError(error);
      }
    }

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

    function resetApplicationState() {
      currentUser = null;
      isAdmin = false;
      isParent = false;
      canManageChildren = false;
      competitions = [];
      currentCompetition = null;
      judokas = [];
      currentCombats = [];
      currentJudokaProfile = null;
      managedAdmins = [];
      managedAccessInvitations = [];
      managedChildren = [];
      canEditCurrentCompetition = false;
      previousView = "homeView";
      accessInvitationSearch = "";
      accessInvitationVisibleCount = defaultAccessInvitationVisibleCount;
    }

    async function logoutUser() {
      clearMessage();
      const session = readVercelSession();

      if (session && session.access_token && runtimeConfig.supabaseUrl && runtimeConfig.supabaseAnonKey) {
        try {
          await fetch(`${runtimeConfig.supabaseUrl}/auth/v1/logout`, {
            method: "POST",
            headers: {
              ...getSupabaseAnonymousAuthHeaders(),
              "Authorization": "Bearer " + session.access_token
            }
          });
        } catch (_error) {
          // Local logout must still happen if the remote session is already invalid.
        }
      }

      clearVercelSession();
      resetApplicationState();
      showVercelLogin();
      showSuccess("Vous êtes déconnecté.");
    }

    function getVercelAuthRedirectUrl() {
      const baseUrl = runtimeConfig.appUrl || window.location.origin;
      return new URL(window.location.pathname || "/", baseUrl).toString();
    }

    function startGoogleLogin() {
      clearMessage();

      if (!runtimeConfig.supabaseUrl || !runtimeConfig.supabaseAnonKey) {
        showError({ message: "Configuration Vercel manquante : SUPABASE_URL et SUPABASE_ANON_KEY sont obligatoires." });
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
      const error = hashParams.get("error_description")
        || hashParams.get("error")
        || queryParams.get("error_description")
        || queryParams.get("error");
      if (error) {
        const normalizedError = String(error || "").toLowerCase();
        history.replaceState(null, document.title, window.location.pathname);
        clearVercelSession();
        if (normalizedError.includes("invitation") || normalizedError.includes("non autorisé")) {
          showInvitationRequired();
          return;
        }
        showError({ message: "Connexion Google impossible : " + error });
        return;
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
        history.replaceState(null, document.title, window.location.pathname);
      } else if (authCode) {
        await exchangeVercelAuthCode(authCode);
        history.replaceState(null, document.title, window.location.pathname);
      }
    }

    async function exchangeVercelAuthCode(authCode) {
      const response = await fetch(`${runtimeConfig.supabaseUrl}/auth/v1/token?grant_type=authorization_code`, {
        method: "POST",
        headers: getSupabaseAnonymousAuthHeaders(),
        body: JSON.stringify({
          auth_code: authCode,
          redirect_to: getVercelAuthRedirectUrl()
        })
      });

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

      const response = await fetch(`${runtimeConfig.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: getSupabaseAnonymousAuthHeaders(),
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });

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
        "apikey": runtimeConfig.supabaseAnonKey,
        "Authorization": "Bearer " + runtimeConfig.supabaseAnonKey,
        "Content-Type": "application/json"
      };
    }

    async function readSupabaseAuthError(response) {
      try {
        const payload = await response.json();
        return payload.msg || payload.message || payload.error_description || payload.error || "";
      } catch (_error) {
        return response.text();
      }
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
      document.querySelector("header").classList.add("hidden");
      setText("loginText", text);
      setText("loginHint", hint);
      setHidden("loginHint", !showHint);
      setHidden("oauthLoginOptions", !showOAuth);
      setHidden("profileRegistrationForm", !showRegistration);
      showView("loginView");
    }

    $("profileRegistrationForm").addEventListener("submit", event => {
      event.preventDefault();
      clearMessage();

      const profile = {
        firstName: getValue("registrationPrenom"),
        lastName: getValue("registrationNom")
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
    });

    async function init() {
      if (!runtimeConfig.supabaseUrl || !runtimeConfig.supabaseAnonKey) {
        showError({ message: "Configuration Vercel manquante : SUPABASE_URL et SUPABASE_ANON_KEY sont obligatoires." });
        showVercelLogin();
        return;
      }

      try {
        await parseVercelAuthCallback();
      } catch (error) {
        clearVercelSession();
        showVercelLogin();
        showError(error);
        return;
      }

      runServer(
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
          showHome();
        },
        showError
      );
    }

    function saveAccessInvitation() {
      const email = getValue("invite_email");
      const profileType = getValue("invite_profile_type");

      runServer(
        "saveAccessInvitation",
        [email, profileType],
        response => {
          showSuccess(response.message);
          reloadInitialDataAndShowAdmins();
        },
        showError
      );
    }

    function applyInitialData(data) {
      currentUser = data.user;
      isAdmin = Boolean(data.isAdmin);
      isParent = Boolean(data.isParent);
      canManageChildren = Boolean(data.canManageChildren);
      competitions = Array.isArray(data.competitions) ? data.competitions : [];
      judokas = Array.isArray(data.judokas) ? data.judokas : [];
      document.querySelector("header").classList.remove("hidden");

      const profileTypeLabel = isParent ? "PARENT" : "JUDOKA";
      const roleLabel = isAdmin ? `ADMIN · ${profileTypeLabel}` : profileTypeLabel;
      $("userInfo").innerHTML =
        `<strong>${escapeHtml(getJudokaDisplayName(currentUser) || "")}</strong> - ${roleLabel}`;
      setHidden("homeAdminActions", false);
      setHidden("manageAdminsButton", !isAdmin);
      setHidden("manageChildrenButton", !canManageChildren);

      const filterInput = $("filterJudokaText");
      const filterHidden = $("filterJudoka");
      const canFilterByJudoka = (isAdmin || isParent) && judokas.length > 0;
      setHidden("homeFilters", !canFilterByJudoka);
      if (!canFilterByJudoka) {
        filterInput.value = "";
        filterHidden.value = "";
      }

      ensureHomeFilterAutocomplete();
      ensureHomeActiveJudokaSelection();
      syncHomeContext();
    }

    function ensureHomeFilterAutocomplete() {
      const input = $("filterJudokaText");
      if (input.dataset.bound) {
        return;
      }

      bindAutocomplete({
        inputId: "filterJudokaText",
        dropdownId: "filterJudokaDropdown",
        hiddenId: "filterJudoka",
        getItems: () => judokas,
        allowBlank: true,
        onChange: () => {
          syncHomeContext();
          renderCompetitions();
        }
      });
      input.dataset.bound = "1";
    }

    function getAccessibleHomeJudokas() {
      if (!currentUser) {
        return [];
      }
      return (isAdmin || isParent) ? judokas : [currentUser];
    }

    function getDefaultHomeJudokaId() {
      if (!currentUser) {
        return "";
      }
      if (isAdmin) {
        return "";
      }
      return String(currentUser.judokaId || "");
    }

    function ensureHomeActiveJudokaSelection() {
      const input = $("filterJudokaText");
      const hidden = $("filterJudoka");
      const accessibleJudokas = getAccessibleHomeJudokas();
      const currentValue = hidden.value;

      if (!(isAdmin || isParent)) {
        input.value = "";
        hidden.value = "";
        return;
      }

      if (currentValue && accessibleJudokas.some(j => String(j.judokaId) === String(currentValue))) {
        return;
      }

      const defaultId = getDefaultHomeJudokaId();
      const defaultJudoka = accessibleJudokas.find(j => String(j.judokaId) === String(defaultId));
      input.value = defaultJudoka ? getJudokaDisplayName(defaultJudoka) : "";
      hidden.value = defaultJudoka ? String(defaultJudoka.judokaId) : "";
    }

    function getHomeActiveJudokaId() {
      if (!currentUser) {
        return "";
      }
      if (isAdmin || isParent) {
        return getValue("filterJudoka") || "";
      }
      return String(currentUser.judokaId || "");
    }

    function getHomeActiveJudoka() {
      const targetId = getHomeActiveJudokaId();
      return getAccessibleHomeJudokas().find(j => String(j.judokaId) === String(targetId)) || null;
    }

    function syncHomeContext() {
      const activeJudoka = getHomeActiveJudoka();
      const copy = getHomeContextCopy(activeJudoka);
      const activeJudokaLabel = activeJudoka ? getCompactJudokaLabel(activeJudoka) : copy.emptyActionMeta;

      $("filterJudokaText").placeholder = copy.filterPlaceholder;
      setTexts({
        homeTitle: copy.homeTitle,
        homeSubtitle: copy.homeSubtitle,
        openHomeJudokaProfileButtonText: copy.profileButtonText,
        openHomeJudokaProfileButtonMeta: activeJudoka ? activeJudokaLabel : copy.profileButtonMeta,
        addCompetitionButtonText: "Nouvelle compétition",
        addCompetitionButtonMeta: activeJudoka ? activeJudokaLabel : copy.addCompetitionButtonMeta,
        homeCompetitionsTitle: copy.competitionsTitle,
        homeCompetitionsSubtitle: copy.competitionsSubtitle
      });

      if (!activeJudoka) {
        $("homeActiveJudokaSummary").innerHTML = `
          <div class="home-context-copy">
            <span class="home-context-label">Judoka actif</span>
            <span class="home-context-value">Aucun judoka sélectionné</span>
            <span class="home-context-meta">Choisissez un judoka pour ouvrir sa fiche et parcourir ses compétitions.</span>
          </div>
        `;
      } else {
        const summaryMeta = isAdmin
          ? "Vous consultez actuellement le parcours de ce judoka."
          : isParent
            ? "Toutes les actions d'accueil concernent ce profil."
            : "Toutes vos actions principales sont regroupées ici.";
        $("homeActiveJudokaSummary").innerHTML = `
          <div class="home-context-copy">
            <span class="home-context-label">Judoka actif</span>
            <span class="home-context-value">${escapeHtml(getJudokaDisplayName(activeJudoka) || "Judoka")}</span>
            <span class="home-context-meta">${escapeHtml(summaryMeta)}</span>
          </div>
        `;
      }

      const actionDisabled = Boolean((isAdmin || isParent) && !activeJudoka);
      $("addCompetitionButton").disabled = actionDisabled;
      $("openHomeJudokaProfileButton").disabled = actionDisabled;
    }

    function getHomeContextCopy(activeJudoka) {
      if (isAdmin) {
        return {
          homeTitle: "Suivi des judokas",
          homeSubtitle: activeJudoka
            ? "Le parcours d'accueil est centré sur le judoka actif."
            : "Choisissez un judoka pour afficher sa fiche et ses compétitions.",
          filterPlaceholder: "Choisir un judoka...",
          profileButtonText: "Voir la fiche",
          profileButtonMeta: "Choisir un judoka",
          addCompetitionButtonMeta: "Choisir un judoka",
          competitionsTitle: activeJudoka ? `Compétitions de ${getJudokaDisplayName(activeJudoka)}` : "Compétitions du judoka actif",
          competitionsSubtitle: activeJudoka
            ? "Touchez une carte pour ouvrir ses combats."
            : "Sélectionnez d'abord un judoka pour afficher son parcours.",
          emptyActionMeta: "Choisir un judoka"
        };
      }

      if (isParent) {
        return {
          homeTitle: "Suivi judoka",
          homeSubtitle: "Choisissez votre profil ou celui d'un enfant pour travailler dans son contexte.",
          filterPlaceholder: "Moi ou mes enfants...",
          profileButtonText: "Voir la fiche",
          profileButtonMeta: "Moi ou un enfant",
          addCompetitionButtonMeta: "Moi ou un enfant",
          competitionsTitle: activeJudoka ? `Compétitions de ${getJudokaDisplayName(activeJudoka)}` : "Compétitions du judoka actif",
          competitionsSubtitle: "Touchez une carte pour ouvrir ses combats.",
          emptyActionMeta: "Moi ou un enfant"
        };
      }

      return {
        homeTitle: "Mon espace judoka",
        homeSubtitle: "Retrouvez votre fiche et vos compétitions.",
        filterPlaceholder: "Tous les judokas...",
        profileButtonText: "Ma fiche",
        profileButtonMeta: getCompactJudokaLabel(currentUser),
        addCompetitionButtonMeta: "",
        competitionsTitle: "Mes compétitions",
        competitionsSubtitle: "Touchez une carte pour ouvrir ses combats.",
        emptyActionMeta: ""
      };
    }

    function renderCompetitions() {
      const target = $("competitionsList");
      const activeJudoka = getHomeActiveJudoka();
      const activeJudokaId = getHomeActiveJudokaId();

      if ((isAdmin || isParent) && !activeJudoka) {
        target.innerHTML = emptyState("Sélectionnez un judoka pour afficher son parcours.");
        return;
      }

      let filteredComps = competitions;
      if (activeJudokaId) {
        filteredComps = competitions.filter(c => String(c.ownerJudokaId) === String(activeJudokaId));
      }

      if (!filteredComps.length) {
        target.innerHTML = emptyState("Aucune compétition enregistrée pour ce judoka.");
        return;
      }

      const judokasById = new Map(judokas.map(j => [String(j.judokaId), j]));

      let html = `<div class="list">`;

      filteredComps.forEach(c => {
        const judoka = judokasById.get(String(c.ownerJudokaId));
        const judokaNom = judoka ? getJudokaDisplayName(judoka) : "";
        html += `
          <article class="card competition-card">
            <button class="card-button competition-open-button" type="button" onclick="openCompetition('${escapeAttribute(c.competitionId)}')">
              <span class="competition-card-button-copy">
                <span class="card-title">${escapeHtml(c.name || "Compétition")}</span>
                <span class="card-meta">
                  <span class="meta-row">
                    <span class="meta-label">Date</span>
                    <span class="meta-value">${formatDate(c.competitionDate)}</span>
                  </span>
                  ${(isAdmin || isParent) ? `<span class="meta-row">
                    <span class="meta-label">Judoka</span>
                    <span class="meta-value">${escapeHtml(judokaNom)}</span>
                  </span>` : ""}
                </span>
                <span class="card-open-hint">Ouvrir les combats</span>
              </span>
            </button>
            ${isAdmin ? `<div class="card-actions">
              <button class="button-danger" type="button" data-id="${escapeAttribute(c.competitionId)}" data-name="${escapeAttribute(c.name || "")}" onclick="deleteCompetitionFromList(this.dataset.id, this.dataset.name)">
                ${icons.trash}
                Supprimer
              </button>
            </div>` : ""}
          </article>
        `;
      });

      html += `</div>`;
      target.innerHTML = html;
    }

    function openCompetition(id, keepMessage) {
      if (!keepMessage) {
        clearMessage();
      }
      setTexts({
        competitionTitle: "Chargement...",
        competitionSubtitle: ""
      });
      $("combatsList").innerHTML = emptyState("Chargement des combats...");
      showView("competitionView");

      runServer(
        "getCompetitionDetail",
        [id],
        data => {
          currentCompetition = data.competition;
          currentCombats = Array.isArray(data.combats) ? data.combats : [];
          judokas = Array.isArray(data.judokas) ? data.judokas : [];
          canEditCurrentCompetition = Boolean(data.canEditCompetition);

          renderCompetitionDetail();
          renderCombats();
        },
        showError
      );
    }

    function deleteAccessInvitation(email) {
      const label = email ? ` pour "${email}"` : "";
      confirmAndRun({
        message: `Supprimer l'invitation${label} ?`,
        method: "deleteAccessInvitation",
        args: [email],
        onSuccess: response => {
          showSuccess(response.message);
          reloadInitialDataAndShowAdmins();
        }
      });
    }

    function renderCompetitionDetail() {
      setTexts({
        competitionTitle: currentCompetition.name || "Compétition",
        competitionSubtitle: "Détail de la compétition",
        competitionDate: formatDate(currentCompetition.competitionDate)
      });

      const agePoids = [currentCompetition.ageCategory, currentCompetition.weightCategory].filter(Boolean).join(" - ");
      setHidden("row_competitionAgePoids", !agePoids);
      setText("competitionAgePoids", agePoids);

      const hasResult = Boolean(String(currentCompetition.result || "").trim());
      setHidden("row_competitionClassement", !hasResult);
      setText("competitionClassement", currentCompetition.result);

      setHidden("competitionAdminActions", !canEditCurrentCompetition);
      setHidden("finalizeCompetitionButton", !canEditCurrentCompetition || hasResult);
    }

    function openHomeJudokaProfile() {
      if (!currentUser) {
        showError({ message: "Utilisateur introuvable." });
        return;
      }

      const accessibleJudokas = getAccessibleHomeJudokas();
      const targetJudokaId = getHomeActiveJudokaId();

      if ((isAdmin || isParent) && !targetJudokaId) {
        showError({
          message: isAdmin
            ? "Sélectionnez un judoka actif pour ouvrir sa fiche."
            : "Sélectionnez votre profil ou l'un de vos enfants comme judoka actif pour ouvrir la fiche."
        });
        return;
      }

      if (!targetJudokaId || !accessibleJudokas.some(j => String(j.judokaId) === String(targetJudokaId))) {
        showError({ message: "Sélectionnez d'abord un judoka." });
        return;
      }

      showJudokaProfile(targetJudokaId);
    }

    function showHomeCompetitionForm() {
      const activeJudokaId = getHomeActiveJudokaId();
      if ((isAdmin || isParent) && !activeJudokaId) {
        showError({
          message: isAdmin
            ? "Sélectionnez un judoka actif avant d'ajouter une compétition."
            : "Sélectionnez votre profil ou l'un de vos enfants comme judoka actif avant d'ajouter une compétition."
        });
        return;
      }

      showCompetitionForm();
    }

    function showJudokaProfile(idJudoka, keepMessage) {
      if (!keepMessage) {
        clearMessage();
      }

      runServer(
        "getJudokaProfile",
        [idJudoka],
        data => {
          currentJudokaProfile = data;
          renderJudokaProfile();
          showView("judokaView");
        },
        showError
      );
    }

    function renderJudokaProfile() {
      if (!currentJudokaProfile) {
        return;
      }

      const {
        judoka,
        season,
        lastCompetition,
        bestSeasonResults,
        seasonCombatCount,
        seasonCompetitionCount,
        seasonWins,
        seasonLosses
      } = currentJudokaProfile;

      setTexts({
        judokaProfileTitle: getJudokaDisplayName(judoka) || "Fiche judoka",
        judokaProfileSubtitle: judoka.accountEmail,
        judokaSeasonLabel: `Saison ${season.label}`,
        judokaSeasonCompetitionCount: String(seasonCompetitionCount || 0),
        judokaSeasonCombatCount: String(seasonCombatCount || 0),
        judokaSeasonWins: String(seasonWins || 0),
        judokaSeasonLosses: String(seasonLosses || 0),
        judokaHeroAvatar: getJudokaInitials(judoka),
        judokaHeroName: getJudokaDisplayName(judoka) || "Judoka",
        judokaHeroSummary: `Saison ${season.label} · ${seasonCompetitionCount || 0} compétition(s) · ${seasonCombatCount || 0} combat(s)`,
        judokaHeroCategory: lastCompetition && lastCompetition.category ? lastCompetition.category : "Catégorie à confirmer",
        judokaHeroRecord: `${seasonWins || 0} V · ${seasonLosses || 0} D`
      });

      const lastCompetitionTarget = $("judokaLastCompetition");
      if (!lastCompetition) {
        lastCompetitionTarget.innerHTML = `<div class="empty-state">Aucune compétition enregistrée pour l'instant.</div>`;
      } else {
        lastCompetitionTarget.innerHTML = `
          <div class="meta-row">
            <span class="meta-label">Compétition</span>
            <span class="meta-value">${escapeHtml(lastCompetition.name || "")}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Date</span>
            <span class="meta-value">${escapeHtml(formatDate(lastCompetition.competitionDate))}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Catégorie judoka</span>
            <span class="meta-value">${escapeHtml(lastCompetition.category || "Non renseignée")}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Poids</span>
            <span class="meta-value">${escapeHtml(lastCompetition.weightCategory || "Non renseigné")}</span>
          </div>
        `;
      }

      const bestResultsTarget = $("judokaBestResults");
      if (!bestSeasonResults.length) {
        bestResultsTarget.innerHTML = `<div class="empty-state">Pas encore de classement sur cette saison.</div>`;
      } else {
        let html = `<div class="list">`;
        bestSeasonResults.forEach(result => {
          html += `
            <article class="card">
              <p class="card-title">${escapeHtml(result.name || "Compétition")}</p>
              <div class="card-meta">
                <div class="meta-row">
                  <span class="meta-label">Date</span>
                  <span class="meta-value">${escapeHtml(formatDate(result.competitionDate))}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">Résultat</span>
                  <span class="meta-value"><span class="result-badge classement-badge ${escapeAttribute(getClassementBadgeClass(result.result))}">${escapeHtml(result.result)}</span></span>
                </div>
              </div>
            </article>
          `;
        });
        html += `</div>`;
        bestResultsTarget.innerHTML = html;
      }
    }

    function editCurrentCompetition() {
      if (!currentCompetition) {
        showError({ message: "Compétition introuvable." });
        return;
      }

      showCompetitionForm(currentCompetition.competitionId);
    }

    function renderCombats() {
      const target = $("combatsList");

      if (!currentCombats.length) {
        target.innerHTML = emptyState("Aucun combat pour cette compétition.");
        return;
      }

      let html = `<div class="list">`;

      currentCombats.forEach(c => {
        html += `
          <article class="card combat-card">
            <div class="combat-header">
              <p class="card-title">${escapeHtml(c.opponent || "Adversaire non renseigné")}</p>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
                <span class="result-badge result-${escapeAttribute(String(c.result || "").toLowerCase())}">${formatResultat(c.result)}</span>
                ${c.victoryType ? `<span class="result-badge" style="background: var(--line); border-color: var(--muted);">${escapeHtml(c.victoryType)}</span>` : ""}
              </div>
            </div>
            ${isAdmin ? `
              <div class="meta-row">
                <span class="meta-label">Judoka</span>
                <span class="meta-value">${escapeHtml(normalizeDisplayName(c.judokaDisplayName || ""))}</span>
              </div>
            ` : ""}
            <p class="combat-comment">${escapeHtml(c.notes || "Aucun déroulé renseigné")}</p>
            <div class="card-actions">
              <button class="button-secondary" type="button" data-id="${escapeAttribute(c.combatId)}" onclick="showCombatForm(this.dataset.id)">
                ${icons.edit}
                Modifier
              </button>
              <button class="button-danger" type="button" data-id="${escapeAttribute(c.combatId)}" onclick="deleteCombat(this.dataset.id)">
                ${icons.trash}
                Supprimer
              </button>
            </div>
          </article>
        `;
      });

      html += `</div>`;
      target.innerHTML = html;
    }

    function renderManagedAccessInvitations() {
      const target = $("accessInvitationsList");
      const summary = $("accessInvitationsSummary");
      if (!managedAccessInvitations.length) {
        summary.innerHTML = "";
        target.innerHTML = emptyState("Aucune invitation en attente.");
        return;
      }

      const filteredInvitations = getFilteredAccessInvitations();
      const hasActiveFilter = Boolean(accessInvitationSearch);
      const visibleInvitations = hasActiveFilter
        ? filteredInvitations
        : filteredInvitations.slice(0, accessInvitationVisibleCount);
      const remainingInvitations = Math.max(filteredInvitations.length - visibleInvitations.length, 0);
      const summaryLabel = hasActiveFilter
        ? `${filteredInvitations.length} résultat(s) sur ${managedAccessInvitations.length} invitation(s).`
        : `${visibleInvitations.length} invitation(s) affichée(s) sur ${managedAccessInvitations.length}.`;

      summary.innerHTML = `
        <div class="list-summary">
          <p class="list-summary-text">${escapeHtml(summaryLabel)}</p>
          <div class="list-summary-actions">
            ${hasActiveFilter
              ? `<button class="button-secondary" type="button" onclick="resetAccessInvitationSearch()">Effacer le filtre</button>`
              : remainingInvitations > 0
                ? `<button class="button-secondary" type="button" onclick="showMoreAccessInvitations()">Voir ${Math.min(defaultAccessInvitationVisibleCount, remainingInvitations)} de plus</button>
                   <button class="button-secondary" type="button" onclick="showAllAccessInvitations()">Tout afficher</button>`
                : accessInvitationVisibleCount > defaultAccessInvitationVisibleCount && filteredInvitations.length > defaultAccessInvitationVisibleCount
                  ? `<button class="button-secondary" type="button" onclick="collapseAccessInvitations()">Réduire la liste</button>`
                  : ""}
          </div>
        </div>
      `;

      if (!filteredInvitations.length) {
        target.innerHTML = `<div class="empty-state">Aucune invitation trouvée pour "${escapeHtml(accessInvitationSearch)}".</div>`;
        return;
      }

      let html = `<div class="list">`;
      visibleInvitations.forEach(invitation => {
        html += `
          <article class="card admin-card">
            <p class="card-title">${escapeHtml(invitation.email || "Invitation")}</p>
            <div class="card-meta">
              <div class="meta-row">
                <span class="meta-label">Profil</span>
                <span class="meta-value">${escapeHtml(invitation.invitedProfileType || "JUDOKA")}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Créée le</span>
                <span class="meta-value">${escapeHtml(formatDateTime(invitation.createdAt))}</span>
              </div>
            </div>
            <div class="card-actions">
              <button class="button-danger" type="button" data-email="${escapeAttribute(invitation.email)}" onclick="deleteAccessInvitation(this.dataset.email)">
                ${icons.trash}
                Retirer l'invitation
              </button>
            </div>
          </article>
        `;
      });
      html += `</div>`;
      target.innerHTML = html;
    }

    function getFilteredAccessInvitations() {
      if (!accessInvitationSearch) {
        return managedAccessInvitations;
      }

      return managedAccessInvitations.filter(invitation =>
        cleanText(invitation.email).toLowerCase().includes(accessInvitationSearch)
      );
    }

    function updateAccessInvitationSearch(value) {
      accessInvitationSearch = cleanText(value).toLowerCase();
      accessInvitationVisibleCount = defaultAccessInvitationVisibleCount;
      renderManagedAccessInvitations();
    }

    function resetAccessInvitationSearch() {
      accessInvitationSearch = "";
      accessInvitationVisibleCount = defaultAccessInvitationVisibleCount;
      const input = $("accessInvitationFilter");
      if (input) {
        input.value = "";
      }
      renderManagedAccessInvitations();
    }

    function showMoreAccessInvitations() {
      accessInvitationVisibleCount += defaultAccessInvitationVisibleCount;
      renderManagedAccessInvitations();
    }

    function showAllAccessInvitations() {
      accessInvitationVisibleCount = managedAccessInvitations.length;
      renderManagedAccessInvitations();
    }

    function collapseAccessInvitations() {
      accessInvitationVisibleCount = defaultAccessInvitationVisibleCount;
      renderManagedAccessInvitations();
    }

    function showCompetitionForm(id) {
      clearMessage();
      previousView = currentCompetition ? "competitionView" : "homeView";

      if (id) {
        const c = competitions.find(x => String(x.competitionId) === String(id)) || currentCompetition;

        if (!c) {
          showError({ message: "Compétition introuvable." });
          return;
        }

        setText("competitionFormTitle", "Modifier la compétition");
        setCompetitionOwnerField(c.ownerJudokaId || "");
        setValues({
          competition_id: c.competitionId,
          competition_nom: c.name,
          competition_date: toInputDate(c.competitionDate),
          competition_categorie_age: c.ageCategory,
          competition_categorie_poids: c.weightCategory,
          competition_result: c.result
        });
        setHidden("competitionResultBlock", false);
      } else {
        previousView = "homeView";
        setText("competitionFormTitle", "Ajouter une compétition");
        setCompetitionOwnerField(getHomeActiveJudokaId());
        setValues({
          competition_id: "",
          competition_nom: "",
          competition_date: getCurrentLocalDate(),
          competition_categorie_age: "",
          competition_categorie_poids: "",
          competition_result: ""
        });
        setHidden("competitionResultBlock", true);
      }

      showView("competitionFormView");
    }

    function cancelCompetitionForm() {
      showView(previousView || "homeView");
    }

    function getCompetitionOwnerRequiredMessage() {
      return isAdmin
        ? "Sélectionnez un judoka avant d'enregistrer la compétition."
        : "Sélectionnez votre profil ou l'un de vos enfants avant d'enregistrer la compétition.";
    }

    function saveCompetition() {
      const competition = {
        competitionId: getValue("competition_id"),
        name: getValue("competition_nom"),
        competitionDate: getValue("competition_date"),
        ageCategory: getValue("competition_categorie_age"),
        weightCategory: getValue("competition_categorie_poids"),
        result: getValue("competition_result")
      };

      if (isAdmin || isParent) {
        competition.ownerJudokaId = resolveCompetitionOwnerSelection();
        if (!competition.ownerJudokaId) {
          showError({ message: getCompetitionOwnerRequiredMessage() });
          return;
        }
      }

      runServer(
        "saveCompetition",
        [competition],
        response => {
          showSuccess(response.message);
          reloadInitialData(response.competitionId);
        },
        showError
      );
    }

    function showCompetitionFinalizationForm() {
      clearMessage();
      if (!currentCompetition) {
        showError({ message: "Compétition introuvable." });
        return;
      }

      setValue("finalization_competition_id", currentCompetition.competitionId);
      setText("competitionFinalizationSubtitle", currentCompetition.name);
      setValue("finalization_classement", currentCompetition.result);
      showView("competitionFinalizationView");
    }

    function cancelCompetitionFinalizationForm() {
      showView("competitionView");
    }

    function finalizeCompetition() {
      const competitionId = getValue("finalization_competition_id");
      const result = getValue("finalization_classement");

      runServer(
        "finalizeCompetition",
        [competitionId, result],
        response => {
          showSuccess(response.message);
          openCompetition(response.competitionId || competitionId, true);
        },
        showError
      );
    }

    function showCombatForm(id) {
      clearMessage();
      resetCombatForm();

      if (id) {
        const combat = currentCombats.find(c => String(c.combatId) === String(id));

        if (!combat) {
          showError({ message: "Combat introuvable." });
          return;
        }

        setTexts({
          combatFormTitle: "Modifier le combat",
          combatFormSubtitle: currentCompetition.name,
          saveCombatButtonText: "Enregistrer le combat"
        });
        setValues({
          combat_id: combat.combatId,
          combat_adversaire: combat.opponent,
          combat_resultat: combat.result,
          combat_type_victoire: combat.victoryType,
          combat_deroule: combat.notes
        });
        syncCombatDecisionVisibility(false);
      } else {
        setTexts({
          combatFormTitle: "Ajouter un combat",
          combatFormSubtitle: currentCompetition.name
        });
        syncCombatDecisionVisibility(true);
      }

      showView("combatFormView");
      $("combat_adversaire").focus();
    }

    function cancelCombatForm() {
      resetCombatForm();
      showView("competitionView");
    }

    function saveCombat() {
      const idCombat = getValue("combat_id");

      if (idCombat) {
        updateCombat(idCombat);
      } else {
        addCombat();
      }
    }

    function addCombat() {
      if (!currentCompetition) {
        showError({ message: "Ouvre une compétition avant d'ajouter un combat." });
        return;
      }

      const combat = getCombatFormValue();

      runServer(
        "ajouterCombat",
        [combat],
        response => {
          showSuccess(response.message);
          resetCombatForm();
          openCompetition(currentCompetition.competitionId, true);
        },
        showError
      );
    }

    function updateCombat(idCombat) {
      const combat = getCombatFormValue();
      combat.combatId = idCombat;

      runServer(
        "updateCombat",
        [combat],
        response => {
          showSuccess(response.message);
          resetCombatForm();
          openCompetition(currentCompetition.competitionId, true);
        },
        showError
      );
    }

    function getCombatFormValue() {
      return {
        competitionId: currentCompetition.competitionId,
        judokaId: currentCompetition.ownerJudokaId,
        opponent: getValue("combat_adversaire"),
        result: getValue("combat_resultat"),
        victoryType: getValue("combat_type_victoire"),
        notes: getValue("combat_deroule")
      };
    }

    function deleteCurrentCompetition() {
      if (!currentCompetition) return;

      const label = currentCompetition.name ? ` "${currentCompetition.name}"` : "";
      confirmAndRun({
        message: `Supprimer la compétition${label} et tous ses combats ?`,
        method: "deleteCompetition",
        args: [currentCompetition.competitionId],
        onSuccess: response => {
          showSuccess(response.message);
          currentCompetition = null;
          reloadInitialData();
        }
      });
    }

    function deleteCompetitionFromList(id, name) {
      const label = name ? ` "${name}"` : "";
      confirmAndRun({
        message: `Supprimer la compétition${label} et tous ses combats ?`,
        method: "deleteCompetition",
        args: [id],
        onSuccess: response => {
          showSuccess(response.message);
          reloadInitialData();
        }
      });
    }

    function deleteCombat(id) {
      confirmAndRun({
        message: "Supprimer ce combat ?",
        method: "deleteCombat",
        args: [id],
        onSuccess: response => {
          showSuccess(response.message);
          openCompetition(currentCompetition.competitionId, true);
        }
      });
    }

    function normalizeDisplayName(value) {
      const cleaned = String(value || "").trim().toLocaleLowerCase("fr-FR");
      if (!cleaned) {
        return "";
      }

      return cleaned.replace(/(^|[\s'-])(\p{L})/gu, (match, separator, letter) => {
        return separator + letter.toLocaleUpperCase("fr-FR");
      });
    }

    function normalizeLastName(value) {
      return normalizeDisplayName(value).toLocaleUpperCase("fr-FR");
    }

    function getJudokaDisplayName(j) {
      return [normalizeDisplayName(j && j.firstName), normalizeLastName(j && j.lastName)].filter(Boolean).join(" ");
    }

    function getCompactJudokaLabel(j) {
      const firstName = normalizeDisplayName(j && j.firstName);
      const lastName = normalizeLastName(j && j.lastName);
      if (!firstName && !lastName) {
        return "";
      }
      if (!lastName) {
        return firstName;
      }
      return `${firstName} ${lastName.charAt(0)}.`;
    }

    function normalizeJudokaSelectionKey(value) {
      return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("fr-FR");
    }

    function resolveCompetitionOwnerSelection() {
      const hidden = $("competition_id_judoka");
      const input = $("competition_judoka_text");
      const hiddenValue = String(hidden.value || "").trim();

      if (hiddenValue && judokas.some(j => String(j.judokaId) === hiddenValue)) {
        return hiddenValue;
      }

      const typedValue = normalizeJudokaSelectionKey(input.value);
      if (!typedValue) {
        const activeJudokaId = String(getHomeActiveJudokaId() || "").trim();
        if (activeJudokaId && judokas.some(j => String(j.judokaId) === activeJudokaId)) {
          hidden.value = activeJudokaId;
          return activeJudokaId;
        }
        return "";
      }

      const matches = judokas.filter(j => {
        return [
          getJudokaDisplayName(j),
          getCompactJudokaLabel(j),
          j && j.judokaId
        ].some(label => normalizeJudokaSelectionKey(label) === typedValue);
      });

      if (matches.length === 1) {
        const resolvedId = String(matches[0].judokaId || "");
        hidden.value = resolvedId;
        input.value = getJudokaDisplayName(matches[0]);
        return resolvedId;
      }

      return "";
    }

    function bindAutocomplete({ inputId, dropdownId, hiddenId, getItems, allowBlank, onChange }) {
      const input = $(inputId);
      const dropdown = $(dropdownId);
      const hidden = $(hiddenId);
      let isSelecting = false;

      function select(value, label) {
        input.value = label;
        hidden.value = value;
        dropdown.style.display = "none";
        isSelecting = false;
        onChange && onChange(value ? getItems().find(j => String(j.judokaId) === String(value)) : null);
      }

      function renderOptions(items) {
        dropdown.innerHTML = "";

        if (allowBlank) {
          const opt = document.createElement("div");
          opt.className = "autocomplete-option";
          opt.textContent = "— Tous —";
          opt.addEventListener("pointerdown", e => { e.preventDefault(); isSelecting = true; select("", ""); });
          dropdown.appendChild(opt);
        }

        if (!items.length) {
          const empty = document.createElement("div");
          empty.className = "autocomplete-empty";
          empty.textContent = "Aucun résultat";
          dropdown.appendChild(empty);
        } else {
          items.forEach(j => {
            const name = getJudokaDisplayName(j);
            const secondary = getJudokaSecondaryText(j);
            const opt = document.createElement("div");
            opt.className = "autocomplete-option";
            opt.innerHTML = `<div class="autocomplete-option-copy"><strong>${escapeHtml(name)}</strong><span class="autocomplete-option-meta">${escapeHtml(secondary)}</span></div>`;
            opt.addEventListener("pointerdown", e => { e.preventDefault(); isSelecting = true; select(j.judokaId, name); });
            dropdown.appendChild(opt);
          });
        }

        dropdown.style.display = "block";
      }

      input.addEventListener("focus", () => {
        const q = input.value.toLowerCase().trim();
        renderOptions(getItems().filter(j => !q || getJudokaSearchText(j).includes(q)));
      });

      input.addEventListener("input", () => {
        const q = input.value.toLowerCase().trim();
        hidden.value = "";
        renderOptions(getItems().filter(j => !q || getJudokaSearchText(j).includes(q)));
      });

      input.addEventListener("blur", () => {
        if (!isSelecting) {
          dropdown.style.display = "none";
        }
      });
    }

    function setCompetitionOwnerField(idJudoka) {
      const block = $("competitionOwnerBlock");

      if (!isAdmin && !isParent) {
        block.classList.add("hidden");
        return;
      }

      block.classList.remove("hidden");

      // Branche l'autocomplete la première fois (évite les doublons de listeners)
      const input = $("competition_judoka_text");
      if (!input.dataset.bound) {
        bindAutocomplete({
          inputId: "competition_judoka_text",
          dropdownId: "competition_judoka_dropdown",
          hiddenId: "competition_id_judoka",
          getItems: () => judokas
        });
        input.dataset.bound = "1";
      }

      const owner = judokas.find(j => String(j.judokaId) === String(idJudoka));
      input.value = owner ? getJudokaDisplayName(owner) : "";
      setValue("competition_id_judoka", idJudoka);
    }

    function getJudokaSecondaryText(judoka) {
      if (cleanText(judoka.accountEmail)) {
        return judoka.accountEmail;
      }

      return `ID ${String(judoka.judokaId || "").slice(-6)}`;
    }

    function getJudokaSearchText(judoka) {
      return `${getJudokaDisplayName(judoka)} ${getJudokaSecondaryText(judoka)}`.toLowerCase();
    }

    function cleanText(value) {
      return String(value || "").trim();
    }

    function syncCombatDecisionVisibility(clearValueWhenHidden) {
      const result = getValue("combat_resultat");
      const block = $("combatDecisionBlock");
      const shouldShow = Boolean(result);
      block.classList.toggle("hidden", !shouldShow);

      if (!shouldShow && clearValueWhenHidden) {
        setValue("combat_type_victoire", "");
      }
    }

    function resetCombatForm() {
      setValues({
        combat_id: "",
        combat_adversaire: "",
        combat_resultat: "",
        combat_type_victoire: "",
        combat_deroule: ""
      });
      setText("saveCombatButtonText", "Ajouter le combat");
      syncCombatDecisionVisibility(true);
    }

    function showChildrenManagement(keepMessage) {
      if (!keepMessage) {
        clearMessage();
      }

      runServer(
        "getChildrenManagement",
        [],
        data => {
          managedChildren = Array.isArray(data.children) ? data.children : [];
          renderManagedChildren();
          resetChildForm();
          showView("childrenView");
        },
        showError
      );
    }

    function showAdminsManagement(keepMessage) {
      if (!keepMessage) {
        clearMessage();
      }

      runServer(
        "getAdminsManagement",
        [],
        data => {
          managedAdmins = Array.isArray(data.admins) ? data.admins : [];
          managedAccessInvitations = Array.isArray(data.accessInvitations) ? data.accessInvitations : [];
          accessInvitationSearch = "";
          accessInvitationVisibleCount = defaultAccessInvitationVisibleCount;
          const invitationSearchInput = $("accessInvitationFilter");
          if (invitationSearchInput) {
            invitationSearchInput.value = "";
          }
          renderManagedAdmins();
          renderManagedAccessInvitations();
          resetAccessInvitationForm();
          resetAdminForm();
          showView("adminsView");
        },
        showError
      );
    }

    function renderManagedAdmins() {
      const target = $("adminsList");
      if (!managedAdmins.length) {
        target.innerHTML = emptyState("Aucun admin trouvé.");
        return;
      }

      let html = `<div class="list">`;
      managedAdmins.forEach(admin => {
        const fullName = getJudokaDisplayName(admin) || admin.accountEmail || "Admin";
        const isCurrentAdmin = currentUser && String(currentUser.judokaId) === String(admin.judokaId);
        html += `
          <article class="card admin-card">
            <p class="card-title">${escapeHtml(fullName)}</p>
            <div class="card-meta">
              <div class="meta-row">
                <span class="meta-label">Email</span>
                <span class="meta-value">${escapeHtml(admin.accountEmail || "Non renseigné")}</span>
              </div>
            </div>
            <div class="card-actions">
              ${isCurrentAdmin
                ? `<span class="current-admin-note">Vous</span>`
              : `<button class="button-danger" type="button" data-id="${escapeAttribute(admin.judokaId)}" data-name="${escapeAttribute(fullName)}" onclick="revokeAdminRole(this.dataset.id, this.dataset.name)">${icons.shieldOff}Révoquer</button>`}
            </div>
          </article>
        `;
      });
      html += `</div>`;
      target.innerHTML = html;
    }

    function renderManagedChildren() {
      const target = $("childrenList");
      if (!managedChildren.length) {
        target.innerHTML = emptyState("Aucun enfant enregistré pour le moment.");
        return;
      }

      let html = `<div class="list">`;
      managedChildren.forEach(child => {
        const fullName = getJudokaDisplayName(child) || "Enfant";
        const directAccessState = child.accountEmail ? "Activée" : "Non activée";
        html += `
          <article class="card child-card">
            <p class="card-title">${escapeHtml(fullName)}</p>
            <div class="card-meta">
              <div class="meta-row">
                <span class="meta-label">Prénom</span>
                <span class="meta-value">${escapeHtml(normalizeDisplayName(child.firstName || ""))}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Nom</span>
                <span class="meta-value">${escapeHtml(normalizeLastName(child.lastName || ""))}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Email</span>
                <span class="meta-value">${escapeHtml(child.accountEmail || "Non renseigné")}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Connexion autonome</span>
                <span class="meta-value">${escapeHtml(directAccessState)}</span>
              </div>
            </div>
            <div class="card-actions">
              <button class="button-secondary" data-id="${escapeAttribute(child.judokaId)}" onclick="editManagedChild(this.dataset.id)">${icons.edit}Modifier</button>
              <button class="button-danger" data-id="${escapeAttribute(child.judokaId)}" data-name="${escapeAttribute(fullName)}" onclick="deleteManagedChild(this.dataset.id, this.dataset.name)">${icons.trash}Supprimer</button>
            </div>
          </article>
        `;
      });
      html += `</div>`;
      target.innerHTML = html;
    }

    function resetChildForm() {
      setValue("child_id", "");
      setValue("child_prenom", "");
      setValue("child_nom", "");
      setValue("child_email", "");
      setText("childFormTitle", "Ajouter un enfant");
      setText("saveChildButtonText", "Ajouter l'enfant");
    }

    function resetAdminForm() {
      setValue("admin_email", "");
    }

    function resetAccessInvitationForm() {
      setValue("invite_email", "");
      setValue("invite_profile_type", "JUDOKA");
    }

    function editManagedChild(idJudoka) {
      const child = managedChildren.find(item => String(item.judokaId) === String(idJudoka));
      if (!child) {
        showError({ message: "Enfant introuvable." });
        return;
      }

      setValues({
        child_id: child.judokaId,
        child_prenom: child.firstName,
        child_nom: child.lastName,
        child_email: child.accountEmail
      });
      setTexts({
        childFormTitle: "Modifier l'enfant",
        saveChildButtonText: "Enregistrer l'enfant"
      });
      showView("childrenView");
      $("child_prenom").focus();
    }

    function saveManagedChild() {
      const child = {
        judokaId: getValue("child_id"),
        firstName: getValue("child_prenom"),
        lastName: getValue("child_nom"),
        accountEmail: getValue("child_email")
      };

      runServer(
        "saveManagedChild",
        [child],
        response => {
          showSuccess(response.message);
          reloadInitialDataAndShowChildren();
        },
        showError
      );
    }

    function saveAdminRole() {
      const email = getValue("admin_email");

      runServer(
        "grantAdminRole",
        [email],
        response => {
          showSuccess(response.message);
          reloadInitialDataAndShowAdmins();
        },
        showError
      );
    }

    function deleteManagedChild(idJudoka, name) {
      const label = name ? ` "${name}"` : "";
      confirmAndRun({
        message: `Supprimer l'enfant${label} ?`,
        method: "deleteManagedChild",
        args: [idJudoka],
        onSuccess: response => {
          showSuccess(response.message);
          reloadInitialDataAndShowChildren();
        }
      });
    }

    function revokeAdminRole(idJudoka, name) {
      const label = name ? ` "${name}"` : "";
      confirmAndRun({
        message: `Retirer les droits admin${label} ?`,
        method: "revokeAdminRole",
        args: [idJudoka],
        onSuccess: response => {
          showSuccess(response.message);
          reloadInitialDataAndShowAdmins();
        }
      });
    }

    function confirmAndRun({ message, method, args, onSuccess }) {
      if (!window.confirm(message)) {
        return;
      }

      runServer(method, args, onSuccess, showError);
    }

    function reloadInitialData(openCompetitionId) {
      reloadInitialDataThen(() => {
        if (openCompetitionId) {
          openCompetition(openCompetitionId, true);
        } else {
          showHome();
        }
      });
    }

    function reloadInitialDataThen(afterReload) {
      runServer(
        "getInitialData",
        [],
        data => {
          if (data.error) {
            showError({ message: data.error });
            return;
          }

          applyInitialData(data);
          afterReload();
        },
        showError
      );
    }

    function reloadInitialDataAndShowChildren() {
      reloadInitialDataThen(() => showChildrenManagement(true));
    }

    function reloadInitialDataAndShowAdmins() {
      reloadInitialDataThen(() => showAdminsManagement(true));
    }

    function showHome() {
      currentCompetition = null;
      currentCombats = [];
      currentJudokaProfile = null;
      canEditCurrentCompetition = false;
      syncHomeContext();
      renderCompetitions();
      showView("homeView");
    }

    function showView(id) {
      viewIds.forEach(viewId => {
        $(viewId).classList.add("hidden");
      });

      $(id).classList.remove("hidden");
    }

    function formatDate(value) {
      if (!value) return "";
      const d = new Date(value);
      return isNaN(d.getTime()) ? value : d.toLocaleDateString("fr-FR");
    }

    function toInputDate(value) {
      if (!value) return "";
      const d = new Date(value);
      return isNaN(d.getTime()) ? value : d.toISOString().slice(0, 10);
    }

    function getCurrentLocalDate() {
      const now = new Date();
      const year = String(now.getFullYear());
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    function formatResultat(value) {
      if (value === "V") return "Victoire";
      if (value === "D") return "Défaite";
      if (value === "E") return "Égalité";
      return value || "";
    }

    function getClassementBadgeClass(value) {
      const normalized = String(value || "").toLowerCase();
      if (normalized === "1er") return "rank-1";
      if (normalized === "2e") return "rank-2";
      if (normalized === "3e") return "rank-3";
      if (normalized === "5e" || normalized === "7e") return "rank-finalist";
      return "";
    }

    function getJudokaInitials(judoka) {
      const firstName = normalizeDisplayName(judoka && judoka.firstName);
      const lastName = normalizeLastName(judoka && judoka.lastName);
      return `${firstName.charAt(0) || ""}${lastName.charAt(0) || ""}`.trim() || "J";
    }

    function formatDateTime(value) {
      if (!value) {
        return "Non renseigné";
      }

      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return value;
      }

      return new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short"
      }).format(date);
    }

    function showSuccess(message) {
      document.getElementById("message").innerHTML = "";
      showToast("success", message, 4000);
    }

    function showError(error) {
      document.getElementById("message").innerHTML = "";
      showToast("error", error.message || error, 7000);
    }

    function clearMessage() {
      document.getElementById("message").innerHTML = "";
      clearToasts();
    }

    function showToast(type, message, duration) {
      const toastId = `toast-${++toastSequence}`;
      const toastLayer = $("toastLayer");
      const toneClass = type === "success" ? "success" : "error";
      const role = type === "success" ? "status" : "alert";
      const icon = type === "success"
        ? `<path d="M20 6L9 17l-5-5"></path>`
        : `<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>`;
      const toast = document.createElement("div");
      toast.className = `toast toast-${type}`;
      toast.dataset.toastId = toastId;
      toast.setAttribute("role", role);
      toast.innerHTML = `<button type="button" class="toast-close" aria-label="Fermer la notification" onclick="dismissToast('${toastId}')"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button><p class="${toneClass}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>${escapeHtml(message)}</p>`;
      toastLayer.appendChild(toast);

      const timer = setTimeout(() => {
        dismissToast(toastId);
      }, duration);
      activeToastTimers.set(toastId, timer);
    }

    function dismissToast(toastId) {
      const toast = document.querySelector(`[data-toast-id="${toastId}"]`);
      if (!toast) {
        return;
      }

      const timer = activeToastTimers.get(toastId);
      if (timer) {
        clearTimeout(timer);
        activeToastTimers.delete(toastId);
      }

      toast.classList.add("toast-exit");
      setTimeout(() => {
        toast.remove();
      }, 180);
    }

    function clearToasts() {
      activeToastTimers.forEach((timer) => clearTimeout(timer));
      activeToastTimers.clear();
      $("toastLayer").innerHTML = "";
    }

    function escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function escapeAttribute(value) {
      return escapeHtml(value).replaceAll("`", "&#096;");
    }

    $("combat_resultat").addEventListener("change", () => {
      syncCombatDecisionVisibility(true);
    });

    Object.assign(window, {
      cancelCombatForm,
      cancelCompetitionFinalizationForm,
      cancelCompetitionForm,
      collapseAccessInvitations,
      deleteAccessInvitation,
      deleteCombat,
      deleteCompetitionFromList,
      deleteCurrentCompetition,
      deleteManagedChild,
      dismissToast,
      editCurrentCompetition,
      editManagedChild,
      finalizeCompetition,
      logoutUser,
      openCompetition,
      openHomeJudokaProfile,
      resetAccessInvitationForm,
      resetAccessInvitationSearch,
      resetAdminForm,
      resetChildForm,
      revokeAdminRole,
      saveAccessInvitation,
      saveAdminRole,
      saveCompetition,
      saveCombat,
      saveManagedChild,
      showAdminsManagement,
      showAllAccessInvitations,
      showChildrenManagement,
      showCombatForm,
      showCompetitionFinalizationForm,
      showHome,
      showHomeCompetitionForm,
      showMoreAccessInvitations,
      startGoogleLogin,
      updateAccessInvitationSearch
    });

    init();
