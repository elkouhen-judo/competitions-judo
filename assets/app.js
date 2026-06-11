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
    let canManageCurrentCompetition = false;
    let canEditCurrentCompetition = false;
    let previousView = "homeView";
    let toastSequence = 0;
    const activeToastTimers = new Map();
    const runtimeConfig = window.KIROKU_RUNTIME_CONFIG || {};
    const sessionStorageKey = "kiroku_supabase_session";

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
      document.querySelector("header").classList.add("hidden");
      document.getElementById("loginText").innerText = "Connectez-vous avec le compte Google associé à votre fiche judoka ou enfant. Les droits sont ensuite appliqués à partir du profil judoka correspondant.";
      document.getElementById("loginHint").classList.add("hidden");
      document.getElementById("oauthLoginOptions").classList.remove("hidden");
      document.getElementById("profileRegistrationForm").classList.add("hidden");
      showView("loginView");
    }

    function showInvitationRequired() {
      document.querySelector("header").classList.add("hidden");
      document.getElementById("loginText").innerText = "Accès non autorisé.";
      document.getElementById("loginHint").innerText = "Cette adresse Google n'est pas encore invitée. Demandez à un admin de créer une invitation, ou connectez-vous avec un autre compte autorisé.";
      document.getElementById("loginHint").classList.remove("hidden");
      document.getElementById("oauthLoginOptions").classList.remove("hidden");
      document.getElementById("profileRegistrationForm").classList.add("hidden");
      showView("loginView");
    }

    function showProfileRegistration() {
      document.querySelector("header").classList.add("hidden");
      document.getElementById("loginText").innerText = "Votre invitation est validée. Créez maintenant votre profil judoka.";
      document.getElementById("loginHint").innerText = "Si vous avez déjà une fiche enfant, un parent doit d'abord y renseigner cet email au lieu de créer un nouveau profil.";
      document.getElementById("loginHint").classList.remove("hidden");
      document.getElementById("oauthLoginOptions").classList.add("hidden");
      document.getElementById("profileRegistrationForm").classList.remove("hidden");
      showView("loginView");
    }

    document.getElementById("profileRegistrationForm").addEventListener("submit", event => {
      event.preventDefault();
      clearMessage();

      const profile = {
        prenom: document.getElementById("registrationPrenom").value,
        nom: document.getElementById("registrationNom").value
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
      const email = document.getElementById("invite_email").value;
      const profileType = document.getElementById("invite_profile_type").value;

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
      document.getElementById("userInfo").innerHTML =
        `<strong>${escapeHtml(getJudokaDisplayName(currentUser) || "")}</strong> - ${roleLabel}`;
      document.getElementById("homeAdminActions").classList.remove("hidden");
      document.getElementById("manageAdminsButton").classList.toggle("hidden", !isAdmin);
      document.getElementById("manageChildrenButton").classList.toggle("hidden", !canManageChildren);

      const homeFilters = document.getElementById("homeFilters");
      const filterInput = document.getElementById("filterJudokaText");
      const filterHidden = document.getElementById("filterJudoka");
      const canFilterByJudoka = (isAdmin || isParent) && judokas.length > 0;
      homeFilters.classList.toggle("hidden", !canFilterByJudoka);
      if (!canFilterByJudoka) {
        filterInput.value = "";
        filterHidden.value = "";
      }

      ensureHomeFilterAutocomplete();
      ensureHomeActiveJudokaSelection();
      syncHomeContext();
    }

    function ensureHomeFilterAutocomplete() {
      const input = document.getElementById("filterJudokaText");
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
      return String(currentUser.id_judoka || "");
    }

    function ensureHomeActiveJudokaSelection() {
      const input = document.getElementById("filterJudokaText");
      const hidden = document.getElementById("filterJudoka");
      const accessibleJudokas = getAccessibleHomeJudokas();
      const currentValue = hidden.value;

      if (!(isAdmin || isParent)) {
        input.value = "";
        hidden.value = "";
        return;
      }

      if (currentValue && accessibleJudokas.some(j => String(j.id_judoka) === String(currentValue))) {
        return;
      }

      const defaultId = getDefaultHomeJudokaId();
      const defaultJudoka = accessibleJudokas.find(j => String(j.id_judoka) === String(defaultId));
      input.value = defaultJudoka ? getJudokaDisplayName(defaultJudoka) : "";
      hidden.value = defaultJudoka ? String(defaultJudoka.id_judoka) : "";
    }

    function getHomeActiveJudokaId() {
      if (!currentUser) {
        return "";
      }
      if (isAdmin || isParent) {
        return document.getElementById("filterJudoka").value || "";
      }
      return String(currentUser.id_judoka || "");
    }

    function getHomeActiveJudoka() {
      const targetId = getHomeActiveJudokaId();
      return getAccessibleHomeJudokas().find(j => String(j.id_judoka) === String(targetId)) || null;
    }

    function syncHomeContext() {
      const activeJudoka = getHomeActiveJudoka();
      const summary = document.getElementById("homeActiveJudokaSummary");
      const homeTitle = document.getElementById("homeTitle");
      const homeSubtitle = document.getElementById("homeSubtitle");
      const competitionsTitle = document.getElementById("homeCompetitionsTitle");
      const competitionsSubtitle = document.getElementById("homeCompetitionsSubtitle");
      const profileButtonText = document.getElementById("openHomeJudokaProfileButtonText");
      const profileButtonMeta = document.getElementById("openHomeJudokaProfileButtonMeta");
      const addCompetitionButtonText = document.getElementById("addCompetitionButtonText");
      const addCompetitionButtonMeta = document.getElementById("addCompetitionButtonMeta");
      const addCompetitionButton = document.getElementById("addCompetitionButton");
      const profileButton = document.getElementById("openHomeJudokaProfileButton");
      const filterInput = document.getElementById("filterJudokaText");

      if (isAdmin) {
        homeTitle.innerText = "Suivi des judokas";
        homeSubtitle.innerText = activeJudoka
          ? "Le parcours d'accueil est centré sur le judoka actif."
          : "Choisissez un judoka pour afficher sa fiche et ses compétitions.";
        filterInput.placeholder = "Choisir un judoka...";
        profileButtonText.innerText = "Voir la fiche";
        profileButtonMeta.innerText = activeJudoka ? getCompactJudokaLabel(activeJudoka) : "Choisir un judoka";
        addCompetitionButtonText.innerText = "Nouvelle compétition";
        addCompetitionButtonMeta.innerText = activeJudoka ? getCompactJudokaLabel(activeJudoka) : "Choisir un judoka";
        competitionsTitle.innerText = activeJudoka ? `Compétitions de ${getJudokaDisplayName(activeJudoka)}` : "Compétitions du judoka actif";
        competitionsSubtitle.innerText = activeJudoka
          ? "Touchez une carte pour ouvrir ses combats."
          : "Sélectionnez d'abord un judoka pour afficher son parcours.";
      } else if (isParent) {
        homeTitle.innerText = "Suivi judoka";
        homeSubtitle.innerText = "Choisissez votre profil ou celui d'un enfant pour travailler dans son contexte.";
        filterInput.placeholder = "Moi ou mes enfants...";
        profileButtonText.innerText = "Voir la fiche";
        profileButtonMeta.innerText = activeJudoka ? getCompactJudokaLabel(activeJudoka) : "Moi ou un enfant";
        addCompetitionButtonText.innerText = "Nouvelle compétition";
        addCompetitionButtonMeta.innerText = activeJudoka ? getCompactJudokaLabel(activeJudoka) : "Moi ou un enfant";
        competitionsTitle.innerText = activeJudoka ? `Compétitions de ${getJudokaDisplayName(activeJudoka)}` : "Compétitions du judoka actif";
        competitionsSubtitle.innerText = "Touchez une carte pour ouvrir ses combats.";
      } else {
        homeTitle.innerText = "Mon espace judoka";
        homeSubtitle.innerText = "Retrouvez votre fiche et vos compétitions.";
        filterInput.placeholder = "Tous les judokas...";
        profileButtonText.innerText = "Ma fiche";
        profileButtonMeta.innerText = getCompactJudokaLabel(currentUser);
        addCompetitionButtonText.innerText = "Nouvelle compétition";
        addCompetitionButtonMeta.innerText = "";
        competitionsTitle.innerText = "Mes compétitions";
        competitionsSubtitle.innerText = "Touchez une carte pour ouvrir ses combats.";
      }

      if (!activeJudoka) {
        summary.innerHTML = `
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
        summary.innerHTML = `
          <div class="home-context-copy">
            <span class="home-context-label">Judoka actif</span>
            <span class="home-context-value">${escapeHtml(getJudokaDisplayName(activeJudoka) || "Judoka")}</span>
            <span class="home-context-meta">${escapeHtml(summaryMeta)}</span>
          </div>
        `;
      }

      const actionDisabled = Boolean((isAdmin || isParent) && !activeJudoka);
      addCompetitionButton.disabled = actionDisabled;
      profileButton.disabled = actionDisabled;
    }

    function renderCompetitions() {
      const target = document.getElementById("competitionsList");
      const activeJudoka = getHomeActiveJudoka();
      const activeJudokaId = getHomeActiveJudokaId();

      if ((isAdmin || isParent) && !activeJudoka) {
        target.innerHTML = `<div class="empty-state">Sélectionnez un judoka pour afficher son parcours.</div>`;
        return;
      }

      let filteredComps = competitions;
      if (activeJudokaId) {
        filteredComps = competitions.filter(c => String(c.id_judoka) === String(activeJudokaId));
      }

      if (!filteredComps.length) {
        target.innerHTML = `<div class="empty-state">Aucune compétition enregistrée pour ce judoka.</div>`;
        return;
      }

      const judokasById = new Map(judokas.map(j => [String(j.id_judoka), j]));

      let html = `<div class="list">`;

      filteredComps.forEach(c => {
        const judoka = judokasById.get(String(c.id_judoka));
        const judokaNom = judoka ? getJudokaDisplayName(judoka) : "";
        html += `
          <article class="card competition-card">
            <button class="card-button competition-open-button" type="button" onclick="openCompetition('${escapeAttribute(c.id_competition)}')">
              <span class="competition-card-button-copy">
                <span class="card-title">${escapeHtml(c.nom || "Compétition")}</span>
                <span class="card-meta">
                  <span class="meta-row">
                    <span class="meta-label">Date</span>
                    <span class="meta-value">${formatDate(c.date)}</span>
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
              <button class="button-danger" type="button" data-id="${escapeAttribute(c.id_competition)}" data-name="${escapeAttribute(c.nom || "")}" onclick="deleteCompetitionFromList(this.dataset.id, this.dataset.name)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
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
      document.getElementById("competitionTitle").innerText = "Chargement...";
      document.getElementById("competitionSubtitle").innerText = "";
      document.getElementById("combatsList").innerHTML = `<div class="empty-state">Chargement des combats...</div>`;
      showView("competitionView");

      runServer(
        "getCompetitionDetail",
        [id],
        data => {
          currentCompetition = data.competition;
          currentCombats = Array.isArray(data.combats) ? data.combats : [];
          judokas = Array.isArray(data.judokas) ? data.judokas : [];
          canManageCurrentCompetition = Boolean(data.canManageCompetition);
          canEditCurrentCompetition = Boolean(data.canEditCompetition);

          renderCompetitionDetail();
          renderCombats();
        },
        showError
      );
    }

    function deleteAccessInvitation(email) {
      const label = email ? ` pour "${email}"` : "";
      if (!window.confirm(`Supprimer l'invitation${label} ?`)) {
        return;
      }

      runServer(
        "deleteAccessInvitation",
        [email],
        response => {
          showSuccess(response.message);
          reloadInitialDataAndShowAdmins();
        },
        showError
      );
    }

    function renderCompetitionDetail() {
      document.getElementById("competitionTitle").innerText = currentCompetition.nom || "Compétition";
      document.getElementById("competitionSubtitle").innerText = "Détail de la compétition";
      document.getElementById("competitionDate").innerText = formatDate(currentCompetition.date);

      const agePoids = [currentCompetition.categorie_age, currentCompetition.categorie_poids].filter(Boolean).join(" - ");
      if (agePoids) {
        document.getElementById("row_competitionAgePoids").classList.remove("hidden");
        document.getElementById("competitionAgePoids").innerText = agePoids;
      } else {
        document.getElementById("row_competitionAgePoids").classList.add("hidden");
      }

      if (currentCompetition.classement) {
        document.getElementById("row_competitionClassement").classList.remove("hidden");
        document.getElementById("competitionClassement").innerText = currentCompetition.classement;
      } else {
        document.getElementById("row_competitionClassement").classList.add("hidden");
      }

      document.getElementById("competitionAdminActions").classList.toggle("hidden", !canEditCurrentCompetition);
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

      if (!targetJudokaId || !accessibleJudokas.some(j => String(j.id_judoka) === String(targetJudokaId))) {
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

      document.getElementById("judokaProfileTitle").innerText = getJudokaDisplayName(judoka) || "Fiche judoka";
      document.getElementById("judokaProfileSubtitle").innerText = judoka.email || "";
      document.getElementById("judokaSeasonLabel").innerText = `Saison ${season.label}`;
      document.getElementById("judokaSeasonCompetitionCount").innerText = String(seasonCompetitionCount || 0);
      document.getElementById("judokaSeasonCombatCount").innerText = String(seasonCombatCount || 0);
      document.getElementById("judokaSeasonWins").innerText = String(seasonWins || 0);
      document.getElementById("judokaSeasonLosses").innerText = String(seasonLosses || 0);
      document.getElementById("judokaHeroAvatar").innerText = getJudokaInitials(judoka);
      document.getElementById("judokaHeroName").innerText = getJudokaDisplayName(judoka) || "Judoka";
      document.getElementById("judokaHeroSummary").innerText = `Saison ${season.label} · ${seasonCompetitionCount || 0} compétition(s) · ${seasonCombatCount || 0} combat(s)`;
      document.getElementById("judokaHeroCategory").innerText = lastCompetition && lastCompetition.category
        ? lastCompetition.category
        : "Catégorie à confirmer";
      document.getElementById("judokaHeroRecord").innerText = `${seasonWins || 0} V · ${seasonLosses || 0} D`;

      const lastCompetitionTarget = document.getElementById("judokaLastCompetition");
      if (!lastCompetition) {
        lastCompetitionTarget.innerHTML = `<div class="empty-state">Aucune compétition enregistrée pour l'instant.</div>`;
      } else {
        lastCompetitionTarget.innerHTML = `
          <div class="meta-row">
            <span class="meta-label">Compétition</span>
            <span class="meta-value">${escapeHtml(lastCompetition.nom || "")}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Date</span>
            <span class="meta-value">${escapeHtml(formatDate(lastCompetition.date))}</span>
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

      const bestResultsTarget = document.getElementById("judokaBestResults");
      if (!bestSeasonResults.length) {
        bestResultsTarget.innerHTML = `<div class="empty-state">Pas encore de classement sur cette saison.</div>`;
      } else {
        let html = `<div class="list">`;
        bestSeasonResults.forEach(result => {
          html += `
            <article class="card">
              <p class="card-title">${escapeHtml(result.nom || "Compétition")}</p>
              <div class="card-meta">
                <div class="meta-row">
                  <span class="meta-label">Date</span>
                  <span class="meta-value">${escapeHtml(formatDate(result.date))}</span>
                </div>
                <div class="meta-row">
                  <span class="meta-label">Résultat</span>
                  <span class="meta-value"><span class="result-badge classement-badge ${escapeAttribute(getClassementBadgeClass(result.classement))}">${escapeHtml(result.classement)}</span></span>
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

      showCompetitionForm(currentCompetition.id_competition);
    }

    function renderCombats() {
      const target = document.getElementById("combatsList");

      if (!currentCombats.length) {
        target.innerHTML = `<div class="empty-state">Aucun combat pour cette compétition.</div>`;
        return;
      }

      let html = `<div class="list">`;

      currentCombats.forEach(c => {
        html += `
          <article class="card combat-card">
            <div class="combat-header">
              <p class="card-title">${escapeHtml(c.adversaire || "Adversaire non renseigné")}</p>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
                <span class="result-badge result-${escapeAttribute(String(c.resultat || "").toLowerCase())}">${formatResultat(c.resultat)}</span>
                ${c.type_victoire ? `<span class="result-badge" style="background: var(--line); border-color: var(--muted);">${escapeHtml(c.type_victoire)}</span>` : ""}
              </div>
            </div>
            ${isAdmin ? `
              <div class="meta-row">
                <span class="meta-label">Judoka</span>
                <span class="meta-value">${escapeHtml(normalizeDisplayName(c.judoka_nom || ""))}</span>
              </div>
            ` : ""}
            <p class="combat-comment">${escapeHtml(c.deroule || "Aucun déroulé renseigné")}</p>
            <div class="card-actions">
              <button class="button-secondary" type="button" data-id="${escapeAttribute(c.id_combat)}" onclick="showCombatForm(this.dataset.id)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                Modifier
              </button>
              <button class="button-danger" type="button" data-id="${escapeAttribute(c.id_combat)}" onclick="deleteCombat(this.dataset.id)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
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
      const target = document.getElementById("accessInvitationsList");
      if (!managedAccessInvitations.length) {
        target.innerHTML = `<div class="empty-state">Aucune invitation en attente.</div>`;
        return;
      }

      let html = `<div class="list">`;
      managedAccessInvitations.forEach(invitation => {
        html += `
          <article class="card admin-card">
            <p class="card-title">${escapeHtml(invitation.email || "Invitation")}</p>
            <div class="card-meta">
              <div class="meta-row">
                <span class="meta-label">Profil</span>
                <span class="meta-value">${escapeHtml(invitation.invited_profile_type || "JUDOKA")}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Créée le</span>
                <span class="meta-value">${escapeHtml(formatDateTime(invitation.created_at))}</span>
              </div>
            </div>
            <div class="card-actions">
              <button class="button-danger" type="button" data-email="${escapeAttribute(invitation.email)}" onclick="deleteAccessInvitation(this.dataset.email)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                Retirer l'invitation
              </button>
            </div>
          </article>
        `;
      });
      html += `</div>`;
      target.innerHTML = html;
    }

    function showCompetitionForm(id) {
      clearMessage();
      previousView = currentCompetition ? "competitionView" : "homeView";

      if (id) {
        const c = competitions.find(x => String(x.id_competition) === String(id)) || currentCompetition;

        if (!c) {
          showError({ message: "Compétition introuvable." });
          return;
        }

        document.getElementById("competitionFormTitle").innerText = "Modifier la compétition";
        document.getElementById("competition_id").value = c.id_competition;
        setCompetitionOwnerField(c.id_judoka || "");
        document.getElementById("competition_nom").value = c.nom || "";
        document.getElementById("competition_date").value = toInputDate(c.date);
        document.getElementById("competition_categorie_age").value = c.categorie_age || "";
        document.getElementById("competition_categorie_poids").value = c.categorie_poids || "";
        document.getElementById("competition_classement").value = c.classement || "";
      } else {
        previousView = "homeView";
        document.getElementById("competitionFormTitle").innerText = "Ajouter une compétition";
        document.getElementById("competition_id").value = "";
        setCompetitionOwnerField(getHomeActiveJudokaId());
        document.getElementById("competition_nom").value = "";
        document.getElementById("competition_date").value = getCurrentLocalDate();
        document.getElementById("competition_categorie_age").value = "";
        document.getElementById("competition_categorie_poids").value = "";
        document.getElementById("competition_classement").value = "";
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
        id_competition: document.getElementById("competition_id").value,
        nom: document.getElementById("competition_nom").value,
        date: document.getElementById("competition_date").value,
        categorie_age: document.getElementById("competition_categorie_age").value,
        categorie_poids: document.getElementById("competition_categorie_poids").value,
        classement: document.getElementById("competition_classement").value
      };

      if (isAdmin || isParent) {
        competition.id_judoka = resolveCompetitionOwnerSelection();
        if (!competition.id_judoka) {
          showError({ message: getCompetitionOwnerRequiredMessage() });
          return;
        }
      }

      runServer(
        "saveCompetition",
        [competition],
        response => {
          showSuccess(response.message);
          reloadInitialData(response.id_competition);
        },
        showError
      );
    }

    function showCombatForm(id) {
      clearMessage();
      resetCombatForm();

      if (id) {
        const combat = currentCombats.find(c => String(c.id_combat) === String(id));

        if (!combat) {
          showError({ message: "Combat introuvable." });
          return;
        }

        document.getElementById("combatFormTitle").innerText = "Modifier le combat";
        document.getElementById("combatFormSubtitle").innerText = currentCompetition.nom || "";
        document.getElementById("saveCombatButtonText").innerText = "Enregistrer le combat";
        document.getElementById("combat_id").value = combat.id_combat || "";
        document.getElementById("combat_adversaire").value = combat.adversaire || "";
        document.getElementById("combat_resultat").value = combat.resultat || "";
        document.getElementById("combat_type_victoire").value = combat.type_victoire || "";
        document.getElementById("combat_deroule").value = combat.deroule || "";
        syncCombatDecisionVisibility(false);
      } else {
        document.getElementById("combatFormTitle").innerText = "Ajouter un combat";
        document.getElementById("combatFormSubtitle").innerText = currentCompetition.nom || "";
        syncCombatDecisionVisibility(true);
      }

      showView("combatFormView");
      document.getElementById("combat_adversaire").focus();
    }

    function cancelCombatForm() {
      resetCombatForm();
      showView("competitionView");
    }

    function saveCombat() {
      const idCombat = document.getElementById("combat_id").value;

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
          openCompetition(currentCompetition.id_competition, true);
        },
        showError
      );
    }

    function updateCombat(idCombat) {
      const combat = getCombatFormValue();
      combat.id_combat = idCombat;

      runServer(
        "updateCombat",
        [combat],
        response => {
          showSuccess(response.message);
          resetCombatForm();
          openCompetition(currentCompetition.id_competition, true);
        },
        showError
      );
    }

    function getCombatFormValue() {
      return {
        id_competition: currentCompetition.id_competition,
        id_judoka: currentCompetition.id_judoka,
        adversaire: document.getElementById("combat_adversaire").value,
        resultat: document.getElementById("combat_resultat").value,
        type_victoire: document.getElementById("combat_type_victoire").value,
        deroule: document.getElementById("combat_deroule").value
      };
    }

    function deleteCurrentCompetition() {
      if (!currentCompetition) return;

      const label = currentCompetition.nom ? ` "${currentCompetition.nom}"` : "";

      if (!window.confirm(`Supprimer la compétition${label} et tous ses combats ?`)) {
        return;
      }

      runServer(
        "deleteCompetition",
        [currentCompetition.id_competition],
        response => {
          showSuccess(response.message);
          currentCompetition = null;
          reloadInitialData();
        },
        showError
      );
    }

    function deleteCompetitionFromList(id, name) {
      const label = name ? ` "${name}"` : "";

      if (!window.confirm(`Supprimer la compétition${label} et tous ses combats ?`)) {
        return;
      }

      runServer(
        "deleteCompetition",
        [id],
        response => {
          showSuccess(response.message);
          reloadInitialData();
        },
        showError
      );
    }

    function deleteCombat(id) {
      if (!window.confirm("Supprimer ce combat ?")) {
        return;
      }

      runServer(
        "deleteCombat",
        [id],
        response => {
          showSuccess(response.message);
          openCompetition(currentCompetition.id_competition, true);
        },
        showError
      );
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
      return [normalizeDisplayName(j && j.prenom), normalizeLastName(j && j.nom)].filter(Boolean).join(" ");
    }

    function getCompactJudokaLabel(j) {
      const prenom = normalizeDisplayName(j && j.prenom);
      const nom = normalizeLastName(j && j.nom);
      if (!prenom && !nom) {
        return "";
      }
      if (!nom) {
        return prenom;
      }
      return `${prenom} ${nom.charAt(0)}.`;
    }

    function normalizeJudokaSelectionKey(value) {
      return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleLowerCase("fr-FR");
    }

    function resolveCompetitionOwnerSelection() {
      const hidden = document.getElementById("competition_id_judoka");
      const input = document.getElementById("competition_judoka_text");
      const hiddenValue = String(hidden.value || "").trim();

      if (hiddenValue && judokas.some(j => String(j.id_judoka) === hiddenValue)) {
        return hiddenValue;
      }

      const typedValue = normalizeJudokaSelectionKey(input.value);
      if (!typedValue) {
        const activeJudokaId = String(getHomeActiveJudokaId() || "").trim();
        if (activeJudokaId && judokas.some(j => String(j.id_judoka) === activeJudokaId)) {
          hidden.value = activeJudokaId;
          return activeJudokaId;
        }
        return "";
      }

      const matches = judokas.filter(j => {
        return [
          getJudokaDisplayName(j),
          getCompactJudokaLabel(j),
          j && j.id_judoka
        ].some(label => normalizeJudokaSelectionKey(label) === typedValue);
      });

      if (matches.length === 1) {
        const resolvedId = String(matches[0].id_judoka || "");
        hidden.value = resolvedId;
        input.value = getJudokaDisplayName(matches[0]);
        return resolvedId;
      }

      return "";
    }

    function bindAutocomplete({ inputId, dropdownId, hiddenId, getItems, allowBlank, onChange }) {
      const input = document.getElementById(inputId);
      const dropdown = document.getElementById(dropdownId);
      const hidden = document.getElementById(hiddenId);
      let isSelecting = false;

      function select(value, label) {
        input.value = label;
        hidden.value = value;
        dropdown.style.display = "none";
        isSelecting = false;
        onChange && onChange(value ? getItems().find(j => String(j.id_judoka) === String(value)) : null);
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
            opt.addEventListener("pointerdown", e => { e.preventDefault(); isSelecting = true; select(j.id_judoka, name); });
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
      const block = document.getElementById("competitionOwnerBlock");

      if (!isAdmin && !isParent) {
        block.classList.add("hidden");
        return;
      }

      block.classList.remove("hidden");

      // Branche l'autocomplete la première fois (évite les doublons de listeners)
      const input = document.getElementById("competition_judoka_text");
      if (!input.dataset.bound) {
        bindAutocomplete({
          inputId: "competition_judoka_text",
          dropdownId: "competition_judoka_dropdown",
          hiddenId: "competition_id_judoka",
          getItems: () => judokas
        });
        input.dataset.bound = "1";
      }

      const owner = judokas.find(j => String(j.id_judoka) === String(idJudoka));
      input.value = owner ? getJudokaDisplayName(owner) : "";
      document.getElementById("competition_id_judoka").value = idJudoka || "";
    }

    function getJudokaSecondaryText(judoka) {
      if (cleanText(judoka.email)) {
        return judoka.email;
      }

      return `ID ${String(judoka.id_judoka || "").slice(-6)}`;
    }

    function getJudokaSearchText(judoka) {
      return `${getJudokaDisplayName(judoka)} ${getJudokaSecondaryText(judoka)}`.toLowerCase();
    }

    function cleanText(value) {
      return String(value || "").trim();
    }

    function syncCombatDecisionVisibility(clearValueWhenHidden) {
      const result = document.getElementById("combat_resultat").value;
      const block = document.getElementById("combatDecisionBlock");
      const shouldShow = Boolean(result);
      block.classList.toggle("hidden", !shouldShow);

      if (!shouldShow && clearValueWhenHidden) {
        document.getElementById("combat_type_victoire").value = "";
      }
    }

    function resetCombatForm() {
      document.getElementById("combat_id").value = "";
      document.getElementById("combat_adversaire").value = "";
      document.getElementById("combat_resultat").value = "";
      document.getElementById("combat_type_victoire").value = "";
      document.getElementById("combat_deroule").value = "";
      document.getElementById("saveCombatButtonText").innerText = "Ajouter le combat";
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
      const target = document.getElementById("adminsList");
      if (!managedAdmins.length) {
        target.innerHTML = `<div class="empty-state">Aucun admin trouvé.</div>`;
        return;
      }

      let html = `<div class="list">`;
      managedAdmins.forEach(admin => {
        const fullName = getJudokaDisplayName(admin) || admin.email || "Admin";
        const isCurrentAdmin = currentUser && String(currentUser.id_judoka) === String(admin.id_judoka);
        html += `
          <article class="card admin-card">
            <p class="card-title">${escapeHtml(fullName)}</p>
            <div class="card-meta">
              <div class="meta-row">
                <span class="meta-label">Email</span>
                <span class="meta-value">${escapeHtml(admin.email || "Non renseigné")}</span>
              </div>
            </div>
            <div class="card-actions">
              ${isCurrentAdmin
                ? `<span class="current-admin-note">Vous</span>`
              : `<button class="button-danger" type="button" data-id="${escapeAttribute(admin.id_judoka)}" data-name="${escapeAttribute(fullName)}" onclick="revokeAdminRole(this.dataset.id, this.dataset.name)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z"></path><path d="M9 9l6 6"></path><path d="M15 9l-6 6"></path></svg>Révoquer</button>`}
            </div>
          </article>
        `;
      });
      html += `</div>`;
      target.innerHTML = html;
    }

    function renderManagedChildren() {
      const target = document.getElementById("childrenList");
      if (!managedChildren.length) {
        target.innerHTML = `<div class="empty-state">Aucun enfant enregistré pour le moment.</div>`;
        return;
      }

      let html = `<div class="list">`;
      managedChildren.forEach(child => {
        const fullName = getJudokaDisplayName(child) || "Enfant";
        const directAccessState = child.email ? "Activée" : "Non activée";
        html += `
          <article class="card child-card">
            <p class="card-title">${escapeHtml(fullName)}</p>
            <div class="card-meta">
              <div class="meta-row">
                <span class="meta-label">Prénom</span>
                <span class="meta-value">${escapeHtml(normalizeDisplayName(child.prenom || ""))}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Nom</span>
                <span class="meta-value">${escapeHtml(normalizeLastName(child.nom || ""))}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Email</span>
                <span class="meta-value">${escapeHtml(child.email || "Non renseigné")}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Connexion autonome</span>
                <span class="meta-value">${escapeHtml(directAccessState)}</span>
              </div>
            </div>
            <div class="card-actions">
              <button class="button-secondary" data-id="${escapeAttribute(child.id_judoka)}" onclick="editManagedChild(this.dataset.id)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>Modifier</button>
              <button class="button-danger" data-id="${escapeAttribute(child.id_judoka)}" data-name="${escapeAttribute(fullName)}" onclick="deleteManagedChild(this.dataset.id, this.dataset.name)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>Supprimer</button>
            </div>
          </article>
        `;
      });
      html += `</div>`;
      target.innerHTML = html;
    }

    function resetChildForm() {
      document.getElementById("child_id").value = "";
      document.getElementById("child_prenom").value = "";
      document.getElementById("child_nom").value = "";
      document.getElementById("child_email").value = "";
      document.getElementById("childFormTitle").innerText = "Ajouter un enfant";
      document.getElementById("saveChildButtonText").innerText = "Ajouter l'enfant";
    }

    function resetAdminForm() {
      document.getElementById("admin_email").value = "";
    }

    function resetAccessInvitationForm() {
      document.getElementById("invite_email").value = "";
      document.getElementById("invite_profile_type").value = "JUDOKA";
    }

    function editManagedChild(idJudoka) {
      const child = managedChildren.find(item => String(item.id_judoka) === String(idJudoka));
      if (!child) {
        showError({ message: "Enfant introuvable." });
        return;
      }

      document.getElementById("child_id").value = child.id_judoka || "";
      document.getElementById("child_prenom").value = child.prenom || "";
      document.getElementById("child_nom").value = child.nom || "";
      document.getElementById("child_email").value = child.email || "";
      document.getElementById("childFormTitle").innerText = "Modifier l'enfant";
      document.getElementById("saveChildButtonText").innerText = "Enregistrer l'enfant";
      showView("childrenView");
      document.getElementById("child_prenom").focus();
    }

    function saveManagedChild() {
      const child = {
        id_judoka: document.getElementById("child_id").value,
        prenom: document.getElementById("child_prenom").value,
        nom: document.getElementById("child_nom").value,
        email: document.getElementById("child_email").value
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
      const email = document.getElementById("admin_email").value;

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
      if (!window.confirm(`Supprimer l'enfant${label} ?`)) {
        return;
      }

      runServer(
        "deleteManagedChild",
        [idJudoka],
        response => {
          showSuccess(response.message);
          reloadInitialDataAndShowChildren();
        },
        showError
      );
    }

    function revokeAdminRole(idJudoka, name) {
      const label = name ? ` "${name}"` : "";
      if (!window.confirm(`Retirer les droits admin${label} ?`)) {
        return;
      }

      runServer(
        "revokeAdminRole",
        [idJudoka],
        response => {
          showSuccess(response.message);
          reloadInitialDataAndShowAdmins();
        },
        showError
      );
    }

    function reloadInitialData(openCompetitionId) {
      runServer(
        "getInitialData",
        [],
        data => {
          if (data.error) {
            showError({ message: data.error });
            return;
          }

          applyInitialData(data);

          if (openCompetitionId) {
            openCompetition(openCompetitionId, true);
          } else {
            showHome();
          }
        },
        showError
      );
    }

    function reloadInitialDataAndShowChildren() {
      runServer(
        "getInitialData",
        [],
        data => {
          if (data.error) {
            showError({ message: data.error });
            return;
          }

          applyInitialData(data);
          showChildrenManagement(true);
        },
        showError
      );
    }

    function reloadInitialDataAndShowAdmins() {
      runServer(
        "getInitialData",
        [],
        data => {
          if (data.error) {
            showError({ message: data.error });
            return;
          }

          applyInitialData(data);
          showAdminsManagement(true);
        },
        showError
      );
    }

    function showHome() {
      currentCompetition = null;
      currentCombats = [];
      currentJudokaProfile = null;
      canManageCurrentCompetition = false;
      canEditCurrentCompetition = false;
      syncHomeContext();
      renderCompetitions();
      showView("homeView");
    }

    function showView(id) {
      ["loginView", "homeView", "judokaView", "adminsView", "childrenView", "competitionView", "competitionFormView", "combatFormView"].forEach(viewId => {
        document.getElementById(viewId).classList.add("hidden");
      });

      document.getElementById(id).classList.remove("hidden");
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
      const prenom = normalizeDisplayName(judoka && judoka.prenom);
      const nom = normalizeLastName(judoka && judoka.nom);
      return `${prenom.charAt(0) || ""}${nom.charAt(0) || ""}`.trim() || "J";
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
      const toastLayer = document.getElementById("toastLayer");
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
      document.getElementById("toastLayer").innerHTML = "";
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

    document.getElementById("combat_resultat").addEventListener("change", () => {
      syncCombatDecisionVisibility(true);
    });

    init();
