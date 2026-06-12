    const runtimeConfig = window.KIROKU_RUNTIME_CONFIG || {};
    const defaultAccessInvitationVisibleCount = 8;
    const state = createInitialState();

    function createInitialState() {
      return {
        currentUser: null,
        isAdmin: false,
        isParent: false,
        canManageChildren: false,
        competitions: [],
        currentCompetition: null,
        judokas: [],
        currentCombats: [],
        currentJudokaProfile: null,
        managedAdmins: [],
        managedAccessInvitations: [],
        managedChildren: [],
        canEditCurrentCompetition: false,
        previousView: "homeView",
        accessInvitationSearch: "",
        accessInvitationVisibleCount: defaultAccessInvitationVisibleCount
      };
    }
    const {
      $,
      cleanText,
      emptyState,
      escapeAttribute,
      escapeHtml,
      formatDate,
      formatDateTime,
      formatResultat,
      getClassementBadgeClass,
      getCompactJudokaLabel,
      getCurrentLocalDate,
      getJudokaDisplayName,
      getJudokaInitials,
      getValue,
      icons,
      normalizeDisplayName,
      normalizeLastName,
      setHidden,
      setText,
      setTexts,
      setValue,
      setValues,
      toInputDate,
      viewIds
    } = window.KirokuUI;
    const notifications = window.createKirokuNotifications({ $, escapeHtml });
    const {
      clearMessage,
      dismissToast,
      showError,
      showSuccess
    } = notifications;
    const auth = window.createKirokuAuth({
      runtimeConfig,
      onInvitationRequired: showInvitationRequired,
      onError: showError
    });
    const {
      clearVercelSession,
      getValidVercelSession,
      logoutSupabaseSession,
      parseVercelAuthCallback
    } = auth;

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

    function resetApplicationState() {
      Object.assign(state, createInitialState());
    }

    async function logoutUser() {
      clearMessage();
      await logoutSupabaseSession();
      resetApplicationState();
      showVercelLogin();
      showSuccess("Vous êtes déconnecté.");
    }

    function startGoogleLogin() {
      clearMessage();
      auth.startGoogleLogin();
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
      state.currentUser = data.user;
      state.isAdmin = Boolean(data.isAdmin);
      state.isParent = Boolean(data.isParent);
      state.canManageChildren = Boolean(data.canManageChildren);
      state.competitions = Array.isArray(data.competitions) ? data.competitions : [];
      state.judokas = Array.isArray(data.judokas) ? data.judokas : [];
      document.querySelector("header").classList.remove("hidden");

      const profileTypeLabel = state.isParent ? "PARENT" : "JUDOKA";
      const roleLabel = state.isAdmin ? `ADMIN · ${profileTypeLabel}` : profileTypeLabel;
      $("userInfo").innerHTML =
        `<strong>${escapeHtml(getJudokaDisplayName(state.currentUser) || "")}</strong> - ${roleLabel}`;
      setHidden("homeAdminActions", false);
      setHidden("manageAdminsButton", !state.isAdmin);
      setHidden("manageChildrenButton", !state.canManageChildren);

      const filterInput = $("filterJudokaText");
      const filterHidden = $("filterJudoka");
      const canFilterByJudoka = (state.isAdmin || state.isParent) && state.judokas.length > 0;
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
        getItems: () => state.judokas,
        allowBlank: true,
        onChange: () => {
          syncHomeContext();
          renderCompetitions();
        }
      });
      input.dataset.bound = "1";
    }

    function getAccessibleHomeJudokas() {
      if (!state.currentUser) {
        return [];
      }
      return (state.isAdmin || state.isParent) ? state.judokas : [state.currentUser];
    }

    function getDefaultHomeJudokaId() {
      if (!state.currentUser) {
        return "";
      }
      if (state.isAdmin) {
        return "";
      }
      return String(state.currentUser.judokaId || "");
    }

    function ensureHomeActiveJudokaSelection() {
      const input = $("filterJudokaText");
      const hidden = $("filterJudoka");
      const accessibleJudokas = getAccessibleHomeJudokas();
      const currentValue = hidden.value;

      if (!(state.isAdmin || state.isParent)) {
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
      if (!state.currentUser) {
        return "";
      }
      if (state.isAdmin || state.isParent) {
        return getValue("filterJudoka") || "";
      }
      return String(state.currentUser.judokaId || "");
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
        const summaryMeta = state.isAdmin
          ? "Vous consultez actuellement le parcours de ce judoka."
          : state.isParent
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

      const actionDisabled = Boolean((state.isAdmin || state.isParent) && !activeJudoka);
      $("addCompetitionButton").disabled = actionDisabled;
      $("openHomeJudokaProfileButton").disabled = actionDisabled;
    }

    function getHomeContextCopy(activeJudoka) {
      if (state.isAdmin) {
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

      if (state.isParent) {
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
        profileButtonMeta: getCompactJudokaLabel(state.currentUser),
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

      if ((state.isAdmin || state.isParent) && !activeJudoka) {
        target.innerHTML = emptyState("Sélectionnez un judoka pour afficher son parcours.");
        return;
      }

      let filteredComps = state.competitions;
      if (activeJudokaId) {
        filteredComps = state.competitions.filter(c => String(c.ownerJudokaId) === String(activeJudokaId));
      }

      if (!filteredComps.length) {
        target.innerHTML = emptyState("Aucune compétition enregistrée pour ce judoka.");
        return;
      }

      const judokasById = new Map(state.judokas.map(j => [String(j.judokaId), j]));

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
                  ${(state.isAdmin || state.isParent) ? `<span class="meta-row">
                    <span class="meta-label">Judoka</span>
                    <span class="meta-value">${escapeHtml(judokaNom)}</span>
                  </span>` : ""}
                </span>
                <span class="card-open-hint">Ouvrir les combats</span>
              </span>
            </button>
            ${state.isAdmin ? `<div class="card-actions">
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
          state.currentCompetition = data.competition;
          state.currentCombats = Array.isArray(data.combats) ? data.combats : [];
          state.judokas = Array.isArray(data.judokas) ? data.judokas : [];
          state.canEditCurrentCompetition = Boolean(data.canEditCompetition);

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
        competitionTitle: state.currentCompetition.name || "Compétition",
        competitionSubtitle: "Détail de la compétition",
        competitionDate: formatDate(state.currentCompetition.competitionDate)
      });

      const agePoids = [state.currentCompetition.ageCategory, state.currentCompetition.weightCategory].filter(Boolean).join(" - ");
      setHidden("row_competitionAgePoids", !agePoids);
      setText("competitionAgePoids", agePoids);

      const hasResult = Boolean(String(state.currentCompetition.result || "").trim());
      setHidden("row_competitionClassement", !hasResult);
      setText("competitionClassement", state.currentCompetition.result);

      setHidden("competitionAdminActions", !state.canEditCurrentCompetition);
      setHidden("finalizeCompetitionButton", !state.canEditCurrentCompetition || hasResult);
    }

    function openHomeJudokaProfile() {
      if (!state.currentUser) {
        showError({ message: "Utilisateur introuvable." });
        return;
      }

      const accessibleJudokas = getAccessibleHomeJudokas();
      const targetJudokaId = getHomeActiveJudokaId();

      if ((state.isAdmin || state.isParent) && !targetJudokaId) {
        showError({
          message: state.isAdmin
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
      if ((state.isAdmin || state.isParent) && !activeJudokaId) {
        showError({
          message: state.isAdmin
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
          state.currentJudokaProfile = data;
          renderJudokaProfile();
          showView("judokaView");
        },
        showError
      );
    }

    function renderJudokaProfile() {
      if (!state.currentJudokaProfile) {
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
      } = state.currentJudokaProfile;

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
      if (!state.currentCompetition) {
        showError({ message: "Compétition introuvable." });
        return;
      }

      showCompetitionForm(state.currentCompetition.competitionId);
    }

    function renderCombats() {
      const target = $("combatsList");

      if (!state.currentCombats.length) {
        target.innerHTML = emptyState("Aucun combat pour cette compétition.");
        return;
      }

      let html = `<div class="list">`;

      state.currentCombats.forEach(c => {
        html += `
          <article class="card combat-card">
            <div class="combat-header">
              <p class="card-title">${escapeHtml(c.opponent || "Adversaire non renseigné")}</p>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
                <span class="result-badge result-${escapeAttribute(String(c.result || "").toLowerCase())}">${formatResultat(c.result)}</span>
                ${c.victoryType ? `<span class="result-badge" style="background: var(--line); border-color: var(--muted);">${escapeHtml(c.victoryType)}</span>` : ""}
              </div>
            </div>
            ${state.isAdmin ? `
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
      if (!state.managedAccessInvitations.length) {
        summary.innerHTML = "";
        target.innerHTML = emptyState("Aucune invitation en attente.");
        return;
      }

      const filteredInvitations = getFilteredAccessInvitations();
      const hasActiveFilter = Boolean(state.accessInvitationSearch);
      const visibleInvitations = hasActiveFilter
        ? filteredInvitations
        : filteredInvitations.slice(0, state.accessInvitationVisibleCount);
      const remainingInvitations = Math.max(filteredInvitations.length - visibleInvitations.length, 0);
      const summaryLabel = hasActiveFilter
        ? `${filteredInvitations.length} résultat(s) sur ${state.managedAccessInvitations.length} invitation(s).`
        : `${visibleInvitations.length} invitation(s) affichée(s) sur ${state.managedAccessInvitations.length}.`;

      summary.innerHTML = `
        <div class="list-summary">
          <p class="list-summary-text">${escapeHtml(summaryLabel)}</p>
          <div class="list-summary-actions">
            ${hasActiveFilter
              ? `<button class="button-secondary" type="button" onclick="resetAccessInvitationSearch()">Effacer le filtre</button>`
              : remainingInvitations > 0
                ? `<button class="button-secondary" type="button" onclick="showMoreAccessInvitations()">Voir ${Math.min(defaultAccessInvitationVisibleCount, remainingInvitations)} de plus</button>
                   <button class="button-secondary" type="button" onclick="showAllAccessInvitations()">Tout afficher</button>`
                : state.accessInvitationVisibleCount > defaultAccessInvitationVisibleCount && filteredInvitations.length > defaultAccessInvitationVisibleCount
                  ? `<button class="button-secondary" type="button" onclick="collapseAccessInvitations()">Réduire la liste</button>`
                  : ""}
          </div>
        </div>
      `;

      if (!filteredInvitations.length) {
        target.innerHTML = `<div class="empty-state">Aucune invitation trouvée pour "${escapeHtml(state.accessInvitationSearch)}".</div>`;
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
      if (!state.accessInvitationSearch) {
        return state.managedAccessInvitations;
      }

      return state.managedAccessInvitations.filter(invitation =>
        cleanText(invitation.email).toLowerCase().includes(state.accessInvitationSearch)
      );
    }

    function updateAccessInvitationSearch(value) {
      state.accessInvitationSearch = cleanText(value).toLowerCase();
      state.accessInvitationVisibleCount = defaultAccessInvitationVisibleCount;
      renderManagedAccessInvitations();
    }

    function resetAccessInvitationSearch() {
      state.accessInvitationSearch = "";
      state.accessInvitationVisibleCount = defaultAccessInvitationVisibleCount;
      const input = $("accessInvitationFilter");
      if (input) {
        input.value = "";
      }
      renderManagedAccessInvitations();
    }

    function showMoreAccessInvitations() {
      state.accessInvitationVisibleCount += defaultAccessInvitationVisibleCount;
      renderManagedAccessInvitations();
    }

    function showAllAccessInvitations() {
      state.accessInvitationVisibleCount = state.managedAccessInvitations.length;
      renderManagedAccessInvitations();
    }

    function collapseAccessInvitations() {
      state.accessInvitationVisibleCount = defaultAccessInvitationVisibleCount;
      renderManagedAccessInvitations();
    }

    function showCompetitionForm(id) {
      clearMessage();
      state.previousView = state.currentCompetition ? "competitionView" : "homeView";

      if (id) {
        const c = state.competitions.find(x => String(x.competitionId) === String(id)) || state.currentCompetition;

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
        state.previousView = "homeView";
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
      showView(state.previousView || "homeView");
    }

    function getCompetitionOwnerRequiredMessage() {
      return state.isAdmin
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

      if (state.isAdmin || state.isParent) {
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
      if (!state.currentCompetition) {
        showError({ message: "Compétition introuvable." });
        return;
      }

      setValue("finalization_competition_id", state.currentCompetition.competitionId);
      setText("competitionFinalizationSubtitle", state.currentCompetition.name);
      setValue("finalization_classement", state.currentCompetition.result);
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
        const combat = state.currentCombats.find(c => String(c.combatId) === String(id));

        if (!combat) {
          showError({ message: "Combat introuvable." });
          return;
        }

        setTexts({
          combatFormTitle: "Modifier le combat",
          combatFormSubtitle: state.currentCompetition.name,
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
          combatFormSubtitle: state.currentCompetition.name
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
      if (!state.currentCompetition) {
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
          openCompetition(state.currentCompetition.competitionId, true);
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
          openCompetition(state.currentCompetition.competitionId, true);
        },
        showError
      );
    }

    function getCombatFormValue() {
      return {
        competitionId: state.currentCompetition.competitionId,
        judokaId: state.currentCompetition.ownerJudokaId,
        opponent: getValue("combat_adversaire"),
        result: getValue("combat_resultat"),
        victoryType: getValue("combat_type_victoire"),
        notes: getValue("combat_deroule")
      };
    }

    function deleteCurrentCompetition() {
      if (!state.currentCompetition) return;

      const label = state.currentCompetition.name ? ` "${state.currentCompetition.name}"` : "";
      confirmAndRun({
        message: `Supprimer la compétition${label} et tous ses combats ?`,
        method: "deleteCompetition",
        args: [state.currentCompetition.competitionId],
        onSuccess: response => {
          showSuccess(response.message);
          state.currentCompetition = null;
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
          openCompetition(state.currentCompetition.competitionId, true);
        }
      });
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

      if (hiddenValue && state.judokas.some(j => String(j.judokaId) === hiddenValue)) {
        return hiddenValue;
      }

      const typedValue = normalizeJudokaSelectionKey(input.value);
      if (!typedValue) {
        const activeJudokaId = String(getHomeActiveJudokaId() || "").trim();
        if (activeJudokaId && state.judokas.some(j => String(j.judokaId) === activeJudokaId)) {
          hidden.value = activeJudokaId;
          return activeJudokaId;
        }
        return "";
      }

      const matches = state.judokas.filter(j => {
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

      if (!state.isAdmin && !state.isParent) {
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
          getItems: () => state.judokas
        });
        input.dataset.bound = "1";
      }

      const owner = state.judokas.find(j => String(j.judokaId) === String(idJudoka));
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
          state.managedChildren = Array.isArray(data.children) ? data.children : [];
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
          state.managedAdmins = Array.isArray(data.admins) ? data.admins : [];
          state.managedAccessInvitations = Array.isArray(data.accessInvitations) ? data.accessInvitations : [];
          state.accessInvitationSearch = "";
          state.accessInvitationVisibleCount = defaultAccessInvitationVisibleCount;
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
      if (!state.managedAdmins.length) {
        target.innerHTML = emptyState("Aucun admin trouvé.");
        return;
      }

      let html = `<div class="list">`;
      state.managedAdmins.forEach(admin => {
        const fullName = getJudokaDisplayName(admin) || admin.accountEmail || "Admin";
        const isCurrentAdmin = state.currentUser && String(state.currentUser.judokaId) === String(admin.judokaId);
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
      if (!state.managedChildren.length) {
        target.innerHTML = emptyState("Aucun enfant enregistré pour le moment.");
        return;
      }

      let html = `<div class="list">`;
      state.managedChildren.forEach(child => {
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
      const child = state.managedChildren.find(item => String(item.judokaId) === String(idJudoka));
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
      state.currentCompetition = null;
      state.currentCombats = [];
      state.currentJudokaProfile = null;
      state.canEditCurrentCompetition = false;
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
